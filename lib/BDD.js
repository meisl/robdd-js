"use strict";

var util   = require('util');
var assert = require('assert');


var BDD = (() => {
    const store = {},
          iteCalls  = { terminal: 0, var: 0, irrelevantHead: 0, short: 0, other: 0 };
    var   True,
          False,
          instCount = 2,
          getCalls  = 0,
          notCalls  = 0,
          andCalls  = 0,
          orCalls   = 0,
          eqvCalls  = 0,
          xorCalls  = 0,
          sizeCalls = 0;

    const error = msg => { throw new Error(msg) };

    const isTerminal = bdd => (bdd === True) || (bdd === False);

    const bothTerminal = (p, q) => isTerminal(p) && isTerminal(q);

    const isVar = bdd => !isTerminal(bdd) && bothTerminal(bdd.onTrue, bdd.onFalse);

    const inspect = bdd => isTerminal(bdd)
        ? (bdd === True ? "TRUE" : "FALSE")
        : (isVar(bdd)
            ? (bdd.onTrue === True ? bdd.label : '!' + bdd.label)
            : { l: bdd.label, t: bdd.onTrue, e: bdd.onFalse }
        )
    ;

    function get(label, onTrue, onFalse) {
        // refute.same(onTrue, onFalse);
        // assert(isTerminal(onTrue)  || label < onTrue.label);
        // assert(isTerminal(onFalse) || label < onFalse.label);
        var bdd;
        getCalls++;
        if (onTrue === onFalse) {
            return onTrue;
            assert(onTrue !== onFalse);
        }
        let xs = store[label];
        if (xs) {
            let i = 0;
            while (i < xs.length && !bdd) {
                bdd = xs[i++];
                if (bdd.onTrue !== onTrue || bdd.onFalse !== onFalse) {
                    bdd = null;
                }
            }
            if (!bdd) {
                bdd = BDD(label, onTrue, onFalse);
                xs.push(bdd);
                xs.push(bdd.neg);
            }
        } else {
            bdd = BDD(label, onTrue, onFalse);
            store[label] = [bdd, bdd.neg];
        }
        return bdd;
    }

    const headLabel = (c, p, q) => isTerminal(c)
        ? error("1st arg must not be terminal - got " + c)
        : ((isTerminal(p) || c.label < p.label)
            ? /* c.label == min(c.label, p.label) */ (isTerminal(q) || c.label < q.label ? c.label : q.label)
            : /* p.label == min(c.label, p.label) */ (isTerminal(q) || p.label < q.label ? p.label : q.label)
        );

    function ite(c, p, q) {
        if (c === True) {
            iteCalls.terminal++;
            return p;
        } else if (c === False) {
            iteCalls.terminal++;
            return q;
        } else if (c === p) {
            iteCalls.short++;
            return ite(c, True, q);
        } else if (c === p.not) {
            iteCalls.short++;
            return ite(c, False, q);
        } else if (c === q) {
            iteCalls.short++;
            return ite(c, p, False);
        } else if (c === q.not) {
            iteCalls.short++;
            return ite(c, p, True);
        } else if (p === q) {
            iteCalls.irrelevantHead++;
            return q;
        } else if (bothTerminal(p, q)) {
            iteCalls.short++;
            return (p === True) ? c : c.not;
        } else {
            iteCalls[c.isVar ? "var" : "other"]++;
            let l = headLabel(c, p, q);
            switch ( (c.label === l ? 4 : 0) + (p.label === l ? 2 : 0) + (q.label === l ? 1 : 0) ) {
                case 0: /* 000 */ throw new Error("should not happen");
                case 1: /* 001 */ return get(l, ite(c,        p,        q.onTrue), ite(c,         p,         q.onFalse));
                case 2: /* 010 */ return get(l, ite(c,        p.onTrue, q       ), ite(c,         p.onFalse, q        ));
                case 3: /* 011 */ return get(l, ite(c,        p.onTrue, q.onTrue), ite(c,         p.onFalse, q.onFalse));
                case 4: /* 100 */ return get(l, ite(c.onTrue, p,        q       ), ite(c.onFalse, p,         q        ));
                case 5: /* 101 */ return get(l, ite(c.onTrue, p,        q.onTrue), ite(c.onFalse, p,         q.onFalse));
                case 6: /* 110 */ return get(l, ite(c.onTrue, p.onTrue, q       ), ite(c.onFalse, p.onFalse, q        ));
                case 7: /* 111 */ return get(l, ite(c.onTrue, p.onTrue, q.onTrue), ite(c.onFalse, p.onFalse, q.onFalse));
            }
        }
    }


    const byLabel = (p, q) => {
        if (p.isTerminal) {
            if (p === q) {
                return 0;
            } else if (q === True) {
                return -1;
            }
            return 1;
        } else if (q.isTerminal) {
            return -1;
        } else if (p.label === q.label) {
            return 0;
        }
        return p.label < q.label ? -1 : 1;
    };

    const and_arr = function (cs, begin, end) {
        andCalls++;
//        console.log("and_arr([" + cs.map(x => x.toIteStr()).join(', ') + "])");
        begin = (begin === undefined) ? 0         : begin;
        end   = (end   === undefined) ? cs.length : end;
        let n = end - begin,
            min,
            lo = -1,
            i  = begin;
        while (i < end) { // to start with, find first non-terminal conjunct
            min = cs[i++];
            if (min === False) {
//                console.log(" --> F");
                return False;
            } else if (min !== True) {  // min is the first non-terminal conjunct, i points after it in cs
                lo = end - i; // lo is now the nr of remaining conjuncts (excl. min itself)
                break;
            }
        }
        if (lo === -1) {  // all cs were True (or cs was empty)
//            console.log(" --> T");
            return True;
        } else if (lo === 0) {  // only one non-terminal conjunct
//            console.log(" --> " + min.toIteStr());
            return min;         // ...which is min
//        } else if (lo === 1) {  // exactly two conjuncts  (TODO: find out wether this is worth it)
//            return and2(min, cs[i]);
        }
//        console.log({ begin: begin, lo: lo, i: i, end: end, n: n });
        let minLabel = min.label,
            ds       = new Array(2 * lo + 1),   // enough room on both, the left and right, to put the remaining conjuncts in
            k        = lo + 1,  // k points after the last conjunct in ds *with min label*
            hi       = k,       // hi points after the last conjunct of all in ds
            top      = min,
            c;
        ds[lo] = min;
        while (i < end) {
            c = cs[i++];
            if (c === False) {
                return False;
            } else if ((c !== True) && (c !== min)) {
                let cLabel = c.label;
                if (cLabel < minLabel) {
                    k = lo;
                    minLabel = cLabel;
                    min = c;
                    ds[--lo] = c;
                } else if (cLabel === minLabel) {
                    if (c.not === min) { return False; }  // only if .not is cheap!
                    min = c;
                    ds[--lo] = c;
                } else { // cLabel > minLabel
                    if (cLabel < top.label) {
                        ds[hi-1] = c;
                        ds[hi++] = top;
                    } else { // c.label >= top.label
                        if (c.label === top.label) {
                            if (c.not === top) { return False; }  // only if .not is cheap!
                            if (c !== top) {
                                ds[hi++] = c;
                                top = c;
                            }
                        } else {
                            ds[hi++] = c;
                            top = c;
                        }
                    }
                }
            }
        }
//        console.log({ hi: hi, k: k, ds: '[' + ds.map(x => x.toIteStr()).join(', ') + ']' });
        // now we have all non-terminal conjuncts in ds.slice(lo, hi)
        // and all those with min label in ds.slice(lo, k)
        let t, e, result;
        n = hi - lo;
        if (n === 1) {
//            console.log(" --> " + min.toIteStr());
            return min;
        } else if (n === 2) {
            /*
            console.log({ n: n, lo: lo, hi: hi, k: k, i: i, minLabel: minLabel, min: min, top: top,
                cs: '[' + cs.map(x => x.toIteStr()).join(', ') + ']',
                ds: '[' + ds.map(x => x.toIteStr()).join(', ') + ']',
            });
            */
            if (k === hi) { // both have minLabel
                t = and2(min.onTrue, top.onTrue);
                e = and2(min.onFalse, top.onFalse);
            } else { // top.label > minLabel
                t = and2(min.onTrue, top);
                e = and2(min.onFalse, top);
            }
            //console.log("  -> " + get(minLabel, t, e));
        } else {
/*
            if (k === hi) { // all conjuncts have minLabel
                t = and_arr(ds.slice(lo, k).map(d => d.onTrue));
                e = and_arr(ds.slice(lo, k).map(d => d.onFalse));
            } else { // we have some conjuncts with label > minLabel
                let rest;
                try {
                    rest = and_arr(ds, k, hi);
                    if (rest === False) {
                        return False;
                    } else {
                        t = and_arr(ds.slice(lo, k).map(d => d.onTrue));
                        e = and_arr(ds.slice(lo, k).map(d => d.onFalse));
                        return and2(get(minLabel, t, e), rest);
                    }
                } catch (e) {
                    console.log("k=" + k + ", hi=" + hi);
                    console.log(ds.slice(k, hi));
                    throw e;
                }
            }
*/

            let xs = new Array(n),
                j;
            i = 0;
            j = lo;
            while (j < k) {
                xs[i++] = ds[j++].onTrue;
            }
            while (j < hi) {
                xs[i++] = ds[j++];
            }
            t = and_arr(xs);
            i = 0;
            j = lo;
            while (j < k) {
                xs[i++] = ds[j++].onFalse;
            }
            e = and_arr(xs);

        }
        result = get(minLabel, t, e);
//        console.log(" --> " + result.toIteStr());
        return result;
    };

    const not  = (p)    => p.not;

    const imp  = (p, q) => p.imp(q);
    const nand = (p, q) => p.nand(q);
    const nor  = (p, q) => p.nor(q);



    function BDD(l, t, e, neg) {
        //assert.isa(l, String);
        //assert.isa(t, BDD);
        //assert.isa(e, BDD);
        //assert(isTerminal(t) || l < t.label);
        //assert(isTerminal(e) || l < e.label);
        //refute.same(t, e);
        //assert.isa(t.neg, BDD);
        //assert.isa(e.neg, BDD);
        var res = Object.create(BDD.prototype, {
            satPathCount: { value: t.satPathCount + e.satPathCount },
            label:      { value: l },
            onTrue:     { value: t },
            onFalse:    { value: e },
            isTerminal: { value: false },
            isVar:      { value: bothTerminal(t, e) },
        });
        instCount++;
        if (neg !== undefined) {
            // assert.isa(neg, BDD);
            // assert.same(l, neg.label);
            // assert.same(t, neg.onTrue.neg);
            // assert.same(e, neg.onFalse.neg);
            Object.defineProperty(res, "neg", { value: neg                       });
        } else {
            Object.defineProperty(res, "neg", { value: BDD(l, t.neg, e.neg, res) });
        }
        return res;
    }
    BDD.prototype.inspect    = function (depth) { return inspect(this, depth)     };

    BDD.prototype.ite        = function (t, e)  { return ite(this, t, e)          };
    BDD.prototype.and        = function (p)     { return and2(this, p)            };
    BDD.prototype.or         = function (p)     { return or2( this, p)            };
    BDD.prototype.eqv        = function (p)     { return eqv2(this, p)            };
    BDD.prototype.xor        = function (p)     { return xor2(this, p)            };
    BDD.prototype.imp        = function (p)     { return this.ite(p, True)        };
    BDD.prototype.nor        = function (p)     { return this.ite(False, p.not)   };
    BDD.prototype.nand       = function (p)     { return this.ite(p.not, True)    };
    BDD.prototype.pmi        = function (p)     { return this.ite(True, p.not)    };

    Object.defineProperty(BDD.prototype, "not", {
        get: function () {
            notCalls++;
            return this.neg;
        }
    });

    BDD.prototype.satPaths   = function*() {
        let v;

        v = get(this.label, False, True);
        for (let p of this.onFalse.satPaths()) {
            yield function *() { yield v; yield* p(); };
            //yield get(this.label, False, p);
        }
        v = v.not;
        for (let p of this.onTrue.satPaths()) {
            yield function *() { yield v; yield* p(); };
            //yield get(this.label, p, False);
        }
    };

    function size(bdd, seen) {
        sizeCalls++;
        let res = 1;
        if (!seen.has(bdd.onTrue)) {
            seen.add(bdd.onTrue);
            res += isTerminal(bdd.onTrue) ? 1 : size(bdd.onTrue, seen);
        }
        if (!seen.has(bdd.onFalse)) {
            seen.add(bdd.onFalse);
            res += isTerminal(bdd.onFalse) ? 1 : size(bdd.onFalse, seen);
        }
        //return res;
        return Object.freeze(res);
    };

    Object.defineProperty(BDD.prototype, "size", { get: function () {
        var n = size(this, new Set());
        //Object.defineProperty(this, "size", { value: n });
        return n;
    } });

    BDD.prototype.toString   = function () {
        return isTerminal(this)
            ? (this === True ? "T" : "F")
            : (isVar(this)
                ? (this.onTrue === True ? this.label : '!' + this.label)
                : "(BDD '" + this.label + "' " + this.onTrue.toString() + " " + this.onFalse.toString() + ")"
            );
    };
    BDD.prototype.toIteStr   = function () {
        return isTerminal(this)
            ? (this === True ? "T" : "F")
            : (isVar(this)
                ? (this.onTrue === True ? this.label : '!' + this.label)
                : "(ite " + this.label + " " + this.onTrue.toIteStr() + " " + this.onFalse.toIteStr() + ")"
            );
    };

    BDD.prototype.iteXXX = function (t, e) {
        iteCalls[this.isVar ? "var" : "other"]++;

        if (t.isTerminal || this.label < t.label) {
            if (e.isTerminal || this.label < e.label) {
                return get(this.label, this.onTrue.ite(t, e), this.onFalse.ite(t, e));
            } else if (this.label === e.label) {
                return get(this.label, this.onTrue.ite(t, e.onTrue), this.onFalse.ite(t, e.onFalse));
            } else {    // e.label < this.label < t.label
                //return e.ite(this.ite(t, True), this.ite(t, False));
                return get(e.label, this.ite(t, e.onTrue), this.ite(t, e.onFalse));
            }
        } else if (this.label === t.label) {
            if (e.isTerminal || this.label < e.label) {
                return get(this.label, this.onTrue.ite(t.onTrue, e), this.onFalse.ite(t.onFalse, e));
            } else if (this.label === e.label) {
                return get(this.label, this.onTrue.ite(t.onTrue, e.onTrue), this.onFalse.ite(t.onFalse, e.onFalse));
            } else {    // e.label < this.label = t.label
                throw new Error("NYI: " + this.label + ' ' + t.label + ' ' + e.label);
            }

        } else {    // t.label < this.label
            if (e.isTerminal || this.label < e.label) {
                return t.ite(this.ite(True, e), this.ite(False, e));
            } else if (this.label === e.label) {
                throw new Error("NYI: " + this.label + ' ' + t.label + ' ' + e.label);
            } else {    // e.label < this.label  &&  t.label < this.label
                if (t.label < e.label) { // t < e < this
                    // this & t  |  !this & e
                    // =?
                    //    t & (e | !e & this)  |  !t & (e & !this)
                    // =  t & e  |  t & !e & this  |  !t & e & !this
                    // =  t & e & this  |  t & e & !this  |  t & !e & this  |  !t & e & !this
                    // =  this & (t & e | t & !e)  |  !this & (t & e | !t & e)
                    // =  this & t                 |  !this & e

                    //return t.ite(this.ite(True, e), this.ite(False, e));
                    return t.ite(e.ite(True, this), e.ite(this.not, False));
                    //return get(t.label, this.ite(t.onTrue, e), this.ite(t.onFalse, e));
                } else {
                    throw new Error("NYI: " + this.label + ' ' + t.label + ' ' + e.label);
                }
            }
        }
    };

    False = Object.create(BDD.prototype, {
        satPathCount:   { value: 0 },
        size:           { value: 1 },
        satPaths:       { value: function*() { } }, // result: no path
        isTerminal:     { value: true  },
        isVar:          { value: false },
        ite:            { value: (p, q) => q     }, // TODO: update iteCalls.terminal
        not:            { get:   ()     => True  },
        or:             { value: p      => p     },
        and:            { value: p      => False },
        eqv:            { value: p      => p.neg },
        xor:            { value: p      => p     },
        imp:            { value: p      => True  },
        nand:           { value: p      => True  },
        nor:            { value: p      => p.neg },
    });

    True = Object.create(BDD.prototype, {
        satPathCount:   { value: 1 },
        size:           { value: 1 },
        satPaths:       { value: function*() { yield function* () {} } },  // result: one path (the empty path)
        isTerminal:     { value: true  },
        isVar:          { value: false },
        neg:            { value: False },
        ite:            { value: (p, q) => p     }, // TODO: update iteCalls.terminal
        not:            { get:   ()     => False },
        or:             { value: p      => True  },
        and:            { value: p      => p     },
        eqv:            { value: p      => p     },
        xor:            { value: p      => p.neg },
        imp:            { value: p      => p     },
        nand:           { value: p      => p.neg },
        nor:            { value: p      => False },
    });

    Object.defineProperty(False, "neg", { value: True });

    False = Object.freeze(False);
    True  = Object.freeze(True);


    const and = function (p, q) {
        andCalls++;
        let n = arguments.length;
        switch (n) {
            case 0:
                return True;
            case 1:
                return p;
            case 2:
                return and2(p, q);
            default:
                return and_arr( Array.prototype.slice.call(arguments, 0) );
        }
    };

    const or = function (p, q) {
        orCalls++;
        let n = arguments.length;
        switch (n) {
            case 0:
                return False;
            case 1:
                return p;
            case 2:
                return or2(p, q);
            default:
                //return or(or2(p, q), or.apply(null, Array.prototype.slice.call(arguments, 2)));
                //return or_arr( Array.prototype.slice.call(arguments, 0) );
                return and_arr( Array.prototype.slice.call(arguments, 0).map(disjunct => disjunct.not) ).not;
        }
    };

    const eqv = function (p, q) {
        return eqv2(p, q);
    };

    const xor = function (p, q) {
        return xor2(p, q);
    };

    const and2 = (p, q) => {
        andCalls++;
        if (q === True) {
            return p;
        } else if (q === p) {
            return p;
        } else if ((q === False) || (p === False)) {
            return False;
        } else if (q === p.not) {
            return False;
        } else if (p === True) {
            return q;
        } else {
            let pLabel = p.label,
                qLabel = q.label;
            if (pLabel === qLabel) {
                return get(pLabel, and2(p.onTrue, q.onTrue), and2(p.onFalse, q.onFalse));
            } else if (pLabel < qLabel) {
                return get(pLabel, and2(p.onTrue, q), and2(p.onFalse, q));
            } else { // qLabel < pLabel
                return get(qLabel, and2(p, q.onTrue), and2(p, q.onFalse));
            }
        }
    };

    const or2 = (p, q) => {
        andCalls++;
        if (q === False) {
            return p;
        } else if (q === p) {
            return p;
        } else if ((q === True) || (p === True)) {
            return True;
        } else if (q === p.not) {
            return True;
        } else if (p === False) {
            return q;
        } else {
            let pLabel = p.label,
                qLabel = q.label;
            if (pLabel === qLabel) {
                return get(pLabel, or2(p.onTrue, q.onTrue), or2(p.onFalse, q.onFalse));
            } else if (pLabel < qLabel) {
                return get(pLabel, or2(p.onTrue, q), or2(p.onFalse, q));
            } else { // qLabel < pLabel
                return get(qLabel, or2(p, q.onTrue), or2(p, q.onFalse));
            }
        }
    };

    const xor2 = (p, q) => {
        xorCalls++;
        if (q === False) {
            return p;
        } else if (q === True) {
            return p.not;
        } else if (q === p) {
            return False;
        } else if (q === p.not) {
            return True;
        } else if (p === True) {
            return q.not;
        } else if (p === False) {
            return q;
        } else {
            let pLabel = p.label,
                qLabel = q.label;
            if (pLabel === qLabel) {
                return get(pLabel, xor2(p.onTrue, q.onTrue), xor2(p.onFalse, q.onFalse));
            } else if (pLabel < qLabel) {
                return get(pLabel, xor2(p.onTrue, q), xor2(p.onFalse, q));
            } else { // qLabel < pLabel
                return get(qLabel, xor2(p, q.onTrue), xor2(p, q.onFalse));
            }
        }
    };

    const eqv2 = (p, q) => {
        eqvCalls++;
        if (q === False) {
            return p.not;
        } else if (q === True) {
            return p;
        } else if (q === p) {
            return True;
        } else if (q === p.not) {
            return False;
        } else if (p === True) {
            return q;
        } else if (p === False) {
            return q.not;
        } else {
            let pLabel = p.label,
                qLabel = q.label;
            if (pLabel === qLabel) {
                return get(pLabel, eqv2(p.onTrue, q.onTrue), eqv2(p.onFalse, q.onFalse));
            } else if (pLabel < qLabel) {
                return get(pLabel, eqv2(p.onTrue, q), eqv2(p.onFalse, q));
            } else { // qLabel < pLabel
                return get(qLabel, eqv2(p, q.onTrue), eqv2(p, q.onFalse));
            }
        }
    }

    function BDDstats() {
        let hlpCs = getCalls + sizeCalls,
            iteCs = Object.keys(iteCalls).reduce((acc, k) => acc + iteCalls[k], 0),
            opCs  = iteCs + notCalls + andCalls + orCalls + eqvCalls + xorCalls,
            result;
        result = {
            instCount:  instCount,
            labelCount: Object.keys(store).length,
            calls: {
                ttl: hlpCs + opCs,
                hlp: { ttl: hlpCs, get: getCalls, size: sizeCalls },
                ops: { ttl: opCs,
                    ite: iteCs,
                    ite_short: iteCalls.short,
                    not: notCalls,
                    and: andCalls,
                    or:  orCalls,
                    eqv: eqvCalls,
                    xor: xorCalls,
                },
            },
            /*
            byLabel:    Object.keys(store).reduce(
                (acc, k) => {
                    var ttlN = store[k].length;
                    var varN = store[k].reduce((acc, bdd) => isVar(bdd) ? acc + 1 : acc, 0);
                    acc[k] = ttlN + '(' + varN + ' vars)';
                    return acc;
                }, {}
            ),
            */
            diff: function (stats) {
                let result = {};
                for (let k in this) {
                    if (util.isNumber(this[k])) {
                        result[k] = this[k] - stats[k];
                    } else if (util.isObject(this[k]) && util.isFunction(this.diff)) {
                        result[k] = this.diff.call(this[k], stats[k]);
                    } else {
                        result[k] = this[k];
                    }
                }
                return result;
            }
        };
        return result;
    }
    BDDstats.prototype.diff = function () {

    };

    return {
        False:      False,
        True:       True,

        isTerminal: isTerminal,
        isVar:      isVar,

        var:        label => get(label, True, False),

        ite:        ite,
        not:        not,
        and:        and,
        or:         or,
        eqv:        eqv,
        xor:        xor,
        imp:        imp,
        nand:       nand,
        nor:        nor,

        byLabel:    byLabel,

        instances:  function* () {
            yield False;
            yield True;
            for (let k of Object.keys(store)) {
                yield* store[k];
            }
        },

        stats: () => BDDstats(),

        stat: function (block) {
            const s = this.stats(),
                  _ = block(),
                  r = this.stats().diff(s);
            return r;
        },
        statCompare: function (block1, block2) {
            const s1 = this.stat(block1),
                  s2 = this.stat(block2),
                  r  = s1.diff(s2);
            return r;
        },
    };
}());

module.exports = BDD;
