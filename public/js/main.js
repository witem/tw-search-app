"use strict";

var insert_status = function( error, msg ){
  if (error) {
    document.getElementById( "res_status" ).classList.add( "error" );
  } else {
    document.getElementById( "res_status" ).classList.remove( "error" );
  }
  document.getElementById( "res_status" ).textContent = msg;
};

var insert_result = function( data ){
  var temp;
  var res_div = document.getElementById( "search_result" );
  for (var i = 0, len = data.list.length; i < len; i++) {
    temp =  document.createElement( "p" );
    temp.textContent = data.list[i].text;
    res_div.insertBefore( temp, res_div.childNodes[0] || null );
  }
  var query = document.createElement( "h4" );
  query.innerHTML = "Yor query: '" + data.query.replace( "%23", "#" ) + "'<br> Time: " + new Date();
  res_div.insertBefore( query, res_div.childNodes[0] || null );
};

var primus = new Primus();

primus.on( "open", function () {
  console.log("Connected!");
});

primus.on( "data", function ( data ) {
  switch ( data.switch ) {
    case "error" :
      insert_status( true, data.message );
      break;
    case "status" :
      insert_status( false, data.message );
      break;
    case "search_result" :
      insert_result( data.data );
      break;
    default :
      console.error( "NOT DEFINED RESPONSE", data );
  }
});

var login_button = document.getElementById( "sign_in_with_twitter" );
if ( login_button ) {
  login_button.addEventListener( "click", function( event ){
    event.preventDefault();
    window.location.href = "/sessions/connect";
  });
}

var form = document.getElementById( "search_form" );
if ( form ) {
  form.addEventListener( "submit", function( event ){
    event.preventDefault();
    primus.write({
      "switch" : "/api/v1/search",
      query : this.elements.query.value
    });
  });
}
