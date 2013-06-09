var Hook = require('../lib/Hook').Hook;
var workerPool = new Hook({
    name: 'workmaster',
    local: true,
    port: 1976
});
//  start a new hook mesh server for distrubting the work
workerPool.on('hook::ready', function() {
    $log('Work master connected to dispatch on port: ' + 1976);

});
workerPool.start();
/**
 *
 * @param  {Kue_Job}   job  [ The job in the Kue ]
 * @param  {Function} done [ callback ]
 */
module.exports = function(job, done) {
    $log('emitting job to worker pool: '+ job.data.queueID);
    //  wrapper that emitts jobs to the clustermaster which spawns new job

    workerPool.on('*::start', function(passedStart) {
        $log('render job: '+ job.data.queueID + ' spawned by clustermaster');
        job.log('render job: '+ job.data.queueID + ' spawned by clustermaster');
    });
    workerPool.on('*::progress', function(passedProg) {
        $log(passedProg.count, passedProg.limit);
        job.progress(passedProg.count, passedProg.limit);
    });
    workerPool.on('*::done', function(passedDone) {
        done(passedDone.err, passedDone.result);
    });
    workerPool.emit('render', job);
};

function $log(m){
    console.log('Queue Dispatch ['+process.pid+'] - '+m);
}