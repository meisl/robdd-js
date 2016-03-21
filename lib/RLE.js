"use strict";

const util   = require('util'),
      stream = require('stream');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;



function makeAccessors(privateThis, prop, opts) {
    let publicThis = Object.getPrototypeOf(privateThis),
        prototype  = Object.getPrototypeOf(publicThis),
        descriptor = Object.getOwnPropertyDescriptor(prototype, prop),
        privateDesc,
        publicDesc;
    ["get" ,"set"].forEach(acc => {
        let vis = opts[acc];
        if (vis === "public") {
            publicDesc = publicDesc || {};
            publicDesc[acc] = descriptor[acc].bind(privateThis)
        }
        if ((vis === "public") || (vis === "private")) {
            privateDesc = privateDesc || {};
            privateDesc[acc] = descriptor[acc].bind(privateThis)
        }
    });
    if (privateDesc) Object.defineProperty(privateThis, prop, privateDesc);
    if (publicDesc) Object.defineProperty(publicThis, prop, publicDesc);
}

function RLE() {
    let privateThis = Object.create(this, {
            publicThis:     { get: () => this,  configurabale: false },
            _codes:         { value: [],        writable: false },
            _encodedLength: { value: 0,         writable: true  },
            _decodedLength: { value: 0,         writable: true  },
            _lastValue:     { value: undefined, writable: true  },  // TODO: do we need _lastValue?
            _maxValue:      { value: undefined, writable: true  },
            _minValue:      { value: undefined, writable: true  },
        });
    makeAccessors(privateThis, "decodedLength", { get: "public", set: "private" });
    makeAccessors(privateThis, "encodedLength", { get: "public", set: "private" });
    makeAccessors(privateThis, "lastCode",      { get: "private" });
    makeAccessors(privateThis, "maxValue",      { get: "public", set: "private" });
    makeAccessors(privateThis, "minValue",      { get: "public", set: "private" });
    Object.defineProperty(this, "codes",     { value: RLE.prototype.codes    .bind(privateThis) });
    Object.defineProperty(this, "add",       { value: RLE.prototype.add      .bind(privateThis) });
    Object.defineProperty(this, "addRepeat", { value: RLE.prototype.addRepeat.bind(privateThis) });
    Object.defineProperty(this, "addAsIs",   { value: RLE.prototype.addAsIs  .bind(privateThis) });
    Object.defineProperty(this, "clear",     { value: RLE.prototype.clear    .bind(privateThis) });
};

Object.defineProperty(RLE.prototype, "decodedLength", {
    get: function ()  { return this._decodedLength;     },
    set: function (v) { return this._decodedLength = v; },
});

Object.defineProperty(RLE.prototype, "lastCode", {
    get: function ()  { return this._codes[this._codes.length - 1]; },
});

Object.defineProperty(RLE.prototype, "encodedLength", {
    get: function () { return this._encodedLength; },
    set: function (v) {
            /*
            let n = 0; {
                for (let c of this.codes()) {
                    if (c.isRepeat) {
                        n += 2;
                    } else {
                        n += c.count + 1;
                    }
                }
            }
            if (v !== n) { // do not evaluate [...this] if not necessary
                assert.same(v, n, "encodedLength for " + [...this.values()] + " / " + util.inspect(this.toJSON()));
            }
            */
            this._encodedLength = v;
            return v;
        },
});

Object.defineProperty(RLE.prototype, "maxValue", {
    get: function ()  { return this._maxValue;     },
    set: function (v) { return this._maxValue = v; },
});

Object.defineProperty(RLE.prototype, "minValue", {
    get: function ()  { return this._minValue;     },
    set: function (v) { return this._minValue = v; },
});

RLE.prototype.codes = function* () {
    let i = 0;
    for (let c of this._codes) {
        // TODO: assert no two repeats with same value in sequence
        // TODO: assert no two asIs s in sequence
        if (c.isRepeat) {
            assert(c.count > 0, "should not happen: repeat with count 0 at " + i + ": " + util.inspect(c));
        } else {
            assert(c.count > 0, "should not happen: asIs with count 0 at " + i + ": " + util.inspect(c));
        }
        yield c;
        i++;
    }
};

RLE.prototype.clear = function () {
    this._codes.length = 0;
    this.decodedLength = 0;
    this.encodedLength = 0;
    return this.publicThis;
};

RLE.prototype.values = function* () {
    for (let c of this.codes()) {
        if (c.isRepeat) {
            let v = c.value,
                n = c.count;
            for (let i = 0; i <n; i++) {
                yield v;
            }
        } else {
            yield* c.values;
        }
    }
}

function Repeat(count, value) {
    this.count = count;
    this.value = value;
    return this;
}
Object.defineProperties(Repeat.prototype, {
    isRepeat:  { value: true                                },
    lastValue: { get:   function () { return this.value; }  },
});

function AsIs() {
    this.values = [...arguments];
    return this;
}
Object.defineProperties(AsIs.prototype, {
    isRepeat:  { value: false                                                           },
    count:     { get:   function () { return this.values.length; }                    },
    lastValue: { get:   function () { return this.values[this.values.length - 1]; }   },
});

RLE.prototype.addRepeat = function (count, value) {
    let code = new Repeat(count, value);
    assert(count > 1, "should not happen: repeat with count < 2 at " + (this._codes.length - 1) + ": " + util.inspect(code));
    this._codes.push(code);
    this.decodedLength += count;
    this.encodedLength += 2;
};

RLE.prototype.addAsIs = function () {
    let count = arguments.length,
        code  = new AsIs(...arguments);
    assert(count > 0, "should not happen: asIs with count 0 at " + (this._codes.length - 1) + ": " + util.inspect(code));
    this._codes.push(code);
    this.decodedLength += count;
    this.encodedLength += count + 1;
};

