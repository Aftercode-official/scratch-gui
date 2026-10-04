const Thread = require('./thread');
const Timer = require('../util/timer');

/**
 * @fileoverview
 * Interface provided to block primitive functions for interacting with the
 * runtime, thread, target, and convenient methods.
 */

class BlockUtility {
    constructor (sequencer = null, thread = null) {
        /**
         * A sequencer block primitives use to branch or start procedures with
         * @type {?Sequencer}
         */
        this.sequencer = sequencer;

        /**
         * The block primitives thread with the block's target, stackFrame and
         * modifiable status.
         * @type {?Thread}
         */
        this.thread = thread;

        this._nowObj = {
            now: () => this.sequencer.runtime.currentMSecs
        };
    }

    /**
     * The target the primitive is working on.
     * @type {Target}
     */
    get target () {
        return this.thread.target;
    }

    /**
     * The runtime the block primitive is running in.
     * @type {Runtime}
     */
    get runtime () {
        return this.sequencer.runtime;
    }

    /**
     * Use the runtime's currentMSecs value as a timestamp value for now
     * This is useful in some cases where we need compatibility with Scratch 2
     * @type {function}
     */
    get nowObj () {
        if (this.runtime) {
            return this._nowObj;
        }
        return null;
    }

    /**
     * The stack frame used by loop and other blocks to track internal state.
     * @type {object}
     */
    get stackFrame () {
        const frame = this.thread.peekStackFrame();
        if (frame.executionContext === null) {
            frame.executionContext = {};
        }
        return frame.executionContext;
    }

    /**
     * Simplified name for stackFrame.index.
     * @type {number}
     */
    get iterationNumber () {
        if (typeof this.stackFrame.index === 'undefined') this.stackFrame.index = 0;
        return this.stackFrame.index;
    }

    set iterationNumber (value) {
        this.stackFrame.index = value;
    }

    /**
     * Check the stack timer and return a boolean based on whether it has finished or not.
     * @return {boolean} - true if the stack timer has finished.
     */
    stackTimerFinished () {
        const timeElapsed = this.stackFrame.timer.timeElapsed();
        if (timeElapsed < this.stackFrame.duration) {
            return false;
        }
        return true;
    }

    /**
     * Check if the stack timer needs initialization.
     * @return {boolean} - true if the stack timer needs to be initialized.
     */
    stackTimerNeedsInit () {
        return !this.stackFrame.timer;
    }

    /**
     * Create and start a stack timer
     * @param {number} duration - a duration in milliseconds to set the timer for.
     */
    startStackTimer (duration) {
        if (this.nowObj) {
            this.stackFrame.timer = new Timer(this.nowObj);
        } else {
            this.stackFrame.timer = new Timer();
        }
        this.stackFrame.timer.start();
        this.stackFrame.duration = duration;
    }

    /**
     * Set the thread to yield.
     */
    yield () {
        this.thread.status = Thread.STATUS_YIELD;
    }

    /**
     * Set the thread to yield until the next tick of the runtime.
     */
    yieldTick () {
        this.thread.status = Thread.STATUS_YIELD_TICK;
    }

    /**
     * Start a branch in the current block.
     * @param {number} branchNum Which branch to step to (i.e., 1, 2).
     * @param {boolean} isLoop Whether this block is a loop.
     */
    startBranch (branchNum, isLoop) {
        this.sequencer.stepToBranch(this.thread, branchNum, isLoop);
    }

    /**
     * Stop all threads.
     */
    stopAll () {
        this.sequencer.runtime.stopAll();
    }

    /**
     * Stop threads other on this target other than the thread holding the
     * executed block.
     */
    stopOtherTargetThreads () {
        this.sequencer.runtime.stopForTarget(this.thread.target, this.thread);
    }

    /**
     * Stop this thread.
     */
    stopThisScript () {
        this.thread.stopThisScript();
    }

    /**
     * Start a specified procedure on this thread.
     * @param {string} procedureCode Procedure code for procedure to start.
     * @param {boolean=} isGlobal If true, resolve globally scoped procedures.
     */
    startProcedure (procedureCode, isGlobal) {
        this.sequencer.stepToProcedure(this.thread, procedureCode, isGlobal);
    }

    /**
     * Get names and ids of parameters for the given procedure.
     * @param {string} procedureCode Procedure code for procedure to query.
     * @param {boolean=} requireGlobal If true, query globally scoped procedures.
     * @return {Array.<string>} List of param names for a procedure.
     */
    getProcedureParamNamesAndIds (procedureCode, requireGlobal) {
        const info = this.getProcedureParamNamesIdsAndDefaults(procedureCode, requireGlobal);
        return info ? info.slice(0, 2) : null;
    }

