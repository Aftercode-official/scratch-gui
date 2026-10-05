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
        const asset = {
            id: createId(),
            name: 'Untitled.txt',
            type: 'text',
            content: '',
            scopeId: props.editingTarget,
            lastModified: Date.now()
        };
        onChangeAssets(assets.concat(asset));
        return asset;
    };

    const importFile = file => new Promise((resolve, reject) => {
        const extension = file.name.split('.').pop().toLowerCase();
        const type = extension === 'png' ? 'image' : extension === 'txt' ? 'text' : null;
        if (!type || (type === 'image' && file.type && file.type !== 'image/png')) {
            reject(new Error('Only PNG images and plain text files are supported.'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
            reject(new Error(`Could not read ${file.name}.`));
        };
        reader.onload = () => {
            const asset = {
                id: createId(),
                name: file.name,
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

    return (
        <AssetsTabComponent
            assets={assets}
            onAddText={addText}
            onDelete={deleteAsset}
            onImport={importFile}
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
