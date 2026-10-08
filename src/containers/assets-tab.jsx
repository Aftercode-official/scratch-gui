import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import AssetsTabComponent from '../components/assets-tab/assets-tab.jsx';
import {setProjectAssets} from '../reducers/project-assets';
import {setProjectChanged} from '../reducers/project-changed';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const AssetsTab = props => {
    const {assets, onChangeAssets} = props;

    const addText = () => {
        const highestNumber = assets.reduce((highest, asset) => {
            const match = /^Untitled(\d*)\.txt$/i.exec(asset.name);
            if (!match) return highest;
            return Math.max(highest, match[1] ? Number(match[1]) : 0);
        }, 0);
        const name = `Untitled${highestNumber + 1}.txt`;
        const asset = {
            id: createId(),
            name,
            type: 'text',
            content: '',
            scopeId: props.editingTarget,
            lastModified: Date.now()
        };
        onChangeAssets(assets.concat(asset));
        return asset;
    };

    const importFile = file => new Promise((resolve, reject) => {
        const extensionMatch = /\.([^.]+)$/.exec(file.name);
        const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';
        const isImage = (file.type && file.type.startsWith('image/')) ||
            /^(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/.test(extension);
        const type = isImage ? 'image' : 'text';
        const name = type === 'text' && !/\.txt$/i.test(file.name) ?
            `${file.name}.txt` : file.name;

        const reader = new FileReader();
        reader.onerror = () => {
            reject(new Error(`Could not read ${file.name}.`));
        };
        reader.onload = () => {
            const asset = {
                id: createId(),
                name,
                type,
                content: reader.result,
                scopeId: props.editingTarget,
                lastModified: Date.now()
            };
            onChangeAssets(assets.concat(asset));
            resolve(asset);
        };
        if (type === 'image') {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });

    const updateAsset = (id, changes) => {
        onChangeAssets(assets.map(asset => (
            asset.id === id ? Object.assign({}, asset, changes) : asset
        )));
    };

    const deleteAsset = id => {
        onChangeAssets(assets.filter(asset => asset.id !== id));
    };

    const reorderAssets = (oldIndex, newIndex) => {
        const reorderedAssets = assets.slice();
        reorderedAssets.splice(newIndex, 0, reorderedAssets.splice(oldIndex, 1)[0]);
        onChangeAssets(reorderedAssets);
    };

    return (
        <AssetsTabComponent
            assets={assets}
            onAddText={addText}
            onDelete={deleteAsset}
            onImport={importFile}
            onReorder={reorderAssets}
            onUpdate={updateAsset}
        />
    );
};

AssetsTab.propTypes = {
    assets: PropTypes.arrayOf(PropTypes.object),
    editingTarget: PropTypes.string,
    onChangeAssets: PropTypes.func
};

const mapStateToProps = state => ({
    assets: state.scratchGui.projectAssets,
    editingTarget: state.scratchGui.targets.editingTarget ||
        (state.scratchGui.targets.stage && state.scratchGui.targets.stage.id)
});

const mapDispatchToProps = dispatch => ({
    onChangeAssets: assets => {
        dispatch(setProjectAssets(assets));
        dispatch(setProjectChanged());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AssetsTab);
