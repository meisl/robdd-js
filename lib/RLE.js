"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

function RLE() {
    this.codes = [];
    this.decodedLength = 0;
    //this.encodedLength = 0;

    let encodedLength = 0;
    Object.defineProperty(this, "encodedLength", {
        get: function() { return encodedLength; },
        set: function(v) {
            let n = 0; {
                for (let c of this.codes) {
                    if (c.isRepeat) {
                        n += 2;
                    } else {
                        n += c.count + 1;
                    }
                }
            }
            if (v !== n) { // do not evaluate [...this] if not necessary
                assert.same(v, n, "encodedLength for " + [...this]);
            }
            encodedLength = v;
            return encodedLength;
        },
    });
}

function repeat(count, x) {
    return Object.create(null, {
        count:    { value: count, enumerable: true, writable: true },
        value:    { value: x,     enumerable: true                 },
        isRepeat: { value: true,  enumerable: false                },
    });
}

function asIs() {
    return Object.create(null, {
        values: { value: [...arguments],                            enumerable: true },
        count:  { get:   function () { return this.values.length }, enumerable: true },
    });
}

RLE.prototype.add = function (x) {
    let codes = this.codes,
        i     = codes.length - 1,
        n;  // how much to increase encodedLength
    if (i < 0) {
        codes.push(asIs(x));
        n = 2;
    } else {
        let last = this.last,
            c    = codes[i];
        if (last === x) {
            if (c.isRepeat) {
                assert(c.count > 1, "should not happen: repeat with count < 2 at " + i + ": " + util.inspect(c));
                c.count++;
                n = 0;
            } else { // c is an asIs
                assert(c.count > 0, "should not happen: asIs with count 0 at " + i + ": " + util.inspect(c));
                if (c.count === 1) {
                    codes.pop();
                    n = 0; // together with the codes.push below
                } else {
                    c.values.pop();
                    n = 1; // together with the codes.push below
                }
                codes.push(repeat(2, x));
            }
        } else { // last !== x
            if (c.isRepeat) {
                assert(c.count > 1, "should not happen: repeat with count < 2 at " + i + ": " + util.inspect(c));
                if (c.count === 2) {
                    codes.pop();    // remove c; merge its contents and x into an asIs instead
                    if (i > 0) { // there is an item before c
                        let b = this.codes[i - 1];
                        if (b.isRepeat) { // cannot merge with that <<<< TODO: what if that is only 2x as well?
                            codes.push(asIs(last, last, x));
                            n = 2; // together with the codes.pop above
                        } else { // b is an asIs - push contents from c and x there
                            b.values.push(last, last, x);
                            n = 1; // together with the codes.pop above
                        }
                    } else { // c was the very first item
                        codes.push(asIs(last, last, x));
                        n = 2; // together with the codes.pop above
                    }
                } else { // c.count > 2
                    codes.push(asIs(x));
                    n = 2;
                }
            } else { // c is an asIs
                c.values.push(x);
                n = 1;
            }
        }
    }
    this.last = x;
    this.decodedLength++;
    this.encodedLength += n;
};

RLE.prototype[Symbol.iterator] = function* () {
    for (let c of this.codes) {
        let i = 0,
            n = c.count;
        if (c.isRepeat) {
            while (i < n) {
                yield c.value;
                i++;
            }
        } else {
            while (i < n) {
                yield c.values[i];
                i++;
            }
        }
    }
}

RLE.prototype.toJSON = function () {
    let result = [],
        i = 0;
    for (let c of this.codes) {
        // TODO: assert no two repeats with same value in sequence
        // TODO: assert no two asIs s in sequence
        if (c.isRepeat) {
            assert(c.count > 0, "should not happen: repeat with count 0 at " + i + ": " + util.inspect(c));
            let x = {};
            x[c.count + "x"] = c.value;
            result.push(x);
        } else {
            assert(c.count > 0, "should not happen: asIs with count 0 at " + i + ": " + util.inspect(c));
            result.push(c.values);
        }
        i++;
    }
    return result;
};


module.exports = {
    init: function () { return new RLE() },
};
