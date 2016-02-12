"use strict";

const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

/* module under test: */
const BDD = require('../lib/BDD-bitstr'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      bitstr = BDD.bitstr;

() => {
    let origBDD = require('../lib/BDD');
    for (let k in origBDD) {
        assert.same(BDD[k], origBDD[k], "BDD-bitstr re-exports ." + k + " from BDD");
    }
}();

/* fn bitstr */
() => {
    let prefix = 'a',
        bits   = bitstr(prefix, 4);

    assert.typeof(bits[0], "object");

    assert.same(bits.length, 4, "bitstr called with a str prefix; .length");
    let i = 0;
    bits.forEach(v => {
        assert(v.isVar, "bitstr called with a str prefix yields a vector of variables; " + i + "th: " + v);
        assert.same(v.label, prefix + i);
        i++;
    })
    assert.same(i, bits.length, "'forEach-ing' through bitStr yields .length formulas");

    // bitstr.eqv itself
    assert.same(bits.eqv(bits), T, "bitstr called with a str prefix; .eqv(itself)");
}();

() => {
    function assertBits(bits, k) {
        let i = 0;
        bits.forEach(bit => {
            assert(bit.isTerminal, "bitstr called with int constant " + k + " yields a vector of terminal BDDs; " + i + "th bit of [" + bits + "]");
            assert.same(bit, (k & (1 << i)) === 0 ? F : T, "1-bits in the constant " + k + " correspond to True, 0s to False; " + i + "th bit of [" + bits + "]");
            i++;
        });
        return i;
    }
    [   { k:  0, len: 4 },
        { k:  1, len: 4 },
        { k:  5, len: 4 },
        { k:  7, len: 4 },
        { k:  8, len: 4 },
        { k: 14, len: 4 },
        { k: 15, len: 4 },
    ].forEach(o => {
        const k    = o.k,
              len  = o.len,
              bits = bitstr(k, len);

        assert.same(bits.length, len, "bitstr called with an int constant; .length");

        let n = assertBits(bits, k);
        assert.same(n, bits.length, "'forEach-ing' through bitStr yields .length formulas");

        // bitstr.eqv
        assert.same(bits.eqv(bits),               T, "bitstr called with an int constant; .eqv(itself)");
        assert.same(bits.eqv(bitstr(k,     len)), T, "bitstr called with an int constant; .eqv(bitstr(same args))");
        assert.same(bits.eqv(bitstr(k + 1, len)), F, "bitstr called with an int constant; .eqv(some different)");
        assert.same(bits.eqv(bitstr(k - 1, len)), F, "bitstr called with an int constant; .eqv(some different)");

        // bitstr.plus another bitstr from int constant
        assertBits(bits.plus(bitstr(0, len)), k);
        assertBits(bits.plus(bitstr(1, len)), k + 1);
        assertBits(bits.plus(bitstr(2, len)), k + 2);
        assertBits(bits.plus(bitstr(3, len)), k + 3);
        // TODO: overflow...?

        // bitstr.plus int constant
        assertBits(bits.plus(0), k);
        assertBits(bits.plus(1), k + 1);
        assertBits(bits.plus(2), k + 2);
        assertBits(bits.plus(3), k + 3);
        // TODO: overflow...?
    });
}();
