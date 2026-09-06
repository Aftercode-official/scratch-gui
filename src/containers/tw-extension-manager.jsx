import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {closeExtensionManagerModal} from '../reducers/modals';
import ExtensionmanagerModal from '../components/tw-extension-manager/extension-manager.jsx';

class ExtensionManager extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            extensions: [],
            error: null
        };
        this.handleRefresh = this.handleRefresh.bind(this);
    }

    componentDidMount () {
        this.handleRefresh();
    }

    handleRefresh () {
        try {
            const urls = this.props.vm.extensionManager.getExtensionURLs();
            this.setState({
                extensions: Object.keys(urls).map(id => ({id, url: urls[id]})),
                error: null
            });
        } catch (error) {
            this.setState({error: error.message || String(error)});
        }
    }

    render () {
        return (
            <ExtensionmanagerModal
                error={this.state.error}
                extensions={this.state.extensions}
                onClose={this.props.onClose}
                onRefresh={this.handleRefresh}
            />
        );
    }
}

ExtensionManager.propTypes = {
    onClose: PropTypes.func,
    onLoadCustom: PropTypes.func,
    vm: PropTypes.shape({
        extensionManager: PropTypes.shape({
            getExtensionURLs: PropTypes.func
        })
    })
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeExtensionManagerModal())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ExtensionManager);
