"use strict";

var util   = require('util');
var assert = require('assert');

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

BitStr.prototype.zip = function (bs) {
    const bitLen = this.length;
    if (util.isNumber(bs)) {
        bs = bitstr(bs, bitLen);
    } else if (bitLen !== bs.length) {
        throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
    }
    return {
        map: callback => mapOver(callback, this, bs),
    };
};

function mapOver(callback) {
    if (!util.isFunction(callback)) {
        throw new TypeError("expected a callback function - got " + util.inspect(callback));
    }
    const bitstrs  = Array.prototype.splice.call(arguments, 1),
          n        = bitstrs.length,
          cbArgs   = new Array(n);
    let   bitLen   = -1,
          ks       = [],
          result;
    for (let i = 0; i < n; i++) {
        let bs = bitstrs[i];
        if (util.isNumber(bs)) {
            ks.push(i);
        } else if (bitLen < 0) {
            bitLen = bs.length;
        } else if (bs.length !== bitLen) {
            throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
        }
    }
    if (bitLen < 0) {
        throw new Error("");
    }
    ks.forEach(i => bitstrs[i] = bitstr(bitstrs[i], bitLen));

    result = new BitStr(bitLen);
    for (let i = 0; i < bitLen; i++) {
        for (let k = 0; k < n; k++) {
            cbArgs[k] = bitstrs[k][i];
        }
        result[i] = callback.apply(null, cbArgs);
    }
    return result;
}

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


BitStr.prototype.eq  = function (bs) { return and.apply(null, mapOver(eqv, this, bs)); };
BitStr.prototype.neq = function (bs) { return                 mapOver(xor, this, bs).reduce(or ); };


BitStr.prototype.eq2 = function (bs) {
    const bitLen = this.length;
    if (util.isNumber(bs)) {
        bs = bitstr(bs, bitLen);
    } else if (bitLen !== bs.length) {
        throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
    }
    let acc = T;
    for (let i = 0; i < bitLen; i++) {
        acc = acc.and(this[i].eqv(bs[i]));
        //acc = this[i].eqv(bs[i]).and(acc);
        //acc = this[i].ite(acc.and(bs[i]), acc.and(bs[i].not));
        //acc = this[i].ite(bs[i].and(acc), bs[i].not.and(acc));

    }
    return acc;
};

BitStr.prototype.neq2 = function (bs) {
    return this.eq2(bs).not;
};

BitStr.prototype.lt = function (bs) {
    const bitLen = this.length;
    if (util.isNumber(bs)) {
        bs = bitstr(bs, bitLen);
    } else if (bitLen !== bs.length) {
        throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
    }
    let acc = F;    // T for lte
    for (let i = 0; i < bitLen; i++) {
        acc = ite(xor(this[i], bs[i]), bs[i], acc);
    }
    return acc;
};

BitStr.prototype.lte = function (bs) {
    const bitLen = this.length;
    if (util.isNumber(bs)) {
        bs = bitstr(bs, bitLen);
    } else if (bitLen !== bs.length) {
        throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
    }
    let acc = T;    // F for lt
    for (let i = 0; i < bitLen; i++) {
        acc = ite(xor(this[i], bs[i]), bs[i], acc);
    }
    return acc;
};

BitStr.prototype.gt = function (bs) {
    return this.lte(bs).not;
};

BitStr.prototype.gte = function (bs) {
    return this.lt(bs).not;
};

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
    for (let i = 0, phi; i < bitLen; i++, k >>>= 1) {
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

function bitstr_from_str_prefix(prefix, length) {
    const result = new BitStr(length),
          next   = new BitStr(length);
    for (let i = 0; i < length; i++) {
        let label = prefix + i;
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
    if (util.isNumber(b)) {
        if (n === 2) {
            if (util.isNumber(a)) {
                return bitstr_from_int_constant(a, b);
            } else if (util.isString(a)) {
                return bitstr_from_str_prefix(a, b);
            }
        }
    } else if (Array.prototype.every.call(arguments, a => (a.constructor && a.constructor.name === "BDD"))) {
        return bitstr_from_BDDs.apply(null, arguments);
    }
    throw new Error("invalid args: " + util.inspect(arguments));
}


module.exports = Object.assign({
    bitstr: bitstr,
}, BDD);
