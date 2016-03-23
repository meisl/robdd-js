"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;


const BDD = require('./BDD'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      not    = BDD.not,
      and    = BDD.and,
      or     = BDD.or,
      eqv    = BDD.eqv,
      xor    = BDD.xor,
      imp    = BDD.imp
;
const RLE = require('./RLE');

const FLAG_SWAP  = 1 << 0,
      FLAG_FLIP  = 1 << 1,
      FLAG_REUSE = 1 << 2;

function fmt(x, n) {
    let result = "" + x;
    if (result.length < n) {
        result = " ".repeat(n - result.length) + result;
    }
    return result;
}

function Program(o, opts) {
    let labels2Idx = {},
        info = new Map();
    this.labelIdx = function (bdd) {
        assert(BDD.isBDD(bdd), "expected a BDD, got " + util.inspect(bdd));
        if (bdd === T) return -2;
        if (bdd === F) return -1;
        let label  = bdd.label,
            result = labels2Idx[label];
        if (result === undefined) {
            if (Object.isFrozen(labels2Idx)) {
                throw new Error("no such label: " + util.inspect(label));
            }
            result = labels2Idx[label] = this.labels.length;
            this.labels.push(label);
        }
        return result;
    };
    let infoByIdx = [];
    this.getInfo = i => infoByIdx[i];
    this.pushInfo = entry => {
        let i = infoByIdx.length;
        infoByIdx[i] = entry;
        return i;
    };
    this.info = info;
    info.program = this;
    addInfo(info, T, 0);
    addInfo(info, F, 1);

    if (BDD.isBDD(o)) {
        this.labels = [];
        this.maxLen = 2;
        Object.defineProperty(this, "BDDsize",          { value: o.size,        enumerable: true });    // TODO: set BDDsize from traversal in _serialize
        Object.defineProperty(this, "BDDheight",        { value: o.height,      enumerable: true });
        Object.defineProperty(this, "labelDeltasRLE",   { value: RLE.init(),    enumerable: true });
        Object.defineProperty(this, "thenSlotsRLE",     { value: RLE.init(),    enumerable: true });
        Object.defineProperty(this, "elseSlotsRLE",     { value: RLE.init(),    enumerable: true });
        if (o.isTerminal) {
            Object.defineProperty(this, "resultSlot", { value: info.get(o).slot, enumerable: true });
        } else {
            _serialize(o, this, opts);
        }
        Object.freeze(labels2Idx);
    } else if (util.isObject(o)) {
        this.labels = o.labels;
        this.maxLen = o.maxLen;
        Object.defineProperty(this, "BDDsize",        { value: o.BDDsize,                       enumerable: true });
        Object.defineProperty(this, "BDDheight",      { value: o.BDDheight,                     enumerable: true });
        Object.defineProperty(this, "labelDeltasRLE", { value: RLE.fromJSON(o.labelDeltasRLE),  enumerable: true });
        Object.defineProperty(this, "thenSlotsRLE",   { value: RLE.fromJSON(o.thenSlotsRLE),    enumerable: true });
        Object.defineProperty(this, "elseSlotsRLE",   { value: RLE.fromJSON(o.elseSlotsRLE),    enumerable: true });
        Object.defineProperty(this, "resultSlot",     { value: o.resultSlot,                    enumerable: true });
    } else {
        throw new TypeError("expected a BDD or JSON (object) - got ", util.inspect(o));
    }
}

Program.prototype.decode = function (i, cb) {
    let targetSlot,
        labelIdx,
        thenSlot, swapThen = false, flipThen = false,
        elseSlot, swapElse = false, flipElse = false,
        entry = this.getInfo(i);
    if (entry) {
        targetSlot = entry.slot;
        labelIdx   = entry.labelIndex;
        thenSlot   = entry.thenSlot;
        elseSlot   = entry.elseSlot;
        swapThen   = entry.swapThen;
        swapElse   = entry.swapElse;
        flipThen   = entry.flipThen;
        flipElse   = entry.flipElse;
    } else {
        let j  = i * 4,
            is = this.instructions;
        targetSlot = is[j++];
        labelIdx   = is[j++];
        thenSlot   = is[j++];
        elseSlot   = is[j++];
        // TODO: encode swapThen in instructions
        // TODO: encode swapElse in instructions
    }
    let label = this.labels[labelIdx];
    return cb(targetSlot, label, thenSlot, elseSlot, labelIdx, swapThen, swapElse, flipThen, flipElse);
};

Program.prototype.encodeSlots = function () {
    let thSlots = this.thenSlotsRLE.clear(),
        lsSlots = this.elseSlotsRLE.clear(),
        n       = this.instructionCount;
    for (let i = 0; i < n; i++) {
        let instr    = this.getInfo(i),
            thenOp   = 0,
            elseOp   = 0;
        if (instr.swapThen)  thenOp |= FLAG_SWAP;
        if (instr.flipThen)  thenOp |= FLAG_FLIP;
        if (instr.reuseThen) thenOp |= FLAG_REUSE;
        if (instr.swapElse)  elseOp |= FLAG_SWAP;
        if (instr.flipElse)  elseOp |= FLAG_FLIP;
        if (instr.reuseElse) elseOp |= FLAG_REUSE;
        thSlots.add((instr.thenSlot << 3) | thenOp);
        lsSlots.add((instr.elseSlot << 3) | elseOp);
    }
    return this;
};

Program.prototype.decodeSlots = function () {
    let swapCount        = 0,
        flipCount        = 0,
        flopCount        = 0,
        thenSlotsIt      = this.thenSlots(),
        elseSlotsIt      = this.elseSlots(),
        nextThen, thenValue,
        nextElse, elseValue;
    while (!(nextThen = thenSlotsIt.next()).done) {
        nextElse = elseSlotsIt.next();
        thenValue = nextThen.value;
        elseValue = nextElse.value;
        if (thenValue & FLAG_SWAP) swapCount++;
        if (thenValue & FLAG_FLIP) flipCount++;
        if ((thenValue & FLAG_SWAP) && (thenValue & FLAG_FLIP)) flopCount++;
        if (elseValue & FLAG_SWAP) swapCount++;
        if (elseValue & FLAG_FLIP) flipCount++;
        if ((elseValue & FLAG_SWAP) && (elseValue & FLAG_FLIP)) flopCount++;
    }
    Object.defineProperties(this, {
        swapCount:        { value: swapCount,        enumerable: true, writable: false, configurable: false },
        flipCount:        { value: flipCount,        enumerable: true, writable: false, configurable: false },
        flopCount:        { value: flopCount,        enumerable: true, writable: false, configurable: false },
    });
    return this;
};

Object.defineProperties(Program.prototype, {
    labelCount:       { get: function () { return this.labels.length                 }, },
    instructionCount: { get: function () { return this.labelDeltasRLE.decodedLength; }, },

    resultSlot:       { get: function () { return this.decode(this.instructionCount - 1, targetSlot => targetSlot); }, },

    swapCount:        { get: function () { return this.decodeSlots().swapCount;      }, }, // decodeSlots returns the instance (this) and on it will
    flipCount:        { get: function () { return this.decodeSlots().flipCount;      }, }, // ... have overridden .swapCount, .flipCount, and
    flopCount:        { get: function () { return this.decodeSlots().flopCount;      }, }, // ... .flopCount with value props holding the actual values.

    labelDeltas:      { value: function () { return this.labelDeltasRLE.values();    }, },
    thenSlots:        { value: function () { return this.thenSlotsRLE.values();      }, },
    elseSlots:        { value: function () { return this.elseSlotsRLE.values();      }, },
});

Program.prototype.init = function (map) {
    let xs = new Array(this.maxLen);
    map = map || (x => x);
    xs[this.info.get(T).slot] = map(T);
    xs[this.info.get(F).slot] = map(F);
    return xs;
};

Program.prototype.run = function (cb) {
    let self      = this,
        n         = this.instructionCount,
        labelIdxs = self.init(self.labelIdx),
        results   = self.init(),
        labels    = self.init(),
        thenChildren = self.init(),
        elseChildren = self.init(),
        deltasIt  = self.labelDeltas(),
        t         = 0.0;
    for (let i = 0; i < n; i++) {
        this.decode(i, (targetSlot, _label, thenSlot, elseSlot, _labelIdx, swapThen, swapElse, flipThen, flipElse) => {
            let nextDelta = deltasIt.next(),
                m         = Math.max(labelIdxs[thenSlot], labelIdxs[elseSlot]),
                labelIdx  = nextDelta.value + m,
                label,
                thenChild,
                elseChild;
            labelIdxs[targetSlot] = labelIdx;

            if (nextDelta.done) { // don't create the msg if not needed
                assert.same(nextDelta.done, false, "ran out of labelDeltas at i=" + i + " of " + n + " instructions / " + util.inspect([...self.labelDeltas()]));
            }
            if (labelIdx !== _labelIdx) { // don't create the msg if not needed
                assert.same(labelIdx, _labelIdx, "labelIdx at instruction " + i
                    + " / nextDelta.value=" + nextDelta.value
                    + " / m=" + m
                    + " / thenSlot=" + thenSlot
                    + " / elseSlot=" + elseSlot
                    + " / labelIdxs so far: [" + labelIdxs.join(',') + "]"
                    + " / labels: [" + self.labels.join(',') + "]"
                );
            }
            label = self.labels[labelIdx];
            assert.same(label, _label);

            if (swapThen) { // implement swap by letting cb construct it, so any label mappings are applied correctly:
                thenChild = cb(labels[thenSlot], elseChildren[thenSlot], thenChildren[thenSlot], t);
            } else {
                thenChild = results[thenSlot];
            }
            if (flipThen) thenChild = flip(thenChild);

            if (swapElse) { // implement swap by letting cb construct it, so any label mappings are applied correctly:
                elseChild = cb(labels[elseSlot], elseChildren[elseSlot], thenChildren[elseSlot], t);
            } else {
                elseChild = results[elseSlot];
            }
            if (flipElse) elseChild = flip(elseChild);

            // keep operands for later (in particular to be able to handle swaps)
            labels[targetSlot] = label;
            thenChildren[targetSlot] = thenChild;
            elseChildren[targetSlot] = elseChild;

            let start = process.hrtime();
            results[targetSlot] = cb(label, thenChild, elseChild, t);
            let now = process.hrtime();
            t += (now[0] - start[0]) + (now[1] - start[1]) / 1e9;
        });
    }
    return results[self.resultSlot];
};

Program.prototype.stats = function () {
    let jsonLength = JSON.stringify(this).length,
        result = {
        maxLen:             this.maxLen,
        instructionCount:   this.instructionCount,
        swapCount:          this.swapCount,
        flipCount:          this.flipCount,
        flopCount:          this.flopCount,
        BDDsize:            this.BDDsize,
        BDDheight:          this.BDDheight,
        labelCount:         this.labelCount,
        JSONlength:         jsonLength,
        bitsPerNode:        Math.round(jsonLength * 80 / this.BDDsize) / 10,
        labelDeltasPct:     Math.round(this.labelDeltasRLE.encodedLength / this.labelDeltasRLE.decodedLength * 1000) / 10,
        thenSlotsPct:       Math.round(this.thenSlotsRLE.encodedLength / this.thenSlotsRLE.decodedLength * 1000) / 10,
        elseSlotsPct:       Math.round(this.elseSlotsRLE.encodedLength / this.elseSlotsRLE.decodedLength * 1000) / 10,
    };
    Object.defineProperty(result, "toString", {
        value: function () { return util.inspect(this) }
    });
    return result;
};

Program.prototype.toJSON = function () {
    /*
    let is = new Array(this.instructionCount * 4),
        //ls = new Array(this.instructionCount),
        //ts = new Array(this.instructionCount),
        lastLabelIdx = 0,
        lastTrgtSlot = 0,
        i = 0;
    this.run((targetSlot, label, thenSlot, elseSlot, labelIdx) => {
        is[i] = (targetSlot << 24) | (labelIdx << 16) | (thenSlot << 8) | elseSlot;
        //ls[i] = labelIdx - lastLabelIdx;
        //lastLabelIdx = labelIdx;
        //ts[i] = targetSlot - lastTrgtSlot;
        //lastTrgtSlot = targetSlot;
        i++;
    });
    */

    return {
        maxLen:         this.maxLen,
        BDDsize:        this.BDDsize,
        BDDheight:      this.BDDheight,
        resultSlot:     this.resultSlot,
        labels:         this.labels,
        //labelDeltas: [...this.labelDeltas()],
        labelDeltasRLE: this.labelDeltasRLE,
        //srcOpsRLE:      this.srcOpsRLE,
        //targetSlotsRLE: this.targetSlotsRLE,
        thenSlotsRLE:   this.thenSlotsRLE,
        elseSlotsRLE:   this.elseSlotsRLE,
        //slotReuseRLE:   this.slotReuseRLE,
    };
};
Program.prototype.fromJSON = function (text) {
    return JSON.parse(text, (k, v) => {
        if ((k === '') || (k === 'labels')) {
            return v;
        } // if topmost value, return it,
        if (k === '') {

        }
        return v * 2;               // else return v * 2.
    });
};

Program.prototype.traverse = function (onInstr, onEnd) {
    let n = this.instructionCount;
    if (n === 0) {    // trivial: terminal BDD
        return onEnd(this.maxLen);
    }

    for (let i = 0; i < n; i++) {
        let info = this.getInfo(i);
        onInstr(info);
    }
    return onEnd();
};

Program.prototype.optimize = function () {
    let usable = new Array(this.maxLen),
        u  = 0, // next free index in usable
        mL = 2, // maxLen so far
        n  = this.instructionCount,
        tS, // computed new targetSlot
        thSlots = this.thenSlotsRLE.clear(),
        lsSlots = this.elseSlotsRLE.clear();
    this.traverse(
        /* onInstr: */ instr => {
            let pc       = instr.instruction,
                thenSlot = instr.thenSlot, reuseThen = instr.reuseThen, swapThen = instr.swapThen, flipThen = instr.flipThen,
                elseSlot = instr.elseSlot, reuseElse = instr.reuseElse, swapElse = instr.swapElse, flipElse = instr.flipElse,
                poppedUsable = false;
            if (reuseThen) {
                // make sure to not use the slot and add it to usable at the same time:
                if (reuseElse) {
                    tS          = elseSlot; // this choice is arbitrary - could be
                    usable[u++] = thenSlot; // the other way round as well...
                } else { // can reuse thenSlot only
                    tS = thenSlot;
                }
            } else if (reuseElse) { // can reuse elseSlot but not thenSlot
                tS = elseSlot;
            } else { // cannot reuse either, thenSlot or elseSlot
                if (u > 0) {    // ...can we take one from usable?
                    tS = usable[--u];
                    poppedUsable = true;
                } else { // cannot reuse any slot -> inc maxLen
                    tS = mL++;
                }
            }
            instr.slot = tS; // change target slot (affects only then/else slots in *subsequent* instructions)
            thSlots.add((thenSlot << 3) | (reuseThen ? FLAG_REUSE : 0) | (swapThen ? FLAG_SWAP : 0) | (flipThen ? FLAG_FLIP : 0) );
            lsSlots.add((elseSlot << 3) | (reuseElse ? FLAG_REUSE : 0) | (swapElse ? FLAG_SWAP : 0) | (flipElse ? FLAG_FLIP : 0) );

            let assert_same = (actual, expected, what) => {
                if (actual !== expected) {
                    let msg = what + " at instruction #" + pc + ":\n";
                    msg += "usable=" + JSON.stringify(usable.slice(0, u)) + "\n";
                    msg += "maxParent(T @ " + this.info.get(T).slot + "): " + this.info.get(T).maxParent + "\n";
                    msg += "maxParent(F @ " + this.info.get(F).slot + "): " + this.info.get(F).maxParent + "\n";
                    for (let j = 0; j < n; j++) {
                        msg += this.getInfo(j).code + "\n";
                    }
                    assert.same(actual, expected, msg);
                }
            };
            //assert_same(mL, maxLen, "maxLen");
            //assert_same(tS, newTargetSlot, "newTargetSlot");

/*
            console.log(instr.code +
                (poppedUsable ? " * " : "   ")
                + ", maxLen=" + mL + ", usable=" + JSON.stringify([...usable.slice(0, u), tS])
            );
*/
        },
        /* onEnd:   */ () => {
            this.maxLen = mL;
            //console.log("--- maxLen=" + this.maxLen);
            //this.encodeSlots();
        }
    );
    return this;
};

Program.prototype.toString = function () {
    let n      = (this.maxLen + "").length,
        m      = (this.labels.length + "").length,
        o      = (this.instructionCount + "").length,
        result = ["let _ = new Array(" + this.maxLen + "),  // BDD.size = " + this.BDDsize,
                  "    g = " + JSON.stringify(this.labels),
                  "      .map(l => (s,t,e) => { _[s] = get(l, _[t], _[e]) });",
        ];
    [T, F].forEach(bdd => {
        let info = this.info.get(bdd),
            maxP = info.maxParent,
            minP = info.minParent;
        result.push(
            util.format("%s_[%s] = %s; %s// %s  { minP: %s, maxP: %s }",
                fmt("", 2 + m),
                fmt(info.slot, n), // targetSlot
                bdd.toString(),
                fmt("", 2*n),
                fmt("", o),
                fmt(minP, n),
                fmt(maxP, n)
            )
        );
    });
    this.traverse(
        /* onInstr: */ (maxLen, info, newTargetSlot, reusable) => {
            let i    = info.instruction,
                remainingInstrs = this.instructionCount - i - 1,
                usableStr = reusable.length ? reusable.join(',') + ',' + newTargetSlot : newTargetSlot,
                mark = remainingInstrs <= reusable.length - 1 ? "*" : " ",
                minP = info.minParent,
                maxP = info.maxParent,
                labelIdx,
                targetSlot,
                thenSlot,
                elseSlot;
            this.decode(i, (a, b, c, d, e) => {
                targetSlot = a;
                          // b: label
                thenSlot   = c;
                elseSlot   = d;
                labelIdx   = e;
            });
            result.push(
                util.format("/*%s*/ g[%s](%s, %s, %s); // newT: %s, minP: %s, maxP: %s, maxLen: %s, usable: [%s], subst: %s",
                    //mark,
                    fmt(i, o), // instruction nr
                    fmt(labelIdx, m), fmt(targetSlot, n),
                    (info.swapThen ? "s" : " ") + (info.flipThen ? "f" : " ") + fmt(thenSlot, n),
                    (info.swapElse ? "s" : " ") + (info.flipElse ? "f" : " ") + fmt(elseSlot, n),
                    fmt(newTargetSlot, n),
                    fmt(isFinite(minP) ? minP : "-", n),
                    fmt(isFinite(maxP) ? maxP : "-", n),
                    fmt(maxLen, n),
                    usableStr,
                    (newTargetSlot === targetSlot ? "-" : "[" + targetSlot + "->" + newTargetSlot + "] @ " + i + "," + info.parents.map(p => p.instruction).join(','))
                )
            );
        },
        /* onEnd: */ maxLen => {
            result.push("return _[" + this.resultSlot + "];");
        }
    );
    return result.join("\n");
};

let flipMap = new Map();

function flip(bdd) {
    let result = flipMap.get(bdd);
    if (result === undefined) {
        result = bdd.isTerminal
            ? bdd
            : BDD.get(bdd.label, flip(bdd.onFalse), flip(bdd.onTrue));
        flipMap.set(bdd, result);
        flipMap.set(result, bdd);
    }
    return result;
}

function swap(bdd) {
    return bdd.isTerminal
        ? bdd
        : BDD.get(bdd.label, bdd.onFalse, bdd.onTrue)
    ;
}



function _serialize(bdd, prg, opts) {
    let entry;
    if (!(entry = prg.info.get(bdd))) {
        if (opts.useSwap && (entry = prg.info.get(swap(bdd)))) {
            entry = entry.swapped;
        } else if (opts.useFlip && (entry = prg.info.get(flip(bdd)))) {
            entry = entry.flipped;
        } else if (opts.useFlop && (entry = prg.info.get(swap(flip(bdd))))) {
            entry = entry.swapped.flipped;  //  entry.flipped.swapped;  //
        } else {
            let thenInfo,
                elseInfo;
            //if (bdd.onTrue.satPathCount > bdd.onFalse.satPathCount) { // (10: >: 285/296  | <: 288/315) / (9: >: 149/156 | <: 154/148 | t,e: 147/158 | e,t: 159/147)
            //    thenInfo = _serialize(bdd.onTrue,  prg);
            //    elseInfo = _serialize(bdd.onFalse, prg);
            //} else {
                thenInfo = _serialize(bdd.onTrue,  prg, opts);
                elseInfo = _serialize(bdd.onFalse, prg, opts);
            //}

            entry = addInfo(prg.info, bdd, thenInfo, elseInfo);   // in there: targetSlot is set to prg.maxLen++
            //console.log(">>>> " + entry.code);

            refute.same(entry.program.BDDsize, undefined);
            if (bdd.onTrue.isTerminal) {
                assert.same(entry.swapThen, false, "no point in swapping terminal then-child " + bdd.onTrue + " in " + entry.code);
            }
            if (bdd.onFalse.isTerminal) {
                assert.same(entry.swapElse, false, "no point in swapping terminal else-child " + bdd.onFalse + " in " + entry.code);
            }
            assert.same(entry.swapThen, thenInfo.isSwapped, ".swapThen in " + entry.code);
            assert.same(entry.swapElse, elseInfo.isSwapped, ".swapElse in " + entry.code);
        }
    }
    return entry;
}

function InfoEntry() {
}

Object.defineProperties(InfoEntry.prototype, {
    slot:      { get: function () {
                        return this._slot;
                      },
                 set: function (s) {
                        if (s !== this.slot) {
                            Object.defineProperty(this, "_slot", { value: s, enumerable: false, writable: true });
                        }
                        return s;
                    },
                 enumerable: true,
               },
    instruction:   { get: function () { throw new Error("no instruction for " + util.inspect(this)); } },
    maxParent:     { get: function () { let ps = this.parents, n = ps.length; return n === 0 ? Infinity : ps[n - 1].instruction; }, configurable: false },
    minParent:     { get: function () { return Math.min(...this.parents.map(p => p.instruction));   }, configurable: false },
    thenSlot:      { get: function () { return this.thenChild.slot; },      enumerable: true, configurable: false },
    elseSlot:      { get: function () { return this.elseChild.slot; },      enumerable: true, configurable: false },
    swapThen:      { get: function () { return this.thenChild.isSwapped; }, enumerable: true, configurable: false },
    swapElse:      { get: function () { return this.elseChild.isSwapped; }, enumerable: true, configurable: false },
    flipThen:      { get: function () { return this.thenChild.isFlipped; }, enumerable: true, configurable: false },
    flipElse:      { get: function () { return this.elseChild.isFlipped; }, enumerable: true, configurable: false },
    reuseThen: {
        get: function () { return this.thenChild.maxParent === this.instruction; },
        enumerable:   true,
        configurable: false,
    },
    reuseElse: {
        get: function () {
            return (this.thenSlot !== this.elseSlot) // don't reuse the same slot twice!
                && (this.elseChild.maxParent === this.instruction);
        },
        enumerable:   true,
        configurable: false,
    },
    isSwapped:     { enumerable: true, configurable: false, value: false },
    swapped: {
        get: function () {
            // If we get in here we know two things: a) *this* is NOT swapped and b) its swapped instance hasn't been constructed yet.
            // This is because in executing this getter we replace it (the very getter) by *this*' swapped instance:
            let _swapped = Object.create(this, {
                // isFlipped taken from prototype, ie. *this*
                isSwapped: { enumerable: true, configurable: false, value: true, /* shadows *this*' prototype's isSwapped */  },
                swapped:   { enumerable: true, configurable: false, value: this, /* shadows *this*' prototype's swapped */    },
            });
            Object.defineProperty(this,
                "swapped", { enumerable: true, configurable: false, value: _swapped } // configurable: false to prevent further changes
            );
            let x = _swapped.flipped; // call getter (from *this*) to set prop .flipped on _swapped (needs _swapped.swapped initialized!)

            _swapped = Object.freeze(_swapped); // let's freeze it to enforce that every write to it actually happens on *this*
            // Note: we DO NOT add _swapped to this.program.info!
            return _swapped;
        }
    },
    isFlipped:     { enumerable: true, configurable: false, value: false },
    flipped: {
        get: function () {
            // If we get in here we know two things: a) *this* is NOT flipped and b) its flipped instance hasn't been constructed yet.
            // This is because in executing this getter we replace it (the very getter) by *this*' flipped instance:
            let _flipped = Object.create(this, {
                // isSwapped taken from prototype, ie. *this*
                isFlipped: { enumerable: true, configurable: false, value: true, /* shadows *this*' prototype's isFlipped */  },
                flipped:   { enumerable: true, configurable: false, value: this, /* shadows *this*' prototype's flipped */    },
            });
            Object.defineProperty(this,
                "flipped", { enumerable: true, configurable: false, value: _flipped } // configurable: false to prevent further changes
            );
            let x = _flipped.swapped; // call getter (from *this*) to set prop .swapped on _flipped (needs _flipped.flipped initialized!)

            _flipped = Object.freeze(_flipped); // let's freeze it to enforce that every write to it actually happens on *this*
            // Note: we DO NOT add _flipped to this.program.info!
            return _flipped;
        }
    },
    code: {
        get: function () {
            let n      = (this.program.BDDsize + "").length,
                m      = n + "swap(".length,
                o      = ("" + (this.program.BDDheight*2)).length,
                result = [" ".repeat(n) + ":", fmt(this.slot, n), "<-"];
            if (this.program.info.get(T) === this) {
                result.push("T");
            } else if (this.program.info.get(F) === this) {
                result.push("F");
            } else {
                result[0] = fmt(this.instruction, n) + ": ";
                result.push("[" + fmt(this.labelIndex, o) + "/+" + this.labelDelta + "],");
                if (this.swapThen) {
                    if (this.flipThen) {
                        result.push("flop(" + fmt(this.thenSlot, n) + "),");
                    } else {
                        result.push("swap(" + fmt(this.thenSlot, n) + "),");
                    }
                } else if (this.flipThen) {
                    result.push("flip(" + fmt(this.thenSlot, n) + "),");
                } else {
                    result.push(fmt(this.thenSlot, m) + " ,");
                }
                if (this.swapElse) {
                    if (this.flipElse) {
                        result.push("flop(" + fmt(this.elseSlot, n) + ")");
                    } else {
                        result.push("swap(" + fmt(this.elseSlot, n) + ")");
                    }
                } else if (this.flipElse) {
                    result.push("flip(" + fmt(this.elseSlot, n) + ")");
                } else {
                    result.push(fmt(this.elseSlot, m) + " ");
                }
            }
            result.push("// maxParent: ");
            result.push(this.maxParent);
            return result.join(' ');
        },
        enumerable: true,
    }
});

function addInfo(info, bdd, p, q) {
    let prg   = info.program,
        entry = Object.create(InfoEntry.prototype, {
            program:     { value: prg,               enumerable: false,  writable: false },
            labelIndex:  { value: prg.labelIdx(bdd), enumerable: true,   writable: false },
            parents:     { value: [],                enumerable: false,  writable: false },
        })
    ;

    info.set(bdd, entry);
    if (bdd.isTerminal) {
        let slot = p;
        // override inherited accessor slot:
        Object.defineProperty(entry, "slot", { value: slot, enumerable: true, writable: false });
    } else {
        let thenChild   = p,
            elseChild   = q,
            m           = Math.max(thenChild.labelIndex, elseChild.labelIndex),
            labelDelta  = entry.labelIndex - m,    //(m < 0) ? -labelIndex : labelIndex - m;
            pc          = prg.pushInfo(entry);
        Object.defineProperty(entry, "labelDelta",  { value: labelDelta, enumerable: true, writable: false });
        prg.labelDeltasRLE.add(labelDelta);
        entry.slot = prg.maxLen++;
        Object.defineProperty(entry, "instruction", { value: pc,         enumerable: true, writable: false });

        thenChild.parents.push(entry);
        Object.defineProperty(entry, "thenChild", { value: thenChild, enumerable: true, configurable: false });

        elseChild.parents.push(entry);
        Object.defineProperty(entry, "elseChild", { value: elseChild, enumerable: true, configurable: false });

    }
    return entry;
}

function serialize(bdd, opts) {
    opts = Object.assign({
        useSwap: true,
        useFlip: true,
        useFlop: true,
    }, opts || {});
    let result = new Program(bdd, opts);
    result.encodeSlots();
    return result;
}


function fromJSON(jsonTxt) {
    return new Program(JSON.parse(jsonTxt));
}

function deserialize(p) {
    if (util.isString(p)) {
        p = fromJSON(p);
    }
    return p.run(BDD.get);
}


module.exports = {
    serialize:   serialize,
    deserialize: deserialize,
    fromJSON:    fromJSON,
};


