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

function Program(bdd) {
    let info = new Map();
    addInfo(info, T, 0);
    addInfo(info, F, 1);
    this.info = info;
    info.program = this;

    this.labels = [];
    this.maxLen = 2;
    this.instructions = [];
    if (bdd.isTerminal) {
        Object.defineProperty(this, "resultSlot", { value: info.get(bdd).slot, enumerable: true });
    } else {
        let labels2Idx = {};
        _serialize(bdd, this, labels2Idx, info);
    }
}

Object.defineProperty(Program.prototype, "instructionCount", {
    get: function () { return this.instructions.length / 4 }
});

Object.defineProperty(Program.prototype, "resultSlot", {
    get: function () { return this.info.get(this.instructionCount - 1).slot }
});

Program.prototype.init = function (cb) {
    let xs = new Array(this.maxLen),
        i;
    i = this.info.get(T); xs[i.slot] = T;
    i = this.info.get(F); xs[i.slot] = F;
    return xs;
};
Program.prototype.decode = function (j, cb) {
    let is         = this.instructions,
        targetSlot = is[j++],
        labelIdx   = is[j++],
        label      = this.labels[labelIdx],
        thenSlot   = is[j++],
        elseSlot   = is[j++];
    cb(targetSlot, label, thenSlot, elseSlot, labelIdx);
    return j;
};
Program.prototype.run = function (cb) {
    let j  = 0,
        n  = this.instructions.length;  // XXX
    while (j < n) {
        j = this.decode(j, cb);
    }
};
Program.prototype.toString = function () {
    let i      = 0, // instruction counter
        n      = (this.maxLen + "").length,
        m      = (this.labels.length + "").length,
        o      = (this.instructionCount + "").length,
        result = ["let _ = new Array(" + this.maxLen + "),  // BDD.size = " + (this.instructionCount + 2),
                  "    g = " + JSON.stringify(this.labels),
                  "      .map(l => (s,t,e) => { _[s] = get(l, _[t], _[e]) });",
        ],
        len = 0;

    let usable = new Array(this.instructionCount + 1),
        info, minP, maxP, newTargetSlot,
        recycle = (slot, at) => {
            let entry = usable[at];
            if (entry === undefined) {
                usable[at] = [slot];
            } else {
                entry.push(slot);
            }
        };
        [T, F].forEach(bdd => {
            info = this.info.get(bdd),
            maxP = info.maxParent;
            minP = info.minParent;
            recycle(len, maxP);
            result.push(
                util.format("%s_[%s] = %s; %s// %s  { minP: %s, maxP: %s }",
                    fmt("", 2 + m),
                    fmt(len, n), // targetSlot
                    bdd.toString(),
                    fmt("", 2*n),
                    fmt("", o),
                    fmt(minP, n),
                    fmt(maxP, n)
                )
            );
            len++;
        });

    this.run((targetSlot, label, thenSlot, elseSlot, labelIdx) => {
        info = this.info.get(i),
        maxP = info.maxParent;
        minP = info.minParent;
        let entry = usable[i] || [],
            usableStr = entry.join(',');
        if (entry.length > 0) {
            newTargetSlot = Math.min.apply(null, entry);
            entry.forEach(slot => {
                if (slot !== newTargetSlot) {
                    recycle(slot, i + 1);
                }
            });
        } else {
            newTargetSlot = len++;
        }
        recycle(newTargetSlot, maxP);
        result.push(
            util.format("g[%s](%s, %s, %s); // %s: { minP: %s, maxP: %s, len: %s, usable: [%s], subst: %s }",
                fmt(labelIdx, m), fmt(targetSlot, n), fmt(thenSlot, n), fmt(elseSlot, n),
                fmt(i, o), // instruction nr
                fmt(minP, n),
                fmt(maxP, n),
                fmt(len, n),
                usableStr,
                (newTargetSlot === targetSlot ? "-" : "[" + targetSlot + "->" + newTargetSlot + "] @ " + i + "," + info.parents.join(','))
            )
        );
        i++;
    });
    result.push("return _[" + this.resultSlot + "];");
    return result.join("\n");
};
Program.prototype.optimize = function () {
    let n = this.instructionCount;
    if (n === 0) {    // trivial: terminal BDD
        return this;
    }
    let i       = 0, // instruction counter
        maxLen  = 2, // current maximal length of xs
        usable  = new Array(n + 1), // at each step, which slots in xs can be reused?
        recycle = (slot, at) => {
            let entry = usable[at];
            if (entry === undefined) {
                usable[at] = [slot];
            } else {
                entry.push(slot);
            }
        },
        info, maxP, newTargetSlot;
    info = this.info.get(T); recycle(info.slot, info.maxParent);
    info = this.info.get(F); recycle(info.slot, info.maxParent);

    this.run((targetSlot, label, thenSlot, elseSlot) => {
        info = this.info.get(i);
        maxP = info.maxParent;
        let entry = usable[i];
        if (entry !== undefined) { // we can re-use a slot
            newTargetSlot = Math.min.apply(null, entry); // choose minimum slot (doesn't really matter)
            entry.forEach(slot => { // copy over the remaining usable slots to next iteration
                if (slot !== newTargetSlot) {
                    recycle(slot, i + 1);
                }
            });
        } else {
            newTargetSlot = maxLen++;
        }
        recycle(newTargetSlot, maxP); // this one will be needed until maxP
        info.slot = newTargetSlot;  // change target slot (if different); subsequent occurrences are fixed in the setter
        i++;
    });
    this.maxLen = maxLen;
    return this;
};

