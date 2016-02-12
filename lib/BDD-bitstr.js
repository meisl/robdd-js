"use strict";

var util   = require('util');
var assert = require('assert');

const BDD = require('./BDD'),
      T   = BDD.True,
      F   = BDD.False,
      ite = BDD.ite,
      xor = BDD.xor,
      eqv = BDD.eqv,
      and = BDD.and,
      or  = BDD.or;



function BitStr(length) {
    Array.call(this, length);
    this.length = length;
}

util.inherits(BitStr, Array);

BitStr.prototype.eqv = function (bs) {
    var result = BDD.True,
        bitLen = this.length;
    if (bitLen !== bs.length) {
        throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + bs.length);
    }
    for (let i = 0; i < bitLen; i++) {
        result = result.and(this[i].eqv(bs[i]));
    }
    return result;
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
        carry  = BDD.False;
    for (let i = 0, phi; i < bitLen; i++, k >>>= 1) {
        if (k & 1) {
            sum[i] = carry.eqv(this[i]);
            carry = carry.or(this[i]);
        } else {
            sum[i] = carry.xor(this[i]);
            carry = carry.and(this[i]);
        }
    }
    // TODO: sum.eqv  = function (xs) { return carry.not().and(bitstr_eqv(this, xs)) };
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
        sum[i] = carry.xor(a).xor(b);           // sum[i]    = 1  <=>  nr of 1s in {this[i], bs[i], carry} is odd
        carry = carry.ite(a.or(b), a.and(b));   // carry-out = 1  <=>  nr of 1s in {this[i], bs[i], carry} is two or three
    }
    // TODO: sum.eqv  = function (xs) { return carry.not().and(bitstr_eqv(this, xs)) };
    // TODO: sum.plus = function (k)  { return bitstr_plus(this, k) };
    return sum;
}

function bitstr(nrOrStr, length) {
    const result = new BitStr(length);
    let   next;
    if (util.isNumber(nrOrStr)) {
        const k    = nrOrStr;
        let   mask = 1;
        for (let i = 0; i < length; i++, mask <<= 1) {
            result[i] = k & mask ? T : F;
        }
        next = result;
    } else {
        const prefix = nrOrStr;
        next = new BitStr(length);
        for (let i = 0; i < length; i++) {
            let label = prefix + i;
            result[i] = BDD.var(label      );
            next[i]   = BDD.var(label + "'");
        }
    }

    result.next = next;
    next.before = result;
    return result;
}


module.exports = Object.assign({
    bitstr: bitstr,
}, BDD);
