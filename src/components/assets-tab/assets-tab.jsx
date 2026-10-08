import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import fileUploadIcon from '../action-menu/icon--file-upload.svg';
import spriteIcon from '../action-menu/icon--sprite.svg';
import AssetPanel from '../asset-panel/asset-panel.jsx';
import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import Label from '../forms/label.jsx';
import Input from '../forms/input.jsx';
import TWRenderRecoloredImage from '../../lib/tw-recolor/render.jsx';
import redoIcon from '!../../lib/tw-recolor/build!../sound-editor/icon--redo.svg';
import undoIcon from '!../../lib/tw-recolor/build!../sound-editor/icon--undo.svg';

import DragConstants from '../../lib/drag-constants';
import styles from './assets-tab.css';

const BufferedInput = BufferedInputHOC(Input);

const messages = defineMessages({
    asset: {
        id: 'gui.assetViewer.asset',
        description: 'Label for the name of the asset',
        defaultMessage: 'Asset'
    },
    lastModifiedDate: {
        id: 'gui.assetViewer.lastModifiedDate',
        description: 'Label for the last modification date of the asset',
        defaultMessage: 'Last Modified'
    },
    size: {
        id: 'gui.assetViewer.size',
        description: 'Label for the size of the asset',
        defaultMessage: 'Size'
    },
    undo: {
        id: 'gui.assetViewer.undo',
        description: 'Title of the button to undo in the text asset editor',
        defaultMessage: 'Undo'
    },
    redo: {
        id: 'gui.assetViewer.redo',
        description: 'Title of the button to redo in the text asset editor',
        defaultMessage: 'Redo'
    },
    newText: {
        id: 'gui.assetViewer.newText',
        description: 'Title of the button to create a text asset',
        defaultMessage: 'New text file'
    },
    importAsset: {
        id: 'gui.assetViewer.importAsset',
        description: 'Title of the button to import an asset',
        defaultMessage: 'Import Asset'
    },
    deleteAsset: {
        id: 'gui.assetViewer.deleteAsset',
        description: 'Title of the button to delete an asset',
        defaultMessage: 'Delete'
    },
    empty: {
        id: 'gui.assetViewer.empty',
        description: 'Message shown when there are no assets',
        defaultMessage: 'Import an image or any file to open it as text, or create a text file.'
    }
});

const MAX_UNDO_STEPS = 100;

