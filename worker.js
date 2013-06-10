//inport google closure name space
require( 'nclosure' ).nclosure( );
//  matricies google closure unit
goog.require( 'goog.math.Matrix' );
var fs = require( 'fs' ),
    sys = require( 'sys' ),
    os = require( 'os' ),
    Canvas = require( 'canvas' ),
    moment = require( 'moment' ),
    genUUID = require( './lib/genUUID' ),
    Hook = require( './lib/Hook' ).Hook,
    EventEmitter2 = require( 'eventemitter2' ).EventEmitter2,
    buddhaWorker = require( './jobs/clusterbrott' ),
    isActive = false;
//  Event source 
var eventSource = new EventEmitter2( {
    wildcard: true,
    delimiter: '::',
    newListener: false
} );
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

//  on the issue of work enqueue new work and pass data to worker
workSocket.on( '*::render', function( job ) {
    if ( !isActive ) {
        $log( 'received instruction to begin rendering, jobid: ' + job.data.queueID );
        workSocket.emit( 'start', job );
        isActive = true;
        startRender( job );

    } else {
        $log( 'currently rendering... another process will need to prcess it, sending busy' );
        workSocket.emit( 'busy', {
            pid: process.pid,
            job: job
        } );
    }
} );
//  log wrapper

function $log( m ) {
    console.log( 'Worker [' + process.pid + '] - ' + m );
    // workSocket.emit( 'log', {
    //     m: m,
    //     pid: process.pid
    // } );
}
//      event handlers for event source
//      

//      on render progress
eventSource.on( '*::progress', function( progData ) {
    workSocket.emit( 'progress', progData );
    $log( progData.message );
} );
//  on job complete
eventSource.on( '*::done', function( workData ) {
    $log( 'Job complete', workData );
    workSocket.emit( 'done', workData );
    isActive = false;
} );
//  on errror
eventSource.on( '*::error', function( errorData ) {
    workSocket.emit( 'error', {
        error: errorData
    } );
    throw errorData.error;
} );
//  connect message socket
workSocket.connect( );
/*
    upon receiving instruction to compute
 */
var startRender = function( m ) {

    var data = m.data;
    var $job = {
        data: newJob( ),
        progress: function( current, limit ) {
            var message = 'Progress ' + current + '/' + limit;
            $log( message );
            eventSource.emit( 'progress', {
                message: message,
                values: [ limit, current ]
            } );
        }
    };
    //  initate work actor and wait to be called back once work is complete
    actor( $job, function( err, workDone ) {
        if ( err ) eventSource.emit( 'error', {
                error: err
            } );
        else eventSource.emit( 'done', {
                result: workDone
            } );
    } );

};
/*
    Private  methods
 */
//  create job object

function newJob( ) {
    var now = moment( );
    return {
        title: now.format( 'DD/MM/YYYY HH:MM:SS' ),
        queueID: genUUID( ),
        created_time: new Date( ).getTime( ),
        params: {
            tollerances: [ 1250, 250, 50 ],
            points: 500,
            limit: 250
        },
        size: {
            x: 600,
            y: 600
        }
    };
}
/**
 *  render new fractal renturn when done
 *
 * @param  {Kue_Job}   job  [ The job in the Kue ]
 * @param  {Function} done [ callback ]
 */

