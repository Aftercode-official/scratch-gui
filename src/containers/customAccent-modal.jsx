import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {closeCustomAccentModal} from '../reducers/modals';
import CustomAccentModalComponent from '../components/tw-customAccent/customAccent.jsx';
import {createCustomAccent, Theme} from '../lib/themes';
import {setTheme} from '../reducers/theme';
import {persistTheme} from '../lib/themes/themePersistance';

class CustomAccentModal extends React.Component {
    constructor (props) {
        super(props);
        this.handleApply = this.handleApply.bind(this);
    }

    handleApply (color) {
        this.props.onApply(color, this.props.theme);
    }

    render () {
        return (
            <CustomAccentModalComponent
                color={this.props.theme.customAccent ? this.props.theme.customAccent.color : '#ff4c4c'}
                onApply={this.handleApply}
                onClose={this.props.onClose}
            />
        );
    }
}

CustomAccentModal.propTypes = {
    onApply: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    theme: PropTypes.instanceOf(Theme).isRequired
};

const mapStateToProps = state => ({
    theme: state.scratchGui.theme.theme
});

const mapDispatchToProps = dispatch => ({
    onApply: (color, currentTheme) => {
        const theme = currentTheme.set('accent', createCustomAccent(color));
        dispatch(setTheme(theme));
        persistTheme(theme);
        dispatch(closeCustomAccentModal());
    },
    onClose: () => dispatch(closeCustomAccentModal())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CustomAccentModal);
