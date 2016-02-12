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

/* fn bitstr *****************************************************************/

/* bitstr from int constant */

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

        // bitstr.eq
        assert.same(bits.eq(bits),               T, "bitstr called with an int constant; .eq(itself)");
        assert.same(bits.eq(bitstr(k,     len)), T, "bitstr called with an int constant; .eq(bitstr(same args))");
        assert.same(bits.eq(bitstr(k + 1, len)), F, "bitstr called with an int constant; .eq(some different)");
        assert.same(bits.eq(bitstr(k - 1, len)), F, "bitstr called with an int constant; .eq(some different)");

        // bitstr.neq
        assert.same(bits.neq(bits),               F, "bitstr called with an int constant; .neq(itself)");
        assert.same(bits.neq(bitstr(k,     len)), F, "bitstr called with an int constant; .neq(bitstr(same args))");
        assert.same(bits.neq(bitstr(k + 1, len)), T, "bitstr called with an int constant; .neq(some different)");
        assert.same(bits.neq(bitstr(k - 1, len)), T, "bitstr called with an int constant; .neq(some different)");

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

        // bitstr.lt int constant
        assert.same(bits.lt(bits),               F, ".lt(itself)");
        for (let i = 0; i < (1 << len); i++) {
            if (i < k) {
                assert.same(bitstr(i, len).lt(bits), T, "k=" + k + "; [" + bitstr(i, len) + "] < [" + bits + "]");
                assert.same(bits.lt(bitstr(i, len)), F, "k=" + k + "; [" + bits + "] < [" + bitstr(i, len) + "]");
            } else if (i === k) {
                assert.same(bits.lt(bitstr(k,     len)), F, ".lt(same args)");
            } else { // i > k
                assert.same(bits.lt(bitstr(i, len)), T, "k=" + k + "; [" + bits + "] < [" + bitstr(i, len) + "]");
                assert.same(bitstr(i, len).lt(bits), F, "k=" + k + "; [" + bitstr(i, len) + "] < [" + bits + "]");
            }
        }

        // bitstr.lte int constant
        assert.same(bits.lte(bits),               T, ".lte(itself)");
        for (let i = 0; i < (1 << len); i++) {
            if (i < k) {
                assert.same(bitstr(i, len).lte(bits), T, "k=" + k + "; [" + bitstr(i, len) + "] <= [" + bits + "]");
                assert.same(bits.lte(bitstr(i, len)), F, "k=" + k + "; [" + bits + "] <= [" + bitstr(i, len) + "]");
            } else if (i === k) {
                assert.same(bits.lte(bitstr(k,     len)), T, ".lte(same args)");
            } else { // i > k
                assert.same(bits.lte(bitstr(i, len)), T, "k=" + k + "; [" + bits + "] <= [" + bitstr(i, len) + "]");
                assert.same(bitstr(i, len).lte(bits), F, "k=" + k + "; [" + bitstr(i, len) + "] <= [" + bits + "]");
            }
        }

        // lte <=> lt OR eq
        for (let i = 0; i < (1 << len); i++) {
            let bits2 = bitstr(i, len);
            assert.same(bits.lte(bits2), bits.lt(bits2).or(bits.eq(bits2)), "lte <=> lt OR eq; k=" + k );
        }

        // lt <=> lte AND neq
        for (let i = 0; i < (1 << len); i++) {
            let bits2 = bitstr(i, len);
            assert.same(bits.lt(bits2), bits.lt(bits2).and(bits.neq(bits2)), "lt <=> lte AND neq; k=" + k );
        }

    });
}();

/* bitstr with str prefix */
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

    // bitstr.eq itself
    assert.same(bits.eq(bits),  T, "bitstr called with a str prefix; .eq(itself)");

    // bitstr.neq itself
    assert.same(bits.neq(bits), F, "bitstr called with a str prefix; .neq(itself)");
}();
