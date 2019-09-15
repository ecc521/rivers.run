const Pitboss = require('pitboss-ng').Pitboss;

var code = "777";

var sandbox = new Pitboss(code, {
    memoryLimit: 32*1024, // 32 MB memory limit.
    timeout: 500, //500 milliseconds to run.
    heartBeatTick: 100 //100 milliseconds between memory checks.
});

sandbox.run({
		context: {'num': 23}
	}, 
	function (err, result) {
		if (err !== null) {console.error(err)}
		console.log(result)
		sandbox.kill();
});