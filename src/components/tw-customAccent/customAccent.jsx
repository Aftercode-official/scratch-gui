import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import styles from './customAccent.css';

class CustomAccentModal extends React.Component {
    constructor (props) {
        super(props);
        this.state = {color: props.color};
        this.handleApply = this.handleApply.bind(this);
        this.handleColorChange = this.handleColorChange.bind(this);
    }

    handleApply () {
        this.props.onApply(this.state.color);
    }

    handleColorChange (event) {
        this.setState({color: event.target.value});
    }

    render () {
        return (
            <Modal
                className={styles.modalContent}
                contentLabel="Custom accent"
                id="customAccentModal"
                onRequestClose={this.props.onClose}
            >
                <div className={styles.body}>
                    <h2>{'Custom accent'}</h2>
                    <label>
                        {'Accent color'}
                        <input
                            type="color"
                            value={this.state.color}
                            onChange={this.handleColorChange}
                        />
                    </label>
                    <button
                        className={styles.loadButton}
                        onClick={this.handleApply}
                    >
                        {'Apply'}
                    </button>
                    <button onClick={this.props.onClose}>{'Cancel'}</button>
                </div>
            </Modal>
        );
    }
}

CustomAccentModal.propTypes = {
    color: PropTypes.string.isRequired,
    onApply: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default CustomAccentModal;
