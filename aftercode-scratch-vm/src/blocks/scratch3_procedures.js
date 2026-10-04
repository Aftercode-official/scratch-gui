class Scratch3ProcedureBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            procedures_definition: this.definition,
            procedures_call: this.call,
            procedures_return: this.return,
            procedures_set_param: this.setParam,
            argument_reporter_string_number: this.argumentReporterStringNumber,
            argument_reporter_boolean: this.argumentReporterBoolean,
            argument_reporter_object: this.argumentReporterObject,
            argument_reporter_array: this.argumentReporterArray,
            argument_reporter_color: this.argumentReporterColor,
            argument_reporter_statement: this.argumentReporterStatement
        };
    }

    definition () {
        // No-op: execute the blocks.
    }

    call (args, util) {
        const stackFrame = util.stackFrame;
        const mutation = args.mutation || {};
        const callerBlockContainer = util.thread.blockContainer || util.target.blocks;
        const currentBlock = callerBlockContainer.getBlock(util.thread.peekStack());
        const isDual = mutation.dual === true || mutation.dual === 'true';
        const isStackCall = currentBlock && (currentBlock.next ||
            callerBlockContainer.getNextBlock(currentBlock.parent) === currentBlock.id);
        const isReporter = !!mutation.return && (!isDual || !isStackCall);
        const isGlobal = mutation.global === true || mutation.global === 'true';

        if (stackFrame.executed) {
            if (isReporter) {
                const returnValue = stackFrame.returnValue;
                // This stackframe will be reused for other reporters in this block, so clean it up for them.
                // Can't use reset() because that will reset too much.
                const threadStackFrame = util.thread.peekStackFrame();
                threadStackFrame.params = null;
                delete stackFrame.returnValue;
                delete stackFrame.executed;
                return returnValue;
            }
            return;
        }

        const procedureCode = mutation.proccode;
        const paramNamesIdsAndDefaults = util.getProcedureParamNamesIdsAndDefaults(procedureCode, isGlobal);

        // If null, procedure could not be found, which can happen if custom
        // block is dragged between sprites without the definition.
        // Match Scratch 2.0 behavior and noop.
        if (paramNamesIdsAndDefaults === null) {
            if (isReporter) {
                return '';
            }
            return;
        }

        const [paramNames, paramIds, paramDefaults] = paramNamesIdsAndDefaults;

        // Initialize params for the current stackFrame to {}, even if the procedure does
        // not take any arguments. This is so that `getParam` down the line does not look
        // at earlier stack frames for the values of a given parameter (#1729)
        util.initParams();
        for (let i = 0; i < paramIds.length; i++) {
            if (Object.prototype.hasOwnProperty.call(args, paramIds[i])) {
                util.pushParam(paramNames[i], args[paramIds[i]]);
            } else {
                util.pushParam(paramNames[i], paramDefaults[i]);
            }
        }

        if (currentBlock && currentBlock.inputs) {
            let branchIndex = 0;
            const branchParamMap = {};
            for (let i = 0; i < paramIds.length; i++) {
                if (paramIds[i].startsWith('SUBSTACK')) {
                    const input = currentBlock.inputs[paramIds[i]];
                    const branchBlockId = (input && input.block) ? input.block : null;
                    util.pushParam(`__branch_${branchIndex}`, branchBlockId);
                    branchParamMap[paramNames[i]] = branchIndex;
                    branchIndex++;
                }
            }
            if (branchIndex > 0) {
                util.pushParam('__branchCount', branchIndex);
                util.pushParam('__branchParamMap', branchParamMap);
                util.pushParam('__callerBlockContainer', callerBlockContainer);
                util.pushParam('__definitionBlockContainer', util.thread.blockContainer);
            }
        }

        const addonBlock = util.runtime.getAddonBlock(procedureCode);
        if (addonBlock) {
            const result = addonBlock.callback(util.thread.getAllparams(), util);
            if (util.thread.status === 1 /* STATUS_PROMISE_WAIT */) {
                // If the addon block is using STATUS_PROMISE_WAIT to force us to sleep,
                // make sure to not re-run this block when we resume.
                stackFrame.executed = true;
            }
            return result;
        }

        stackFrame.executed = true;

        if (isReporter) {
            util.thread.peekStackFrame().waitingReporter = true;
            // Default return value
            stackFrame.returnValue = '';
        }

        util.startProcedure(procedureCode, isGlobal);
    }

    return (args, util) {
        util.stopThisScript();
        // If used outside of a custom block, there may be no stackframe.
        if (util.thread.peekStackFrame()) {
            util.stackFrame.returnValue = args.VALUE;
        }
    }

    setParam (args, util) {
        const activeStackFrame = util.thread.stackFrames[0];
        if (!activeStackFrame || !activeStackFrame.params) return;

        const currentBlock = util.target.blocks.getBlock(util.thread.peekStack());
        const paramInput = currentBlock && currentBlock.inputs && currentBlock.inputs.PARAM;
        if (!paramInput || !paramInput.block) return;

        const paramReporterBlock = util.target.blocks.getBlock(paramInput.block);
        if (!paramReporterBlock) return;

        // Only allow argument reporter blocks
        const opcode = paramReporterBlock.opcode;
        const allowedOpcode = (
            opcode === 'argument_reporter_string_number' ||
            opcode === 'argument_reporter_boolean' ||
            opcode === 'argument_reporter_array' ||
            opcode === 'argument_reporter_object' ||
            opcode === 'argument_reporter_color'
        );
        if (!allowedOpcode) return;

        const paramFieldValue = paramReporterBlock.fields && paramReporterBlock.fields.VALUE;
        const paramName = paramFieldValue && paramFieldValue.value;
        if (typeof paramName === 'undefined') return;

        activeStackFrame.params[paramName] = args.VALUE;
    }

    argumentReporterStringNumber (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // tw: support legacy block
            if (String(args.VALUE).toLowerCase() === 'last key pressed') {
                return util.ioQuery('keyboard', 'getLastKeyPressed');
            }
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }

    argumentReporterBoolean (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // tw: implement is compiled? and is turbowarp?
            const lowercaseValue = String(args.VALUE).toLowerCase();
            if (util.target.runtime.compilerOptions.enabled && lowercaseValue === 'is compiled?') {
                return true;
            }
            if (lowercaseValue === 'is nitrobolt?') {
                return true;
            }
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }

    argumentReporterObject (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            return 0;
        }
        return value;
    }

    argumentReporterArray (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            return 0;
        }
        return value;
    }

    argumentReporterColor (args, util) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            return 0;
        }
        return value;
    }

    argumentReporterStatement (args, util) {
        const currentBlockId = util.thread.peekStack();
        const currentBlock = util.thread.blockContainer.getBlock(currentBlockId);
        if (!currentBlock) return;

        const paramName = currentBlock.fields && currentBlock.fields.VALUE &&
            currentBlock.fields.VALUE.value;
        if (typeof paramName === 'undefined') return;

        const branchParamMap = util.getParam('__branchParamMap');
        if (!branchParamMap) return;

        const branchIndex = branchParamMap[paramName];
        if (typeof branchIndex === 'undefined') return;

        const branchBlockId = util.getParam(`__branch_${branchIndex}`);
        if (branchBlockId === null) return;

        const definitionBlockContainer = util.thread.blockContainer;

        const callerBlocks = util.getParam('__callerBlockContainer');
        if (callerBlocks) {
            util.thread.blockContainer = callerBlocks;
        }

        util.thread.pushStack(branchBlockId);
        util.thread.peekStackFrame().returnToBlockContainer = definitionBlockContainer;
    }
}

module.exports = Scratch3ProcedureBlocks;
