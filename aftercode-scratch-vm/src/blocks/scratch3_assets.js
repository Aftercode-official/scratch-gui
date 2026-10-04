const Cast = require('../util/cast');
const MathUtil = require('../util/math-util');

class Scratch3AssetBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            assets_menu: this.assetsMenu,
            assets_file_as_type: this.fileAsType,
            assets_all: this.all,
            assets_metadata: this.metadata,
            assets_set: this.set,
            assets_write: this.write
        };
    }

    assetsMenu (args) {
        return args.ASSET_MENU;
    }

    all (args, util) {
        let target;
        if (args.SPRITE === '_myself_') {
            target = util.target;
        } else if (args.SPRITE === 'Stage') {
            target = this.runtime.getTargetForStage();
        } else {
            target = this.runtime.getSpriteTargetByName(args.SPRITE);
        }

        if (!target) return [];

        return target.sprite?.assets ? target.sprite.assets.map(a => a.name) : [];
    }

    fileAsType (args, util) {
        const index = this._getAssetIndex(args.ASSET_MENU, util);
        if (index < 0) {
            return '';
        }
        const asset = util.target.sprite.assets[index];
        if (args.TYPE === 'data: uri') {
            return asset.asset.encodeDataURI();
        } else if (args.TYPE === 'text') {
            return new TextDecoder().decode(asset.asset.data);
        }
        return '';

    }

    metadata (args, util) {
        const index = this._getAssetIndex(args.ASSET_MENU, util);
        if (index < 0) {
            return '';
        }
        const asset = util.target.sprite.assets[index];
        switch (args.TYPE) {
        case 'name': return asset.name;
        case 'extension': return asset.dataFormat;
        case 'content type': return asset.contentType;
        case 'last modified': return new Date(asset.lastModified).toLocaleDateString();
        case 'md5': return asset.assetId;
        default: return '';
        }
    }

    set (args, util) {
        const index = this._getAssetIndex(args.ASSET_MENU, util);
        if (index < 0) {
            return '';
        }
        const value = Cast.toString(args.VALUE).trim();
        const asset = util.target.sprite.assets[index];
        switch (args.TYPE) {
        case 'name': util.target.renameAsset(index, value, asset.dataFormat); break;
        case 'extension': util.target.renameAsset(index, asset.name, value || 'file'); break;
        case 'content type': asset.contentType = value; break;
        }
    }

    write (args, util) {
        const index = this._getAssetIndex(args.ASSET_MENU, util);
        if (index < 0) {
            return '';
        }
        const value = Cast.toString(args.VALUE);
        const assetObject = util.target.sprite.assets[index];
        const asset = assetObject.asset;
        if (args.TYPE === 'data: uri') {
            const base64 = value.split(',')[1];
            try {
                const arr = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                asset.setData(arr, assetObject.dataFormat, true);
            } catch { /* empty */ }
        } else {
            asset.encodeTextData(value, assetObject.dataFormat, true);
        }
        assetObject.md5 = `${asset.assetId}.${assetObject.dataFormat}`;
        assetObject.assetId = asset.assetId;
    }

    _getAssetIndex (assetName, util) {
        const assets = util.target.sprite.assets;
        if (assets.length === 0) {
            return -1;
        }

        const index = this.getAssetIndexByName(Cast.toString(assetName), util);
        if (index !== -1) {
            return index;
        }

        const oneIndexedIndex = parseInt(assetName, 10);
        if (!isNaN(oneIndexedIndex)) {
            return MathUtil.wrapClamp(oneIndexedIndex - 1, 0, assets.length - 1);
        }

        return -1;
    }

    getAssetIndexByName (assetName, util) {
        const assets = util.target.sprite.assets;
        for (let i = 0; i < assets.length; i++) {
            if (assets[i].name === assetName) {
                return i;
            }
        }
        for (let i = 0; i < assets.length; i++) {
            if (`${assets[i].name}.${assets[i].dataFormat}` === assetName) {
                return i;
            }
        }
        return -1;
    }
}

module.exports = Scratch3AssetBlocks;