function actor( job, done ) {
    // variables passed through job object
    var tollerances = job.data.params.tollerances;
    var points = job.data.params.points;
    var limit = job.data.params.limit;
    var canvas = new Canvas( job.data.size.x, job.data.size.y );
    var context;
    var N;
    var currentRender;
    var image;
    var exposures = [ ];
    var maxexposure = [ 0, 0, 0 ];
    var counter = 0;
    var latestInfo;
    var start = new Date( ).getTime( );
    var totalStart = new Date( ).getTime( );

    function print_infobar( ) {
        var passed = new Date( );
        var passed_s = ( passed.getTime( ) - totalStart ) / 1000;
        var passed_string = [ ];
        passed_string[ 0 ] = Math.floor( passed_s / ( 60 * 60 ) );
        passed_s -= passed_string[ 0 ] * 60 * 60;
        passed_string[ 1 ] = Math.floor( passed_s / 60 );
        passed_s -= passed_string[ 1 ] * 60;
        passed_string[ 2 ] = Math.floor( passed_s );
        if ( passed_string[ 1 ] < 10 ) passed_string[ 1 ] = '0' + passed_string[ 1 ];
        if ( passed_string[ 2 ] < 10 ) passed_string[ 2 ] = '0' + passed_string[ 2 ];
        //context.fillText('Buddhabrot', 10, 10);
        $log( 'Iteration: ' + counter, 10, 25 );
        $log( 'Runtime: ' + passed_string.join( ":" ), 10, 40 );
    }

    function draw( ) {
        //  increment job progress
        job.progress( counter, limit );
        //  if counter hits render limit
        if ( counter > limit ) {
            //  save to file
            save( );
            //  call back with base64 render
            done( null, {
                done_time: new Date( ).getTime( ),
                result_base64: currentRender
            } );
            return;
        }
        counter++;
        plot( );
        findMaxExposure( );
        render( );
        setTimeout( draw, 0 );
    }

    function save( ) {
        try {
            context.canvas.toDataURL( function( err, cb64 ) {
                currentRender = cb64;
                context.canvas.toBuffer( function( errr, buffer ) {
                    fs.writeFile( __dirname + '/' + job.queueID + '.png', buffer );
                    $log( 'file saved, ' + job.queueID + '.png' );
                } );
            } );
        } catch ( e ) {
            $log( 'failed to save image, err: ' + e );
        }
    }

    function plot( ) {
        var x, y, i;
        for ( i = 0; i <= points; i++ ) {
            x = Math.random( ) * 3 - 2;
            y = Math.random( ) * 3 - 1.5;
            for ( var pass = 0; pass < 3; pass++ ) iterate( x, y, pass );
        }
    }

    function iterate( x0, y0, pass ) {
        var x = 0,
            y = 0,
            xnew, ynew, drawnX, drawnY;
        for ( var i = 0; i <= tollerances[ pass ]; i++ ) {
            xnew = x * x - y * y + x0;
            ynew = 2 * x * y + y0;
            if ( ( xnew * xnew + ynew * ynew ) > 4 ) { // inlined iterate_draw
                x = 0, y = 0, xnew, ynew, drawnX, drawnY;
                for ( var i = 0; i <= tollerances[ pass ]; i++ ) {
                    xnew = x * x - y * y + x0;
                    ynew = 2 * x * y + y0;
                    if ( i > 3 ) {
                        drawnX = Math.round( N * ( xnew + 2.0 ) / 3.0 );
                        drawnY = Math.round( N * ( ynew + 1.5 ) / 3.0 );
                        if ( 0 <= drawnX && drawnX < N && 0 <= drawnY && drawnY < N ) {
                            exposures[ pass ].array_[ drawnX ][ drawnY ]++;
                        }
                    }
                    if ( ( xnew * xnew + ynew * ynew ) > 4 ) return;
                    x = xnew;
                    y = ynew;
                }
                return;
            }
            x = xnew;
            y = ynew;
        }
        return;
    }

    function findMaxExposure( ) {
        for ( var pass = 0; pass < 3; pass++ ) {
            goog.math.Matrix.map( exposures[ pass ], function( value, i, j, matrix ) {
                if ( value > maxexposure[ pass ] ) {
                    maxexposure[ pass ] = value;
                }
            } );
        }
    }



    function render( ) {
        var data = image.data,
            r, g, b, tmpExposure, i, x, y;
        for ( var pass = 0; pass < 3; pass++ ) {
            goog.math.Matrix.map( exposures[ pass ], function( value, i, j, matrix ) {
                var ramp = value / ( maxexposure[ pass ] / 2.5 );
                if ( ramp > 1 || isNaN( ramp ) ) ramp = 1;
                idx = ( i * N + j ) * 4;
                data[ idx + pass ] = ramp * 255;
            } );
        }
        context.globalAlpha = 1 / 8;
        // Loop for each blur pass.
        for ( i = 1; i <= 4; i += 1 ) { // 4
            for ( y = -1; y < 2; y += 1 ) { // 3
                for ( x = -1; x < 2; x += 1 ) {
                    context.putImageData( image, 0, 0 );
                }
            }
        }
        context.globalAlpha = 1.0;
    }

    function init( cb ) {
        $log( 'running canvas initailisation' );
        $log( 'setting preferances' );
        context = canvas.getContext( '2d' );
        context.fillStyle = '#fff';
        context.font = '10px sans-serif';
        context.textBaseline = 'top';
        $log( 'initiating canvas object' );
        N = canvas.width;
        image = context.createImageData( N, N );
        $log( 'calculating exposures and alpha channel values from complex plane' );
        for ( var pass = 0; pass < 3; pass++ )
            exposures[ pass ] = new goog.math.Matrix( N, N );
        for ( var i = 0; i < N; i++ )
            for ( var j = 0; j < N; j++ )
                image.data[ ( i * N + j ) * 4 + 3 ] = 255; // alpha channel
        cb( );
    }

    //  istantiation of above methods
    init( function( ) {
        draw( );
    } )
}