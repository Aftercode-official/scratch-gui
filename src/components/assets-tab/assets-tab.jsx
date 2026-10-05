import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import ActionMenu from '../action-menu/action-menu.jsx';
import fileUploadIcon from '../action-menu/icon--file-upload.svg';
import spriteIcon from '../action-menu/icon--sprite.svg';
import styles from './assets-tab.css';

const AssetsTab = props => {
    const {
        assets,
        onAddText,
        onDelete,
        onImport,
        onUpdate
    } = props;
    const [selectedId, setSelectedId] = React.useState(null);
    const [importError, setImportError] = React.useState('');
    const fileInput = React.useRef(null);
    const selectedAsset = assets.find(asset => asset.id === selectedId) || assets[0];

    const handleFileChange = event => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            Promise.resolve(onImport(file))
                .then(asset => {
                    setImportError('');
                    if (asset) setSelectedId(asset.id);
                })
                .catch(error => {
                    setImportError(error.message);
                });
        }
        event.target.value = '';
    };

    const handleAddText = () => {
        const asset = onAddText();
        setSelectedId(asset.id);
    };

    return (
        <div className={styles.wrapper}>
            <aside className={styles.sidebar}>
                <div className={styles.assetList}>
                    {assets.map(asset => (
                        <button
                            className={classNames(styles.assetItem, {
                                [styles.selected]: selectedAsset && selectedAsset.id === asset.id
                            })}
                            key={asset.id}
                            onClick={() => setSelectedId(asset.id)}
                        >
                            {asset.name}
                        </button>
                    ))}
                </div>
                <div className={styles.actions}>
                    {importError ? <div role="alert">{importError}</div> : null}
                    <ActionMenu
                        img={spriteIcon}
                        moreButtons={[{
                            title: 'Import Asset',
                            img: fileUploadIcon,
                            onClick: () => fileInput.current.click(),
                            fileAccept: '.png,.txt,image/png,text/plain',
                            fileChange: handleFileChange,
                            fileInput: input => {
                                fileInput.current = input;
                            }
                        }]}
                        title="New text file"
                        onClick={handleAddText}
                    />
                </div>
            </aside>
            {selectedAsset ? (
                <main className={styles.detail}>
                    <input
                        className={styles.filename}
                        value={selectedAsset.name}
                        onChange={event => onUpdate(selectedAsset.id, {name: event.target.value})}
                    />
                    {selectedAsset.type === 'text' ? (
                        <textarea
                            className={styles.editor}
                            value={selectedAsset.content}
                            onChange={event => onUpdate(selectedAsset.id, {content: event.target.value})}
                        />
                    ) : (
                        <div className={styles.imageWrapper}>
                            <img
                                className={styles.image}
                                alt={selectedAsset.name}
                                src={selectedAsset.content}
                            />
                        </div>
                    )}
                    <button
                        className={styles.deleteButton}
                        onClick={() => {
                            onDelete(selectedAsset.id);
                            setSelectedId(null);
                        }}
                    >
                        Delete
                    </button>
                </main>
            ) : (
                <main className={styles.empty}>Import a PNG or text file, or create a text file.</main>
            )}
        </div>
    );
};

AssetsTab.propTypes = {
    assets: PropTypes.arrayOf(PropTypes.shape({
        content: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['image', 'text']).isRequired
    })).isRequired,
    onAddText: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    onUpdate: PropTypes.func.isRequired
};

export default AssetsTab;
