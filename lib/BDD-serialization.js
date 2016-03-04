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
    let i      = 2,
        n      = (this.maxLen + "").length,
        m      = (this.labels.length + "").length,
        o      = ((this.instructions.length / 4) + "").length,
        result = ["let _ = new Array(" + this.maxLen + "),",
                  "    g = " + JSON.stringify(this.labels),
                  "      .map(l => (i, t,e) => { _[i] = get(l, _[t], _[e]) });",
                  "_[0] = T; // 0: " + util.inspect(this.info.get(T)),
                  "_[1] = F; // 1: " + util.inspect(this.info.get(F)),
    ];
    this.run((targetIdx, label, tIdx, eIdx, lIdx) => { result.push(
        util.format("g[%s](%s, %s, %s); // %s: %s",
            fmt(lIdx, m), fmt(targetIdx, n), fmt(tIdx, n), fmt(eIdx, n),
            fmt(i, o), // instruction nr
            util.inspect(this.info.get(i++))
        )
    )});
    result.push("return _[" + this.resultIdx + "];");
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
        seen.get(onTrue ).readAt .push((targetIdx-2) * 4 + 2);
        seen.get(onFalse).parents.push(targetIdx);
        seen.get(onFalse).readAt .push((targetIdx-2) * 4 + 3);

        info = addInfo(seen, b, targetIdx);
    }
    return info.index;
}

function addInfo(info, bdd, index) {
    let i = Object.create(null, {
            index:   { value: index, enumerable: false },
            parents: { value: [],    enumerable: true  },
            readAt:  { value: [],    enumerable: true  },
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
