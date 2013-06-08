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
    //  create new render job
    Queue.createQueueItem(function($item) {
        console.log('new item created with queueID:', $item.data.queueID);





        $item.on('complete', function() {
                //  return work object as response to http request
        res.json({
            item: $item
        });

            console.log($item + ' \n complete');

        });

        $item.on('failed', function() {
            console.log($item + ' \n failed');
        });
        $item.on('progress', function(progress) {
            process.stdout.write('\r  job #' + $item.data.queueID+ ' ' + progress + '% complete');
        });
        Queue.processWithWorker('buddhabrot');
    });


};
