/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const os = require('os');
const path = require('path');
const jsonc = require('jsonc').jsonc;
const utils = require('./utils');
const stub = require('./stub');

async function push(release, updateLatest, definitionId) {

    const version = release.charAt(0) === 'v' ? release.substr(1) : release;
    const stagingFolder = path.join(os.tmpdir(), 'vscode-dev-containers', version);
    console.log(`(*) Copying files to ${stagingFolder}`);
    await utils.rimraf(stagingFolder); // Clean out folder if it exists
    await utils.mkdirp(stagingFolder); // Create the folder
    await utils.copyFiles(
        path.resolve(__dirname, '..', '..'),
        utils.getConfig('filesToStage'),
        stagingFolder);

    const definitionStagingFolder = path.join(stagingFolder, 'containers');
    const definitions = definitionId ? [definitionId] : utils.getConfig('definitionsToPush', await utils.readdir(definitionStagingFolder));

    for (let i = 0; i < definitions.length; i++) {
        const definitionId = definitions[i];
        if (utils.getConfig('definitionsToSkip', []).indexOf(definitionId) > -1) {
            console.log(`(*) Skipping ${definitionId}...`);
            return;
        }
        console.log(`\n**** Pushing ${definitionId} ${release} ****`);
        await pushImage(path.join(definitionStagingFolder, definitionId), definitionId, release, updateLatest);
    }

    return stagingFolder;
}

async function pushImage(definitionPath, definitionId, release, updateLatest) {
    const dotDevContainerPath = path.join(definitionPath, '.devcontainer');
    const dockerFilePath = path.join(dotDevContainerPath, 'Dockerfile');

    // Make sure there's a Dockerfile present
    if (!await utils.exists(dockerFilePath)) {
        throw `Invalid path ${dockerFilePath}`;
    }

    // Determine tags to use
    const version = release.charAt(0) === 'v' ? release.substr(1) : release;
    const versionTags = utils.getTagList(definitionId, version, updateLatest)
    console.log(`(*) Tags:${versionTags.reduce((prev, current) => prev += `\n     ${current}`, '')}`);

    // Look for context in devcontainer.json and use it to build the Dockerfile
    console.log('(*) Reading devcontainer.json...');
    const devContainerJsonPath = path.join(dotDevContainerPath, 'devcontainer.json');
    const devContainerJsonRaw = await utils.readFile(devContainerJsonPath);
    const devContainerJson = jsonc.parse(devContainerJsonRaw);

    // Add a header to the Dockerfile with a pointer to the image
    console.log('(*) Adding header to Dockerfile...');
    const dockerFileModified =
        `# This file was used to generate ${utils.getBaseTag(definitionId)}:${version}\n`
        + await utils.readFile(dockerFilePath);
    await utils.writeFile(dockerFilePath, dockerFileModified);

    // Build
    console.log(`(*) Building image...`);
    const workingDir = path.resolve(dotDevContainerPath, devContainerJson.context || '.')
    const buildParams = versionTags.reduce((prev, current) => prev.concat(['-t', current]), []);
    const spawnOpts = { stdio: 'inherit', cwd: workingDir, shell: true };
    await utils.spawn('docker', ['build', workingDir, '-f', dockerFilePath].concat(buildParams), spawnOpts);

    // Push
    console.log(`(*) Pushing ${definitionId}...`);
    for (let i = 0; i < versionTags.length; i++) {
        await utils.spawn('docker', ['push', versionTags[i]], spawnOpts);
    }

    // If user.Dockerfile not found, create it, otherwise update the version
    if (!await utils.exists(path.join(dotDevContainerPath, 'user.Dockerfile'))) {
        await stub.createStub(dotDevContainerPath, definitionId, version);
    } else {
        await stub.updateStub(dotDevContainerPath, definitionId, version);
    }    

    // Change devcontainer.json to user.Dockerfile, add header
    console.log('(*) Updating devcontainer.json...');
    const devContainerJsonModified =
        `// ${utils.getConfig('devContainerJsonPreamble')}\n// ${utils.getConfig('vscodeDevContainersRepo')}/tree/${release}/containers/${definitionId}\n`
        + devContainerJsonRaw.replace('"Dockerfile"', '"user.Dockerfile"');
    await utils.writeFile(devContainerJsonPath, devContainerJsonModified);

    console.log('(*) Done!');
}

module.exports = {
    push: push
}
