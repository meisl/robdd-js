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

function insist_inUse(self, slot, i) {
    if ((slot >= 0) && (slot < self.maxLen)) {
        let k = self._usable.indexOf(slot);
        if ((k < 0) || (k >= self._u)) { // ensure it's not contained in self._usable
            return slot;
        }
    }
    throw new Error(
        "invalid arg" + i + " = " + slot
        + ": currently not used / maxLen: " + self.maxLen
        + " / usable: " + JSON.stringify(self._usable.slice(0, self._u))
    );
}

function giveOut(self, slot) {
    // TODO: (maybe) check that slot is actually usable (or maxLen if usable is empty), wrt. self
    return (self._lastUsed = slot);
}

function recycle(self, slot) {
    // TODO: (maybe) check that slot is actually used, wrt. self
    self._usable[self._u++] = slot;
    return self;
}

function popUsable(self) {
    // TODO: make sure self._usable is not empty
    return self._usable[--self._u];
}

Object.defineProperties(SlotAllocator.prototype, {
    maxLen:         { get: function () { return this._maxLen;                           } },
    reusableCount:  { get: function () { return this._u;                                } },
    usedCount:      { get: function () { return this.maxLen - this.reusableCount;       } },
    availableCount: { get: function () { return this._maxLenLimit - this.usedCount;     } },
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
            let a = as[i];
            insist_inUse(this, a, i); // check validity of a
            i++;
            if (as[i++]) { // got first reusable arg
                while (i < n) {
                    let b = as[i];
                    if (b === a) {
                        i++;
                    } else {
                        insist_inUse(this, b, i); // check validity of b
                        i++;
                        if (as[i++]) { // got 2nd reusable arg (different from 1st)

                            if (i < n) {
                                let seen = { [a]: true, [b]: true },
                                    c, seen_c;
                                do {
                                    c = as[i];
                                    seen_c = seen[c];
                                    if (seen_c === undefined) {
                                        insist_inUse(this, c, i);
                                        i++;
                                        seen_c = as[i++] || false; // make sure not to write undefined
                                    } else if (seen_c) { // truthy
                                        i += 2; // can ignore reusable flag for this in as
                                    } else { // seen_c falsey
                                        i++;
                                        seen_c = as[i++] || false; // make sure not to write undefined
                                    }
                                } while (i < n);
                                // choose one key in seen with true value as return value,
                                // recycle the rest (of those with true)
                                delete seen[a];
                                for (k in seen) {
                                    if (seen[k]) {
                                        recycle(this, k);
                                    }
                                }
                                return giveOut(this, a);
                            } else { // no more args
                                /* put b into _usable and return a: */
                                //recycle(this, b); return giveOut(this, a);
                                /* or put a into _usable and return b: */
                                recycle(this, a); return giveOut(this, b);
                            }
                        }
                    }
                }
                return giveOut(this, a);
            }
        }
        if (this._u > 0) {
            return giveOut(this, popUsable(this));
        } else if (this._maxLen < this._maxLenLimit) {
            return giveOut(this, this._maxLen++);
        } else {
            throw new Error("ran out of slots - maxLenLimit " + this._maxLenLimit + "reached");
        }
    }},
});

module.exports = {
    init: (initiallyInUse, maxLenLimit, requestLimit) => new SlotAllocator(initiallyInUse, maxLenLimit, requestLimit),
}

