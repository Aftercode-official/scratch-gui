const Cast = require('../util/cast');

class Scratch3ControlBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        /**
         * The "counter" block value. For compatibility with 2.0.
         * @type {number}
         */
        this._counter = 0; // used by compiler

        this.runtime.on('RUNTIME_DISPOSED', this.clearCounter.bind(this));
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            control_repeat: this.repeat,
            control_repeat_until: this.repeatUntil,
            control_while: this.repeatWhile,
            control_for_each: this.forEach,
            control_forever: this.forever,
            control_wait: this.wait,
            control_wait_until: this.waitUntil,
            control_if: this.if,
            control_if_else: this.ifElse,
            control_if_extendable: this.ifExtendable,
            control_if_else_extendable: this.ifElseExtendable,
            control_inline_if_else: this.inlineIfElse,
            control_switch: this.switch,
            control_stop: this.stop,
            control_create_clone_of: this.createClone,
            control_delete_this_clone: this.deleteClone,
            control_get_counter: this.getCounter,
            control_incr_counter: this.incrCounter,
            control_clear_counter: this.clearCounter,
            control_all_at_once: this.allAtOnce,
            control_foreach_in_range: this.forEachInRange,
            control_foreach_in_range_item: this.forEachInRangeItem
        };
    }

    getHats () {
        return {
            control_start_as_clone: {
                restartExistingThreads: false
            }
        };
    }

    repeat (args, util) {
        const times = Math.round(Cast.toNumber(args.TIMES));
        // Initialize loop
        if (typeof util.stackFrame.loopCounter === 'undefined') {
            util.stackFrame.loopCounter = times;
        }
        // Only execute once per frame.
        // When the branch finishes, `repeat` will be executed again and
        // the second branch will be taken, yielding for the rest of the frame.
        // Decrease counter
        util.stackFrame.loopCounter--;
        // If we still have some left, start the branch.
        if (util.stackFrame.loopCounter >= 0) {
            util.startBranch(1, true);
        }
    }

    repeatUntil (args, util) {
        const condition = Cast.toBoolean(args.CONDITION);
        // If the condition is false (repeat UNTIL), start the branch.
        if (!condition) {
            util.startBranch(1, true);
        }
    }

    repeatWhile (args, util) {
        const condition = Cast.toBoolean(args.CONDITION);
        // If the condition is true (repeat WHILE), start the branch.
        if (condition) {
            util.startBranch(1, true);
        }
    }

    forEach (args, util) {
        const variable = util.target.lookupOrCreateVariable(
            args.VARIABLE.id, args.VARIABLE.name);

        if (typeof util.stackFrame.index === 'undefined') {
            util.stackFrame.index = 0;
        }

        if (util.stackFrame.index < Number(args.VALUE)) {
            util.stackFrame.index++;
            variable.value = util.stackFrame.index;
            util.startBranch(1, true);
        }
    }

    waitUntil (args, util) {
        const condition = Cast.toBoolean(args.CONDITION);
        if (!condition) {
            util.yield();
        }
    }

    forever (args, util) {
        util.startBranch(1, true);
    }

    wait (args, util) {
        if (util.stackTimerNeedsInit()) {
            const duration = Math.max(0, 1000 * Cast.toNumber(args.DURATION));

            util.startStackTimer(duration);
            this.runtime.requestRedraw();
            util.yield();
        } else if (!util.stackTimerFinished()) {
            util.yield();
        }
    }

    if (args, util) {
        const condition = Cast.toBoolean(args.CONDITION);
        if (condition) {
            util.startBranch(1, false);
        }
    }

    ifElse (args, util) {
        const condition = Cast.toBoolean(args.CONDITION);
        if (condition) {
            util.startBranch(1, false);
        } else {
            util.startBranch(2, false);
        }
    }

    ifExtendable (args, util) {
        const argCount = args.BRANCHES;
        for (let i = 0; i < argCount; i++) {
            if (Cast.toBoolean(args[`BRANCHES_${i}_CONDITION`])) {
                util.startBranch(`BRANCHES_${i}_BRANCH`);
                return;
            }
        }
    }

    ifElseExtendable (args, util) {
        const argCount = args.BRANCHES;
        for (let i = 0; i < argCount; i++) {
            if (Cast.toBoolean(args[`BRANCHES_${i}_CONDITION`])) {
                util.startBranch(`BRANCHES_${i}_BRANCH`, false);
                return;
            }
        }
        util.startBranch(`ELSE_BRANCH`, false);
    }

    inlineIfElse (args) {
        return Cast.toBoolean(args.OPERAND) ? args.THEN : args.ELSE;
    }

    switch (args, util) {
        const switchVal = Cast.toString(args.SWITCH);
        const caseCount = args.CASES;
        for (let i = 0; i < caseCount; i++) {
            if (switchVal === Cast.toString(args[`CASES_${i}_CASE`])) {
                util.startBranch(`CASES_${i}_BRANCH`, false);
                return;
            }
        }
        util.startBranch(`DEFAULT_BRANCH`, false);
    }

    stop (args, util) {
        const option = args.STOP_OPTION;
        if (option === 'all') {
            util.stopAll();
        } else if (option === 'other scripts in sprite' ||
            option === 'other scripts in stage') {
            util.stopOtherTargetThreads();
        } else if (option === 'this script') {
            util.stopThisScript();
        }
    }

    createClone (args, util) {
        this._createClone(Cast.toString(args.CLONE_OPTION), util.target);
    }
    _createClone (cloneOption, target) { // used by compiler
        // Set clone target
        let cloneTarget;
        if (cloneOption === '_myself_') {
            cloneTarget = target;
        } else {
            cloneTarget = this.runtime.getSpriteTargetByName(cloneOption);
        }

        // If clone target is not found, return
        if (!cloneTarget) return;

        // Create clone
        const newClone = cloneTarget.makeClone();
        if (newClone) {
            this.runtime.addTarget(newClone);

            // Place behind the original target.
            newClone.goBehindOther(cloneTarget);
        }
    }

    deleteClone (args, util) {
        if (util.target.isOriginal) return;
        this.runtime.disposeTarget(util.target);
        this.runtime.stopForTarget(util.target);
    }

    getCounter () {
        return this._counter;
    }

    clearCounter () {
        this._counter = 0;
    }

    incrCounter () {
        this._counter++;
    }

    allAtOnce (args, util) {
        // Since the "all at once" block is implemented for compatiblity with
        // Scratch 2.0 projects, it behaves the same way it did in 2.0, which
        // is to simply run the contained script (like "if 1 = 1").
        // (In early versions of Scratch 2.0, it would work the same way as
        // "run without screen refresh" custom blocks do now, but this was
        // removed before the release of 2.0.)
        util.startBranch(1, false);
    }

    forEachInRangeItem (args, util) {
        const frames = util.thread.stackFrames;
        for (let i = frames.length - 1; i >= 0; i--) {
            if (typeof frames[i].forEachInRangeItem !== 'undefined') {
                return frames[i].forEachInRangeItem ?? 0;
            }
        }
        return 0;
    }

    forEachInRange (args, util) {
        const {stackFrame} = util;

        if (typeof stackFrame.index === 'undefined') {
            const from = Math.round(Cast.toNumber(args.FROM));
            const to = Math.round(Cast.toNumber(args.TO));
            Object.assign(stackFrame, {
                from,
                to,
                step: from <= to ? 1 : -1,
                index: from
            });
        }

        const {index, to, step} = stackFrame;
        const done = step > 0 ? index > to : index < to;

        if (done) {
            delete stackFrame.forEachInRangeItem;
            return;
        }

        stackFrame.forEachInRangeItem = index;
        stackFrame.index += step;
        util.startBranch(1, true);
    }
}

module.exports = Scratch3ControlBlocks;
