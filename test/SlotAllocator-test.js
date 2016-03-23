"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

/* module under test: */
const init = require('../lib/SlotAllocator').init;


() => {
    let initiallyInUse,
        maxLenLimit,
        alloc,
        s1, s2,
        msg;

    assert.throws( () => { init()          }, "init with no args");
    assert.throws( () => { init(undefined) }, "init with undefined initiallyInUse");
    assert.throws( () => { init(null)      }, "init with null initiallyInUse");
    assert.throws( () => { init(-1)        }, "init with negative initiallyInUse");
    assert.throws( () => { init("foo")     }, "init with initiallyInUse a string");
    assert.throws( () => { init(1.5)       }, "init with non-integer initiallyInUse");
    refute.throws( () => { init(0)         }, "init with initiallyInUse === 0");

    assert.throws( () => { init(1, 0)      }, "init with initiallyInUse < maxLenLimit");
    refute.throws( () => { init(1, 1)      }, "init with initiallyInUse === maxLenLimit");

    initiallyInUse = 2;
    maxLenLimit = 5;
    alloc = init(initiallyInUse, maxLenLimit);
    assert.same(alloc.maxLen,         initiallyInUse,                   ".maxLen");
    assert.same(alloc.usedCount,      initiallyInUse,                   ".usedCount");
    assert.same(alloc.reusableCount,  0,                                ".reusableCount");
    assert.same(alloc.availableCount, maxLenLimit - initiallyInUse,  ".availableCount");
    assert.same(alloc.lastUsed,       initiallyInUse - 1,               ".lastUsed");

    s1 = alloc.get();
    msg = " (after 1st get())";
    assert.same(alloc.lastUsed, s1, ".lastUsed" + msg);
    for (let i = 0; i < initiallyInUse; i++) {
        refute.same(s1, i, ".lastUsed not contained in initially used slots" + msg);
    }
    assert.same(alloc.maxLen,         initiallyInUse + 1,                   ".maxLen" + msg);
    assert.same(alloc.reusableCount,  0,                                    ".reusableCount" + msg);
    assert.same(alloc.availableCount, maxLenLimit - initiallyInUse - 1,  ".availableCount" + msg);

    s2 = alloc.get();
    msg = " (after 2nd get())";
    assert.same(alloc.lastUsed, s2, ".lastUsed" + msg);
    refute.same(s1, s2, "values from 1st and 2nd get()");
    for (let i = 0; i < initiallyInUse; i++) {
        refute.same(s2, i, ".lastUsed not contained in initially used slots" + msg);
    }
    assert.same(alloc.maxLen,         initiallyInUse + 2,                   ".maxLen" + msg);
    assert.same(alloc.reusableCount,  0,                                    ".reusableCount" + msg);
    assert.same(alloc.availableCount, maxLenLimit - initiallyInUse - 2,  ".availableCount" + msg);

    // use up all up to maxLenLimit:
    for (let i = initiallyInUse + 2; i < maxLenLimit; i++) {
        alloc.get();
    }
    msg = " after maxLenLimit is reached";
    assert.same(alloc.maxLen,         maxLenLimit, ".maxLen" + msg);
    assert.same(alloc.reusableCount,  0,              ".reusableCount" + msg);
    assert.same(alloc.availableCount, 0,              ".availableCount" + msg);
    assert.throws( () => { alloc.get() },             ".get()" + msg);


    alloc = init(0);
    assert.same(alloc.lastUsed, undefined, ".lastUsed after init(0)");
    s1 = alloc.get();
    assert.same(alloc.lastUsed, s1, ".lastUsed after init(0).get()");
    s2 = alloc.get();
    assert.same(alloc.lastUsed, s2, ".lastUsed after 2nd get()");
    refute.same(s1, s2, "values from 1st and 2nd get()");


    initiallyInUse = 2;
    alloc = init(initiallyInUse);
    assert.same(alloc.maxLen,         initiallyInUse,       ".maxLen");
    assert.same(alloc.usedCount,      initiallyInUse,       ".usedCount");
    assert.same(alloc.reusableCount,  0,                    ".reusableCount");
    assert.same(alloc.availableCount, Infinity,             ".availableCount");
    assert.same(alloc.lastUsed,       initiallyInUse - 1,   ".lastUsed");
    s1 = alloc.get();
    msg = " (after 1st get())";
    assert.same(alloc.lastUsed, s1, ".lastUsed" + msg);
    for (let i = 0; i < initiallyInUse; i++) {
        refute.same(s1, i, ".lastUsed not contained in initially used slots" + msg);
    }
    s2 = alloc.get();
    msg = " (after 2nd get())";
    assert.same(alloc.lastUsed, s2, ".lastUsed" + msg);
    refute.same(s1, s2, "values from 1st and 2nd get()");
    for (let i = 0; i < initiallyInUse; i++) {
        refute.same(s1, i, ".lastUsed not contained in initially used slots" + msg);
    }
    for (let i = 0; i < 500 - 2; i++) {
        refute.throws( () => alloc.get(), ".get() with infinite maxLenLimit");
    }
    assert.same(alloc.maxLen, initiallyInUse + 500,
        ".maxLen after 500 calls to .get() with infinite maxLenLimit");


    initiallyInUse = 2;
    alloc = init(initiallyInUse);
    s1 = alloc.get(0, true, 0, false);
    assert.same(s1, 0, "1st reusable (same arg twice)");
    s1 = alloc.get(0, true, 1, false);
    assert.same(s1, 0, "1st reusable (different args)");
    s1 = alloc.get(1, true, 0, false);
    assert.same(s1, 1, "1st reusable (different args, swapped)");
    s1 = alloc.get(0, false, 1, true);
    assert.same(s1, 1, "2nd reusable (different args)");
    s1 = alloc.get(0, false, 1, false);
    assert.same(s1, 2, "none reusable (different args)");
    assert.same(alloc.maxLen, initiallyInUse + 1, "none reusable (different args) ~> inc .maxLen");
    s1 = alloc.get(s1, true, 1, true);
    assert((s1 === 2) || (s1 === 1), "both reusable (different, 1st == lastUsed from before)");
    s2 = s1 === 2 ? 1 : 2;
    s1 = alloc.get(s1, false, 0, false);
    assert.same(s1, s2, "none reusable (different args) ~> reuse the one left over from before");
}();


