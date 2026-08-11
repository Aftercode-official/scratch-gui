import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {closeWindowModal} from '../reducers/modals';
import WindowModalComponent from '../components/tw-window/tw-window.jsx';

const WindowModal = props => (
    <WindowModalComponent onClose={props.onClose} />
);

WindowModal.propTypes = {
    onClose: PropTypes.func.isRequired
};

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeWindowModal())
});

export default connect(
    null,
    mapDispatchToProps
)(WindowModal);
