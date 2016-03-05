"use strict";

const util   = require('util');

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
        let label  = bdd.label,
            result = labels2Idx[label];
        if (result === undefined) {
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
        } else {
            let labels2Idx = {};
            _serialize(o, this);
        }
    } else if (util.isObject(o)) {
        this.labels = o.labels;
        this.maxLen = o.maxLen;
        this.instructions = o.code;
        if (this.instructionCount === 0) {
            Object.defineProperty(this, "resultSlot", { value: o.resultSlot, enumerable: true });
        }
    } else {
        throw new TypeError("expected a BDD or JSON - got ", util.inspect(o));
    }
}

Program.prototype.decode = function (i, cb) {
    let j          = i * 4,
        is         = this.instructions,
        targetSlot = is[j++],
        labelIdx   = is[j++],
        label      = this.labels[labelIdx],
        thenSlot   = is[j++],
        elseSlot   = is[j++];
    return cb(targetSlot, label, thenSlot, elseSlot, labelIdx);
};

Object.defineProperty(Program.prototype, "instructionCount", {
    get: function () { return this.instructions.length / 4 }
});

Object.defineProperty(Program.prototype, "BDDsize", {
    get: function () { let n = this.instructionCount; return n == 0 ? 1 : n + 2; }
});

Object.defineProperty(Program.prototype, "resultSlot", {
    get: function () { return this.decode(this.instructionCount - 1, targetSlot => targetSlot); }
});

