// @ts-check

const Cast = require('../util/cast');
const {StackOpcode, InputOpcode, InputType} = require('./enums');
const {IntermediateInput, IntermediateStack} = require('./intermediate');

/**
 * @typedef {import('./intermediate').IntermediateRepresentation} IntermediateRepresentation
 * @typedef {import('./intermediate').IntermediateScript} IntermediateScript
 * @typedef {import('./intermediate').IntermediateStackBlock} IntermediateStackBlock
 */

/**
 * @param {*} value
 * @returns {InputType}
 */
const constantType = value => {
    if (typeof value === 'number') return IntermediateInput.getNumberInputType(value);
    if (typeof value === 'boolean') return InputType.BOOLEAN;
    if (Array.isArray(value)) return InputType.ARRAY;
    if (value && typeof value === 'object') return InputType.OBJECT;
    const string = String(value);
    const number = +string;
    if (!Number.isNaN(number) && (string.trim() !== '' || string.includes('\t'))) return InputType.STRING_NUM;
    if (string === 'true' || string === 'false') return InputType.STRING_BOOLEAN;
    return InputType.STRING_NAN;
};

/**
 * @param {*} value
 * @param {InputType} [type]
 * @returns {IntermediateInput}
 */
const constant = (value, type = constantType(value)) => new IntermediateInput(InputOpcode.CONSTANT, type, {value});

/**
 * @param {*} input
 * @returns {input is IntermediateInput}
 */
const isConstant = input => input instanceof IntermediateInput && input.opcode === InputOpcode.CONSTANT;

/**
 * @param {IntermediateInput} input
 * @returns {*}
 */
const valueOf = input => input.inputs.value;

// Constant objects are emitted using JSON syntax. Only fold values which round-trip without changing their meaning.
/**
 * @param {*} value
 * @param {Set<object>} [seen]
 * @returns {boolean}
 */
const isSerializableConstant = (value, seen = new Set()) => {
    if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0);
    if (typeof value === 'string' || typeof value === 'boolean' || value === null) return true;
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
    if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, '__proto__')) return false;
    return Object.keys(value).every(key => isSerializableConstant(value[key], seen));
};

/**
 * @param {*} index
 * @param {number} length
 * @returns {?number}
 */
const arrayIndex = (index, length) => {
    if (index === 'last') return length - 1;
    // "random" must stay dynamic even when the array itself is constant.
    if (index === 'random') return null;
    const normalized = (+index || 0) | 0;
    return normalized < 0 || normalized >= length ? -1 : normalized;
};

class IRFolder {
    /**
     * @param {IntermediateRepresentation} ir IR to fold
     */
    constructor (ir) {
        this.ir = ir;
    }

    fold () {
        this.foldScript(this.ir.entry);
        for (const variant of Object.keys(this.ir.procedures)) this.foldScript(this.ir.procedures[variant]);
    }

    /**
     * @param {IntermediateScript} script
     */
    foldScript (script) {
        this.foldStack(script.stack);
    }

    /**
     * @param {*} value
     * @returns {*}
     */
    foldValue (value) {
        if (value instanceof IntermediateInput) return this.foldInput(value);
        if (value instanceof IntermediateStack) {
            this.foldStack(value);
            return value;
        }
        if (Array.isArray(value)) return value.map(item => this.foldValue(item));
        return value;
    }

