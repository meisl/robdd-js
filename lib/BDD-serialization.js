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
Program.prototype.run = function (cb) {
    let j  = 0,
        is = this.instructions,
        n  = is.length,
        ls = this.labels;
    while (j < n) {
        let target = is[j++],
            label  = ls[is[j++]],
            tIdx   = is[j++],
            eIdx   = is[j++];
        cb(target, label, tIdx, eIdx);
    }
};
Program.prototype.toString = function () {
    let result = ["let xs = new Array(" + this.maxLen + ")",
                  "xs[0] = T",
                  "xs[1] = F",
    ];
    this.run((targetIdx, label, tIdx, eIdx) => { result.push(
        "xs[" + targetIdx + "] = get('" + label + "', xs[" + tIdx + "], xs[" + eIdx + "])"
    )});
    result.push("return xs[" + this.resultIdx + "]");
    return result.join(";\n") + ";";
};

function _serialize(b, p, labels2Idx, seen) {
    let i = seen.get(b);
    if (i === undefined) {
        let labelIdx = labels2Idx[b.label];
        if (labelIdx === undefined) {
            labelIdx = p.labels.length;
            p.labels.push(b.label);
            labels2Idx[b.label] = labelIdx;
        }
        let t = _serialize(b.onTrue,  p, labels2Idx, seen),
            e = _serialize(b.onFalse, p, labels2Idx, seen);
        i = p.maxLen++;
        p.instructions.push(i);    // target
        p.instructions.push(labelIdx);
        p.instructions.push(t);
        p.instructions.push(e);
        seen.set(b, i);
    }
    return i;
}

function serialize(b) {
    let program = new Program();
    if (b === F) {
        program.resultIdx = 1;
    } else if (b !== T) {
        _serialize(b, program, {}, new Map([[T, 0], [F, 1]]));
        program.resultIdx = program.maxLen - 1;
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
