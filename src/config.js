const inquirer = require('inquirer');
const fs = require('fs');
const axios = require('axios');
const dirhash = require('dirhash');
const os = require('os');
const which = require('which');
const configPath = os.homedir() + '\\AppData\\Codelock\\codelock_config.json';
const exec = require('child_process').exec;


exports.prompt = (codelock_config, fileFound = false) => {
    let credentials;
    inquirer.prompt([
        {
            name: 'api_key',
            type: 'string',
            message: 'Please Enter Your API Key?',
            default: codelock_config ? codelock_config.api_key : null
        },
        {
            name: 'secret',
            type: 'password',
            message: 'Please Enter Your Secret Key?',
            mask: true,
            default: codelock_config ? codelock_config.secret : null
        },
        {
            name: 'server',
            type: 'string',
            message: 'Please Enter Your Server Url(http://api.codelock.com/http://192.168.0.1)',
            mask: true,
            default: codelock_config ? codelock_config.server : null
        },
        {
            name: 'build_path',
            type: 'string',
            message: 'Please enter your build folder path?',
            default: codelock_config ? codelock_config.build_path : process.cwd()
        },
        {
            name: 'project_id',
            type: 'string',
            message: 'Please enter project id form codelock dashboard?',
            default: codelock_config ? codelock_config.project_id : null
        },
        {
            name: 'scan_frequency',
            type: 'number',
            message: 'Please enter how frquent you wnat to scam your code in minutes? (1-59)',
            default: codelock_config ? codelock_config.scan_frequency : 5
        },
    ])
    .then(response =>{
        initProject(response);
    })
    .catch(err => {
        console.log(err);
        console.log('Something went wrong please try again');
    });
}

const initProject =(response) => {
    // console.log(response.scan_frequency === '');
    if(!response.api_key || response.api_key === '' || !response.secret || response.secret === '' || !response.build_path || !response.build_path === '' ||
    !response.project_id || response.project_id === '' || !response.scan_frequency || response.server==='' || !response.server) {
        console.log('Failed To Initialize The Project');
        process.exit(1);
    }
    if(Number(response.scan_frequency) > 59 || Number(response.scan_frequency) < 1) {
        console.log('Invalid Scan Frequency');
        process.exit(1);
    }
    let credentials = response;
    configureProject(response)
    .then(response =>{
        if (response.code === 0) {
            if(!fs.existsSync(os.homedir() + '\\AppData\\Codelock')){
                fs.mkdirSync(os.homedir() + '\\AppData\\Codelock');
            }
            fs.writeFileSync(configPath, JSON.stringify({...credentials, hash_function: response.result.hash_function}))
            return triggerScan(response.result.hash_function, credentials.build_path);
        } else {
            console.log(response.result);
            process.exit(1);
        }
    })
    .then(async resp => {
        exec(`schtasks.exe /create /tn codelock-scan /sc minute /mo ${credentials.scan_frequency} /tr \"cmd /c codelock scan\"`, async (stdin, stderr)=>{
                if(stderr) {
                    console.log('Failed To Schedule Scan');
                    process.exit(1);
                } else{
                    return sendScanedHash(resp, true);

                }
        })

    })
    .then(resp => {
        console.log('Congratulations Project Setup Successful');
        setInterval(()=> {
            process.exit(1);
        }, 3000);
    })
    .catch(err => {
        console.log('Something went wrong please try again');
        // process.exit(1);
    });
}


const configureProject = (codelock_config) => {
    return new Promise(async (resolve, reject) =>{
        try {
            const data = await axios.post(`${codelock_config.server}/api/v1/configure-project`, 
            {project_id: codelock_config.project_id, build_path: codelock_config.build_path, scan_frequency: codelock_config.scan_frequency} ,{
                auth: {
                    username: codelock_config.api_key,
                    password: codelock_config.secret
                }
            });
            resolve(data.data);
        }catch(err) {
            console.log(err);
            reject(err);
        }
    })
};

const triggerScan = (hash_function, build_path) => {
    return new Promise((resolve, reject) => {
        try {
            const get_hash = dirhash(build_path, hash_function);
            resolve(get_hash);
        } catch(err) {
            reject(err);
        }  
    });
};

const sendScanedHash = (hash, init=false) => {
    new Promise(async (resolve, reject) => {
        try {
            const codelock_config = fs.readFileSync(configPath, 'utf8');
            if (codelock_config) {
                const credentials = JSON.parse(codelock_config);
                const data = await axios.post(`${credentials.server}/api/v1/add-project-scan`, {
                    project_id: credentials.project_id,
                    init,
                    hash,
                }, {
                    auth: {
                        username: credentials.api_key,
                        password: credentials.secret
                    }
                });
                resolve(data.data);
            } else {
                reject('Unable to locate configration file try with codelcok init again');
            }
        } catch (error) {
            reject(error);
        }
    })
};

exports.sendScanedHash = sendScanedHash;
exports.triggerScan = triggerScan;
exports.initProject = initProject;