    /**
     * @param {IntermediateInput} input
     * @returns {IntermediateInput}
     */
    foldInput (input) {
        for (const key of Object.keys(input.inputs)) input.inputs[key] = this.foldValue(input.inputs[key]);
        const node = input.inputs;
        /** @type {(value: *) => IntermediateInput} */
        const finish = value => (typeof value === 'number' && Number.isNaN(value) ? input : constant(value));
        /** @type {(values: IntermediateInput[]) => boolean} */
        const all = values => values.every(isConstant);
        /** @type {(callback: (value: number) => number) => IntermediateInput} */
        const unary = callback => (isConstant(node.value) ? finish(callback(valueOf(node.value))) : input);
        /** @type {(callback: (left: *, right: *) => *) => IntermediateInput} */
        const binary = callback => (all([node.left, node.right]) ?
            finish(callback(valueOf(node.left), valueOf(node.right))) : input);
        /** @type {(callback: (values: *[]) => *) => IntermediateInput} */
        const operands = callback => {
            /** @type {IntermediateInput[] | undefined} */
            const inputOperands = node.operands;
            if (!inputOperands || !all(inputOperands)) return input;
            return finish(callback(inputOperands.map(valueOf)));
        };
        /** @type {(callback: (result: number) => boolean) => IntermediateInput} */
        const comparisons = callback => operands(values => {
            for (let i = 1; i < values.length; i++) {
                if (!callback(Cast.compare(values[i - 1], values[i]))) return false;
            }
            return true;
        });

        switch (input.opcode) {
        case InputOpcode.NOP: return constant('');
        case InputOpcode.CAST_NUMBER:
            if (isConstant(node.target)) return constant(Cast.toNumber(valueOf(node.target)));
            break;
        case InputOpcode.CAST_NUMBER_OR_NAN:
            if (isConstant(node.target)) return finish(+valueOf(node.target));
            break;
        case InputOpcode.CAST_NUMBER_INDEX:
            if (isConstant(node.target)) return constant((+valueOf(node.target)) | 0);
            break;
        case InputOpcode.CAST_STRING:
            if (isConstant(node.target)) return constant(Cast.toString(valueOf(node.target)));
            break;
        case InputOpcode.CAST_BOOLEAN:
            if (isConstant(node.target)) return constant(Cast.toBoolean(valueOf(node.target)));
            break;
        case InputOpcode.CAST_COLOR:
            if (isConstant(node.target)) {
                return constant(Cast.toRgbColorList(valueOf(node.target)), InputType.COLOR);
            }
            break;
        case InputOpcode.CAST_OBJECT:
            if (isConstant(node.target)) {
                const result = Cast.toObject(valueOf(node.target));
                if (isSerializableConstant(result)) return constant(result);
            }
            break;
        case InputOpcode.CAST_ARRAY:
            if (isConstant(node.target)) {
                const result = Cast.toArray(valueOf(node.target));
                if (isSerializableConstant(result)) return constant(result);
            }
            break;
        case InputOpcode.CONTROL_INLINE_IF_ELSE:
            if (isConstant(node.operand)) return valueOf(node.operand) ? node.then : node.else;
            break;
        case InputOpcode.OP_ADD: return binary((left, right) => left + right);
        case InputOpcode.OP_SUBTRACT: return binary((left, right) => left - right);
        case InputOpcode.OP_MULTIPLY: return binary((left, right) => left * right);
        case InputOpcode.OP_DIVIDE: return binary((left, right) => left / right);
        case InputOpcode.OP_MOD: return binary((left, right) => {
            let result = left % right;
            if (result / right < 0) result += right;
            return result;
        });
        case InputOpcode.OP_AND: return binary((left, right) => left && right);
        case InputOpcode.OP_OR: return binary((left, right) => left || right);
        case InputOpcode.OP_NOT:
            if (isConstant(node.operand)) return constant(!valueOf(node.operand));
            break;
        case InputOpcode.OP_EQUALS: return binary((left, right) => Cast.compare(left, right) === 0);
        case InputOpcode.OP_LESS: return binary((left, right) => Cast.compare(left, right) < 0);
        case InputOpcode.OP_GREATER: return binary((left, right) => Cast.compare(left, right) > 0);
        case InputOpcode.OP_JOIN: return binary((left, right) => left + right);
        case InputOpcode.OP_CONTAINS:
            if (all([node.string, node.contains])) {
                return constant(valueOf(node.string).toLowerCase()
                    .includes(valueOf(node.contains).toLowerCase()));
            }
            break;
        case InputOpcode.OP_LENGTH:
            if (isConstant(node.string)) return constant(valueOf(node.string).length);
            break;
        case InputOpcode.OP_LETTER_OF:
            if (all([node.string, node.letter])) return constant(valueOf(node.string)[valueOf(node.letter) - 1] || '');
            break;
        case InputOpcode.OP_LETTERS_IN:
            if (all([node.string, node.start, node.end])) {
                const string = valueOf(node.string);
                const start = valueOf(node.start) - 1;
                const end = valueOf(node.end) - 1;
                return constant(start > end || start < 0 || start >= string.length ? '' :
                    string.substring(start, Math.min(end, string.length - 1) + 1));
            }
            break;
        case InputOpcode.OP_ABS: return unary(Math.abs);
        case InputOpcode.OP_FLOOR: return unary(Math.floor);
        case InputOpcode.OP_CEILING: return unary(Math.ceil);
        case InputOpcode.OP_SQRT: return unary(Math.sqrt);
        case InputOpcode.OP_ROUND: return unary(Math.round);
        case InputOpcode.OP_SIN: return unary(number => Math.round(Math.sin((Math.PI * number) / 180) * 1e10) / 1e10);
        case InputOpcode.OP_COS: return unary(number => Math.round(Math.cos((Math.PI * number) / 180) * 1e10) / 1e10);
        case InputOpcode.OP_TAN: return unary(number => {
            switch (number % 360) {
            case -270: case 90: return Infinity;
            case -90: case 270: return -Infinity;
            default: return Math.round(Math.tan((Math.PI * number) / 180) * 1e10) / 1e10;
            }
        });
        case InputOpcode.OP_ASIN: return unary(number => (Math.asin(number) * 180) / Math.PI);
        case InputOpcode.OP_ACOS: return unary(number => (Math.acos(number) * 180) / Math.PI);
        case InputOpcode.OP_ATAN: return unary(number => (Math.atan(number) * 180) / Math.PI);
        case InputOpcode.OP_LOG_E: return unary(Math.log);
        case InputOpcode.OP_LOG_10: return unary(number => Math.log(number) / Math.LN10);
        case InputOpcode.OP_POW_E: return unary(Math.exp);
        case InputOpcode.OP_POW_10: return unary(number => 10 ** number);
        case InputOpcode.OP_TYPEOF:
            if (isConstant(node.target)) {
                const target = valueOf(node.target);
                return constant(Array.isArray(target) ? 'array' : typeof target);
            }
            break;
        case InputOpcode.OP_ADD_EXTENDABLE: return operands(values => values.reduce((a, b) => a + b, 0));
        case InputOpcode.OP_SUBTRACT_EXTENDABLE:
            return operands(values => (values.length ? values.reduce((a, b) => a - b) : 0));
        case InputOpcode.OP_MULTIPLY_EXTENDABLE:
            return operands(values => (values.length ? values.reduce((a, b) => a * b) : 0));
        case InputOpcode.OP_DIVIDE_EXTENDABLE:
            return operands(values => (values.length ? values.reduce((a, b) => a / b) : 0));
        case InputOpcode.OP_POWER:
            return operands(values => (values.length ? values.reduce((a, b) => a ** b) : 0));
        case InputOpcode.OP_AND_EXTENDABLE: return operands(values => values.reduce((a, b) => a && b, true));
        case InputOpcode.OP_OR_EXTENDABLE: return operands(values => values.reduce((a, b) => a || b, false));
        case InputOpcode.OP_XOR_EXTENDABLE: return operands(values => values.reduce((a, b) => a !== b, false));
        case InputOpcode.OP_JOIN_EXTENDABLE: return operands(values => values.reduce((a, b) => a + b, ''));
        case InputOpcode.OP_LESS_EXTENDABLE: return comparisons(result => result < 0);
        case InputOpcode.OP_EQUALS_EXTENDABLE: return comparisons(result => result === 0);
        case InputOpcode.OP_GREATER_EXTENDABLE: return comparisons(result => result > 0);
        case InputOpcode.OP_LESS_OR_EQUAL_EXTENDABLE: return comparisons(result => result <= 0);
        case InputOpcode.OP_GREATER_OR_EQUAL_EXTENDABLE: return comparisons(result => result >= 0);
        case InputOpcode.JSON_NEW_OBJECT: return constant({});
        case InputOpcode.JSON_NEW_ARRAY: return constant([]);
        case InputOpcode.JSON_OBJECT:
            if (all(node.keys) && all(node.values)) {
                /** @type {IntermediateInput[]} */
                const keys = node.keys;
                /** @type {IntermediateInput[]} */
                const values = node.values;
                const entries = keys.map((key, index) => [valueOf(key), valueOf(values[index])]);
                const result = Object.fromEntries(entries);
                if (isSerializableConstant(result)) return constant(result);
            }
            break;
        case InputOpcode.JSON_ARRAY:
            if (all(node.items)) {
                /** @type {IntermediateInput[]} */
                const items = node.items;
                const result = items.map(valueOf);
                if (isSerializableConstant(result)) return constant(result);
            }
            break;
        default: {
            const jsonResult = this.foldJSON(input);
            if (jsonResult !== null) return jsonResult;
            break;
        }
        }
        return input;
    }

