/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const path = require('path');
const push = require('./push').push;
const utils = require('./utils');

 async function package(release, updateLatest) {
    // First, push images, update content
    const stagingFolder = await push(release, updateLatest);
 
    // Then package
    console.log(`\n(*) **** Package ${release} in ${stagingFolder} ****`);
    const opts = { stdio: 'inherit', cwd: stagingFolder, shell: true };
    console.log('(*) Packaging...');
    await utils.spawn('yarn', ['install'], opts);
    await utils.spawn('npm', ['pack'], opts);
    console.log('(*) Copying package...');
    await utils.copyFiles(stagingFolder, ['*.tgz'], path.join(__dirname, '..', '..'));

    // And finally clean up
    console.log('(*) Cleaning up...');
    await utils.rimraf(stagingFolder);

    console.log('(*) Done!!');
}

module.exports = {
    package: package
}