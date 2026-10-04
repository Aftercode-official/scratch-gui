const adapter = require('./adapter');
const mutationAdapter = require('./mutation-adapter');
const xmlEscape = require('../util/xml-escape');
const MonitorRecord = require('./monitor-record');
const Clone = require('../util/clone');
const BlocksExecuteCache = require('./blocks-execute-cache');
const BlocksRuntimeCache = require('./blocks-runtime-cache');
const log = require('../util/log');
const Variable = require('./variable');
const getMonitorIdForBlockWithArgs = require('../util/get-monitor-id');
const uid = require('../util/uid');

/**
 * @fileoverview
 * Store and mutate the VM block representation,
 * and handle updates from Scratch Blocks events.
 */

/**
 * Create a block container.
 * @param {Runtime} runtime The runtime this block container operates within
 * @param {boolean} optNoGlow Optional flag to indicate that blocks in this container
 * should not request glows. This does not affect glows when clicking on a block to execute it.
 */
class Blocks {
    constructor (runtime, optNoGlow) {
        this.runtime = runtime;

        /**
         * All blocks in the workspace.
         * Keys are block IDs, values are metadata about the block.
         * @type {Object.<string, Object>}
         */
        this._blocks = {};

        /**
         * All top-level scripts in the workspace.
         * A list of block IDs that represent scripts (i.e., first block in script).
         * @type {Array.<String>}
         */
        this._scripts = [];

        /**
         * Runtime Cache
         * @type {{inputs: {}, procedureParamNames: {}, procedureDefinitions: {}}}
         * @private
         */
        Object.defineProperty(this, '_cache', {writable: true, enumerable: false});
        this._cache = {
            /**
             * Cache block inputs by block id
             * @type {object.<string, !Array.<object>>}
             */
            inputs: {},
            /**
             * Cache procedure Param Names by block id
             * @type {object.<string, ?Array.<string>>}
             */
            procedureParamNames: {},
            /**
             * Cache procedure definitions by block id
             * @type {object.<string, ?string>}
             */
            procedureDefinitions: {},

            /**
             * A cache for execute to use and store on. Only available to
             * execute.
             * @type {object.<string, object>}
             */
            _executeCached: {},

            /**
             * A cache of block IDs and targets to start threads on as they are
             * actively monitored.
             * @type {Array<{blockId: string, target: Target}>}
             */
            _monitored: null,

            /**
             * A cache of hat opcodes to collection of theads to execute.
             * @type {object.<string, object>}
             */
            scripts: {},

            /**
             * tw: A cache of top block (usually hat, but not always) opcodes to compiled scripts.
             * @type {object.<string, object>}
             */
            compiledScripts: {},

            /**
             * tw: A cache of procedure code opcodes to a parsed intermediate representation
             * @type {object.<string, object>}
             */
            compiledProcedures: {},

            /**
             * tw: Whether populateProcedureCache has been run
             */
            proceduresPopulated: false
        };

        /**
         * Flag which indicates that blocks in this container should not glow.
         * Blocks will still glow when clicked on, but this flag is used to control
         * whether the blocks in this container can request a glow as part of
         * a running stack. E.g. the flyout block container and the monitor block container
         * should not be able to request a glow, but blocks containers belonging to
         * sprites should.
         * @type {boolean}
         */
        this.forceNoGlow = optNoGlow || false;
    }

    /**
     * Get the cached compilation result of a block.
     * @param {string} blockId ID of the top block.
     * @returns {{success: boolean; value: any}|null} Cached success or error, or null if there is no cached value.
     */
    getCachedCompileResult (blockId) {
        if (Object.prototype.hasOwnProperty.call(this._cache.compiledScripts, blockId)) {
            return this._cache.compiledScripts[blockId];
        }
        return null;
    }

    /**
     * Set the cached compilation result of a script.
     * @param {string} blockId ID of the top block.
     * @param {*} value The compilation result to store.
     */
    cacheCompileResult (blockId, value) {
        this._cache.compiledScripts[blockId] = {
            success: true,
            value: value
        };
    }

    /**
     * Set the cached error of a script.
     * @param {string} blockId ID of the top block.
     * @param {*} error The error to store.
     */
    cacheCompileError (blockId, error) {
        this._cache.compiledScripts[blockId] = {
            success: false,
            value: error
        };
    }

    /**
     * Blockly inputs that represent statements/branch.
     * are prefixed with this string.
     * @const{string}
     */
    static get BRANCH_INPUT_PREFIX () {
        return 'SUBSTACK';
    }

    /**
     * Provide an object with metadata for the requested block ID.
     * @param {!string} blockId ID of block we have stored.
     * @return {?object} Metadata about the block, if it exists.
     */
    getBlock (blockId) {
        return this._blocks[blockId];
    }

    /**
     * Get all known top-level blocks that start scripts.
     * @return {Array.<string>} List of block IDs.
     */
    getScripts () {
        return this._scripts;
    }

    /**
      * Get the next block for a particular block
      * @param {?string} id ID of block to get the next block for
      * @return {?string} ID of next block in the sequence
      */
    getNextBlock (id) {
        const block = this._blocks[id];
        return (typeof block === 'undefined') ? null : block.next;
    }

    /**
     * Get the branch for a particular C-shaped block.
     * @param {?string} id ID for block to get the branch for.
     * @param {?number} branchNum Which branch to select (e.g. for if-else).
     * @return {?string} ID of block in the branch.
     */
    getBranch (id, branchNum) {
        const block = this._blocks[id];
        if (typeof block === 'undefined') return null;
        if (!branchNum) branchNum = 1;

        let inputName = Blocks.BRANCH_INPUT_PREFIX;
        if (typeof branchNum === 'string' || branchNum > 1) {
            inputName += branchNum;
        }

        // Empty C-block?
        const input = block.inputs[inputName];
        return (typeof input === 'undefined') ? null : input.block;
    }

    /**
     * Get the opcode for a particular block
     * @param {?object} block The block to query
     * @return {?string} the opcode corresponding to that block
     */
    getOpcode (block) {
        return (typeof block === 'undefined') ? null : block.opcode;
    }

    /**
     * Get all fields and their values for a block.
     * @param {?object} block The block to query.
     * @return {?object} All fields and their values.
     */
    getFields (block) {
        return (typeof block === 'undefined') ? null : block.fields;
    }

    /**
     * Get all non-branch inputs for a block.
     * @param {?object} block the block to query.
     * @return {?Array.<object>} All non-branch inputs and their associated blocks.
     */
    getInputs (block) {
        if (typeof block === 'undefined') return null;
        let inputs = this._cache.inputs[block.id];
        if (typeof inputs !== 'undefined') {
            return inputs;
        }

        inputs = {};
        for (const input in block.inputs) {
            // Ignore blocks prefixed with branch prefix.
            if (input.substring(0, Blocks.BRANCH_INPUT_PREFIX.length) !==
                Blocks.BRANCH_INPUT_PREFIX) {
                inputs[input] = block.inputs[input];
            }
        }

        this._cache.inputs[block.id] = inputs;
        return inputs;
    }

    /**
     * Get mutation data for a block.
     * @param {?object} block The block to query.
     * @return {?object} Mutation for the block.
     */
    getMutation (block) {
        return (typeof block === 'undefined') ? null : block.mutation;
    }

    /**
     * Get the top-level script for a given block.
     * @param {?string} id ID of block to query.
     * @return {?string} ID of top-level script block.
     */
    getTopLevelScript (id) {
        let block = this._blocks[id];
        if (typeof block === 'undefined') return null;
        while (block.parent !== null) {
            block = this._blocks[block.parent];
        }
        return block.id;
    }

