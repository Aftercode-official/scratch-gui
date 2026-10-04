const uid = require('../util/uid');
const xmlEscape = require('../util/xml-escape');

class Group {
    constructor (state) {
        state = state || {};
        this.id = state.id || uid();
        this.apply(state);
    }

    apply (state) {
        this.title = typeof state.title === 'string' ? state.title : 'Group';
        this.colour = typeof state.colour === 'string' ? state.colour : null;
        this.x = Number(state.x) || 0;
        this.y = Number(state.y) || 0;
        this.width = Math.max(Number(state.width) || 360, 160);
        this.height = Math.max(Number(state.height) || 240, 96);
        this.expandedWidth = Math.max(Number(state.expandedWidth) || this.width, 160);
        this.expandedHeight = Math.max(Number(state.expandedHeight) || this.height, 96);
        this.collapsed = state.collapsed === true;
        this.blocks = Array.isArray(state.blocks) ? state.blocks.slice() : [];
        if (this.collapsed) this.height = 32;
    }

    toXML () {
        return `<group id="${this.id}" title="${xmlEscape(this.title)}" colour="${this.colour || ''}" ` +
            `x="${this.x}" y="${this.y}" ` +
            `width="${this.width}" height="${this.height}" expandedWidth="${this.expandedWidth}" ` +
            `expandedHeight="${this.expandedHeight}" ` +
            `collapsed="${this.collapsed}" blocks="${this.blocks.join(' ')}"></group>`;
    }
}

module.exports = Group;
