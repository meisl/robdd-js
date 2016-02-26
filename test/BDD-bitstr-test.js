"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

const BDD = require('../lib/BDD'),
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

/* module under test: */
const BitStr = require('../lib/BDD-bitstr'),
      bitstr = BitStr.bitstr,
      zip    = BitStr.zip
;

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


/* bitstr.zip */
() => {
    const as = bitstr('a', 4),
          bs = bitstr('b', 4),
          cs = as.zip(bs);

    assert.throws(() => { as.zip(bitstr('b', as.length + 1)) }, "as.zip(bs) expects same .length of as and bs");
    refute.throws(() => { as.zip(12) }, "as.zip accepts a number as arg");

    assert.typeof(cs.map,    "function", "as.zip(bs) provides a .map function");

    let calls = [],
        xs    = cs.map(function (a, b) { calls.push({ thisArg: this, args: arguments, return: a }); return a; });
    assert.same(calls.length, as.length, ".map called the provided function .length times");
    assert(xs.length, as.length, ".map returned a bitstr of the same length");
    calls.forEach( (call, i) => {
        assert.same(call.args[0], as[i], "as.zip(bs).map called the fn with 1st arg from as");
        assert.same(call.args[1], bs[i], "as.zip(bs).map called the fn with 2nd arg from bs");
    });

}();


/* zip */
() => {
    const bitLen = 4,
          as = bitstr('a', bitLen),
          bs = bitstr('b', bitLen),
          cs = bitstr('c', bitLen),
          zs = zip(as, bs);
    let i, k, ks, last;

    assert.throws(() => { zip(as, bitstr('b', as.length + 1)) }, "zip(as, bs) expects same .length of as and bs");
    refute.throws(() => { zip(as, 12) }, "zip(as, n) accepts a number as arg n");

    assert.typeof(zs.map,    "function", "zip(as, bs) provides a .map function");

    // zip().map
    assert.throws(() => { zs.map("foobar") }, "zip().map throws when given a non-function as callback arg");

    let calls = [],
        xs    = zs.map(function (a, b) { calls.push({ thisArg: this, args: arguments, return: a }); return a; });
    assert.same(calls.length, as.length, "zip(as, bs).map called the provided function .length times");
    assert(xs.length, as.length, "zip().map returned a bitstr of the same length");
    calls.forEach( (call, i) => {
        assert.same(call.args[0], as[i], "zip(as, bs).map called the fn with 1st arg from as");
        assert.same(call.args[1], bs[i], "zip(as, bs).map called the fn with 2nd arg from bs");
    });

    // zip().reduce
    let initial = {};
    calls = [],
        xs    = zs.reduce(function (acc, a, b) { let ret = [acc]; calls.push({ thisArg: this, args: arguments, return: ret }); return ret; }, initial);
    assert.same(calls.length, as.length, ".reduce called the provided function .length times");
    assert(xs, calls[calls.length-1].return, ".reduce returned what the function returned last");
    calls.forEach( (call, i) => {
        if (i === 0) {
            assert.same(call.args[0], initial, "zip(as, bs).reduce called the fn with 1st arg the provided initial value");
        } else {
            assert.same(call.args[0], calls[i-1].return, "zip(as, bs).reduce called the fn with 1st arg being what the fn returned last");
        }
        assert.same(call.args[1], as[i], "zip(as, bs).reduce called the fn with 2nd arg from as");
        assert.same(call.args[2], bs[i], "zip(as, bs).reduce called the fn with 3rd arg from bs");
    });

    // zipping 2 bitstrs
    i = 0;
    for (let z of zip(as, bs).columns) {
        assert.deepEqual(z, [as[i], bs[i]]);
        if (i > 0) {
            refute.same(z, last, "zip().columns creates new array each time around");
        }
        last = z;
        i++;
    }

    // zipping 3 bitstrs
    i = 0;
    for (let z of zip(as, bs, cs).columns) {
        assert.deepEqual(z, [as[i], bs[i], cs[i]]);
        if (i > 0) {
            refute.same(z, last, "zip().columns creates new array each time around");
        }
        last = z;
        i++;
    }

    // zipping 3 bitstrs and a constant
    i = 0;
    k = 12;
    ks = bitstr(k, bitLen)
    for (let z of zip(as, bs, k, cs).columns) {
        assert.deepEqual(z, [as[i], bs[i], ks[i], cs[i]]);
        if (i > 0) {
            refute.same(z, last, "zip().columns creates new array each time around");
        }
        last = z;
        i++;
    }

}();


/* bitstr.reduce without initial value */
() => {
    const as = bitstr('a', 4);

    let calls = [],
        x     = as.reduce(
                    function (acc, b) {
                        const result = "returned at " + calls.length + "th call";
                        calls.push({ thisArg: this, args: arguments, return: result });
                        return result;
                    }
                )
    ;

    assert.same(calls.length, as.length - 1, ".reduce w/out initial value called the provided function .length-1 times");

    assert.same(calls[0].args[0], as[0], ".reduce w/out initial value called the provided function with 0th elem as 1st arg on first call");
    calls.forEach((call, i) => {
        if (i > 0) {
            assert.same(call.args[0], calls[i - 1].return, ".reduce w/out initial value called the provided function with last returned value as 1st arg on " + i + "th call");
        }
        assert.same(call.args[1], as[i + 1], ".reduce w/out initial value called the provided function with (i + 1)th elem as 2nd arg");
    });
    assert.same(x, calls[calls.length - 1].return, ".reduce w/out initial value returned last returned value");
}();

