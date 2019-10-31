#!/usr/bin/env node
/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const os = require('os');
const path = require('path');
const jsonc = require('jsonc').jsonc;
const asyncFs = require('./asyncFs');
const config = require('./config.json');

const argv = require('yargs')
    .options({
        'tag': {
            alias: 't',
            describe: 'vscode-dev-containers release tag (e.g. v0.55.1)',
            demandOption: true
        },
        'update-latest': {
            describe: 'whether to update the "latest" and "{MAJOR}" tags with this version',
            default: 'true'
        }
    })
    .help()
    .argv;

const updateLatest = argv["update-latest"] === 'true';

const release = argv.tag; 
if(release.charAt(0) !== 'v') {
    console.error(`(!) Invalid release identifier ${release}. Valid form: v{MAJOR}.{MINOR}.{FIX}`);
}
const version = argv.release.replace('v', '');
const versionParts = version.split('.');
if (versionParts.length !== 3) {
    console.error(`(!) Invalid version format in ${release}. Expected: v{MAJOR}.{MINOR}.{FIX}`);    
}

const versionTags = updateLatest ?
    [
        `${versionParts[0]}`,
        `${versionParts[0]}.${versionParts[1]}`,
        version,
        'latest'
    ] :
    [  
        `${versionParts[0]}.${versionParts[1]}`,
        version
    ];

const stubDockerFiles = {};

(async () => {
    try {
        stubDockerFiles.debian = await asyncFs.readFile(path.join(__dirname, 'debian.Dockerfile'));
        stubDockerFiles.alpine = await asyncFs.readFile(path.join(__dirname, 'alpine.Dockerfile'));
        
        const tempBase = path.join(os.tmpdir(), 'vscode-dev-containers', version);
        console.log(`(*) Copying files to ${tempBase}`);
        await asyncFs.rimraf(tempBase); // Clean out folder if it exists
        await asyncFs.mkdirp(tempBase); // Create the folder
        await asyncFs.copyFiles(path.resolve(__dirname, '..'), ['+(containers|repository-containers)/**/!(test-project)/*'], tempBase);
    
        const definitions = getConfig('definitionsToRelease', await async.readdir(tempBase));
    
        definitions.forEach(async (definition) => {
            if (getConfig(definitionsToSkip, []).indexOf(definition) > -1) {
                console.log(`(*) Skipping ${definition}...`);
                return;
            }
            console.log(`\n**** Releasing ${definition} ****`);
            await releaseImage(path.join(tempBase, 'containers'), definition);
        });    
    } catch (err) {
        console.error(`(!) Release failed - ${err}`);
        process.exit(1);
    }  
})();

async function releaseImage(definitionsPath, definition) {
    const devContainerPath = path.join(definitionsPath, definition, '.devcontainer');
    const dockerFilePath = path.join(devContainerPath, 'Dockerfile');
    const baseDockerFilePath = path.join(devContainerPath, 'base.Dockerfile');

    if (await asyncFs.exists(dockerFilePath)) {

        const baseTag = `${getConfig('repository','')}${getConfig(username)}/${definition}:`;
        console.log(`(*) Tags:${versionTags.reduce((prev, current, index, arr) => prev+=`\n     ${baseTag}${current}`, '')}`);

        // Look for context in devcontainer.json and use it to build the Dockerfile
        console.log('(*) Reading devcontainer.json...');
        const devContainerJson = jsonc.readSync(path.join(devContainerPath, 'devcontainer.json'));

        // If base.Dockerfile not found, create it and the template
        if (!await asyncFs.exists(baseDockerFilePath)) {
            console.log(`(*) Generating ${dockerFilePath}...`);
            await asyncFs.rename(dockerFilePath, baseDockerFilePath);
            const templateDockerfile = getConfig('alpineDefinitions',[]).indexOf(definition) > 0 ? stubDockerFiles.alpine : stubDockerFiles.debian;
            const newDockerFile = templateDockerfile.replace('FROM REPLACE-ME',
                `# Dockerfile used to create image can be found in the in the following location:\n# ${getConfig('vscodeDevContainersRepo')}/tree/${release}/containers/${definition}/.devcontainer/Dockerfile\nFROM ${baseTag}${versionTags[0]}.${versionTags[1]}`);
            await asyncFs.writeFile(dockerFilePath, newDockerFile);
        }

        console.log(`(*) Building ${baseDockerFilePath}...`);
        const workingDir = path.resolve(devContainerPath, devContainerJson.context || '.')
        const buildParams = versionTags.reduce((prev, current, index, arr) => prev.concat(['-t', baseTag + current]), []);
        await asyncFs.spawn('docker', ['image', 'build', workingDir, '-f', baseDockerFilePath].concat(buildParams), { stdio: 'inherit', cwd: workingDir, shell: true });

        console.log(`(*) Pushing ${definition}...`);
        versionTags.forEach(async (tag) => {
            await asyncFs.spawn('docker', ['image', 'push',  baseTag + tag], { stdio: 'inherit', cwd: workingDir, shell: true });
        });

        console.log('(*) Done!');
    }
}

function getConfig(property, defaultVal) {
    defaultVal = defaultVal || null;
	// Generate env var name from property - camelCase to CAMEL_CASE
	const envVar = property.split('').reduce((prev, next) => {
		if (next >= 'A' && next <= 'Z') {
			return prev + '_' + next;
		} else {
			return prev + next.toLocaleUpperCase();
		}
	}, '');

	return process.env[envVar] || config[property] || defaultVal;
}