function _serialize(b, p, labels2Idx) {
    let entry = p.info.get(b);
    if (entry === undefined) {
        let labelIdx = labels2Idx[b.label];
        if (labelIdx === undefined) {
            labelIdx = p.labels.length;
            p.labels.push(b.label);
            labels2Idx[b.label] = labelIdx;
        }
        let onTrue  = b.onTrue,
            onFalse = b.onFalse,
            thenInfo,
            elseInfo;
        //if (b.onTrue.satPathCount > b.onFalse.satPathCount) { // (10: >: 285/296  | <: 288/315) / (9: >: 149/156 | <: 154/148 | t,e: 147/158 | e,t: 159/147)
        //    thenInfo = _serialize(onTrue,  p, labels2Idx);
        //    elseInfo = _serialize(onFalse, p, labels2Idx);
        //} else {
            elseInfo = _serialize(onFalse, p, labels2Idx);
            thenInfo = _serialize(onTrue,  p, labels2Idx);
        //}

        let i          = p.instructionCount,
            targetSlot = p.maxLen++;
        p.instructions.push(targetSlot);    // XXX
        p.instructions.push(labelIdx);    // XXX
        p.instructions.push(thenInfo.slot);    // XXX
        p.instructions.push(elseInfo.slot);    // XXX

        entry = addInfo(p.info, b, targetSlot, i);
        thenInfo.addThenParent(entry);
        elseInfo.addElseParent(entry);
    }
    return entry;
}

function InfoEntry() {
}

Object.defineProperties(InfoEntry.prototype, {
    slot:      { get: function () { return this.program.instructions[this.instruction * 4] },     // XXX
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
    addThenParent: { value: function (entry) {
                                let i = entry.instruction,
                                    thenIdx = i * 4 + 2;  // XXX
                                this.parents.push(i);
                                this.maxParent = Math.max(this.maxParent, i);
                                this.minParent = Math.min(this.minParent, i);
                                this.readAt.push(thenIdx);
                            },
                   },
    addElseParent: { value: function (entry) {
                                let i = entry.instruction,
                                    elseIdx = i * 4 + 3;  // XXX
                                this.parents.push(i);
                                this.maxParent = Math.max(this.maxParent, i);
                                this.minParent = Math.min(this.minParent, i);
                                this.readAt.push(elseIdx);
                            },
                   },
});

function addInfo(info, bdd, slot, instruction) {
    let program = info.program,
        entry = Object.create(InfoEntry.prototype, {
            program:     { value: program,      enumerable: false,  writable: false },
            instruction: { value: instruction,  enumerable: true,   writable: false },
            parents:     { value: [],           enumerable: false,  writable: false },
            maxParent:   { value: -Infinity,    enumerable: true,   writable: true  },
            minParent:   { value: +Infinity,    enumerable: true,   writable: true  },
            readAt:      { value: [],           enumerable: false,  writable: false },
        })
    ;

    info.set(bdd, entry);
    if (instruction === undefined) {
        Object.defineProperty(entry, "slot", { value: slot, enumerable: true, writable: false });
    } else {
        info.set(instruction, entry);
    }
    return entry;
}

function serialize(bdd) {
    return new Program(bdd);
}


function deserialize(p) {
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
