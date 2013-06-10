/**
 * Module dependencies.
 */

var express = require( 'express' ),
	routes = require( './routes' ),

	moment = require( 'moment' ),
	http = require( 'http' ),
	Queue = require( './lib/Queue' ),
	path = require( 'path' );

var app = express( );

// all environments
app.set( 'port', process.env.PORT || 3000 );
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'jshtml' );
app.use( express.favicon( ) );
app.use( express.logger( 'dev' ) );
app.use( express.bodyParser( ) );
app.use( express.methodOverride( ) );
app.use( app.router );
app.use( express.static( path.join( __dirname, 'public' ) ) );

// development only
if ( 'development' == app.get( 'env' ) ) {
	app.use( express.errorHandler( ) );
}

app.get( '/', routes.index );
app.post( '/render/buddhabrott', routes.initRender );

http.createServer( app ).listen( app.get( 'port' ), function( ) {
	$log( 'Express server listening on port ' + app.get( 'port' ) );
	Queue.startInterface( 'Buddha Processing Queue', process.env.QUEUE_PORT || 3001 );
} );

function $log( m, type ) {
	if ( type ) console.log( '[ ' + moment( ).format( 'hh:mm:ss DD/MM/YYYY' ) + ' ] -- HttpServer ::' + type + '[' + process.pid + '] =>  ' + m );

	else console.log( '[ ' + moment( ).format( 'hh:mm:ss DD/MM/YYYY' ) + ' ] -- HttpServer[' + process.pid + '] =>   ' + m );
}