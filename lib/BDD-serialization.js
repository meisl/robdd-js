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
    this.resultIdx = 0;
}

Program.prototype.init = function (cb) {
    let xs = new Array(this.maxLen);
    xs[0] = T;
    xs[1] = F;
    return xs;
};
Program.prototype.decode = function (j, cb) {
    let is        = this.instructions,
        targetIdx = is[j++],
        labelIdx  = is[j++],
        label     = this.labels[labelIdx],
        tIdx      = is[j++],
        eIdx      = is[j++];
    cb(targetIdx, label, tIdx, eIdx, labelIdx);
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
    let i      = 0,
        n      = (this.maxLen + "").length,
        m      = (this.labels.length + "").length,
        o      = ((this.instructions.length / 4) + "").length,
        result = ["let _ = new Array(" + this.maxLen + "),",
                  "    g = " + JSON.stringify(this.labels),
                  "      .map(l => (i, t,e) => { _[i] = get(l, _[t], _[e]) });",
        ],
        len = 2,
        k = (this.instructions.length / 4) + 1;
    console.log(k + " instructions");
    let recycle = new Array(k),
        info, maxP, newTargetIdx,
        reuse = (slot, at) => {
            let entry = recycle[at];
            if (entry === undefined) {
                recycle[at] = [slot];
            } else {
                entry.push(slot);
            }
        };
        [T, F].forEach(bdd => {
            info = this.info.get(bdd),
            maxP = info.maxParent;
            reuse(i, maxP);
            result.push(
                util.format("%s_[%s] = %s; %s// %s: { maxP: %s, len: %s, usable: [%s] }",
                    fmt("", 2 + m),
                    fmt(i, n), // targetIdx
                    bdd.toString(),
                    fmt("", 2*n),
                    fmt(i, o), // instruction nr
                    fmt(maxP, n),
                    fmt(len, n),
                    (recycle[i] || []).join(',')
                )
            );
            i++;
        });

    this.run((targetIdx, label, tIdx, eIdx, lIdx) => {
        info = this.info.get(i),
        maxP = info.maxParent;
        let entry = recycle[i] || [],
            usableStr = entry.join(',');
        if (entry.length > 0) {
            newTargetIdx = Math.min.apply(null, entry);
            entry.forEach(slot => {
                if (slot !== newTargetIdx) {
                    reuse(slot, i + 1);
                }
            });
        } else {
            newTargetIdx = len++;
        }
        reuse(newTargetIdx, maxP);
        result.push(
            util.format("g[%s](%s, %s, %s); // %s: { maxP: %s, len: %s, usable: [%s], subst: %s }",
                fmt(lIdx, m), fmt(targetIdx, n), fmt(tIdx, n), fmt(eIdx, n),
                fmt(i, o), // instruction nr
                fmt(maxP, n),
                fmt(len, n),
                usableStr,
                (newTargetIdx === targetIdx ? "-" : "[" + targetIdx + "->" + newTargetIdx + "] @ " + i + "," + info.parents.join(','))
            )
        );
        i++;
    });
    result.push("return _[" + this.resultIdx + "];");
    return result.join("\n");
};
Program.prototype.optimize = function () {
    let n = this.instructions.length / 4;
    if (n === 0) {    // trivial: terminal BDD
        return this;
    }
    let i       = 2, // instruction counter
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
        info, maxP, newTargetIdx;
    info = this.info.get(T); recycle(info.index, info.maxParent);
    info = this.info.get(F); recycle(info.index, info.maxParent);

    this.run((targetIdx, label, thenIdx, elseIdx) => {
        info = this.info.get(i);
        maxP = info.maxParent;
        let entry = usable[i];
        if (entry !== undefined) { // we can re-use a slot
            newTargetIdx = Math.min.apply(null, entry); // choose minimum slot (doesn't really matter)
            entry.forEach(slot => { // copy over the remaining usable slots to next iteration
                if (slot !== newTargetIdx) {
                    recycle(slot, i + 1);
                }
            });
        } else {
            newTargetIdx = maxLen++;
        }
        recycle(newTargetIdx, maxP); // this one will be needed until maxP
        if (newTargetIdx !== targetIdx) {
            this.instructions[(i-2) * 4] = newTargetIdx;
            // fix subsequent occurrences
            for (let j of info.readAt) {
                this.instructions[j] = newTargetIdx;
            };
        }
        i++;
    });
    this.maxLen = maxLen;
    this.resultIdx = newTargetIdx;
    return this;
};

function _serialize(b, p, labels2Idx, seen) {
    let info = seen.get(b);
    if (info === undefined) {
        let labelIdx = labels2Idx[b.label];
        if (labelIdx === undefined) {
            labelIdx = p.labels.length;
            p.labels.push(b.label);
            labels2Idx[b.label] = labelIdx;
        }
        let onTrue  = b.onTrue,
            onFalse = b.onFalse,
            thenIdx,
            elseIdx;
        //if (b.onTrue.satPathCount > b.onFalse.satPathCount) { // (10: >: 285/296  | <: 288/315) / (9: >: 149/156 | <: 154/148 | t,e: 147/158 | e,t: 159/147)
        //    thenIdx = _serialize(onTrue,  p, labels2Idx, seen);
        //    elseIdx = _serialize(onFalse, p, labels2Idx, seen);
        //} else {
            elseIdx = _serialize(onFalse, p, labels2Idx, seen);
            thenIdx = _serialize(onTrue,  p, labels2Idx, seen);
        //}
        let targetIdx = p.maxLen++;
        p.instructions.push(targetIdx);    // targetIdx
        p.instructions.push(labelIdx);
        p.instructions.push(thenIdx);
        p.instructions.push(elseIdx);
        let onTrueInfo  = seen.get(onTrue );
        let onFalseInfo = seen.get(onFalse);
        onTrueInfo .parents.push(targetIdx);
        onTrueInfo .readAt .push((targetIdx-2) * 4 + 2);
        onTrueInfo .maxParent = Math.max(onTrueInfo.maxParent, targetIdx);
        onFalseInfo.parents.push(targetIdx);
        onFalseInfo.readAt .push((targetIdx-2) * 4 + 3);
        onFalseInfo.maxParent = Math.max(onFalseInfo.maxParent, targetIdx);

        info = addInfo(seen, b, targetIdx);
    }
    return info.index;
}

function addInfo(info, bdd, index) {
    let i = Object.create(null, {
            index:     { value: index,     enumerable: false, writable: false },
            maxParent: { value: -1,        enumerable: true,  writable: true  },
            parents:   { value: [],        enumerable: false, writable: false },
            readAt:    { value: [],        enumerable: false, writable: false },
        });
    info.set(bdd, i);
    info.set(index, i);
    return i;
}

function serialize(b) {
    let program = new Program(),
        seen    = new Map();
    addInfo(seen, T, 0);
    addInfo(seen, F, 1);
    if (!b.isTerminal) {
        let labels2Idx = {};
        _serialize(b, program, labels2Idx, seen);
        program.resultIdx = program.maxLen - 1;
    }
    program.resultIdx = seen.get(b).index;
    program.info = seen;
    return program;
}


function deserialize(p) {
    let xs = p.init();
    p.run((targetIdx, label, tIdx, eIdx) => {
        xs[targetIdx] = ite(BDD.var(label), xs[tIdx], xs[eIdx]);
    });
    return xs[p.resultIdx];
}


module.exports = {
    serialize:   serialize,
    deserialize: deserialize,
};
