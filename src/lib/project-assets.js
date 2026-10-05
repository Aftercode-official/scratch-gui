import JSZip from '@turbowarp/jszip';

const PROJECT_ASSETS_KEY = 'aftercodeAssets';

const getProjectJSON = async projectData => {
    if (typeof projectData === 'string') {
        return JSON.parse(projectData);
    }
    if (projectData instanceof ArrayBuffer || ArrayBuffer.isView(projectData)) {
        const zip = await JSZip.loadAsync(projectData);
        const projectFile = zip.file('project.json');
        if (!projectFile) {
            throw new Error('Project archive does not contain project.json');
        }
        return JSON.parse(await projectFile.async('string'));
    }
    return projectData;
};

const getProjectAssets = async projectData => {
    const projectJSON = await getProjectJSON(projectData);
    if (!projectJSON || !Array.isArray(projectJSON[PROJECT_ASSETS_KEY])) {
        return [];
    }
    const assets = projectJSON[PROJECT_ASSETS_KEY];
    const validAssets = assets.every(asset => (
        asset &&
        typeof asset.id === 'string' &&
        typeof asset.name === 'string' &&
        typeof asset.content === 'string' &&
        (asset.type === 'image' || asset.type === 'text')
    ));
    if (!validAssets) {
        throw new Error('Project contains invalid Assets data');
    }
    return assets;
};

const addAssetsToProjectJSON = (projectJSON, assets) => {
    const parsedProject = typeof projectJSON === 'string' ? JSON.parse(projectJSON) : projectJSON;
    return JSON.stringify(Object.assign({}, parsedProject, {
        [PROJECT_ASSETS_KEY]: assets || []
    }));
};

const replaceProjectJSON = (zip, projectJSON) => {
    zip.file('project.json', projectJSON, {
        date: new Date(1591657163000),
        compression: 'DEFLATE'
    });
};

const createProjectBlob = async (vm, assets) => {
    const zip = vm._saveProjectZip();
    const projectFile = zip.file('project.json');
    if (!projectFile) {
        throw new Error('Project archive does not contain project.json');
    }
    replaceProjectJSON(
        zip,
        addAssetsToProjectJSON(await projectFile.async('string'), assets)
    );
    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/x.scratch.sb3'
    });
};

const createProjectStream = (vm, assets) => {
    const zip = vm._saveProjectZip();
    const projectFile = zip.file('project.json');
    if (!projectFile) {
        throw new Error('Project archive does not contain project.json');
    }
    return projectFile.async('string').then(projectJSON => {
        replaceProjectJSON(zip, addAssetsToProjectJSON(projectJSON, assets));
        return zip.generateInternalStream({
            type: 'arraybuffer',
            mimeType: 'application/x.scratch.sb3'
        });
    });
};

export {
    addAssetsToProjectJSON,
    createProjectBlob,
    createProjectStream,
    getProjectAssets
};
