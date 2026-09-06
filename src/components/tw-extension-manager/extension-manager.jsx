import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import styles from './extension-manager.css';

const ExtensionManager = props => (
    <Modal
        className={styles.modalContent}
        contentLabel="Extension manager"
        id="extensionManagerModal"
        onRequestClose={props.onClose}
    >
        <div className={styles.body}>
            <div className={styles.header}>
                <h2>{'Extension manager'}</h2>
                <button className={styles.refreshButton} onClick={props.onRefresh}>
                    {'Refresh'}
                </button>
                <button
                    className={styles.removeAllButton}
                    disabled={!props.extensions.length}
                    onClick={props.onRemoveAll}
                >
                    {'Remove all'}
                </button>
            </div>
            {props.extensions.length ? (
                <ul className={styles.extensionList}>
                    {props.extensions.map(extension => (
                        <li className={styles.extensionItem} key={extension.id}>
                            <div className={styles.extensionDetails}>
                                <strong>{extension.id}</strong>
                                <span>{extension.url}</span>
                            </div>
                            <button
                                aria-label={`Remove ${extension.id}`}
                                className={styles.removeButton}
                                onClick={() => props.onRemove(extension.id)}
                            >
                                {'x'}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.empty}>{'No custom extensions loaded.'}</p>
            )}
            {props.error && <p className={styles.error}>{props.error}</p>}
        </div>
    </Modal>
);

ExtensionManager.propTypes = {
    error: PropTypes.string,
    extensions: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired
    })).isRequired,
    onClose: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onRemoveAll: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired
};

export default ExtensionManager;