    /**
     * Get the procedure definition for a given name and scope.
     * @param {?string} name Name of procedure to query.
     * @param {boolean} requireGlobal If true, only match globally scoped procedures.
     * @return {?string} ID of procedure definition.
     */
    getProcedureDefinitionWithScope (name, requireGlobal) {
        if (!requireGlobal) {
            const blockID = this._cache.procedureDefinitions[name];
            if (typeof blockID !== 'undefined') {
                return blockID;
            }
        }

        for (const id in this._blocks) {
            if (!Object.prototype.hasOwnProperty.call(this._blocks, id)) continue;
            const block = this._blocks[id];
            if (block.opcode === 'procedures_definition') {
                // tw: make sure that populateProcedureCache is kept up to date with this method
                const internal = this._getCustomBlockInternal(block);
                if (internal && internal.mutation.proccode === name) {
                    if (requireGlobal && !(internal.mutation.global === true || internal.mutation.global === 'true')) {
                        continue;
                    }
                    if (!requireGlobal) {
                        this._cache.procedureDefinitions[name] = id; // The outer define block id
                    }
                    return id;
                }
            }
        }

        if (!requireGlobal) {
            this._cache.procedureDefinitions[name] = null;
        }
        return null;
    }

    /**
     * Get the procedure definition for a given name and scope.
     * @param {?string} name Name of procedure to query.
     * @param {boolean=} requireGlobal If true, only match globally scoped procedures.
     * @return {?string} ID of procedure definition.
     */
    getProcedureDefinition (name, requireGlobal) {
        return this.getProcedureDefinitionWithScope(name, !!requireGlobal);
    }

    /**
     * Get names and ids of parameters for the given procedure.
     * @param {?string} name Name of procedure to query.
     * @return {?Array.<string>} List of param names for a procedure.
     */
    getProcedureParamNamesAndIds (name, requireGlobal) {
        return this.getProcedureParamNamesIdsAndDefaults(name, requireGlobal).slice(0, 2);
    }

    /**
     * Normalize procedure defaults based on param types from the proccode.
     * @param {string} proccode The procedure code string.
     * @param {string[]} names Parameter names.
     * @param {string[]} ids Parameter IDs.
     * @param {Array} defaults Parameter defaults.
     * @returns {Array} Normalized defaults.
     */
    static normalizeProcedureDefaults (proccode, names, ids, defaults) {
        const paramTypes = [];
        const regex = /%([snboar])/g;
        let match;
        while ((match = regex.exec(proccode)) !== null) {
            paramTypes.push(match[1]);
        }

        const len = names.length;
        const result = [];
        for (let i = 0; i < len; i++) {
            const type = paramTypes[i];
            let def = i < defaults.length ? defaults[i] : null;

            if (type === 'a') {
                if (!Array.isArray(def)) {
                    def = [];
                }
            } else if (type === 'o') {
                if (typeof def !== 'object' || def === null || Array.isArray(def)) {
                    def = {};
                }
            } else if (type === 'b') {
                if (typeof def !== 'string' || (def !== 'true' && def !== 'false')) {
                    def = 'false';
                }
            } else if (type === 'n') {
                if (typeof def !== 'number') {
                    def = 1;
                }
            } else if (typeof def === 'object') {
                def = '';
            }

            result.push(def);
        }
        return result;
    }

    /**
     * Get names, ids, and defaults of parameters for the given procedure.
     * @param {?string} name Name of procedure to query.
     * @return {?Array} List of param names, ids, and defaults for a procedure.
     */
    getProcedureParamNamesIdsAndDefaults (name, requireGlobal) {
        const mustBeGlobal = !!requireGlobal;
        if (!mustBeGlobal) {
            const cachedNames = this._cache.procedureParamNames[name];
            if (typeof cachedNames !== 'undefined') {
                return cachedNames;
            }
        }

        for (const id in this._blocks) {
            if (!Object.prototype.hasOwnProperty.call(this._blocks, id)) continue;
            const block = this._blocks[id];
            if (block.opcode === 'procedures_prototype' &&
                block.mutation.proccode === name) {
                if (mustBeGlobal && !(block.mutation.global === true || block.mutation.global === 'true')) {
                    continue;
                }

                // tw: make sure that populateProcedureCache is kept up to date with this method
                const names = JSON.parse(block.mutation.argumentnames);
                const ids = JSON.parse(block.mutation.argumentids);
                const defaults = Blocks.normalizeProcedureDefaults(
                    block.mutation.proccode, names, ids,
                    JSON.parse(block.mutation.argumentdefaults)
                );

                if (!mustBeGlobal) {
                    this._cache.procedureParamNames[name] = [names, ids, defaults];
                    return this._cache.procedureParamNames[name];
                }
                return [names, ids, defaults];
            }
        }

        if (!mustBeGlobal) {
            const addonBlock = this.runtime.getAddonBlock(name);
            if (addonBlock) {
                this._cache.procedureParamNames[name] = addonBlock.namesIdsDefaults;
                return addonBlock.namesIdsDefaults;
            }
        }

        if (!mustBeGlobal) {
            this._cache.procedureParamNames[name] = null;
        }
        return null;
    }

    /**
     * tw: Setup the procedureParamNames and procedureDefinitions caches all at once.
     * This makes subsequent calls to these methods faster.
     */
    populateProcedureCache () {
        if (this._cache.proceduresPopulated) {
            return;
        }
        for (const id in this._blocks) {
            if (!Object.prototype.hasOwnProperty.call(this._blocks, id)) continue;
            const block = this._blocks[id];

            if (block.opcode === 'procedures_prototype') {
                const name = block.mutation.proccode;
                if (!this._cache.procedureParamNames[name]) {
                    const names = JSON.parse(block.mutation.argumentnames);
                    const ids = JSON.parse(block.mutation.argumentids);
                    const defaults = Blocks.normalizeProcedureDefaults(
                        block.mutation.proccode, names, ids,
                        JSON.parse(block.mutation.argumentdefaults)
                    );
                    this._cache.procedureParamNames[name] = [names, ids, defaults];
                }
                continue;
            }

            if (block.opcode === 'procedures_definition') {
                const internal = this._getCustomBlockInternal(block);
                if (internal) {
                    const name = internal.mutation.proccode;
                    if (!this._cache.procedureDefinitions[name]) {
                        this._cache.procedureDefinitions[name] = id;
                    }
                    continue;
                }
            }
        }
        this._cache.proceduresPopulated = true;
    }

    duplicate () {
        const newBlocks = new Blocks(this.runtime, this.forceNoGlow);
        newBlocks._blocks = Clone.simple(this._blocks);
        newBlocks._scripts = Clone.simple(this._scripts);
        return newBlocks;
    }
    // ---------------------------------------------------------------------

