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
    this.pushInfo = bdd => {
        let i = infoByIdx.length;
        infoByIdx[i] = bdd;
        return i;
    };
    this.info = info;
    info.program = this;
    addInfo(info, T, 0);
    addInfo(info, F, 1);

    if (BDD.isBDD(o)) {
        this.labels = [];
        this.maxLen = 2;
        this.instructions = [];
        Object.defineProperty(this, "instructionCount", { get: function () { return infoByIdx.length } });
        Object.defineProperty(this, "BDDsize",    { value: o.size,   enumerable: true });
        Object.defineProperty(this, "BDDheight",  { value: o.height, enumerable: true });
        if (o.isTerminal) {
            Object.defineProperty(this, "resultSlot", { value: info.get(o).slot, enumerable: true });
        } else {
            _serialize(o, this, opts);
        }
        Object.freeze(labels2Idx);
    } else if (util.isObject(o)) {
        this.labels = o.labels;
        this.maxLen = o.maxLen;
        this.instructions = o.code;
        this.instructionCount = o.code.length / 4; // XXX
        Object.defineProperty(this, "BDDsize",   { value: o.BDDsize,   enumerable: true });
        Object.defineProperty(this, "BDDheight", { value: o.BDDheight, enumerable: true });
        Object.defineProperty(this, "labelDeltas", {
            value: function () {
                return o.labelDeltas[Symbol.iterator](); // ATTENTION: just "value: o.labelDeltas[Symbol.iterator] does NOT work!!
            },
            enumerable: false
        });
        if (this.instructionCount === 0) {
            Object.defineProperty(this, "resultSlot", { value: o.resultSlot, enumerable: true });
        }
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

Object.defineProperty(Program.prototype, "swapCount", {
    get: function () {
        let result = 0;
        for (let i = 0; i < this.instructionCount; i++) {
            let instr = this.getInfo(i);
            if (instr.swapThen) result++;
            if (instr.swapElse) result++;
        }
        return result;
    }
});

Object.defineProperty(Program.prototype, "flipCount", {
    get: function () {
        let result = 0;
        for (let i = 0; i < this.instructionCount; i++) {
            let instr = this.getInfo(i);
            if (instr.flipThen) result++;
            if (instr.flipElse) result++;
        }
        return result;
    }
});

Object.defineProperty(Program.prototype, "flopCount", {
    get: function () {
        let result = 0;
        for (let i = 0; i < this.instructionCount; i++) {
            let instr = this.getInfo(i);
            if (instr.flipThen && instr.swapThen) result++;
            if (instr.flipElse && instr.swapElse) result++;
        }
        return result;
    }
});

Object.defineProperty(Program.prototype, "labelCount", {
    get: function () { return this.labels.length }
});

Object.defineProperty(Program.prototype, "resultSlot", {
    get: function () { return this.decode(this.instructionCount - 1, targetSlot => targetSlot); }
});

Object.defineProperty(Program.prototype, "labelDeltas", {
    value: function* () {
            let info = this.info,
                n    = this.instructionCount,
                i    = 0;
            while (i < n) {
                yield this.getInfo(i++).labelDelta;
            }
        }
});

Object.defineProperty(Program.prototype, "targetSlots", {
    value: function* () {
            let n    = this.instructionCount,
                i    = 0;
            while (i < n) {
                yield this.decode(i++, (targetSlot, label, thenSlot, elseSlot, labelIdx)  => targetSlot);
            }
        }
});

Object.defineProperty(Program.prototype, "thenSlots", {
    value: function* () {
            let n    = this.instructionCount,
                i    = 0;
            while (i < n) {
                yield this.decode(i++, (targetSlot, label, thenSlot, elseSlot, labelIdx)  => thenSlot);
            }
        }
});

Object.defineProperty(Program.prototype, "elseSlots", {
    value: function* () {
            let n    = this.instructionCount,
                i    = 0;
            while (i < n) {
                yield this.decode(i++, (targetSlot, label, thenSlot, elseSlot, labelIdx)  => elseSlot);
            }
        }
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
    let result = {
        maxLen:             this.maxLen,
        instructionCount:   this.instructionCount,
        swapCount:          this.swapCount,
        flipCount:          this.flipCount,
        flopCount:          this.flopCount,
        BDDsize:            this.BDDsize,
        BDDheight:          this.BDDheight,
        labelCount:         this.labelCount,
        JSONlength:         JSON.stringify(this).length,
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

    let labelDeltas = RLE.init(),
        thenOps     = RLE.init(),
        elseOps     = RLE.init(),
        srcOps      = RLE.init(),
        thenSwaps   = RLE.init(),
        thenFlips   = RLE.init(),
        elseSwaps   = RLE.init(),
        elseFlips   = RLE.init(),
        swapsFlips  = RLE.init(),
        swapsFlips2 = [],
        swapsFlips2_0 = RLE.init(),
        swapsFlips2_1 = RLE.init(),
        n = this.instructionCount; //    Math.min(1860, this.instructionCount),    //
    for (let i = 0; i < n; i++) {
        let x = 0,
            y = 0,
            info = this.getInfo(i);
        labelDeltas.add(info.labelDelta);
        if (info.swapThen) {
            x += 1;
            y += 1;
            thenSwaps.add(1);
            swapsFlips.add(1);
        } else {
            thenSwaps.add(0);
            swapsFlips.add(0);
        }
        if (info.flipThen) {
            x += 2;
            y += 2;
            thenFlips.add(1);
            swapsFlips.add(1);
        } else {
            thenFlips.add(0);
            swapsFlips.add(0);
        }
        thenOps.add(x);
        x = 0;
        if (info.swapElse) {
            x += 1;
            y += 4;
            elseSwaps.add(1);
            swapsFlips.add(1);
        } else {
            elseSwaps.add(0);
            swapsFlips.add(0);
        }
        if (info.flipElse) {
            x += 2;
            y += 8;
            elseFlips.add(1);
            swapsFlips.add(1);
        } else {
            elseFlips.add(0);
            swapsFlips.add(0);
        }
        elseOps.add(x);
        srcOps.add(y);
    }
    let x = 0;
    for (let c of swapsFlips.codes()) {
        if (c.isRepeat) {
            assert.same(c.value, x, "in repeat " + c.count);
            swapsFlips2.push(c.count);
            if (c.value === 0) {
                swapsFlips2_0.add(c.count);
            } else {
                swapsFlips2_1.add(c.count);
            }
        } else {
            let last = x,
                n    = 0;
            for (let v of c.values) {
                if (v !== last) {
                    swapsFlips2.push(n);
                    if (last === 0) {
                        swapsFlips2_0.add(n);
                    } else {
                        swapsFlips2_1.add(n);
                    }
                    n = 1;
                    last = v;
                    x = 1 - x;
                } else {
                    n++;
                }
            }
            refute.same(n, 0);
            swapsFlips2.push(n);
            if (last === 0) {
                swapsFlips2_0.add(n);
            } else {
                swapsFlips2_1.add(n);
            }
        }
        x = 1 - x;
    }
    return {
        maxLen:      this.maxLen,
        BDDsize:     this.BDDsize,
        BDDheight:   this.BDDheight,
        resultSlot:  this.resultSlot,
        labels:      this.labels,
        //labelDeltas: [...this.labelDeltas()],
        labelDeltas: labelDeltas,
        "thenOps+elseOps":  thenOps.encodedLength + elseOps.encodedLength,
        srcOps:             srcOps.encodedLength,
        "thenSwaps+thenFlips+elseSwaps+elseFlips": thenSwaps.encodedLength + thenFlips.encodedLength + elseSwaps.encodedLength + elseFlips.encodedLength,
        swapsFlips:  swapsFlips.encodedLength,
        swapsFlips2:  swapsFlips2.length + "/" + JSON.stringify(swapsFlips2),
        swapsFlips2_0:  swapsFlips2_0.encodedLength + "/max:" + swapsFlips2_0.maxValue + "/" + JSON.stringify(swapsFlips2_0),
        swapsFlips2_1:  swapsFlips2_1.encodedLength + "/max:" + swapsFlips2_1.maxValue + "/" + JSON.stringify(swapsFlips2_1),

        code:        this.instructions,   //  is,     //
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
    let maxLen   = 2, // current maximal length of xs
        reusable = {}, // at each step, which slots in xs can be reused?
        recycle  = (slot, at) => {
            let entry = reusable[at];
            if (entry === undefined) {
                reusable[at] = [slot];
            } else {
                entry.push(slot);
            }
        },
        reusableNow = [],
        lastNewTargetSlot = 1,
        info;
    info = this.info.get(T); recycle(info.slot, info.maxParent);
    info = this.info.get(F); recycle(info.slot, info.maxParent);

    for (let i = 0; i < n; i++) {
        this.decode(i, (targetSlot, label, thenSlot, elseSlot) => {
            let info = this.getInfo(i),
                newTargetSlot,
                maxP = info.maxParent,
                lifeTime = maxP - i,
                u = reusable[i];
            if (u === undefined) {
                if (reusableNow.length === 0) {
                    newTargetSlot = maxLen++;
                } else {
                    newTargetSlot = reusableNow.pop();
                }
            } else {
                newTargetSlot = u.pop();
                reusableNow.push(...u);
                delete reusable[i]; // not needed anymore
            }
            recycle(newTargetSlot, maxP); // this one will be needed until maxP

            onInstr(maxLen, info, newTargetSlot, reusableNow, newTargetSlot - lastNewTargetSlot);

            lastNewTargetSlot = newTargetSlot;
        });
    }
    return onEnd(maxLen);
};

Program.prototype.optimize = function () {
    this.traverse(
        /* onInstr: */ (maxLen, info, newTargetSlot) => { info.slot = newTargetSlot; },  // change target slot (if different); subsequent occurrences are fixed in the setter
        /* onEnd:   */ (maxLen) => { this.maxLen = maxLen; }
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
        /* onInstr: */ (maxLen, info, newTargetSlot, reusable, tgtDelta) => {
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
                    (newTargetSlot === targetSlot ? "-" : "[" + targetSlot + "->" + newTargetSlot + "] @ " + i + "," + info.parents.join(','))
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

            entry = addInfo(prg.info, bdd);   // in there: targetSlot is set to prg.maxLen++
            thenInfo.addThenParent(entry);
            elseInfo.addElseParent(entry);
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

function addParent(parentEntry, isThenChild) {
    let child = this,
        i     = parentEntry.instruction;
    child.parents.push(i);
    child.maxParent = Math.max(child.maxParent, i);
    child.minParent = Math.min(child.minParent, i);
    Object.defineProperty(parentEntry,
        isThenChild ? "thenChild" : "elseChild",
        { get: () => child, enumerable: true, configurable: false }
    );
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
    addThenParent: { value: function (parentEntry) { addParent.call(this, parentEntry, true ) } },
    addElseParent: { value: function (parentEntry) { addParent.call(this, parentEntry, false) } },
    thenSlot:      { get: function () { return this.thenChild.slot; },      enumerable: true, configurable: false },
    elseSlot:      { get: function () { return this.elseChild.slot; },      enumerable: true, configurable: false },
    swapThen:      { get: function () { return this.thenChild.isSwapped; }, enumerable: true, configurable: false },
    swapElse:      { get: function () { return this.elseChild.isSwapped; }, enumerable: true, configurable: false },
    flipThen:      { get: function () { return this.thenChild.isFlipped; }, enumerable: true, configurable: false },
    flipElse:      { get: function () { return this.elseChild.isFlipped; }, enumerable: true, configurable: false },

    isSwapped:     { enumerable: true, configurable: false, value: false },
    swapped: {
        get: function () {
            // If we get in here we know two things: a) *this* is NOT swapped and b) its swapped instance hasn't been constructed yet.
            // This is because in executing this getter we replace it (the very getter) by *this*' swapped instance:
            let _swapped = Object.create(this, {
                // isFlipped taken from prototype, ie. *this*
                isSwapped: { enumerable: true, configurable: false, value: true, /* shadows *this*' prototype's isSwapped */  },
                swapped:   { enumerable: true, configurable: false, value: this, /* shadows *this*' prototype's swapped */    },
                maxParent: { enumerable: true, configurable: false, get: () => this.maxParent, set: p => (this.maxParent = p) },
                minParent: { enumerable: true, configurable: false, get: () => this.minParent, set: p => (this.minParent = p) },
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
                maxParent: { enumerable: true, configurable: false, get: () => this.maxParent, set: p => (this.maxParent = p) },
                minParent: { enumerable: true, configurable: false, get: () => this.minParent, set: p => (this.minParent = p) },
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
            return result.join(' ');
        },
        enumerable: true,
    }
});

function addInfo(info, bdd, slot) {
    let prg   = info.program,
        entry = Object.create(InfoEntry.prototype, {
            program:     { value: prg,          enumerable: false,  writable: false },
            parents:     { value: [],           enumerable: false,  writable: false },
            maxParent:   { value: -Infinity,    enumerable: true,   writable: true  },
            minParent:   { value: +Infinity,    enumerable: true,   writable: true  },
            readAt:      { value: [],           enumerable: false,  writable: false },
        })
    ;

    info.set(bdd, entry);
    if (bdd.isTerminal) {
        // override inherited accessor slot:
        Object.defineProperty(entry, "slot", { value: slot, enumerable: true, writable: false });
    } else {
        let t  = bdd.onTrue,
            e  = bdd.onFalse,
            m  = Math.max(prg.labelIdx(t), prg.labelIdx(e)),
            labelIndex = prg.labelIdx(bdd),
            labelDelta = labelIndex - m;    //(m < 0) ? -labelIndex : labelIndex - m;
        Object.defineProperty(entry, "labelIndex",  { value: labelIndex, enumerable: true, writable: false });
        Object.defineProperty(entry, "labelDelta",  { value: labelDelta, enumerable: true, writable: false });
        entry.slot = prg.maxLen++;
        Object.defineProperty(entry, "instruction", {
            value: prg.pushInfo(entry),
            enumerable: true,
            writable: false
        });

    }
    return entry;
}

function serialize(bdd, opts) {
    opts = Object.assign({
        useSwap: false,
        useFlip: false,
        useFlop: false,
    }, opts || {});
    return new Program(bdd, opts);
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


