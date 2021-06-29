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
const configPath = os.homedir() + '/.codelock_config.json';
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
.action(name => {
   const existingConfig = fs.existsSync(configPath);
    if(existingConfig) {
        const codelock_config = fs.readFileSync(configPath, 'utf8');
        Config.prompt(JSON.parse(codelock_config), true);
    } else {
        Config.prompt();
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
            fs.unlinkSync(scriptPath);
            fs.unlinkSync(configPath);
            const data = await axios.post('https://test.api.codelock.ai/api/v1/remove-project', {project_id: credentials.project_id}, {
                auth: {
                    username: credentials.api_key,
                    password: credentials.secret
                }
            });
            if(data.data.code === 0 ) {
                console.log('Project Removed Succssfully');
                process.exit(1);
            } else{
                console.log('Failed To Remove Project');
                process.exit(1);
            }
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