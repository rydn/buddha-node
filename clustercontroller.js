var ComputeCluster = require('compute-cluster'),
    Hook = require('./lib/Hook').Hook;
//	create new socket hook for catching the servers render calls
var workSocket = new Hook({
    name: 'dispatch',
    local: true,
    port: 1976
});
workSocket.start();
workSocket.on('hook::listening', function() {
    $log('clustercontroller now listening on port: ' + 1976);
});
workSocket.on('hook::ready', function() {
    $log('clustercontroller now ready');
});
workSocket.on('children::ready', function() {
    $log('child joined worker pool');
});
//	define what the work is and how many workers to occastrate
var cc = new ComputeCluster({
    module: './jobs/clusterbrott.js',
    max_backlog: -1,
    max_processes: 1
});
//	on the issue of work enqueue new work and pass data to worker
workSocket.on('*::render', function(data) {
    $log('clustercontroller spawning new render worker');

    // new child worker
    var child = require('child_process').fork('./jobs/clusterbrott.js');
    child.send({action:'startRender', value:data});
    child.stdout.on('data', function (stcData) {
    	$log(stcData);
    });
    child.on('message', function(m, cData) {
        $('received child message', m);
        switch (m) {
        case 'progress':
            break;
        case 'done':
            break;
        case 'log':

            break;
        case 'started':
            workSocket.emit('start', data);
            break;
        default: console.log(m);
            break;
        }

    });


});

function $log(m) {
    console.log('Cluster Controller [' + process.pid + '] - ' + m);
}