    /**
     * @param {IntermediateInput} input
     * @returns {?IntermediateInput}
     */
    foldJSON (input) {
        const node = input.inputs;
        /** @type {(...names: string[]) => boolean} */
        const has = (...names) => names.every(name => isConstant(node[name]));
        /** @type {(value: *) => ?IntermediateInput} */
        const finish = value => (isSerializableConstant(value) ? constant(value) : null);
        /** @type {() => ?number} */
        const getIndex = () => arrayIndex(valueOf(node.index), valueOf(node.array).length);
        switch (input.opcode) {
        case InputOpcode.JSON_GET_PROPERTIES:
            if (has('object')) {
                if (node.property === 'keys') return finish(Object.keys(valueOf(node.object)));
                if (node.property === 'values') return finish(Object.values(valueOf(node.object)));
                if (node.property === 'entries') return finish(Object.entries(valueOf(node.object)));
                return constant([]);
            }
            break;
        case InputOpcode.JSON_VALUE_OF_KEY:
            if (has('object', 'key')) return finish(valueOf(node.object)[valueOf(node.key)] ?? '');
            break;
        case InputOpcode.JSON_SET_KEY:
            if (has('object', 'key', 'value')) {
                if (valueOf(node.key) === '__proto__') break;
                const result = Object.assign({}, valueOf(node.object));
                result[valueOf(node.key)] = valueOf(node.value);
                return finish(result);
            }
            break;
        case InputOpcode.JSON_DELETE_KEY:
            if (has('object', 'key')) {
                const result = Object.assign({}, valueOf(node.object));
                delete result[valueOf(node.key)];
                return finish(result);
            }
            break;
        case InputOpcode.JSON_MERGE_OBJECT:
            if ((/** @type {IntermediateInput[]} */ (node.items)).every(isConstant)) {
                return finish(Object.assign({}, ...(/** @type {IntermediateInput[]} */ (node.items))
                    .map(item => Cast.toObject(valueOf(item)))));
            }
            break;
        case InputOpcode.JSON_HAS_KEY:
            if (has('object', 'key')) {
                if (typeof valueOf(node.object).hasOwnProperty !== 'function') break;
                return constant(Object.prototype.hasOwnProperty.call(valueOf(node.object), valueOf(node.key)));
            }
            break;
        case InputOpcode.JSON_VALUE_OF_INDEX:
            if (has('array', 'index')) {
                const index = getIndex();
                if (index === null) break;
                return finish(index === -1 ? '' : valueOf(node.array)[index] ?? '');
            }
            break;
        case InputOpcode.JSON_INDEX_OF_VALUE:
            if (has('array', 'value')) {
                const index = valueOf(node.array).indexOf(valueOf(node.value));
                return constant(index === -1 ? '' : index);
            }
            break;
        case InputOpcode.JSON_ADD_ITEM: {
            const items = /** @type {IntermediateInput[]} */ (node.items);
            if (isConstant(node.array) && items.every(isConstant)) {
                return finish(valueOf(node.array).concat(items.map(valueOf)));
            }
            break;
        }
        case InputOpcode.JSON_REPLACE_INDEX:
            if (has('array', 'index', 'item')) {
                const index = getIndex();
                if (index === null) break;
                const result = valueOf(node.array).slice();
                if (index !== -1) result[index] = valueOf(node.item);
                return finish(result);
            }
            break;
        case InputOpcode.JSON_DELETE_INDEX:
            if (has('array', 'index')) {
                const index = getIndex();
                if (index === null) break;
                const result = valueOf(node.array).slice();
                if (index !== -1) result.splice(index, 1);
                return finish(result);
            }
            break;
        case InputOpcode.JSON_DELETE_ALL_OCCURRENCES:
            if (has('array', 'item')) {
                const array = /** @type {*[]} */ (valueOf(node.array));
                return finish(array.filter(item => item !== valueOf(node.item)));
            }
            break;
        case InputOpcode.JSON_MERGE_ARRAY:
            if ((/** @type {IntermediateInput[]} */ (node.items)).every(isConstant)) {
                const arrays = (/** @type {IntermediateInput[]} */ (node.items))
                    .map(item => Cast.toArray(valueOf(item)));
                return finish([].concat(...arrays));
            }
            break;
        case InputOpcode.JSON_HAS_ITEM:
            if (has('array', 'item')) return constant(valueOf(node.array).includes(valueOf(node.item)));
            break;
        case InputOpcode.JSON_ARRAY_LENGTH:
            if (has('array')) return constant(valueOf(node.array).length);
            break;
        case InputOpcode.JSON_SLICE_ARRAY:
            if (has('array', 'start', 'end')) {
                const array = valueOf(node.array);
                const start = arrayIndex(valueOf(node.start), array.length);
                const end = arrayIndex(valueOf(node.end), array.length);
                if (start === null || end === null) break;
                return finish(start === -1 || end === -1 || end < start ? [] : array.slice(start, end + 1));
            }
            break;
        case InputOpcode.JSON_REVERSE_ARRAY:
            if (has('array')) {
                return finish(valueOf(node.array).slice()
                    .reverse());
            }
            break;
        case InputOpcode.JSON_SPLIT:
            if (has('input', 'delimiter')) {
                const delimiter = Cast.toString(valueOf(node.delimiter));
                if (node.mode === 'join') {
                    return finish(Cast.toArray(valueOf(node.input)).join(delimiter));
                }
                return finish(Cast.toString(valueOf(node.input)).split(delimiter));
            }
            break;
        default:
            break;
        }
        return null;
    }