RLE.prototype.popCode = function () {
    if (this._codes.length === 0) {
        throw new Error("cannot pop code - there is none");
    }
    let code = this._codes.pop(),
        count = code.count;
    this.decodedLength -= count;
    this.encodedLength -= code.isRepeat ? 2 : count + 1;
    return code;
};

RLE.prototype.add = function (x) {
    if (this.decodedLength === 0) {
        this.addAsIs(x);
        this.maxValue = x;
        this.minValue = x;
    } else {
        let c    = this.lastCode,
            last = c.lastValue,
            k    = c.count;
        if (last === x) {
            if (c.isRepeat) {
                c.count++;
                this.decodedLength++;
            } else { // c is an asIs
                switch (k) {
                    case 1:
                        this.popCode();
                        break;
                    case 2:
                        c.values.pop();
                        this.decodedLength--;
                        this.encodedLength--;
                        break;
                    case 3:
                        if (c.values[0] === c.values[1]) { // we might have merged a repeat 2 into there
                            this.popCode();
                            this.addRepeat(2, c.values[0]);
                        } else {
                            c.values.pop();
                            this.decodedLength--;
                            this.encodedLength--;
                        }
                        break;
                    default: // count > 3
                        // a test like in count = 3 ain't worth it, since we cannot get rid of the whole asIs
                        c.values.pop(); // so just remove the last value (-1)
                        this.decodedLength--;
                        this.encodedLength--;
                }
                this.addRepeat(2, x);
            }
        } else { // last !== x
            this.maxValue = Math.max(this.maxValue, x);
            this.minValue = Math.min(this.minValue, x);
            if (c.isRepeat) {
                if (k === 2) {
                    this.popCode();    // remove c; then merge its contents and x into an asIs instead
                    let b = this.lastCode;
                    if ((b === undefined) || b.isRepeat) { // cannot merge with that
                        this.addAsIs(last, last, x);
                    } else { // b is an asIs - push contents from c and x there
                        b.values.push(last, last, x);
                        this.decodedLength += 3;
                        this.encodedLength += 3;
                    }
                } else { // c.count > 2
                    this.addAsIs(x);
                }
            } else { // c is an asIs
                c.values.push(x);
                this.decodedLength++;
                this.encodedLength++;
            }
        }
    }
};

RLE.prototype.reduceCodes = function (onRepeat, onAsIs) {
    let acc = [];
    for (let c of this.codes()) {
        if (c.isRepeat) {
            acc = onRepeat(acc, c.count, c.value);
        } else {
            acc = onAsIs(acc, c.values.slice(0));
        }
    }
    return acc;
}

RLE.prototype.toString = function () {
    return JSON.stringify(this.reduceCodes(
        (acc, c, v) => { acc.push([c, v]); return acc; },
        (acc, vs)   => { acc.push(...vs);  return acc; }
    ));
};

RLE.prototype.inspect = function () {
    return this.reduceCodes(
        (acc, c, v) => { acc.push([c, v]); return acc; },
        (acc, vs)   => { acc.push(...vs);  return acc; }
    );
};

RLE.prototype.toJSON = function () {
    return this.reduceCodes( // let's have encodings of repeat(1, x) and asIs(x) coincide as [0, x]
        (acc, c, v) => { acc.push(1 - c, v);             return acc; },
        (acc, vs)   => { acc.push(vs.length - 1, ...vs); return acc; }
    );
};

function fromJSON(x) {
    if (util.isString(x)) {
        return fromJSON(JSON.parse(x));
    }
    if (!util.isArray(x)) {
        throw new TypeError("expected JSON text or array - got " + util.inspect(x));
    }
    let rle = new RLE(),
        i = 0,
        n = x.length;
    while (i < n) {
        let k = x[i++];
        if (k < 0) {
            // TODO: assert i < n
            rle.addRepeat(1 - k, x[i++]);
        } else {
            let end = k + 1 + i;
            // TODO: assert k <= n
            rle.addAsIs(...x.slice(i, end));
            i = end;
        }
    }
    return rle;
};

function inflateFromInts() {
    let inRepeat = false,
        k        = null,
        result   = new stream.Transform({
            objectMode: true,
            transform: function(x, encoding, next) {
                let v;
                //console.log("transform called: k=" + k + ", x:" + util.inspect(x));
                if (k === null) {
                    if (inRepeat = (x < 0)) {
                        k = 1 - x;
                    } else {
                        k = x + 1;
                    }
                } else {
                    if (inRepeat) {
                        let more;
                        while (k > 0) {
                            more = this.push(x);
                            console.log("inflateFromInts.push(" + x + ") = " + more);
                            k--;
                        }
                        k = null;
                    } else {
                        let more = this.push(x);
                        console.log("inflateFromInts.push(" + x + ") = " + more);
                        if (--k === 0) {
                            k = null;
                        }
                    }
                }
                next();
            },
            flush: function(done) {
                let e = null;
                if (k === null) {
                    this.emit('end');
                } else {
                    if (inRepeat) {
                        e = new Error("missing value to repeat " + k + " times");
                    } else {
                        e = new Error("missing " + k + " more as-is values");
                    }
                    this.emit('error', e);
                }
                done(e);
            }
        });
    return result;
}

module.exports = {
    init:       function () {
                    let rle = new RLE();
                    for (let i = 0; i < arguments.length; i++) {
                        let a = arguments[i];
                        if (util.isArray(a)) {
                            a.forEach(x => rle.add(x));
                        } else {
                            rle.add(a);
                        }
                    }
                    return rle;
                },
    fromJSON:   fromJSON,
    inflateFromInts: inflateFromInts,
};
