import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {closeWindowModal} from '../reducers/modals';
import WindowModalComponent from '../components/tw-window/tw-window.jsx';

const WindowModal = props => (
    <WindowModalComponent
        onClose={props.onClose}
        vm={props.vm}
    />
);

WindowModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    vm: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeWindowModal())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(WindowModal);
