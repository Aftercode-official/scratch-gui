const Color = require('../util/color');

/**
 * @fileoverview
 * Utilities for casting and comparing Scratch data-types.
 * Scratch behaves slightly differently from JavaScript in many respects,
 * and these differences should be encapsulated below.
 * For example, in Scratch, add(1, join("hello", world")) -> 1.
 * This is because "hello world" is cast to 0.
 * In JavaScript, 1 + Number("hello" + "world") would give you NaN.
 * Use when coercing a value before computation.
 */

/**
 * Used internally by compare()
 * @param {*} val A value that evaluates to 0 in JS string-to-number conversation such as empty string, 0, or tab.
 * @returns {boolean} True if the value should not be treated as the number zero.
 */
const isNotActuallyZero = val => {
    if (typeof val !== 'string') return false;
    for (let i = 0; i < val.length; i++) {
        const code = val.charCodeAt(i);
        // '0'.charCodeAt(0) === 48
        // '\t'.charCodeAt(0) === 9
        // We include tab for compatibility with scratch-www's broken trim() polyfill.
        // https://github.com/TurboWarp/scratch-vm/issues/115
        // https://scratch.mit.edu/projects/788261699/
        if (code === 48 || code === 9) {
            return false;
        }
    }
    return true;
};

class Cast {
    /**
     * Scratch cast to number.
     * Treats NaN as 0.
     * In Scratch 2.0, this is captured by `interp.numArg.`
     * @param {*} value Value to cast to number.
     * @return {number} The Scratch-casted number value.
     */
    static toNumber (value) {
        // If value is already a number we don't need to coerce it with
        // Number().
        if (typeof value === 'number') {
            // Scratch treats NaN as 0, when needed as a number.
            // E.g., 0 + NaN -> 0.
            if (Number.isNaN(value)) {
                return 0;
            }
            return value;
        }
        const n = Number(value);
        if (Number.isNaN(n)) {
            // Scratch treats NaN as 0, when needed as a number.
            // E.g., 0 + NaN -> 0.
            return 0;
        }
        return n;
    }