const AssetViewerComponent = props => {
    const {
        assets,
        intl,
        onAddText,
        onDelete,
        onImport,
        onReorder,
        onUpdate
    } = props;
    const [selectedId, setSelectedId] = React.useState(null);
    const [importError, setImportError] = React.useState('');
    const [history, setHistory] = React.useState({assetId: null, undo: [], redo: []});
    const fileInput = React.useRef(null);
    const selectedAsset = assets.find(asset => asset.id === selectedId) || assets[0];
    const historyForSelected = history.assetId === (selectedAsset && selectedAsset.id) ?
        history : {assetId: selectedAsset && selectedAsset.id, undo: [], redo: []};
    const isTextEditable = selectedAsset && selectedAsset.type === 'text';

    const handleFileChange = event => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            Promise.resolve(onImport(file))
                .then(asset => {
                    setImportError('');
                    if (asset) {
                        setSelectedId(asset.id);
                        setHistory({assetId: asset.id, undo: [], redo: []});
                    }
                })
                .catch(error => {
                    setImportError(error.message || String(error));
                });
        }
        event.target.value = '';
    };

    const handleAddText = () => {
        const asset = onAddText();
        setSelectedId(asset.id);
        setHistory({assetId: asset.id, undo: [], redo: []});
    };

    const changeText = content => {
        setHistory(previous => {
            const previousHistory = previous.assetId === selectedAsset.id ?
                previous : {assetId: selectedAsset.id, undo: [], redo: []};
            return {
                assetId: selectedAsset.id,
                undo: previousHistory.undo.concat(selectedAsset.content).slice(-MAX_UNDO_STEPS),
                redo: []
            };
        });
        onUpdate(selectedAsset.id, {content});
    };

    const undo = () => {
        if (!selectedAsset || !historyForSelected.undo.length) return;
        const content = historyForSelected.undo[historyForSelected.undo.length - 1];
        setHistory({
            assetId: selectedAsset.id,
            undo: historyForSelected.undo.slice(0, -1),
            redo: historyForSelected.redo.concat(selectedAsset.content)
        });
        onUpdate(selectedAsset.id, {content});
    };

    const redo = () => {
        if (!selectedAsset || !historyForSelected.redo.length) return;
        const content = historyForSelected.redo[historyForSelected.redo.length - 1];
        setHistory({
            assetId: selectedAsset.id,
            undo: historyForSelected.undo.concat(selectedAsset.content),
            redo: historyForSelected.redo.slice(0, -1)
        });
        onUpdate(selectedAsset.id, {content});
    };

    const lastModified = selectedAsset && selectedAsset.lastModified ?
        new Date(selectedAsset.lastModified).toLocaleString() : '';
    const size = selectedAsset ? (
        selectedAsset.type === 'image' ?
            `${Math.round((selectedAsset.content.length * 3) / 4)} bytes` :
            `${new Blob([selectedAsset.content]).size} bytes`
    ) : '';

    return (
        <AssetPanel
            buttons={[{
                title: intl.formatMessage(messages.newText),
                img: spriteIcon,
                onClick: handleAddText
            }, {
                title: intl.formatMessage(messages.importAsset),
                img: fileUploadIcon,
                onClick: () => fileInput.current && fileInput.current.click(),
                fileAccept: '*/*',
                fileChange: handleFileChange,
                fileInput: input => {
                    fileInput.current = input;
                }
            }]}
            dragType={DragConstants.ASSET}
            items={assets.map(asset => ({
                name: asset.name,
                url: asset.type === 'image' ? asset.content : null
            }))}
            selectedItemIndex={Math.max(0, assets.findIndex(asset => asset.id === selectedAsset?.id))}
            onDeleteClick={index => {
                const asset = assets[index];
                if (asset) onDelete(asset.id);
                if (asset && asset.id === selectedId) setSelectedId(null);
            }}
            onDrop={dropInfo => {
                if (dropInfo.dragType === DragConstants.ASSET && dropInfo.newIndex !== null) {
                    onReorder(dropInfo.index, dropInfo.newIndex);
                }
            }}
            onItemClick={index => {
                const asset = assets[index];
                if (asset) {
                    setSelectedId(asset.id);
                    setHistory({assetId: asset.id, undo: [], redo: []});
                }
            }}
        >
        <div className={classNames(styles.viewerContainer, {
            [styles.textMode]: isTextEditable
        })}>
            {isTextEditable ? (
                <React.Fragment>
                    <div className={styles.editorHeaderRow}>
                        <div className={styles.inputGroup}>
                            <Label text={intl.formatMessage(messages.asset)}>
                                <BufferedInput
                                    tabIndex="1"
                                    type="text"
                                    value={selectedAsset.name}
                                    onSubmit={name => onUpdate(selectedAsset.id, {name})}
                                    className={styles.nameInput}
                                />
                            </Label>
                            <div className={styles.buttonGroup}>
                                <button
                                    className={styles.button}
                                    disabled={!historyForSelected.undo.length}
                                    title={intl.formatMessage(messages.undo)}
                                    onClick={undo}
                                >
                                    <TWRenderRecoloredImage
                                        className={styles.undoIcon}
                                        draggable={false}
                                        src={undoIcon}
                                    />
                                </button>
                                <button
                                    className={styles.button}
                                    disabled={!historyForSelected.redo.length}
                                    title={intl.formatMessage(messages.redo)}
                                    onClick={redo}
                                >
                                    <TWRenderRecoloredImage
                                        className={styles.redoIcon}
                                        draggable={false}
                                        src={redoIcon}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div
                        className={styles.editorSurface}
                        style={{maxWidth: '95%', maxHeight: '67%'}}
                    >
                        <textarea
                            aria-label={selectedAsset.name}
                            value={selectedAsset.content}
                            onChange={event => changeText(event.target.value)}
                            style={{
                                width: '100%',
                                height: '100%',
                                minHeight: '12rem',
                                padding: '0.75rem',
                                border: 0,
                                resize: 'none',
                                color: 'inherit',
                                background: 'transparent',
                                font: '13px/1.5 monospace'
                            }}
                        />
                    </div>
                    <div className={styles.infoRow}>
                        <div className={styles.attribute}>
                            <Label text={intl.formatMessage(messages.lastModifiedDate)}>
                                <Label secondary text={lastModified} />
                            </Label>
                        </div>
                        <div className={styles.attribute}>
                            <Label text={intl.formatMessage(messages.size)}>
                                <Label secondary text={size} />
                            </Label>
                        </div>
                    </div>
                </React.Fragment>
            ) : (
                <React.Fragment>
                    {importError ? <div role="alert">{importError}</div> : null}
                    {selectedAsset ? (
                        <React.Fragment>
                            <div className={styles.editorHeaderRow}>
                                <Label text={intl.formatMessage(messages.asset)}>
                                    <BufferedInput
                                        tabIndex="1"
                                        type="text"
                                        value={selectedAsset.name}
                                        onSubmit={name => onUpdate(selectedAsset.id, {name})}
                                        className={styles.nameInput}
                                    />
                                </Label>
                            </div>
                            {selectedAsset.type === 'image' ? (
                                <img
                                    className={styles.mediaPreview}
                                    src={selectedAsset.content}
                                    alt={selectedAsset.name}
                                    draggable={false}
                                />
                            ) : (
                                <div className={styles.attribute}>
                                    {'Text file'}
                                </div>
                            )}
                            <div className={styles.infoRow}>
                                <div className={styles.attribute}>
                                    <Label text={intl.formatMessage(messages.lastModifiedDate)}>
                                        <Label secondary text={lastModified} />
                                    </Label>
                                </div>
                                <div className={styles.attribute}>
                                    <Label text={intl.formatMessage(messages.size)}>
                                        <Label secondary text={size} />
                                    </Label>
                                </div>
                            </div>
                        </React.Fragment>
                    ) : (
                        <div className={styles.attribute}>
                            {intl.formatMessage(messages.empty)}
                        </div>
                    )}
                </React.Fragment>
            )}
        </div>
        </AssetPanel>
    );
};

AssetViewerComponent.propTypes = {
    assets: PropTypes.arrayOf(PropTypes.shape({
        content: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
        lastModified: PropTypes.number,
        name: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['image', 'text']).isRequired
    })).isRequired,
    onAddText: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    onReorder: PropTypes.func.isRequired,
    onUpdate: PropTypes.func.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(AssetViewerComponent);
