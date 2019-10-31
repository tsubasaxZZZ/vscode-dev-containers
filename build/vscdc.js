#!/usr/bin/env node
/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const release = require('./src/release').release;
const createStub = require('./src/stub').createStub;

require('yargs')
    .command(['release <release> [devcontainer]', '$0 <release> [devcontainer]'], 'release dev container definitions', (yargs) => {
        yargs.positional('release', {
            describe: 'vscode-dev-containers release tag (e.g. v0.55.1)',
        })
        .positional('devcontainer', {
            'devcontainer': {
                describe: 'ID of a specific dev container definition to release',
                default: null
            }
        })
        .options({
            'update-latest': {
                describe: 'whether to update the "latest" and "{MAJOR}" tags with this version',
                type: 'boolean',
                default: true
            }
        }) 
    }, releaseCommand)
    .command('stub <devcontainer> [path]', 'generates a stub user.Dockerfile', (yargs) => {
        yargs.positional('devcontainer', {
            describe: 'ID of dev container defintion',
        })
        .positional('path', {
            describe: 'path to .devcontainer folder',
            default: '.'  
        })
        .options({
            'version': {
                describe: 'version to use in the stub',
                default: 'latest'
            },
            'alpine': {
                describe: 'add an alpine container',
                type: 'boolean',
                default: false
            }
        })    
    }, stubCommand)
    .help()
    .argv;

function releaseCommand(argv) {
    const releaseTag = argv.release; 
    if(releaseTag.charAt(0) !== 'v') {
        console.error(`(!) Invalid release identifier ${releaseTag}. Valid form: v{MAJOR}.{MINOR}.{FIX}`);
        process.exit(1);
    }
    release(releaseTag, argv['update-latest'], argv.devcontainer)
        .catch((reason) => {
            console.error(`(!) Command failed - ${reason}`);
            process.exit(1);
        });
}

function stubCommand(argv) {
    createStub(argv.devcontainer, argv.path, argv.version, argv.alpine)
        .catch((reason) => {
            console.error(`(!) Command failed - ${reason}`);
            process.exit(1);
        });
}