    /**
     * Create event listener for blocks, variables, and comments. Handles validation and
     * serves as a generic adapter between the blocks, variables, and the
     * runtime interface.
     * @param {object} e Blockly "block" or "variable" event
     */
    blocklyListen (e) {
        // Validate event
        if (typeof e !== 'object') return;
        if (typeof e.blockId !== 'string' && typeof e.varId !== 'string' &&
            typeof e.commentId !== 'string' && typeof e.groupId !== 'string') {
            return;
        }
        const stage = this.runtime.getTargetForStage();
        const editingTarget = this.runtime.getEditingTarget();

        if (e.type === 'group_change' && editingTarget) {
            if (e.newState) {
                editingTarget.createGroup(e.newState);
            } else {
                delete editingTarget.groups[e.groupId];
            }
            this.emitProjectChanged();
            return;
        }

        // UI event: clicked scripts toggle in the runtime.
        if (e.element === 'stackclick') {
            this.runtime.toggleScript(e.blockId, {stackClick: true});
            return;
        }

        // Block create/update/destroy
        switch (e.type) {
        case 'create': {
            const newBlocks = adapter(e);
            // A create event can create many blocks. Add them all.
            for (let i = 0; i < newBlocks.length; i++) {
                this.createBlock(newBlocks[i]);
            }
            break;
        }
        case 'change':
            this.changeBlock({
                id: e.blockId,
                element: e.element,
                name: e.name,
                value: e.newValue
            });
            break;
        case 'move':
            this.moveBlock({
                id: e.blockId,
                oldParent: e.oldParentId,
                oldInput: e.oldInputName,
                newParent: e.newParentId,
                newInput: e.newInputName,
                newCoordinate: e.newCoordinate
            });
            break;
        case 'dragOutside':
            this.runtime.emitBlockDragUpdate(e.isOutside);
            break;
        case 'endDrag':
            this.runtime.emitBlockDragUpdate(false /* areBlocksOverGui */);

            // Drag blocks onto another sprite
            if (e.isOutside) {
                const newBlocks = adapter(e);
                this.runtime.emitBlockEndDrag(newBlocks, e.blockId);
            }
            break;
        case 'group_drag_outside':
            this.runtime.emitBlockDragUpdate(e.isOutside);
            break;
        case 'group_end_drag': {
            this.runtime.emitBlockDragUpdate(false);
            if (e.isOutside) {
                const newBlocks = e.xmls.reduce((all, xml) =>
                    all.concat(adapter({xml})), []);
                const group = Object.assign({}, e.groupState, {
                    blocks: newBlocks.filter(block => block.topLevel).map(block => block.id)
                });
                this.runtime.emitBlockEndDrag(newBlocks, group.blocks[0] || null, group);
            }
            break;
        }
        case 'delete':
            // Don't accept delete events for missing blocks,
            // or shadow blocks being obscured.
            if (!Object.prototype.hasOwnProperty.call(this._blocks, e.blockId) ||
                this._blocks[e.blockId].shadow) {
                return;
            }
            // Inform any runtime to forget about glows on this script.
            if (this._blocks[e.blockId].topLevel) {
                this.runtime.quietGlow(e.blockId);
            }
            this.deleteBlock(e.blockId);
            break;
        case 'var_create':
            this.resetCache(); // tw: more aggressive cache resetting
            // Check if the variable being created is global or local
            // If local, create a local var on the current editing target, as long
            // as there are no conflicts, and the current target is actually a sprite
            // If global or if the editing target is not present or we somehow got
            // into a state where a local var was requested for the stage,
            // create a stage (global) var after checking for name conflicts
            // on all the sprites.
            if (e.isLocal && editingTarget && !editingTarget.isStage && !e.isCloud) {
                if (!editingTarget.lookupVariableById(e.varId)) {
                    editingTarget.createVariable(e.varId, e.varName, e.varType);
                    this.emitProjectChanged();
                }
            } else {
                if (stage.lookupVariableById(e.varId)) {
                    // Do not re-create a variable if it already exists
                    return;
                }
                // Check for name conflicts in all of the targets
                const allTargets = this.runtime.targets.filter(t => t.isOriginal);
                for (const target of allTargets) {
                    if (target.lookupVariableByNameAndType(e.varName, e.varType, true)) {
                        return;
                    }
                }
                stage.createVariable(e.varId, e.varName, e.varType, e.isCloud);
                this.emitProjectChanged();
            }
            break;
        case 'var_rename':
            if (editingTarget && Object.prototype.hasOwnProperty.call(editingTarget.variables, e.varId)) {
                // This is a local variable, rename on the current target
                editingTarget.renameVariable(e.varId, e.newName);
                // Update all the blocks on the current target that use
                // this variable
                editingTarget.blocks.updateBlocksAfterVarRename(e.varId, e.newName);
            } else {
                // This is a global variable
                stage.renameVariable(e.varId, e.newName);
                // Update all blocks on all targets that use the renamed variable
                const targets = this.runtime.targets;
                for (let i = 0; i < targets.length; i++) {
                    const currTarget = targets[i];
                    currTarget.blocks.updateBlocksAfterVarRename(e.varId, e.newName);
                }
            }
            this.emitProjectChanged();
            break;
        case 'var_delete': {
            this.resetCache(); // tw: more aggressive cache resetting
            const target = (editingTarget && Object.prototype.hasOwnProperty.call(editingTarget.variables, e.varId)) ?
                editingTarget : stage;
            target.deleteVariable(e.varId);
            this.emitProjectChanged();
            break;
        }
        case 'comment_create':
            this.resetCache(); // tw: comments can affect compilation
            if (this.runtime.getEditingTarget()) {
                const currTarget = this.runtime.getEditingTarget();
                currTarget.createComment(e.commentId, e.blockId, e.text,
                    e.xy.x, e.xy.y, e.width, e.height, e.minimized, e.colour);

                if (currTarget.comments[e.commentId].x === null &&
                    currTarget.comments[e.commentId].y === null) {
                    // Block comments imported from 2.0 projects are imported with their
                    // x and y coordinates set to null so that scratch-blocks can
                    // auto-position them. If we are receiving a create event for these
                    // comments, then the auto positioning should have taken place.
                    // Update the x and y position of these comments to match the
                    // one from the event.
                    currTarget.comments[e.commentId].x = e.xy.x;
                    currTarget.comments[e.commentId].y = e.xy.y;
                }
            }
            this.emitProjectChanged();
            break;
        case 'comment_change':
            this.resetCache(); // tw: comments can affect compilation
            if (this.runtime.getEditingTarget()) {
                const currTarget = this.runtime.getEditingTarget();
                if (!Object.prototype.hasOwnProperty.call(currTarget.comments, e.commentId)) {
                    log.warn(`Cannot change comment with id ${e.commentId} because it does not exist.`);
                    return;
                }
                const comment = currTarget.comments[e.commentId];
                const change = e.newContents_;
                if (Object.prototype.hasOwnProperty.call(change, 'minimized')) {
                    comment.minimized = change.minimized;
                }
                if (Object.prototype.hasOwnProperty.call(change, 'width') &&
                    Object.prototype.hasOwnProperty.call(change, 'height')) {
                    comment.width = change.width;
                    comment.height = change.height;
                }
                if (Object.prototype.hasOwnProperty.call(change, 'text')) {
                    comment.text = change.text;
                }
                if (Object.prototype.hasOwnProperty.call(change, 'colour')) {
                    comment.colour = change.colour;
                }
                this.emitProjectChanged();
            }
            break;
        case 'comment_move':
            if (this.runtime.getEditingTarget()) {
                const currTarget = this.runtime.getEditingTarget();
                if (currTarget && !Object.prototype.hasOwnProperty.call(currTarget.comments, e.commentId)) {
                    log.warn(`Cannot change comment with id ${e.commentId} because it does not exist.`);
                    return;
                }
                const comment = currTarget.comments[e.commentId];
                const newCoord = e.newCoordinate_;
                comment.x = newCoord.x;
                comment.y = newCoord.y;

                this.emitProjectChanged();
            }
            break;
        case 'comment_delete':
            this.resetCache(); // tw: comments can affect compilation
            if (this.runtime.getEditingTarget()) {
                const currTarget = this.runtime.getEditingTarget();
                if (!Object.prototype.hasOwnProperty.call(currTarget.comments, e.commentId)) {
                    // If we're in this state, we have probably received
                    // a delete event from a workspace that we switched from
                    // (e.g. a delete event for a comment on sprite a's workspace
                    // when switching from sprite a to sprite b)
                    return;
                }
                delete currTarget.comments[e.commentId];
                if (e.blockId) {
                    const block = currTarget.blocks.getBlock(e.blockId);
                    if (!block) {
                        log.warn(`Could not find block referenced by comment with id: ${e.commentId}`);
                        return;
                    }
                    delete block.comment;
                }

                this.emitProjectChanged();
            }
            break;
        }
    }

    // ---------------------------------------------------------------------