    /**
     * @param {IntermediateStack | null | undefined} stack
     */
    foldStack (stack) {
        if (!stack) return;
        const output = [];
        for (const block of stack.blocks) {
            const inputs = /** @type {Record<string, *>} */ (block.inputs);
            for (const key of Object.keys(inputs)) inputs[key] = this.foldValue(inputs[key]);
            this.foldStructuredStackInputs(block);

            if (block.opcode === StackOpcode.CONTROL_IF_ELSE && isConstant(inputs.condition)) {
                const selected = valueOf(inputs.condition) ? inputs.whenTrue : inputs.whenFalse;
                output.push(...selected.blocks);
                continue;
            }
            if (block.opcode === StackOpcode.CONTROL_REPEAT && isConstant(inputs.times) &&
                valueOf(inputs.times) < 0.5) continue;
            if (block.opcode === StackOpcode.CONTROL_FOR && isConstant(inputs.count) &&
                valueOf(inputs.count) <= 0) continue;
            if (block.opcode === StackOpcode.CONTROL_WHILE && inputs.condition.isConstant(false)) continue;
            if (block.opcode === StackOpcode.CONTROL_WAIT_UNTIL && inputs.condition.isConstant(true)) continue;
            if (block.opcode === StackOpcode.CONTROL_IF_EXTENDABLE ||
                block.opcode === StackOpcode.CONTROL_IF_ELSE_EXTENDABLE) {
                const flattened = this.foldExtendableIf(block);
                if (flattened) {
                    output.push(...flattened.blocks);
                    continue;
                }
                if (inputs.count === 0 && block.opcode === StackOpcode.CONTROL_IF_EXTENDABLE) continue;
            }
            if (block.opcode === StackOpcode.CONTROL_SWITCH) {
                const flattened = this.foldSwitch(block);
                if (flattened) {
                    output.push(...flattened.blocks);
                    continue;
                }
            }
            output.push(block);
        }
        stack.blocks = output;
    }

