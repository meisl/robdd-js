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
        label     = this.labels[is[j++]],
        tIdx      = is[j++],
        eIdx      = is[j++];
    cb(targetIdx, label, tIdx, eIdx);
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
    let i      = 1,
        result = ["let xs = new Array(" + this.maxLen + ");",
                  "xs[0] = T;",
                  "xs[1] = F;",
    ];
    this.run((targetIdx, label, tIdx, eIdx) => { result.push(
        "xs[" + targetIdx + "] = get('" + label + "', xs[" + tIdx + "], xs[" + eIdx + "]); // " + (i++)
    )});
    result.push("return xs[" + this.resultIdx + "];");
    return result.join("\n");
};
Program.prototype.optimize = function () {
    let j      = 0,
        n      = this.instructions.length,
        len    = 2,
        xs     = this.init();
    while (j < n) {
        j = this.decode(j, (targetIdx, label, thenIdx, elseIdx) => {
            let k    = j + 4,
                bdd  = ite(BDD.var(label), xs[thenIdx], xs[elseIdx]),
                used = {};
            while (k < n) {
                k = this.decode(k, (targetIdx, label, thenIdx, elseIdx) => {
                    if (used[thenIdx] === undefined) {
                        used[thenIdx] = [k + 2];
                    } else {
                        used[thenIdx].push(k + 2);
                    }
                    if (used[elseIdx] === undefined) {
                        used[elseIdx] = [k + 3];
                    } else {
                        used[elseIdx].push(k + 3);
                    }
                });
            }
            let free = [];
            for (k = 0; k < len; k++) {
                if (!used[k]) {
                    free.push(k);
                }
            }
            let newTargetIdx = (free.length > 0) ? free[0] : len;
            if (newTargetIdx !== targetIdx) {
                this.instructions[j] = newTargetIdx; // change target
                (used[targetIdx] || []).forEach(k => {
                    this.instructions[k] = newTargetIdx;  // fix subsequent uses
                });
            }
            if (newTargetIdx === len) {
                len++;
            }
            xs[newTargetIdx] = bdd;
        });
    }
    this.maxLen = len;
    if (n > 0) {
        this.resultIdx = this.instructions[n - 4];
    }
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
        seen.get(onTrue ).parents.push(targetIdx);
        seen.get(onTrue ).readAt .push(targetIdx + 2);
        seen.get(onFalse).parents.push(targetIdx);
        seen.get(onFalse).readAt .push(targetIdx + 3);
        info = {
            index:   targetIdx,
            parents: [],
            readAt:  [],
        };
        seen.set(b, info);
    }
    return info.index;
}

function serialize(b) {
    let program = new Program();
    if (b === F) {
        program.resultIdx = 1;
    } else if (b !== T) {
        let seen       = new Map([
            [T, { index: 0, parents: [], readAt: [] }],
            [F, { index: 1, parents: [], readAt: [] }]
        ]),
            labels2Idx = {};
        _serialize(b, program, labels2Idx, seen);
        program.resultIdx = program.maxLen - 1;
        program.info = seen;
    }
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
