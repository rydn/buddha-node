/*
    deps
 */
//inport google closure name space
require('nclosure').nclosure();
//  matricies google closure unit
goog.require('goog.math.Matrix');
var fs = require('fs'),
    sys = require('sys'),
    os = require('os'),
    Canvas = require('canvas'),
    moment = require('moment'),
    genUUID = require('../lib/genUUID');

function jobLog(message) {
    //console.log(JSON.stringify({action:'log', value:message}));
    //console.log('Spawed Worker [' + process.pid + '] - ' + message);
}
jobLog(' online.');
/*
    upon receiving instruction to compute
 */
process.on('message', function(m) {
    if (m.action == 'startRender') {
        var data = m.value;
        jobLog('received instruction to begin computation.' + m);
        var $job = {
            data: newJob(),
            progress: function(current, limit) {
                var message = 'Progress ' + current + '/' + limit;
                console.log(JSON.stringify({action:'progress', value:message}));
            }
        };

        //  initate work actor and wait to be called back once work is complete
        actor($job, function(err, workDone) {
            if (err) process.send({action:'error', value:err});
            else process.send({action:'done', value:workDone});
        });
    } else {
        jobLog(m);
    }
});

/*
    Private  methods
 */
//  create job object

function newJob() {
    var now = moment();
    return {
        title: now.format('DD/MM/YYYY HH:MM:SS'),
        queueID: genUUID(),
        created_time: new Date().getTime(),
        params: {
            tollerances: [1250, 250, 50],
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

function actor(job, done) {

    // variables passed through job object
    var tollerances = job.data.params.tollerances;
    var points = job.data.params.points;
    var limit = job.data.params.limit;


    var canvas = new Canvas(job.data.size.x, job.data.size.y);

    var context;
    var N;
    var currentRender;
    var image;

    var exposures = [];
    var maxexposure = [0, 0, 0];

    var counter = 0;

    var latestInfo;
    var start = new Date().getTime();
    var totalStart = new Date().getTime();

    function print_infobar() {
        var passed = new Date();
        var passed_s = (passed.getTime() - totalStart) / 1000;

        var passed_string = [];
        passed_string[0] = Math.floor(passed_s / (60 * 60));
        passed_s -= passed_string[0] * 60 * 60;
        passed_string[1] = Math.floor(passed_s / 60);
        passed_s -= passed_string[1] * 60;
        passed_string[2] = Math.floor(passed_s);
        if (passed_string[1] < 10) passed_string[1] = '0' + passed_string[1];
        if (passed_string[2] < 10) passed_string[2] = '0' + passed_string[2];

        //context.fillText('Buddhabrot', 10, 10);
        jobLog('Iteration: ' + counter, 10, 25);
        jobLog('Runtime: ' + passed_string.join(":"), 10, 40);
    }

    function draw() {
        //  increment job progress
        job.progress(counter, limit);
        //  if counter hits render limit
        if (counter > limit) {
            //  save to file
            save();
            //  call back with base64 render
            done(null, {
                done_time: new Date().getTime(),
                result_base64: currentRender
            });
            return;
        }
        counter++;
        plot();
        findMaxExposure();
        render();
        setTimeout(draw, 0);
    }

    function save() {

        try {
            context.canvas.toDataURL(function(err, cb64) {
                currentRender = cb64;
                context.canvas.toBuffer(function(errr, buffer) {
                    fs.writeFile(__dirname + '/' + job.queueID + '.png', buffer);
                    jobLog('file saved, ' + job.queueID + '.png');
                });
            });
        } catch (e) {
            jobLog('failed to save image, err: ' + e);
        }
    }

    function plot() {
        var x, y, i;
        for (i = 0; i <= points; i++) {
            x = Math.random() * 3 - 2;
            y = Math.random() * 3 - 1.5;
            for (var pass = 0; pass < 3; pass++) iterate(x, y, pass);
        }
    }

    function iterate(x0, y0, pass) {
        var x = 0,
            y = 0,
            xnew, ynew, drawnX, drawnY;
        for (var i = 0; i <= tollerances[pass]; i++) {
            xnew = x * x - y * y + x0;
            ynew = 2 * x * y + y0;
            if ((xnew * xnew + ynew * ynew) > 4) { // inlined iterate_draw
                x = 0, y = 0, xnew, ynew, drawnX, drawnY;
                for (var i = 0; i <= tollerances[pass]; i++) {
                    xnew = x * x - y * y + x0;
                    ynew = 2 * x * y + y0;
                    if (i > 3) {
                        drawnX = Math.round(N * (xnew + 2.0) / 3.0);
                        drawnY = Math.round(N * (ynew + 1.5) / 3.0);
                        if (0 <= drawnX && drawnX < N && 0 <= drawnY && drawnY < N) {
                            exposures[pass].array_[drawnX][drawnY]++;
                        }
                    }
                    if ((xnew * xnew + ynew * ynew) > 4) return;
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

    function findMaxExposure() {

        for (var pass = 0; pass < 3; pass++) {
            goog.math.Matrix.map(exposures[pass], function(value, i, j, matrix) {
                if (value > maxexposure[pass]) {
                    maxexposure[pass] = value;
                }
            });
        }
    }

    function render() {

        var data = image.data,
            r, g, b, tmpExposure, i, x, y;

        for (var pass = 0; pass < 3; pass++) {
            goog.math.Matrix.map(exposures[pass], function(value, i, j, matrix) {
                var ramp = value / (maxexposure[pass] / 2.5);
                if (ramp > 1 || isNaN(ramp)) ramp = 1;
                idx = (i * N + j) * 4;
                data[idx + pass] = ramp * 255;
            });
        }

        context.globalAlpha = 1 / 8;
        // Loop for each blur pass.
        for (i = 1; i <= 4; i += 1) { // 4
            for (y = -1; y < 2; y += 1) { // 3
                for (x = -1; x < 2; x += 1) {
                    context.putImageData(image, 0, 0);

                }
            }
        }

        context.globalAlpha = 1.0;

    }

    function init(cb) {
        jobLog('running canvas initailisation');

        jobLog('setting preferances');
        context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.font = '10px sans-serif';
        context.textBaseline = 'top';

        jobLog('initiating canvas object');
        N = canvas.width;
        image = context.createImageData(N, N);


        jobLog('calculating exposures and alpha channel values from complex plane');
        for (var pass = 0; pass < 3; pass++)
        exposures[pass] = new goog.math.Matrix(N, N);
        for (var i = 0; i < N; i++)
        for (var j = 0; j < N; j++)
        image.data[(i * N + j) * 4 + 3] = 255; // alpha channel
        cb();
    }


    //  istantiation
    init(function() {
        draw();
    });
}