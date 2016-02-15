"use strict";

const util = require('util');

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
    a = bitstr(BDD.var('0a'), BDD.var('1a'), BDD.var('2a'), BDD.var('3a')),    //     bitstr('a', bitLen),    //
    b = bitstr(BDD.var('0b'), BDD.var('1b'), BDD.var('2b'), BDD.var('3b')),    //     bitstr('b', bitLen),    //
    c = bitstr(BDD.var('0c'), BDD.var('1c'), BDD.var('2c'), BDD.var('3c')),    //     bitstr('c', bitLen),    //
    p, q;

let steps = 0;
function collectVars(p) {
    if (p.isTerminal) {
        return T;
    } else {
        steps++;
        let t = collectVars(p.onTrue),
            e = collectVars(p.onFalse),
            r = BDD.var(p.label).and(t).and(e);
           // = BDD.get(p.label, and(t, e), F)
        return r;
    }
}

p = c.eq(a.plus(b));
q = collectVars(p);
console.log("p.size:", p.size,
    "/ p.satPathCount:", p.satPathCount,
    "/ steps for collectVars(p):", steps,
    "/ nr of vars: ", q.size
);
const path = require('path');

gv.render(q, { output: path.parse(require.main.filename).name });
