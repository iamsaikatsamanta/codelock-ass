#!/usr/bin/env node

const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const program = require('commander');
const semver = require('semver');
const requiredVersion = require('../package.json').engines.node
const Config = require('./config');
const os = require('os');
const axios = require('axios');
const { parseOptions } = require('commander');
const configPath = os.homedir() + '\\AppData\\Codelock\\codelock_config.json';
const exec = require('child_process').exec;
const which = require('which');
function checkNodeVersion (wanted, id) {
    if (!semver.satisfies(process.version, wanted, { includePrerelease: true })) {
      console.log(chalk.red(
        'You are using Node ' + process.version + ', but this version of ' + id +
        ' requires Node ' + wanted + '.\nPlease upgrade your Node version.'
      ))
      process.exit(1)
    }
}

checkNodeVersion(requiredVersion, 'codelock')


program
  .version(`codelock ${require('../package').version}`)
  .usage('<command>')

program.command('init')
.description('create a new project powered by Codelock')
  .option('-a, --apiKey <string>',)
  .option('-s, --secret <string>',)
  .option('-b, --buildPath <string>',)
  .option('-p, --projectId <string>',)
  .option('-f, --frequency <number>',)
.action((name, options) => {
    let credentials
    if(name && JSON.stringify(name)!== '{}') {
        credentials = {
            api_key: name.apiKey,
            secret: name.secret,
            build_path: name.buildPath ? name.buildPath : process.cwd(),
            project_id: name.projectId,
            scan_frequency: name.frequency ? name.frequency : 5,
        }
        if(!credentials.api_key || credentials.api_key === '' || !credentials.secret || credentials.secret === '' || !credentials.build_path || !credentials.build_path === '' ||
        !credentials.project_id || credentials.project_id === '' || !credentials.scan_frequency || (Number(credentials.scan_frequency) > 59 || Number(credentials.scan_frequency) < 1)) {
            Config.prompt(credentials);
        } else {
            Config.initProject(credentials);
        }
    } else{
        const existingConfig = fs.existsSync(configPath);
        if(existingConfig) {
            const codelock_config = fs.readFileSync(configPath, 'utf8');
            Config.prompt(JSON.parse(codelock_config), true);
        } else {
            Config.prompt();
        }
    }
   
});

program.command('scan')
.action(async name => {
    try {
        const existingConfig = fs.readFileSync(configPath, 'utf8');
        const credentials = JSON.parse(existingConfig);
        const hash = await Config.triggerScan(credentials.hash_function, credentials.build_path);
        const afterSendData = await Config.sendScanedHash(hash);
        console.log('Scan Succssful');
    }catch(e) {
        console.log('Scan Failed');
        process.exit(1);
    }
});

program.command('unlink')
.action(async name => {
    try {
        const existingConfig = fs.existsSync(configPath);
        if(existingConfig){
            const existingConfig = fs.readFileSync(configPath, 'utf8');
            const credentials = JSON.parse(existingConfig);
            const scriptPath = os.homedir() + `/.codelock_${credentials.project_id}.js`;
            const nodePath = await which('node');
            exec(`(crontab -l | grep -v "${nodePath} ${scriptPath}") | crontab -`, async (stdin, stderr)=>{
                if(stderr) {
                    console.log('Failed To Remove Project');
                    process.exit(1);
                }
                const data = await axios.post(`${credentials.server}:8080/api/v1/remove-project`, {project_id: credentials.project_id}, {
                auth: {
                    username: credentials.api_key,
                    password: credentials.secret
                }
                });
                if(data.data.code === 0 ) {
                    fs.unlinkSync(scriptPath);
                    fs.unlinkSync(configPath);
                    console.log('Project Removed Succssfully');
                    process.exit(1);
                } else{
                    console.log('Failed To Remove Project');
                    process.exit(1);
                }
            });
        } else {
            console.log('No Project Found');
            process.exit(1);
        }
       
    }catch(e) {
        console.log(e);
        console.log('Failed To Remove Project');
        process.exit(1);
    }
});

program.parse(process.argv);