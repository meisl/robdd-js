"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

function SlotAllocator(initiallyInUse, maxLenLimit, requestLimit) {
    assert(Number.isInteger(initiallyInUse),
        "arg 0, 'initiallyInUse': expected non-negative integer - got " + util.inspect(initiallyInUse));
    assert(initiallyInUse >= 0,
        "arg 0, 'initiallyInUse': expected non-negative integer - got " + util.inspect(initiallyInUse));
    this._maxLen = initiallyInUse;

    if (maxLenLimit === undefined) maxLenLimit = +Infinity;
    assert(maxLenLimit >= initiallyInUse,
        "arg 1, 'maxLenLimit': expected to be >= arg 0, 'initiallyInUse' - got " + maxLenLimit + " < " + initiallyInUse);
    this._maxLenLimit = maxLenLimit;

    this._usable   = new Array(Math.min(maxLenLimit, 1024));
    this._u = 0; // next free index in _usable
    this._lastUsed = initiallyInUse > 0 ? initiallyInUse - 1 : undefined;

    return this;
};

Object.defineProperties(SlotAllocator.prototype, {
    maxLen:         { get: function () { return this._maxLen;                           } },
    reusableCount:  { get: function () { return this._u;                                } },
    usedCount:      { get: function () { return this.maxLen - this.reusableCount;       } },
    availableCount: { get: function () { return this._maxLenLimit - this.usedCount;  } },
    lastUsed:       { get: function () { return this._lastUsed;                         } },
    get: { value: function () {
        let as = Array.prototype.slice.call(arguments, 0),
            n  = as.length,
            i  = 0;
        // For performance we unfold the first few occurrences of not-yet-seen args
        // which are marked as used-last-this-time. Only from the 3rd such on we
        // have to maintain a lookup-thingy to keep them in (and in the end choose
        // one of them and put the rest into _usable).
        while (i < n) {
            let a = as[i++];
            // TODO: check validity of a
            if (as[i++]) { // got first reusable arg
                while (i < n) {
                    let b = as[i++];
                    if (b !== a) {
                        // TODO: check validity of b
                        if (as[i++]) { // got 2nd reusable arg (different from 1st)
                            while (i < n) {
                                let c = as[i++];
                                if ((c !== a) && (c !== b)) {
                                    // TODO: check validity of c
                                    if (as[i++]) { // got 3rd reusable arg (different from 1st and 2nd)
                                        throw new Error("NYI: 3 or more different reusable args");
                                        // from here on we must keep the args we've seen
                                    }
                                }
                            }
                            //this._usable[this._u++] = b;

                            // or put a into _usable and return b:
                            this._usable[this._u++] = a;
                            return (this._lastUsed = b);
                        }
                    }
                }
                return (this._lastUsed = a);
            }
        }
        if (this._u > 0) {
            return (this._lastUsed = this._usable[--this._u]);
        } else if (this._maxLen < this._maxLenLimit) {
            return (this._lastUsed = this._maxLen++);
        } else {
            throw new Error("ran out of slots - maxLenLimit " + this._maxLenLimit + "reached");
        }
    }},
});

module.exports = {
    init: (initiallyInUse, maxLenLimit, requestLimit) => new SlotAllocator(initiallyInUse, maxLenLimit, requestLimit),
}

