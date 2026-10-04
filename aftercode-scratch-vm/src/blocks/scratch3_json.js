const Cast = require('../util/cast');
const execute = require('../engine/execute');

class Scratch3JSONBlocks {
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
            json_new_object: this.newObject,
            json_object: this.object,
            json_get_properties: this.getProperties,
            json_value_of_key: this.valueOfKey,
            json_set_key: this.setKey,
            json_delete_key: this.deleteKey,
            json_merge_object: this.mergeObject,
            json_has_key: this.hasKey,
            json_new_array: this.newArray,
            json_array: this.array,
            json_value_of_index: this.valueOfIndex,
            json_index_of_value: this.indexOfValue,
            json_add_item: this.addItem,
            json_replace_index: this.replaceIndex,
            json_delete_index: this.deleteIndex,
            json_delete_all_occurrences: this.deleteAllOccurrences,
            json_merge_array: this.mergeArray,
            json_has_item: this.hasItem,
            json_array_length: this.arrayLength,
            json_slice_array: this.sliceArray,
            json_reverse_array: this.reverseArray,
            json_split: this.split,
            json_foreach: this.forEach,
            json_foreach_value: this.forEachValue,
            json_foreach_index: this.forEachIndex,
            json_map: this.map,
            json_map_value: this.mapValue,
            json_map_index: this.mapIndex,
            json_filter: this.filter,
            json_filter_value: this.filterValue,
            json_filter_index: this.filterIndex,
            json_sort: this.sort,
            json_sort_a: this.sortA,
            json_sort_b: this.sortB
        };
    }

    newObject () {
        return new Object();
    }

    object (args, util) {
        const keys = util.extendableToArray(args, 'ITEMS', 'KEY');
        const vals = util.extendableToArray(args, 'ITEMS', 'VALUE');
        return Object.fromEntries(keys.map((key, i) => [key, vals[i]]));
    }

    getProperties (args) {
        const obj = Cast.toObject(args.OBJ);
        const property = args.PROPERTY;

        switch (property) {
        case 'keys':
            return Object.keys(obj);
        case 'values':
            return Object.values(obj);
        case 'entries':
            return Object.entries(obj);
        default:
            return new Array();
        }
    }

    valueOfKey (args) {
        const obj = Cast.toObject(args.OBJ);
        const key = Cast.toString(args.KEY);
        return obj[key] ?? '';
    }

    setKey (args) {
        const obj = {...Cast.toObject(args.OBJ)};
        const key = Cast.toString(args.KEY);
        obj[key] = args.VALUE;
        return obj;
    }

    deleteKey (args) {
        const obj = {...Cast.toObject(args.OBJ)};
        const key = Cast.toString(args.KEY);
        delete obj[key];
        return obj;
    }

    mergeObject (args, util) {
        const objs = util.extendableToArray(args, 'ITEMS', 'ITEM');
        return objs.reduce((acc, obj) => ({...acc, ...Cast.toObject(obj)}), {});
    }

    hasKey (args) {
        const obj = Cast.toObject(args.OBJ);
        const key = Cast.toString(args.KEY);
        return Object.hasOwn(obj, key);
    }

    newArray () {
        return [];
    }

    array (args, util) {
        return [...util.extendableToArray(args, 'ITEMS', 'ITEM')];
    }

    valueOfIndex (args) {
        const arr = Cast.toArray(args.ARR);
        const i = Cast.toArrayIndex(args.INDEX, arr.length);
        if (i === Cast.LIST_INVALID) return '';
        return arr[i] ?? '';
    }

    indexOfValue (args) {
        const arr = Cast.toArray(args.ARR);
        return arr.indexOf(args.VALUE) === -1 ? '' : arr.indexOf(args.VALUE);
    }

    addItem (args, util) {
        const arr = [...Cast.toArray(args.ARR)];
        arr.push(...util.extendableToArray(args, 'ITEMS', 'ITEM'));
        return arr;
    }

    replaceIndex (args) {
        const arr = [...Cast.toArray(args.ARR)];
        const i = Cast.toArrayIndex(args.INDEX, arr.length);
        if (i === Cast.LIST_INVALID) return arr;
        arr[i] = args.ITEM;
        return arr;
    }

    deleteIndex (args) {
        const arr = [...Cast.toArray(args.ARR)];
        const i = Cast.toArrayIndex(args.INDEX, arr.length);
        if (i === Cast.LIST_INVALID) return arr;
        arr.splice(i, 1);
        return arr;
    }

    deleteAllOccurrences (args) {
        const arr = Cast.toArray(args.ARR);
        const item = Cast.toString(args.ITEM);
        return arr.filter(e => e !== item);
    }

    mergeArray (args, util) {
        const arrays = util.extendableToArray(args, 'ITEMS', 'ITEM');
        return [].concat(...arrays.map(a => Cast.toArray(a)));
    }

    hasItem (args) {
        const arr = Cast.toArray(args.ARR);
        return arr.includes(args.ITEM);
    }

    arrayLength (args) {
        const arr = Cast.toArray(args.ARR);
        return arr.length;
    }

    sliceArray (args) {
        const arr = [...Cast.toArray(args.ARR)];
        const s = Cast.toArrayIndex(args.START, arr.length);
        const e = Cast.toArrayIndex(args.END, arr.length);
        if (s === Cast.LIST_INVALID || e === Cast.LIST_INVALID || e < s) return [];
        return arr.slice(s, e + 1);
    }

    reverseArray (args) {
        return [...Cast.toArray(args.ARR)].reverse();
    }

    split (args) {
        const delimiter = Cast.toString(args.DELIMITER);
        if (args.MODE === 'JOIN') {
            return Cast.toArray(args.INPUT).join(delimiter);
        }
        return Cast.toString(args.INPUT).split(delimiter);
    }

    forEachValue (args, util) {
        const frames = util.thread.stackFrames;
        for (let i = frames.length - 1; i >= 0; i--) {
            if (typeof frames[i].jsonForeachState !== 'undefined') {
                return frames[i].jsonForeachState?.value ?? '';
            }
        }
        return '';
    }

    forEachIndex (args, util) {
        const frames = util.thread.stackFrames;
        for (let i = frames.length - 1; i >= 0; i--) {
            if (typeof frames[i].jsonForeachState !== 'undefined') {
                return frames[i].jsonForeachState?.index ?? 0;
            }
        }
        return 0;
    }

    forEach (args, util) {
        const {stackFrame} = util;

        if (typeof stackFrame.index === 'undefined') {
            const array = Cast.toArray(args.ARRAY);
            if (array.length === 0) return [];
            Object.assign(stackFrame, {
                index: 0,
                array: [...array]
            });
        }

        if (stackFrame.index >= stackFrame.array.length) {
            delete stackFrame.jsonForeachState;
            return;
        }

        stackFrame.jsonForeachState = {
            value: stackFrame.array[stackFrame.index],
            index: stackFrame.index
        };
        stackFrame.index++;
        util.startBranch(1, true);
    }

    _getMethodBlockId (util) {
        const {thread} = util;
        const currentFrame = thread.peekStackFrame();
        const currentOperation = currentFrame && currentFrame.op;
        const currentBlockId = currentOperation ? currentOperation.id : thread.peekStack();
        const blockContainer = thread.blockContainer || thread.target.blocks;
        const currentBlock = blockContainer.getBlock(currentBlockId);
        return currentBlock && currentBlock.inputs.METHOD ? currentBlock.inputs.METHOD.block : null;
    }

    _evaluateMethod (sequencer, thread, methodBlockId, context) {
        return execute.evaluateReporter(sequencer, thread, methodBlockId, context);
    }

    mapValue (args, util) {
        const contexts = util.thread.jsonMapContexts;
        if (contexts && contexts.length > 0) {
            return contexts[contexts.length - 1].value ?? '';
        }
        return '';
    }

    mapIndex (args, util) {
        const contexts = util.thread.jsonMapContexts;
        if (contexts && contexts.length > 0) {
            return contexts[contexts.length - 1].index ?? '';
        }
        return '';
    }

    async map (args, util) {
        const {thread, sequencer} = util;
        const array = Cast.toArray(args.ARRAY);
        const methodBlockId = this._getMethodBlockId(util);
        const parentContexts = thread.jsonMapContexts || [];
        const result = [];

        for (let index = 0; index < array.length; index++) {
            const jsonMapContexts = parentContexts.concat({value: array[index], index});
            const value = await this._evaluateMethod(sequencer, thread, methodBlockId, {jsonMapContexts});
            if (thread.status === 4 /* STATUS_DONE */) return result;
            result.push(value ?? '');
        }
        return result;
    }

    filterValue (args, util) {
        const contexts = util.thread.jsonFilterContexts;
        if (contexts && contexts.length > 0) {
            return contexts[contexts.length - 1].value ?? '';
        }
        return '';
    }

    filterIndex (args, util) {
        const contexts = util.thread.jsonFilterContexts;
        if (contexts && contexts.length > 0) {
            return contexts[contexts.length - 1].index ?? '';
        }
        return '';
    }

    async filter (args, util) {
        const {thread, sequencer} = util;
        const array = Cast.toArray(args.ARRAY);
        const methodBlockId = this._getMethodBlockId(util);
        const parentContexts = thread.jsonFilterContexts || [];
        const result = [];

        for (let index = 0; index < array.length; index++) {
            const jsonFilterContexts = parentContexts.concat({value: array[index], index});
            const value = await this._evaluateMethod(sequencer, thread, methodBlockId, {jsonFilterContexts});
            if (thread.status === 4 /* STATUS_DONE */) return result;
            if (Cast.toBoolean(value)) result.push(array[index]);
        }
        return result;
    }

    sortA (args, util) {
        const contexts = util.thread.jsonSortContexts;
        if (contexts && contexts.length > 0) {
            return contexts[contexts.length - 1].a ?? '';
        }
        return '';
    }

    sortB (args, util) {
        const contexts = util.thread.jsonSortContexts;
        if (contexts && contexts.length > 0) {
            return contexts[contexts.length - 1].b ?? '';
        }
        return '';
    }

    async sort (args, util) {
        const {thread, sequencer} = util;
        const array = Cast.toArray(args.ARRAY);
        const methodBlockId = this._getMethodBlockId(util);
        const parentContexts = thread.jsonSortContexts || [];
        let result = array.map((value, index) => ({value, index}));

        for (let width = 1; width < result.length; width *= 2) {
            const merged = [];
            for (let start = 0; start < result.length; start += width * 2) {
                const middle = Math.min(start + width, result.length);
                const end = Math.min(start + (width * 2), result.length);
                let left = start;
                let right = middle;

                while (left < middle && right < end) {
                    const jsonSortContexts = parentContexts.concat({
                        a: result[left].value,
                        b: result[right].value
                    });
                    const comparison = await this._evaluateMethod(
                        sequencer,
                        thread,
                        methodBlockId,
                        {jsonSortContexts}
                    );
                    if (thread.status === 4 /* STATUS_DONE */) return result.map(item => item.value);
                    if (Cast.toNumber(comparison) <= 0) {
                        merged.push(result[left++]);
                    } else {
                        merged.push(result[right++]);
                    }
                }
                merged.push(...result.slice(left, middle), ...result.slice(right, end));
            }
            result = merged;
        }

        return result.map(item => item.value);
    }
}

module.exports = Scratch3JSONBlocks;
