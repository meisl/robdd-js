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