    /**
     * Reset all runtime caches.
     */
    resetCache () {
        this._cache.inputs = {};
        this._cache.procedureParamNames = {};
        this._cache.procedureDefinitions = {};
        this._cache._executeCached = {};
        this._cache._monitored = null;
        this._cache.scripts = {};
        this._cache.compiledScripts = {};
        this._cache.compiledProcedures = {};
        this._cache.proceduresPopulated = false;
    }

    /**
     * Emit a project changed event if this is a block container
     * that can affect the project state.
     */
    emitProjectChanged () {
        if (!this.forceNoGlow) {
            this.runtime.emitProjectChanged();
        }
    }

    /**
     * Block management: create blocks and scripts from a `create` event
     * @param {!object} block Blockly create event to be processed
     */
    createBlock (block) {
        // Does the block already exist?
        // Could happen, e.g., for an unobscured shadow.
        if (Object.prototype.hasOwnProperty.call(this._blocks, block.id)) {
            return;
        }
        // Older serialized blocks and direct VM consumers may not provide this metadata.
        if (typeof block.monitorMode !== 'string') {
            block.monitorMode = 'default';
        }
        // Create new block.
        this._blocks[block.id] = block;
        // Push block id to scripts array.
        // Blocks are added as a top-level stack if they are marked as a top-block
        // (if they were top-level XML in the event).
        if (block.topLevel) {
            this._addScript(block.id);
        }

        this.resetCache();

        // A new block was actually added to the block container,
        // emit a project changed event
        this.emitProjectChanged();
    }

    /**
     * Block management: change block field values
     * @param {!object} args Blockly change event to be processed
     */
    changeBlock (args) {
        // Validate
        if (['field', 'mutation', 'shadow', 'checkbox', 'collapsed'].indexOf(args.element) === -1) return;
        let block = this._blocks[args.id];
        if (typeof block === 'undefined') return;
        switch (args.element) {
        case 'field':
            // TODO when the field of a monitored block changes,
            // update the checkbox in the flyout based on whether
            // a monitor for that current combination of selected parameters exists
            // e.g.
            // 1. check (current [v year])
            // 2. switch dropdown in flyout block to (current [v minute])
            // 3. the checkbox should become unchecked if we're not already
            //    monitoring current minute


            // Update block value
            if (!block.fields[args.name]) {
                block.fields[args.name] = {
                    name: args.name,
                    value: args.value
                };
            }
            if (args.name === 'VARIABLE' ||
                args.name === 'LIST' ||
                args.name === 'TABLE' ||
                args.name === 'BROADCAST_OPTION'
            ) {
                // Get variable name using the id in args.value.
                const variable = this.runtime.getEditingTarget().lookupVariableById(args.value);
                if (variable) {
                    block.fields[args.name].value = variable.name;
                    block.fields[args.name].id = args.value;
                }
            } else {
                // Changing the value in a dropdown
                block.fields[args.name].value = args.value;

                // The selected item in the sensing of block menu needs to change based on the
                // selected target.  Set it to the first item in the menu list.
                // TODO: (#1787)
                if (block.opcode === 'sensing_of_object_menu') {
                    if (block.fields.OBJECT.value === '_stage_') {
                        this._blocks[block.parent].fields.PROPERTY.value = 'backdrop #';
                    } else {
                        this._blocks[block.parent].fields.PROPERTY.value = 'x position';
                    }
                    this.runtime.requestBlocksUpdate();
                }

                const flyoutBlock = block.shadow && block.parent ? this._blocks[block.parent] : block;
                if (flyoutBlock.isMonitored) {
                    this.runtime.requestUpdateMonitor({
                        id: flyoutBlock.id,
                        params: this._getBlockParams(flyoutBlock)
                    });
                }
            }
            break;
        case 'mutation': {
            const oldMutation = block.mutation ? Object.assign({}, block.mutation) : null;
            block.mutation = mutationAdapter(args.value);
            if (block.opcode === 'procedures_prototype') {
                const isGlobal = block.mutation &&
                    (block.mutation.global === true || block.mutation.global === 'true');
                const wasGlobal = oldMutation &&
                    (oldMutation.global === true || oldMutation.global === 'true');
                if (isGlobal || wasGlobal) {
                    const sourceTarget = this.runtime.getEditingTarget();
                    this.runtime.syncGlobalProcedureMutation(
                        sourceTarget && sourceTarget.id,
                        block.mutation,
                        oldMutation
                    );
                }
            }
            break;
        }
        case 'shadow':
            block.shadow = args.value;
            break;
        case 'checkbox': {
            // A checkbox usually has a one to one correspondence with the monitor
            // block but in the case of monitored reporters that have arguments,
            // map the old id to a new id, creating a new monitor block if necessary
            if (block.fields && Object.keys(block.fields).length > 0 &&
                block.opcode !== 'data_variable' &&
                block.opcode !== 'data_listcontents' &&
                block.opcode !== 'data_tablecontents'
            ) {

                // This block has an argument which needs to get separated out into
                // multiple monitor blocks with ids based on the selected argument
                const newId = getMonitorIdForBlockWithArgs(block.id, block.fields);
                // Note: we're not just constantly creating a longer and longer id everytime we check
                // the checkbox because we're using the id of the block in the flyout as the base

                // check if a block with the new id already exists, otherwise create
                let newBlock = this.runtime.monitorBlocks.getBlock(newId);
                if (!newBlock) {
                    newBlock = JSON.parse(JSON.stringify(block));
                    newBlock.id = newId;
                    this.runtime.monitorBlocks.createBlock(newBlock);
                }

                block = newBlock; // Carry on through the rest of this code with newBlock
            }

            const wasMonitored = block.isMonitored;
            block.isMonitored = args.value;

            // Variable blocks may be sprite specific depending on the owner of the variable
            let isSpriteLocalVariable = false;
            if (block.opcode === 'data_variable') {
                isSpriteLocalVariable = !(this.runtime.getTargetForStage().variables[block.fields.VARIABLE.id]);
            } else if (block.opcode === 'data_listcontents') {
                isSpriteLocalVariable = !(this.runtime.getTargetForStage().variables[block.fields.LIST.id]);
            } else if (block.opcode === 'data_tablecontents') {
                isSpriteLocalVariable = !(this.runtime.getTargetForStage().variables[block.fields.TABLE.id]);
            }

            const isSpriteSpecific = isSpriteLocalVariable ||
                (Object.prototype.hasOwnProperty.call(this.runtime.monitorBlockInfo, block.opcode) &&
                this.runtime.monitorBlockInfo[block.opcode].isSpriteSpecific);
            if (isSpriteSpecific) {
                // If creating a new sprite specific monitor, the only possible target is
                // the current editing one b/c you cannot dynamically create monitors.
                // Also, do not change the targetId if it has already been assigned
                block.targetId = block.targetId || this.runtime.getEditingTarget().id;
            } else {
                block.targetId = null;
            }

            if (wasMonitored && !block.isMonitored) {
                this.runtime.requestHideMonitor(block.id);
            } else if (!wasMonitored && block.isMonitored) {
                // Tries to show the monitor for specified block. If it doesn't exist, add the monitor.
                let mode;
                switch (block.opcode) {
                case 'data_tablecontents':
                    mode = 'table';
                    break;
                case 'data_listcontents':
                    mode = 'list';
                    break;
                default:
                    mode = block.monitorMode;
                    break;
                }
                if (!this.runtime.requestShowMonitor(block.id)) {
                    this.runtime.requestAddMonitor(new MonitorRecord({
                        id: block.id,
                        targetId: block.targetId,
                        spriteName: block.targetId ? this.runtime.getTargetById(block.targetId).getName() : null,
                        opcode: block.opcode,
                        params: this._getBlockParams(block),
                        // @todo(vm#565) for numerical values with decimals, some countries use comma
                        value: '',
                        mode
                    }));
                }
            }
            break;
        }
        case 'collapsed':
            block.collapsed = args.value;
            break;
        }

        this.emitProjectChanged();

        this.resetCache();
    }

