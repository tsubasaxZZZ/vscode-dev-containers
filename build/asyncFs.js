/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const fs = require('fs');
const rimrafCb = require('rimraf');
const mkdirpCb = require('mkdirp');
const copyFilesCb = require('copyfiles');
const spawnCb = require('child_process').spawn;

/** Async file, spawn, and cp functions **/

module.exports = {
    spawn: async function (command, args, opts) {
        opts = opts || { stdio: 'inherit', shell: true };
        return new Promise((resolve, reject) => {
            const proc = spawnCb(command, args, opts);
            proc.on('close', (code, signal) => {
                if (code !== 0) {
                    reject(`Non-zero exit code: ${code} ${signal || ''}`);
                    return;
                }
                resolve();
            });
            proc.on('error', (err) => {
                reject(err)
            });
        });
    },
    rename: async function (from, to) {
        return new Promise((resolve, reject) => {
            fs.rename(from, to, (err) => err ? reject(err) : resolve());
        });
    },
    readFile: async function (filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => err ? reject(err) : resolve(data.toString()));
        });
    },
    writeFile: async function (filePath, data) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, data, 'utf8', (err) => err ? reject(err) : resolve(filePath));
        });
    },
    mkdirp: async function (pathToMake) {
        return new Promise((resolve, reject) => {
            mkdirpCb(pathToMake, (err, made) => err ? reject(err) : resolve(made));
        });
    },
    rimraf: async function (pathToRemove, opts) {
        opts = opts || {};
        return new Promise((resolve, reject) => {
            rimrafCb(pathToRemove, opts, (err) => err ? reject(err) : resolve(pathToRemove));
        });
    },
    copyFiles: async function (source, blobs, target) {
        return new Promise((resolve, reject) => {
            process.chdir(source);
            copyFilesCb(
                blobs.concat(target),
                { all: true },
                (err) => err ? reject(err) : resolve(target));
        });
    },
    readdir: async function (dirPath, opts) {
        opts = opts || {};
        return new Promise((resolve, reject) => {
            fs.readdir(dirPath, opts, (err, files) => err ? reject(err) : resolve(files));
        });
    },
    exists: async function (filePath) {
        return fs.existsSync(filePath)        
    }
 }
