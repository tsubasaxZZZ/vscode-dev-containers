/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

const config = require('../../config.json');

// Get a value from the config file or a similarly named env var
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


// Convert a release string (v1.0.0) or branch (master) into a version
function getVersionFromRelease(release) {
    // Already is a version
    if (!isNaN(parseInt(release.charAt(0)))) {
        return release;
    }

    // Is a release string
    if (release.charAt(0) === 'v' && !isNaN(parseInt(release.charAt(1)))) {
        return release.substr(1);
    }

    // Is a branch
    return 'dev';
}

// Look up distro and fallback to debian if not specified
function getLinuxDistroForDefinition(definitionId) {
    return config.definitionBuildSettings[definitionId].rootDistro || 'debian';
}

// Generate 'latest' flavor of a given definition's tag
function getLatestTag(definitionId, registry, registryPath) {
    if (typeof config.definitionBuildSettings[definitionId] === 'undefined') {
        return null;
    }
    return config.definitionBuildSettings[definitionId].tags.reduce((list, tag) => {
        list.push(`${registry}/${registryPath}/${tag.replace(/:.+/, ':latest')}`);
        return list;
    }, []);

}

// Create all the needed variants of the specified version identifier for a given definition
function getTagsForVersion(definitionId, version, registry, registryPath) {
    if (typeof config.definitionBuildSettings[definitionId] === 'undefined') {
        return null;
    }
    return config.definitionBuildSettings[definitionId].tags.reduce((list, tag) => {
        // One of the tags that needs to be supported is one where there is no version, but there
        // are other attributes. For example, python:3 in addition to python:0.35.0-3. So, a version
        // of '' is allowed. However, there are also instances that are just the version, so in 
        // these cases latest would be used instead. However, latest is passed in separately.
        const baseTag = tag.replace('${VERSION}', version).replace(':-', ':');
        if (baseTag.charAt(baseTag.length - 1) !== ':') {
            list.push(`${registry}/${registryPath}/${baseTag}`);
        }
        return list;
    }, []);
}

module.exports = {

    // Generate complete list of tags for a given definition
    getTagList: (definitionId, release, updateLatest, registry, registryPath) => {
        const version = getVersionFromRelease(release);
        if (version === 'dev') {
            return getTagsForVersion(definitionId, 'dev', registry, registryPath);
        }

        const versionParts = version.split('.');
        if (versionParts.length !== 3) {
            throw (`Invalid version format in ${version}.`);
        }

        const versionList = updateLatest ? [
            version,
            `${versionParts[0]}.${versionParts[1]}`,
            `${versionParts[0]}`,
            '' // This is the equivalent of latest for qualified tags- e.g. python:3 instead of python:0.35.0-3
        ] : [
                version,
                `${versionParts[0]}.${versionParts[1]}`
            ];

        // If this variant should actually be the latest tag, use it
        let tagList = (updateLatest && config.definitionBuildSettings[definitionId].latest) ? getLatestTag(definitionId, registry, registryPath) : [];
        versionList.forEach((tagVersion) => {
            tagList = tagList.concat(getTagsForVersion(definitionId, tagVersion, registry, registryPath));
        });

        return tagList;
    },

    // Walk the image build config and sort list so parents build before children
    getSortedDefinitionBuildList: () => {
        const sortedList = [];
        const settingsCopy = JSON.parse(JSON.stringify(config.definitionBuildSettings));

        for (let definitionId in config.definitionBuildSettings) {
            const add = (defId) => {
                if (typeof settingsCopy[defId] === 'object') {
                    add(settingsCopy[defId].parent);
                    sortedList.push(defId);
                    settingsCopy[defId] = undefined;
                }
            }
            add(definitionId);
        }

        return sortedList;
    },

    // Get parent tag for a given child definition
    getParentTagForVersion: (definitionId, version, registry, registryPath) => {
        const parentId = config.definitionBuildSettings[definitionId].parent;
        return parentId ? getTagsForVersion(parentId, version, registry, registryPath)[0] : null;
    },

    // Return just the manor and minor version of a release number
    majorMinorFromRelease: (release) => {
        const version = getVersionFromRelease(release);

        if (version === 'dev') {
            return 'dev';
        }

        const versionParts = version.split('.');
        return `${versionParts[0]}.${versionParts[1]}`;
    },

    // Return an object from a map based on the linux distro for the definition
    objectByDefinitionLinuxDistro: (definitionId, objectsByDistro) => {
        const distro = getLinuxDistroForDefinition(definitionId);
        const obj = objectsByDistro[distro];
        return obj;
    },

    getLinuxDistroForDefinition: getLinuxDistroForDefinition,

    getVersionFromRelease: getVersionFromRelease,

    getTagsForVersion: getTagsForVersion,

    getConfig: getConfig
};
