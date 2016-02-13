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
        assert.same(bits.lt (bits), F, ".lt(itself)");
        assert.same(bits.lte(bits), T, ".lte(itself)");
        assert.same(bits.gt (bits), F, ".gt(itself)");
        assert.same(bits.gte(bits), T, ".gte(itself)");
        for (let i = 0; i < (1 << len); i++) {
            let bits1 = bits,
                bits2 = bitstr(i, len);
            if (i < k) {
                // eq
                assert.same(bits1.eq (bits2), F, "k=" + k + "; [" + bits1 + "] == ["  + bits2 + "]");
                // neq
                assert.same(bits1.neq(bits2), T, "k=" + k + "; [" + bits1 + "] != ["  + bits2 + "]");
                // lt
                assert.same(bits1.lt (bits2), F, "k=" + k + "; [" + bits1 + "] < ["  + bits2 + "]");
                assert.same(bits2.lt (bits1), T, "k=" + k + "; [" + bits2 + "] < ["  + bits1 + "]");
                // lte:
                assert.same(bits1.lte(bits2), F, "k=" + k + "; [" + bits1 + "] <= [" + bits2 + "]");
                assert.same(bits2.lte(bits1), T, "k=" + k + "; [" + bits2 + "] <= [" + bits1 + "]");
                // gt
                assert.same(bits1.gt (bits2), T, "k=" + k + "; [" + bits1 + "] > ["  + bits2 + "]");
                assert.same(bits2.gt (bits1), F, "k=" + k + "; [" + bits2 + "] > ["  + bits1 + "]");
            } else if (i === k) {
                // eq
                assert.same(bits1.eq (bits2), T, ".eq(same args)");
                // neq:
                assert.same(bits1.neq(bits2), F, ".neq(same args)");
                // lt
                assert.same(bits1.lt (bits2), F, ".lt(same args)");
                // lte:
                assert.same(bits1.lte(bits2), T, ".lte(same args)");
                // gt
                assert.same(bits1.gt (bits2), F, ".gt(same args)");
                // gte:
                assert.same(bits1.gte(bits2), T, ".gte(same args)");
            } else { // i > k  ~>  bits1 < bits2
                // eq
                assert.same(bits1.eq (bits2), F, "k=" + k + "; [" + bits1 + "] == ["  + bits2 + "]");
                // neq
                assert.same(bits1.neq(bits2), T, "k=" + k + "; [" + bits1 + "] != ["  + bits2 + "]");
                // lt
                assert.same(bits1.lt (bits2), T, "k=" + k + "; [" + bits1 + "] < ["  + bits2 + "]");
                assert.same(bits2.lt (bits1), F, "k=" + k + "; [" + bits2 + "] < ["  + bits1 + "]");
                // lte:
                assert.same(bits1.lte(bits2), T, "k=" + k + "; [" + bits1 + "] <= [" + bits2 + "]");
                assert.same(bits2.lte(bits1), F, "k=" + k + "; [" + bits2 + "] <= [" + bits1 + "]");
                // gt
                assert.same(bits1.gt (bits2), F, "k=" + k + "; [" + bits1 + "] > ["  + bits2 + "]");
                assert.same(bits2.gt (bits1), T, "k=" + k + "; [" + bits2 + "] < ["  + bits1 + "]");
                // gte:
                assert.same(bits1.gte(bits2), F, "k=" + k + "; [" + bits1 + "] >= [" + bits2 + "]");
                assert.same(bits2.gte(bits1), T, "k=" + k + "; [" + bits2 + "] >= [" + bits1 + "]");
            }
        }

        for (let i = 0; i < (1 << len); i++) {
            let bits2 = bitstr(i, len);
            // lt <=> lte AND neq
            assert.same(bits.lt( bits2), bits.lte(bits2).and(bits.neq(bits2)), "lt <=> lte AND neq; k=" + k );
            // lte <=> lt OR eq
            assert.same(bits.lte(bits2), bits.lt( bits2).or( bits.eq( bits2)), "lte <=> lt OR eq; k=" + k );
            // gt <=> gte AND neq
            assert.same(bits.gt( bits2), bits.gte(bits2).and(bits.neq(bits2)), "glt <=> lte AND neq; k=" + k );
            // gte <=> gt OR eq
            assert.same(bits.gte(bits2), bits.gt( bits2).or( bits.eq( bits2)), "gte <=> lt OR eq; k=" + k );
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

    // bitstr.eq/neq itself
    assert.same(bits.eq( bits), T, "bitstr called with a str prefix; .eq(itself)");
    assert.same(bits.neq(bits), F, "bitstr called with a str prefix; .neq(itself)");
}();

/* bitstr from BDDs */
() => {
    const as1 = bitstr('a', 4),
          as2 = bitstr(as1[0], as1[1], as1[2], as1[3]),
          asR = bitstr(as1[3], as1[2], as1[1], as1[0]);
    assert.same(as1.eq( as2), T, "bitstr with same vars in same order are eq = T (1)");
    assert.same(as2.eq( as1), T, "bitstr with same vars in same order are eq = T (2)");
    assert.same(as1.neq(as2), F, "bitstr with same vars in same order are neq = F (1)");
    assert.same(as2.neq(as1), F, "bitstr with same vars in same order are neq = F (1)");

    let as1EQasR = as1[0].eqv(asR[0])
              .and(as1[1].eqv(asR[1]))
              .and(as1[2].eqv(asR[2]))
              .and(as1[3].eqv(asR[3]))
    ;
    assert.same(as1.eq(asR), as1EQasR, "bitstr with same vars but in different order / eq");

    let as1NEQasR = as1[0].xor(asR[0])
                .or(as1[1].xor(asR[1]))
                .or(as1[2].xor(asR[2]))
                .or(as1[3].xor(asR[3]))
    ;
    assert.same(as1.eq(asR), as1EQasR, "bitstr with same vars but in different order / eq");
}();
