"use strict";

const util   = require('util'),
      assert = require('assert');

const BDD    = require('../lib/BDD'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      and    = BDD.and,
      or     = BDD.or,
      xor    = BDD.xor,
      eqv    = BDD.eqv,
      gv     = require('../lib/BDD-gv'),
      bitstr = require('../lib/BDD-bitstr').bitstr;

let bitLen = 4,
    a = bitstr(BDD.var('0a'), BDD.var('1a'), BDD.var('2a'), BDD.var('3a')),    //      bitstr('a', bitLen),    //
    b = bitstr(BDD.var('0b'), BDD.var('1b'), BDD.var('2b'), BDD.var('3b')),    //      bitstr('b', bitLen),    //
    c = bitstr(BDD.var('0c'), BDD.var('1c'), BDD.var('2c'), BDD.var('3c')),    //      bitstr('c', bitLen),    //
    p, q, r,
    stats1, stats2
;

let steps1 = 0;
function collectVars1(p) {
    steps1++;
    return p.isTerminal
        ? T
        : BDD.var(p.label).and(collectVars1(p.onTrue).and(collectVars1(p.onFalse)))
     // = BDD.get(p.label, and(collectVars1(p.onTrue), collectVars1(p.onFalse)), F)
}

let steps2 = 0;
function collectVars2(p) {
    steps2++;
    if (p.isTerminal) {
        return T;
    } else if (p.isVar) {
        return BDD.var(p.label);
    } else {
        let r = BDD.var(p.label),
            t = collectVars2(p.onTrue),
            e = collectVars2(p.onFalse.and(p.onTrue.not()));
        r = r.and(t).and(e);
        return r;
    }
}

//p = a[0].xor(b[0]);
//p = a[0].xor(b[0]).xor(c[0]);
p = c.eq(a.plus(b));


stats1 = BDD.stat(() => { q = collectVars1(p); });
stats2 = BDD.stat(() => { r = collectVars2(p); });


console.log("p.size:", p.size,
    "/ p.satPathCount:", p.satPathCount,
    "/ nr of vars: ", q.size
);
console.log('----');
console.log("collectVars*1*(p):", steps1, "steps\n", stats1);
console.log('----');
console.log("collectVars*2*(p):", steps2, "steps\n", stats2);
console.log('----');


const path = require('path'),
      opts = { output: path.parse(require.main.filename).name }
;


if (q !== r) {
    gv.render(r, opts);
    assert(false, "should be equal:\n  " + q.toIteStr() + "\nand\n  " + r.toIteStr());
} else {
    gv.render(r, opts);
}
