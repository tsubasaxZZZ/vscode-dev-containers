/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const path = require('path');
const utils = require('./utils');

const  alpineStubPromise = utils.readFile(path.join(__dirname, '..', 'assets', 'debian.Dockerfile'));
const  debianStubPromise = utils.readFile(path.join(__dirname, '..', 'assets', 'alpine.Dockerfile'));

module.exports = {
    createStub: async function(dotDevContainerPath, definitionId, release, baseDockerFileExists, isAlpine) {
        const version = (release === 'master' ? 
                'latest' :
                (release.charAt(0) === 'v' ? release.substr(1) : release));
        isAlpine = isAlpine || (utils.getConfig('alpineDefinitions',[]).indexOf(definitionId) > 0); 
        
        const userDockerFilePath = path.join(dotDevContainerPath, 'Dockerfile');
        console.log('(*) Generating user Dockerfile...');
        const templateDockerfile = isAlpine ? await alpineStubPromise : await debianStubPromise;
        const baseTag = utils.getBaseTag(definitionId);
        const userDockerFile = templateDockerfile.replace('FROM REPLACE-ME', getFromSnippet(definitionId, baseTag, release, version, baseDockerFileExists));
        await utils.writeFile(userDockerFilePath, userDockerFile);
    },

    updateStub: async function(dotDevContainerPath, definitionId, release, baseDockerFileExists) {
        const version = (release === 'master' ? 
                'latest' :
                (release.charAt(0) === 'v' ? release.substr(1) : release));
        console.log('(*) Updating user Dockerfile...');
        const userDockerFilePath = path.join(dotDevContainerPath, 'Dockerfile');
        const userDockerFile = await utils.readFile(userDockerFilePath);

        const baseTag = utils.getBaseTag(definitionId);
        const userDockerFileModified = userDockerFile.replace(new RegExp(`FROM ${baseTag}:.+`), getFromSnippet(definitionId, baseTag, release, version, baseDockerFileExists));
        await utils.writeFile(userDockerFilePath, userDockerFileModified);
    }
};

function getFromSnippet(definitionId, baseTag, release, version, baseDockerFileExists) {
    return `# ${utils.getConfig('dockerFilePreamble')}\n` +
        `# ${utils.getConfig('vscodeDevContainersRepo')}/tree/${release}/${utils.getConfig('containersPathInRepo')}/${definitionId}/.devcontainer/${baseDockerFileExists ? 'base.' : ''}Dockerfile\n` +
        `FROM ${baseTag}:${version}`;
}
