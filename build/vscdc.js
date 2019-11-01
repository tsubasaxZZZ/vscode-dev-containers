#!/usr/bin/env node
/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const push = require('./src/push').push;
const package = require('./src/package').package;
const createStub = require('./src/stub').createStub;
const packageJson = require('../package.json');

console.log('vscode-dev-containers CLI\nCopyright (c) Microsoft Corporation. All rights reserved.\n')

require('yargs')
    .command('push [devcontainer]', 'push dev container images to a repository', (yargs) => {
        yargs
            .positional('devcontainer', {
                'devcontainer': {
                    describe: 'ID of a specific dev container definition to release',
                    default: null
                }
            })
            .options({
                'release': {
                    describe: 'vscode-dev-containers release tag (e.g. v0.55.1)',
                    default: `v${packageJson.version}`
                },
                'update-latest': {
                    describe: 'whether to update the "latest" and "{MAJOR}" tags with this version',
                    type: 'boolean',
                    default: true
                }
            })
    }, pushCommand)
    .command(['pack', '$0'], 'package dev container definitions', (yargs) => {
        yargs
            .options({
                'release': {
                    describe: 'vscode-dev-containers release tag (e.g. v0.55.1)',
                    default: `v${packageJson.version}`
                },
                'update-latest': {
                    describe: 'whether to update the "latest" and "{MAJOR}" tags with this version',
                    type: 'boolean',
                    default: true
                }
            })
    }, packCommand)
    .command('stub <devcontainer> [path]', 'generates a stub user.Dockerfile', (yargs) => {
        yargs
            .positional('devcontainer', {
                describe: 'ID of dev container definition',
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

function pushCommand(argv) {
    if (argv.release.charAt(0) !== 'v') {
        console.error(`(!) Invalid release identifier ${argv.release}. Valid form: v{MAJOR}.{MINOR}.{FIX}`);
        process.exit(1);
    }
    push(argv.release, argv['update-latest'], argv.devcontainer)
        .catch((reason) => {
            console.error(`(!) Push failed - ${reason}`);
            process.exit(1);
        });
}


function packCommand(argv) {
    if (argv.release.charAt(0) !== 'v') {
        console.error(`(!) Invalid release identifier ${argv.release}. Valid form: v{MAJOR}.{MINOR}.{FIX}`);
        process.exit(1);
    }
    package(argv.release, argv['update-latest'])
        .catch((reason) => {
            console.error(`(!) Packaging failed - ${reason}`);
            process.exit(1);
        });
}


function stubCommand(argv) {
    createStub(argv.devcontainer, argv.path, argv.version, argv.alpine)
        .catch((reason) => {
            console.error(`(!) Stub generation failed - ${reason}`);
            process.exit(1);
        });
}
