var kue = require('kue'),
    redis = require('redis'),
    genUUID = require('./genUUID');
//  override redis client so we can use non default server
kue.redis.createClient = function() {
    var client = redis.createClient(6389, 'data.habitat4.info');
    return client;
};
//  Create new queue
var workQueue = kue.createQueue();
/*
    Interface for controling work kue
     */
module.exports = {
    /**
     * add a new buddha rendering job to kue
     *
     * @callback c [returns when buddha is enqueued]
     */
    createJob: function(c) {
        var data = {
            queueID: genUUID(),
            created_time: new Date().getTime(),
            params: {
                iterations: [1250, 250, 50],
                points: 50000,
                limit: 10000
            },
            size: {
                x: 600,
                y: 600
            }
        };
        var _queue = workQueue.create('buddhabrot', data).save();
        //  callback with _queue
        c(_queue);
    },
    /**
     * starts the interface to the queue manager
     * @param  {String} title [title to set for web interface]
     * @param  {Number} port  [port to bind to]
     *
     * @callback c [returns when buddha queue manager interface is up]
     */
    startInterface: function(title, port) {
        kue.app.set('title', title);
        kue.app.listen(port);
        console.log('Kue interface running on port: '+ port);
    },
    /**
     * start rendering a buddha if queue is empty or
     * @param  {String} jobName [the identifyer for the job required]
     */
    processWithWorker: function(jobName) {
        var worker = require('../jobs/' + jobName + '.js');
        workQueue.process(jobName, worker);
    }
};