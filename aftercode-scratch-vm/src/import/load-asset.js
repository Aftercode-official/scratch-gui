const StringUtil = require('../util/string-util');
const log = require('../util/log');

const loadAsset = function (asset, runtime) {
    if (!runtime.storage) {
        log.warn('No storage module present; cannot load asset asset: ', asset.md5);
        return Promise.resolve(asset);
    }
    const idParts = StringUtil.splitFirst(asset.md5, '.');
    const md5 = idParts[0];
    const ext = idParts[1].toLowerCase();
    asset.dataFormat = ext;
    return (
        (asset.asset && Promise.resolve(asset.asset)) ||
        runtime.storage.load(runtime.storage.AssetType.Asset, md5, ext)
    )
        .then(createdAsset => {
            asset.asset = createdAsset;

            if (!createdAsset) {
                log.warn('Failed to find asset data: ', asset.md5);
                return null;
            }

            return asset;
        })
        .catch(e => {
            log.warn(`Failed to load asset: ${asset.md5} with error: ${e}`);
            return null;
        });
};

module.exports = {
    loadAsset
};
