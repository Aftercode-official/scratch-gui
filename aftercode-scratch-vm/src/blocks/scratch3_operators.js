const Cast = require('../util/cast.js');
const MathUtil = require('../util/math-util.js');

class Scratch3OperatorsBlocks {
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
            operator_add: this.add,
            operator_subtract: this.subtract,
            operator_multiply: this.multiply,
            operator_divide: this.divide,
            operator_add_extendable: this.addExtendable,
            operator_subtract_extendable: this.subtractExtendable,
            operator_multiply_extendable: this.multiplyExtendable,
            operator_divide_extendable: this.divideExtendable,
            operator_power: this.power,
            operator_lt: this.lt,
            operator_equals: this.equals,
            operator_gt: this.gt,
            operator_lt_extendable: this.ltExtendable,
            operator_equals_extendable: this.equalsExtendable,
            operator_gt_extendable: this.gtExtendable,
            operator_lte: this.lte,
            operator_gte: this.gte,
            operator_and: this.and,
            operator_or: this.or,
            operator_and_extendable: this.andExtendable,
            operator_or_extendable: this.orExtendable,
            operator_xor_extendable: this.xorExtendable,
            operator_not: this.not,
            operator_random: this.random,
            operator_join: this.join,
            operator_join_extendable: this.joinExtendable,
            operator_letter_of: this.letterOf,
            operator_letters_in: this.lettersIn,
            operator_length: this.length,
            operator_contains: this.contains,
            operator_mod: this.mod,
            operator_round: this.round,
            operator_mathop: this.mathop,
            operator_constant: this.constant,
            operator_cast: this.cast,
            operator_typeof: this.typeof,
            checkbox: this.checkbox
        };
    }

    checkbox () {
        return true;
    }

    add (args) {
        return Cast.toNumber(args.NUM1) + Cast.toNumber(args.NUM2);
    }

    subtract (args) {
        return Cast.toNumber(args.NUM1) - Cast.toNumber(args.NUM2);
    }

    multiply (args) {
        return Cast.toNumber(args.NUM1) * Cast.toNumber(args.NUM2);
    }

    divide (args) {
        return Cast.toNumber(args.NUM1) / Cast.toNumber(args.NUM2);
    }

    addExtendable (args, util) {
        const arr = util.extendableToArray(args, 'NUMS', 'NUM');
        return arr.reduce((a, b) => Cast.toNumber(a) + Cast.toNumber(b));
    }

    subtractExtendable (args, util) {
        const arr = util.extendableToArray(args, 'NUMS', 'NUM');
        return arr.reduce((a, b) => Cast.toNumber(a) - Cast.toNumber(b));
    }

    multiplyExtendable (args, util) {
        const arr = util.extendableToArray(args, 'NUMS', 'NUM');
        return arr.reduce((a, b) => Cast.toNumber(a) * Cast.toNumber(b));
    }

    divideExtendable (args, util) {
        const arr = util.extendableToArray(args, 'NUMS', 'NUM');
        return arr.reduce((a, b) => Cast.toNumber(a) / Cast.toNumber(b));
    }

    power (args, util) {
        const arr = util.extendableToArray(args, 'NUMS', 'NUM');
        return arr.reduce((a, b) => Cast.toNumber(a) ** Cast.toNumber(b));
    }

    lt (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) < 0;
    }

    equals (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) === 0;
    }

    gt (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) > 0;
    }

    ltExtendable (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        for (let i = 0; i < arr.length - 1; i++) {
            if (Cast.compare(arr[i], arr[i + 1]) >= 0) return false;
        }
        return true;
    }

    equalsExtendable (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        for (let i = 0; i < arr.length - 1; i++) {
            if (Cast.compare(arr[i], arr[i + 1]) !== 0) return false;
        }
        return true;
    }

    gtExtendable (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        for (let i = 0; i < arr.length - 1; i++) {
            if (Cast.compare(arr[i], arr[i + 1]) <= 0) return false;
        }
        return true;
    }

    lte (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        for (let i = 0; i < arr.length - 1; i++) {
            if (Cast.compare(arr[i], arr[i + 1]) > 0) return false;
        }
        return true;
    }

    gte (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        for (let i = 0; i < arr.length - 1; i++) {
            if (Cast.compare(arr[i], arr[i + 1]) < 0) return false;
        }
        return true;
    }

    and (args) {
        return Cast.toBoolean(args.OPERAND1) && Cast.toBoolean(args.OPERAND2);
    }

    or (args) {
        return Cast.toBoolean(args.OPERAND1) || Cast.toBoolean(args.OPERAND2);
    }

    andExtendable (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        return !arr.some(input => !Cast.toBoolean(input));
    }

    orExtendable (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        return arr.some(Cast.toBoolean);
    }

    xorExtendable (args, util) {
        const arr = util.extendableToArray(args, 'OPERANDS', 'OPERAND');
        return arr.reduce(
            (acc, value) => acc !== Cast.toBoolean(value),
            false
        );
    }

    not (args) {
        return !Cast.toBoolean(args.OPERAND);
    }

    random (args) {
        return this._random(args.FROM, args.TO);
    }
    _random (from, to) { // used by compiler
        const nFrom = Cast.toNumber(from);
        const nTo = Cast.toNumber(to);
        const low = nFrom <= nTo ? nFrom : nTo;
        const high = nFrom <= nTo ? nTo : nFrom;
        if (low === high) return low;
        // If both arguments are ints, truncate the result to an int.
        if (Cast.isInt(from) && Cast.isInt(to)) {
            return low + Math.floor(Math.random() * ((high + 1) - low));
        }
        return (Math.random() * (high - low)) + low;
    }

    join (args) {
        return Cast.toString(args.STRING1) + Cast.toString(args.STRING2);
    }

    joinExtendable (args, util) {
        const arr = util.extendableToArray(args, 'STRINGS', 'STRING');
        return arr.reduce((a, b) => a + Cast.toString(b), '');
    }

    letterOf (args) {
        const index = Cast.toNumber(args.LETTER) - 1;
        const str = Cast.toString(args.STRING);
        // Out of bounds?
        if (index < 0 || index >= str.length) {
            return '';
        }
        return str.charAt(index);
    }

    lettersIn (args) {
        const start = Cast.toNumber(args.START) - 1;
        const end = Cast.toNumber(args.END) - 1;
        const str = Cast.toString(args.STRING);
        if (start > end || start < 0 || start >= str.length) {
            return '';
        }
        const clampedEnd = Math.min(end, str.length - 1);
        return str.substring(start, clampedEnd + 1);
    }

    length (args) {
        return Cast.toString(args.STRING).length;
    }

    contains (args) {
        const format = function (string) {
            return Cast.toString(string).toLowerCase();
        };
        return format(args.STRING1).includes(format(args.STRING2));
    }

    mod (args) {
        const n = Cast.toNumber(args.NUM1);
        const modulus = Cast.toNumber(args.NUM2);
        let result = n % modulus;
        // Scratch mod uses floored division instead of truncated division.
        if (result / modulus < 0) result += modulus;
        return result;
    }

    round (args) {
        return Math.round(Cast.toNumber(args.NUM));
    }

    mathop (args) {
        const operator = Cast.toString(args.OPERATOR).toLowerCase();
        const n = Cast.toNumber(args.NUM);
        switch (operator) {
        case 'abs': return Math.abs(n);
        case 'floor': return Math.floor(n);
        case 'ceiling': return Math.ceil(n);
        case 'sqrt': return Math.sqrt(n);
        case 'sin': return Math.round(Math.sin((Math.PI * n) / 180) * 1e10) / 1e10;
        case 'cos': return Math.round(Math.cos((Math.PI * n) / 180) * 1e10) / 1e10;
        case 'tan': return MathUtil.tan(n);
        case 'asin': return (Math.asin(n) * 180) / Math.PI;
        case 'acos': return (Math.acos(n) * 180) / Math.PI;
        case 'atan': return (Math.atan(n) * 180) / Math.PI;
        case 'ln': return Math.log(n);
        case 'log': return Math.log(n) / Math.LN10;
        case 'e ^': return Math.exp(n);
        case '10 ^': return Math.pow(10, n);
        }
        return 0;
    }

    constant (args) {
        const constant = Cast.toString(args.CONSTANT).toLowerCase();
        switch (constant) {
        case 'pi': return Math.PI;
        case 'e': return Math.E;
        case 'phi': return (1 + Math.sqrt(5)) / 2;
        case 'epsilon': return Number.EPSILON;
        }
        return 0;
    }

    cast (args) {
        const type = Cast.toString(args.TYPE).toLowerCase();
        const value = args.VALUE;
        switch (type) {
        case 'string': return Cast.toString(value);
        case 'number': return Cast.toNumber(value);
        case 'boolean': return Cast.toBoolean(value);
        case 'object': return Cast.toObject(value);
        case 'array': return Cast.toArray(value);
        }
        return value;
    }

    typeof (args) {
        const value = args.VALUE;
        return (Array.isArray(value) ? 'array' : typeof value);
    }
}

module.exports = Scratch3OperatorsBlocks;
