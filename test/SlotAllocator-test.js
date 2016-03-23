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

    test.init([0,1], { maxLenLimit: 12, title: "4-bit-addition (bad variable ordering, size 111, height 12): bitstr('x', 4).plus(bitstr('y', 4)).eq(bitstr('z', 4))" })
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

    test.init([0,1], { maxLenLimit: 3, title: "4-bit-addition (good variable ordering, size 32, height 12)" })
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

}();

