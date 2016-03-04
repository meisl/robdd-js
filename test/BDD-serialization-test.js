"use strict";

const util   = require('util'),
      gv     = require('../lib/BDD-gv');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

const BDD = require('../lib/BDD'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      not    = BDD.not,
      and    = BDD.and,
      or     = BDD.or,
      eqv    = BDD.eqv,
      xor    = BDD.xor,
      imp    = BDD.imp
;
const bitstr = require('../lib/BDD-bitstr').bitstr;


/* module under test: */
const BDDser = require('../lib/BDD-serialization'),
      serialize   = BDDser.serialize,
      deserialize = BDDser.deserialize
;




() => {
    let s, p,
        a       = BDD.var('a'),
        b       = BDD.var('b'),
        bitLen  = 3,
        xs      = bitstr('x', bitLen),
        ys      = bitstr('y', bitLen);

    function check(p) {
        let s = serialize(p).optimize();
        console.log(p.size + "/" + p.toIteStr() + ":\n" + s.toString() + "\n" + s.instructions.join(','));
        assert.same(deserialize(s), p, util.inspect(s));

        let expected = Math.max(0, p.size - 2),
            actual   = s.instructions.length / 4;
        assert(actual <= expected, "should have " + expected + " or less instructions but has " + actual + ":\n" + util.inspect(s));
    }

    [
        T, F,
        a, b,
        a.not, b.not,
        and(a, b),
        xor(a, b),
        xs.eq(ys),
        xs.lte(ys),
        xs.eq(7),
    ].forEach(check);
    //gv.render(xs.lte(ys));
}();


