/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const path = require('path');
const push = require('./push').push;
const utils = require('./utils');

 async function package(release, updateLatest, registry, registryUser) {

    // First, push images, update content
    const stagingFolder = await push(release, updateLatest, registry, registryUser);
 
    // Then package
    console.log(`\n(*) **** Package ${release} ****`);

    console.log(`(*) Updating package.json with release version...`);
    const version = release.charAt(0) === 'v' ? release.substr(1) : release;
    const packageJsonPath = path.join(stagingFolder, 'package.json');
    const packageJsonRaw = await utils.readFile(packageJsonPath);
    const packageJsonModified = packageJsonRaw.replace(/"version".?:.?".+"/, `"version": "${version}"`);
    await utils.writeFile(packageJsonPath, packageJsonModified);

    console.log('(*) Packaging...');
    const opts = { stdio: 'inherit', cwd: stagingFolder, shell: true };
    await utils.spawn('yarn', ['install'], opts);
    await utils.spawn('yarn', ['pack'], opts);
    
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