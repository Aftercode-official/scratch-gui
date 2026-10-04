const circularReplacer = () => {
    const seen = new WeakSet();
    return (_, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return Array.isArray(value) ? '[...]' : '{...}';
            }
            seen.add(value);
        }
        return value;
    };
};

/**
 * Safely stringify, properly handling circular relations and -0.
 * @param {unknown} input Any value
 * @returns {string} A stringified version of the input.
 */
const safeStringify = input => {
    if (input !== null) {
        if (input instanceof Float32Array) {
            return JSON.stringify(
                Array.from(input, v => (isFinite(v) ? v : v.toString())),
                circularReplacer()
            );
        }
        if (typeof input === 'object') {
            return JSON.stringify(input, circularReplacer());
        }
    }
    // -0 stringifies as "0" by default.
    if (Object.is(input, -0)) {
        return '-0';
    }
    return `${input}`;
};

module.exports = safeStringify;