() => {

    let test = {
        init: (got, opts) => {
            let n       = got.length,
                maxLen  = n,
                alloc   = init(n),
                usedS   = new Set(got),
                usableS = new Set([n]),
                i       = 0;

            function step(i0, reuse0, i1, reuse1) {
                let a0 = got[i0 + n],
                    a1 = got[i1 + n],
                    msg = "before " + (i+1) + "th get(...): ";
                assert(usedS.has(a0), msg + "arg 0, " + a0 + " should be in usedS=" + util.inspect(usedS));
                assert(usedS.has(a1), msg + "arg 1, " + a1 + " should be in usedS=" + util.inspect(usedS));
                // move reusable args from used to usable:
                if (reuse0) { usedS.delete(a0); usableS.add(a0); }
                if (reuse1) { usedS.delete(a1); usableS.add(a1); }

                let g = alloc.get(a0, reuse0, a1, reuse1);
                msg = "after " + (i+1) + "th get(...): ";
                assert(usableS.has(g), msg + ".lastUsed=" + g + " should have been usable before = " + util.inspect(usableS));
                assert(g < opts.maxLenLimit, msg + ".lastUsed=" + g + " should be less than maxLenLimit=" + opts.maxLenLimit);
                // move g from usable to used
                usableS.delete(g); usedS.add(g);
                if (g === maxLen) {
                    assert.same(usableS.size, 0, msg + "got maxLen=" + maxLen + " so usable should be empty now, but it is: " + util.inspect(usableS));
                    usableS.add(++maxLen);
                }
                assert.same(alloc.maxLen, maxLen, msg + ": .maxLen");
                // assert.same(alloc.reusableCount, usable.size - 1, msg + " .reusableCount; usable=" + util.inspect(usableS))

                // remember that we got g at i-th step
                got[i + n] = g;
                i++;
            }

            let testInstance = {
                step: function () {
                    step(...arguments);
                    return testInstance;
                }
            };
            return testInstance;
        }
    };

    test.init([0, 1], { maxLenLimit: 3, title: "or( and(a.not, b, c, d), and(a, b.not, d.not) )" })
        .step(-1, false, -2,  true)    // 0:  0 <- [0/+1],      1 ,      0  // maxParent:  2
        .step(-1, false,  0, false)    // 1:  2 <- [1/+1],      1 ,      0  // maxParent:  4
        .step( 0,  true, -1, false)    // 2:  0 <- [2/+2], swap(0),      1  // maxParent:  3
        .step( 2,  true, -1,  true)    // 3:  1 <- [1/-1],      0 ,      1  // maxParent:  4
        .step( 1,  true,  3,  true)    // 4:  1 <- [3/+2],      2 ,      1  // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 3, title: "or( and(a, b, c, d), and(a.not, b.not, d.not) )" })
        .step(-2,  true, -1, false)    // 0:  0 <- [0/+1],      0 ,      1  // maxParent:  3
        .step( 0, false, -1, false)    // 1:  2 <- [1/+1],      0 ,      1  // maxParent:  2
        .step( 1,  true, -1, false)    // 2:  2 <- [2/+1],      2 ,      1  // maxParent:  4
        .step(-1,  true,  0,  true)    // 3:  0 <- [2/+2],      1 , swap(0) // maxParent:  4
        .step( 2,  true,  3,  true)    // 4:  0 <- [3/+1],      2 ,      0  // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 2, title: "and( eqv(a, d), eqv(b, c) )" })
        .step(-2,  true, -1, false)    // 0:  0 <- [0/+1],      0 ,      1  // maxParent:  1
        .step( 0,  true, -1,  true)    // 1:  1 <- [1/+1],      0 ,      1  // maxParent:  2
        .step( 1,  true,  1, false)    // 2:  1 <- [2/+1],      1 , swap(1) // maxParent:  3
        .step( 2,  true,  2, false)    // 3:  1 <- [3/+1],      1 , flip(1) // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 2, title: "4-Queens" })
        .step( -2,  true,  -1, false)    //  0:   0 <- [ 0/+1],       0 ,       1  // maxParent:  1
        .step(  0,  true,  -1, false)    //  1:   0 <- [ 1/+1],       0 ,       1  // maxParent:  2
        .step( -1, false,   1,  true)    //  2:   0 <- [ 2/+1],       1 ,       0  // maxParent:  3
        .step( -1, false,   2,  true)    //  3:   0 <- [ 3/+1],       1 ,       0  // maxParent:  4
        .step( -1, false,   3,  true)    //  4:   0 <- [ 4/+1],       1 ,       0  // maxParent:  5
        .step(  4,  true,  -1, false)    //  5:   0 <- [ 5/+1],       0 ,       1  // maxParent:  6
        .step( -1,  true,   5,  true)    //  6:   0 <- [ 6/+1],       1 ,       0  // maxParent:  7
        .step(  6,  true,   6, false)    //  7:   0 <- [ 7/+1],       0 , flip( 0) // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 9, title: "5-Queens" })
        .step( -2,  true,  -1, false)    //  0:   0 <- [ 0/+1],       0 ,       1  // maxParent:  1
        .step(  0,  true,  -1, false)    //  1:   0 <- [ 1/+1],       0 ,       1  // maxParent:  17
        .step( -1, false,   1, false)    //  2:   2 <- [ 2/+1],       1 ,       0  // maxParent:  33
        .step( -1, false,   2, false)    //  3:   3 <- [ 3/+1],       1 ,       2  // maxParent:  4
        .step( -1, false,   3,  true)    //  4:   3 <- [ 4/+1],       1 ,       3  // maxParent:  8
        .step( -1, false,   4, false)    //  5:   4 <- [ 5/+1],       1 ,       3  // maxParent:  39
        .step(  5, false,  -1, false)    //  6:   5 <- [ 6/+1],       4 ,       1  // maxParent:  7
        .step( -1, false,   6,  true)    //  7:   5 <- [ 7/+1],       1 ,       5  // maxParent:  11
        .step(  4,  true,  -1, false)    //  8:   3 <- [ 5/+1], flop( 3),       1  // maxParent:  9
        .step( -1, false,   8,  true)    //  9:   3 <- [ 6/+1],       1 ,       3  // maxParent:  10
        .step(  9,  true,  -1, false)    // 10:   3 <- [ 7/+1],       3 ,       1  // maxParent:  48
        .step(  7,  true,  10, false)    // 11:   5 <- [ 8/+1],       5 ,       3  // maxParent:  12
        .step( -1, false,  11,  true)    // 12:   5 <- [ 9/+1],       1 ,       5  // maxParent:  13
        .step( -1, false,  12,  true)    // 13:   5 <- [10/+1],       1 ,       5  // maxParent:  14
        .step( -1, false,  13,  true)    // 14:   5 <- [11/+1],       1 ,       5  // maxParent:  15
        .step( -1, false,  14,  true)    // 15:   5 <- [12/+1],       1 ,       5  // maxParent:  16
        .step( -1, false,  15,  true)    // 16:   5 <- [13/+1],       1 ,       5  // maxParent:  58
        .step(  1,  true,  -1, false)    // 17:   0 <- [ 2/+1], flop( 0),       1  // maxParent:  18
        .step( -1, false,  17,  true)    // 18:   0 <- [ 3/+1],       1 ,       0  // maxParent:  24
        .step( -1, false,  18, false)    // 19:   6 <- [ 4/+1],       1 ,       0  // maxParent:  20
        .step( -1, false,  19,  true)    // 20:   6 <- [ 5/+1],       1 ,       6  // maxParent:  21
        .step( 20,  true,  -1, false)    // 21:   6 <- [ 6/+1],       6 ,       1  // maxParent:  51
        .step( -1, false,  21, false)    // 22:   7 <- [ 7/+1],       1 ,       6  // maxParent:  23
        .step( -1, false,  22,  true)    // 23:   7 <- [ 8/+1],       1 ,       7  // maxParent:  29
        .step( 18,  true,  -1, false)    // 24:   0 <- [ 4/+1], flop( 0),       1  // maxParent:  25
        .step( 24,  true,  -1, false)    // 25:   0 <- [ 5/+1],       0 ,       1  // maxParent:  45
        .step( -1, false,  25, false)    // 26:   8 <- [ 6/+1],       1 ,       0  // maxParent:  27
        .step( 26,  true,  -1, false)    // 27:   8 <- [ 7/+1],       8 ,       1  // maxParent:  28
        .step( -1, false,  27,  true)    // 28:   8 <- [ 8/+1],       1 ,       8  // maxParent:  29
        .step( 23,  true,  28,  true)    // 29:   8 <- [ 9/+1],       7 ,       8  // maxParent:  30
        .step( -1, false,  29,  true)    // 30:   8 <- [10/+1],       1 ,       8  // maxParent:  31
        .step( -1, false,  30,  true)    // 31:   8 <- [11/+1],       1 ,       8  // maxParent:  32
        .step( -1, false,  31,  true)    // 32:   8 <- [12/+1],       1 ,       8  // maxParent:  57
        .step(  2,  true,  -1, false)    // 33:   2 <- [ 3/+1], flop( 2),       1  // maxParent:  34
        .step( 33,  true,  -1, false)    // 34:   2 <- [ 4/+1],       2 ,       1  // maxParent:  35
        .step( -1, false,  34,  true)    // 35:   2 <- [ 5/+1],       1 ,       2  // maxParent:  36
        .step( 35,  true,  -1, false)    // 36:   2 <- [ 6/+1],       2 ,       1  // maxParent:  37
        .step( -1, false,  36,  true)    // 37:   2 <- [ 7/+1],       1 ,       2  // maxParent:  38
        .step( -1, false,  37,  true)    // 38:   2 <- [ 8/+1],       1 ,       2  // maxParent:  53
        .step( -1, false,   5,  true)    // 39:   4 <- [ 6/+1],       1 , swap( 4) // maxParent:  40
        .step( -1, false,  39,  true)    // 40:   4 <- [ 7/+1],       1 ,       4  // maxParent:  41
        .step( 40,  true,  -1, false)    // 41:   4 <- [ 8/+1],       4 ,       1  // maxParent:  42
        .step( 38, false,  41,  true)    // 42:   4 <- [ 9/+1],       2 ,       4  // maxParent:  43
        .step( -1, false,  42,  true)    // 43:   4 <- [10/+1],       1 ,       4  // maxParent:  44
        .step( -1, false,  43,  true)    // 44:   4 <- [11/+1],       1 ,       4  // maxParent:  56
        .step( -1, false,  25,  true)    // 45:   0 <- [ 6/+1],       1 , swap( 0) // maxParent:  46
        .step( 45,  true,  -1, false)    // 46:   0 <- [ 7/+1],       0 ,       1  // maxParent:  47
        .step( -1, false,  46,  true)    // 47:   0 <- [ 8/+1],       1 ,       0  // maxParent:  49
        .step( 10,  true,  -1, false)    // 48:   3 <- [ 8/+1], swap( 3),       1  // maxParent:  49
        .step( 47,  true,  48,  true)    // 49:   3 <- [ 9/+1],       0 ,       3  // maxParent:  50
        .step( -1, false,  49,  true)    // 50:   3 <- [10/+1],       1 ,       3  // maxParent:  55
        .step( 21,  true,  -1, false)    // 51:   6 <- [ 7/+1], swap( 6),       1  // maxParent:  52
        .step( -1, false,  51,  true)    // 52:   6 <- [ 8/+1],       1 ,       6  // maxParent:  53
        .step( 52,  true,  38,  true)    // 53:   2 <- [ 9/+1],       6 , swap( 2) // maxParent:  54
        .step( 53,  true,  -1,  true)    // 54:   1 <- [10/+1],       2 ,       1  // maxParent:  55
        .step( 50,  true,  54,  true)    // 55:   1 <- [11/+1],       3 ,       1  // maxParent:  56
        .step( 44,  true,  55,  true)    // 56:   1 <- [12/+1],       4 ,       1  // maxParent:  57
        .step( 32,  true,  56,  true)    // 57:   1 <- [13/+1],       8 ,       1  // maxParent:  58
        .step( 16,  true,  57,  true)    // 58:   1 <- [14/+1],       5 ,       1  // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 3, title: "4-bit-addition (GOOD variable ordering, height 12, size 32): bitstr(4, 'x').plus(bitstr(4, 'y')).eq(bitstr(4, 'z'))" })
        .step( -2,  true,  -1, false)    //  0:   0 <- [ 0/+1],       0 ,       1  // maxParent:  1
        .step(  0,  true,   0, false)    //  1:   0 <- [ 1/+1],       0 , swap( 0) // maxParent:  2
        .step(  1,  true,   1, false)    //  2:   0 <- [ 2/+1],       0 , swap( 0) // maxParent:  3
        .step(  2,  true,  -1, false)    //  3:   0 <- [ 3/+1],       0 ,       1  // maxParent:  5
        .step(  3, false,   3, false)    //  4:   2 <- [ 4/+1],       0 , swap( 0) // maxParent:  6
        .step(  3,  true,   3, false)    //  5:   0 <- [ 4/+1], swap( 0), flop( 0) // maxParent:  6
        .step(  4,  true,   5,  true)    //  6:   0 <- [ 5/+1],       2 ,       0  // maxParent:  7
        .step(  6,  true,  -1, false)    //  7:   0 <- [ 6/+1],       0 ,       1  // maxParent:  9
        .step(  7, false,   7, false)    //  8:   2 <- [ 7/+1],       0 , swap( 0) // maxParent:  10
        .step(  7,  true,   7, false)    //  9:   0 <- [ 7/+1], swap( 0), flop( 0) // maxParent:  10
        .step(  8,  true,   9,  true)    // 10:   0 <- [ 8/+1],       2 ,       0  // maxParent:  11
        .step( -1,  true,  10,  true)    // 11:   0 <- [ 9/+1],       1 ,       0  // maxParent:  13
        .step( 11, false,  11, false)    // 12:   1 <- [10/+1],       0 , flip( 0) // maxParent:  14
        .step( 11,  true,  11, false)    // 13:   0 <- [10/+1], flip( 0), flip( 0) // maxParent:  14
        .step( 12,  true,  13,  true)    // 14:   0 <- [11/+1],       1 ,       0  // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 3, title: "8-bit-addition (GOOD variable ordering, height 24, size 68): bitstr(8, 'x').plus(bitstr(8, 'y')).eq(bitstr(8, 'z'))" })
        .step( -2,  true,  -1, false)    //  0:   0 <- [ 0/+1],       0 ,       1  // maxParent:  1
        .step(  0,  true,   0, false)    //  1:   0 <- [ 1/+1],       0 , swap( 0) // maxParent:  2
        .step(  1,  true,   1, false)    //  2:   0 <- [ 2/+1],       0 , swap( 0) // maxParent:  3
        .step(  2,  true,  -1, false)    //  3:   0 <- [ 3/+1],       0 ,       1  // maxParent:  5
        .step(  3, false,   3, false)    //  4:   2 <- [ 4/+1],       0 , swap( 0) // maxParent:  6
        .step(  3,  true,   3, false)    //  5:   0 <- [ 4/+1], swap( 0), flop( 0) // maxParent:  6
        .step(  4,  true,   5,  true)    //  6:   0 <- [ 5/+1],       2 ,       0  // maxParent:  7
        .step(  6,  true,  -1, false)    //  7:   0 <- [ 6/+1],       0 ,       1  // maxParent:  9
        .step(  7, false,   7, false)    //  8:   2 <- [ 7/+1],       0 , swap( 0) // maxParent:  10
        .step(  7,  true,   7, false)    //  9:   0 <- [ 7/+1], swap( 0), flop( 0) // maxParent:  10
        .step(  8,  true,   9,  true)    // 10:   0 <- [ 8/+1],       2 ,       0  // maxParent:  11
        .step( 10,  true,  -1, false)    // 11:   0 <- [ 9/+1],       0 ,       1  // maxParent:  13
        .step( 11, false,  11, false)    // 12:   2 <- [10/+1],       0 , swap( 0) // maxParent:  14
        .step( 11,  true,  11, false)    // 13:   0 <- [10/+1], swap( 0), flop( 0) // maxParent:  14
        .step( 12,  true,  13,  true)    // 14:   0 <- [11/+1],       2 ,       0  // maxParent:  15
        .step( 14,  true,  -1, false)    // 15:   0 <- [12/+1],       0 ,       1  // maxParent:  17
        .step( 15, false,  15, false)    // 16:   2 <- [13/+1],       0 , swap( 0) // maxParent:  18
        .step( 15,  true,  15, false)    // 17:   0 <- [13/+1], swap( 0), flop( 0) // maxParent:  18
        .step( 16,  true,  17,  true)    // 18:   0 <- [14/+1],       2 ,       0  // maxParent:  19
        .step( 18,  true,  -1, false)    // 19:   0 <- [15/+1],       0 ,       1  // maxParent:  21
        .step( 19, false,  19, false)    // 20:   2 <- [16/+1],       0 , swap( 0) // maxParent:  22
        .step( 19,  true,  19, false)    // 21:   0 <- [16/+1], swap( 0), flop( 0) // maxParent:  22
        .step( 20,  true,  21,  true)    // 22:   0 <- [17/+1],       2 ,       0  // maxParent:  23
        .step( 22,  true,  -1, false)    // 23:   0 <- [18/+1],       0 ,       1  // maxParent:  25
        .step( 23, false,  23, false)    // 24:   2 <- [19/+1],       0 , swap( 0) // maxParent:  26
        .step( 23,  true,  23, false)    // 25:   0 <- [19/+1], swap( 0), flop( 0) // maxParent:  26
        .step( 24,  true,  25,  true)    // 26:   0 <- [20/+1],       2 ,       0  // maxParent:  27
        .step( -1,  true,  26,  true)    // 27:   0 <- [21/+1],       1 ,       0  // maxParent:  29
        .step( 27, false,  27, false)    // 28:   1 <- [22/+1],       0 , flip( 0) // maxParent:  30
        .step( 27,  true,  27, false)    // 29:   0 <- [22/+1], flip( 0), flip( 0) // maxParent:  30
        .step( 28,  true,  29,  true)    // 30:   0 <- [23/+1],       1 ,       0  // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 12, title: "4-bit-addition (BAD variable ordering, height 12, size 111): bitstr('x', 4).plus(bitstr('y', 4)).eq(bitstr('z', 4))" })
        .step( -2,  true,  -1, false)    //   0:    0 <- [ 0/+1],        0 ,        1  // maxParent:  1
        .step(  0,  true,  -1, false)    //   1:    0 <- [ 1/+1],        0 ,        1  // maxParent:  4
        .step(  1, false,  -1, false)    //   2:    2 <- [ 2/+1],        0 ,        1  // maxParent:  8
        .step( -1, false,   2, false)    //   3:    3 <- [ 3/+1],        1 ,        2  // maxParent:  12
        .step(  1,  true,  -1, false)    //   4:    0 <- [ 2/+1], flop(  0),        1  // maxParent:  7
        .step( -1, false,   4, false)    //   5:    4 <- [ 3/+1],        1 ,        0  // maxParent:  12
        .step(  3, false,   5, false)    //   6:    5 <- [ 4/+1],        3 ,        4  // maxParent:  27
        .step( -1, false,   4,  true)    //   7:    0 <- [ 3/+1],        1 , flop(  0) // maxParent:  11
        .step( -1,  true,   2,  true)    //   8:    2 <- [ 3/+1],        1 , flop(  2) // maxParent:  11
        .step(  7, false,   8, false)    //   9:    1 <- [ 4/+1],        0 ,        2  // maxParent:  27
        .step(  6, false,   9, false)    //  10:    6 <- [ 5/+1],        5 ,        1  // maxParent:  16
        .step(  8,  true,   7,  true)    //  11:    0 <- [ 4/+1], flop(  2), flop(  0) // maxParent:  21
        .step(  5,  true,   3,  true)    //  12:    3 <- [ 4/+1], flop(  4), flop(  3) // maxParent:  21
        .step( 11, false,  12, false)    //  13:    4 <- [ 5/+1],        0 ,        3  // maxParent:  31
        .step( 10, false,  13, false)    //  14:    2 <- [ 6/+1],        6 ,        4  // maxParent:  43
        .step( 11, false,  12, false)    //  15:    7 <- [ 5/+1], flip(  0), flop(  3) // maxParent:  30
        .step( 10,  true,  15, false)    //  16:    6 <- [ 6/+1], flip(  6),        7  // maxParent:  36
        .step( 14, false,  16, false)    //  17:    8 <- [ 7/+1],        2 ,        6  // maxParent:  24
        .step(  6, false,   9, false)    //  18:    9 <- [ 5/+1], swap(  5), swap(  1) // maxParent:  22
        .step( 11, false,  12, false)    //  19:   10 <- [ 5/+1], swap(  0), swap(  3) // maxParent:  28
        .step( 18, false,  19, false)    //  20:   11 <- [ 6/+1],        9 ,       10  // maxParent:  42
        .step( 11,  true,  12,  true)    //  21:    3 <- [ 5/+1], flip(  0), flip(  3) // maxParent:  26
        .step( 18,  true,  21, false)    //  22:    9 <- [ 6/+1], flip(  9),        3  // maxParent:  37
        .step( 20, false,  22, false)    //  23:    0 <- [ 7/+1],       11 ,        9  // maxParent:  24
        .step( 17,  true,  23,  true)    //  24:    0 <- [ 8/+1],        8 ,        0  // maxParent:  34
        .step(  9, false,   6, false)    //  25:    8 <- [ 5/+1],        1 , swap(  5) // maxParent:  31
        .step( 25, false,  21,  true)    //  26:    3 <- [ 6/+1],        8 , flip(  3) // maxParent:  40
        .step(  6,  true,   9,  true)    //  27:    1 <- [ 5/+1], flip(  5), flop(  1) // maxParent:  30
        .step( 27, false,  19,  true)    //  28:   10 <- [ 6/+1],        1 , flip( 10) // maxParent:  37
        .step( 26, false,  28, false)    //  29:    5 <- [ 7/+1],        3 ,       10  // maxParent:  33
        .step( 27,  true,  15,  true)    //  30:    7 <- [ 6/+1], flip(  1), flip(  7) // maxParent:  40
        .step( 25,  true,  13,  true)    //  31:    4 <- [ 6/+1], flip(  8), flip(  4) // maxParent:  36
        .step( 30, false,  31, false)    //  32:    8 <- [ 7/+1],        7 ,        4  // maxParent:  33
        .step( 29,  true,  32,  true)    //  33:    8 <- [ 8/+1],        5 ,        8  // maxParent:  34
        .step( 24,  true,  33,  true)    //  34:    8 <- [ 9/+1],        0 ,        8  // maxParent:  35
        .step( 34,  true,  34, false)    //  35:    8 <- [10/+1],        8 , flip(  8) // maxParent:  47
        .step( 16,  true,  31,  true)    //  36:    4 <- [ 7/+1],        6 , flip(  4) // maxParent:  38
        .step( 22,  true,  28,  true)    //  37:   10 <- [ 7/+1],        9 , flip( 10) // maxParent:  38
        .step( 36,  true,  37,  true)    //  38:   10 <- [ 8/+1],        4 ,       10  // maxParent:  39
        .step( 38,  true,  38, false)    //  39:   10 <- [ 9/+1],       10 , flip( 10) // maxParent:  46
        .step( 30,  true,  26,  true)    //  40:    3 <- [ 7/+1], flip(  7),        3  // maxParent:  41
        .step( 40,  true,  40, false)    //  41:    3 <- [ 8/+1],        3 , flip(  3) // maxParent:  45
        .step( 20,  true,  20, false)    //  42:   11 <- [ 7/+1], flip( 11),       11  // maxParent:  44
        .step( 14,  true,  14, false)    //  43:    2 <- [ 7/+1], flip(  2),        2  // maxParent:  44
        .step( 42,  true,  43,  true)    //  44:    2 <- [ 8/+1],       11 ,        2  // maxParent:  45
        .step( 41,  true,  44,  true)    //  45:    2 <- [ 9/+1],        3 ,        2  // maxParent:  46
        .step( 39,  true,  45,  true)    //  46:    2 <- [10/+1],       10 ,        2  // maxParent:  47
        .step( 35,  true,  46,  true)    //  47:    2 <- [11/+1],        8 ,        2  // maxParent:  Infinity
    ;

    test.init([0,1], { maxLenLimit: 252, title: "8-bit-addition (BAD variable ordering, height 24, size 2815): bitstr('x', 8).plus(bitstr('y', 8)).eq(bitstr('z', 8))" })
        .step(   -2,  true,    -1, false)    //    0:     0 <- [ 0/+1],         0 ,         1  // maxParent:  1
        .step(    0,  true,    -1, false)    //    1:     0 <- [ 1/+1],         0 ,         1  // maxParent:  8
        .step(    1, false,    -1, false)    //    2:     2 <- [ 2/+1],         0 ,         1  // maxParent:  20
        .step(    2, false,    -1, false)    //    3:     3 <- [ 3/+1],         2 ,         1  // maxParent:  40
        .step(    3, false,    -1, false)    //    4:     4 <- [ 4/+1],         3 ,         1  // maxParent:  72
        .step(    4, false,    -1, false)    //    5:     5 <- [ 5/+1],         4 ,         1  // maxParent:  120
        .step(    5, false,    -1, false)    //    6:     6 <- [ 6/+1],         5 ,         1  // maxParent:  184
        .step(   -1, false,     6, false)    //    7:     7 <- [ 7/+1],         1 ,         6  // maxParent:  248
        .step(    1,  true,    -1, false)    //    8:     0 <- [ 2/+1], flop(   0),         1  // maxParent:  15
        .step(    8, false,    -1, false)    //    9:     8 <- [ 3/+1],         0 ,         1  // maxParent:  36
        .step(    9, false,    -1, false)    //   10:     9 <- [ 4/+1],         8 ,         1  // maxParent:  69
        .step(   10, false,    -1, false)    //   11:    10 <- [ 5/+1],         9 ,         1  // maxParent:  118
        .step(   11, false,    -1, false)    //   12:    11 <- [ 6/+1],        10 ,         1  // maxParent:  183
        .step(   -1, false,    12, false)    //   13:    12 <- [ 7/+1],         1 ,        11  // maxParent:  248
        .step(    7, false,    13, false)    //   14:    13 <- [ 8/+1],         7 ,        12  // maxParent:  421
        .step(    8,  true,    -1, false)    //   15:     0 <- [ 3/+1], flop(   0),         1  // maxParent:  31
        .step(   15, false,    -1, false)    //   16:    14 <- [ 4/+1],         0 ,         1  // maxParent:  65
        .step(   16, false,    -1, false)    //   17:    15 <- [ 5/+1],        14 ,         1  // maxParent:  115
        .step(   17, false,    -1, false)    //   18:    16 <- [ 6/+1],        15 ,         1  // maxParent:  181
        .step(   -1, false,    18, false)    //   19:    17 <- [ 7/+1],         1 ,        16  // maxParent:  247
        .step(    2,  true,    -1, false)    //   20:     2 <- [ 3/+1], flop(   2),         1  // maxParent:  27
        .step(   20, false,    -1, false)    //   21:    18 <- [ 4/+1],         2 ,         1  // maxParent:  62
        .step(   21, false,    -1, false)    //   22:    19 <- [ 5/+1],        18 ,         1  // maxParent:  113
        .step(   22, false,    -1, false)    //   23:    20 <- [ 6/+1],        19 ,         1  // maxParent:  180
        .step(   -1, false,    23, false)    //   24:    21 <- [ 7/+1],         1 ,        20  // maxParent:  247
        .step(   19, false,    24, false)    //   25:    22 <- [ 8/+1],        17 ,        21  // maxParent:  421
        .step(   14, false,    25, false)    //   26:    23 <- [ 9/+1],        13 ,        22  // maxParent:  512
        .step(   20,  true,    -1, false)    //   27:     2 <- [ 4/+1], flop(   2),         1  // maxParent:  57
        .step(   27, false,    -1, false)    //   28:    24 <- [ 5/+1],         2 ,         1  // maxParent:  109
        .step(   28, false,    -1, false)    //   29:    25 <- [ 6/+1],        24 ,         1  // maxParent:  177
        .step(   -1, false,    29, false)    //   30:    26 <- [ 7/+1],         1 ,        25  // maxParent:  245
        .step(   15,  true,    -1, false)    //   31:     0 <- [ 4/+1], flop(   0),         1  // maxParent:  54
        .step(   31, false,    -1, false)    //   32:    27 <- [ 5/+1],         0 ,         1  // maxParent:  107
        .step(   32, false,    -1, false)    //   33:    28 <- [ 6/+1],        27 ,         1  // maxParent:  176
        .step(   -1, false,    33, false)    //   34:    29 <- [ 7/+1],         1 ,        28  // maxParent:  245
        .step(   30, false,    34, false)    //   35:    30 <- [ 8/+1],        26 ,        29  // maxParent:  420
        .step(    9,  true,    -1, false)    //   36:     8 <- [ 4/+1], flop(   8),         1  // maxParent:  50
        .step(   36, false,    -1, false)    //   37:    31 <- [ 5/+1],         8 ,         1  // maxParent:  104
        .step(   37, false,    -1, false)    //   38:    32 <- [ 6/+1],        31 ,         1  // maxParent:  174
        .step(   -1, false,    38, false)    //   39:    33 <- [ 7/+1],         1 ,        32  // maxParent:  244
        .step(    3,  true,    -1, false)    //   40:     3 <- [ 4/+1], flop(   3),         1  // maxParent:  47
        .step(   40, false,    -1, false)    //   41:    34 <- [ 5/+1],         3 ,         1  // maxParent:  102
        .step(   41, false,    -1, false)    //   42:    35 <- [ 6/+1],        34 ,         1  // maxParent:  173
        .step(   -1, false,    42, false)    //   43:    36 <- [ 7/+1],         1 ,        35  // maxParent:  244
        .step(   39, false,    43, false)    //   44:    37 <- [ 8/+1],        33 ,        36  // maxParent:  420
        .step(   35, false,    44, false)    //   45:    38 <- [ 9/+1],        30 ,        37  // maxParent:  471
        .step(   26, false,    45, false)    //   46:    39 <- [10/+1],        23 ,        38  // maxParent:  633
        .step(   40,  true,    -1, false)    //   47:     3 <- [ 5/+1], flop(   3),         1  // maxParent:  97
        .step(   47, false,    -1, false)    //   48:    40 <- [ 6/+1],         3 ,         1  // maxParent:  169
        .step(   -1, false,    48, false)    //   49:    41 <- [ 7/+1],         1 ,        40  // maxParent:  241
        .step(   36,  true,    -1, false)    //   50:     8 <- [ 5/+1], flop(   8),         1  // maxParent:  95
        .step(   50, false,    -1, false)    //   51:    42 <- [ 6/+1],         8 ,         1  // maxParent:  168
        .step(   -1, false,    51, false)    //   52:    43 <- [ 7/+1],         1 ,        42  // maxParent:  241
        .step(   49, false,    52, false)    //   53:    44 <- [ 8/+1],        41 ,        43  // maxParent:  418
        .step(   31,  true,    -1, false)    //   54:     0 <- [ 5/+1], flop(   0),         1  // maxParent:  92
        .step(   54, false,    -1, false)    //   55:    45 <- [ 6/+1],         0 ,         1  // maxParent:  166
        .step(   -1, false,    55, false)    //   56:    46 <- [ 7/+1],         1 ,        45  // maxParent:  240
        .step(   27,  true,    -1, false)    //   57:     2 <- [ 5/+1], flop(   2),         1  // maxParent:  90
        .step(   57, false,    -1, false)    //   58:    47 <- [ 6/+1],         2 ,         1  // maxParent:  165
        .step(   -1, false,    58, false)    //   59:    48 <- [ 7/+1],         1 ,        47  // maxParent:  240
        .step(   56, false,    59, false)    //   60:    49 <- [ 8/+1],        46 ,        48  // maxParent:  418
        .step(   53, false,    60, false)    //   61:    50 <- [ 9/+1],        44 ,        49  // maxParent:  511
        .step(   21,  true,    -1, false)    //   62:    18 <- [ 5/+1], flop(  18),         1  // maxParent:  86
        .step(   62, false,    -1, false)    //   63:    51 <- [ 6/+1],        18 ,         1  // maxParent:  162
        .step(   -1, false,    63, false)    //   64:    52 <- [ 7/+1],         1 ,        51  // maxParent:  238
        .step(   16,  true,    -1, false)    //   65:    14 <- [ 5/+1], flop(  14),         1  // maxParent:  84
        .step(   65, false,    -1, false)    //   66:    53 <- [ 6/+1],        14 ,         1  // maxParent:  161
        .step(   -1, false,    66, false)    //   67:    54 <- [ 7/+1],         1 ,        53  // maxParent:  238
        .step(   64, false,    67, false)    //   68:    55 <- [ 8/+1],        52 ,        54  // maxParent:  417
        .step(   10,  true,    -1, false)    //   69:     9 <- [ 5/+1], flop(   9),         1  // maxParent:  81
        .step(   69, false,    -1, false)    //   70:    56 <- [ 6/+1],         9 ,         1  // maxParent:  159
        .step(   -1, false,    70, false)    //   71:    57 <- [ 7/+1],         1 ,        56  // maxParent:  237
        .step(    4,  true,    -1, false)    //   72:     4 <- [ 5/+1], flop(   4),         1  // maxParent:  79
        .step(   72, false,    -1, false)    //   73:    58 <- [ 6/+1],         4 ,         1  // maxParent:  158
        .step(   -1, false,    73, false)    //   74:    59 <- [ 7/+1],         1 ,        58  // maxParent:  237
        .step(   71, false,    74, false)    //   75:    60 <- [ 8/+1],        57 ,        59  // maxParent:  417
        .step(   68, false,    75, false)    //   76:    61 <- [ 9/+1],        55 ,        60  // maxParent:  472
        .step(   61, false,    76, false)    //   77:    62 <- [10/+1],        50 ,        61  // maxParent:  615
        .step(   46, false,    77, false)    //   78:    63 <- [11/+1],        39 ,        62  // maxParent:  774
        .step(   72,  true,    -1, false)    //   79:     4 <- [ 6/+1], flop(   4),         1  // maxParent:  153
        .step(   -1, false,    79, false)    //   80:    64 <- [ 7/+1],         1 ,         4  // maxParent:  233
        .step(   69,  true,    -1, false)    //   81:     9 <- [ 6/+1], flop(   9),         1  // maxParent:  152
        .step(   -1, false,    81, false)    //   82:    65 <- [ 7/+1],         1 ,         9  // maxParent:  233
        .step(   80, false,    82, false)    //   83:    66 <- [ 8/+1],        64 ,        65  // maxParent:  414
        .step(   65,  true,    -1, false)    //   84:    14 <- [ 6/+1], flop(  14),         1  // maxParent:  150
        .step(   -1, false,    84, false)    //   85:    67 <- [ 7/+1],         1 ,        14  // maxParent:  232
        .step(   62,  true,    -1, false)    //   86:    18 <- [ 6/+1], flop(  18),         1  // maxParent:  149
        .step(   -1, false,    86, false)    //   87:    68 <- [ 7/+1],         1 ,        18  // maxParent:  232
        .step(   85, false,    87, false)    //   88:    69 <- [ 8/+1],        67 ,        68  // maxParent:  414
        .step(   83, false,    88, false)    //   89:    70 <- [ 9/+1],        66 ,        69  // maxParent:  509
        .step(   57,  true,    -1, false)    //   90:     2 <- [ 6/+1], flop(   2),         1  // maxParent:  146
        .step(   -1, false,    90, false)    //   91:    71 <- [ 7/+1],         1 ,         2  // maxParent:  230
        .step(   54,  true,    -1, false)    //   92:     0 <- [ 6/+1], flop(   0),         1  // maxParent:  145
        .step(   -1, false,    92, false)    //   93:    72 <- [ 7/+1],         1 ,         0  // maxParent:  230
        .step(   91, false,    93, false)    //   94:    73 <- [ 8/+1],        71 ,        72  // maxParent:  413
        .step(   50,  true,    -1, false)    //   95:     8 <- [ 6/+1], flop(   8),         1  // maxParent:  143
        .step(   -1, false,    95, false)    //   96:    74 <- [ 7/+1],         1 ,         8  // maxParent:  229
        .step(   47,  true,    -1, false)    //   97:     3 <- [ 6/+1], flop(   3),         1  // maxParent:  142
        .step(   -1, false,    97, false)    //   98:    75 <- [ 7/+1],         1 ,         3  // maxParent:  229
        .step(   96, false,    98, false)    //   99:    76 <- [ 8/+1],        74 ,        75  // maxParent:  413
        .step(   94, false,    99, false)    //  100:    77 <- [ 9/+1],        73 ,        76  // maxParent:  474
        .step(   89, false,   100, false)    //  101:    78 <- [10/+1],        70 ,        77  // maxParent:  632
        .step(   41,  true,    -1, false)    //  102:    34 <- [ 6/+1], flop(  34),         1  // maxParent:  138
        .step(   -1, false,   102, false)    //  103:    79 <- [ 7/+1],         1 ,        34  // maxParent:  226
        .step(   37,  true,    -1, false)    //  104:    31 <- [ 6/+1], flop(  31),         1  // maxParent:  137
        .step(   -1, false,   104, false)    //  105:    80 <- [ 7/+1],         1 ,        31  // maxParent:  226
        .step(  103, false,   105, false)    //  106:    81 <- [ 8/+1],        79 ,        80  // maxParent:  411
        .step(   32,  true,    -1, false)    //  107:    27 <- [ 6/+1], flop(  27),         1  // maxParent:  135
        .step(   -1, false,   107, false)    //  108:    82 <- [ 7/+1],         1 ,        27  // maxParent:  225
        .step(   28,  true,    -1, false)    //  109:    24 <- [ 6/+1], flop(  24),         1  // maxParent:  134
        .step(   -1, false,   109, false)    //  110:    83 <- [ 7/+1],         1 ,        24  // maxParent:  225
        .step(  108, false,   110, false)    //  111:    84 <- [ 8/+1],        82 ,        83  // maxParent:  411
        .step(  106, false,   111, false)    //  112:    85 <- [ 9/+1],        81 ,        84  // maxParent:  508
        .step(   22,  true,    -1, false)    //  113:    19 <- [ 6/+1], flop(  19),         1  // maxParent:  131
        .step(   -1, false,   113, false)    //  114:    86 <- [ 7/+1],         1 ,        19  // maxParent:  223
        .step(   17,  true,    -1, false)    //  115:    15 <- [ 6/+1], flop(  15),         1  // maxParent:  130
        .step(   -1, false,   115, false)    //  116:    87 <- [ 7/+1],         1 ,        15  // maxParent:  223
        .step(  114, false,   116, false)    //  117:    88 <- [ 8/+1],        86 ,        87  // maxParent:  410
        .step(   11,  true,    -1, false)    //  118:    10 <- [ 6/+1], flop(  10),         1  // maxParent:  128
        .step(   -1, false,   118, false)    //  119:    89 <- [ 7/+1],         1 ,        10  // maxParent:  222
        .step(    5,  true,    -1, false)    //  120:     5 <- [ 6/+1], flop(   5),         1  // maxParent:  127
        .step(   -1, false,   120, false)    //  121:    90 <- [ 7/+1],         1 ,         5  // maxParent:  222
        .step(  119, false,   121, false)    //  122:    91 <- [ 8/+1],        89 ,        90  // maxParent:  410
        .step(  117, false,   122, false)    //  123:    92 <- [ 9/+1],        88 ,        91  // maxParent:  475
        .step(  112, false,   123, false)    //  124:    93 <- [10/+1],        85 ,        92  // maxParent:  616
        .step(  101, false,   124, false)    //  125:    94 <- [11/+1],        78 ,        93  // maxParent:  767
        .step(   78, false,   125, false)    //  126:    95 <- [12/+1],        63 ,        94  // maxParent:  929
        .step(   -1, false,   120,  true)    //  127:     5 <- [ 7/+1],         1 , flop(   5) // maxParent:  217
        .step(   -1, false,   118,  true)    //  128:    10 <- [ 7/+1],         1 , flop(  10) // maxParent:  217
        .step(  127, false,   128, false)    //  129:    96 <- [ 8/+1],         5 ,        10  // maxParent:  406
        .step(   -1, false,   115,  true)    //  130:    15 <- [ 7/+1],         1 , flop(  15) // maxParent:  216
        .step(   -1, false,   113,  true)    //  131:    19 <- [ 7/+1],         1 , flop(  19) // maxParent:  216
        .step(  130, false,   131, false)    //  132:    97 <- [ 8/+1],        15 ,        19  // maxParent:  406
        .step(  129, false,   132, false)    //  133:    98 <- [ 9/+1],        96 ,        97  // maxParent:  505
        .step(   -1, false,   109,  true)    //  134:    24 <- [ 7/+1],         1 , flop(  24) // maxParent:  214
        .step(   -1, false,   107,  true)    //  135:    27 <- [ 7/+1],         1 , flop(  27) // maxParent:  214
        .step(  134, false,   135, false)    //  136:    99 <- [ 8/+1],        24 ,        27  // maxParent:  405
        .step(   -1, false,   104,  true)    //  137:    31 <- [ 7/+1],         1 , flop(  31) // maxParent:  213
        .step(   -1, false,   102,  true)    //  138:    34 <- [ 7/+1],         1 , flop(  34) // maxParent:  213
        .step(  137, false,   138, false)    //  139:   100 <- [ 8/+1],        31 ,        34  // maxParent:  405
        .step(  136, false,   139, false)    //  140:   101 <- [ 9/+1],        99 ,       100  // maxParent:  478
        .step(  133, false,   140, false)    //  141:   102 <- [10/+1],        98 ,       101  // maxParent:  630
        .step(   -1, false,    97,  true)    //  142:     3 <- [ 7/+1],         1 , flop(   3) // maxParent:  210
        .step(   -1, false,    95,  true)    //  143:     8 <- [ 7/+1],         1 , flop(   8) // maxParent:  210
        .step(  142, false,   143, false)    //  144:   103 <- [ 8/+1],         3 ,         8  // maxParent:  403
        .step(   -1, false,    92,  true)    //  145:     0 <- [ 7/+1],         1 , flop(   0) // maxParent:  209
        .step(   -1, false,    90,  true)    //  146:     2 <- [ 7/+1],         1 , flop(   2) // maxParent:  209
        .step(  145, false,   146, false)    //  147:   104 <- [ 8/+1],         0 ,         2  // maxParent:  403
        .step(  144, false,   147, false)    //  148:   105 <- [ 9/+1],       103 ,       104  // maxParent:  504
        .step(   -1, false,    86,  true)    //  149:    18 <- [ 7/+1],         1 , flop(  18) // maxParent:  207
        .step(   -1, false,    84,  true)    //  150:    14 <- [ 7/+1],         1 , flop(  14) // maxParent:  207
        .step(  149, false,   150, false)    //  151:   106 <- [ 8/+1],        18 ,        14  // maxParent:  402
        .step(   -1, false,    81,  true)    //  152:     9 <- [ 7/+1],         1 , flop(   9) // maxParent:  206
        .step(   -1, false,    79,  true)    //  153:     4 <- [ 7/+1],         1 , flop(   4) // maxParent:  206
        .step(  152, false,   153, false)    //  154:   107 <- [ 8/+1],         9 ,         4  // maxParent:  402
        .step(  151, false,   154, false)    //  155:   108 <- [ 9/+1],       106 ,       107  // maxParent:  479
        .step(  148, false,   155, false)    //  156:   109 <- [10/+1],       105 ,       108  // maxParent:  618
        .step(  141, false,   156, false)    //  157:   110 <- [11/+1],       102 ,       109  // maxParent:  773
        .step(   -1, false,    73,  true)    //  158:    58 <- [ 7/+1],         1 , flop(  58) // maxParent:  202
        .step(   -1, false,    70,  true)    //  159:    56 <- [ 7/+1],         1 , flop(  56) // maxParent:  202
        .step(  158, false,   159, false)    //  160:   111 <- [ 8/+1],        58 ,        56  // maxParent:  399
        .step(   -1, false,    66,  true)    //  161:    53 <- [ 7/+1],         1 , flop(  53) // maxParent:  201
        .step(   -1, false,    63,  true)    //  162:    51 <- [ 7/+1],         1 , flop(  51) // maxParent:  201
        .step(  161, false,   162, false)    //  163:   112 <- [ 8/+1],        53 ,        51  // maxParent:  399
        .step(  160, false,   163, false)    //  164:   113 <- [ 9/+1],       111 ,       112  // maxParent:  502
        .step(   -1, false,    58,  true)    //  165:    47 <- [ 7/+1],         1 , flop(  47) // maxParent:  199
        .step(   -1, false,    55,  true)    //  166:    45 <- [ 7/+1],         1 , flop(  45) // maxParent:  199
        .step(  165, false,   166, false)    //  167:   114 <- [ 8/+1],        47 ,        45  // maxParent:  398
        .step(   -1, false,    51,  true)    //  168:    42 <- [ 7/+1],         1 , flop(  42) // maxParent:  198
        .step(   -1, false,    48,  true)    //  169:    40 <- [ 7/+1],         1 , flop(  40) // maxParent:  198
        .step(  168, false,   169, false)    //  170:   115 <- [ 8/+1],        42 ,        40  // maxParent:  398
        .step(  167, false,   170, false)    //  171:   116 <- [ 9/+1],       114 ,       115  // maxParent:  481
        .step(  164, false,   171, false)    //  172:   117 <- [10/+1],       113 ,       116  // maxParent:  629
        .step(   -1, false,    42,  true)    //  173:    35 <- [ 7/+1],         1 , flop(  35) // maxParent:  195
        .step(   -1, false,    38,  true)    //  174:    32 <- [ 7/+1],         1 , flop(  32) // maxParent:  195
        .step(  173, false,   174, false)    //  175:   118 <- [ 8/+1],        35 ,        32  // maxParent:  396
        .step(   -1, false,    33,  true)    //  176:    28 <- [ 7/+1],         1 , flop(  28) // maxParent:  194
        .step(   -1, false,    29,  true)    //  177:    25 <- [ 7/+1],         1 , flop(  25) // maxParent:  194
        .step(  176, false,   177, false)    //  178:   119 <- [ 8/+1],        28 ,        25  // maxParent:  396
        .step(  175, false,   178, false)    //  179:   120 <- [ 9/+1],       118 ,       119  // maxParent:  501
        .step(   -1, false,    23,  true)    //  180:    20 <- [ 7/+1],         1 , flop(  20) // maxParent:  192
        .step(   -1, false,    18,  true)    //  181:    16 <- [ 7/+1],         1 , flop(  16) // maxParent:  192
        .step(  180, false,   181, false)    //  182:   121 <- [ 8/+1],        20 ,        16  // maxParent:  395
        .step(   -1, false,    12,  true)    //  183:    11 <- [ 7/+1],         1 , flop(  11) // maxParent:  191
        .step(   -1,  true,     6,  true)    //  184:     6 <- [ 7/+1],         1 , flop(   6) // maxParent:  191
        .step(  183, false,   184, false)    //  185:     1 <- [ 8/+1],        11 ,         6  // maxParent:  395
        .step(  182, false,   185, false)    //  186:   122 <- [ 9/+1],       121 ,         1  // maxParent:  482
        .step(  179, false,   186, false)    //  187:   123 <- [10/+1],       120 ,       122  // maxParent:  619
        .step(  172, false,   187, false)    //  188:   124 <- [11/+1],       117 ,       123  // maxParent:  768
        .step(  157, false,   188, false)    //  189:   125 <- [12/+1],       110 ,       124  // maxParent:  927
        .step(  126, false,   189, false)    //  190:   126 <- [13/+1],        95 ,       125  // maxParent:  260
        .step(  184,  true,   183,  true)    //  191:    11 <- [ 8/+1], flop(   6), flop(  11) // maxParent:  437
        .step(  181,  true,   180,  true)    //  192:    20 <- [ 8/+1], flop(  16), flop(  20) // maxParent:  437
        .step(  191, false,   192, false)    //  193:    16 <- [ 9/+1],        11 ,        20  // maxParent:  520
        .step(  177,  true,   176,  true)    //  194:    28 <- [ 8/+1], flop(  25), flop(  28) // maxParent:  436
        .step(  174,  true,   173,  true)    //  195:    35 <- [ 8/+1], flop(  32), flop(  35) // maxParent:  436
        .step(  194, false,   195, false)    //  196:    32 <- [ 9/+1],        28 ,        35  // maxParent:  486
        .step(  193, false,   196, false)    //  197:    25 <- [10/+1],        16 ,        32  // maxParent:  637
        .step(  169,  true,   168,  true)    //  198:    42 <- [ 8/+1], flop(  40), flop(  42) // maxParent:  434
        .step(  166,  true,   165,  true)    //  199:    47 <- [ 8/+1], flop(  45), flop(  47) // maxParent:  434
        .step(  198, false,   199, false)    //  200:    45 <- [ 9/+1],        42 ,        47  // maxParent:  519
        .step(  162,  true,   161,  true)    //  201:    53 <- [ 8/+1], flop(  51), flop(  53) // maxParent:  433
        .step(  159,  true,   158,  true)    //  202:    58 <- [ 8/+1], flop(  56), flop(  58) // maxParent:  433
        .step(  201, false,   202, false)    //  203:    56 <- [ 9/+1],        53 ,        58  // maxParent:  487
        .step(  200, false,   203, false)    //  204:    51 <- [10/+1],        45 ,        56  // maxParent:  622
        .step(  197, false,   204, false)    //  205:    40 <- [11/+1],        25 ,        51  // maxParent:  776
        .step(  153,  true,   152,  true)    //  206:     9 <- [ 8/+1], flop(   4), flop(   9) // maxParent:  430
        .step(  150,  true,   149,  true)    //  207:    18 <- [ 8/+1], flop(  14), flop(  18) // maxParent:  430
        .step(  206, false,   207, false)    //  208:    14 <- [ 9/+1],         9 ,        18  // maxParent:  517
        .step(  146,  true,   145,  true)    //  209:     0 <- [ 8/+1], flop(   2), flop(   0) // maxParent:  429
        .step(  143,  true,   142,  true)    //  210:     3 <- [ 8/+1], flop(   8), flop(   3) // maxParent:  429
        .step(  209, false,   210, false)    //  211:     8 <- [ 9/+1],         0 ,         3  // maxParent:  489
        .step(  208, false,   211, false)    //  212:     2 <- [10/+1],        14 ,         8  // maxParent:  636
        .step(  138,  true,   137,  true)    //  213:    31 <- [ 8/+1], flop(  34), flop(  31) // maxParent:  427
        .step(  135,  true,   134,  true)    //  214:    24 <- [ 8/+1], flop(  27), flop(  24) // maxParent:  427
        .step(  213, false,   214, false)    //  215:    27 <- [ 9/+1],        31 ,        24  // maxParent:  516
        .step(  131,  true,   130,  true)    //  216:    15 <- [ 8/+1], flop(  19), flop(  15) // maxParent:  426
        .step(  128,  true,   127,  true)    //  217:     5 <- [ 8/+1], flop(  10), flop(   5) // maxParent:  426
        .step(  216, false,   217, false)    //  218:    10 <- [ 9/+1],        15 ,         5  // maxParent:  490
        .step(  215, false,   218, false)    //  219:    19 <- [10/+1],        27 ,        10  // maxParent:  623
        .step(  212, false,   219, false)    //  220:    34 <- [11/+1],         2 ,        19  // maxParent:  770
        .step(  205, false,   220, false)    //  221:     4 <- [12/+1],        40 ,        34  // maxParent:  259
        .step(  121,  true,   119,  true)    //  222:    89 <- [ 8/+1], flop(  90), flop(  89) // maxParent:  445
        .step(  116,  true,   114,  true)    //  223:    86 <- [ 8/+1], flop(  87), flop(  86) // maxParent:  445
        .step(  222, false,   223, false)    //  224:    87 <- [ 9/+1],        89 ,        86  // maxParent:  524
        .step(  110,  true,   108,  true)    //  225:    82 <- [ 8/+1], flop(  83), flop(  82) // maxParent:  444
        .step(  105,  true,   103,  true)    //  226:    79 <- [ 8/+1], flop(  80), flop(  79) // maxParent:  444
        .step(  225, false,   226, false)    //  227:    80 <- [ 9/+1],        82 ,        79  // maxParent:  493
        .step(  224, false,   227, false)    //  228:    83 <- [10/+1],        87 ,        80  // maxParent:  639
        .step(   98,  true,    96,  true)    //  229:    74 <- [ 8/+1], flop(  75), flop(  74) // maxParent:  442
        .step(   93,  true,    91,  true)    //  230:    71 <- [ 8/+1], flop(  72), flop(  71) // maxParent:  442
        .step(  229, false,   230, false)    //  231:    72 <- [ 9/+1],        74 ,        71  // maxParent:  523
        .step(   87,  true,    85,  true)    //  232:    67 <- [ 8/+1], flop(  68), flop(  67) // maxParent:  441
        .step(   82,  true,    80,  true)    //  233:    64 <- [ 8/+1], flop(  65), flop(  64) // maxParent:  441
        .step(  232, false,   233, false)    //  234:    65 <- [ 9/+1],        67 ,        64  // maxParent:  494
        .step(  231, false,   234, false)    //  235:    68 <- [10/+1],        72 ,        65  // maxParent:  625
        .step(  228, false,   235, false)    //  236:    75 <- [11/+1],        83 ,        68  // maxParent:  258
        .step(   74,  true,    71,  true)    //  237:    57 <- [ 8/+1], flop(  59), flop(  57) // maxParent:  449
        .step(   67,  true,    64,  true)    //  238:    52 <- [ 8/+1], flop(  54), flop(  52) // maxParent:  449
        .step(  237, false,   238, false)    //  239:    54 <- [ 9/+1],        57 ,        52  // maxParent:  526
        .step(   59,  true,    56,  true)    //  240:    46 <- [ 8/+1], flop(  48), flop(  46) // maxParent:  448
        .step(   52,  true,    49,  true)    //  241:    41 <- [ 8/+1], flop(  43), flop(  41) // maxParent:  448
        .step(  240, false,   241, false)    //  242:    43 <- [ 9/+1],        46 ,        41  // maxParent:  496
        .step(  239, false,   242, false)    //  243:    48 <- [10/+1],        54 ,        43  // maxParent:  257
        .step(   43,  true,    39,  true)    //  244:    33 <- [ 8/+1], flop(  36), flop(  33) // maxParent:  451
        .step(   34,  true,    30,  true)    //  245:    26 <- [ 8/+1], flop(  29), flop(  26) // maxParent:  451
        .step(  244, false,   245, false)    //  246:    29 <- [ 9/+1],        33 ,        26  // maxParent:  256
        .step(   24,  true,    19,  true)    //  247:    17 <- [ 8/+1], flop(  21), flop(  17) // maxParent:  325
        .step(   13,  true,     7,  true)    //  248:     7 <- [ 8/+1], flop(  12), flop(   7) // maxParent:  325
        .step(  247, false,   248, false)    //  249:    12 <- [ 9/+1],        17 ,         7  // maxParent:  463
        .step(  246, false,   249, false)    //  250:    21 <- [10/+1],        29 ,        12  // maxParent:  607
        .step(  243, false,   250, false)    //  251:    36 <- [11/+1],        48 ,        21  // maxParent:  759
        .step(  236, false,   251, false)    //  252:    59 <- [12/+1],        75 ,        36  // maxParent:  919
        .step(  221, false,   252, false)    //  253:    90 <- [13/+1],         4 ,        59  // maxParent:  1079
        .step(  190, false,   253, false)    //  254:     6 <- [14/+1],       126 ,        90  // maxParent:  1215
        .step(  247, false,   248, false)    //  255:   127 <- [ 9/+1], flip(  17), flop(   7) // maxParent:  458
        .step(  246,  true,   255, false)    //  256:    29 <- [10/+1], flip(  29),       127  // maxParent:  603
        .step(  243,  true,   256, false)    //  257:    48 <- [11/+1], flip(  48),        29  // maxParent:  756
        .step(  236,  true,   257, false)    //  258:    75 <- [12/+1], flip(  75),        48  // maxParent:  917
        .step(  221,  true,   258, false)    //  259:     4 <- [13/+1], flip(   4),        75  // maxParent:  1078
        .step(  190,  true,   259, false)    //  260:   126 <- [14/+1], flip( 126),         4  // maxParent:  1088
        .step(  254, false,   260, false)    //  261:   128 <- [15/+1],         6 ,       126  // maxParent:  332
        .step(   14, false,    25, false)    //  262:   129 <- [ 9/+1], swap(  13), swap(  22) // maxParent:  573
        .step(   35, false,    44, false)    //  263:   130 <- [ 9/+1], swap(  30), swap(  37) // maxParent:  532
        .step(  262, false,   263, false)    //  264:   131 <- [10/+1],       129 ,       130  // maxParent:  662
        .step(   53, false,    60, false)    //  265:   132 <- [ 9/+1], swap(  44), swap(  49) // maxParent:  572
        .step(   68, false,    75, false)    //  266:   133 <- [ 9/+1], swap(  55), swap(  60) // maxParent:  533
        .step(  265, false,   266, false)    //  267:   134 <- [10/+1],       132 ,       133  // maxParent:  644
        .step(  264, false,   267, false)    //  268:   135 <- [11/+1],       131 ,       134  // maxParent:  787
        .step(   83, false,    88, false)    //  269:   136 <- [ 9/+1], swap(  66), swap(  69) // maxParent:  570
        .step(   94, false,    99, false)    //  270:   137 <- [ 9/+1], swap(  73), swap(  76) // maxParent:  535
        .step(  269, false,   270, false)    //  271:   138 <- [10/+1],       136 ,       137  // maxParent:  661
        .step(  106, false,   111, false)    //  272:   139 <- [ 9/+1], swap(  81), swap(  84) // maxParent:  569
        .step(  117, false,   122, false)    //  273:   140 <- [ 9/+1], swap(  88), swap(  91) // maxParent:  536
        .step(  272, false,   273, false)    //  274:   141 <- [10/+1],       139 ,       140  // maxParent:  645
        .step(  271, false,   274, false)    //  275:   142 <- [11/+1],       138 ,       141  // maxParent:  780
        .step(  268, false,   275, false)    //  276:   143 <- [12/+1],       135 ,       142  // maxParent:  934
        .step(  129, false,   132, false)    //  277:   144 <- [ 9/+1], swap(  96), swap(  97) // maxParent:  566
        .step(  136, false,   139, false)    //  278:   145 <- [ 9/+1], swap(  99), swap( 100) // maxParent:  539
        .step(  277, false,   278, false)    //  279:   146 <- [10/+1],       144 ,       145  // maxParent:  659
        .step(  144, false,   147, false)    //  280:   147 <- [ 9/+1], swap( 103), swap( 104) // maxParent:  565
        .step(  151, false,   154, false)    //  281:   148 <- [ 9/+1], swap( 106), swap( 107) // maxParent:  540
        .step(  280, false,   281, false)    //  282:   149 <- [10/+1],       147 ,       148  // maxParent:  647
        .step(  279, false,   282, false)    //  283:   150 <- [11/+1],       146 ,       149  // maxParent:  786
        .step(  160, false,   163, false)    //  284:   151 <- [ 9/+1], swap( 111), swap( 112) // maxParent:  563
        .step(  167, false,   170, false)    //  285:   152 <- [ 9/+1], swap( 114), swap( 115) // maxParent:  542
        .step(  284, false,   285, false)    //  286:   153 <- [10/+1],       151 ,       152  // maxParent:  658
        .step(  175, false,   178, false)    //  287:   154 <- [ 9/+1], swap( 118), swap( 119) // maxParent:  562
        .step(  182, false,   185, false)    //  288:   155 <- [ 9/+1], swap( 121), swap(   1) // maxParent:  543
        .step(  287, false,   288, false)    //  289:   156 <- [10/+1],       154 ,       155  // maxParent:  648
        .step(  286, false,   289, false)    //  290:   157 <- [11/+1],       153 ,       156  // maxParent:  781
        .step(  283, false,   290, false)    //  291:   158 <- [12/+1],       150 ,       157  // maxParent:  932
        .step(  276, false,   291, false)    //  292:   159 <- [13/+1],       143 ,       158  // maxParent:  330
        .step(  191, false,   192, false)    //  293:   160 <- [ 9/+1], swap(  11), swap(  20) // maxParent:  581
        .step(  194, false,   195, false)    //  294:   161 <- [ 9/+1], swap(  28), swap(  35) // maxParent:  547
        .step(  293, false,   294, false)    //  295:   162 <- [10/+1],       160 ,       161  // maxParent:  666
        .step(  198, false,   199, false)    //  296:   163 <- [ 9/+1], swap(  42), swap(  47) // maxParent:  580
        .step(  201, false,   202, false)    //  297:   164 <- [ 9/+1], swap(  53), swap(  58) // maxParent:  548
        .step(  296, false,   297, false)    //  298:   165 <- [10/+1],       163 ,       164  // maxParent:  651
        .step(  295, false,   298, false)    //  299:   166 <- [11/+1],       162 ,       165  // maxParent:  789
        .step(  206, false,   207, false)    //  300:   167 <- [ 9/+1], swap(   9), swap(  18) // maxParent:  578
        .step(  209, false,   210, false)    //  301:   168 <- [ 9/+1], swap(   0), swap(   3) // maxParent:  550
        .step(  300, false,   301, false)    //  302:   169 <- [10/+1],       167 ,       168  // maxParent:  665
        .step(  213, false,   214, false)    //  303:   170 <- [ 9/+1], swap(  31), swap(  24) // maxParent:  577
        .step(  216, false,   217, false)    //  304:   171 <- [ 9/+1], swap(  15), swap(   5) // maxParent:  551
        .step(  303, false,   304, false)    //  305:   172 <- [10/+1],       170 ,       171  // maxParent:  652
        .step(  302, false,   305, false)    //  306:   173 <- [11/+1],       169 ,       172  // maxParent:  783
        .step(  299, false,   306, false)    //  307:   174 <- [12/+1],       166 ,       173  // maxParent:  329
        .step(  222, false,   223, false)    //  308:   175 <- [ 9/+1], swap(  89), swap(  86) // maxParent:  585
        .step(  225, false,   226, false)    //  309:   176 <- [ 9/+1], swap(  82), swap(  79) // maxParent:  554
        .step(  308, false,   309, false)    //  310:   177 <- [10/+1],       175 ,       176  // maxParent:  668
        .step(  229, false,   230, false)    //  311:   178 <- [ 9/+1], swap(  74), swap(  71) // maxParent:  584
        .step(  232, false,   233, false)    //  312:   179 <- [ 9/+1], swap(  67), swap(  64) // maxParent:  555
        .step(  311, false,   312, false)    //  313:   180 <- [10/+1],       178 ,       179  // maxParent:  654
        .step(  310, false,   313, false)    //  314:   181 <- [11/+1],       177 ,       180  // maxParent:  328
        .step(  237, false,   238, false)    //  315:   182 <- [ 9/+1], swap(  57), swap(  52) // maxParent:  587
        .step(  240, false,   241, false)    //  316:   183 <- [ 9/+1], swap(  46), swap(  41) // maxParent:  557
        .step(  315, false,   316, false)    //  317:   184 <- [10/+1],       182 ,       183  // maxParent:  327
        .step(  244, false,   245, false)    //  318:   185 <- [ 9/+1], swap(  33), swap(  26) // maxParent:  326
        .step(  247, false,   248, false)    //  319:   186 <- [ 9/+1], swap(  17), swap(   7) // maxParent:  452
        .step(  318, false,   319, false)    //  320:   187 <- [10/+1],       185 ,       186  // maxParent:  598
        .step(  317, false,   320, false)    //  321:   188 <- [11/+1],       184 ,       187  // maxParent:  752
        .step(  314, false,   321, false)    //  322:   189 <- [12/+1],       181 ,       188  // maxParent:  914
        .step(  307, false,   322, false)    //  323:   190 <- [13/+1],       174 ,       189  // maxParent:  1076
        .step(  292, false,   323, false)    //  324:   191 <- [14/+1],       159 ,       190  // maxParent:  1214
        .step(  247,  true,   248,  true)    //  325:     7 <- [ 9/+1], flip(  17), flip(   7) // maxParent:  390
        .step(  318,  true,   325, false)    //  326:   185 <- [10/+1], flip( 185),         7  // maxParent:  594
        .step(  317,  true,   326, false)    //  327:   184 <- [11/+1], flip( 184),       185  // maxParent:  749
        .step(  314,  true,   327, false)    //  328:   181 <- [12/+1], flip( 181),       184  // maxParent:  912
        .step(  307,  true,   328, false)    //  329:   174 <- [13/+1], flip( 174),       181  // maxParent:  1075
        .step(  292,  true,   329, false)    //  330:   159 <- [14/+1], flip( 159),       174  // maxParent:  1089
        .step(  324, false,   330, false)    //  331:    17 <- [15/+1],       191 ,       159  // maxParent:  332
        .step(  261,  true,   331,  true)    //  332:    17 <- [16/+1],       128 ,        17  // maxParent:  470
        .step(   25, false,    14, false)    //  333:   128 <- [ 9/+1],        22 , swap(  13) // maxParent:  471
        .step(   44, false,    35, false)    //  334:   192 <- [ 9/+1],        37 , swap(  30) // maxParent:  573
        .step(  333, false,   334, false)    //  335:   193 <- [10/+1],       128 ,       192  // maxParent:  721
        .step(   60, false,    53, false)    //  336:   194 <- [ 9/+1],        49 , swap(  44) // maxParent:  472
        .step(   75, false,    68, false)    //  337:   195 <- [ 9/+1],        60 , swap(  55) // maxParent:  572
        .step(  336, false,   337, false)    //  338:   196 <- [10/+1],       194 ,       195  // maxParent:  674
        .step(  335, false,   338, false)    //  339:   197 <- [11/+1],       193 ,       196  // maxParent:  814
        .step(   88, false,    83, false)    //  340:   198 <- [ 9/+1],        69 , swap(  66) // maxParent:  474
        .step(   99, false,    94, false)    //  341:   199 <- [ 9/+1],        76 , swap(  73) // maxParent:  570
        .step(  340, false,   341, false)    //  342:   200 <- [10/+1],       198 ,       199  // maxParent:  720
        .step(  111, false,   106, false)    //  343:   201 <- [ 9/+1],        84 , swap(  81) // maxParent:  475
        .step(  122, false,   117, false)    //  344:   202 <- [ 9/+1],        91 , swap(  88) // maxParent:  569
        .step(  343, false,   344, false)    //  345:   203 <- [10/+1],       201 ,       202  // maxParent:  675
        .step(  342, false,   345, false)    //  346:   204 <- [11/+1],       200 ,       203  // maxParent:  794
        .step(  339, false,   346, false)    //  347:   205 <- [12/+1],       197 ,       204  // maxParent:  945
        .step(  132, false,   129, false)    //  348:   206 <- [ 9/+1],        97 , swap(  96) // maxParent:  478
        .step(  139, false,   136, false)    //  349:   207 <- [ 9/+1],       100 , swap(  99) // maxParent:  566
        .step(  348, false,   349, false)    //  350:   208 <- [10/+1],       206 ,       207  // maxParent:  718
        .step(  147, false,   144, false)    //  351:   209 <- [ 9/+1],       104 , swap( 103) // maxParent:  479
        .step(  154, false,   151, false)    //  352:   210 <- [ 9/+1],       107 , swap( 106) // maxParent:  565
        .step(  351, false,   352, false)    //  353:   211 <- [10/+1],       209 ,       210  // maxParent:  677
        .step(  350, false,   353, false)    //  354:   212 <- [11/+1],       208 ,       211  // maxParent:  813
        .step(  163, false,   160, false)    //  355:   213 <- [ 9/+1],       112 , swap( 111) // maxParent:  481
        .step(  170, false,   167, false)    //  356:   214 <- [ 9/+1],       115 , swap( 114) // maxParent:  563
        .step(  355, false,   356, false)    //  357:   215 <- [10/+1],       213 ,       214  // maxParent:  717
        .step(  178, false,   175, false)    //  358:   216 <- [ 9/+1],       119 , swap( 118) // maxParent:  482
        .step(  185, false,   182, false)    //  359:   217 <- [ 9/+1],         1 , swap( 121) // maxParent:  562
        .step(  358, false,   359, false)    //  360:   218 <- [10/+1],       216 ,       217  // maxParent:  678
        .step(  357, false,   360, false)    //  361:   219 <- [11/+1],       215 ,       218  // maxParent:  795
        .step(  354, false,   361, false)    //  362:   220 <- [12/+1],       212 ,       219  // maxParent:  938
        .step(  347, false,   362, false)    //  363:   221 <- [13/+1],       205 ,       220  // maxParent:  467
        .step(  192, false,   191, false)    //  364:   222 <- [ 9/+1],        20 , swap(  11) // maxParent:  486
        .step(  195, false,   194, false)    //  365:   223 <- [ 9/+1],        35 , swap(  28) // maxParent:  581
        .step(  364, false,   365, false)    //  366:   224 <- [10/+1],       222 ,       223  // maxParent:  725
        .step(  199, false,   198, false)    //  367:   225 <- [ 9/+1],        47 , swap(  42) // maxParent:  487
        .step(  202, false,   201, false)    //  368:   226 <- [ 9/+1],        58 , swap(  53) // maxParent:  580
        .step(  367, false,   368, false)    //  369:   227 <- [10/+1],       225 ,       226  // maxParent:  681
        .step(  366, false,   369, false)    //  370:   228 <- [11/+1],       224 ,       227  // maxParent:  816
        .step(  207, false,   206, false)    //  371:   229 <- [ 9/+1],        18 , swap(   9) // maxParent:  489
        .step(  210, false,   209, false)    //  372:   230 <- [ 9/+1],         3 , swap(   0) // maxParent:  578
        .step(  371, false,   372, false)    //  373:   231 <- [10/+1],       229 ,       230  // maxParent:  724
        .step(  214, false,   213, false)    //  374:   232 <- [ 9/+1],        24 , swap(  31) // maxParent:  490
        .step(  217, false,   216, false)    //  375:   233 <- [ 9/+1],         5 , swap(  15) // maxParent:  577
        .step(  374, false,   375, false)    //  376:   234 <- [10/+1],       232 ,       233  // maxParent:  682
        .step(  373, false,   376, false)    //  377:   235 <- [11/+1],       231 ,       234  // maxParent:  797
        .step(  370, false,   377, false)    //  378:   236 <- [12/+1],       228 ,       235  // maxParent:  466
        .step(  223, false,   222, false)    //  379:   237 <- [ 9/+1],        86 , swap(  89) // maxParent:  493
        .step(  226, false,   225, false)    //  380:   238 <- [ 9/+1],        79 , swap(  82) // maxParent:  585
        .step(  379, false,   380, false)    //  381:   239 <- [10/+1],       237 ,       238  // maxParent:  727
        .step(  230, false,   229, false)    //  382:   240 <- [ 9/+1],        71 , swap(  74) // maxParent:  494
        .step(  233, false,   232, false)    //  383:   241 <- [ 9/+1],        64 , swap(  67) // maxParent:  584
        .step(  382, false,   383, false)    //  384:   242 <- [10/+1],       240 ,       241  // maxParent:  684
        .step(  381, false,   384, false)    //  385:   243 <- [11/+1],       239 ,       242  // maxParent:  465
        .step(  238, false,   237, false)    //  386:   244 <- [ 9/+1],        52 , swap(  57) // maxParent:  496
        .step(  241, false,   240, false)    //  387:   245 <- [ 9/+1],        41 , swap(  46) // maxParent:  587
        .step(  386, false,   387, false)    //  388:   246 <- [10/+1],       244 ,       245  // maxParent:  464
        .step(  245, false,   244, false)    //  389:   247 <- [ 9/+1],        26 , swap(  33) // maxParent:  463
        .step(  389, false,   325,  true)    //  390:     7 <- [10/+1],       247 , flip(   7) // maxParent:  588
        .step(  388, false,   390, false)    //  391:   248 <- [11/+1],       246 ,         7  // maxParent:  744
        .step(  385, false,   391, false)    //  392:   249 <- [12/+1],       243 ,       248  // maxParent:  908
        .step(  378, false,   392, false)    //  393:   250 <- [13/+1],       236 ,       249  // maxParent:  1072
        .step(  363, false,   393, false)    //  394:   251 <- [14/+1],       221 ,       250  // maxParent:  1212
        .step(  182,  true,   185,  true)    //  395:     1 <- [ 9/+1], flip( 121), flop(   1) // maxParent:  501
        .step(  175,  true,   178,  true)    //  396:   119 <- [ 9/+1], flip( 118), flop( 119) // maxParent:  543
        .step(  395, false,   396, false)    //  397:   118 <- [10/+1],         1 ,       119  // maxParent:  707
        .step(  167,  true,   170,  true)    //  398:   115 <- [ 9/+1], flip( 114), flop( 115) // maxParent:  502
        .step(  160,  true,   163,  true)    //  399:   112 <- [ 9/+1], flip( 111), flop( 112) // maxParent:  542
        .step(  398, false,   399, false)    //  400:   111 <- [10/+1],       115 ,       112  // maxParent:  688
        .step(  397, false,   400, false)    //  401:   114 <- [11/+1],       118 ,       111  // maxParent:  808
        .step(  151,  true,   154,  true)    //  402:   107 <- [ 9/+1], flip( 106), flop( 107) // maxParent:  504
        .step(  144,  true,   147,  true)    //  403:   104 <- [ 9/+1], flip( 103), flop( 104) // maxParent:  540
        .step(  402, false,   403, false)    //  404:   103 <- [10/+1],       107 ,       104  // maxParent:  706
        .step(  136,  true,   139,  true)    //  405:   100 <- [ 9/+1], flip(  99), flop( 100) // maxParent:  505
        .step(  129,  true,   132,  true)    //  406:    97 <- [ 9/+1], flip(  96), flop(  97) // maxParent:  539
        .step(  405, false,   406, false)    //  407:    96 <- [10/+1],       100 ,        97  // maxParent:  689
        .step(  404, false,   407, false)    //  408:    99 <- [11/+1],       103 ,        96  // maxParent:  800
        .step(  401, false,   408, false)    //  409:   106 <- [12/+1],       114 ,        99  // maxParent:  943
        .step(  117,  true,   122,  true)    //  410:    91 <- [ 9/+1], flip(  88), flop(  91) // maxParent:  508
        .step(  106,  true,   111,  true)    //  411:    84 <- [ 9/+1], flip(  81), flop(  84) // maxParent:  536
        .step(  410, false,   411, false)    //  412:    81 <- [10/+1],        91 ,        84  // maxParent:  704
        .step(   94,  true,    99,  true)    //  413:    76 <- [ 9/+1], flip(  73), flop(  76) // maxParent:  509
        .step(   83,  true,    88,  true)    //  414:    69 <- [ 9/+1], flip(  66), flop(  69) // maxParent:  535
        .step(  413, false,   414, false)    //  415:    66 <- [10/+1],        76 ,        69  // maxParent:  691
        .step(  412, false,   415, false)    //  416:    73 <- [11/+1],        81 ,        66  // maxParent:  807
        .step(   68,  true,    75,  true)    //  417:    60 <- [ 9/+1], flip(  55), flop(  60) // maxParent:  511
        .step(   53,  true,    60,  true)    //  418:    49 <- [ 9/+1], flip(  44), flop(  49) // maxParent:  533
        .step(  417, false,   418, false)    //  419:    44 <- [10/+1],        60 ,        49  // maxParent:  703
        .step(   35,  true,    44,  true)    //  420:    37 <- [ 9/+1], flip(  30), flop(  37) // maxParent:  512
        .step(   14,  true,    25,  true)    //  421:    22 <- [ 9/+1], flip(  13), flop(  22) // maxParent:  532
        .step(  420, false,   421, false)    //  422:    13 <- [10/+1],        37 ,        22  // maxParent:  692
        .step(  419, false,   422, false)    //  423:    30 <- [11/+1],        44 ,        13  // maxParent:  801
        .step(  416, false,   423, false)    //  424:    55 <- [12/+1],        73 ,        30  // maxParent:  940
        .step(  409, false,   424, false)    //  425:    88 <- [13/+1],       106 ,        55  // maxParent:  462
        .step(  216,  true,   217,  true)    //  426:     5 <- [ 9/+1], flip(  15), flop(   5) // maxParent:  516
        .step(  213,  true,   214,  true)    //  427:    24 <- [ 9/+1], flip(  31), flop(  24) // maxParent:  551
        .step(  426, false,   427, false)    //  428:    31 <- [10/+1],         5 ,        24  // maxParent:  711
        .step(  209,  true,   210,  true)    //  429:     3 <- [ 9/+1], flip(   0), flop(   3) // maxParent:  517
        .step(  206,  true,   207,  true)    //  430:    18 <- [ 9/+1], flip(   9), flop(  18) // maxParent:  550
        .step(  429, false,   430, false)    //  431:     9 <- [10/+1],         3 ,        18  // maxParent:  695
        .step(  428, false,   431, false)    //  432:     0 <- [11/+1],        31 ,         9  // maxParent:  810
        .step(  201,  true,   202,  true)    //  433:    58 <- [ 9/+1], flip(  53), flop(  58) // maxParent:  519
        .step(  198,  true,   199,  true)    //  434:    47 <- [ 9/+1], flip(  42), flop(  47) // maxParent:  548
        .step(  433, false,   434, false)    //  435:    42 <- [10/+1],        58 ,        47  // maxParent:  710
        .step(  194,  true,   195,  true)    //  436:    35 <- [ 9/+1], flip(  28), flop(  35) // maxParent:  520
        .step(  191,  true,   192,  true)    //  437:    20 <- [ 9/+1], flip(  11), flop(  20) // maxParent:  547
        .step(  436, false,   437, false)    //  438:    11 <- [10/+1],        35 ,        20  // maxParent:  696
        .step(  435, false,   438, false)    //  439:    28 <- [11/+1],        42 ,        11  // maxParent:  803
        .step(  432, false,   439, false)    //  440:    53 <- [12/+1],         0 ,        28  // maxParent:  461
        .step(  232,  true,   233,  true)    //  441:    64 <- [ 9/+1], flip(  67), flop(  64) // maxParent:  523
        .step(  229,  true,   230,  true)    //  442:    71 <- [ 9/+1], flip(  74), flop(  71) // maxParent:  555
        .step(  441, false,   442, false)    //  443:    74 <- [10/+1],        64 ,        71  // maxParent:  713
        .step(  225,  true,   226,  true)    //  444:    79 <- [ 9/+1], flip(  82), flop(  79) // maxParent:  524
        .step(  222,  true,   223,  true)    //  445:    86 <- [ 9/+1], flip(  89), flop(  86) // maxParent:  554
        .step(  444, false,   445, false)    //  446:    89 <- [10/+1],        79 ,        86  // maxParent:  698
        .step(  443, false,   446, false)    //  447:    82 <- [11/+1],        74 ,        89  // maxParent:  460
        .step(  240,  true,   241,  true)    //  448:    41 <- [ 9/+1], flip(  46), flop(  41) // maxParent:  526
        .step(  237,  true,   238,  true)    //  449:    52 <- [ 9/+1], flip(  57), flop(  52) // maxParent:  557
        .step(  448, false,   449, false)    //  450:    57 <- [10/+1],        41 ,        52  // maxParent:  459
        .step(  244,  true,   245,  true)    //  451:    26 <- [ 9/+1], flip(  33), flop(  26) // maxParent:  458
        .step(  451, false,   319,  true)    //  452:   186 <- [10/+1],        26 , flip( 186) // maxParent:  558
        .step(  450, false,   452, false)    //  453:    33 <- [11/+1],        57 ,       186  // maxParent:  741
        .step(  447, false,   453, false)    //  454:    46 <- [12/+1],        82 ,        33  // maxParent:  906
        .step(  440, false,   454, false)    //  455:    67 <- [13/+1],        53 ,        46  // maxParent:  1071
        .step(  425, false,   455, false)    //  456:    15 <- [14/+1],        88 ,        67  // maxParent:  1091
        .step(  394, false,   456, false)    //  457:   121 <- [15/+1],       251 ,        15  // maxParent:  469
        .step(  451,  true,   255,  true)    //  458:   127 <- [10/+1], flip(  26), flip( 127) // maxParent:  527
        .step(  450,  true,   458, false)    //  459:    57 <- [11/+1], flip(  57),       127  // maxParent:  737
        .step(  447,  true,   459, false)    //  460:    82 <- [12/+1], flip(  82),        57  // maxParent:  903
        .step(  440,  true,   460, false)    //  461:    53 <- [13/+1], flip(  53),        82  // maxParent:  1069
        .step(  425,  true,   461, false)    //  462:    88 <- [14/+1], flip(  88),        53  // maxParent:  1212
        .step(  389,  true,   249,  true)    //  463:    12 <- [10/+1], flip( 247), flip(  12) // maxParent:  497
        .step(  388,  true,   463, false)    //  464:   246 <- [11/+1], flip( 246),        12  // maxParent:  734
        .step(  385,  true,   464, false)    //  465:   243 <- [12/+1], flip( 243),       246  // maxParent:  901
        .step(  378,  true,   465, false)    //  466:   236 <- [13/+1], flip( 236),       243  // maxParent:  1068
        .step(  363,  true,   466, false)    //  467:   221 <- [14/+1], flip( 221),       236  // maxParent:  1092
        .step(  462, false,   467, false)    //  468:   247 <- [15/+1],        88 ,       221  // maxParent:  469
        .step(  457,  true,   468,  true)    //  469:   247 <- [16/+1],       121 ,       247  // maxParent:  470
        .step(  332,  true,   469,  true)    //  470:   247 <- [17/+1],        17 ,       247  // maxParent:  614
        .step(   45,  true,   333,  true)    //  471:   128 <- [10/+1],        38 ,       128  // maxParent:  615
        .step(   76,  true,   336,  true)    //  472:   194 <- [10/+1],        61 ,       194  // maxParent:  721
        .step(  471, false,   472, false)    //  473:    61 <- [11/+1],       128 ,       194  // maxParent:  869
        .step(  100,  true,   340,  true)    //  474:   198 <- [10/+1],        77 ,       198  // maxParent:  616
        .step(  123,  true,   343,  true)    //  475:   201 <- [10/+1],        92 ,       201  // maxParent:  720
        .step(  474, false,   475, false)    //  476:    92 <- [11/+1],       198 ,       201  // maxParent:  822
        .step(  473, false,   476, false)    //  477:    77 <- [12/+1],        61 ,        92  // maxParent:  968
        .step(  140,  true,   348,  true)    //  478:   206 <- [10/+1],       101 ,       206  // maxParent:  618
        .step(  155,  true,   351,  true)    //  479:   209 <- [10/+1],       108 ,       209  // maxParent:  718
        .step(  478, false,   479, false)    //  480:   108 <- [11/+1],       206 ,       209  // maxParent:  868
        .step(  171,  true,   355,  true)    //  481:   213 <- [10/+1],       116 ,       213  // maxParent:  619
        .step(  186,  true,   358,  true)    //  482:   216 <- [10/+1],       122 ,       216  // maxParent:  717
        .step(  481, false,   482, false)    //  483:   122 <- [11/+1],       213 ,       216  // maxParent:  823
        .step(  480, false,   483, false)    //  484:   116 <- [12/+1],       108 ,       122  // maxParent:  950
        .step(  477, false,   484, false)    //  485:   101 <- [13/+1],        77 ,       116  // maxParent:  610
        .step(  196,  true,   364,  true)    //  486:   222 <- [10/+1],        32 ,       222  // maxParent:  622
        .step(  203,  true,   367,  true)    //  487:   225 <- [10/+1],        56 ,       225  // maxParent:  725
        .step(  486, false,   487, false)    //  488:    56 <- [11/+1],       222 ,       225  // maxParent:  871
        .step(  211,  true,   371,  true)    //  489:   229 <- [10/+1],         8 ,       229  // maxParent:  623
        .step(  218,  true,   374,  true)    //  490:   232 <- [10/+1],        10 ,       232  // maxParent:  724
        .step(  489, false,   490, false)    //  491:    10 <- [11/+1],       229 ,       232  // maxParent:  825
        .step(  488, false,   491, false)    //  492:     8 <- [12/+1],        56 ,        10  // maxParent:  609
        .step(  227,  true,   379,  true)    //  493:   237 <- [10/+1],        80 ,       237  // maxParent:  625
        .step(  234,  true,   382,  true)    //  494:   240 <- [10/+1],        65 ,       240  // maxParent:  727
        .step(  493, false,   494, false)    //  495:    65 <- [11/+1],       237 ,       240  // maxParent:  608
        .step(  242,  true,   386,  true)    //  496:   244 <- [10/+1],        43 ,       244  // maxParent:  607
        .step(  496, false,   463,  true)    //  497:    12 <- [11/+1],       244 , flip(  12) // maxParent:  728
        .step(  495, false,   497, false)    //  498:    43 <- [12/+1],        65 ,        12  // maxParent:  896
        .step(  492, false,   498, false)    //  499:    80 <- [13/+1],         8 ,        43  // maxParent:  1064
        .step(  485, false,   499, false)    //  500:    32 <- [14/+1],       101 ,        80  // maxParent:  1208
        .step(  179,  true,   395,  true)    //  501:     1 <- [10/+1], flip( 120),         1  // maxParent:  629
        .step(  164,  true,   398,  true)    //  502:   115 <- [10/+1], flip( 113),       115  // maxParent:  707
        .step(  501, false,   502, false)    //  503:   113 <- [11/+1],         1 ,       115  // maxParent:  863
        .step(  148,  true,   402,  true)    //  504:   107 <- [10/+1], flip( 105),       107  // maxParent:  630
        .step(  133,  true,   405,  true)    //  505:   100 <- [10/+1], flip(  98),       100  // maxParent:  706
        .step(  504, false,   505, false)    //  506:    98 <- [11/+1],       107 ,       100  // maxParent:  828
        .step(  503, false,   506, false)    //  507:   105 <- [12/+1],       113 ,        98  // maxParent:  966
        .step(  112,  true,   410,  true)    //  508:    91 <- [10/+1], flip(  85),        91  // maxParent:  632
        .step(   89,  true,   413,  true)    //  509:    76 <- [10/+1], flip(  70),        76  // maxParent:  704
        .step(  508, false,   509, false)    //  510:    70 <- [11/+1],        91 ,        76  // maxParent:  862
        .step(   61,  true,   417,  true)    //  511:    60 <- [10/+1], flip(  50),        60  // maxParent:  633
        .step(   26,  true,   420,  true)    //  512:    37 <- [10/+1], flip(  23),        37  // maxParent:  703
        .step(  511, false,   512, false)    //  513:    23 <- [11/+1],        60 ,        37  // maxParent:  829
        .step(  510, false,   513, false)    //  514:    50 <- [12/+1],        70 ,        23  // maxParent:  952
        .step(  507, false,   514, false)    //  515:    85 <- [13/+1],       105 ,        50  // maxParent:  606
        .step(  215,  true,   426,  true)    //  516:     5 <- [10/+1], flip(  27),         5  // maxParent:  636
        .step(  208,  true,   429,  true)    //  517:     3 <- [10/+1], flip(  14),         3  // maxParent:  711
        .step(  516, false,   517, false)    //  518:    14 <- [11/+1],         5 ,         3  // maxParent:  865
        .step(  200,  true,   433,  true)    //  519:    58 <- [10/+1], flip(  45),        58  // maxParent:  637
        .step(  193,  true,   436,  true)    //  520:    35 <- [10/+1], flip(  16),        35  // maxParent:  710
        .step(  519, false,   520, false)    //  521:    16 <- [11/+1],        58 ,        35  // maxParent:  831
        .step(  518, false,   521, false)    //  522:    45 <- [12/+1],        14 ,        16  // maxParent:  605
        .step(  231,  true,   441,  true)    //  523:    64 <- [10/+1], flip(  72),        64  // maxParent:  639
        .step(  224,  true,   444,  true)    //  524:    79 <- [10/+1], flip(  87),        79  // maxParent:  713
        .step(  523, false,   524, false)    //  525:    87 <- [11/+1],        64 ,        79  // maxParent:  604
        .step(  239,  true,   448,  true)    //  526:    41 <- [10/+1], flip(  54),        41  // maxParent:  603
        .step(  526, false,   458,  true)    //  527:   127 <- [11/+1],        41 , flip( 127) // maxParent:  714
        .step(  525, false,   527, false)    //  528:    54 <- [12/+1],        87 ,       127  // maxParent:  894
        .step(  522, false,   528, false)    //  529:    72 <- [13/+1],        45 ,        54  // maxParent:  1063
        .step(  515, false,   529, false)    //  530:    27 <- [14/+1],        85 ,        72  // maxParent:  1095
        .step(  500, false,   530, false)    //  531:   120 <- [15/+1],        32 ,        27  // maxParent:  593
        .step(  263,  true,   421,  true)    //  532:    22 <- [10/+1],       130 , flip(  22) // maxParent:  644
        .step(  266,  true,   418,  true)    //  533:    49 <- [10/+1],       133 , flip(  49) // maxParent:  692
        .step(  532, false,   533, false)    //  534:   133 <- [11/+1],        22 ,        49  // maxParent:  856
        .step(  270,  true,   414,  true)    //  535:    69 <- [10/+1],       137 , flip(  69) // maxParent:  645
        .step(  273,  true,   411,  true)    //  536:    84 <- [10/+1],       140 , flip(  84) // maxParent:  691
        .step(  535, false,   536, false)    //  537:   140 <- [11/+1],        69 ,        84  // maxParent:  835
        .step(  534, false,   537, false)    //  538:   137 <- [12/+1],       133 ,       140  // maxParent:  963
        .step(  278,  true,   406,  true)    //  539:    97 <- [10/+1],       145 , flip(  97) // maxParent:  647
        .step(  281,  true,   403,  true)    //  540:   104 <- [10/+1],       148 , flip( 104) // maxParent:  689
        .step(  539, false,   540, false)    //  541:   148 <- [11/+1],        97 ,       104  // maxParent:  855
        .step(  285,  true,   399,  true)    //  542:   112 <- [10/+1],       152 , flip( 112) // maxParent:  648
        .step(  288,  true,   396,  true)    //  543:   119 <- [10/+1],       155 , flip( 119) // maxParent:  688
        .step(  542, false,   543, false)    //  544:   155 <- [11/+1],       112 ,       119  // maxParent:  836
        .step(  541, false,   544, false)    //  545:   152 <- [12/+1],       148 ,       155  // maxParent:  955
        .step(  538, false,   545, false)    //  546:   145 <- [13/+1],       137 ,       152  // maxParent:  601
        .step(  294,  true,   437,  true)    //  547:    20 <- [10/+1],       161 , flip(  20) // maxParent:  651
        .step(  297,  true,   434,  true)    //  548:    47 <- [10/+1],       164 , flip(  47) // maxParent:  696
        .step(  547, false,   548, false)    //  549:   164 <- [11/+1],        20 ,        47  // maxParent:  858
        .step(  301,  true,   430,  true)    //  550:    18 <- [10/+1],       168 , flip(  18) // maxParent:  652
        .step(  304,  true,   427,  true)    //  551:    24 <- [10/+1],       171 , flip(  24) // maxParent:  695
        .step(  550, false,   551, false)    //  552:   171 <- [11/+1],        18 ,        24  // maxParent:  838
        .step(  549, false,   552, false)    //  553:   168 <- [12/+1],       164 ,       171  // maxParent:  600
        .step(  309,  true,   445,  true)    //  554:    86 <- [10/+1],       176 , flip(  86) // maxParent:  654
        .step(  312,  true,   442,  true)    //  555:    71 <- [10/+1],       179 , flip(  71) // maxParent:  698
        .step(  554, false,   555, false)    //  556:   179 <- [11/+1],        86 ,        71  // maxParent:  599
        .step(  316,  true,   449,  true)    //  557:    52 <- [10/+1],       183 , flip(  52) // maxParent:  598
        .step(  557, false,   452,  true)    //  558:   186 <- [11/+1],        52 , flip( 186) // maxParent:  699
        .step(  556, false,   558, false)    //  559:   183 <- [12/+1],       179 ,       186  // maxParent:  891
        .step(  553, false,   559, false)    //  560:   176 <- [13/+1],       168 ,       183  // maxParent:  1061
        .step(  546, false,   560, false)    //  561:   161 <- [14/+1],       145 ,       176  // maxParent:  1209
        .step(  287,  true,   359,  true)    //  562:   217 <- [10/+1], flip( 154), flip( 217) // maxParent:  658
        .step(  284,  true,   356,  true)    //  563:   214 <- [10/+1], flip( 151), flip( 214) // maxParent:  678
        .step(  562, false,   563, false)    //  564:   151 <- [11/+1],       217 ,       214  // maxParent:  850
        .step(  280,  true,   352,  true)    //  565:   210 <- [10/+1], flip( 147), flip( 210) // maxParent:  659
        .step(  277,  true,   349,  true)    //  566:   207 <- [10/+1], flip( 144), flip( 207) // maxParent:  677
        .step(  565, false,   566, false)    //  567:   144 <- [11/+1],       210 ,       207  // maxParent:  841
        .step(  564, false,   567, false)    //  568:   147 <- [12/+1],       151 ,       144  // maxParent:  961
        .step(  272,  true,   344,  true)    //  569:   202 <- [10/+1], flip( 139), flip( 202) // maxParent:  661
        .step(  269,  true,   341,  true)    //  570:   199 <- [10/+1], flip( 136), flip( 199) // maxParent:  675
        .step(  569, false,   570, false)    //  571:   136 <- [11/+1],       202 ,       199  // maxParent:  849
        .step(  265,  true,   337,  true)    //  572:   195 <- [10/+1], flip( 132), flip( 195) // maxParent:  662
        .step(  262,  true,   334,  true)    //  573:   192 <- [10/+1], flip( 129), flip( 192) // maxParent:  674
        .step(  572, false,   573, false)    //  574:   129 <- [11/+1],       195 ,       192  // maxParent:  842
        .step(  571, false,   574, false)    //  575:   132 <- [12/+1],       136 ,       129  // maxParent:  957
        .step(  568, false,   575, false)    //  576:   139 <- [13/+1],       147 ,       132  // maxParent:  597
        .step(  303,  true,   375,  true)    //  577:   233 <- [10/+1], flip( 170), flip( 233) // maxParent:  665
        .step(  300,  true,   372,  true)    //  578:   230 <- [10/+1], flip( 167), flip( 230) // maxParent:  682
        .step(  577, false,   578, false)    //  579:   167 <- [11/+1],       233 ,       230  // maxParent:  852
        .step(  296,  true,   368,  true)    //  580:   226 <- [10/+1], flip( 163), flip( 226) // maxParent:  666
        .step(  293,  true,   365,  true)    //  581:   223 <- [10/+1], flip( 160), flip( 223) // maxParent:  681
        .step(  580, false,   581, false)    //  582:   160 <- [11/+1],       226 ,       223  // maxParent:  844
        .step(  579, false,   582, false)    //  583:   163 <- [12/+1],       167 ,       160  // maxParent:  596
        .step(  311,  true,   383,  true)    //  584:   241 <- [10/+1], flip( 178), flip( 241) // maxParent:  668
        .step(  308,  true,   380,  true)    //  585:   238 <- [10/+1], flip( 175), flip( 238) // maxParent:  684
        .step(  584, false,   585, false)    //  586:   175 <- [11/+1],       241 ,       238  // maxParent:  595
        .step(  315,  true,   387,  true)    //  587:   245 <- [10/+1], flip( 182), flip( 245) // maxParent:  594
        .step(  587, false,   390,  true)    //  588:     7 <- [11/+1],       245 , flip(   7) // maxParent:  685
        .step(  586, false,   588, false)    //  589:   182 <- [12/+1],       175 ,         7  // maxParent:  889
        .step(  583, false,   589, false)    //  590:   178 <- [13/+1],       163 ,       182  // maxParent:  1060
        .step(  576, false,   590, false)    //  591:   170 <- [14/+1],       139 ,       178  // maxParent:  1096
        .step(  561, false,   591, false)    //  592:   154 <- [15/+1],       161 ,       170  // maxParent:  593
        .step(  531,  true,   592,  true)    //  593:   154 <- [16/+1],       120 ,       154  // maxParent:  613
        .step(  587,  true,   326,  true)    //  594:   185 <- [11/+1], flip( 245), flip( 185) // maxParent:  669
        .step(  586,  true,   594, false)    //  595:   175 <- [12/+1], flip( 175),       185  // maxParent:  885
        .step(  583,  true,   595, false)    //  596:   163 <- [13/+1], flip( 163),       175  // maxParent:  1057
        .step(  576,  true,   596, false)    //  597:   139 <- [14/+1], flip( 139),       163  // maxParent:  1209
        .step(  557,  true,   320,  true)    //  598:   187 <- [11/+1], flip(  52), flip( 187) // maxParent:  655
        .step(  556,  true,   598, false)    //  599:   179 <- [12/+1], flip( 179),       187  // maxParent:  883
        .step(  553,  true,   599, false)    //  600:   168 <- [13/+1], flip( 168),       179  // maxParent:  1056
        .step(  546,  true,   600, false)    //  601:   145 <- [14/+1], flip( 145),       168  // maxParent:  1098
        .step(  597, false,   601, false)    //  602:    52 <- [15/+1],       139 ,       145  // maxParent:  612
        .step(  526,  true,   256,  true)    //  603:    29 <- [11/+1], flip(  41), flip(  29) // maxParent:  640
        .step(  525,  true,   603, false)    //  604:    87 <- [12/+1], flip(  87),        29  // maxParent:  880
        .step(  522,  true,   604, false)    //  605:    45 <- [13/+1], flip(  45),        87  // maxParent:  1054
        .step(  515,  true,   605, false)    //  606:    85 <- [14/+1], flip(  85),        45  // maxParent:  1208
        .step(  496,  true,   250,  true)    //  607:    21 <- [11/+1], flip( 244), flip(  21) // maxParent:  626
        .step(  495,  true,   607, false)    //  608:    65 <- [12/+1], flip(  65),        21  // maxParent:  878
        .step(  492,  true,   608, false)    //  609:     8 <- [13/+1], flip(   8),        65  // maxParent:  1053
        .step(  485,  true,   609, false)    //  610:   101 <- [14/+1], flip( 101),         8  // maxParent:  1099
        .step(  606, false,   610, false)    //  611:   244 <- [15/+1],        85 ,       101  // maxParent:  612
        .step(  602,  true,   611,  true)    //  612:   244 <- [16/+1],        52 ,       244  // maxParent:  613
        .step(  593,  true,   612,  true)    //  613:   244 <- [17/+1],       154 ,       244  // maxParent:  614
        .step(  470,  true,   613,  true)    //  614:   244 <- [18/+1],       247 ,       244  // maxParent:  766
        .step(   77,  true,   471,  true)    //  615:   128 <- [11/+1],        62 ,       128  // maxParent:  767
        .step(  124,  true,   474,  true)    //  616:   198 <- [11/+1],        93 ,       198  // maxParent:  869
        .step(  615, false,   616, false)    //  617:    93 <- [12/+1],       128 ,       198  // maxParent:  1015
        .step(  156,  true,   478,  true)    //  618:   206 <- [11/+1],       109 ,       206  // maxParent:  768
        .step(  187,  true,   481,  true)    //  619:   213 <- [11/+1],       123 ,       213  // maxParent:  868
        .step(  618, false,   619, false)    //  620:   123 <- [12/+1],       206 ,       213  // maxParent:  974
        .step(  617, false,   620, false)    //  621:   109 <- [13/+1],        93 ,       123  // maxParent:  761
        .step(  204,  true,   486,  true)    //  622:   222 <- [11/+1],        51 ,       222  // maxParent:  770
        .step(  219,  true,   489,  true)    //  623:   229 <- [11/+1],        19 ,       229  // maxParent:  871
        .step(  622, false,   623, false)    //  624:    19 <- [12/+1],       222 ,       229  // maxParent:  760
        .step(  235,  true,   493,  true)    //  625:   237 <- [11/+1],        68 ,       237  // maxParent:  759
        .step(  625, false,   607,  true)    //  626:    21 <- [12/+1],       237 , flip(  21) // maxParent:  872
        .step(  624, false,   626, false)    //  627:    68 <- [13/+1],        19 ,        21  // maxParent:  1048
        .step(  621, false,   627, false)    //  628:    51 <- [14/+1],       109 ,        68  // maxParent:  1200
        .step(  172,  true,   501,  true)    //  629:     1 <- [11/+1], flip( 117),         1  // maxParent:  773
        .step(  141,  true,   504,  true)    //  630:   107 <- [11/+1], flip( 102),       107  // maxParent:  863
        .step(  629, false,   630, false)    //  631:   102 <- [12/+1],         1 ,       107  // maxParent:  1013
        .step(  101,  true,   508,  true)    //  632:    91 <- [11/+1], flip(  78),        91  // maxParent:  774
        .step(   46,  true,   511,  true)    //  633:    60 <- [11/+1], flip(  39),        60  // maxParent:  862
        .step(  632, false,   633, false)    //  634:    39 <- [12/+1],        91 ,        60  // maxParent:  976
        .step(  631, false,   634, false)    //  635:    78 <- [13/+1],       102 ,        39  // maxParent:  758
        .step(  212,  true,   516,  true)    //  636:     5 <- [11/+1], flip(   2),         5  // maxParent:  776
        .step(  197,  true,   519,  true)    //  637:    58 <- [11/+1], flip(  25),        58  // maxParent:  865
        .step(  636, false,   637, false)    //  638:    25 <- [12/+1],         5 ,        58  // maxParent:  757
        .step(  228,  true,   523,  true)    //  639:    64 <- [11/+1], flip(  83),        64  // maxParent:  756
        .step(  639, false,   603,  true)    //  640:    29 <- [12/+1],        64 , flip(  29) // maxParent:  866
        .step(  638, false,   640, false)    //  641:    83 <- [13/+1],        25 ,        29  // maxParent:  1047
        .step(  635, false,   641, false)    //  642:     2 <- [14/+1],        78 ,        83  // maxParent:  1103
        .step(  628, false,   642, false)    //  643:   117 <- [15/+1],        51 ,         2  // maxParent:  673
        .step(  267,  true,   532,  true)    //  644:    22 <- [11/+1],       134 ,        22  // maxParent:  780
        .step(  274,  true,   535,  true)    //  645:    69 <- [11/+1],       141 ,        69  // maxParent:  856
        .step(  644, false,   645, false)    //  646:   141 <- [12/+1],        22 ,        69  // maxParent:  1010
        .step(  282,  true,   539,  true)    //  647:    97 <- [11/+1],       149 ,        97  // maxParent:  781
        .step(  289,  true,   542,  true)    //  648:   112 <- [11/+1],       156 ,       112  // maxParent:  855
        .step(  647, false,   648, false)    //  649:   156 <- [12/+1],        97 ,       112  // maxParent:  979
        .step(  646, false,   649, false)    //  650:   149 <- [13/+1],       141 ,       156  // maxParent:  754
        .step(  298,  true,   547,  true)    //  651:    20 <- [11/+1],       165 ,        20  // maxParent:  783
        .step(  305,  true,   550,  true)    //  652:    18 <- [11/+1],       172 ,        18  // maxParent:  858
        .step(  651, false,   652, false)    //  653:   172 <- [12/+1],        20 ,        18  // maxParent:  753
        .step(  313,  true,   554,  true)    //  654:    86 <- [11/+1],       180 ,        86  // maxParent:  752
        .step(  654, false,   598,  true)    //  655:   187 <- [12/+1],        86 , flip( 187) // maxParent:  859
        .step(  653, false,   655, false)    //  656:   180 <- [13/+1],       172 ,       187  // maxParent:  1045
        .step(  650, false,   656, false)    //  657:   165 <- [14/+1],       149 ,       180  // maxParent:  1201
        .step(  286,  true,   562,  true)    //  658:   217 <- [11/+1], flip( 153),       217  // maxParent:  786
        .step(  279,  true,   565,  true)    //  659:   210 <- [11/+1], flip( 146),       210  // maxParent:  850
        .step(  658, false,   659, false)    //  660:   146 <- [12/+1],       217 ,       210  // maxParent:  1008
        .step(  271,  true,   569,  true)    //  661:   202 <- [11/+1], flip( 138),       202  // maxParent:  787
        .step(  264,  true,   572,  true)    //  662:   195 <- [11/+1], flip( 131),       195  // maxParent:  849
        .step(  661, false,   662, false)    //  663:   131 <- [12/+1],       202 ,       195  // maxParent:  981
        .step(  660, false,   663, false)    //  664:   138 <- [13/+1],       146 ,       131  // maxParent:  751
        .step(  302,  true,   577,  true)    //  665:   233 <- [11/+1], flip( 169),       233  // maxParent:  789
        .step(  295,  true,   580,  true)    //  666:   226 <- [11/+1], flip( 162),       226  // maxParent:  852
        .step(  665, false,   666, false)    //  667:   162 <- [12/+1],       233 ,       226  // maxParent:  750
        .step(  310,  true,   584,  true)    //  668:   241 <- [11/+1], flip( 177),       241  // maxParent:  749
        .step(  668, false,   594,  true)    //  669:   185 <- [12/+1],       241 , flip( 185) // maxParent:  853
        .step(  667, false,   669, false)    //  670:   177 <- [13/+1],       162 ,       185  // maxParent:  1044
        .step(  664, false,   670, false)    //  671:   169 <- [14/+1],       138 ,       177  // maxParent:  1104
        .step(  657, false,   671, false)    //  672:   153 <- [15/+1],       165 ,       169  // maxParent:  673
        .step(  643,  true,   672,  true)    //  673:   153 <- [16/+1],       117 ,       153  // maxParent:  733
        .step(  338,  true,   573,  true)    //  674:   192 <- [11/+1],       196 , flip( 192) // maxParent:  794
        .step(  345,  true,   570,  true)    //  675:   199 <- [11/+1],       203 , flip( 199) // maxParent:  842
        .step(  674, false,   675, false)    //  676:   203 <- [12/+1],       192 ,       199  // maxParent:  1004
        .step(  353,  true,   566,  true)    //  677:   207 <- [11/+1],       211 , flip( 207) // maxParent:  795
        .step(  360,  true,   563,  true)    //  678:   214 <- [11/+1],       218 , flip( 214) // maxParent:  841
        .step(  677, false,   678, false)    //  679:   218 <- [12/+1],       207 ,       214  // maxParent:  985
        .step(  676, false,   679, false)    //  680:   211 <- [13/+1],       203 ,       218  // maxParent:  746
        .step(  369,  true,   581,  true)    //  681:   223 <- [11/+1],       227 , flip( 223) // maxParent:  797
        .step(  376,  true,   578,  true)    //  682:   230 <- [11/+1],       234 , flip( 230) // maxParent:  844
        .step(  681, false,   682, false)    //  683:   234 <- [12/+1],       223 ,       230  // maxParent:  745
        .step(  384,  true,   585,  true)    //  684:   238 <- [11/+1],       242 , flip( 238) // maxParent:  744
        .step(  684, false,   588,  true)    //  685:     7 <- [12/+1],       238 , flip(   7) // maxParent:  845
        .step(  683, false,   685, false)    //  686:   242 <- [13/+1],       234 ,         7  // maxParent:  1041
        .step(  680, false,   686, false)    //  687:   227 <- [14/+1],       211 ,       242  // maxParent:  1203
        .step(  400,  true,   543,  true)    //  688:   119 <- [11/+1],       111 , flip( 119) // maxParent:  800
        .step(  407,  true,   540,  true)    //  689:   104 <- [11/+1],        96 , flip( 104) // maxParent:  836
        .step(  688, false,   689, false)    //  690:    96 <- [12/+1],       119 ,       104  // maxParent:  1002
        .step(  415,  true,   536,  true)    //  691:    84 <- [11/+1],        66 , flip(  84) // maxParent:  801
        .step(  422,  true,   533,  true)    //  692:    49 <- [11/+1],        13 , flip(  49) // maxParent:  835
        .step(  691, false,   692, false)    //  693:    13 <- [12/+1],        84 ,        49  // maxParent:  987
        .step(  690, false,   693, false)    //  694:    66 <- [13/+1],        96 ,        13  // maxParent:  743
        .step(  431,  true,   551,  true)    //  695:    24 <- [11/+1],         9 , flip(  24) // maxParent:  803
        .step(  438,  true,   548,  true)    //  696:    47 <- [11/+1],        11 , flip(  47) // maxParent:  838
        .step(  695, false,   696, false)    //  697:    11 <- [12/+1],        24 ,        47  // maxParent:  742
        .step(  446,  true,   555,  true)    //  698:    71 <- [11/+1],        89 , flip(  71) // maxParent:  741
        .step(  698, false,   558,  true)    //  699:   186 <- [12/+1],        71 , flip( 186) // maxParent:  839
        .step(  697, false,   699, false)    //  700:    89 <- [13/+1],        11 ,       186  // maxParent:  1040
        .step(  694, false,   700, false)    //  701:     9 <- [14/+1],        66 ,        89  // maxParent:  1106
        .step(  687, false,   701, false)    //  702:   111 <- [15/+1],       227 ,         9  // maxParent:  732
        .step(  419,  true,   512,  true)    //  703:    37 <- [11/+1], flip(  44), flip(  37) // maxParent:  807
        .step(  412,  true,   509,  true)    //  704:    76 <- [11/+1], flip(  81), flip(  76) // maxParent:  829
        .step(  703, false,   704, false)    //  705:    81 <- [12/+1],        37 ,        76  // maxParent:  999
        .step(  404,  true,   505,  true)    //  706:   100 <- [11/+1], flip( 103), flip( 100) // maxParent:  808
        .step(  397,  true,   502,  true)    //  707:   115 <- [11/+1], flip( 118), flip( 115) // maxParent:  828
        .step(  706, false,   707, false)    //  708:   118 <- [12/+1],       100 ,       115  // maxParent:  990
        .step(  705, false,   708, false)    //  709:   103 <- [13/+1],        81 ,       118  // maxParent:  739
        .step(  435,  true,   520,  true)    //  710:    35 <- [11/+1], flip(  42), flip(  35) // maxParent:  810
        .step(  428,  true,   517,  true)    //  711:     3 <- [11/+1], flip(  31), flip(   3) // maxParent:  831
        .step(  710, false,   711, false)    //  712:    31 <- [12/+1],        35 ,         3  // maxParent:  738
        .step(  443,  true,   524,  true)    //  713:    79 <- [11/+1], flip(  74), flip(  79) // maxParent:  737
        .step(  713, false,   527,  true)    //  714:   127 <- [12/+1],        79 , flip( 127) // maxParent:  832
        .step(  712, false,   714, false)    //  715:    74 <- [13/+1],        31 ,       127  // maxParent:  1038
        .step(  709, false,   715, false)    //  716:    42 <- [14/+1],       103 ,        74  // maxParent:  1204
        .step(  357,  true,   482,  true)    //  717:   216 <- [11/+1], flip( 215), flip( 216) // maxParent:  813
        .step(  350,  true,   479,  true)    //  718:   209 <- [11/+1], flip( 208), flip( 209) // maxParent:  823
        .step(  717, false,   718, false)    //  719:   208 <- [12/+1],       216 ,       209  // maxParent:  997
        .step(  342,  true,   475,  true)    //  720:   201 <- [11/+1], flip( 200), flip( 201) // maxParent:  814
        .step(  335,  true,   472,  true)    //  721:   194 <- [11/+1], flip( 193), flip( 194) // maxParent:  822
        .step(  720, false,   721, false)    //  722:   193 <- [12/+1],       201 ,       194  // maxParent:  992
        .step(  719, false,   722, false)    //  723:   200 <- [13/+1],       208 ,       193  // maxParent:  736
        .step(  373,  true,   490,  true)    //  724:   232 <- [11/+1], flip( 231), flip( 232) // maxParent:  816
        .step(  366,  true,   487,  true)    //  725:   225 <- [11/+1], flip( 224), flip( 225) // maxParent:  825
        .step(  724, false,   725, false)    //  726:   224 <- [12/+1],       232 ,       225  // maxParent:  735
        .step(  381,  true,   494,  true)    //  727:   240 <- [11/+1], flip( 239), flip( 240) // maxParent:  734
        .step(  727, false,   497,  true)    //  728:    12 <- [12/+1],       240 , flip(  12) // maxParent:  826
        .step(  726, false,   728, false)    //  729:   239 <- [13/+1],       224 ,        12  // maxParent:  1037
        .step(  723, false,   729, false)    //  730:   231 <- [14/+1],       200 ,       239  // maxParent:  1107
        .step(  716, false,   730, false)    //  731:   215 <- [15/+1],        42 ,       231  // maxParent:  732
        .step(  702,  true,   731,  true)    //  732:   215 <- [16/+1],       111 ,       215  // maxParent:  733
        .step(  673,  true,   732,  true)    //  733:   215 <- [17/+1],       153 ,       215  // maxParent:  765
        .step(  727,  true,   464,  true)    //  734:   246 <- [12/+1], flip( 240), flip( 246) // maxParent:  817
        .step(  726,  true,   734, false)    //  735:   224 <- [13/+1], flip( 224),       246  // maxParent:  1033
        .step(  723,  true,   735, false)    //  736:   200 <- [14/+1], flip( 200),       224  // maxParent:  1204
        .step(  713,  true,   459,  true)    //  737:    57 <- [12/+1], flip(  79), flip(  57) // maxParent:  811
        .step(  712,  true,   737, false)    //  738:    31 <- [13/+1], flip(  31),        57  // maxParent:  1032
        .step(  709,  true,   738, false)    //  739:   103 <- [14/+1], flip( 103),        31  // maxParent:  1110
        .step(  736, false,   739, false)    //  740:    79 <- [15/+1],       200 ,       103  // maxParent:  748
        .step(  698,  true,   453,  true)    //  741:    33 <- [12/+1], flip(  71), flip(  33) // maxParent:  804
        .step(  697,  true,   741, false)    //  742:    11 <- [13/+1], flip(  11),        33  // maxParent:  1030
        .step(  694,  true,   742, false)    //  743:    66 <- [14/+1], flip(  66),        11  // maxParent:  1203
        .step(  684,  true,   391,  true)    //  744:   248 <- [12/+1], flip( 238), flip( 248) // maxParent:  798
        .step(  683,  true,   744, false)    //  745:   234 <- [13/+1], flip( 234),       248  // maxParent:  1029
        .step(  680,  true,   745, false)    //  746:   211 <- [14/+1], flip( 211),       234  // maxParent:  1111
        .step(  743, false,   746, false)    //  747:   238 <- [15/+1],        66 ,       211  // maxParent:  748
        .step(  740,  true,   747,  true)    //  748:   238 <- [16/+1],        79 ,       238  // maxParent:  764
        .step(  668,  true,   327,  true)    //  749:   184 <- [12/+1], flip( 241), flip( 184) // maxParent:  790
        .step(  667,  true,   749, false)    //  750:   162 <- [13/+1], flip( 162),       184  // maxParent:  1026
        .step(  664,  true,   750, false)    //  751:   138 <- [14/+1], flip( 138),       162  // maxParent:  1201
        .step(  654,  true,   321,  true)    //  752:   188 <- [12/+1], flip(  86), flip( 188) // maxParent:  784
        .step(  653,  true,   752, false)    //  753:   172 <- [13/+1], flip( 172),       188  // maxParent:  1025
        .step(  650,  true,   753, false)    //  754:   149 <- [14/+1], flip( 149),       172  // maxParent:  1113
        .step(  751, false,   754, false)    //  755:    86 <- [15/+1],       138 ,       149  // maxParent:  763
        .step(  639,  true,   257,  true)    //  756:    48 <- [12/+1], flip(  64), flip(  48) // maxParent:  777
        .step(  638,  true,   756, false)    //  757:    25 <- [13/+1], flip(  25),        48  // maxParent:  1023
        .step(  635,  true,   757, false)    //  758:    78 <- [14/+1], flip(  78),        25  // maxParent:  1200
        .step(  625,  true,   251,  true)    //  759:    36 <- [12/+1], flip( 237), flip(  36) // maxParent:  771
        .step(  624,  true,   759, false)    //  760:    19 <- [13/+1], flip(  19),        36  // maxParent:  1022
        .step(  621,  true,   760, false)    //  761:   109 <- [14/+1], flip( 109),        19  // maxParent:  1114
        .step(  758, false,   761, false)    //  762:   237 <- [15/+1],        78 ,       109  // maxParent:  763
        .step(  755,  true,   762,  true)    //  763:   237 <- [16/+1],        86 ,       237  // maxParent:  764
        .step(  748,  true,   763,  true)    //  764:   237 <- [17/+1],       238 ,       237  // maxParent:  765
        .step(  733,  true,   764,  true)    //  765:   237 <- [18/+1],       215 ,       237  // maxParent:  766
        .step(  614,  true,   765,  true)    //  766:   237 <- [19/+1],       244 ,       237  // maxParent:  926
        .step(  125,  true,   615,  true)    //  767:   128 <- [12/+1],        94 ,       128  // maxParent:  927
        .step(  188,  true,   618,  true)    //  768:   206 <- [12/+1],       124 ,       206  // maxParent:  1015
        .step(  767, false,   768, false)    //  769:   124 <- [13/+1],       128 ,       206  // maxParent:  920
        .step(  220,  true,   622,  true)    //  770:   222 <- [12/+1],        34 ,       222  // maxParent:  919
        .step(  770, false,   759,  true)    //  771:    36 <- [13/+1],       222 , flip(  36) // maxParent:  1016
        .step(  769, false,   771, false)    //  772:    34 <- [14/+1],       124 ,        36  // maxParent:  1184
        .step(  157,  true,   629,  true)    //  773:     1 <- [12/+1], flip( 110),         1  // maxParent:  929
        .step(   78,  true,   632,  true)    //  774:    91 <- [12/+1], flip(  63),        91  // maxParent:  1013
        .step(  773, false,   774, false)    //  775:    63 <- [13/+1],         1 ,        91  // maxParent:  918
        .step(  205,  true,   636,  true)    //  776:     5 <- [12/+1], flip(  40),         5  // maxParent:  917
        .step(  776, false,   756,  true)    //  777:    48 <- [13/+1],         5 , flip(  48) // maxParent:  1014
        .step(  775, false,   777, false)    //  778:    40 <- [14/+1],        63 ,        48  // maxParent:  1119
        .step(  772, false,   778, false)    //  779:   110 <- [15/+1],        34 ,        40  // maxParent:  793
        .step(  275,  true,   644,  true)    //  780:    22 <- [12/+1],       142 ,        22  // maxParent:  932
        .step(  290,  true,   647,  true)    //  781:    97 <- [12/+1],       157 ,        97  // maxParent:  1010
        .step(  780, false,   781, false)    //  782:   157 <- [13/+1],        22 ,        97  // maxParent:  915
        .step(  306,  true,   651,  true)    //  783:    20 <- [12/+1],       173 ,        20  // maxParent:  914
        .step(  783, false,   752,  true)    //  784:   188 <- [13/+1],        20 , flip( 188) // maxParent:  1011
        .step(  782, false,   784, false)    //  785:   173 <- [14/+1],       157 ,       188  // maxParent:  1185
        .step(  283,  true,   658,  true)    //  786:   217 <- [12/+1], flip( 150),       217  // maxParent:  934
        .step(  268,  true,   661,  true)    //  787:   202 <- [12/+1], flip( 135),       202  // maxParent:  1008
        .step(  786, false,   787, false)    //  788:   135 <- [13/+1],       217 ,       202  // maxParent:  913
        .step(  299,  true,   665,  true)    //  789:   233 <- [12/+1], flip( 166),       233  // maxParent:  912
        .step(  789, false,   749,  true)    //  790:   184 <- [13/+1],       233 , flip( 184) // maxParent:  1009
        .step(  788, false,   790, false)    //  791:   166 <- [14/+1],       135 ,       184  // maxParent:  1120
        .step(  785, false,   791, false)    //  792:   150 <- [15/+1],       173 ,       166  // maxParent:  793
        .step(  779,  true,   792,  true)    //  793:   150 <- [16/+1],       110 ,       150  // maxParent:  821
        .step(  346,  true,   674,  true)    //  794:   192 <- [12/+1],       204 ,       192  // maxParent:  938
        .step(  361,  true,   677,  true)    //  795:   207 <- [12/+1],       219 ,       207  // maxParent:  1004
        .step(  794, false,   795, false)    //  796:   219 <- [13/+1],       192 ,       207  // maxParent:  909
        .step(  377,  true,   681,  true)    //  797:   223 <- [12/+1],       235 ,       223  // maxParent:  908
        .step(  797, false,   744,  true)    //  798:   248 <- [13/+1],       223 , flip( 248) // maxParent:  1005
        .step(  796, false,   798, false)    //  799:   235 <- [14/+1],       219 ,       248  // maxParent:  1187
        .step(  408,  true,   688,  true)    //  800:   119 <- [12/+1],        99 ,       119  // maxParent:  940
        .step(  423,  true,   691,  true)    //  801:    84 <- [12/+1],        30 ,        84  // maxParent:  1002
        .step(  800, false,   801, false)    //  802:    30 <- [13/+1],       119 ,        84  // maxParent:  907
        .step(  439,  true,   695,  true)    //  803:    24 <- [12/+1],        28 ,        24  // maxParent:  906
        .step(  803, false,   741,  true)    //  804:    33 <- [13/+1],        24 , flip(  33) // maxParent:  1003
        .step(  802, false,   804, false)    //  805:    28 <- [14/+1],        30 ,        33  // maxParent:  1122
        .step(  799, false,   805, false)    //  806:    99 <- [15/+1],       235 ,        28  // maxParent:  820
        .step(  416,  true,   703,  true)    //  807:    37 <- [12/+1], flip(  73),        37  // maxParent:  943
        .step(  401,  true,   706,  true)    //  808:   100 <- [12/+1], flip( 114),       100  // maxParent:  999
        .step(  807, false,   808, false)    //  809:   114 <- [13/+1],        37 ,       100  // maxParent:  904
        .step(  432,  true,   710,  true)    //  810:    35 <- [12/+1], flip(   0),        35  // maxParent:  903
        .step(  810, false,   737,  true)    //  811:    57 <- [13/+1],        35 , flip(  57) // maxParent:  1000
        .step(  809, false,   811, false)    //  812:     0 <- [14/+1],       114 ,        57  // maxParent:  1188
        .step(  354,  true,   717,  true)    //  813:   216 <- [12/+1], flip( 212),       216  // maxParent:  945
        .step(  339,  true,   720,  true)    //  814:   201 <- [12/+1], flip( 197),       201  // maxParent:  997
        .step(  813, false,   814, false)    //  815:   197 <- [13/+1],       216 ,       201  // maxParent:  902
        .step(  370,  true,   724,  true)    //  816:   232 <- [12/+1], flip( 228),       232  // maxParent:  901
        .step(  816, false,   734,  true)    //  817:   246 <- [13/+1],       232 , flip( 246) // maxParent:  998
        .step(  815, false,   817, false)    //  818:   228 <- [14/+1],       197 ,       246  // maxParent:  1123
        .step(  812, false,   818, false)    //  819:   212 <- [15/+1],         0 ,       228  // maxParent:  820
        .step(  806,  true,   819,  true)    //  820:   212 <- [16/+1],        99 ,       212  // maxParent:  821
        .step(  793,  true,   820,  true)    //  821:   212 <- [17/+1],       150 ,       212  // maxParent:  877
        .step(  476,  true,   721,  true)    //  822:   194 <- [12/+1],        92 , flip( 194) // maxParent:  950
        .step(  483,  true,   718,  true)    //  823:   209 <- [12/+1],       122 , flip( 209) // maxParent:  992
        .step(  822, false,   823, false)    //  824:   122 <- [13/+1],       194 ,       209  // maxParent:  897
        .step(  491,  true,   725,  true)    //  825:   225 <- [12/+1],        10 , flip( 225) // maxParent:  896
        .step(  825, false,   728,  true)    //  826:    12 <- [13/+1],       225 , flip(  12) // maxParent:  993
        .step(  824, false,   826, false)    //  827:    10 <- [14/+1],       122 ,        12  // maxParent:  1191
        .step(  506,  true,   707,  true)    //  828:   115 <- [12/+1],        98 , flip( 115) // maxParent:  952
        .step(  513,  true,   704,  true)    //  829:    76 <- [12/+1],        23 , flip(  76) // maxParent:  990
        .step(  828, false,   829, false)    //  830:    23 <- [13/+1],       115 ,        76  // maxParent:  895
        .step(  521,  true,   711,  true)    //  831:     3 <- [12/+1],        16 , flip(   3) // maxParent:  894
        .step(  831, false,   714,  true)    //  832:   127 <- [13/+1],         3 , flip( 127) // maxParent:  991
        .step(  830, false,   832, false)    //  833:    16 <- [14/+1],        23 ,       127  // maxParent:  1126
        .step(  827, false,   833, false)    //  834:    98 <- [15/+1],        10 ,        16  // maxParent:  848
        .step(  537,  true,   692,  true)    //  835:    49 <- [12/+1],       140 , flip(  49) // maxParent:  955
        .step(  544,  true,   689,  true)    //  836:   104 <- [12/+1],       155 , flip( 104) // maxParent:  987
        .step(  835, false,   836, false)    //  837:   155 <- [13/+1],        49 ,       104  // maxParent:  892
        .step(  552,  true,   696,  true)    //  838:    47 <- [12/+1],       171 , flip(  47) // maxParent:  891
        .step(  838, false,   699,  true)    //  839:   186 <- [13/+1],        47 , flip( 186) // maxParent:  988
        .step(  837, false,   839, false)    //  840:   171 <- [14/+1],       155 ,       186  // maxParent:  1192
        .step(  567,  true,   678,  true)    //  841:   214 <- [12/+1],       144 , flip( 214) // maxParent:  957
        .step(  574,  true,   675,  true)    //  842:   199 <- [12/+1],       129 , flip( 199) // maxParent:  985
        .step(  841, false,   842, false)    //  843:   129 <- [13/+1],       214 ,       199  // maxParent:  890
        .step(  582,  true,   682,  true)    //  844:   230 <- [12/+1],       160 , flip( 230) // maxParent:  889
        .step(  844, false,   685,  true)    //  845:     7 <- [13/+1],       230 , flip(   7) // maxParent:  986
        .step(  843, false,   845, false)    //  846:   160 <- [14/+1],       129 ,         7  // maxParent:  1127
        .step(  840, false,   846, false)    //  847:   144 <- [15/+1],       171 ,       160  // maxParent:  848
        .step(  834,  true,   847,  true)    //  848:   144 <- [16/+1],        98 ,       144  // maxParent:  876
        .step(  571,  true,   662,  true)    //  849:   195 <- [12/+1], flip( 136), flip( 195) // maxParent:  961
        .step(  564,  true,   659,  true)    //  850:   210 <- [12/+1], flip( 151), flip( 210) // maxParent:  981
        .step(  849, false,   850, false)    //  851:   151 <- [13/+1],       195 ,       210  // maxParent:  886
        .step(  579,  true,   666,  true)    //  852:   226 <- [12/+1], flip( 167), flip( 226) // maxParent:  885
        .step(  852, false,   669,  true)    //  853:   185 <- [13/+1],       226 , flip( 185) // maxParent:  982
        .step(  851, false,   853, false)    //  854:   167 <- [14/+1],       151 ,       185  // maxParent:  1194
        .step(  541,  true,   648,  true)    //  855:   112 <- [12/+1], flip( 148), flip( 112) // maxParent:  963
        .step(  534,  true,   645,  true)    //  856:    69 <- [12/+1], flip( 133), flip(  69) // maxParent:  979
        .step(  855, false,   856, false)    //  857:   133 <- [13/+1],       112 ,        69  // maxParent:  884
        .step(  549,  true,   652,  true)    //  858:    18 <- [12/+1], flip( 164), flip(  18) // maxParent:  883
        .step(  858, false,   655,  true)    //  859:   187 <- [13/+1],        18 , flip( 187) // maxParent:  980
        .step(  857, false,   859, false)    //  860:   164 <- [14/+1],       133 ,       187  // maxParent:  1129
        .step(  854, false,   860, false)    //  861:   148 <- [15/+1],       167 ,       164  // maxParent:  875
        .step(  510,  true,   633,  true)    //  862:    60 <- [12/+1], flip(  70), flip(  60) // maxParent:  966
        .step(  503,  true,   630,  true)    //  863:   107 <- [12/+1], flip( 113), flip( 107) // maxParent:  976
        .step(  862, false,   863, false)    //  864:   113 <- [13/+1],        60 ,       107  // maxParent:  881
        .step(  518,  true,   637,  true)    //  865:    58 <- [12/+1], flip(  14), flip(  58) // maxParent:  880
        .step(  865, false,   640,  true)    //  866:    29 <- [13/+1],        58 , flip(  29) // maxParent:  977
        .step(  864, false,   866, false)    //  867:    14 <- [14/+1],       113 ,        29  // maxParent:  1195
        .step(  480,  true,   619,  true)    //  868:   213 <- [12/+1], flip( 108), flip( 213) // maxParent:  968
        .step(  473,  true,   616,  true)    //  869:   198 <- [12/+1], flip(  61), flip( 198) // maxParent:  974
        .step(  868, false,   869, false)    //  870:    61 <- [13/+1],       213 ,       198  // maxParent:  879
        .step(  488,  true,   623,  true)    //  871:   229 <- [12/+1], flip(  56), flip( 229) // maxParent:  878
        .step(  871, false,   626,  true)    //  872:    21 <- [13/+1],       229 , flip(  21) // maxParent:  975
        .step(  870, false,   872, false)    //  873:    56 <- [14/+1],        61 ,        21  // maxParent:  1130
        .step(  867, false,   873, false)    //  874:   108 <- [15/+1],        14 ,        56  // maxParent:  875
        .step(  861,  true,   874,  true)    //  875:   108 <- [16/+1],       148 ,       108  // maxParent:  876
        .step(  848,  true,   875,  true)    //  876:   108 <- [17/+1],       144 ,       108  // maxParent:  877
        .step(  821,  true,   876,  true)    //  877:   108 <- [18/+1],       212 ,       108  // maxParent:  925
        .step(  871,  true,   608,  true)    //  878:    65 <- [13/+1], flip( 229), flip(  65) // maxParent:  969
        .step(  870,  true,   878, false)    //  879:    61 <- [14/+1], flip(  61),        65  // maxParent:  1195
        .step(  865,  true,   604,  true)    //  880:    87 <- [13/+1], flip(  58), flip(  87) // maxParent:  967
        .step(  864,  true,   880, false)    //  881:   113 <- [14/+1], flip( 113),        87  // maxParent:  1134
        .step(  879, false,   881, false)    //  882:    58 <- [15/+1],        61 ,       113  // maxParent:  888
        .step(  858,  true,   599,  true)    //  883:   179 <- [13/+1], flip(  18), flip( 179) // maxParent:  964
        .step(  857,  true,   883, false)    //  884:   133 <- [14/+1], flip( 133),       179  // maxParent:  1194
        .step(  852,  true,   595,  true)    //  885:   175 <- [13/+1], flip( 226), flip( 175) // maxParent:  962
        .step(  851,  true,   885, false)    //  886:   151 <- [14/+1], flip( 151),       175  // maxParent:  1135
        .step(  884, false,   886, false)    //  887:   226 <- [15/+1],       133 ,       151  // maxParent:  888
        .step(  882,  true,   887,  true)    //  888:   226 <- [16/+1],        58 ,       226  // maxParent:  900
        .step(  844,  true,   589,  true)    //  889:   182 <- [13/+1], flip( 230), flip( 182) // maxParent:  958
        .step(  843,  true,   889, false)    //  890:   129 <- [14/+1], flip( 129),       182  // maxParent:  1192
        .step(  838,  true,   559,  true)    //  891:   183 <- [13/+1], flip(  47), flip( 183) // maxParent:  956
        .step(  837,  true,   891, false)    //  892:   155 <- [14/+1], flip( 155),       183  // maxParent:  1137
        .step(  890, false,   892, false)    //  893:    47 <- [15/+1],       129 ,       155  // maxParent:  899
        .step(  831,  true,   528,  true)    //  894:    54 <- [13/+1], flip(   3), flip(  54) // maxParent:  953
        .step(  830,  true,   894, false)    //  895:    23 <- [14/+1], flip(  23),        54  // maxParent:  1191
        .step(  825,  true,   498,  true)    //  896:    43 <- [13/+1], flip( 225), flip(  43) // maxParent:  951
        .step(  824,  true,   896, false)    //  897:   122 <- [14/+1], flip( 122),        43  // maxParent:  1138
        .step(  895, false,   897, false)    //  898:   225 <- [15/+1],        23 ,       122  // maxParent:  899
        .step(  893,  true,   898,  true)    //  899:   225 <- [16/+1],        47 ,       225  // maxParent:  900
        .step(  888,  true,   899,  true)    //  900:   225 <- [17/+1],       226 ,       225  // maxParent:  924
        .step(  816,  true,   465,  true)    //  901:   243 <- [13/+1], flip( 232), flip( 243) // maxParent:  946
        .step(  815,  true,   901, false)    //  902:   197 <- [14/+1], flip( 197),       243  // maxParent:  1188
        .step(  810,  true,   460,  true)    //  903:    82 <- [13/+1], flip(  35), flip(  82) // maxParent:  944
        .step(  809,  true,   903, false)    //  904:   114 <- [14/+1], flip( 114),        82  // maxParent:  1141
        .step(  902, false,   904, false)    //  905:    35 <- [15/+1],       197 ,       114  // maxParent:  911
        .step(  803,  true,   454,  true)    //  906:    46 <- [13/+1], flip(  24), flip(  46) // maxParent:  941
        .step(  802,  true,   906, false)    //  907:    30 <- [14/+1], flip(  30),        46  // maxParent:  1187
        .step(  797,  true,   392,  true)    //  908:   249 <- [13/+1], flip( 223), flip( 249) // maxParent:  939
        .step(  796,  true,   908, false)    //  909:   219 <- [14/+1], flip( 219),       249  // maxParent:  1142
        .step(  907, false,   909, false)    //  910:   223 <- [15/+1],        30 ,       219  // maxParent:  911
        .step(  905,  true,   910,  true)    //  911:   223 <- [16/+1],        35 ,       223  // maxParent:  923
        .step(  789,  true,   328,  true)    //  912:   181 <- [13/+1], flip( 233), flip( 181) // maxParent:  935
        .step(  788,  true,   912, false)    //  913:   135 <- [14/+1], flip( 135),       181  // maxParent:  1185
        .step(  783,  true,   322,  true)    //  914:   189 <- [13/+1], flip(  20), flip( 189) // maxParent:  933
        .step(  782,  true,   914, false)    //  915:   157 <- [14/+1], flip( 157),       189  // maxParent:  1144
        .step(  913, false,   915, false)    //  916:    20 <- [15/+1],       135 ,       157  // maxParent:  922
        .step(  776,  true,   258,  true)    //  917:    75 <- [13/+1], flip(   5), flip(  75) // maxParent:  930
        .step(  775,  true,   917, false)    //  918:    63 <- [14/+1], flip(  63),        75  // maxParent:  1184
        .step(  770,  true,   252,  true)    //  919:    59 <- [13/+1], flip( 222), flip(  59) // maxParent:  928
        .step(  769,  true,   919, false)    //  920:   124 <- [14/+1], flip( 124),        59  // maxParent:  1145
        .step(  918, false,   920, false)    //  921:   222 <- [15/+1],        63 ,       124  // maxParent:  922
        .step(  916,  true,   921,  true)    //  922:   222 <- [16/+1],        20 ,       222  // maxParent:  923
        .step(  911,  true,   922,  true)    //  923:   222 <- [17/+1],       223 ,       222  // maxParent:  924
        .step(  900,  true,   923,  true)    //  924:   222 <- [18/+1],       225 ,       222  // maxParent:  925
        .step(  877,  true,   924,  true)    //  925:   222 <- [19/+1],       108 ,       222  // maxParent:  926
        .step(  766,  true,   925,  true)    //  926:   222 <- [20/+1],       237 ,       222  // maxParent:  1086
        .step(  189,  true,   767,  true)    //  927:   128 <- [13/+1],       125 ,       128  // maxParent:  1079
        .step(  927, false,   919,  true)    //  928:    59 <- [14/+1],       128 , flip(  59) // maxParent:  1152
        .step(  126,  true,   773,  true)    //  929:     1 <- [13/+1], flip(  95),         1  // maxParent:  1078
        .step(  929, false,   917,  true)    //  930:    75 <- [14/+1],         1 , flip(  75) // maxParent:  1145
        .step(  928, false,   930, false)    //  931:    95 <- [15/+1],        59 ,        75  // maxParent:  937
        .step(  291,  true,   780,  true)    //  932:    22 <- [13/+1],       158 ,        22  // maxParent:  1076
        .step(  932, false,   914,  true)    //  933:   189 <- [14/+1],        22 , flip( 189) // maxParent:  1153
        .step(  276,  true,   786,  true)    //  934:   217 <- [13/+1], flip( 143),       217  // maxParent:  1075
        .step(  934, false,   912,  true)    //  935:   181 <- [14/+1],       217 , flip( 181) // maxParent:  1144
        .step(  933, false,   935, false)    //  936:   143 <- [15/+1],       189 ,       181  // maxParent:  937
        .step(  931,  true,   936,  true)    //  937:   143 <- [16/+1],        95 ,       143  // maxParent:  949
        .step(  362,  true,   794,  true)    //  938:   192 <- [13/+1],       220 ,       192  // maxParent:  1072
        .step(  938, false,   908,  true)    //  939:   249 <- [14/+1],       192 , flip( 249) // maxParent:  1155
        .step(  424,  true,   800,  true)    //  940:   119 <- [13/+1],        55 ,       119  // maxParent:  1071
        .step(  940, false,   906,  true)    //  941:    46 <- [14/+1],       119 , flip(  46) // maxParent:  1142
        .step(  939, false,   941, false)    //  942:    55 <- [15/+1],       249 ,        46  // maxParent:  948
        .step(  409,  true,   807,  true)    //  943:    37 <- [13/+1], flip( 106),        37  // maxParent:  1069
        .step(  943, false,   903,  true)    //  944:    82 <- [14/+1],        37 , flip(  82) // maxParent:  1156
        .step(  347,  true,   813,  true)    //  945:   216 <- [13/+1], flip( 205),       216  // maxParent:  1068
        .step(  945, false,   901,  true)    //  946:   243 <- [14/+1],       216 , flip( 243) // maxParent:  1141
        .step(  944, false,   946, false)    //  947:   205 <- [15/+1],        82 ,       243  // maxParent:  948
        .step(  942,  true,   947,  true)    //  948:   205 <- [16/+1],        55 ,       205  // maxParent:  949
        .step(  937,  true,   948,  true)    //  949:   205 <- [17/+1],       143 ,       205  // maxParent:  973
        .step(  484,  true,   822,  true)    //  950:   194 <- [13/+1],       116 ,       194  // maxParent:  1064
        .step(  950, false,   896,  true)    //  951:    43 <- [14/+1],       194 , flip(  43) // maxParent:  1159
        .step(  514,  true,   828,  true)    //  952:   115 <- [13/+1],        50 ,       115  // maxParent:  1063
        .step(  952, false,   894,  true)    //  953:    54 <- [14/+1],       115 , flip(  54) // maxParent:  1138
        .step(  951, false,   953, false)    //  954:    50 <- [15/+1],        43 ,        54  // maxParent:  960
        .step(  545,  true,   835,  true)    //  955:    49 <- [13/+1],       152 ,        49  // maxParent:  1061
        .step(  955, false,   891,  true)    //  956:   183 <- [14/+1],        49 , flip( 183) // maxParent:  1160
        .step(  575,  true,   841,  true)    //  957:   214 <- [13/+1],       132 ,       214  // maxParent:  1060
        .step(  957, false,   889,  true)    //  958:   182 <- [14/+1],       214 , flip( 182) // maxParent:  1137
        .step(  956, false,   958, false)    //  959:   132 <- [15/+1],       183 ,       182  // maxParent:  960
        .step(  954,  true,   959,  true)    //  960:   132 <- [16/+1],        50 ,       132  // maxParent:  972
        .step(  568,  true,   849,  true)    //  961:   195 <- [13/+1], flip( 147),       195  // maxParent:  1057
        .step(  961, false,   885,  true)    //  962:   175 <- [14/+1],       195 , flip( 175) // maxParent:  1162
        .step(  538,  true,   855,  true)    //  963:   112 <- [13/+1], flip( 137),       112  // maxParent:  1056
        .step(  963, false,   883,  true)    //  964:   179 <- [14/+1],       112 , flip( 179) // maxParent:  1135
        .step(  962, false,   964, false)    //  965:   137 <- [15/+1],       175 ,       179  // maxParent:  971
        .step(  507,  true,   862,  true)    //  966:    60 <- [13/+1], flip( 105),        60  // maxParent:  1054
        .step(  966, false,   880,  true)    //  967:    87 <- [14/+1],        60 , flip(  87) // maxParent:  1163
        .step(  477,  true,   868,  true)    //  968:   213 <- [13/+1], flip(  77),       213  // maxParent:  1053
        .step(  968, false,   878,  true)    //  969:    65 <- [14/+1],       213 , flip(  65) // maxParent:  1134
        .step(  967, false,   969, false)    //  970:    77 <- [15/+1],        87 ,        65  // maxParent:  971
        .step(  965,  true,   970,  true)    //  971:    77 <- [16/+1],       137 ,        77  // maxParent:  972
        .step(  960,  true,   971,  true)    //  972:    77 <- [17/+1],       132 ,        77  // maxParent:  973
        .step(  949,  true,   972,  true)    //  973:    77 <- [18/+1],       205 ,        77  // maxParent:  1021
        .step(  620,  true,   869,  true)    //  974:   198 <- [13/+1],       123 , flip( 198) // maxParent:  1048
        .step(  974, false,   872,  true)    //  975:    21 <- [14/+1],       198 , flip(  21) // maxParent:  1167
        .step(  634,  true,   863,  true)    //  976:   107 <- [13/+1],        39 , flip( 107) // maxParent:  1047
        .step(  976, false,   866,  true)    //  977:    29 <- [14/+1],       107 , flip(  29) // maxParent:  1130
        .step(  975, false,   977, false)    //  978:    39 <- [15/+1],        21 ,        29  // maxParent:  984
        .step(  649,  true,   856,  true)    //  979:    69 <- [13/+1],       156 , flip(  69) // maxParent:  1045
        .step(  979, false,   859,  true)    //  980:   187 <- [14/+1],        69 , flip( 187) // maxParent:  1168
        .step(  663,  true,   850,  true)    //  981:   210 <- [13/+1],       131 , flip( 210) // maxParent:  1044
        .step(  981, false,   853,  true)    //  982:   185 <- [14/+1],       210 , flip( 185) // maxParent:  1129
        .step(  980, false,   982, false)    //  983:   131 <- [15/+1],       187 ,       185  // maxParent:  984
        .step(  978,  true,   983,  true)    //  984:   131 <- [16/+1],        39 ,       131  // maxParent:  996
        .step(  679,  true,   842,  true)    //  985:   199 <- [13/+1],       218 , flip( 199) // maxParent:  1041
        .step(  985, false,   845,  true)    //  986:     7 <- [14/+1],       199 , flip(   7) // maxParent:  1170
        .step(  693,  true,   836,  true)    //  987:   104 <- [13/+1],        13 , flip( 104) // maxParent:  1040
        .step(  987, false,   839,  true)    //  988:   186 <- [14/+1],       104 , flip( 186) // maxParent:  1127
        .step(  986, false,   988, false)    //  989:    13 <- [15/+1],         7 ,       186  // maxParent:  995
        .step(  708,  true,   829,  true)    //  990:    76 <- [13/+1],       118 , flip(  76) // maxParent:  1038
        .step(  990, false,   832,  true)    //  991:   127 <- [14/+1],        76 , flip( 127) // maxParent:  1171
        .step(  722,  true,   823,  true)    //  992:   209 <- [13/+1],       193 , flip( 209) // maxParent:  1037
        .step(  992, false,   826,  true)    //  993:    12 <- [14/+1],       209 , flip(  12) // maxParent:  1126
        .step(  991, false,   993, false)    //  994:   193 <- [15/+1],       127 ,        12  // maxParent:  995
        .step(  989,  true,   994,  true)    //  995:   193 <- [16/+1],        13 ,       193  // maxParent:  996
        .step(  984,  true,   995,  true)    //  996:   193 <- [17/+1],       131 ,       193  // maxParent:  1020
        .step(  719,  true,   814,  true)    //  997:   201 <- [13/+1], flip( 208), flip( 201) // maxParent:  1033
        .step(  997, false,   817,  true)    //  998:   246 <- [14/+1],       201 , flip( 246) // maxParent:  1174
        .step(  705,  true,   808,  true)    //  999:   100 <- [13/+1], flip(  81), flip( 100) // maxParent:  1032
        .step(  999, false,   811,  true)    // 1000:    57 <- [14/+1],       100 , flip(  57) // maxParent:  1123
        .step(  998, false,  1000, false)    // 1001:    81 <- [15/+1],       246 ,        57  // maxParent:  1007
        .step(  690,  true,   801,  true)    // 1002:    84 <- [13/+1], flip(  96), flip(  84) // maxParent:  1030
        .step( 1002, false,   804,  true)    // 1003:    33 <- [14/+1],        84 , flip(  33) // maxParent:  1175
        .step(  676,  true,   795,  true)    // 1004:   207 <- [13/+1], flip( 203), flip( 207) // maxParent:  1029
        .step( 1004, false,   798,  true)    // 1005:   248 <- [14/+1],       207 , flip( 248) // maxParent:  1122
        .step( 1003, false,  1005, false)    // 1006:   203 <- [15/+1],        33 ,       248  // maxParent:  1007
        .step( 1001,  true,  1006,  true)    // 1007:   203 <- [16/+1],        81 ,       203  // maxParent:  1019
        .step(  660,  true,   787,  true)    // 1008:   202 <- [13/+1], flip( 146), flip( 202) // maxParent:  1026
        .step( 1008, false,   790,  true)    // 1009:   184 <- [14/+1],       202 , flip( 184) // maxParent:  1177
        .step(  646,  true,   781,  true)    // 1010:    97 <- [13/+1], flip( 141), flip(  97) // maxParent:  1025
        .step( 1010, false,   784,  true)    // 1011:   188 <- [14/+1],        97 , flip( 188) // maxParent:  1120
        .step( 1009, false,  1011, false)    // 1012:   141 <- [15/+1],       184 ,       188  // maxParent:  1018
        .step(  631,  true,   774,  true)    // 1013:    91 <- [13/+1], flip( 102), flip(  91) // maxParent:  1023
        .step( 1013, false,   777,  true)    // 1014:    48 <- [14/+1],        91 , flip(  48) // maxParent:  1178
        .step(  617,  true,   768,  true)    // 1015:   206 <- [13/+1], flip(  93), flip( 206) // maxParent:  1022
        .step( 1015, false,   771,  true)    // 1016:    36 <- [14/+1],       206 , flip(  36) // maxParent:  1119
        .step( 1014, false,  1016, false)    // 1017:    93 <- [15/+1],        48 ,        36  // maxParent:  1018
        .step( 1012,  true,  1017,  true)    // 1018:    93 <- [16/+1],       141 ,        93  // maxParent:  1019
        .step( 1007,  true,  1018,  true)    // 1019:    93 <- [17/+1],       203 ,        93  // maxParent:  1020
        .step(  996,  true,  1019,  true)    // 1020:    93 <- [18/+1],       193 ,        93  // maxParent:  1021
        .step(  973,  true,  1020,  true)    // 1021:    93 <- [19/+1],        77 ,        93  // maxParent:  1085
        .step( 1015,  true,   760,  true)    // 1022:    19 <- [14/+1], flip( 206), flip(  19) // maxParent:  1178
        .step( 1013,  true,   757,  true)    // 1023:    25 <- [14/+1], flip(  91), flip(  25) // maxParent:  1114
        .step( 1022, false,  1023, false)    // 1024:    91 <- [15/+1],        19 ,        25  // maxParent:  1028
        .step( 1010,  true,   753,  true)    // 1025:   172 <- [14/+1], flip(  97), flip( 172) // maxParent:  1177
        .step( 1008,  true,   750,  true)    // 1026:   162 <- [14/+1], flip( 202), flip( 162) // maxParent:  1113
        .step( 1025, false,  1026, false)    // 1027:   202 <- [15/+1],       172 ,       162  // maxParent:  1028
        .step( 1024,  true,  1027,  true)    // 1028:   202 <- [16/+1],        91 ,       202  // maxParent:  1036
        .step( 1004,  true,   745,  true)    // 1029:   234 <- [14/+1], flip( 207), flip( 234) // maxParent:  1175
        .step( 1002,  true,   742,  true)    // 1030:    11 <- [14/+1], flip(  84), flip(  11) // maxParent:  1111
        .step( 1029, false,  1030, false)    // 1031:    84 <- [15/+1],       234 ,        11  // maxParent:  1035
        .step(  999,  true,   738,  true)    // 1032:    31 <- [14/+1], flip( 100), flip(  31) // maxParent:  1174
        .step(  997,  true,   735,  true)    // 1033:   224 <- [14/+1], flip( 201), flip( 224) // maxParent:  1110
        .step( 1032, false,  1033, false)    // 1034:   201 <- [15/+1],        31 ,       224  // maxParent:  1035
        .step( 1031,  true,  1034,  true)    // 1035:   201 <- [16/+1],        84 ,       201  // maxParent:  1036
        .step( 1028,  true,  1035,  true)    // 1036:   201 <- [17/+1],       202 ,       201  // maxParent:  1052
        .step(  992,  true,   729,  true)    // 1037:   239 <- [14/+1], flip( 209), flip( 239) // maxParent:  1171
        .step(  990,  true,   715,  true)    // 1038:    74 <- [14/+1], flip(  76), flip(  74) // maxParent:  1107
        .step( 1037, false,  1038, false)    // 1039:    76 <- [15/+1],       239 ,        74  // maxParent:  1043
        .step(  987,  true,   700,  true)    // 1040:    89 <- [14/+1], flip( 104), flip(  89) // maxParent:  1170
        .step(  985,  true,   686,  true)    // 1041:   242 <- [14/+1], flip( 199), flip( 242) // maxParent:  1106
        .step( 1040, false,  1041, false)    // 1042:   199 <- [15/+1],        89 ,       242  // maxParent:  1043
        .step( 1039,  true,  1042,  true)    // 1043:   199 <- [16/+1],        76 ,       199  // maxParent:  1051
        .step(  981,  true,   670,  true)    // 1044:   177 <- [14/+1], flip( 210), flip( 177) // maxParent:  1168
        .step(  979,  true,   656,  true)    // 1045:   180 <- [14/+1], flip(  69), flip( 180) // maxParent:  1104
        .step( 1044, false,  1045, false)    // 1046:    69 <- [15/+1],       177 ,       180  // maxParent:  1050
        .step(  976,  true,   641,  true)    // 1047:    83 <- [14/+1], flip( 107), flip(  83) // maxParent:  1167
        .step(  974,  true,   627,  true)    // 1048:    68 <- [14/+1], flip( 198), flip(  68) // maxParent:  1103
        .step( 1047, false,  1048, false)    // 1049:   198 <- [15/+1],        83 ,        68  // maxParent:  1050
        .step( 1046,  true,  1049,  true)    // 1050:   198 <- [16/+1],        69 ,       198  // maxParent:  1051
        .step( 1043,  true,  1050,  true)    // 1051:   198 <- [17/+1],       199 ,       198  // maxParent:  1052
        .step( 1036,  true,  1051,  true)    // 1052:   198 <- [18/+1],       201 ,       198  // maxParent:  1084
        .step(  968,  true,   609,  true)    // 1053:     8 <- [14/+1], flip( 213), flip(   8) // maxParent:  1163
        .step(  966,  true,   605,  true)    // 1054:    45 <- [14/+1], flip(  60), flip(  45) // maxParent:  1099
        .step( 1053, false,  1054, false)    // 1055:    60 <- [15/+1],         8 ,        45  // maxParent:  1059
        .step(  963,  true,   600,  true)    // 1056:   168 <- [14/+1], flip( 112), flip( 168) // maxParent:  1162
        .step(  961,  true,   596,  true)    // 1057:   163 <- [14/+1], flip( 195), flip( 163) // maxParent:  1098
        .step( 1056, false,  1057, false)    // 1058:   195 <- [15/+1],       168 ,       163  // maxParent:  1059
        .step( 1055,  true,  1058,  true)    // 1059:   195 <- [16/+1],        60 ,       195  // maxParent:  1067
        .step(  957,  true,   590,  true)    // 1060:   178 <- [14/+1], flip( 214), flip( 178) // maxParent:  1160
        .step(  955,  true,   560,  true)    // 1061:   176 <- [14/+1], flip(  49), flip( 176) // maxParent:  1096
        .step( 1060, false,  1061, false)    // 1062:    49 <- [15/+1],       178 ,       176  // maxParent:  1066
        .step(  952,  true,   529,  true)    // 1063:    72 <- [14/+1], flip( 115), flip(  72) // maxParent:  1159
        .step(  950,  true,   499,  true)    // 1064:    80 <- [14/+1], flip( 194), flip(  80) // maxParent:  1095
        .step( 1063, false,  1064, false)    // 1065:   194 <- [15/+1],        72 ,        80  // maxParent:  1066
        .step( 1062,  true,  1065,  true)    // 1066:   194 <- [16/+1],        49 ,       194  // maxParent:  1067
        .step( 1059,  true,  1066,  true)    // 1067:   194 <- [17/+1],       195 ,       194  // maxParent:  1083
        .step(  945,  true,   466,  true)    // 1068:   236 <- [14/+1], flip( 216), flip( 236) // maxParent:  1156
        .step(  943,  true,   461,  true)    // 1069:    53 <- [14/+1], flip(  37), flip(  53) // maxParent:  1092
        .step( 1068, false,  1069, false)    // 1070:    37 <- [15/+1],       236 ,        53  // maxParent:  1074
        .step(  940,  true,   455,  true)    // 1071:    67 <- [14/+1], flip( 119), flip(  67) // maxParent:  1155
        .step(  938,  true,   393,  true)    // 1072:   250 <- [14/+1], flip( 192), flip( 250) // maxParent:  1091
        .step( 1071, false,  1072, false)    // 1073:   192 <- [15/+1],        67 ,       250  // maxParent:  1074
        .step( 1070,  true,  1073,  true)    // 1074:   192 <- [16/+1],        37 ,       192  // maxParent:  1082
        .step(  934,  true,   329,  true)    // 1075:   174 <- [14/+1], flip( 217), flip( 174) // maxParent:  1153
        .step(  932,  true,   323,  true)    // 1076:   190 <- [14/+1], flip(  22), flip( 190) // maxParent:  1089
        .step( 1075, false,  1076, false)    // 1077:    22 <- [15/+1],       174 ,       190  // maxParent:  1081
        .step(  929,  true,   259,  true)    // 1078:     4 <- [14/+1], flip(   1), flip(   4) // maxParent:  1152
        .step(  927,  true,   253,  true)    // 1079:    90 <- [14/+1], flip( 128), flip(  90) // maxParent:  1088
        .step( 1078, false,  1079, false)    // 1080:   128 <- [15/+1],         4 ,        90  // maxParent:  1081
        .step( 1077,  true,  1080,  true)    // 1081:   128 <- [16/+1],        22 ,       128  // maxParent:  1082
        .step( 1074,  true,  1081,  true)    // 1082:   128 <- [17/+1],       192 ,       128  // maxParent:  1083
        .step( 1067,  true,  1082,  true)    // 1083:   128 <- [18/+1],       194 ,       128  // maxParent:  1084
        .step( 1052,  true,  1083,  true)    // 1084:   128 <- [19/+1],       198 ,       128  // maxParent:  1085
        .step( 1021,  true,  1084,  true)    // 1085:   128 <- [20/+1],        93 ,       128  // maxParent:  1086
        .step(  926,  true,  1085,  true)    // 1086:   128 <- [21/+1],       222 ,       128  // maxParent:  1087
        .step( 1086,  true,  1086, false)    // 1087:   128 <- [22/+1],       128 , flip( 128) // maxParent:  1223
        .step(  260,  true,  1079,  true)    // 1088:    90 <- [15/+1],       126 , flip(  90) // maxParent:  1090
        .step(  330,  true,  1076,  true)    // 1089:   190 <- [15/+1],       159 , flip( 190) // maxParent:  1090
        .step( 1088,  true,  1089,  true)    // 1090:   190 <- [16/+1],        90 ,       190  // maxParent:  1094
        .step(  456,  true,  1072,  true)    // 1091:   250 <- [15/+1],        15 , flip( 250) // maxParent:  1093
        .step(  467,  true,  1069,  true)    // 1092:    53 <- [15/+1],       221 , flip(  53) // maxParent:  1093
        .step( 1091,  true,  1092,  true)    // 1093:    53 <- [16/+1],       250 ,        53  // maxParent:  1094
        .step( 1090,  true,  1093,  true)    // 1094:    53 <- [17/+1],       190 ,        53  // maxParent:  1102
        .step(  530,  true,  1064,  true)    // 1095:    80 <- [15/+1],        27 , flip(  80) // maxParent:  1097
        .step(  591,  true,  1061,  true)    // 1096:   176 <- [15/+1],       170 , flip( 176) // maxParent:  1097
        .step( 1095,  true,  1096,  true)    // 1097:   176 <- [16/+1],        80 ,       176  // maxParent:  1101
        .step(  601,  true,  1057,  true)    // 1098:   163 <- [15/+1],       145 , flip( 163) // maxParent:  1100
        .step(  610,  true,  1054,  true)    // 1099:    45 <- [15/+1],       101 , flip(  45) // maxParent:  1100
        .step( 1098,  true,  1099,  true)    // 1100:    45 <- [16/+1],       163 ,        45  // maxParent:  1101
        .step( 1097,  true,  1100,  true)    // 1101:    45 <- [17/+1],       176 ,        45  // maxParent:  1102
        .step( 1094,  true,  1101,  true)    // 1102:    45 <- [18/+1],        53 ,        45  // maxParent:  1118
        .step(  642,  true,  1048,  true)    // 1103:    68 <- [15/+1],         2 , flip(  68) // maxParent:  1105
        .step(  671,  true,  1045,  true)    // 1104:   180 <- [15/+1],       169 , flip( 180) // maxParent:  1105
        .step( 1103,  true,  1104,  true)    // 1105:   180 <- [16/+1],        68 ,       180  // maxParent:  1109
        .step(  701,  true,  1041,  true)    // 1106:   242 <- [15/+1],         9 , flip( 242) // maxParent:  1108
        .step(  730,  true,  1038,  true)    // 1107:    74 <- [15/+1],       231 , flip(  74) // maxParent:  1108
        .step( 1106,  true,  1107,  true)    // 1108:    74 <- [16/+1],       242 ,        74  // maxParent:  1109
        .step( 1105,  true,  1108,  true)    // 1109:    74 <- [17/+1],       180 ,        74  // maxParent:  1117
        .step(  739,  true,  1033,  true)    // 1110:   224 <- [15/+1],       103 , flip( 224) // maxParent:  1112
        .step(  746,  true,  1030,  true)    // 1111:    11 <- [15/+1],       211 , flip(  11) // maxParent:  1112
        .step( 1110,  true,  1111,  true)    // 1112:    11 <- [16/+1],       224 ,        11  // maxParent:  1116
        .step(  754,  true,  1026,  true)    // 1113:   162 <- [15/+1],       149 , flip( 162) // maxParent:  1115
        .step(  761,  true,  1023,  true)    // 1114:    25 <- [15/+1],       109 , flip(  25) // maxParent:  1115
        .step( 1113,  true,  1114,  true)    // 1115:    25 <- [16/+1],       162 ,        25  // maxParent:  1116
        .step( 1112,  true,  1115,  true)    // 1116:    25 <- [17/+1],        11 ,        25  // maxParent:  1117
        .step( 1109,  true,  1116,  true)    // 1117:    25 <- [18/+1],        74 ,        25  // maxParent:  1118
        .step( 1102,  true,  1117,  true)    // 1118:    25 <- [19/+1],        45 ,        25  // maxParent:  1150
        .step(  778,  true,  1016,  true)    // 1119:    36 <- [15/+1],        40 , flip(  36) // maxParent:  1121
        .step(  791,  true,  1011,  true)    // 1120:   188 <- [15/+1],       166 , flip( 188) // maxParent:  1121
        .step( 1119,  true,  1120,  true)    // 1121:   188 <- [16/+1],        36 ,       188  // maxParent:  1125
        .step(  805,  true,  1005,  true)    // 1122:   248 <- [15/+1],        28 , flip( 248) // maxParent:  1124
        .step(  818,  true,  1000,  true)    // 1123:    57 <- [15/+1],       228 , flip(  57) // maxParent:  1124
        .step( 1122,  true,  1123,  true)    // 1124:    57 <- [16/+1],       248 ,        57  // maxParent:  1125
        .step( 1121,  true,  1124,  true)    // 1125:    57 <- [17/+1],       188 ,        57  // maxParent:  1133
        .step(  833,  true,   993,  true)    // 1126:    12 <- [15/+1],        16 , flip(  12) // maxParent:  1128
        .step(  846,  true,   988,  true)    // 1127:   186 <- [15/+1],       160 , flip( 186) // maxParent:  1128
        .step( 1126,  true,  1127,  true)    // 1128:   186 <- [16/+1],        12 ,       186  // maxParent:  1132
        .step(  860,  true,   982,  true)    // 1129:   185 <- [15/+1],       164 , flip( 185) // maxParent:  1131
        .step(  873,  true,   977,  true)    // 1130:    29 <- [15/+1],        56 , flip(  29) // maxParent:  1131
        .step( 1129,  true,  1130,  true)    // 1131:    29 <- [16/+1],       185 ,        29  // maxParent:  1132
        .step( 1128,  true,  1131,  true)    // 1132:    29 <- [17/+1],       186 ,        29  // maxParent:  1133
        .step( 1125,  true,  1132,  true)    // 1133:    29 <- [18/+1],        57 ,        29  // maxParent:  1149
        .step(  881,  true,   969,  true)    // 1134:    65 <- [15/+1],       113 , flip(  65) // maxParent:  1136
        .step(  886,  true,   964,  true)    // 1135:   179 <- [15/+1],       151 , flip( 179) // maxParent:  1136
        .step( 1134,  true,  1135,  true)    // 1136:   179 <- [16/+1],        65 ,       179  // maxParent:  1140
        .step(  892,  true,   958,  true)    // 1137:   182 <- [15/+1],       155 , flip( 182) // maxParent:  1139
        .step(  897,  true,   953,  true)    // 1138:    54 <- [15/+1],       122 , flip(  54) // maxParent:  1139
        .step( 1137,  true,  1138,  true)    // 1139:    54 <- [16/+1],       182 ,        54  // maxParent:  1140
        .step( 1136,  true,  1139,  true)    // 1140:    54 <- [17/+1],       179 ,        54  // maxParent:  1148
        .step(  904,  true,   946,  true)    // 1141:   243 <- [15/+1],       114 , flip( 243) // maxParent:  1143
        .step(  909,  true,   941,  true)    // 1142:    46 <- [15/+1],       219 , flip(  46) // maxParent:  1143
        .step( 1141,  true,  1142,  true)    // 1143:    46 <- [16/+1],       243 ,        46  // maxParent:  1147
        .step(  915,  true,   935,  true)    // 1144:   181 <- [15/+1],       157 , flip( 181) // maxParent:  1146
        .step(  920,  true,   930,  true)    // 1145:    75 <- [15/+1],       124 , flip(  75) // maxParent:  1146
        .step( 1144,  true,  1145,  true)    // 1146:    75 <- [16/+1],       181 ,        75  // maxParent:  1147
        .step( 1143,  true,  1146,  true)    // 1147:    75 <- [17/+1],        46 ,        75  // maxParent:  1148
        .step( 1140,  true,  1147,  true)    // 1148:    75 <- [18/+1],        54 ,        75  // maxParent:  1149
        .step( 1133,  true,  1148,  true)    // 1149:    75 <- [19/+1],        29 ,        75  // maxParent:  1150
        .step( 1118,  true,  1149,  true)    // 1150:    75 <- [20/+1],        25 ,        75  // maxParent:  1151
        .step( 1150,  true,  1150, false)    // 1151:    75 <- [21/+1],        75 , flip(  75) // maxParent:  1222
        .step( 1078,  true,   928,  true)    // 1152:    59 <- [15/+1], flip(   4),        59  // maxParent:  1154
        .step( 1075,  true,   933,  true)    // 1153:   189 <- [15/+1], flip( 174),       189  // maxParent:  1154
        .step( 1152,  true,  1153,  true)    // 1154:   189 <- [16/+1],        59 ,       189  // maxParent:  1158
        .step( 1071,  true,   939,  true)    // 1155:   249 <- [15/+1], flip(  67),       249  // maxParent:  1157
        .step( 1068,  true,   944,  true)    // 1156:    82 <- [15/+1], flip( 236),        82  // maxParent:  1157
        .step( 1155,  true,  1156,  true)    // 1157:    82 <- [16/+1],       249 ,        82  // maxParent:  1158
        .step( 1154,  true,  1157,  true)    // 1158:    82 <- [17/+1],       189 ,        82  // maxParent:  1166
        .step( 1063,  true,   951,  true)    // 1159:    43 <- [15/+1], flip(  72),        43  // maxParent:  1161
        .step( 1060,  true,   956,  true)    // 1160:   183 <- [15/+1], flip( 178),       183  // maxParent:  1161
        .step( 1159,  true,  1160,  true)    // 1161:   183 <- [16/+1],        43 ,       183  // maxParent:  1165
        .step( 1056,  true,   962,  true)    // 1162:   175 <- [15/+1], flip( 168),       175  // maxParent:  1164
        .step( 1053,  true,   967,  true)    // 1163:    87 <- [15/+1], flip(   8),        87  // maxParent:  1164
        .step( 1162,  true,  1163,  true)    // 1164:    87 <- [16/+1],       175 ,        87  // maxParent:  1165
        .step( 1161,  true,  1164,  true)    // 1165:    87 <- [17/+1],       183 ,        87  // maxParent:  1166
        .step( 1158,  true,  1165,  true)    // 1166:    87 <- [18/+1],        82 ,        87  // maxParent:  1182
        .step( 1047,  true,   975,  true)    // 1167:    21 <- [15/+1], flip(  83),        21  // maxParent:  1169
        .step( 1044,  true,   980,  true)    // 1168:   187 <- [15/+1], flip( 177),       187  // maxParent:  1169
        .step( 1167,  true,  1168,  true)    // 1169:   187 <- [16/+1],        21 ,       187  // maxParent:  1173
        .step( 1040,  true,   986,  true)    // 1170:     7 <- [15/+1], flip(  89),         7  // maxParent:  1172
        .step( 1037,  true,   991,  true)    // 1171:   127 <- [15/+1], flip( 239),       127  // maxParent:  1172
        .step( 1170,  true,  1171,  true)    // 1172:   127 <- [16/+1],         7 ,       127  // maxParent:  1173
        .step( 1169,  true,  1172,  true)    // 1173:   127 <- [17/+1],       187 ,       127  // maxParent:  1181
        .step( 1032,  true,   998,  true)    // 1174:   246 <- [15/+1], flip(  31),       246  // maxParent:  1176
        .step( 1029,  true,  1003,  true)    // 1175:    33 <- [15/+1], flip( 234),        33  // maxParent:  1176
        .step( 1174,  true,  1175,  true)    // 1176:    33 <- [16/+1],       246 ,        33  // maxParent:  1180
        .step( 1025,  true,  1009,  true)    // 1177:   184 <- [15/+1], flip( 172),       184  // maxParent:  1179
        .step( 1022,  true,  1014,  true)    // 1178:    48 <- [15/+1], flip(  19),        48  // maxParent:  1179
        .step( 1177,  true,  1178,  true)    // 1179:    48 <- [16/+1],       184 ,        48  // maxParent:  1180
        .step( 1176,  true,  1179,  true)    // 1180:    48 <- [17/+1],        33 ,        48  // maxParent:  1181
        .step( 1173,  true,  1180,  true)    // 1181:    48 <- [18/+1],       127 ,        48  // maxParent:  1182
        .step( 1166,  true,  1181,  true)    // 1182:    48 <- [19/+1],        87 ,        48  // maxParent:  1183
        .step( 1182,  true,  1182, false)    // 1183:    48 <- [20/+1],        48 , flip(  48) // maxParent:  1221
        .step(  918,  true,   772,  true)    // 1184:    34 <- [15/+1], flip(  63),        34  // maxParent:  1186
        .step(  913,  true,   785,  true)    // 1185:   173 <- [15/+1], flip( 135),       173  // maxParent:  1186
        .step( 1184,  true,  1185,  true)    // 1186:   173 <- [16/+1],        34 ,       173  // maxParent:  1190
        .step(  907,  true,   799,  true)    // 1187:   235 <- [15/+1], flip(  30),       235  // maxParent:  1189
        .step(  902,  true,   812,  true)    // 1188:     0 <- [15/+1], flip( 197),         0  // maxParent:  1189
        .step( 1187,  true,  1188,  true)    // 1189:     0 <- [16/+1],       235 ,         0  // maxParent:  1190
        .step( 1186,  true,  1189,  true)    // 1190:     0 <- [17/+1],       173 ,         0  // maxParent:  1198
        .step(  895,  true,   827,  true)    // 1191:    10 <- [15/+1], flip(  23),        10  // maxParent:  1193
        .step(  890,  true,   840,  true)    // 1192:   171 <- [15/+1], flip( 129),       171  // maxParent:  1193
        .step( 1191,  true,  1192,  true)    // 1193:   171 <- [16/+1],        10 ,       171  // maxParent:  1197
        .step(  884,  true,   854,  true)    // 1194:   167 <- [15/+1], flip( 133),       167  // maxParent:  1196
        .step(  879,  true,   867,  true)    // 1195:    14 <- [15/+1], flip(  61),        14  // maxParent:  1196
        .step( 1194,  true,  1195,  true)    // 1196:    14 <- [16/+1],       167 ,        14  // maxParent:  1197
        .step( 1193,  true,  1196,  true)    // 1197:    14 <- [17/+1],       171 ,        14  // maxParent:  1198
        .step( 1190,  true,  1197,  true)    // 1198:    14 <- [18/+1],         0 ,        14  // maxParent:  1199
        .step( 1198,  true,  1198, false)    // 1199:    14 <- [19/+1],        14 , flip(  14) // maxParent:  1220
        .step(  758,  true,   628,  true)    // 1200:    51 <- [15/+1], flip(  78),        51  // maxParent:  1202
        .step(  751,  true,   657,  true)    // 1201:   165 <- [15/+1], flip( 138),       165  // maxParent:  1202
        .step( 1200,  true,  1201,  true)    // 1202:   165 <- [16/+1],        51 ,       165  // maxParent:  1206
        .step(  743,  true,   687,  true)    // 1203:   227 <- [15/+1], flip(  66),       227  // maxParent:  1205
        .step(  736,  true,   716,  true)    // 1204:    42 <- [15/+1], flip( 200),        42  // maxParent:  1205
        .step( 1203,  true,  1204,  true)    // 1205:    42 <- [16/+1],       227 ,        42  // maxParent:  1206
        .step( 1202,  true,  1205,  true)    // 1206:    42 <- [17/+1],       165 ,        42  // maxParent:  1207
        .step( 1206,  true,  1206, false)    // 1207:    42 <- [18/+1],        42 , flip(  42) // maxParent:  1219
        .step(  606,  true,   500,  true)    // 1208:    32 <- [15/+1], flip(  85),        32  // maxParent:  1210
        .step(  597,  true,   561,  true)    // 1209:   161 <- [15/+1], flip( 139),       161  // maxParent:  1210
        .step( 1208,  true,  1209,  true)    // 1210:   161 <- [16/+1],        32 ,       161  // maxParent:  1211
        .step( 1210,  true,  1210, false)    // 1211:   161 <- [17/+1],       161 , flip( 161) // maxParent:  1218
        .step(  462,  true,   394,  true)    // 1212:   251 <- [15/+1], flip(  88),       251  // maxParent:  1213
        .step( 1212,  true,  1212, false)    // 1213:   251 <- [16/+1],       251 , flip( 251) // maxParent:  1217
        .step(  324,  true,   324, false)    // 1214:   191 <- [15/+1], flip( 191),       191  // maxParent:  1216
        .step(  254,  true,   254, false)    // 1215:     6 <- [15/+1], flip(   6),         6  // maxParent:  1216
        .step( 1214,  true,  1215,  true)    // 1216:     6 <- [16/+1],       191 ,         6  // maxParent:  1217
        .step( 1213,  true,  1216,  true)    // 1217:     6 <- [17/+1],       251 ,         6  // maxParent:  1218
        .step( 1211,  true,  1217,  true)    // 1218:     6 <- [18/+1],       161 ,         6  // maxParent:  1219
        .step( 1207,  true,  1218,  true)    // 1219:     6 <- [19/+1],        42 ,         6  // maxParent:  1220
        .step( 1199,  true,  1219,  true)    // 1220:     6 <- [20/+1],        14 ,         6  // maxParent:  1221
        .step( 1183,  true,  1220,  true)    // 1221:     6 <- [21/+1],        48 ,         6  // maxParent:  1222
        .step( 1151,  true,  1221,  true)    // 1222:     6 <- [22/+1],        75 ,         6  // maxParent:  1223
        .step( 1087,  true,  1222,  true)    // 1223:     6 <- [23/+1],       128 ,         6  // maxParent:  Infinity
    ;

}();