    /**
     * Apply a global procedure mutation to matching procedure blocks.
     * @param {!object} nextMutation New mutation state.
     * @param {?object} prevMutation Previous mutation state.
     * @returns {boolean} True if any blocks were updated.
     */
    syncGlobalProcedureMutation (nextMutation, prevMutation) {
        if (!nextMutation || !nextMutation.proccode) {
            return false;
        }

        const oldProcCode = prevMutation && prevMutation.proccode;
        const nextProcCode = nextMutation.proccode;
        const mutationProcCodes = Object.create(null);
        mutationProcCodes[nextProcCode] = true;
        if (oldProcCode) {
            mutationProcCodes[oldProcCode] = true;
        }

        let changed = false;
        const blockIds = Object.keys(this._blocks);
        for (const id of blockIds) {
            const block = this._blocks[id];
            if (!block || !block.mutation || !mutationProcCodes[block.mutation.proccode]) {
                continue;
            }

            if (block.opcode === 'procedures_prototype') {
                block.mutation.proccode = nextProcCode;
                block.mutation.argumentids = nextMutation.argumentids;
                block.mutation.argumentnames = nextMutation.argumentnames;
                block.mutation.argumentdefaults = nextMutation.argumentdefaults;
                block.mutation.argumentdropdowns = nextMutation.argumentdropdowns;
                block.mutation.warp = nextMutation.warp;
                block.mutation.global = nextMutation.global;
                block.mutation.colour = nextMutation.colour;
                block.mutation.output = nextMutation.output;
                block.mutation.dual = nextMutation.dual;
                if (Object.prototype.hasOwnProperty.call(nextMutation, 'return')) {
                    block.mutation.return = nextMutation.return;
                } else {
                    delete block.mutation.return;
                }
                changed = true;
                continue;
            }

            if (block.opcode === 'procedures_call') {
                block.mutation.proccode = nextProcCode;
                block.mutation.argumentids = nextMutation.argumentids;
                block.mutation.argumentdropdowns = nextMutation.argumentdropdowns;
                block.mutation.warp = nextMutation.warp;
                block.mutation.global = nextMutation.global;
                block.mutation.colour = nextMutation.colour;
                block.mutation.output = nextMutation.output;
                block.mutation.dual = nextMutation.dual;
                const shapeChanged = (Number(block.mutation.return) > 0) !==
                    (Number(nextMutation.return) > 0);
                const canChangeShape = block.topLevel && !block.next;
                const hasForcedOutput = nextMutation.output && nextMutation.output !== 'auto';
                if (hasForcedOutput || !shapeChanged || canChangeShape) {
                    if (Object.prototype.hasOwnProperty.call(nextMutation, 'return')) {
                        block.mutation.return = nextMutation.return;
                    } else {
                        delete block.mutation.return;
                    }
                }
                this._syncGlobalProcedureInputs(block, nextMutation);
                changed = true;
            }
        }

        if (changed) {
            this.resetCache();
        }
        return changed;
    }

    /**
     * Reconcile inputs on an inactive global procedure caller. Existing inputs
     * stay connected by argument ID, removed user blocks become top-level, and
     * new string/number inputs receive their standard default shadows.
     * @param {!object} block Procedure call block.
     * @param {!object} mutation Updated procedure prototype mutation.
     * @private
     */
    _syncGlobalProcedureInputs (block, mutation) {
        let argumentIds;
        try {
            argumentIds = JSON.parse(mutation.argumentids || '[]');
        } catch (e) {
            return;
        }

        let argumentDropdowns;
        try {
            argumentDropdowns = JSON.parse(mutation.argumentdropdowns || '[]');
        } catch (e) {
            argumentDropdowns = [];
        }

        const argumentTypes = [];
        const argumentPattern = /(?:^|[^\\])%([nbdoasr])/g;
        let match;
        while ((match = argumentPattern.exec(mutation.proccode || ''))) {
            argumentTypes.push(match[1]);
        }

        block.inputs = block.inputs || {};
        const activeArgumentIds = new Set(argumentIds);
        for (const inputId of Object.keys(block.inputs)) {
            if (activeArgumentIds.has(inputId)) continue;
            const input = block.inputs[inputId];
            const child = input && this._blocks[input.block];
            const shadowId = input && input.shadow;

            if (child && input.block !== shadowId) {
                child.parent = null;
                if (typeof child.x === 'undefined') child.x = 0;
                if (typeof child.y === 'undefined') child.y = 0;
                this._addScript(child.id);
            }
            if (shadowId) {
                delete this._blocks[shadowId];
            }
            delete block.inputs[inputId];
        }

        let dropdownIndex = 0;
        for (let i = 0; i < argumentIds.length; i++) {
            const argumentId = argumentIds[i];
            const argumentType = argumentTypes[i];
            const dropdownOptions = argumentType === 'd' ?
                (argumentDropdowns[dropdownIndex++] || []) : null;
            const existingInput = block.inputs[argumentId];

            if (existingInput) {
                if (argumentType === 'd' && existingInput.block === existingInput.shadow) {
                    const shadow = this._blocks[existingInput.shadow];
                    if (shadow && shadow.opcode === 'procedures_dropdown') {
                        const values = dropdownOptions.length > 0 ? dropdownOptions : [''];
                        const field = shadow.fields && shadow.fields.DROPDOWN_VALUE;
                        if (field && !values.includes(field.value)) {
                            field.value = values[0];
                        }
                    }
                }
                continue;
            }

            if (argumentType !== 's' && argumentType !== 'n' && argumentType !== 'd') {
                continue;
            }

            const shadowId = uid();
            if (argumentType === 'd') {
                const value = dropdownOptions.length > 0 ? dropdownOptions[0] : '';
                this._blocks[shadowId] = {
                    id: shadowId,
                    opcode: 'procedures_dropdown',
                    inputs: {},
                    fields: {
                        DROPDOWN_VALUE: {
                            name: 'DROPDOWN_VALUE',
                            value
                        }
                    },
                    next: null,
                    topLevel: false,
                    parent: block.id,
                    shadow: true
                };
                block.inputs[argumentId] = {
                    name: argumentId,
                    block: shadowId,
                    shadow: shadowId
                };
                continue;
            }

            const isNumber = argumentType === 'n';
            const fieldName = isNumber ? 'NUM' : 'TEXT';
            this._blocks[shadowId] = {
                id: shadowId,
                opcode: isNumber ? 'math_number' : 'text',
                inputs: {},
                fields: {
                    [fieldName]: {
                        name: fieldName,
                        value: isNumber ? '1' : ''
                    }
                },
                next: null,
                topLevel: false,
                parent: block.id,
                shadow: true
            };
            block.inputs[argumentId] = {
                name: argumentId,
                block: shadowId,
                shadow: shadowId
            };
        }
    }