/* bitstr.reduce with initial value */
() => {
    const as = bitstr('a', 4);

    assert.throws(() => { as.reduce() }, ".reduce expects a function as 1st arg");

    let calls = [],
        init  = { value: "initial" },
        x     = as.reduce(
                    function (acc, b) {
                        const result = "returned at " + calls.length + "th call";
                        calls.push({ thisArg: this, args: arguments, return: result });
                        return result;
                    },
                    init
                )
    ;

    assert.same(calls.length, as.length, ".reduce with initial value called the provided function .length times");

    assert.same(calls[0].args[0], init, ".reduce with initial value called the provided function with given initial value as 1st arg on first call");
    calls.forEach((call, i) => {
        if (i > 0) {
            assert.same(call.args[0], calls[i - 1].return, ".reduce with initial value called the provided function with last returned value as 1st arg on " + i + "th call");
        }
        assert.same(call.args[1], as[i], ".reduce with initial value called the provided function with ith elem as 2nd arg");
    });
    assert.same(x, calls[calls.length - 1].return, ".reduce with initial value returned last returned value");

}();


/* bitstr.eq */
() => {
    const as = bitstr('a', 4),
          bs = bitstr('b', 4),
          ks = bitstr(11,  4);

    assert.throws(() => { as.eq("fooo") }, "as.eq expects a number or a bitstr as arg");
    assert.throws(() => { as.eq(bitstr('a', as.length + 1)) }, "as.eq(bs) expects same .length of as and bs");

    refute.throws(() => { as.eq(12) }, "as.eq accepts a number as arg");

    [as, bs, ks].forEach(left => {
        [as, bs, ks].forEach(right => {
            assert.same(left.eq(right), left.zip(right).map(eqv).reduce(and), "a.eq(b)  is equivalent to  and( a0 eqv b0, a1 eqv b1, ... )");
        });
    });
}();


/* bitstr.neq */
() => {
    const as = bitstr('a', 4),
          bs = bitstr('b', 4),
          ks = bitstr(11,  4);

    assert.throws(() => { as.neq("fooo") }, "as.neq expects a number or a bitstr as arg");
    assert.throws(() => { as.neq(bitstr('a', as.length + 1)) }, "as.neq(bs) expects same .length of as and bs");

    refute.throws(() => { as.neq(12) }, "as.neq accepts a number as arg");

    [as, bs, ks].forEach(left => {
        [as, bs, ks].forEach(right => {
            assert.same(left.neq(right), left.eq(right).not, "a.neq(b)  is equivalent to  not(a.eq(b))");
        });
    });
}();


/* bitstr.lt */
() => {
    const bitLen = 4,
          as = bitstr('a', bitLen),
          bs = bitstr('b', bitLen),
          k = 11,
          ks = bitstr(k,  bitLen);

    assert.throws(() => { as.lt("fooo") }, "as.lt expects a number or a bitstr as arg");
    assert.throws(() => { as.lt(bitstr('a', as.length + 1)) }, "as.lt(bs) expects same .length of as and bs");

    refute.throws(() => { as.lt(12) }, "as.lt accepts a number as arg");

    for (let i = 0; i < (1 << bitLen); i++) {
        if (i < k) {
            let actual = imp(as.eq(i), as.lt(k));
            assert.same(actual, T, "as.eq(" + i + ") => as.lt(" + k + "); so\n" + actual.toIteStr() + " should equal\nT\n");
        } else {
            let actual = imp(as.lt(k), as.neq(i));
            assert.same(actual, T, "as.lt(" + k + ") => as.neq(" + i + "); so\n" + actual.toIteStr() + " should equal\nT\n");
        }
    }

}();


/* bitstr.lte */
() => {
    const bitLen = 4,
          as = bitstr('a', bitLen),
          bs = bitstr('b', bitLen),
          k = 11,
          ks = bitstr(k,  bitLen);

    assert.throws(() => { as.lte("fooo") }, "as.lte expects a number or a bitstr as arg");
    assert.throws(() => { as.lte(bitstr('a', as.length + 1)) }, "as.lte(bs) expects same .length of as and bs");

    refute.throws(() => { as.lte(12) }, "as.lte accepts a number as arg");

    for (let i = 0; i < (1 << bitLen); i++) {
        if (i <= k) {
            let actual = imp(as.eq(i), as.lte(k));
            assert.same(actual, T, "as.eq(" + i + ") => as.lte(" + k + "); so\n" + actual.toIteStr() + " should equal\nT\n");
        } else {
            let actual = imp(as.lte(k), as.neq(i));
            assert.same(actual, T, "as.lte(" + k + ") => as.neq(" + i + "); so\n" + actual.toIteStr() + " should equal\nT\n");
        }
    }

}();
