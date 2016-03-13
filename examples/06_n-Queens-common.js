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

function checkSolution(n, q) {
    let expected,
        bestSize,
        worstSize;
    switch (n) {
        case  0: throw new Error("n=0 doesn't make much sense...");
        case  1: expected =     1; bestSize =      3; worstSize =      3; break;
        case  2: expected =     0; bestSize =      1; worstSize =      1; break;
        case  3: expected =     0; bestSize =      1; worstSize =      1; break;
        case  4: expected =     2; bestSize =     17; worstSize =     17; break;
        case  5: expected =    10; bestSize =     76; worstSize =     97; break;
        case  6: expected =     4; bestSize =     64; worstSize =     66; break;
        case  7: expected =    40; bestSize =    351; worstSize =    448; break;
        case  8: expected =    92; bestSize =    648; worstSize =    883; break;
        case  9: expected =   352; bestSize =   3397; worstSize =   4070; break;
        case 10: expected =   724; bestSize =   8838; worstSize =  10046; break;
        case 11: expected =  2680; bestSize =  31016; worstSize =  33632; break;
        case 12: expected = 14200; bestSize = 136211; worstSize = 141818; break;
        case 13: expected = 73712;                    worstSize = 619401; break;
        default:
            throw new Error("unknown: # solutions for " + n + "x" + n);
    }
    assert.same(q.satPathCount, expected);
}

function bitLength(n) {
    if (n === 0) {
        return 0;
    } else if (n < 0) {
        throw new TypeError("expected non-negative integer - got " + n);
    }
    let result = 0;
    n--;
    do {
        n >>>= 1;
        result++;
    } while (n !== 0);
    return result;
}

assert.same(bitLength(0), 0);
assert.same(bitLength(1), 1);
assert.same(bitLength(2), 1);
assert.same(bitLength(3), 2);
assert.same(bitLength(4), 2);
assert.same(bitLength(5), 3);
assert.same(bitLength(7), 3);
assert.same(bitLength(8), 3);

function makeRanks(n, opts) {
    let result = new Array(n),
        bitLen = bitLength(n);
    opts = opts || { interleaved: false, MSBfirst: false };
    for (let rank = 0; rank < n; rank++) {
        let bits = [];
        for (let bitnr = 0; bitnr < bitLen; bitnr++) {
            let i = opts.MSBfirst ? bitLen - 1 - bitnr : bitnr,
                k = String.fromCharCode(65 + rank);
            if (opts.interleaved) {
                bits.push(BDD.var(i + '' + k));

            } else {
                bits.push(BDD.var(k + '' + i));
            }
        }
        result[rank] = bitstr.apply(null, bits);
    }
    return result;
}

function exactly1(bs) {
    let disjuncts = [],
        k         = 1 << bs.length;
    for (let i = 1; i < k; i <<= 1) {
        disjuncts.push(bs.eq(i));
    }
    return or.apply(null, disjuncts);
}

function exactly1_withAND(bs) {
    let conjuncts = [],
        k         = 1 << bs.length;
    for (let i = 1; i < k; i <<= 1) {
        conjuncts.push(bs.eq(i).not);
    }
    return and.apply(null, conjuncts).not;
}

function atmost1(bs) {
    return bs.eq(0).or(exactly1(bs));
}

function pairwise_neq(bs) {
    let n = bs.length,
        conjuncts = new Array(n * (n - 1) / 2),
        j = 0;
    for (let i = 0; i < n - 1; i++) {
        for (let k = i + 1; k < n; k ++) {
            conjuncts[j++] = bs[i].neq(bs[k]);
        }
    }
    return conjuncts;
}

module.exports = {
    bitLength:          bitLength,
    makeRanks:          makeRanks,
    exactly1:           exactly1,
    exactly1_withAND:   exactly1_withAND,
    atmost1:            atmost1,
    pairwise_neq:       pairwise_neq,
    checkSolution:      checkSolution,
};