    /**
     * Block management: move blocks from parent to parent
     * @param {!object} e Blockly move event to be processed
     */
    moveBlock (e) {
        if (!Object.prototype.hasOwnProperty.call(this._blocks, e.id)) {
            return;
        }

        const block = this._blocks[e.id];
        // Track whether a change actually occurred
        // ignoring changes like routine re-positioning
        // of a block when loading a workspace
        let didChange = false;

        // Move coordinate changes.
        if (e.newCoordinate) {

            didChange = (block.x !== e.newCoordinate.x) || (block.y !== e.newCoordinate.y);

            block.x = e.newCoordinate.x;
            block.y = e.newCoordinate.y;
        }

        // Remove from any old parent.
        if (typeof e.oldParent !== 'undefined') {
            const oldParent = this._blocks[e.oldParent];
            if (typeof e.oldInput !== 'undefined' &&
                oldParent.inputs[e.oldInput].block === e.id) {
                // This block was connected to the old parent's input.
                oldParent.inputs[e.oldInput].block = null;
            } else if (oldParent.next === e.id) {
                // This block was connected to the old parent's next connection.
                oldParent.next = null;
            }
            this._blocks[e.id].parent = null;
            didChange = true;
        }

        // Is this block a top-level block?
        if (typeof e.newParent === 'undefined') {
            this._addScript(e.id);
        } else {
            // Remove script, if one exists.
            this._deleteScript(e.id);
            // Otherwise, try to connect it in its new place.
            if (typeof e.newInput === 'undefined') {
                // Moved to the new parent's next connection.
                this._blocks[e.newParent].next = e.id;
            } else {
                // Moved to the new parent's input.
                // Don't obscure the shadow block.
                let oldShadow = null;
                if (Object.prototype.hasOwnProperty.call(this._blocks[e.newParent].inputs, e.newInput)) {
                    oldShadow = this._blocks[e.newParent].inputs[e.newInput].shadow;
                }

                // If the block being attached is itself a shadow, make sure to set
                // both block and shadow to that blocks ID. This happens when adding
                // inputs to a custom procedure.
                if (this._blocks[e.id].shadow) oldShadow = e.id;

                this._blocks[e.newParent].inputs[e.newInput] = {
                    name: e.newInput,
                    block: e.id,
                    shadow: oldShadow
                };
            }
            this._blocks[e.id].parent = e.newParent;
            didChange = true;
        }
        this.resetCache();

        if (didChange) this.emitProjectChanged();
    }


    /**
     * Block management: run all blocks.
     * @param {!object} runtime Runtime to run all blocks in.
     */
    runAllMonitored (runtime) {
        if (this._cache._monitored === null) {
            this._cache._monitored = Object.keys(this._blocks)
                .filter(blockId => this.getBlock(blockId).isMonitored)
                .map(blockId => {
                    const targetId = this.getBlock(blockId).targetId;
                    return {
                        blockId,
                        target: targetId ? runtime.getTargetById(targetId) : null
                    };
                });
        }

        const monitored = this._cache._monitored;
        for (let i = 0; i < monitored.length; i++) {
            const {blockId, target} = monitored[i];
            runtime.addMonitorScript(blockId, target);
        }
    }

    /**
     * Block management: delete blocks and their associated scripts. Does nothing if a block
     * with the given ID does not exist.
     * @param {!string} blockId Id of block to delete
     * @param {boolean} preserve Should stack be kept intact
     */
    deleteBlock (blockId, preserve) {
        // @todo In runtime, stop threads running on this script.

        // Get block
        const block = this._blocks[blockId];
        if (!block) {
            // No block with the given ID exists
            return;
        }

        // Delete children
        if (block.next !== null && !preserve) {
            this.deleteBlock(block.next);
        }
        let preservedStack = block.next;

        // Preservation if needed
        if (preserve) {
            const parent = this._blocks[block.parent];
            const input = parent?.inputs ?
                Object.values(parent.inputs).find(i => i.block === blockId) :
                null;

            // Flatten statement inputs into the surrounding script before its old
            // tail. Multi-branch blocks retain every branch in input order.
            const substacks = [];
            for (const inputName in block.inputs) {
                const blockInput = block.inputs[inputName];
                if (inputName.startsWith('SUBSTACK') && blockInput.block !== null) {
                    substacks.push(blockInput.block);
                    blockInput.block = null;
                }
            }
            if (substacks.length > 0) {
                preservedStack = substacks[0];
                for (let i = 0; i < substacks.length; i++) {
                    let lastBlock = this._blocks[substacks[i]];
                    while (lastBlock && lastBlock.next !== null) {
                        lastBlock = this._blocks[lastBlock.next];
                    }
                    const followingBlockId = substacks[i + 1] || block.next;
                    if (lastBlock) {
                        lastBlock.next = followingBlockId;
                    }
                    const followingBlock = this._blocks[followingBlockId];
                    if (followingBlock && lastBlock) {
                        followingBlock.parent = lastBlock.id;
                    }
                }
            }

            if (parent && !input) {
                parent.next = preservedStack;
            }
            const firstPreservedBlock = this._blocks[preservedStack];
            if (firstPreservedBlock) {
                firstPreservedBlock.parent = block.parent;
            }
            if (input) {
                input.block = preservedStack;
            }

            // Reporter inputs cannot be spliced into a statement connection, so
            // promote real reporters to their own scripts. Generated shadow/default
            // inputs still belong to the deleted block.
            for (const inputName in block.inputs) {
                const blockInput = block.inputs[inputName];
                if (blockInput.block === null || blockInput.block === blockInput.shadow) continue;

                const inputBlock = this._blocks[blockInput.block];
                if (inputBlock) {
                    inputBlock.parent = null;
                    inputBlock.topLevel = true;
                    inputBlock.x = block.x;
                    inputBlock.y = block.y;
                    if (this._scripts.indexOf(inputBlock.id) === -1) {
                        this._scripts.push(inputBlock.id);
                    }
                }
                blockInput.block = null;
            }
        }

        // Delete inputs (including branches not preserved above)
        for (const input in block.inputs) {
            // If it's null, the block in this input moved away.
            if (block.inputs[input].block !== null) {
                this.deleteBlock(block.inputs[input].block);
            }
            // Delete obscured shadow blocks.
            if (block.inputs[input].shadow !== null &&
                block.inputs[input].shadow !== block.inputs[input].block) {
                this.deleteBlock(block.inputs[input].shadow);
            }
        }

        // More preservation stuff
        if (!preserve) {
            this._deleteScript(blockId);
        }
        const index = this._scripts.indexOf(blockId);
        if (preserve && index > -1) {
            const firstPreservedBlock = this._blocks[preservedStack];
            if (firstPreservedBlock) {
                this._scripts.push(firstPreservedBlock.id);
                firstPreservedBlock.topLevel = true;
                firstPreservedBlock.x = block.x;
                firstPreservedBlock.y = block.y;
            }
            this._scripts.splice(index, 1);
        }

        // Delete block itself.
        delete this._blocks[blockId];

        this.resetCache();
        this.emitProjectChanged();
    }

    /**
     * Delete all blocks and their associated scripts.
     */
    deleteAllBlocks () {
        const blockIds = Object.keys(this._blocks);
        blockIds.forEach(blockId => this.deleteBlock(blockId));
    }

    /**
     * Returns a map of all references to variables or lists from blocks
     * in this block container.
     * @param {Array<object>} optBlocks Optional list of blocks to constrain the search to.
     * This is useful for getting variable/list references for a stack of blocks instead
     * of all blocks on the workspace
     * @param {?boolean} optIncludeBroadcast Optional whether to include broadcast fields.
     * @return {object} A map of variable ID to a list of all variable references
     * for that ID. A variable reference contains the field referencing that variable
     * and also the type of the variable being referenced.
     */
    getAllVariableAndListReferences (optBlocks, optIncludeBroadcast) {
        const blocks = optBlocks ? optBlocks : this._blocks;
        const allReferences = Object.create(null);
        for (const blockId in blocks) {
            let varTypeField = null;
            let varType = null;
            if (blocks[blockId].fields.VARIABLE) {
                varTypeField = blocks[blockId].fields.VARIABLE;
                varType = Variable.SCALAR_TYPE;
            } else if (blocks[blockId].fields.LIST) {
                varTypeField = blocks[blockId].fields.LIST;
                varType = Variable.LIST_TYPE;
            } else if (blocks[blockId].fields.TABLE) {
                varTypeField = blocks[blockId].fields.TABLE;
                varType = Variable.TABLE_TYPE;
            } else if (optIncludeBroadcast && blocks[blockId].fields.BROADCAST_OPTION) {
                varTypeField = blocks[blockId].fields.BROADCAST_OPTION;
                varType = Variable.BROADCAST_MESSAGE_TYPE;
            }
            if (varTypeField) {
                const currVarId = varTypeField.id;
                if (allReferences[currVarId]) {
                    allReferences[currVarId].push({
                        referencingField: varTypeField,
                        type: varType
                    });
                } else {
                    allReferences[currVarId] = [{
                        referencingField: varTypeField,
                        type: varType
                    }];
                }
            }
        }
        return allReferences;
    }

