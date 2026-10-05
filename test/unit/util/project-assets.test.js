import JSZip from '@turbowarp/jszip';
import {
    addAssetsToProjectJSON,
    createProjectBlob,
    getProjectAssets
} from '../../../src/lib/project-assets';

describe('project Assets serialization', () => {
    const assets = [{
        id: 'asset-1',
        name: 'notes.txt',
        type: 'text',
        content: 'Hello'
    }];

    test('stores Assets in the project JSON sent to project storage', async () => {
        const projectJSON = addAssetsToProjectJSON(
            JSON.stringify({targets: []}),
            assets
        );

        await expect(getProjectAssets(projectJSON)).resolves.toEqual(assets);
    });

    test('round-trips Assets through an SB3 archive', async () => {
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify({targets: []}));
        const blob = await createProjectBlob({
            _saveProjectZip: () => zip
        }, assets);

        await expect(getProjectAssets(await blob.arrayBuffer())).resolves.toEqual(assets);
    });
});
