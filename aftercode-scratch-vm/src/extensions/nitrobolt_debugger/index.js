const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const formatMessage = require('format-message');

/**
 * Maximum number of timers that can be created.
 * @type {number}
 */
const MAX_TIMERS = 100;

/**
 * Icon svg to be displayed in the blocks category menu, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
const menuIconURI = 'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSI5MC45MjUzNCIgaGVpZ2h0PSI5MC45MjUzMyIgdmlld0JveD0iMCwwLDkwLjkyNTM0LDkwLjkyNTMzIj48ZGVmcz48bGluZWFyR3JhZGllbnQgeDE9IjQ4MCIgeTE9IjQwMy45NjI2NyIgeDI9IjU2Ny45MjUzNCIgeTI9IjQwMy45NjI2NyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJjb2xvci0xIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyZWQyY2MiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMyOGI1YjAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtNDc4LjUsLTM1OC41KSI+PGcgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIj48cGF0aCBkPSJNNDgwLDQwMy45NjI2N2MwLC0yNC4yNzk5MSAxOS42ODI3NiwtNDMuOTYyNjcgNDMuOTYyNjcsLTQzLjk2MjY3YzI0LjI3OTkxLDAgNDMuOTYyNjcsMTkuNjgyNzYgNDMuOTYyNjcsNDMuOTYyNjdjMCwyNC4yNzk5MSAtMTkuNjgyNzYsNDMuOTYyNjYgLTQzLjk2MjY3LDQzLjk2MjY2Yy0yNC4yNzk5MSwwIC00My45NjI2NywtMTkuNjgyNzUgLTQzLjk2MjY3LC00My45NjI2NnoiIGZpbGw9InVybCgjY29sb3ItMSkiIHN0cm9rZT0iIzJhYTI5ZSIgc3Ryb2tlLXdpZHRoPSIzIi8+PHBhdGggZD0iTTUzNS4wMjk4MywzODcuMzYxOTJjMCwtMy4wNTczIC0yLjQ3NjI4LC01LjUzMzU4IC01LjUzMzU4LC01LjUzMzU4aC0xMS4wNjcxN2MtMy4wNTczLDAgLTUuNTMzNTgsMi40NzYyOCAtNS41MzM1OCw1LjUzMzU4djUuNTMzNTh2OC4zMDAzN3Y1LjUzMzU4djguMzAwMzd2NS41MzM1OGMwLDMuMDU3MyAyLjQ3NjI4LDUuNTMzNTggNS41MzM1OCw1LjUzMzU4aDExLjA2NzE3YzMuMDU3MywwIDUuNTMzNTgsLTIuNDc2MjggNS41MzM1OCwtNS41MzM1OHYtNS41MzM1OHYtOC4zMDAzN3YtNS41MzM1OHYtOC4zMDAzN3pNNTQwLjU2MzQxLDM5Mi44OTU1djguMzAwMzdoOC4zMDAzN2MxLjUyNzI3LDAgMi43NjY3OSwxLjIzOTUyIDIuNzY2NzksMi43NjY3OWMwLDEuNTI3MjcgLTEuMjM5NTIsMi43NjY3OSAtMi43NjY3OSwyLjc2Njc5aC04LjMwMDM3djguMzAwMzdjNi4xMTE4NCwwIDExLjA2NzE3LDQuOTU1MzIgMTEuMDY3MTcsMTEuMDY3MTd2Mi43NjY3OWMwLDEuNTI3MjcgLTEuMjM5NTIsMi43NjY3OSAtMi43NjY3OSwyLjc2Njc5Yy0xLjUyNzI3LDAgLTIuNzY2NzksLTEuMjM5NTIgLTIuNzY2NzksLTIuNzY2Nzl2LTIuNzY2NzljMCwtMi43NjY3OSAwLC01LjUzMzU4IC01LjUzMzU4LC01LjUzMzU4YzAsNi4xMTE4NCAtNC45NTUzMiwxMS4wNjcxNyAtMTEuMDY3MTcsMTEuMDY3MTdoLTExLjA2NzE3Yy02LjExMTg0LDAgLTExLjA2NzE3LC00Ljk1NTMyIC0xMS4wNjcxNywtMTEuMDY3MTdjLTUuNTMzNTgsMCAtNS41MzM1OCwyLjc2Njc5IC01LjUzMzU4LDUuNTMzNTh2Mi43NjY3OWMwLDEuNTI3MjcgLTEuMjM5NTIsMi43NjY3OSAtMi43NjY3OSwyLjc2Njc5Yy0xLjUyNzI3LDAgLTIuNzY2NzksLTEuMjM5NTIgLTIuNzY2NzksLTIuNzY2Nzl2LTIuNzY2NzljMCwtNi4xMTE4NCA0Ljk1NTMyLC0xMS4wNjcxNyAxMS4wNjcxNywtMTEuMDY3MTd2LTguMzAwMzdoLTguMzAwMzdjLTEuNTI3MjcsMCAtMi43NjY3OSwtMS4yMzk1MiAtMi43NjY3OSwtMi43NjY3OWMwLC0xLjUyNzI3IDEuMjM5NTIsLTIuNzY2NzkgMi43NjY3OSwtMi43NjY3OWg4LjMwMDM3di04LjMwMDM3Yy02LjExMTg0LDAgLTExLjA2NzE3LC00Ljk1NTMyIC0xMS4wNjcxNywtMTEuMDY3MTd2LTIuNzY2NzljMCwtMS41MjcyNyAxLjIzOTUyLC0yLjc2Njc5IDIuNzY2NzksLTIuNzY2NzljMS41MjcyNywwIDIuNzY2NzksMS4yMzk1MiAyLjc2Njc5LDIuNzY2Nzl2Mi43NjY3OWMwLDIuNzY2NzkgMCw1LjUzMzU4IDUuNTMzNTgsNS41MzM1OGMwLC02LjExMTg0IDQuOTU1MzIsLTExLjA2NzE3IDExLjA2NzE3LC0xMS4wNjcxN2gxMS4wNjcxN2M2LjExMTg0LDAgMTEuMDY3MTcsNC45NTUzMiAxMS4wNjcxNywxMS4wNjcxN2M1LjUzMzU4LDAgNS41MzM1OCwtMi43NjY3OSA1LjUzMzU4LC01LjUzMzU4di0yLjc2Njc5YzAsLTEuNTI3MjcgMS4yMzk1MiwtMi43NjY3OSAyLjc2Njc5LC0yLjc2Njc5YzEuNTI3MjcsMCAyLjc2Njc5LDEuMjM5NTIgMi43NjY3OSwyLjc2Njc5djIuNzY2NzljMCw2LjExMTg0IC00Ljk1NTMyLDExLjA2NzE3IC0xMS4wNjcxNywxMS4wNjcxN3pNNTI5LjQ5NjI1LDQxNS4wMjk4M2MtMS41MjcyNywwIC0yLjc2Njc5LDEuMjM5NTIgLTIuNzY2NzksMi43NjY3OWMwLDEuNTI3MjcgMS4yMzk1MiwyLjc2Njc5IDIuNzY2NzksMi43NjY3OWMxLjUyNzI3LDAgMi43NjY3OSwtMS4yMzk1MiAyLjc2Njc5LC0yLjc2Njc5YzAsLTEuNTI3MjcgLTEuMjM5NTIsLTIuNzY2NzkgLTIuNzY2NzksLTIuNzY2Nzl6TTUyMS4xOTU4Nyw0MTcuNzk2NjJjMCwxLjUyNzI3IC0xLjIzOTUyLDIuNzY2NzkgLTIuNzY2NzksMi43NjY3OWMtMS41MjcyNywwIC0yLjc2Njc5LC0xLjIzOTUyIC0yLjc2Njc5LC0yLjc2Njc5YzAsLTEuNTI3MjcgMS4yMzk1MiwtMi43NjY3OSAyLjc2Njc5LC0yLjc2Njc5YzEuNTI3MjcsMCAyLjc2Njc5LDEuMjM5NTIgMi43NjY3OSwyLjc2Njc5eiIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiLz48L2c+PC9nPjwvc3ZnPjwhLS1yb3RhdGlvbkNlbnRlcjoxLjU6MS41LS0+';

class NitroBoltDebuggerBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        /**
         * Map of timer name to timer state.
         * @type {Object.<string, {start: ?number, durations: Array.<number>}>}
         */
        this.timers = {};

        /**
         * Used to mark a thread as resuming (compiler)
         * @type {Symbol}
         */
        this.breakpointResuming = Symbol('breakpointResuming');
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        return {
            id: 'debugger',
            name: formatMessage({
                id: 'nb.debugger.name',
                default: 'Debugger',
                description: 'Name of the NitroBolt debugger extension'
            }),
            menuIconURI: menuIconURI,
            color1: '#29beb8',
            blocks: [
                {
                    opcode: 'breakpoint',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'nb.debugger.breakpoint',
                        default: 'breakpoint'
                    })
                },
                {
                    opcode: 'clear',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'nb.debugger.clearLogs',
                        default: 'clear logs'
                    })
                },
                {
                    opcode: 'log',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'nb.debugger.log',
                        default: '[TYPE] [MESSAGE] [COLOR]'
                    }),
                    arguments: {
                        TYPE: {
                            type: ArgumentType.STRING,
                            menu: 'logType',
                            defaultValue: 'log'
                        },
                        MESSAGE: {
                            type: ArgumentType.STRING,
                            defaultValue: 'Hello!'
                        },
                        COLOR: {
                            type: ArgumentType.EXTENDABLE,
                            text: formatMessage({
                                id: 'nb.debugger.withColor',
                                default: 'with color [VALUE]'
                            }),
                            arguments: {
                                VALUE: {
                                    type: ArgumentType.COLOR,
                                    defaultValue: '#0000ff'
                                }
                            },
                            minInputs: 0,
                            maxInputs: 1,
                            defaultInputs: 0
                        }
                    }
                },
                '---',
                {
                    opcode: 'timerCommand',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'nb.debugger.timerCommand',
                        default: '[OPERATION] timer [TIMER_NAME]'
                    }),
                    arguments: {
                        OPERATION: {
                            type: ArgumentType.STRING,
                            menu: 'timerOperation',
                            defaultValue: 'start'
                        },
                        TIMER_NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'timer'
                        }
                    }
                },
                {
                    opcode: 'getTimerValue',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'nb.debugger.timerValue',
                        default: '[STAT] of timer [TIMER_NAME]'
                    }),
                    arguments: {
                        STAT: {
                            type: ArgumentType.STRING,
                            menu: 'timerStat',
                            defaultValue: 'average'
                        },
                        TIMER_NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'timer'
                        }
                    }
                },
                '---',
                {
                    opcode: 'cloneCount',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'nb.debugger.cloneCount',
                        default: 'clone count'
                    })
                },
                {
                    opcode: 'memory',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'nb.debugger.usedMemory',
                        default: 'used memory'
                    })
                }
            ],
            menus: {
                logType: {
                    acceptReporters: true,
                    items: [
                        {
                            text: formatMessage({
                                id: 'nb.debugger.logType.log',
                                default: 'log'
                            }),
                            value: 'log'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.logType.warn',
                                default: 'warn'
                            }),
                            value: 'warn'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.logType.error',
                                default: 'error'
                            }),
                            value: 'error'
                        }
                    ]
                },
                timerOperation: {
                    acceptReporters: true,
                    items: [
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerOperation.start',
                                default: 'start'
                            }),
                            value: 'start'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerOperation.end',
                                default: 'end'
                            }),
                            value: 'end'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerOperation.clear',
                                default: 'clear'
                            }),
                            value: 'clear'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerOperation.delete',
                                default: 'delete'
                            }),
                            value: 'delete'
                        }
                    ]
                },
                timerStat: {
                    acceptReporters: true,
                    items: [
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerStat.min',
                                default: 'min'
                            }),
                            value: 'min'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerStat.max',
                                default: 'max'
                            }),
                            value: 'max'
                        },
                        {
                            text: formatMessage({
                                id: 'nb.debugger.timerStat.average',
                                default: 'average'
                            }),
                            value: 'average'
                        }
                    ]
                }
            }
        };
    }

    breakpoint (args, util) {
        if (util.thread.isCompiled && util.thread[this.breakpointResuming]) {
            util.thread[this.breakpointResuming] = false;
            return;
        }
        if (util.thread.isCompiled) {
            util.thread[this.breakpointResuming] = true;
        } else {
            util.thread.goToNextBlock();
        }
        util.yield();
        util.thread.isPaused = true;
        this.runtime.breakpoint();
    }

    clear () {
        this.runtime.emit('DEBUGGER_CLEAR');
    }

    log (args, util) {
        const message = Cast.toString(args.MESSAGE);
        const color = Cast.toNumber(args.COLOR) === 1 ? Cast.toRgbColorObject(args.COLOR_0_VALUE) : null;

        this.runtime.emitDebuggerLog(args.TYPE, message, util.target, color, util.thread.topBlock);
        switch (args.TYPE) {
        case 'warn':
            console.warn(message);
            break;
        case 'error':
            console.error(message);
            break;
        default:
            console.log(message);
            break;
        }
    }

    _getTimer (name) {
        if (!Object.prototype.hasOwnProperty.call(this.timers, name)) {
            if (Object.keys(this.timers).length >= MAX_TIMERS) {
                return null;
            }
            this.timers[name] = {
                start: null,
                durations: []
            };
        }
        return this.timers[name];
    }

    _getTimerStats (timer) {
        const stats = {
            count: timer.durations.length,
            min: null,
            max: null,
            average: null
        };
        if (timer.durations.length > 0) {
            let min = Infinity;
            let max = -Infinity;
            let sum = 0;
            for (const duration of timer.durations) {
                if (duration < min) min = duration;
                if (duration > max) max = duration;
                sum += duration;
            }
            stats.min = min;
            stats.max = max;
            stats.average = sum / timer.durations.length;
        }
        return stats;
    }

    _emitTimerUpdate () {
        const data = {};
        for (const name in this.timers) {
            data[name] = this._getTimerStats(this.timers[name]);
        }
        this.runtime.emit('DEBUGGER_TIMER_UPDATE', data);
    }

    timerCommand (args) {
        const operation = Cast.toString(args.OPERATION);
        const name = Cast.toString(args.TIMER_NAME);
        if (!name) return;
        if (operation === 'delete') {
            if (Object.prototype.hasOwnProperty.call(this.timers, name)) {
                delete this.timers[name];
                this._emitTimerUpdate();
            }
            return;
        }
        const timer = this._getTimer(name);
        if (!timer) return;
        switch (operation) {
        case 'start':
            if (timer.start === null) {
                timer.start = performance.now();
                this._emitTimerUpdate();
            }
            break;
        case 'end':
            if (timer.start !== null) {
                timer.durations.push(performance.now() - timer.start);
                timer.start = null;
                this._emitTimerUpdate();
            }
            break;
        case 'clear':
            timer.start = null;
            timer.durations = [];
            this._emitTimerUpdate();
            break;
        }
    }

    getTimerValue (args) {
        const stat = Cast.toString(args.STAT);
        const name = Cast.toString(args.TIMER_NAME);
        const timer = this.timers[name];
        if (!timer) return 0;
        const stats = this._getTimerStats(timer);
        switch (stat) {
        case 'min':
            return stats.min || 0;
        case 'max':
            return stats.max || 0;
        default:
            return stats.average || 0;
        }
    }

    cloneCount () {
        return this.runtime._cloneCounter;
    }

    memory () {
        const vm = window.vm;
        let byteLength = 0;
        for (const target of this.runtime.targets) {
            Object.values(target.variables).forEach(v => {
                if (typeof v.value === 'string') {
                    // todo: should this account for non-ASCII characters?
                    byteLength += v.value.length;
                } else if (typeof v.value === 'object') {
                    // not very accurate, but good enough.
                    byteLength += JSON.stringify(v.value).length;
                }
            });
        }
        for (const asset of vm.assets) {
            byteLength += asset.data.byteLength || 0;
        }
        return byteLength;
    }
}

module.exports = NitroBoltDebuggerBlocks;