    /**
     * Keep blocks up to date after a variable gets renamed.
     * @param {string} varId The id of the variable that was renamed
     * @param {string} newName The new name of the variable that was renamed
     */
    updateBlocksAfterVarRename (varId, newName) {
        const blocks = this._blocks;
        for (const blockId in blocks) {
            let varTypeField = null;
            if (blocks[blockId].fields.VARIABLE) {
                varTypeField = blocks[blockId].fields.VARIABLE;
            } else if (blocks[blockId].fields.LIST) {
                varTypeField = blocks[blockId].fields.LIST;
            } else if (blocks[blockId].fields.TABLE) {
                varTypeField = blocks[blockId].fields.TABLE;
            }
            if (varTypeField) {
                const currFieldId = varTypeField.id;
                if (varId === currFieldId) {
                    varTypeField.value = newName;
                }
            }
        }
    }

    /**
     * Keep blocks up to date after they are shared between targets.
     * @param {boolean} isStage If the new target is a stage.
     */
    updateTargetSpecificBlocks (isStage) {
        const blocks = this._blocks;
        for (const blockId in blocks) {
            if (isStage && blocks[blockId].opcode === 'event_whenthisspriteclicked') {
                blocks[blockId].opcode = 'event_whenstageclicked';
            } else if (!isStage && blocks[blockId].opcode === 'event_whenstageclicked') {
                blocks[blockId].opcode = 'event_whenthisspriteclicked';
            }
        }
    }

    /**
     * Update blocks after a sound, costume, or backdrop gets renamed.
     * Any block referring to the old name of the asset should get updated
     * to refer to the new name.
     * @param {string} oldName The old name of the asset that was renamed.
     * @param {string} newName The new name of the asset that was renamed.
     * @param {string} assetType String representation of the kind of asset
     * that was renamed. This can be one of 'sprite','costume', 'sound',
     * 'backdrop', or 'asset'.
     */
    updateAssetName (oldName, newName, assetType) {
        let getAssetField;
        if (assetType === 'costume') {
            getAssetField = this._getCostumeField.bind(this);
        } else if (assetType === 'sound') {
            getAssetField = this._getSoundField.bind(this);
        } else if (assetType === 'asset') {
            getAssetField = this._getAssetField.bind(this);
        } else if (assetType === 'backdrop') {
            getAssetField = this._getBackdropField.bind(this);
        } else if (assetType === 'sprite') {
            getAssetField = this._getSpriteField.bind(this);
        } else {
            return;
        }
        const blocks = this._blocks;
        for (const blockId in blocks) {
            const assetField = getAssetField(blockId);
            if (assetField && assetField.value === oldName) {
                assetField.value = newName;
            }
        }
        this.resetCache();
    }

    /**
     * Update sensing_of blocks after a variable gets renamed.
     * @param {string} oldName The old name of the variable that was renamed.
     * @param {string} newName The new name of the variable that was renamed.
     * @param {string} targetName The name of the target the variable belongs to.
     * @return {boolean} Returns true if any of the blocks were updated.
     */
    updateSensingOfReference (oldName, newName, targetName) {
        const blocks = this._blocks;
        let blockUpdated = false;
        for (const blockId in blocks) {
            const block = blocks[blockId];
            if (block.opcode === 'sensing_of' &&
                block.fields.PROPERTY.value === oldName &&
                // If block and shadow are different, it means a block is inserted to OBJECT, and should be ignored.
                block.inputs.OBJECT.block === block.inputs.OBJECT.shadow) {
                const inputBlock = this.getBlock(block.inputs.OBJECT.block);
                if (inputBlock.fields.OBJECT.value === targetName) {
                    block.fields.PROPERTY.value = newName;
                    blockUpdated = true;
                }
            }
        }
        if (blockUpdated) this.resetCache();
        return blockUpdated;
    }

    /**
     * Helper function to retrieve a costume menu field from a block given its id.
     * @param {string} blockId A unique identifier for a block
     * @return {?object} The costume menu field of the block with the given block id.
     * Null if either a block with the given id doesn't exist or if a costume menu field
     * does not exist on the block with the given id.
     */
    _getCostumeField (blockId) {
        const block = this.getBlock(blockId);
        if (block && Object.prototype.hasOwnProperty.call(block.fields, 'COSTUME')) {
            return block.fields.COSTUME;
        }
        return null;
    }

    /**
     * Helper function to retrieve a sound menu field from a block given its id.
     * @param {string} blockId A unique identifier for a block
     * @return {?object} The sound menu field of the block with the given block id.
     * Null, if either a block with the given id doesn't exist or if a sound menu field
     * does not exist on the block with the given id.
     */
    _getSoundField (blockId) {
        const block = this.getBlock(blockId);
        if (block && Object.prototype.hasOwnProperty.call(block.fields, 'SOUND_MENU')) {
            return block.fields.SOUND_MENU;
        }
        return null;
    }

    /**
     * Helper function to retrieve an asset menu field from a block given its id.
     * @param {string} blockId A unique identifier for a block
     * @return {?object} The asset menu field of the block with the given block id.
     * Null, if either a block with the given id doesn't exist or if an asset menu field
     * does not exist on the block with the given id.
     */
    _getAssetField (blockId) {
        const block = this.getBlock(blockId);
        if (block && Object.prototype.hasOwnProperty.call(block.fields, 'ASSET_MENU')) {
            return block.fields.ASSET_MENU;
        }
        return null;
    }

    /**
     * Helper function to retrieve a backdrop menu field from a block given its id.
     * @param {string} blockId A unique identifier for a block
     * @return {?object} The backdrop menu field of the block with the given block id.
     * Null, if either a block with the given id doesn't exist or if a backdrop menu field
     * does not exist on the block with the given id.
     */
    _getBackdropField (blockId) {
        const block = this.getBlock(blockId);
        if (block && Object.prototype.hasOwnProperty.call(block.fields, 'BACKDROP')) {
            return block.fields.BACKDROP;
        }
        return null;
    }

    /**
     * Helper function to retrieve a sprite menu field from a block given its id.
     * @param {string} blockId A unique identifier for a block
     * @return {?object} The sprite menu field of the block with the given block id.
     * Null, if either a block with the given id doesn't exist or if a sprite menu field
     * does not exist on the block with the given id.
     */
    _getSpriteField (blockId) {
        const block = this.getBlock(blockId);
        if (!block) {
            return null;
        }
        const spriteMenuNames = ['TOWARDS', 'TO', 'OBJECT', 'VIDEOONMENU2',
            'DISTANCETOMENU', 'TOUCHINGOBJECTMENU', 'CLONE_OPTION'];
        for (let i = 0; i < spriteMenuNames.length; i++) {
            const menuName = spriteMenuNames[i];
            if (Object.prototype.hasOwnProperty.call(block.fields, menuName)) {
                return block.fields[menuName];
            }
        }
        return null;
    }

    // ---------------------------------------------------------------------

    /**
     * Encode all of `this._blocks` as an XML string usable
     * by a Blockly/scratch-blocks workspace.
     * @param {object<string, Comment>} comments Map of comments referenced by id
     * @return {string} String of XML representing this object's blocks.
     */
    toXML (comments) {
        return this._scripts.map(script => this.blockToXML(script, comments)).join();
    }