    /**
     * @param {IntermediateStackBlock} block
     */
    foldStructuredStackInputs (block) {
        const inputs = /** @type {Record<string, *>} */ (block.inputs);
        if (inputs.branches) {
            /** @type {{condition: IntermediateInput, do: IntermediateStack}[]} */
            const branches = inputs.branches;
            for (const branch of branches) {
                branch.condition = this.foldInput(branch.condition);
                this.foldStack(branch.do);
            }
        }
        if (inputs.cases) {
            /** @type {{value: IntermediateInput, do: IntermediateStack}[]} */
            const cases = inputs.cases;
            for (const caseNode of cases) {
                caseNode.value = this.foldInput(caseNode.value);
                this.foldStack(caseNode.do);
            }
        }
    }

    /**
     * @param {IntermediateStackBlock} block
     * @returns {?IntermediateStack}
     */
    foldExtendableIf (block) {
        const inputs = /** @type {Record<string, *>} */ (block.inputs);
        /** @type {{condition: IntermediateInput, do: IntermediateStack}[]} */
        const branches = inputs.branches;
        /** @type {{condition: IntermediateInput, do: IntermediateStack}[]} */
        const kept = [];
        for (const branch of branches) {
            if (branch.condition.isConstant(false)) continue;
            kept.push(branch);
            if (branch.condition.isConstant(true)) break;
        }
        inputs.branches = kept;
        inputs.count = kept.length;
        if (kept.length === 1 && kept[0].condition.isConstant(true)) return kept[0].do;
        if (kept.length === 0 && block.opcode === StackOpcode.CONTROL_IF_ELSE_EXTENDABLE) {
            return inputs.elseBranch;
        }
        return null;
    }

    /**
     * @param {IntermediateStackBlock} block
     * @returns {?IntermediateStack}
     */
    foldSwitch (block) {
        const inputs = /** @type {Record<string, *>} */ (block.inputs);
        /** @type {{value: IntermediateInput, do: IntermediateStack}[]} */
        const cases = inputs.cases;
        if (!isConstant(inputs.switch) || !cases.every(caseNode => isConstant(caseNode.value))) {
            return null;
        }
        const switchValue = valueOf(inputs.switch);
        const selected = cases.find(caseNode => valueOf(caseNode.value) === switchValue);
        return selected ? selected.do : inputs.defaultBranch;
    }
}

module.exports = IRFolder;
