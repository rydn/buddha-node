var kue = require( 'kue' ),
	redis = require( 'redis' ),
	moment = require( 'moment' ),
	Hook = require( './Hook' ).Hook,
	genUUID = require( './genUUID' );
var workerPool = new Hook( {
	name: 'workmaster',
	local: true,
	port: 1976
} );
//  start a new hook mesh server for distrubting the work
workerPool.on( 'hook::ready', function( ) {
	$log( 'Work master listening to work dispatch on port: ' + 1976 );

} );

workerPool.on( 'hook::newListener', function( type, hookName ) {
	$log( 'New worker hook, type: ' + type + ' worker name: ' + hookName );
} );



//  override redis client so we can use non default server
kue.redis.createClient = function( ) {
	var client = redis.createClient( 6379, 'data.habitat4.info' );
	return client;

};
//  Create new queue
var workQueue = kue.createQueue( );

/*
    Interface for controling work kue
     */
module.exports = {
	/**
	 * add a new buddha rendering job to kue
	 *
	 * @callback c [returns when buddha is enqueued]
	 */
	createQueueItem: function( c ) {
		var now = moment( );
		var data = {
			title: now.format( 'DD/MM/YYYY HH:MM:SS' ),
			queueID: genUUID( ),
			created_time: new Date( ).getTime( ),
			params: {
				tollerances: [ 1250, 250, 50 ],
				points: 50000,
				limit: 25000
			},
			size: {
				x: 600,
				y: 600
			}
		};
		var $worker = workQueue.create( 'buddhabrott', data ).save( );
		c( $worker );
		//  callback with $worker
	},
	/**
	 * starts the interface to the queue manager
	 * @param  {String} title [title to set for web interface]
	 * @param  {Number} port  [port to bind to]
	 *
	 * @callback c [returns when buddha queue manager interface is up]
	 */
	startInterface: function( title, port ) {
		kue.app.set( 'title', title );
		kue.app.listen( port );
		$log( 'Kue interface running on port: ' + port );

	},
	/**
	 * start rendering a buddha if queue is empty or
	 * @param  {String} jobName [the identifyer for the job required]
	 */
	processWithWorker: function( jobName ) {
		workQueue.process( 'buddhabrott', function( job, done ) {
			$log( 'emitting job to worker pool: ' + job.data.queueID );
			workerPool.emit( 'render', job );

			workerPool.on( '*::start', function( passedStart ) {
				$log( 'render job: ' + passedStart.job.data.queueID + ' started by worker with pid: ' + passedStart.pid );
				var workerName = passedStart.name;
				workerPool.on( workerName + '::progress', function( passedProg ) {
					job.progress( passedProg.values[ 1 ], passedProg.values[ 0 ] );
					$log( passedProg.message);
				} );
				workerPool.on( workerName + '::done', function( passedDone ) {
					console.log( require( 'util' ).inspect( passedDone ) );
					$log( 'work completed for  ' + passedDone.data.queueID + ' at ' + new Date( ) );
					done( passedDone.err, passedDone.result );
				} );
				workerPool.on( workerName + '::busy', function( busyData ) {
					$log( 'All workers busy right  now will need to wait for work to complete', 'busy' );
					done('All workers busy right  now will need to wait for work to complete', null);
				} );
				workerPool.on( workerName + '::log', function( m ) {
					job.log( m.m );
					$log( m.m, 'log' );
				} );
			} );


		} );

	}
};

function $log( m, type ) {

	var now = moment( );
	if ( type ) console.log( now.format( "Do MMMM HH:MM:SS " ) + ' | Queue::' + type + ' [' + process.pid + '] =>    ' + m );
	else console.log( now.format( "Do MMMM HH:MM:SS " ) + ' | Queue [' + process.pid + '] =>    ' + m );
}

workerPool.listen( );