    /**
     * Recursively encode an individual block and its children
     * into a Blockly/scratch-blocks XML string.
     * @param {!string} blockId ID of block to encode.
     * @param {object<string, Comment>} comments Map of comments referenced by id
     * @return {string} String of XML representing this block and any children.
     */
    blockToXML (blockId, comments) {
        const block = this._blocks[blockId];
        // block should exist, but currently some blocks' next property point
        // to a blockId for non-existent blocks. Until we track down that behavior,
        // this early exit allows the project to load.
        if (!block) return;
        // Encode properties of this block.
        const tagName = (block.shadow) ? 'shadow' : 'block';
        let xmlString =
            `<${tagName}
                id="${xmlEscape(block.id)}"
                type="${xmlEscape(block.opcode)}"
                ${block.topLevel ? `x="${block.x}" y="${block.y}"` : ''}
                ${block.collapsed ? 'collapsed="true"' : ''}
            >`;
        const commentId = block.comment;
        if (commentId) {
            if (comments) {
                if (Object.prototype.hasOwnProperty.call(comments, commentId)) {
                    xmlString += comments[commentId].toXML();
                } else {
                    log.warn(`Could not find comment with id: ${commentId} in provided comment descriptions.`);
                }
            } else {
                log.warn(`Cannot serialize comment with id: ${commentId}; no comment descriptions provided.`);
            }
        }
        // Add any mutation. Must come before inputs.
        if (block.mutation) {
            xmlString += this.mutationToXML(block.mutation);
        }
        // Add any fields on this block.
        for (const field in block.fields) {
            if (!Object.prototype.hasOwnProperty.call(block.fields, field)) continue;
            const blockField = block.fields[field];
            xmlString += `<field name="${xmlEscape(blockField.name)}"`;
            const fieldId = blockField.id;
            if (fieldId) {
                xmlString += ` id="${xmlEscape(fieldId)}"`;
            }
            const varType = blockField.variableType;
            if (typeof varType === 'string') {
                xmlString += ` variabletype="${xmlEscape(varType)}"`;
            }
            let value = blockField.value;
            if (typeof value === 'string') {
                value = xmlEscape(blockField.value);
            }
            xmlString += `>${value}</field>`;
        }
        // Add any inputs on this block.
        for (const input in block.inputs) {
            if (!Object.prototype.hasOwnProperty.call(block.inputs, input)) continue;
            const blockInput = block.inputs[input];
            // Only encode a value tag if the value input is occupied.
            if (blockInput.block || blockInput.shadow) {
                xmlString += `<value name="${xmlEscape(blockInput.name)}">`;
                if (blockInput.block) {
                    xmlString += this.blockToXML(blockInput.block, comments);
                }
                if (blockInput.shadow && blockInput.shadow !== blockInput.block) {
                    // Obscured shadow.
                    xmlString += this.blockToXML(blockInput.shadow, comments);
                }
                xmlString += '</value>';
            }
        }
        // Add blocks connected to the next connection.
        if (block.next) {
            xmlString += `<next>${this.blockToXML(block.next, comments)}</next>`;
        }
        xmlString += `</${tagName}>`;
        return xmlString;
    }

    /**
     * Recursively encode a mutation object to XML.
     * @param {!object} mutation Object representing a mutation.
     * @return {string} XML string representing a mutation.
     */
    mutationToXML (mutation) {
        let mutationString = `<${mutation.tagName}`;
        for (const prop in mutation) {
            if (prop === 'children' || prop === 'tagName') continue;
            let mutationValue = (typeof mutation[prop] === 'string') ?
                xmlEscape(mutation[prop]) : mutation[prop];

            // Handle dynamic extension blocks
            if (prop === 'blockInfo') {
                mutationValue = xmlEscape(JSON.stringify(mutation[prop]));
            }

            mutationString += ` ${prop}="${mutationValue}"`;
        }
        mutationString += '>';
        for (let i = 0; i < mutation.children.length; i++) {
            mutationString += this.mutationToXML(mutation.children[i]);
        }
        mutationString += `</${mutation.tagName}>`;
        return mutationString;
    }

    // ---------------------------------------------------------------------
    /**
     * Helper to serialize block fields and input fields for reporting new monitors
     * @param {!object} block Block to be paramified.
     * @return {!object} object of param key/values.
     */
    _getBlockParams (block) {
        const params = {};
        for (const key in block.fields) {
            params[key] = block.fields[key].value;
        }
        for (const inputKey in block.inputs) {
            const inputBlock = this._blocks[block.inputs[inputKey].block];
            for (const key in inputBlock.fields) {
                params[key] = inputBlock.fields[key].value;
            }
        }
        return params;
    }

    /**
     * Helper to get the corresponding internal procedure definition block
     * @param {!object} defineBlock Outer define block.
     * @return {!object} internal definition block which has the mutation.
     */
    _getCustomBlockInternal (defineBlock) {
        if (defineBlock.inputs && defineBlock.inputs.custom_block) {
            return this._blocks[defineBlock.inputs.custom_block.block];
        }
    }

    /**
     * Helper to add a stack to `this._scripts`.
     * @param {?string} topBlockId ID of block that starts the script.
     */
    _addScript (topBlockId) {
        const i = this._scripts.indexOf(topBlockId);
        if (i > -1) return; // Already in scripts.
        this._scripts.push(topBlockId);
        // Update `topLevel` property on the top block.
        this._blocks[topBlockId].topLevel = true;
    }

    /**
     * Helper to remove a script from `this._scripts`.
     * @param {?string} topBlockId ID of block that starts the script.
     */
    _deleteScript (topBlockId) {
        const i = this._scripts.indexOf(topBlockId);
        if (i > -1) this._scripts.splice(i, 1);
        // Update `topLevel` property on the top block.
        if (this._blocks[topBlockId]) this._blocks[topBlockId].topLevel = false;
    }
}

/**
 * A private method shared with execute to build an object containing the block
 * information execute needs and that is reset when other cached Blocks info is
 * reset.
 * @param {Blocks} blocks Blocks containing the expected blockId
 * @param {string} blockId blockId for the desired execute cache
 * @param {function} CacheType constructor for cached block information
 * @return {object} execute cache object
 */
BlocksExecuteCache.getCached = function (blocks, blockId, CacheType) {
    let cached = blocks._cache._executeCached[blockId];
    if (typeof cached !== 'undefined') {
        return cached;
    }

    const block = blocks.getBlock(blockId);
    if (typeof block === 'undefined') return null;

    if (typeof CacheType === 'undefined') {
        cached = {
            id: blockId,
            opcode: blocks.getOpcode(block),
            fields: blocks.getFields(block),
            inputs: blocks.getInputs(block),
            mutation: blocks.getMutation(block)
        };
    } else {
        cached = new CacheType(blocks, {
            id: blockId,
            opcode: blocks.getOpcode(block),
            fields: blocks.getFields(block),
            inputs: blocks.getInputs(block),
            mutation: blocks.getMutation(block)
        });
    }

    blocks._cache._executeCached[blockId] = cached;
    return cached;
};

/**
 * Cache class constructor for runtime. Used to consider what threads should
 * start based on hat data.
 * @type {function}
 */
const RuntimeScriptCache = BlocksRuntimeCache._RuntimeScriptCache;

/**
 * Get an array of scripts from a block container prefiltered to match opcode.
 * @param {Blocks} blocks - Container of blocks
 * @param {string} opcode - Opcode to filter top blocks by
 * @returns {Array.<RuntimeScriptCache>} - Array of RuntimeScriptCache cache
 *   objects
 */
BlocksRuntimeCache.getScripts = function (blocks, opcode) {
    let scripts = blocks._cache.scripts[opcode];
    if (!scripts) {
        scripts = blocks._cache.scripts[opcode] = [];

        const allScripts = blocks._scripts;
        for (let i = 0; i < allScripts.length; i++) {
            const topBlockId = allScripts[i];
            const block = blocks.getBlock(topBlockId);
            if (block.opcode === opcode) {
                scripts.push(new RuntimeScriptCache(blocks, topBlockId));
            }
        }
    }
    return scripts;
};

module.exports = Blocks;
