import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import styles from './tw-window.css';

class WindowModal extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            command: '',
            history: [],
            historyIndex: 0,
            output: [
                'Welcome to Scratch Terminal.',
                'Type "help" to see available commands.'
            ]
        };
        this.handleChange = this.handleChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.runCommand = this.runCommand.bind(this);
    }

    handleChange (event) {
        this.setState({
            command: event.target.value
        });
    }

    handleKeyDown (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.runCommand();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const index = Math.max(0, this.state.historyIndex - 1);
            this.setState({
                command: this.state.history[index] || '',
                historyIndex: index
            });
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            const index = Math.min(this.state.history.length, this.state.historyIndex + 1);
            this.setState({
                command: this.state.history[index] || '',
                historyIndex: index
            });
        }
    }

    async runCommand () {
        const command = this.state.command.trim();
        if (!command) return;

        if (command.toLowerCase() === 'clear') {
            this.setState({
                command: '',
                history: [...this.state.history, command],
                historyIndex: this.state.history.length + 1,
                output: []
            });
            return;
        }

        const [name] = command.split(/\s+/);
        const projectOutput = this.runProjectCommand(name.toLowerCase());
        if (projectOutput !== null) {
            this.setState({
                command: '',
                history: [...this.state.history, command],
                historyIndex: this.state.history.length + 1,
                output: [...this.state.output, `${this.prompt()} ${command}`, projectOutput]
            });
            return;
        }

        this.setState({
            command: '',
            history: [...this.state.history, command],
            historyIndex: this.state.history.length + 1,
            output: [...this.state.output, `${this.prompt()} ${command}`]
        });

        try {
            const response = await fetch('/api/terminal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({command})
            });
            const result = await response.json();
            const output = result.error || result.output || `(exit code ${result.exitCode})`;
            this.setState(prevState => ({
                output: [...prevState.output, output]
            }));
        } catch (error) {
            this.setState(prevState => ({
                output: [...prevState.output, `Terminal server unavailable: ${error.message}`]
            }));
        }
    }

    runProjectCommand (name) {
        if (name === 'run' || name === 'greenflag') {
            this.props.vm.start();
            this.props.vm.greenFlag();
            return 'Project started.';
        }
        if (name === 'stop') {
            this.props.vm.stopAll();
            return 'Project stopped.';
        }
        if (name === 'project') {
            return `Project targets: ${this.props.vm.runtime.targets.length}`;
        }
        if (name === 'sprites') {
            const sprites = this.props.vm.runtime.targets
                .filter(target => !target.isStage)
                .map(target => target.getName())
                .join(', ');
            return sprites || 'No sprites.';
        }
        return null;
    }

    prompt () {
        return 'scratch@project:~$';
    }

    render () {
        return (
            <Modal
                className={styles.modalContent}
                contentLabel="Terminal"
                id="windowModal"
                onRequestClose={this.props.onClose}
            >
                <div className={styles.body}>
                    <div className={styles.output}>
                        {this.state.output.map((line, index) => (
                            <div key={`${line}-${index}`}>{line}</div>
                        ))}
                    </div>
                    <label className={styles.commandLine}>
                        <span>{this.prompt()}</span>
                        <input
                            autoFocus
                            aria-label="Terminal command"
                            value={this.state.command}
                            onChange={this.handleChange}
                            onKeyDown={this.handleKeyDown}
                        />
                    </label>
                </div>
            </Modal>
        );
    }
}

WindowModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    vm: PropTypes.shape({
        greenFlag: PropTypes.func.isRequired,
        runtime: PropTypes.shape({
            targets: PropTypes.array.isRequired
        }).isRequired,
        start: PropTypes.func.isRequired,
        stopAll: PropTypes.func.isRequired
    }).isRequired
};

export default WindowModal;
