import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {closePluginModal} from '../reducers/modals';
import PluginModalComponent from '../components/tw-plugin-modal/plugin-modal.jsx';

class PluginModal extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            files: null,
            error: null,
            loading: false
        };
        this.handleChangeFiles = this.handleChangeFiles.bind(this);
        this.handleLoad = this.handleLoad.bind(this);
    }

    handleChangeFiles (files) {
        this.setState({
            files,
            error: null
        });
    }

    async handleLoad () {
        if (!this.state.files) return;

        this.setState({
            loading: true,
            error: null
        });

        try {
            for (const file of Array.from(this.state.files)) {
                const source = await file.text();
                const script = document.createElement('script');
                script.textContent = source;
                document.head.appendChild(script);
                script.remove();
            }
            this.props.onClose();
        } catch (error) {
            this.setState({error: error.message || String(error)});
        } finally {
            this.setState({loading: false});
        }
    }

    render () {
        return (
            <PluginModalComponent
                canLoad={Boolean(this.state.files) && !this.state.loading}
                error={this.state.error}
                files={this.state.files}
                loading={this.state.loading}
                onChangeFiles={this.handleChangeFiles}
                onClose={this.props.onClose}
                onLoad={this.handleLoad}
            />
        );
    }
}

PluginModal.propTypes = {
    onClose: PropTypes.func
};

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closePluginModal())
});

export default connect(
    null,
    mapDispatchToProps
)(PluginModal);
