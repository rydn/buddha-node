var Queue = require( '../lib/Queue.js' ),
	moment = require( 'moment' );
/*
 * GET home page.
 */
exports.index = function( req, res ) {
	res.render( 'index', {
		title: 'Express'
	} );
};
exports.initRender = function( req, res ) {
	//  create new render job
	Queue.createQueueItem( function( $item ) {
		res.json( {
			item: $item,
			action: 'Queued to render'
		} );
		$item.on( 'complete', function( ) {
			//  return work object as response to http request
			$log( $item.data.queueID + ' \n complete', 'complete' );
		} );
		$item.on( 'failed', function( ) {
			$log( $item.data.queueID + ' \n failed', 'failed' );
		} );
		Queue.processWithWorker( 'buddhabrot' );
	} );
};

function $log( m, type ) {
	if ( type ) console.log( '[ ' + moment( ).format( 'hh:mm:ss DD/MM/YYYY' ) + ' ] -- HttpServer ::' + type + '[' + process.pid + '] =>  ' + m );
	else console.log( '[ ' + moment( ).format( 'hh:mm:ss DD/MM/YYYY' ) + ' ] -- HttpServer[' + process.pid + '] =>   ' + m );
}