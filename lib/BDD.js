"use strict";

var util   = require('util');
var assert = require('assert');


var BDD = (() => {
    const store = {};
    var   True,
          False,
          getCalls  = 0,
          iteCalls  = { terminal: 0, var: 0, irrelevantHead: 0, other: 0 },
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
        } else if (p === q) {
            iteCalls.irrelevantHead++;
            return q;
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

    const not = bdd => ite(bdd, False, True);

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
    BDD.prototype.inspect    = function (depth) { return inspect(this, depth)       };
    BDD.prototype.ite        = function (t, e)  { return ite(this, t, e)            };
    BDD.prototype.not        = function ()      { return this.ite(False, True)      };
    BDD.prototype.and        = function (p)     { return this.ite(p, False)         };
    BDD.prototype.or         = function (p)     { return this.ite(True, p)          };
    BDD.prototype.imp        = function (p)     { return this.ite(p, True)          };
    BDD.prototype.pmi        = function (p)     { return this.ite(True, p.not())    };
    BDD.prototype.eqv        = function (p)     { return this.ite(p, p.not())       };
    BDD.prototype.xor        = function (p)     { return this.ite(p.not(), p)       };
    BDD.prototype.nor        = function (p)     { return this.ite(False, p.not())   };
    BDD.prototype.nand       = function (p)     { return this.ite(p.not(), True)    };

    BDD.prototype.satPaths   = function*() {
        let v;

        v = get(this.label, False, True);
        for (let p of this.onFalse.satPaths()) {
            yield function *() { yield v; yield* p(); };
            //yield get(this.label, False, p);
        }
        v = v.not();
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
                    return t.ite(e.ite(True, this), e.ite(this.not(), False));
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
        ite:            { value: (p, q) => q },        // TODO: update iteCalls.terminal
    });

    True = Object.create(BDD.prototype, {
        satPathCount:   { value: 1 },
        size:           { value: 1 },
        satPaths:       { value: function*() { yield function* () {} } },  // result: one path (the empty path)
        isTerminal:     { value: true  },
        isVar:          { value: false },
        ite:            { value: (p, q) => p },        // TODO: update iteCalls.terminal
        not:            { value: ()     => False },
        neg:            { value: False },
    });

    Object.defineProperty(False, "neg", { value: True           });
    Object.defineProperty(False, "not", { value: ()     => True });

    False = Object.freeze(False);
    True  = Object.freeze(True);

    return {
        False:      False,
        True:       True,

        isTerminal: isTerminal,
        isVar:      isVar,

        var:        label => get(label, True, False),

        ite:        ite,
        not:        not,

        instances:  function* () {
            yield False;
            yield True;
            for (let k of Object.keys(store)) {
                yield* store[k];
            }
        },

        stats: function () {
            return {
                instCount:  Object.keys(store).map(k => store[k].length).reduce((acc, n) => acc + n),
                labelCount: Object.keys(store).length,
                getCalls:   getCalls,
                iteCalls:   Object.assign({}, iteCalls),
                sizeCalls:  sizeCalls,
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
                        } else if (util.isFunction(this[k])) {
                            result[k] = this[k];
                        } else if (util.isObject(this[k])) {
                            result[k] = this.diff.call(this[k], stats[k]);
                        }
                    }
                    return result;
                }
            };
        },
    };
}());

module.exports = BDD;
