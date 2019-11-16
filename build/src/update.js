/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const path = require('path');
const utils = require('./utils');

const commonScriptNames = utils.getConfig('commonScriptNames', {});
const commonScriptPath = path.join(__dirname, '..', '..', utils.getConfig('scriptLibraryPathInRepo', 'script-library'));
const commonScriptSHAPromises = {
    alpine: utils.shaForFile(path.join(commonScriptPath, commonScriptNames.alpine)),
    debian: utils.shaForFile(path.join(commonScriptPath, commonScriptNames.debian)),
    readhat: utils.shaForFile(path.join(commonScriptPath, commonScriptNames.redhat))
}

const assetsPath = path.join(__dirname, '..', 'assets');
const stubPromises = {
    alpine: utils.readFile(path.join(assetsPath, 'alpine.Dockerfile')),
    debian: utils.readFile(path.join(assetsPath, 'debian.Dockerfile')),
    redhat: utils.readFile(path.join(assetsPath, 'redhat.Dockerfile'))
}

async function updateDockerFileSetupScript(devContainerDockerfilePath, definitionId, repo, release) {
    const commonScriptName = utils.objectByDefinitionLinuxDistro(definitionId, commonScriptNames);
    const commonScriptSHA = await utils.objectByDefinitionLinuxDistro(definitionId, commonScriptSHAPromises);
    const devContainerDockerfileRaw = await utils.readFile(devContainerDockerfilePath);
    const devContainerDockerfileModified = devContainerDockerfileRaw
        .replace('COMMON_SCRIPT_SHA="none"', `COMMON_SCRIPT_SHA="${commonScriptSHA}"`)
        .replace(/COMMON_SCRIPT_SOURCE=".+"/, `COMMON_SCRIPT_SOURCE="https://raw.githubusercontent.com/${repo}/${release}/${utils.getConfig('scriptLibraryPathInRepo')}/${commonScriptName}"`);
    await utils.writeFile(devContainerDockerfilePath, devContainerDockerfileModified)
}

function getFromSnippet(definitionId, baseTag, repo, release, version, baseDockerFileExists) {
    return `# ${utils.getConfig('dockerFilePreamble')}\n` +
        `# https://github.com/${repo}/tree/${release}/${utils.getConfig('containersPathInRepo')}/${definitionId}/.devcontainer/${baseDockerFileExists ? 'base.' : ''}Dockerfile\n` +
        `FROM ${baseTag}:${version}`;
}

module.exports = {
    createStub: async function(dotDevContainerPath, definitionId, repo, release, baseDockerFileExists, stubRegistry, stubRegistryPath) {
        const userDockerFilePath = path.join(dotDevContainerPath, 'Dockerfile');
        console.log('(*) Generating user Dockerfile...');
        const templateDockerfile = await utils.objectByDefinitionLinuxDistro(definitionId, stubPromises);
        const baseTag = utils.getBaseTag(definitionId, stubRegistry, stubRegistryPath);
        const majorMinor = utils.majorMinorFromRelease(release);
        const userDockerFile = templateDockerfile.replace('FROM REPLACE-ME', getFromSnippet(definitionId, baseTag, repo, release, majorMinor, baseDockerFileExists));
        await utils.writeFile(userDockerFilePath, userDockerFile);
    },

    updateStub: async function(dotDevContainerPath, definitionId, repo, release, baseDockerFileExists, registry, registryUser) {
        console.log('(*) Updating user Dockerfile...');
        const userDockerFilePath = path.join(dotDevContainerPath, 'Dockerfile');
        const userDockerFile = await utils.readFile(userDockerFilePath);

        const baseTag = utils.getBaseTag(definitionId, registry, registryUser);
        const majorMinor = utils.majorMinorFromRelease(release);
        const userDockerFileModified = userDockerFile.replace(new RegExp(`FROM .+:.+`), getFromSnippet(definitionId, baseTag, repo, release, majorMinor, baseDockerFileExists));
        await utils.writeFile(userDockerFilePath, userDockerFileModified);
    },

    updateConfigForRelease: async function (definitionPath, definitionId, repo, release) {
        // Look for context in devcontainer.json and use it to build the Dockerfile
        console.log(`(*) Making version specific updates for for ${definitionId}...`);
        const dotDevContainerPath = path.join(definitionPath, '.devcontainer');
        const devContainerJsonPath = path.join(dotDevContainerPath, 'devcontainer.json');
        const devContainerJsonRaw = await utils.readFile(devContainerJsonPath);
        const devContainerJsonModified =
            `// ${utils.getConfig('devContainerJsonPreamble')}\n// https://raw.githubusercontent.com/${repo}/tree/${release}/${utils.getConfig('containersPathInRepo')}/${definitionId}\n` +
            devContainerJsonRaw;
        await utils.writeFile(devContainerJsonPath, devContainerJsonModified);

        await updateDockerFileSetupScript(path.join(dotDevContainerPath, 'Dockerfile'), definitionId, repo, release);
    },

    updateDockerFileSetupScript: updateDockerFileSetupScript
}


