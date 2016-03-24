"use strict";

var util   = require('util');
var pa     = require('pimped-assert'),
    assert = pa.assert,
    refute = pa.refute;

const BDD = require('./BDD'),
      T   = BDD.True,
      F   = BDD.False,
      ite = BDD.ite,
      not = BDD.not,
      and = BDD.and,
      or  = BDD.or,
      eqv = BDD.eqv,
      xor = BDD.xor,
      imp = BDD.imp;


function BitStr(length) {
    Array.call(this, length);
    this.length = length;
}

util.inherits(BitStr, Array);

BitStr.prototype.zip    = function (bs) { return zip(this, bs) };
BitStr.prototype.reduce = function (callback, initialValue) {
    const bitLen  = this.length,
          gotInit = arguments.length === 2;
    let   acc,
          i;
    if (gotInit) {
        acc = initialValue;
        i = 0;
    } else {
        acc = this[0];
        i = 1;
    }
    while(i < bitLen) {
        acc = callback(acc, this[i]);
        i++;
    }
    return acc;
};

const zip_proto = {
    map: function (callback) {
        if (!util.isFunction(callback)) {
            throw new TypeError("expected a callback function - got " + util.inspect(callback));
        }
        let result = new BitStr(this.colCount),
            i = 0;
        for (let cbArgs of this.columns) {
            result[i++] = callback.apply(null, cbArgs);
        }
        return result;
    },
    reduce: function (callback, initialValue) {
        if (!util.isFunction(callback)) {
            throw new TypeError("expected a callback function - got " + util.inspect(callback));
        }
        let acc = initialValue;
        for (let cbArgs of this.columns) {
            acc = callback(acc, ...cbArgs);
        }
        return acc;
    },
    /*
    reduce: function (callback, initialValue) {
        if (!util.isFunction(callback)) {
            throw new TypeError("expected a callback function - got " + util.inspect(callback));
        }
        let acc    = initialValue,
            cbArgs = new Array(this.rowCount + 1);
        for (let k = 0; k < this.colCount; k++) {
            cbArgs[0] = acc;
            for (let i = 0, j = 1; i < this.rowCount; i++, j++) {
                cbArgs[j] = this.rows[i][k];
            }
            acc = callback.apply(null, cbArgs);
        }
        return acc;
    },
    */
};
Object.defineProperty(zip_proto, "rowCount", {
    get: function () { return this.rows.length }
});
Object.defineProperty(zip_proto, "colCount", {
    get: function () { return this.rows[0].length }
});
Object.defineProperty(zip_proto, "columns", {
    get: function* () {
        for (let k = 0; k < this.colCount; k++) {
            let column = new Array(this.rowCount);
            for (let i = 0; i < this.rowCount; i++) {
                column[i] = this.rows[i][k];
            }
            yield column;
        }
    }
});

function zip() {
    const rows = Array.prototype.slice.call(arguments, 0),
          n    = rows.length;
    if (n === 0) {
        throw new TypeError("expected at least one bitstr");
    }
    let   bitLen = -1,
          ks     = [],
          result;
    for (let i = 0; i < n; i++) {
        let bs = rows[i];
        if (util.isNumber(bs)) {
            ks.push(i);
        } else if (bitLen < 0) {
            bitLen = bs.length;
        } else if (bs.length !== bitLen) {
            throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
        }
    }
    if (bitLen < 0) {
        throw new Error("expected at least one bitstr - got only int constants");
    }
    ks.forEach(i => rows[i] = bitstr(rows[i], bitLen));

    result = Object.create(zip_proto, {
        rows:       { value: rows,   enumerable: true },
    });

    return result;
}


BitStr.prototype.eq  = function (bs) { return and.apply(null, zip(this, bs).map(eqv)); };
BitStr.prototype.neq = function (bs) { return or .apply(null, zip(this, bs).map(xor)); };
BitStr.prototype.lt  = function (bs) { return zip(this, bs).reduce((acc, a, b) => ite(xor(a, b), b, acc), F); };
BitStr.prototype.lte = function (bs) { return zip(this, bs).reduce((acc, a, b) => ite(xor(a, b), b, acc), T); };
BitStr.prototype.gt  = function (bs) { return zip(bs, this).reduce((acc, a, b) => ite(xor(a, b), b, acc), F); };
BitStr.prototype.gte = function (bs) { return zip(bs, this).reduce((acc, a, b) => ite(xor(a, b), b, acc), T); };