    /**
     * Get names, ids, and defaults of parameters for the given procedure.
     * @param {string} procedureCode Procedure code for procedure to query.
     * @param {boolean=} requireGlobal If true, query globally scoped procedures.
     * @return {Array.<string>} List of param names for a procedure.
     */
    getProcedureParamNamesIdsAndDefaults (procedureCode, requireGlobal) {
        const mustBeGlobal = !!requireGlobal;
        const currentTarget = this.thread.target;

        if (!mustBeGlobal) {
            return currentTarget.blocks.getProcedureParamNamesIdsAndDefaults(procedureCode, false);
        }

        let result = currentTarget.blocks.getProcedureParamNamesIdsAndDefaults(procedureCode, true);
        if (result) {
            return result;
        }

        for (const target of this.runtime.targets) {
            if (!target || !target.blocks || !target.isOriginal || target === currentTarget) {
                continue;
            }
            result = target.blocks.getProcedureParamNamesIdsAndDefaults(procedureCode, true);
            if (result) {
                return result;
            }
        }

        return null;
    }

    /**
     * Initialize procedure parameters in the thread before pushing parameters.
     */
    initParams () {
        this.thread.initParams();
    }

    /**
     * Store a procedure parameter value by its name.
     * @param {string} paramName The procedure's parameter name.
     * @param {*} paramValue The procedure's parameter value.
     */
    pushParam (paramName, paramValue) {
        this.thread.pushParam(paramName, paramValue);
    }

    /**
     * Retrieve the stored parameter value for a given parameter name.
     * @param {string} paramName The procedure's parameter name.
     * @return {*} The parameter's current stored value.
     */
    getParam (paramName) {
        return this.thread.getParam(paramName);
    }

    /**
     * Set the value for a given parameter name.
     * @param {string} name The procedure's parameter name.
     * @param {*} vame The value to store in the parameter.
     */
    setParam (name, value) {
        this.initParams();
        this.thread.peekStackFrame().params[name] = value;
    }

    /**
     * Gets all arguments of a specific name in an extendable input in an args object as a nested array.
     * @param {object} args The args object.
     * @param {...string} path The sequence of argument names in the nested path.
     * @returns {array} The nested array structure of retrieved values.
     */
    extendableToArray (args, ...path) {
        if (!args || typeof args !== 'object' || path.length === 0) {
            return [];
        }

        const retrieve = (prefix, pathIndex) => {
            const currentArg = path[pathIndex];
            const key = prefix ? `${prefix}_${currentArg}` : currentArg;

            if (pathIndex === path.length - 1) {
                return args[key];
            }

            let length = -1;
            if (typeof args[key] !== 'undefined' && args[key] !== null) {
                const parsed = Math.floor(Number(args[key]));
                if (parsed >= 0) {
                    length = parsed;
                }
            }

            if (length === -1) {
                const searchPrefix = `${key}_`;
                let maxIndex = -1;
                for (const k of Object.keys(args)) {
                    if (k.startsWith(searchPrefix)) {
                        const rest = k.slice(searchPrefix.length);
                        const parts = rest.split('_');
                        const index = Math.floor(Number(parts[0]));
                        if (!isNaN(index) && index > maxIndex) {
                            maxIndex = index;
                        }
                    }
                }
                length = maxIndex + 1;
            }

            const array = new Array(length);
            for (let i = 0; i < length; i++) {
                array[i] = retrieve(`${key}_${i}`, pathIndex + 1);
            }
            return array;
        };
        return retrieve('', 0);
    }

    /**
     * Start all relevant hats.
     * @param {!string} requestedHat Opcode of hats to start.
     * @param {object=} optMatchFields Optionally, fields to match on the hat.
     * @param {Target=} optTarget Optionally, a target to restrict to.
     * @return {Array.<Thread>} List of threads started by this function.
     */
    startHats (requestedHat, optMatchFields, optTarget) {
        // Store thread and sequencer to ensure we can return to the calling block's context.
        // startHats may execute further blocks and dirty the BlockUtility's execution context
        // and confuse the calling block when we return to it.
        const callerThread = this.thread;
        const callerSequencer = this.sequencer;
        const result = this.sequencer.runtime.startHats(requestedHat, optMatchFields, optTarget);

        // Restore thread and sequencer to prior values before we return to the calling block.
        this.thread = callerThread;
        this.sequencer = callerSequencer;

        return result;
    }

    /**
     * Query a named IO device.
     * @param {string} device The name of like the device, like keyboard.
     * @param {string} func The name of the device's function to query.
     * @param {Array.<*>} args Arguments to pass to the device's function.
     * @return {*} The expected output for the device's function.
     */
    ioQuery (device, func, args) {
        // Find the I/O device and execute the query/function call.
        if (
            this.sequencer.runtime.ioDevices[device] &&
            this.sequencer.runtime.ioDevices[device][func]) {
            const devObject = this.sequencer.runtime.ioDevices[device];
            // TODO: verify correct `this` after switching from apply to spread
            // eslint-disable-next-line prefer-spread
            return devObject[func].apply(devObject, args);
        }
    }
}

module.exports = BlockUtility;
