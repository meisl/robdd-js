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

function fmt(x, n) {
    let result = "" + x;
    if (result.length < n) {
        result = " ".repeat(n - result.length) + result;
    }
    return result;
}

function Program(o) {
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
    this.info = info;
    info.program = this;
    addInfo(info, T, 0);
    addInfo(info, F, 1);

    if (BDD.isBDD(o)) {
        this.labels = [];
        this.maxLen = 2;
        this.instructions = [];
        if (o.isTerminal) {
            Object.defineProperty(this, "resultSlot", { value: info.get(o).slot, enumerable: true });
            Object.defineProperty(this, "BDDsize",    { value: 1,                enumerable: true });
        } else {
            Object.defineProperty(this, "BDDsize",    { value: o.size,           enumerable: true });
            _serialize(o, this);
        }
        Object.freeze(labels2Idx);
    } else if (util.isObject(o)) {
        this.labels = o.labels;
        this.maxLen = o.maxLen;
        this.instructions = o.code;
        Object.defineProperty(this, "BDDsize", { value: o.BDDsize, enumerable: true });
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
        throw new TypeError("expected a BDD or JSON - got ", util.inspect(o));
    }
}

Program.prototype.decode = function (i, cb) {
    let targetSlot,
        labelIdx,
        thenSlot, swapThen = false,
        elseSlot, swapElse = false,
        entry = this.info.get(i);
    if (entry) {
        targetSlot = entry.slot;
        labelIdx   = entry.labelIndex;
        thenSlot   = entry.thenSlot;
        elseSlot   = entry.elseSlot;
        swapThen   = entry.swapThen;
        swapElse   = entry.swapElse;
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
    return cb(targetSlot, label, thenSlot, elseSlot, labelIdx, swapThen, swapElse);
};

Object.defineProperty(Program.prototype, "instructionCount", {
    get: function () { return this.instructions.length / 4 }
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
                yield info.get(i++).labelDelta;
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
        deltasIt  = self.labelDeltas();
    for (let i = 0; i < n; i++) {
        this.decode(i, function (targetSlot, _label, thenSlot, elseSlot, _labelIdx, swapThen, swapElse) {
            let nextDelta = deltasIt.next(),
                m         = Math.max(labelIdxs[thenSlot], labelIdxs[elseSlot]),
                labelIdx,
                label,
                thenChild,
                elseChild;
            assert.same(nextDelta.done, false, "ran out of labelDeltas at i=" + i + " of " + n + " instructions " + self.instructions + "/" + util.inspect([...self.labelDeltas()]));
            labelIdx = nextDelta.value + m;
            assert.same(labelIdx, _labelIdx, "labelIdx at instruction " + i
                + " / nextDelta.value=" + nextDelta.value
                + " / m=" + m
                + " / thenSlot=" + thenSlot
                + " / elseSlot=" + elseSlot
                + " / labelIdxs so far: [" + labelIdxs.join(',') + "]"
                + " / labels: [" + self.labels.join(',') + "]"
                + " / instructions: [" + self.instructions.join(',') + "]"
            );
            label = self.labels[labelIdx];
            assert.same(label, _label);
            thenChild = swapThen ? swap(results[thenSlot]) : results[thenSlot];
            elseChild = swapElse ? swap(results[elseSlot]) : results[elseSlot];
            results  [targetSlot] = cb(label, thenChild, elseChild);
            labelIdxs[targetSlot] = labelIdx;
        });
    }
    return results[self.resultSlot];
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
        maxLen:      this.maxLen,
        BDDsize:     this.BDDsize,
        resultSlot:  this.resultSlot,
        labels:      this.labels,
        labelDeltas: [...this.labelDeltas()],
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
            let info = this.info.get(i),
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
                    fmt(labelIdx, m), fmt(targetSlot, n), fmt(thenSlot, n), fmt(elseSlot, n),
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


let useSwap = true;

function _serialize(bdd, prg) {
    let entry;
    if (!(entry = prg.info.get(bdd))) {
        if (useSwap && (entry = prg.info.get(swap(bdd)))) {
            entry = entry.swapped;
        } else {
            let thenInfo,
                elseInfo;
            //if (bdd.onTrue.satPathCount > bdd.onFalse.satPathCount) { // (10: >: 285/296  | <: 288/315) / (9: >: 149/156 | <: 154/148 | t,e: 147/158 | e,t: 159/147)
            //    thenInfo = _serialize(bdd.onTrue,  prg);
            //    elseInfo = _serialize(bdd.onFalse, prg);
            //} else {
                thenInfo = _serialize(bdd.onTrue,  prg);
                elseInfo = _serialize(bdd.onFalse, prg);
            //}

            entry = addInfo(prg.info, bdd);   // in there: targetSlot is set to prg.maxLen++
            thenInfo.addThenParent(entry);
            elseInfo.addElseParent(entry);
            //console.log(">>>> " + entry.code);

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
        i     = parentEntry.instruction,
        k     = i * 4 + (isThenChild ? 2 : 3);     // XXX
    child.parents.push(i);
    child.maxParent = Math.max(child.maxParent, i);
    child.minParent = Math.min(child.minParent, i);
    child.readAt.push(k);
    child.program.instructions[k] = child.slot;     // XXX
    Object.defineProperty(parentEntry,
        isThenChild ? "thenSlot" : "elseSlot",
        { get: () => child.slot, enumerable: true, configurable: false }
    );
    Object.defineProperty(parentEntry,
        isThenChild ? "swapThen" : "swapElse",
        { get: () => child.isSwapped, enumerable: true, configurable: false }
    );
}

Object.defineProperties(InfoEntry.prototype, {
    slot:      { get: function () {
                        return this._slot;
                        //return this.program.decode(this.instruction, targetSlot => targetSlot)
                      },
                 set: function (s) {
                        if (s !== this.slot) {
                            Object.defineProperty(this, "_slot", { value: s, enumerable: false, writable: true });
                            let is = this.program.instructions;
                            is[this.instruction * 4] = s;    // XXX
                            // fix subsequent uses
                            for (let j of this.readAt) {
                                is[j] = s;                   // XXX
                            };
                        }
                        return s;
                    },
                 enumerable: true,
               },
    instruction:   { get: function () { throw new Error("no instruction for " + util.inspect(this)); } },
    addThenParent: { value: function (parentEntry) { addParent.call(this, parentEntry, true ) } },
    addElseParent: { value: function (parentEntry) { addParent.call(this, parentEntry, false) } },
    swapped: {
        get: function () {
            if (this._swapped === undefined) {
                Object.defineProperty(this, "_swapped", {
                    value: Object.freeze( // let's freeze it to enforce that every write to it actually happens on *this*
                        Object.create(this, {
                            isSwapped: { enumerable: true, value: true,               },
                            _swapped:  { enumerable: true, value: this,               },
                            maxParent: { enumerable: true, get: () => this.maxParent, set: p => (this.maxParent = p) },
                            minParent: { enumerable: true, get: () => this.minParent, set: p => (this.minParent = p) },
                        })
                    ),
                    enumerable: true,
                });
                // Note: DO NOT add to this.program.info!
            }
            return this._swapped;
        }
    },
    code: {
        get: function () {
            let n      = (this.program.BDDsize + "").length,
                m      = n + "swap(".length,
                result = [" ".repeat(n) + ":", fmt(this.slot, n), "<-"];
            if (this.program.info.get(T) === this) {
                result.push("T");
            } else if (this.program.info.get(F) === this) {
                result.push("F");
            } else {
                result[0] = fmt(this.instruction, n) + ":";
                result.push("[" + this.labelIndex + "/+" + this.labelDelta + "],");
                result.push(
                    (this.swapThen
                        ? "swap(" + fmt(this.thenSlot, n) + ")"
                        :           fmt(this.thenSlot, m) + " "
                    ) + ","
                );
                result.push(
                    (this.swapElse
                        ? "swap(" + fmt(this.elseSlot, n) + ")"
                        :           fmt(this.elseSlot, m) + " "
                    )
                );
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
            isSwapped:   { value: false,        enumerable: true,   writable: false },
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
        let i  = prg.instructionCount,
            t  = bdd.onTrue,
            e  = bdd.onFalse,
            m  = Math.max(prg.labelIdx(t), prg.labelIdx(e)),
            labelIndex = prg.labelIdx(bdd),
            labelDelta = labelIndex - m;    //(m < 0) ? -labelIndex : labelIndex - m;
        Object.defineProperty(entry, "instruction", { value: i,          enumerable: true, writable: false });
        Object.defineProperty(entry, "labelIndex",  { value: labelIndex, enumerable: true, writable: false });
        Object.defineProperty(entry, "labelDelta",  { value: labelDelta, enumerable: true, writable: false });
        slot = prg.maxLen++;
        entry.slot = slot;
        prg.instructions[i * 4 + 0] = slot;         // XXX: set targetSlot
        prg.instructions[i * 4 + 1] = labelIndex;   // XXX: set labelIdx
        info.set(i, entry);
    }
    return entry;
}

function serialize(bdd) {
    return new Program(bdd);
}


function deserialize(p) {
    if (util.isString(p)) {
        p = new Program(JSON.parse(p));
    }
    return p.run(BDD.get);
}


module.exports = {
    serialize:   serialize,
    deserialize: deserialize,
};