Program.prototype.init = function (cb) {
    let xs = new Array(this.maxLen),
        i;
    i = this.info.get(T); xs[i.slot] = T;
    i = this.info.get(F); xs[i.slot] = F;
    return xs;
};
Program.prototype.run = function (cb) {
    for (let i = 0, n = this.instructionCount; i < n; i++) {
        this.decode(i, cb);
    }
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
        maxLen:     this.maxLen,
        BDDsize:    this.BDDsize,
        labels:     this.labels,
        resultSlot: this.resultSlot,
        code:       this.instructions,   //  is,     //
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

Program.prototype.traverse = function (chooseTarget, onAfter, onEnd) {
    let n = this.instructionCount;
    if (n === 0) {    // trivial: terminal BDD
        return onEnd(this.maxLen);
    }
    let i        = 0, // instruction counter
        maxLen   = 2, // current maximal length of xs
        reusable = {}, // at each step, which slots in xs can be reused?
        recycle  = (slot, at) => {
            let entry = reusable[at];
            if (entry === undefined) {
                reusable[at] = [slot];
            } else {
                entry.push(slot);
            }
        },
        reusableNow, info, newTargetSlot;
    info = this.info.get(T); recycle(info.slot, info.maxParent);
    info = this.info.get(F); recycle(info.slot, info.maxParent);
    reusableNow = {};
    Object.defineProperties(reusableNow, {
        add:    { value: function (x)  { this[x] = true; return this; },    enumerable: false, writable: false },
        delete: { value: function (x)  { delete this[x]; },                 enumerable: false, writable: false },
        addAll: {
            value: function (xs) {
                if (xs !== undefined) {
                    for (let x of xs) {
                        this.add(x);
                    }
                    //xs.forEach(x => this.add(x));
                }
            },
            enumerable: false,
            writable: false,
        },
        has: { value: function (x)  { return this[x] === true; }, enumerable: false, writable: false },
    });
    this.run((targetSlot, label, thenSlot, elseSlot) => {
        info = this.info.get(i);
        reusableNow.addAll(reusable[i]);

        newTargetSlot = chooseTarget(maxLen, info, Object.keys(reusableNow).map(x => +x));
        if (!(Number.isSafeInteger(newTargetSlot) && ((newTargetSlot === maxLen) || (reusableNow.has(newTargetSlot))))) {
            throw new TypeError("invalid newTargetSlot returned: " + util.inspect(newTargetSlot) + " / choices: " + maxLen + " + [" + Object.keys(reusableNow).join(', ') + "]");
        }
        maxLen = Math.max(newTargetSlot + 1, maxLen);
/*
        if (reusable[i + 1] !== undefined) {
            Object.keys(reusable[i + 1]).forEach(slot => {
                slot = +slot;
                if (!((slot >= 0) && (slot <= maxLen))) {
                    throw new Error("newTargetSlot=" + newTargetSlot + ", maxLen=" + maxLen + ", i=" + i + util.inspect(reusable));
                }
            });
        }
*/
        reusableNow.delete(newTargetSlot);  // remove newTargetSlot from reusableNow:
        delete reusable[i]; // not needed anymore
        recycle(newTargetSlot, info.maxParent); // this one will be needed until maxP

        onAfter(maxLen, info, newTargetSlot);

        i++;
    });
    return onEnd(maxLen);
};

function bestNewTarget(lastTargetSlot, choices) {
    return Math.min.apply(null, choices); // choose minimum slot (doesn't really matter)
    return Math.max.apply(null, choices); // choose maximum slot (doesn't really matter)
    let i         = 0,
        best      = choices[i++],
        bestDelta = Math.abs(best - lastTargetSlot);
    while (i < choices.length) {
        let c = choices[i++],
            d = Math.abs(c - lastTargetSlot);
        if (d < bestDelta) {
            best = c;
            bestDelta = d;
        }
    }
    return best;
}

Program.prototype.optimize = function () {
    this.traverse(
        /* chooseTarget: */ (maxLen, info, reusable)      => Math.min(maxLen, ...reusable),   //     reusable.length > 0 ? reusable[0] : maxLen,    //
        /* onAfter:      */ (maxLen, info, newTargetSlot) => { info.slot = newTargetSlot; },  // change target slot (if different); subsequent occurrences are fixed in the setter
        /* onEnd:        */ (maxLen)                      => { this.maxLen = maxLen; }
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
        ],
        usableStr, mark;
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
        /* chooseTarget: */ (maxLen, info, reusable) => {
            let remainingInstrs = this.instructionCount - info.instruction - 1;
            usableStr = reusable.join(','); //  util.inspect(reusable); //
            mark = remainingInstrs <= reusable.length - 1 ? "*" : " ";
            return Math.min(maxLen, ...reusable);
        },
        /* onAfter: */ (maxLen, info, newTargetSlot) => {
            let i    = info.instruction,
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
                util.format("/* %s %s*/ g[%s](%s, %s, %s); // minP: %s, maxP: %s, maxLen: %s, usable: [%s], subst: %s",
                    mark,
                    fmt(i, o), // instruction nr
                    fmt(labelIdx, m), fmt(targetSlot, n), fmt(thenSlot, n), fmt(elseSlot, n),
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

function _serialize(bdd, prg) {
    let entry = prg.info.get(bdd);
    if (entry === undefined) {
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
    }
    return entry;
}

function InfoEntry() {
}

function addParent(parentEntry, isThenChild) {
    let i = parentEntry.instruction,
        k = i * 4 + (isThenChild ? 2 : 3);     // XXX
    this.parents.push(i);
    this.maxParent = Math.max(this.maxParent, i);
    this.minParent = Math.min(this.minParent, i);
    this.readAt.push(k);
    this.program.instructions[k] = this.slot;     // XXX
}

Object.defineProperties(InfoEntry.prototype, {
    slot:      { get: function () { return this.program.decode(this.instruction, targetSlot => targetSlot) },
                 set: function (s) {
                        if (s !== this.slot) {
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
});

function addInfo(info, bdd, slot) {
    let prg   = info.program,
        entry = Object.create(InfoEntry.prototype, {
            program:     { value: prg,          enumerable: true,  writable: false },
            parents:     { value: [],           enumerable: false,  writable: false },
            maxParent:   { value: -Infinity,    enumerable: true,   writable: true  },
            minParent:   { value: +Infinity,    enumerable: true,   writable: true  },
            readAt:      { value: [],           enumerable: false,  writable: false },
        })
    ;

    info.set(bdd, entry);
    if (bdd.isTerminal) {
        Object.defineProperty(entry, "slot", { value: slot, enumerable: true, writable: false });
    } else {
        let i = prg.instructionCount;
        Object.defineProperty(entry, "instruction", { value: i, enumerable: true, writable: false });
        prg.instructions[i * 4 + 0] = prg.maxLen++;         // XXX: set targetSlot
        prg.instructions[i * 4 + 1] = prg.labelIdx(bdd);    // XXX: set labelIdx
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
    let xs = p.init();
    p.run((targetSlot, label, thenSlot, elseSlot) => {
        xs[targetSlot] = ite(BDD.var(label), xs[thenSlot], xs[elseSlot]);
    });
    return xs[p.resultSlot];
}


module.exports = {
    serialize:   serialize,
    deserialize: deserialize,
};