    /**
     * Scratch cast to boolean.
     * In Scratch 2.0, this is captured by `interp.boolArg.`
     * Treats some string values differently from JavaScript.
     * @param {*} value Value to cast to boolean.
     * @return {boolean} The Scratch-casted boolean value.
     */
    static toBoolean (value) {
        // Already a boolean?
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            // These specific strings are treated as false in Scratch.
            if ((value === '') ||
                (value === '0') ||
                (value.toLowerCase() === 'false')) {
                return false;
            }
            // All other strings treated as true.
            return true;
        }
        // Coerce other values and numbers.
        return Boolean(value);
    }

    /**
     * Scratch cast to string.
     * @param {*} value Value to cast to string.
     * @return {string} The Scratch-casted string value.
     */
    static toString (value) {
        if (typeof value === 'undefined' || value === null) {
            return String();
        } else if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (e) {
                // Think fast, chucklenuts!
            }
        }
        return String(value);
    }

    /**
     * Scratch cast to object.
     * @param {*} value Value to cast to object.
     * @param {?boolean} [nullSafe] Is null allowed.
     * @return {object} The Scratch-casted object value.
     */
    static toObject (value, nullSafe) {
        if (typeof value === 'object') {
            if (value === null) {
                if (nullSafe) return null;
                return new Object();
            }
            if (Array.isArray(value)) return new Object();
            return value;
        }
        try {
            return Cast.toObject(JSON.parse(value));
        } catch {
            return new Object();
        }
    }

    /**
     * Scratch cast to array.
     * @param {*} value Value to cast to array.
     * @return {array} The Scratch-casted array value.
     */
    static toArray (value) {
        if (Array.isArray(value)) return value;
        try {
            if (typeof value === 'string') {
                return Cast.toArray(JSON.parse(value));
            }
            return Array.from(value);
        } catch {
            return new Array();
        }
    }

    /**
     * Cast any Scratch argument to an RGB color array to be used for the renderer.
     * @param {*} value Value to convert to RGB color array.
     * @return {Array.<number>} [r,g,b], values between 0-255.
     */
    static toRgbColorList (value) {
        const color = Cast.toRgbColorObject(value);
        return [color.r, color.g, color.b];
    }

    /**
     * Cast any Scratch argument to an RGB color object to be used for the renderer.
     * @param {*} value Value to convert to RGB color object.
     * @return {RGBOject} [r,g,b], values between 0-255.
     */
    static toRgbColorObject (value) {
        let color;
        if (typeof value === 'string' && value.substring(0, 1) === '#') {
            color = Color.hexToRgb(value);

            // If the color wasn't *actually* a hex color, cast to black
            if (!color) color = {r: 0, g: 0, b: 0, a: 255};
        } else {
            color = Color.decimalToRgb(Cast.toNumber(value));
        }
        return color;
    }

    /**
     * Scratch cast to Float32Array.
     * @param {*} value Value to cast to Float32Array.
     * @return {Float32Array} The casted Float32Array value.
     */
    static toFloat32Array (value) {
        if (value instanceof Float32Array) return value;
        return new Float32Array(Cast.toArray(value));
    }

    /**
     * Determine if a Scratch argument is a white space string (or null / empty).
     * @param {*} val value to check.
     * @return {boolean} True if the argument is all white spaces or null / empty.
     */
    static isWhiteSpace (val) {
        return val === null || (typeof val === 'string' && val.trim().length === 0);
    }

    /**
     * Compare two values, using Scratch cast, case-insensitive string compare, etc.
     * In Scratch 2.0, this is captured by `interp.compare.`
     * @param {*} v1 First value to compare.
     * @param {*} v2 Second value to compare.
     * @returns {number} Negative number if v1 < v2; 0 if equal; positive otherwise.
     */
    static compare (v1, v2) {
        let n1 = Number(v1);
        let n2 = Number(v2);
        if (n1 === 0 && isNotActuallyZero(v1)) {
            n1 = NaN;
        } else if (n2 === 0 && isNotActuallyZero(v2)) {
            n2 = NaN;
        }
        if (isNaN(n1) || isNaN(n2)) {
            // At least one argument can't be converted to a number.
            // Scratch compares strings as case insensitive.
            const s1 = String(v1).toLowerCase();
            const s2 = String(v2).toLowerCase();
            if (s1 < s2) {
                return -1;
            } else if (s1 > s2) {
                return 1;
            }
            return 0;
        }
        // Handle the special case of Infinity
        if (
            (n1 === Infinity && n2 === Infinity) ||
            (n1 === -Infinity && n2 === -Infinity)
        ) {
            return 0;
        }
        // Compare as numbers.
        return n1 - n2;
    }

    /**
     * Determine if a Scratch argument number represents a round integer.
     * @param {*} val Value to check.
     * @return {boolean} True if number looks like an integer.
     */
    static isInt (val) {
        // Values that are already numbers.
        if (typeof val === 'number') {
            if (isNaN(val)) { // NaN is considered an integer.
                return true;
            }
            // True if it's "round" (e.g., 2.0 and 2).
            return val === Math.floor(val);
        } else if (typeof val === 'boolean') {
            // `True` and `false` always represent integer after Scratch cast.
            return true;
        } else if (typeof val === 'string') {
            // If it contains a decimal point, don't consider it an int.
            return val.indexOf('.') < 0;
        }
        return false;
    }

    static get LIST_INVALID () {
        return 'INVALID';
    }

    static get LIST_ALL () {
        return 'ALL';
    }

    /**
     * Compute a 1-based index into a list, based on a Scratch argument.
     * Two special cases may be returned:
     * LIST_ALL: if the block is referring to all of the items in the list.
     * LIST_INVALID: if the index was invalid in any way.
     * @param {*} index Scratch arg, including 1-based numbers or special cases.
     * @param {number} length Length of the list.
     * @param {boolean} acceptAll Whether it should accept "all" or not.
     * @return {(number|string)} 1-based index for list, LIST_ALL, or LIST_INVALID.
     */
    static toListIndex (index, length, acceptAll) {
        if (typeof index !== 'number') {
            if (index === 'all') {
                return acceptAll ? Cast.LIST_ALL : Cast.LIST_INVALID;
            }
            if (index === 'last') {
                if (length > 0) {
                    return length;
                }
                return Cast.LIST_INVALID;
            } else if (index === 'random' || index === 'any') {
                if (length > 0) {
                    return 1 + Math.floor(Math.random() * length);
                }
                return Cast.LIST_INVALID;
            }
        }
        index = Math.floor(Cast.toNumber(index));
        if (index < 1 || index > length) {
            return Cast.LIST_INVALID;
        }
        return index;
    }

    /**
     * Compute a 0-based index into an array, based on a block argument.
     * Returns Cast.LIST_INVALID if the index was invalid in any way.
     * @param {*} index Arg, including 0-based numbers or special cases ("last", "random").
     * @param {number} length Length of the array.
     * @return {(number|string)} 0-based index for array, or LIST_INVALID.
     */
    static toArrayIndex (index, length) {
        if (typeof index !== 'number') {
            if (index === 'last') {
                if (length > 0) {
                    return length - 1;
                }
                return Cast.LIST_INVALID;
            } else if (index === 'random') {
                if (length > 0) {
                    return Math.floor(Math.random() * length);
                }
                return Cast.LIST_INVALID;
            }
        }
        index = Math.floor(Cast.toNumber(index));
        if (index < 0 || index >= length) {
            return Cast.LIST_INVALID;
        }
        return index;
    }

    /**
     * Get the number of rows in a table.
     * @param {Array} table The table value array.
     * @return {number} Number of rows in the table.
     */
    static getTableRowCount (table) {
        return Array.isArray(table) ? table.length : 0;
    }

    /**
     * Get the number of columns in a table (from the first row).
     * @param {Array} table The table value array.
     * @return {number} Number of columns in the table.
     */
    static getTableColumnCount (table) {
        if (!Array.isArray(table) || table.length === 0) {
            return 0;
        }
        return Array.isArray(table[0]) ? table[0].length : 0;
    }

    /**
     * Compute a 1-based row index into a table, based on a Scratch argument.
     * @param {*} index Scratch arg, including 1-based numbers or special cases.
     * @param {Array} table The table value array.
     * @param {boolean} acceptAll Whether it should accept "all" or not.
     * @return {(number|string)} 1-based index for table row, LIST_ALL, or LIST_INVALID.
     */
    static toTableRowIndex (index, table, acceptAll) {
        const rowCount = Cast.getTableRowCount(table);
        return Cast.toListIndex(index, rowCount, acceptAll);
    }

    /**
     * Compute a 1-based column index into a table, based on a Scratch argument.
     * @param {*} index Scratch arg, including 1-based numbers or special cases.
     * @param {Array} table The table value array.
     * @param {boolean} acceptAll Whether it should accept "all" or not.
     * @return {(number|string)} 1-based index for table column, LIST_ALL, or LIST_INVALID.
     */
    static toTableColumnIndex (index, table, acceptAll) {
        const columnCount = Cast.getTableColumnCount(table);
        return Cast.toListIndex(index, columnCount, acceptAll);
    }
}

module.exports = Cast;
