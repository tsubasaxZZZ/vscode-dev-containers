/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const os = require('os');
const path = require('path');
const jsonc = require('jsonc').jsonc;
const utils = require('./utils');
const stub = require('./stub');

async function release(release, updateLatest, definitionId) {

    const tempBase = path.join(os.tmpdir(), 'vscode-dev-containers', release);
    console.log(`(*) Copying files to ${tempBase}`);
    await utils.rimraf(tempBase); // Clean out folder if it exists
    await utils.mkdirp(tempBase); // Create the folder
    await utils.copyFiles(path.resolve(__dirname, '..', '..'), ['+(containers|repository-containers)/**/!(test-project)/*'], tempBase);

    const tempDefinitionsBase = path.join(tempBase, 'containers');
    const definitions = definitionId ? [definitionId] : utils.getConfig('definitionsToRelease', await utils.readdir(tempDefinitionsBase));

    for (let i = 0; i < definitions.length; i++) {
        const definitionId = definitions[i];
        if (utils.getConfig('definitionsToSkip', []).indexOf(definitionId) > -1) {
            console.log(`(*) Skipping ${definitionId}...`);
            return;
        }
        console.log(`\n**** Releasing ${definitionId} ****`);
        await releaseImage(path.join(tempDefinitionsBase, definitionId), definitionId, release, updateLatest);
    }
}

async function releaseImage(definitionPath, definitionId, release, updateLatest) {
    const dotDevContainerPath = path.join(definitionPath, '.devcontainer');
    const dockerFilePath = path.join(dotDevContainerPath, 'Dockerfile');
    const userDockerFilePath = path.join(dotDevContainerPath, 'user.Dockerfile');

    if (!await utils.exists(dockerFilePath)) {
        throw `Invalid path ${dockerFilePath}`;
    }

    const version = release.charAt(0) === 'v' ? release.substr(1) : release;
    const versionTags = utils.getTagList(definitionId, version, updateLatest)
    console.log(`(*) Tags:${versionTags.reduce((prev, current) => prev += `\n     ${current}`, '')}`);

    // If user.Dockerfile not found, create it
    if (!await utils.exists(userDockerFilePath)) {
        await stub.createStub(dotDevContainerPath, definitionId, version);
    } else {
        await stub.updateStub(devContainerJsonPath, definitionId, version);
    }

    // Look for context in devcontainer.json and use it to build the Dockerfile
    console.log('(*) Reading devcontainer.json...');
    const devContainerJsonPath = path.join(dotDevContainerPath, 'devcontainer.json');
    const devContainerJsonRaw = await utils.readFile(devContainerJsonPath);
    const devContainerJson = jsonc.parse(devContainerJsonRaw);

    console.log(`(*) Building ${dockerFilePath}...`);
    const workingDir = path.resolve(dotDevContainerPath, devContainerJson.context || '.')
    const buildParams = versionTags.reduce((prev, current) => prev.concat(['-t', current]), []);
    await utils.spawn('docker', ['build', workingDir, '-f', dockerFilePath].concat(buildParams), { stdio: 'inherit', cwd: workingDir, shell: true });

    console.log(`(*) Pushing ${definitionId}...`);
    for (let i = 0; i < versionTags.length; i++) {
        await utils.spawn('docker', ['push', versionTags[i]], { stdio: 'inherit', cwd: workingDir, shell: true });
    }

    console.log('(*) Writing devcontainer.json...');
    const devContainerJsonModified = 
        `// ${utils.getConfig('devContainerJsonPreamble')}\n// ${utils.getConfig('vscodeDevContainersRepo')}/tree/${release}/containers/${definitionId}\n`
        + devContainerJsonRaw.replace('"Dockerfile"', '"user.Dockerfile"');
    await utils.writeFile(devContainerJsonPath, devContainerJsonModified);

    console.log('(*) Done!');
}
        
module.exports = {
    release: release
}
