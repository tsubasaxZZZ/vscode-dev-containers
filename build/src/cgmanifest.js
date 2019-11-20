const path = require('path');
const push = require('./push').push;
const utils = require('./utils');
const definitionDependencies = require('../definition-dependencies.json');

// Example manifest: https://dev.azure.com/mseng/AzureDevOps/_git/Governance.Specs?path=%2Fcgmanifest.json&version=GBusers%2Fcajone%2Fcgmanifest.json
// Docker images and native OS libraries need to be registered as "other" while others are scenario dependant

module.exports = {
    generateComponentGovernanceManifest: async (repo, release, registry, registryPath) => {
        console.log('(*) Simulating push process to trigger image builds...');

        // Simulate the build and push process, but don't actually push 
        await push(repo, release, false, registry, registryPath, registry, registryPath, true);

        const alreadyRegistered = {};
        const cgManifest = {
            "Registrations": [],
            "Version": 1
        }

        console.log('(*) Generating manifest...');
        for (let definitionId in definitionDependencies) {
            const dependencies = definitionDependencies[definitionId];
            if (typeof dependencies === 'object') {

                // Add Docker image registration
                const [image, imageVersion] = dependencies.image.split(':');
                if(typeof alreadyRegistered[dependencies.image] === 'undefined') {
                    cgManifest.Registrations.push({
                        "Component": {
                            "Type": "other",
                            "Other": {
                                "Name": `Docker Image: ${image}`,
                                "Version": imageVersion,
                                "DownloadUrl": dependencies.imageLink
                            }
                        }
                    });
                    alreadyRegistered[dependencies.image] = [imageVersion];
                }

                // Docker image to use to determine installed package versions
                const imageTag = utils.getTagsForVersion(definitionId, 'dev', registry, registryPath)[0]                
                console.log(`(*) Generating Linux distribution package registrations for ${imageTag}...`);

                // Run commands in the package to pull out needed versions - Debian
                if(dependencies.debian) {
                    // dpkg-query --show -f='${Package}\t${Version}\n' <package>
                    // Output: <package>    <version>
                    cgManifest.Registrations = cgManifest.Registrations.concat(await generatePackageComponentList(
                        dependencies.debian.packages,
                        imageTag,
                        alreadyRegistered,
                        "dpkg-query --show -f='${Package}\t${Version}\n'",
                        /(.+)\t(.+)/,
                        'Debian Package:',
                        `(${dependencies.debian.version})`,
                        `https://packages.debian.org/${dependencies.debian.version}`));
                }

                // Run commands in the package to pull out needed versions - Ubuntu
                if(dependencies.ubuntu) {
                    // dpkg-query --show -f='${Package}\t${Version}\n' <package>
                    // Output: <package>    <version>
                    cgManifest.Registrations = cgManifest.Registrations.concat(await generatePackageComponentList(
                        dependencies.ubuntu.packages,
                        imageTag,
                        alreadyRegistered,
                        "dpkg-query --show -f='${Package}\t${Version}\n'",
                        /(.+)\t(.+)/,
                        'Ubuntu Package:',
                        `(${dependencies.ubuntu.version})`,
                        `https://packages.ubuntu.com/${dependencies.ubuntu.version}`));
                }

                // Run commands in the package to pull out needed versions - Alpine
                if(dependencies.alpine) {
                    // apk info -e -v <package>
                    // Output: <package>-<version-with-dashes>
                    cgManifest.Registrations = cgManifest.Registrations.concat(await generatePackageComponentList(
                        dependencies.alpine.packages,
                        imageTag,
                        alreadyRegistered,
                        "apk info -e -v",
                        /([^-]+)-(.+)/,
                        `(${dependencies.alpine.version})`,
                        'Alpine Package:',
                        `https://pkgs.alpinelinux.org/package/v${dependencies.alpine.version}/main/x86_64`));
                }
            }

            // Add manual registrations
            if(dependencies.manual) {
                cgManifest.Registrations = cgManifest.Registrations.concat(
                    filteredManualComponentRegistrations(dependencies.manual, alreadyRegistered));
            }
            
        }
        console.log('(*) Writing manifest...');        
        await utils.writeFile(
            path.join(__dirname, '..', '..', 'cgmanifest.json'), 
            JSON.stringify(cgManifest, undefined, 4))
        console.log('(*) Done!');        
    }
}

async function generatePackageComponentList(packageList, imageTag, alreadyRegistered, listCommand, parseRegEx, namePrefix, versionSuffix, packageUrlString) {
    const componentList = [];
    const packageVersionListCommand = packageList.reduce((prev, current) => {
        return prev += ` ${current}`;
    }, listCommand);
    const packageVersionListRaw = await utils.spawn('docker', ['run', '--rm', imageTag, packageVersionListCommand], { shell:true, stdio: 'pipe' });
    const packageVersionList = packageVersionListRaw.split('\n');
    packageVersionList.forEach((packageVersion) => {
        packageVersion = packageVersion.trim();
        if(packageVersion !== '') {
            const versionCaptureGroup = parseRegEx.exec(packageVersion);
            const package = versionCaptureGroup[1];
            const version = versionCaptureGroup[2];
            const uniquePackageName = `${namePrefix} ${package}`;
            if(typeof alreadyRegistered[uniquePackageName] === 'undefined' || alreadyRegistered[uniquePackageName].indexOf(version) < 0) {
                componentList.push({
                    "Component": {
                        "Type": "other",
                        "Other": {
                            "Name": uniquePackageName,
                            "Version": `${version} ${versionSuffix}`,
                            "DownloadUrl": `${packageUrlString}/${package}`
                        }
                    }
                });
                alreadyRegistered[uniquePackageName] = alreadyRegistered[uniquePackageName] || [];    
                alreadyRegistered[uniquePackageName].push(version);
            }
        }
    });

    return componentList;
}

function filteredManualComponentRegistrations(manualRegistrations, alreadyRegistered) {
    const componentList = [];
    manualRegistrations.forEach((component) => {
        const key = JSON.stringify(component);
        if(typeof alreadyRegistered[key] === 'undefined') {
            componentList.push(component);
            alreadyRegistered[key] = [key];
        }
    });
    return componentList;
}