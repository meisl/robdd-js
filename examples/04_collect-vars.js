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
    a = bitstr('a', bitLen),    //     bitstr(BDD.var('0a'), BDD.var('1a'), BDD.var('2a'), BDD.var('3a')),    //
    b = bitstr('b', bitLen),    //     bitstr(BDD.var('0b'), BDD.var('1b'), BDD.var('2b'), BDD.var('3b')),    //
    c = bitstr('c', bitLen),    //     bitstr(BDD.var('0c'), BDD.var('1c'), BDD.var('2c'), BDD.var('3c')),    //
    p, q, r,
    stats1, stats2
;

let steps1 = 0;
function collectVars1(p) {
    steps1++;
    if (p.isTerminal) {
        return T;
    } else {
        let t = collectVars1(p.onTrue),
            e = collectVars1(p.onFalse),
            r = BDD.var(p.label).and(t.and(e));
           // = BDD.get(p.label, and(t, e), F)
        return r;
    }
}

let steps2 = 0;
function collectVars2(p) {
    steps2++;
    if (p.isTerminal) {
        return T;
    } else {
        let r = BDD.var(p.label).and(collectVars2(p.onTrue.or(p.onFalse)));
           // = BDD.get(p.label, or(p.t, p.e), F)
        return r;
    }
}

p = c.eq(a.plus(b));
stats1 = BDD.stat(() => { q = collectVars1(p); });
stats2 = BDD.stat(() => { r = collectVars2(p); });
assert.deepEqual(q, r);


console.log("p.size:", p.size,
    "/ p.satPathCount:", p.satPathCount,
    "/ nr of vars: ", q.size
);
console.log("collectVars1(p):\nsteps:", steps1, stats1);
console.log("collectVars2(p):\nsteps:", steps2, stats2);


const path = require('path');

gv.render(q, { output: path.parse(require.main.filename).name });
