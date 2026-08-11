import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import FileInput from '../tw-custom-extension-modal/file-input.jsx';
import styles from './plugin-modal.css';

const PluginModal = props => (
    <Modal
        className={styles.modalContent}
        contentLabel="Custom plugin"
        id="pluginModal"
        onRequestClose={props.onClose}
    >
        <div className={styles.body}>
            <h2>{'Upload custom plugin'}</h2>
            <FileInput
                accept=".js,application/javascript"
                files={props.files}
                onChange={props.onChangeFiles}
            />
            {props.error && <p className={styles.error}>{props.error}</p>}
            <button
                className={styles.loadButton}
                disabled={!props.canLoad}
                onClick={props.onLoad}
            >
                {props.loading ? 'Running...' : 'Run plugin'}
            </button>
        </div>
    </Modal>
);

PluginModal.propTypes = {
    canLoad: PropTypes.bool.isRequired,
    error: PropTypes.string,
    files: PropTypes.instanceOf(FileList),
    loading: PropTypes.bool.isRequired,
    onChangeFiles: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onLoad: PropTypes.func.isRequired
};

export default PluginModal;
