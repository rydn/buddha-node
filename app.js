var iterations = [1250, 250, 50];
var points = 50000;
var limit = 10000;

require('nclosure').nclosure(); //inport google closure name space
var Canvas = require('canvas');
var canvas = new Canvas(600, 800);
var context;
var N;
var currentRender;
var image;
var exposures = [];
var maxexposure = [0, 0, 0];
var counter = 0;
var os = require('os');
var renderTimeArr = [{}]; //for storing rendering times
var renderLoadArr = [{}]; //for storing load data
var latestInfo;
var start = new Date().getTime();
var totalStart = new Date().getTime();
var http = require('http');
goog.require('goog.math.Matrix'); //matricies google closure unit
//event listener for writing to file and emmiting
var fs = require('fs');


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
	context.fillText('Iteration: ' + counter, 10, 25);
	context.fillText('Runtime: ' + passed_string.join(":"), 10, 40);
}

function draw(res) {
	if (counter > limit) return;
	counter++;
	var now = new Date().getTime();
	var timeLastIteration = now - start;
	start = new Date().getTime();
	renderTimeArr.push({
		start: timeLastIteration
	});
	var avg = Math.round(((now - totalStart) / counter) * 100) / 100;
	if (counter !== 1) {
		latestInfo = '[Iteration compute time: ' + timeLastIteration + 'ms, avg: ' + avg + 'ms, total: ' + ((new Date().getTime() - totalStart) / 1000) + 'sec]';
		console.log(latestInfo);
		var load = os.loadavg();
		renderLoadArr.push({
			start: load
		});
		console.log('[load Averages 1min: ' + load[0] + ', 5min: ' + load[1] + ', 15min: ' + load[2] + ']');
	}
	console.log(' ');

	console.log('[Begining iteration: ' + counter + ']')
	console.log('--------------------------');

	console.log('...plotting...');
	plot();

	console.log('...calculating max exposure...');
	findMaxExposure();

	console.log('...rendering...');
	render();

	//console.log('...printing info...')
	//print_infobar();

	console.log('...saving...');
	save();

	setTimeout(draw, 0);
}

function save() {
	fs = require('fs');
	sys = require('sys');
	try {
		context.canvas.toDataURL(function(err, cb64){
			currentRender = cb64;
		context.canvas.toBuffer(function(errr, buffer) {
			fs.writeFile(__dirname + '/buddha.png', buffer);
			console.log('...file saved');
		});
	});
	} catch (e) {
		console.log('failed to save image, err: ' + e);
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
	for (var i = 0; i <= iterations[pass]; i++) {
		xnew = x * x - y * y + x0;
		ynew = 2 * x * y + y0;
		if ((xnew * xnew + ynew * ynew) > 4) { // inlined iterate_draw
			x = 0, y = 0, xnew, ynew, drawnX, drawnY;
			for (var i = 0; i <= iterations[pass]; i++) {
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
	console.log('...updating canvas object...');
	context.globalAlpha = 1.0;

}

function init(cb) {
	console.log('running init');
	console.log('...setting preferances');
	context = canvas.getContext('2d');
	context.fillStyle = '#fff';
	context.font = '10px sans-serif';
	context.textBaseline = 'top';
	console.log('...initiating canvas object');
	N = canvas.width;
	image = context.createImageData(N, N);
	console.log('...praying to the devine buddha');
	console.log('done!');
	console.log('init run, begining render..');
	for (var pass = 0; pass < 3; pass++)

		exposures[pass] = new goog.math.Matrix(N, N);

	for (var i = 0; i < N; i++)
		for (var j = 0; j < N; j++)
			image.data[(i * N + j) * 4 + 3] = 255; // alpha channel
	cb();
}
//start renderer
init(function() {
	http.createServer(function(req, res) {
		res.writeHead(200, {
			'Content-Type': 'text/html'
		});
		try {
			res.end( '<meta http-equiv="refresh" content="10;" >'+'<div id="info">' + latestInfo + '</div>' +'<img src="' + currentRender + '"></meta>');
		} catch (e) {
			console.log(e);
			res.end('<div id="info">' + latestInfo + '</div>' + '<meta http-equiv="refresh" content="10;" />');
		}
	}).listen(3000);
	console.log('Server started on port 3000');
	draw();
});