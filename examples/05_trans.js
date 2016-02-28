"use strict";

const util   = require('util'),
      assert = require('pimped-assert').assert;

const BDD    = require('../lib/BDD'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      and    = BDD.and,
      or     = BDD.or,
      xor    = BDD.xor,
      eqv    = BDD.eqv,
      imp    = (p, q) => or(p.not, q),
      gv     = require('../lib/BDD-gv'),
      bitstr = require('../lib/BDD-bitstr').bitstr;

let n = 8,
    bitLen = 3,
    a = bitstr('a', bitLen),    //         bitstr(BDD.var('0a'), BDD.var('1a'), BDD.var('2a')),    //
    b = bitstr('b', bitLen),    //         bitstr(BDD.var('0b'), BDD.var('1b'), BDD.var('2b')),    //
    c = bitstr('c', bitLen),    //         bitstr(BDD.var('0c'), BDD.var('1c'), BDD.var('2c')),    //
    d = bitstr('d', bitLen),    //         bitstr(BDD.var('0d'), BDD.var('1d'), BDD.var('2d')),    //
    e = bitstr('e', bitLen),    //         bitstr(BDD.var('0e'), BDD.var('1e'), BDD.var('2e')),    //
    p, q, r,
    stats1, stats2
;


p = a.eq(3);
q = T
    .and( a.neq(b) )
    .and( a.next.neq(b.next) )
    .and(F
        .or(b.next.eq(b).and(F
            .or(  a.eq(0).and( a.next.eq(1).or(a.next.eq(2)) )  )
            .or(  a.eq(1).and( a.next.eq(0).or(a.next.eq(3)) )  )
            .or(  a.eq(2).and( a.next.eq(0).or(a.next.eq(2)) )  )
            .or(  a.eq(3).and( a.next.eq(1).or(a.next.eq(2)) )  )
        ))
        .or(a.next.eq(a).and(F
            .or(  b.eq(0).and( b.next.eq(1).or(b.next.eq(2)) )  )
            .or(  b.eq(1).and( b.next.eq(0).or(b.next.eq(3)) )  )
            .or(  b.eq(2).and( b.next.eq(0).or(b.next.eq(2)) )  )
            .or(  b.eq(3).and( b.next.eq(1).or(b.next.eq(2)) )  )
        ))
    )
;

q = a.neq(b).and(a.neq(c)).and(a.neq(d)).and(b.neq(c)).and(b.neq(d)).and(c.neq(d));




let steps = 0;
function exists(bdd, vars, i) {
    steps++;
    if (bdd.isTerminal) {
        return bdd;
    } else {
        let n = vars.length;
        i = i || 0;
        while ((i < n) && vars[i].label < bdd.label) {
            i++;
        }
        if (i < n) {
            if (vars[i].label === bdd.label) {
                return exists(bdd.onTrue.or(bdd.onFalse), vars, i + 1);
                //return exists(bdd.onTrue, vars, i + 1).or(exists(bdd.onFalse, vars, i + 1));
            }
            // vars[i].label > bdd.label
            return ite(BDD.var(bdd.label), exists(bdd.onTrue, vars, i), exists(bdd.onFalse, vars, i));
        }
        return bdd;
    }
}

function forall(bdd, vars, i) {
    steps++;
    if (bdd.isTerminal) {
        return bdd;
    } else {
        let n = vars.length;
        i = i || 0;
        while ((i < n) && vars[i].label < bdd.label) {
            i++;
        }
        if (i < n) {
            if (vars[i].label === bdd.label) {
                //return forall(bdd.onTrue.and(bdd.onFalse), vars, i + 1);
                return forall(bdd.onTrue, vars, i + 1).and(forall(bdd.onFalse, vars, i + 1));
            }
            // vars[i].label > bdd.label
            return ite(BDD.var(bdd.label), forall(bdd.onTrue, vars, i), forall(bdd.onFalse, vars, i));
        }
        return bdd;
    }
}

r = p.and(q);

r = r.and(a.next[1].not.and(b[0].not).not)

r = exists(q, a);
console.log(steps + " steps");

gv.render(r, { satPathCount: true });
console.log(BDD.stats());
