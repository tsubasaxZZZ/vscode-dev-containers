/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const path = require('path');
const utils = require('./utils');

const  alpineStubPromise = utils.readFile(path.join(__dirname, '..', 'assets', 'debian.Dockerfile'));
const  debianStubPromise = utils.readFile(path.join(__dirname, '..', 'assets', 'alpine.Dockerfile'));

module.exports = {
    createStub: async function(dotDevContainerPath, definitionId, version, isAlpine) {
        isAlpine = isAlpine || (utils.getConfig('alpineDefinitions',[]).indexOf(definitionId) > 0); 
        version = version || 'latest';
        
        const userDockerFilePath = path.join(dotDevContainerPath, 'user.Dockerfile');
        console.log('(*) Generating user.Dockerfile...');
        const templateDockerfile = isAlpine ? await alpineStubPromise : await debianStubPromise;
        const baseTag = utils.getBaseTag(definitionId);
        const userDockerFile = templateDockerfile.replace('FROM REPLACE-ME',
            `# See Dockerfile for information on the contents of this image:\nFROM ${baseTag}:${version}`);
        await utils.writeFile(userDockerFilePath, userDockerFile);
    },

    updateStub: async function(dotDevContainerPath, definitionId, version) {
        console.log('(*) Updating user.Dockerfile...');
        const userDockerFilePath = path.join(dotDevContainerPath, 'user.Dockerfile');
        const userDockerFile = await utils.readFile(userDockerFilePath);

        const baseTag = utils.getBaseTag(definitionId);
        const userDockerFileModified = userDockerFile.replace(new RegExp(`${baseTag}:.+`),`${baseTag}:${version}`);
        await utils.writeFile(userDockerFilePath, userDockerFileModified);
    }
};
