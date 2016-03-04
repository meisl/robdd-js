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

function Program() {
    this.labels = [];
    this.maxLen = 2;
    this.instructions = [];
    this.resultSlot = 0;
}

Program.prototype.init = function (cb) {
    let xs = new Array(this.maxLen);
    xs[0] = T;
    xs[1] = F;
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
        n  = this.instructions.length;
    while (j < n) {
        j = this.decode(j, cb);
    }
};
Program.prototype.toString = function () {
    let i      = 0, // instruction counter
        n      = (this.maxLen + "").length,
        m      = (this.labels.length + "").length,
        o      = ((this.instructions.length / 4) + "").length,
        result = ["let _ = new Array(" + this.maxLen + "),  // BDD.size = " + ((this.instructions.length / 4) + 2),
                  "    g = " + JSON.stringify(this.labels),
                  "      .map(l => (s,t,e) => { _[s] = get(l, _[t], _[e]) });",
        ],
        len = 0,
        k = (this.instructions.length / 4) + 1;

    let usable = new Array(k),
        info, maxP, newTargetSlot,
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
            recycle(len, maxP);
            result.push(
                util.format("%s_[%s] = %s; %s// %s  { maxP: %s }",
                    fmt("", 2 + m),
                    fmt(len, n), // targetSlot
                    bdd.toString(),
                    fmt("", 2*n),
                    fmt("", o),
                    fmt(maxP, n)
                )
            );
            len++;
        });

    this.run((targetSlot, label, thenSlot, elseSlot, labelIdx) => {
        info = this.info.get(i),
        maxP = info.maxParent;
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
            util.format("g[%s](%s, %s, %s); // %s: { maxP: %s, len: %s, usable: [%s], subst: %s }",
                fmt(labelIdx, m), fmt(targetSlot, n), fmt(thenSlot, n), fmt(elseSlot, n),
                fmt(i, o), // instruction nr
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
    let n = this.instructions.length / 4;
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
        if (newTargetSlot !== targetSlot) {
            this.instructions[i * 4] = newTargetSlot;
            // fix subsequent occurrences
            for (let j of info.readAt) {
                this.instructions[j] = newTargetSlot;
            };
        }
        i++;
    });
    this.maxLen = maxLen;
    this.resultSlot = newTargetSlot;
    return this;
};

function _serialize(b, p, labels2Idx, seen) {
    let entry = seen.get(b);
    if (entry === undefined) {
        let labelIdx = labels2Idx[b.label];
        if (labelIdx === undefined) {
            labelIdx = p.labels.length;
            p.labels.push(b.label);
            labels2Idx[b.label] = labelIdx;
        }
        let onTrue  = b.onTrue,
            onFalse = b.onFalse,
            thenSlot,
            elseSlot;
        //if (b.onTrue.satPathCount > b.onFalse.satPathCount) { // (10: >: 285/296  | <: 288/315) / (9: >: 149/156 | <: 154/148 | t,e: 147/158 | e,t: 159/147)
        //    thenSlot = _serialize(onTrue,  p, labels2Idx, seen);
        //    elseSlot = _serialize(onFalse, p, labels2Idx, seen);
        //} else {
            elseSlot = _serialize(onFalse, p, labels2Idx, seen);
            thenSlot = _serialize(onTrue,  p, labels2Idx, seen);
        //}

        let i          = p.instructions.length / 4, // instruction counter
            targetSlot = p.maxLen++;
        p.instructions.push(targetSlot);
        p.instructions.push(labelIdx);
        p.instructions.push(thenSlot);
        p.instructions.push(elseSlot);
        let onTrueInfo  = seen.get(onTrue );
        let onFalseInfo = seen.get(onFalse);
        onTrueInfo .parents.push(i);
        onTrueInfo .readAt .push(i * 4 + 2);
        onTrueInfo .maxParent = Math.max(onTrueInfo.maxParent, i);
        onFalseInfo.parents.push(i);
        onFalseInfo.readAt .push(i * 4 + 3);
        onFalseInfo.maxParent = Math.max(onFalseInfo.maxParent, i);

        entry = addInfo(seen, b, targetSlot, i);
    }
    return entry.slot;
}

function addInfo(info, bdd, slot, instruction) {
    let entry = Object.create(null, {
            slot:        { value: slot,        enumerable: false, writable: false },
            instruction: { value: instruction, enumerable: false, writable: false },
            maxParent:   { value: -1,          enumerable: true,  writable: true  },
            parents:     { value: [],          enumerable: false, writable: false },
            readAt:      { value: [],          enumerable: false, writable: false },
        })
    ;
    info.set(bdd, entry);
    if (instruction !== undefined) {
        info.set(instruction, entry);
    }
    return entry;
}

function serialize(b) {
    let program = new Program(),
        seen    = new Map();
    addInfo(seen, T, 0);
    addInfo(seen, F, 1);
    if (!b.isTerminal) {
        let labels2Idx = {};
        _serialize(b, program, labels2Idx, seen);
    }
    program.resultSlot = seen.get(b).slot;
    program.info = seen;
    return program;
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
