"use strict";
var ECT = require('ect');
var path = require( "path" );
var Primus = require( "primus" );
var express = require( "express" );
var session = require( "express-session" );
var twitterAPI = require( "node-twitter-api" );
var cookie_parser = require( "cookie-parser" );

var server_port = process.env.PORT || 8080;

// Get your credentials here: https://dev.twitter.com/apps
var twitter = new twitterAPI({
    consumerKey: "consumerKey",
    consumerSecret: "consumerSecret",
    callback: "http://127.0.0.1:8080/sessions/callback"
});

var _requestSecret;
var ectRenderer = ECT({
  watch: true,
  root: __dirname + '/views',
  ext : '.ect'
});
var session_middleware = session({
    secret: 'secret keyboard cat',
    resave: false,
    saveUninitialized: true
    // cookie: { maxAge: 60000 }
});
/*
 *  SERVER
 */

var app = express();
var server = require( 'http' ).createServer( app );

app.set( 'view engine', 'ect' );
app.engine( 'ect', ectRenderer.render );
app.use( express["static"]( path.join( __dirname, 'public' ) ) );
app.use( cookie_parser() );
app.use( session_middleware );

app.get( "/", function( req, res ) {
  if ( req.session.accessToken && req.session.accessSecret) {
    twitter.verifyCredentials( req.session.accessToken, req.session.accessSecret, function( err, user ) {
      if ( err ) {
        res.render( "login" );
      } else {
        res.render( "home", user );
      }
    });
  } else {
    res.render( "login" );
  }
});

app.get( '/sessions/connect', function( req, res ){
  twitter.getRequestToken( function( err, requestToken, requestSecret ){
    if ( err ) {
      console.error( "Error getting OAuth request token :", err );
      res.status( 500 ).send( "Error getting OAuth request token." );
    } else {
      //store token and tokenSecret somewhere, you'll need them later; redirect user
      _requestSecret = requestSecret;
      res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
    }
  });
});

app.get( '/sessions/callback', function( req, res ){
  var requestToken = req.query.oauth_token,
  verifier = req.query.oauth_verifier;

  twitter.getAccessToken( requestToken, _requestSecret, verifier, function( err, accessToken, accessSecret ) {
    if ( err ) {
      console.error( "Error getting OAuth access token :", err );
      res.status (500 ).send( "Error getting OAuth access token." );
    } else {
      twitter.verifyCredentials( accessToken, accessSecret, function( err, user ) {
        if ( err ) {
          console.error( "Error verify credentials :", err );
          res.status(500).send( "Error verify credentials" );
        } else {
          req.session.accessToken = accessToken;
          req.session.accessSecret = accessSecret;
          res.redirect( "/" );
        }
      });
    }
  });
});


app.get( '/logout', function( req, res ){
  req.session.destroy();
  res.redirect( "/" );
});


app.use( function( req, res ) {
  return res.status(404).send( '<p>Sorry, we cannot find that!</p><a href="/">Go home</a>' );
});
app.use( function( error, req, res ) {
  return res.status(500).send({
    error: 'something blew up'
  });
});
server.listen( server_port );
console.log( "Server listen on port: " + server_port );

var primus = new Primus( server, {
  transformer: 'websockets'
});
primus.on( 'connection', function( spark ) {
  spark.on( "data", function( data ) {
    var ac_t = this.request.session.accessToken,
      ac_s = this.request.session.accessSecret;
    switch ( data["switch"] ) {
      case '/api/v1/check_login':
        twitter.verifyCredentials( ac_t, ac_s, function( err, user ) {
          if ( err ) {
            spark.write({
              "switch" : "error",
              message : "Not login!"
            });
          } else {
            spark.write({
              "switch" : "status",
              message : "Logined"
            });
          }
        });
        break;
      case '/api/v1/logout':
        this.request.session.destroy(function( err ){
          if ( err ) {
            spark.write({
              "switch" : "error",
              message : "Error on logout."
            });
          } else {
            spark.write({
              "switch" : "status",
              message : "Logout successful."
            });
          }
        });
        break;
      case '/api/v1/search':
        if ( !data.query ) {
          spark.write({
            "switch" : "error",
            message : "Not valid params"
          });
        }
        twitter.search( {q: "#" + data.query }, ac_t, ac_s, function( err, search_data ) {
          if ( err ) {
            console.log(err);
            spark.write({
              "switch" : "error",
              message : "Error try later"
            });
          } else {
            spark.write({
              "switch" : "search_result",
              data : {
                query : search_data.search_metadata.query,
                list : search_data.statuses
              }
            });
          }
        });
        break;
      default:
        console.error('wrong switch', data);
    }
  });
});

primus.save( __dirname + '/public/primus.js' );
primus.before( 'cookies', cookie_parser() );
primus.before( 'session', session_middleware );