BitStr.prototype.plus = function (x) {
    switch (typeof x) {
        case "number": return this.plusK(x);
        case "object":
            if (this.length !== x.length) {
                throw new TypeError("bitstrs must have same length - got " + this.length + " !== " + x.length);
            }
            return this.plusBitStr(x);
    }
    throw new Error("expected either an int or a bitstr");
};

BitStr.prototype.plusK = function (k) {
    var bitLen = this.length,
        sum    = new BitStr(bitLen),
        carry  = F;
    for (let i = 0; i < bitLen; i++, k >>>= 1) {
        if (k & 1) {
            sum[i] = eqv(carry, this[i]);
            carry  = or( carry, this[i]);
        } else {
            sum[i] = xor(carry, this[i]);
            carry  = and(carry, this[i]);
        }
    }
    // TODO: sum.eq   = function (xs) { return carry.not.and(bitstr_eq(this, xs)) };
    // TODO: sum.plus = function (k)  { return bitstr_plus(this, k) };
    return sum;
};

BitStr.prototype.plusBitStr = function (bs) {
    var bitLen = bs.length,
        sum    = new BitStr(bitLen),
        carry  = BDD.False;
    for (let i = 0, a, b; i < bitLen; i++) {
        a = this[i];
        b = bs[i];
        sum[i] = ite(carry, eqv(a, b), xor(a, b));  // sum[i]    = 1  <=>  nr of 1s in {this[i], bs[i], carry} is odd
        carry  = ite(carry, or( a, b), and(a, b));  // carry-out = 1  <=>  nr of 1s in {this[i], bs[i], carry} is two or three
    }
    // TODO: sum.eq  = function (xs) { return carry.not.and(bitstr_eq(this, xs)) };
    // TODO: sum.plus = function (k)  { return bitstr_plus(this, k) };
    return sum;
}

function bitstr_from_int_constant(k, length) {
    const result = new BitStr(length);
    let   mask = 1;
    for (let i = 0; i < length; i++, mask <<= 1) {
        result[i] = k & mask ? T : F;
    }
    result.next   = result;
    result.before = result;
    return result;
}

function bitstr_from_str_prefix(prefix, bitLen) {
    assert.typeof(prefix, "string");
    assert.typeof(bitLen, "number");
    assert.same(arguments.length, 2);

    const result = new BitStr(bitLen),
          next   = new BitStr(bitLen);
    for (let i = 0; i < bitLen; i++) {
        let label = prefix + i;
        result[i] = BDD.var(label      );
        next[i]   = BDD.var(label + "'");
    }
    result.next = next;
    next.before = result;
    return result;
}

function bitstr_from_str_suffix(suffix, bitLen) {
    assert.typeof(suffix, "string");
    assert.typeof(bitLen, "number");
    assert.same(arguments.length, 2);

    const result = new BitStr(bitLen),
          next   = new BitStr(bitLen);
    for (let i = 0; i < bitLen; i++) {
        let label = i + suffix;
        result[i] = BDD.var(label      );
        next[i]   = BDD.var(label + "'");
    }
    result.next = next;
    next.before = result;
    return result;
}

function bitstr_from_BDDs() {
    const length = arguments.length,
          result = new BitStr(length);
    for (let i = 0; i < length; i++) {
        result[i] = arguments[i];
    }
    return result;
}

function bitstr(a, b) {
    const n = arguments.length;
    switch (n) {
        case 0:
            break;
        case 2:
            if (util.isNumber(a) && util.isString(b)) {
                return bitstr_from_str_suffix(b, a);
            } else if (util.isString(a) && util.isNumber(b)) {
                return bitstr_from_str_prefix(a, b);
            } else if (util.isNumber(a) && util.isNumber(b)) {
                return bitstr_from_int_constant(a, b);
            }
            // yes, fall-through!
        default:
            if ([...arguments].every(BDD.isBDD)) {
                return bitstr_from_BDDs(...arguments);
            }
    }
    throw new Error("invalid args: " + util.inspect(arguments));
}


module.exports = Object.assign({
    bitstr: bitstr,
    zip:    zip,
}, BDD);
