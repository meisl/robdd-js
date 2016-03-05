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
    let i       = 0, // instruction counter
        maxLen  = 2, // current maximal length of xs
        usable  = {}, // at each step, which slots in xs can be reused?
        recycle = (slot, at) => {
            let entry = usable[at];
            if (entry === undefined) {
                usable[at] = [slot];    //{ slot: true };
            } else {
                entry.push(slot);
                //entry[slot] = true;
            }
            return entry;
        },
        info, maxP, newTargetSlot,
        lastTargetSlot = 0;
    info = this.info.get(T); recycle(info.slot, info.maxParent);
    info = this.info.get(F); recycle(info.slot, info.maxParent);

    this.run((targetSlot, label, thenSlot, elseSlot) => {
        info = this.info.get(i);
        let entry = usable[i] || []; //{ maxLen: true };

        newTargetSlot = chooseTarget(maxLen, info, entry);  //Object.keys(entry));
        maxLen = Math.max(newTargetSlot, maxLen - 1) + 1;
        // remove newTargetSlot from entry:
        for (let i = 0, n = entry.length; i < n; i++) {
            if (entry[i] === newTargetSlot) {
                if (i < n - 1) {
                    entry[i] = entry.pop();
                } else {
                    entry.pop();
                }
                break;
            }
        }
        // now pull over the remaining usable slots to next iteration
        let next = usable[i + 1];
        if (next === undefined) {
            if (entry.length > 0) {
                usable[i + 1] = entry;
            }
        } else { // push contents from smaller onto larger
            if (next.length < entry.length) {
                entry.push(...next);
                usable[i + 1] = entry;
            } else {
                next.push(...entry);
            }
        }
        /*
        if (usable[i + 1] !== undefined) {
            usable[i + 1].forEach(slot => {
                if (!((slot >= 0) && (slot < maxLen))) {
                    throw new Error("i=" + i + util.inspect(usable));
                }
            });
        }
        */
        delete usable[i]; // don't need this anymore
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
        /* chooseTarget: */ (maxLen, info, reusable)      => reusable.length > 0 ? reusable[0] : maxLen,    //  Math.min(maxLen, ...reusable),   //
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
        usableStr;
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
            usableStr = reusable.join(',');
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
                util.format("g[%s](%s, %s, %s); // %s: { minP: %s, maxP: %s, maxLen: %s, usable: [%s], subst: %s }",
                    fmt(labelIdx, m), fmt(targetSlot, n), fmt(thenSlot, n), fmt(elseSlot, n),
                    fmt(i, o), // instruction nr
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
