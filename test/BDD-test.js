"use strict";

const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

/* unit under test: */
const BDD = require('../lib/BDD'),
      T    = BDD.True,
      F    = BDD.False,
      ite  = BDD.ite,
      not  = BDD.not,
      and  = BDD.and,
      or   = BDD.or,
      eqv  = BDD.eqv,
      xor  = BDD.xor,
      imp  = BDD.imp,
      nand = BDD.nand,
      nor  = BDD.nor;

const truth_tables = {
    ite: [  [F, F, F, F], // \
            [F, F, T, T], // | project to
            [F, T, F, F], // | 2nd arg
            [F, T, T, T], // /
            [T, F, F, F], // \
            [T, F, T, F], // | project to
            [T, T, F, T], // | 1st arg
            [T, T, T, T], // /
    ],
    not: [  [F, T],
            [T, F]
    ],
    and: [  [F, F, F],
            [F, T, F],
            [T, F, F],
            [T, T, T]
    ],
    or:  [  [F, F, F],
            [F, T, T],
            [T, F, T],
            [T, T, T]
    ],
    eqv: [  [F, F, T],
            [F, T, F],
            [T, F, F],
            [T, T, T]
    ],
    xor: [  [F, F, F],
            [F, T, T],
            [T, F, T],
            [T, T, F]
    ],
    imp: [  [F, F, T],
            [F, T, T],
            [T, F, F],
            [T, T, T]
    ],
    nand: [ [F, F, T],
            [F, T, T],
            [T, F, T],
            [T, T, F]
    ],
    nor: [  [F, F, T],
            [F, T, F],
            [T, F, F],
            [T, T, F]
    ],
};

refute.same(T, F, "BDD.True is different from BDD.False");


() => {
    for (let opName in truth_tables) {
        let op    = BDD[opName],
            tt    = truth_tables[opName],
            arity = tt[0].length - 1;

        assert.typeof(op, "function", "module BDD provides a ." + opName + " function");
        for (let i = 0; i < tt.length; i++) {
            let line   = tt[i],
                args   = line.slice(0, arity),
                result = line[arity];
            assert.same(op.apply(null, args), result,
                "arity " + arity + ' operator ' + opName + " should map (" + args.join(', ') + ') to ' + result);
        }


        assert.typeof(T[opName], "function", "BDD object T provides a ." + opName + " method");
        assert.typeof(F[opName], "function", "BDD object F provides a ." + opName + " method");
        for (let i = 0; i < tt.length; i++) {
            let line     = tt[i],
                invocant = line[0],
                args     = line.slice(1, arity),    // arity of the operator, NOT the method (which gets the 1st arg as this)
                result   = line[arity];
            assert.same(invocant[opName].apply(invocant, args), result,
                "arity " + (arity-1) + ' method .' + opName + ' on ' + invocant + " should map (" + args.join(', ') + ') to ' + result);
        }
    }
}();

/* BDD.size */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c');
    [
        [T                 ,    1],
        [a                 ,    3],
        [b                 ,    3],
        [ite(a, b, T)      ,    4],
        [ite(a, b, F)      ,    4],
        [ite(a, b, b.not()),    5],
        [a.xor(b.xor(c)),       7], // var order doesn't matter since xor is commutative and associative
    ].forEach(arr => {
        let bdd  = arr[0];
        let size = arr[1];
        assert.same(bdd      .size, size);
        assert.same(bdd.not().size, size);
    });
}();



/* BDD.not */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c');

    [   a, b, c,
        ite(a, b, c),
        ite(a, c, b),
        ite(b, a, c),
        ite(b, c, a),
        ite(c, a, b),
        ite(c, b, a),
    ].forEach(p => {
        refute.same(p,       p.not());
        assert.same(p,       p.not().not());
        assert.same(p.not(), ite(p, F, T));
    });
}();


/* n-ary and */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    // exactly 1 of a, b, c is T:
    result = and(
        and(a,       b.not(), c.not()).not(),
        and(a.not(), b,       c.not()).not(),
        and(a.not(), b.not(), c      ).not()
    ).not();
    exp = ite(a, ite(b, F, c.not()), ite(b, c.not(), c));
    assert.same(result, exp, "\n" + result.toIteStr() + " should equal\n" + exp.toIteStr());

    result = and(b, b, a.or(c), d, c, b, d, c, a, a.or(c));
    //console.log(util.inspect(f.calls, { depth: null }));
    assert.same(result, ite(a, ite(b, ite(c, d, F), F), F));


}();
