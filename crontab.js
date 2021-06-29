var Spawn   = require('child_process').spawn;
const COMMAND = 'crontab';

function makeChildArgs(action) {
    var args = [];
    let user = '';
    var root   = (process.getuid() == 0);
    if (user) {
      args = args.concat('-u', user);
    }
    
    if (action == 'load') {
      args.push('-l');
    }
    if (action == 'save' && process.platform !== 'sunos') {
      args.push('-e');
    }
    
    return args;
}

function makeChildCommand() {
    var command = COMMAND;
    let user = '';
    var root   = (process.getuid() == 0);

    if (user.length > 0 && root == false) {
      command = 'sudo ' + command;
    }
    
    return command;
  }

exports.saveCronJob = (job)=> {
    return new Promise((resolve, reject)=> {
        var stdout  = '';
        var stderr  = '';
        var args    = makeChildArgs('save');
        var command = makeChildCommand();
        var child   = Spawn(command, args);
        console.log(command, args)
    
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        
        child.stdout.on('data', function(chunk) {
          stdout += chunk;
        });
        child.stderr.on('data', function(chunk) {
          stderr += chunk;
        });
        child.on('error', function (err) {
            console.log(err);
        });
        child.on('close', function (code) {
            console.log(code);
            if (code == 0) {
              resolve({success: true});
            }
            else {
              reject({success: false})
            }
        });
        
        child.stdin.write(job);
        child.stdin.end();
    })
    
  }