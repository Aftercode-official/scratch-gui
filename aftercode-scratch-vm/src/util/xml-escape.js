const Cast = require('../util/cast.js');
const log = require('./log');

/**
 * Escape a string to be safe to use in XML content.
 * CC-BY-SA: hgoebl
 * https://stackoverflow.com/questions/7918868/
 * how-to-escape-xml-entities-in-javascript
 * @param {!string | !Array.<string>} unsafe Unsafe string.
 * @return {string} XML-escaped string, for use within an XML tag.
 */
const xmlEscape = function (unsafe) {
    if (typeof unsafe !== 'string') {
        if (typeof unsafe === 'object') {
            // This happens when we have hacked blocks from 2.0
            // See #1030
            unsafe = Cast.toString(unsafe);
        } else {
            log.error('Unexpected input recieved in replaceUnsafeChars');
            return unsafe;
        }
    }
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        }
    });
};

module.exports = xmlEscape;
