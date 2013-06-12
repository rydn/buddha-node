var Hook = require( '../lib/Hook' ).Hook,
	genUUID = require( '../lib/genUUID' ),
	Threads = require( 'webworker-threads' ),
	path = require( 'path' ),
	Worker = require( 'webworker-threads' ).Worker,
	moment = require( 'moment' ),
	fs = require( 'fs' ),
	Canvas = require( 'canvas' ),
	config = {
		threads: 4,
		resolution: {
			x: 600,
			y: 600
		}
	};
$this = this,
currentQueueID = null,
isActive = false,
buddhaWorkerPool = new Array( 10 ),
pixels = new Uint8ClampedArray( config.resolution.x * config.resolution.y * 3 ),
samples = 0;
//  log wrapper

function $log( m, type ) {
	console.log( '[ ' + moment( ).format( 'hh:mm:ss DD/MM/YYYY' ) + ' ] -- Worker[' + process.pid + '] =>	' + m );
	//	p7ush onto socket
	// workSocket.emit( 'log', {
	// 	m: m,
	// 	pid: process.pid,
	// 	type: type
	// } );
	return;
}

function $save( ) {}
//  create new socket hook for catching the servers render calls
var workSocket = new Hook( {
	name: 'renderworker_' + process.pid,
	local: true,
	port: 1976
} );
/**
 *      Hook events
 */
workSocket.on( 'hook::connected', function( ) {
	$log( 'renderworker now connected on port: ' + 1976 );
} );
workSocket.on( 'hook::ready', function( ) {
	$log( 'renderworker now ready for work' );
} );
workSocket.on( 'hook::newListener', function( type, hookName ) {
	$log( 'New worker hook, type: ' + type + ' worker name: ' + hookName );
} );
/**
 *	Initialise the workers
 */
for ( var k = 0; k < 10; k++ ) {
	//	spawn new workers, they spin up and then wait for instruction over ipc
	buddhaWorkerPool[ k ] = new Worker( 'workers/multiWorker.js' );
	//	on worker returning result
	buddhaWorkerPool[ k ].onmessage = function( event ) {
		$log( 'Worker(' + event.data.id + ') returned result. Now interpolating....', 'workRes' );
		var canvas = new Canvas( config.resolution.x, config.resolution.y );
		var canvasWidth = canvas.width;
		var canvasHeight = canvas.height;
		var ctx = canvas.getContext( "2d" );
		ctx.fillStyle = 'black';
		ctx.fillRect( 0, 0, canvasWidth, canvasHeight );
		var canvasData = ctx.getImageData( 0, 0, canvasWidth, canvasHeight );
		for ( i = 0; i < canvasWidth; i++ ) {
			for ( j = 0; j < canvasHeight; j++ ) {
				if ( pixels[ ( j * canvasWidth + i ) * 3 + 0 ] != event.data.buffer[ ( j * canvasWidth + i ) * 3 + 0 ] ) pixels[ ( j * canvasWidth + i ) * 3 + 0 ] = Math.floor( ( pixels[ ( j * canvasWidth + i ) * 3 + 0 ] + 2 * event.data.buffer[ ( j * canvasWidth + i ) * 3 + 0 ] ) / 3 );
				if ( pixels[ ( j * canvasWidth + i ) * 3 + 1 ] != event.data.buffer[ ( j * canvasWidth + i ) * 3 + 1 ] ) pixels[ ( j * canvasWidth + i ) * 3 + 1 ] = Math.floor( ( pixels[ ( j * canvasWidth + i ) * 3 + 1 ] + 2 * event.data.buffer[ ( j * canvasWidth + i ) * 3 + 1 ] ) / 3 );
				if ( pixels[ ( j * canvasWidth + i ) * 3 + 2 ] != event.data.buffer[ ( j * canvasWidth + i ) * 3 + 2 ] ) pixels[ ( j * canvasWidth + i ) * 3 + 2 ] = Math.floor( ( pixels[ ( j * canvasWidth + i ) * 3 + 2 ] + 2 * event.data.buffer[ ( j * canvasWidth + i ) * 3 + 2 ] ) / 3 );
				canvasData.data[ ( j * canvasWidth + i ) * 4 + 0 ] = pixels[ ( j * canvasWidth + i ) * 3 + 0 ];
				canvasData.data[ ( j * canvasWidth + i ) * 4 + 1 ] = pixels[ ( j * canvasWidth + i ) * 3 + 1 ];
				canvasData.data[ ( j * canvasWidth + i ) * 4 + 2 ] = pixels[ ( j * canvasWidth + i ) * 3 + 2 ];
				canvasData.data[ ( j * canvasWidth + i ) * 4 + 3 ] = 255;
			}
		}
		//	place data on virtual canvas
		ctx.putImageData( canvasData, 0, 0 );
		//	save data to file
		ctx.canvas.toBuffer( function( errr, buffer ) {
			var savePath = path.join( __dirname, '../public/images/renders/' + currentQueueID + '_' + event.data.id + '.png' );
			fs.writeFile( savePath, buffer );
			$log( 'file saved to "' + savePath + '"' );
		} );
	};
	//	bind to eorror event on thread
	buddhaWorkerPool[ k ].thread.on( 'error', function( err ) {
		$log( err, 'error' );
	} );
	buddhaWorkerPool[ k ].onerror = function( err ) {
		console.log( require( 'util' ).inspect( err ) );
		$log( err, 'error' );
	};
	$log( 'Worker #' + ( buddhaWorkerPool[ k ].thread.id + 1 ) + ' ready for work', 'status' );
}
//	on new work issued
workSocket.on( 'workmaster::render', function( job ) {
	currentQueueID = job.data.queueID;
	$log( 'received instruction to begin rendering, jobid: ' + currentQueueID, 'render' );
	var now = moment( );
	//	base object for job
	var baseOptions = {
		title: now.format( 'DD/MM/YYYY, hh:mm:ss ' ),
		queueID: genUUID( ),
		created_time: new Date( ).getTime( ),
		params: {
			tollerances: [ 1250, 250, 50 ],
			points: 50000,
			limit: 10000 / 10
		},
		size: {
			x: config.resolution.x,
			y: config.resolution.y
		}
	};
	//	issue work to each worker
	for ( var k = 0; k < 10; k++ ) {
		buddhaWorkerPool[ k ].postMessage( {
			opt: [ baseOptions.size.x, baseOptions.size.y, baseOptions.params.limit * ( k + 1 ), baseOptions.params.tollerances[ 0 ], baseOptions.params.tollerances[ 1 ], baseOptions.params.tollerances[ 2 ] ],
			wid: genUUID( ),
			gid: k
		} );
	}
} );
//  connect message socket
workSocket.connect( );