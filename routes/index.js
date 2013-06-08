var Queue = require('../lib/Queue.js');


/*
 * GET home page.
 */

exports.index = function(req, res) {
    res.render('index', {
        title: 'Express'
    });
};

exports.initRender = function(req, res) {
    Queue.createJob(function(jobItem) {
        console.log('new job item created! ', jobItem);
        Queue.processWithWorker('buddhabrot', function(_jobName, _worker) {
            console.log('Job ' + _jobName + ' enqueued, details: \n' + _worker);
            //	return work object as response to http request
            res.json({
                jobname: _jobName,
                worker: _worker
            });

		/**
			Worker events
		 */
            _worker.on('complete', function() {
                console.log(_worker + ' \n complete');
            });

            _worker.on('failed', function() {
                console.log(_worker + ' \n failed');
            });
            _worker.on('progress', function() {
                process.stdout.write('\r  job #' + job.id + ' ' + progress + '% complete');
            });
        });
    });
};