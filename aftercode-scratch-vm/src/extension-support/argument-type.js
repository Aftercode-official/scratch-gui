/**
 * Block argument types
 * @enum {string}
 */
const ArgumentType = {
    /**
     * Numeric value with angle picker
     */
    ANGLE: 'angle',

    /**
     * Numeric value with a slider picker
     */
    SLIDER: 'slider',

    /**
     * Boolean value with hexagonal placeholder
     */
    BOOLEAN: 'Boolean',

    /**
     * Numeric value with color picker
     */
    COLOR: 'color',

    /**
     * Numeric value with text field
     */
    NUMBER: 'number',

    /**
     * String value with text field
     */
    STRING: 'string',

    /**
     * Object value with object shaped placeholder.
     */
    OBJECT: 'Object',

    /**
     * Array value with array shaped placeholder.
     */
    ARRAY: 'Array',

    /**
     * String value with matrix field
     */
    MATRIX: 'matrix',

    /**
     * MIDI note number with note picker (piano) field
     */
    NOTE: 'note',

    /**
     * Inline image on block (as part of the label)
     */
    IMAGE: 'image',

    /**
     * Name of costume in the current target
     */
    COSTUME: 'costume',

    /**
     * Name of sound in the current target
     */
    SOUND: 'sound',

    /**
     * Name of scalar variable in the current scope
     */
    VARIABLE: 'variable',

    /**
     * Name of list variable in the current scope
     */
    LIST: 'list',

    /**
     * Name of table variable in the current scope
     */
    TABLE: 'table',

    /**
     * Name of broadcast message in the current scope
     */
    BROADCAST: 'broadcast',

    /**
     * Name of extendable field
    */
    EXTENDABLE: 'extendable'
};

module.exports = ArgumentType;
