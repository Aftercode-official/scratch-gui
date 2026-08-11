import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import styles from './tw-window.css';

const WindowModal = props => (
    <Modal
        className={styles.modalContent}
        contentLabel="Terminal"
        id="windowModal"
        onRequestClose={props.onClose}
    >
        <div className={styles.body} />
    </Modal>
);

WindowModal.propTypes = {
    onClose: PropTypes.func.isRequired
};

export default WindowModal;
