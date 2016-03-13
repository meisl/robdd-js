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

        if (arity === 1) {
            for (let i = 0; i < tt.length; i++) {
                let line     = tt[i],
                    invocant = line[0],
                    result   = line[1];
                assert.same(invocant[opName], result,
                    'getter .' + opName + ' on ' + invocant + ' should return ' + result);
                assert.throws(() => { invocant[opName] = result; }, '.' + opName + ' should not be a setter');
            }
        } else {
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
    }
}();


/* BDD.isBDD */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c');
    assert.same(BDD.isBDD(T), true);
    assert.same(BDD.isBDD(F), true);
    assert.same(BDD.isBDD(a), true);
    assert.same(BDD.isBDD(b), true);
    assert.same(BDD.isBDD(c), true);

    assert.same(BDD.isBDD({}),    false);
    assert.same(BDD.isBDD({label: "a", onTrue: T, onFalse: F}),    false);
    assert.same(BDD.isBDD("foo"), false);
    assert.same(BDD.isBDD(23),    false);

    /*
    // let's try really hard to fake one...
    let x = Object.create(Object.getPrototypeOf(T), {
        label:   { value: "a" },
        onTrue:  { value: T   },
        onFalse: { value: F   }
    });
    assert.same(BDD.isBDD(x), false);
    */
}();


/* BDD.height */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c');
    [
        ["T"               , T               ,    0],
        ["a"               , a               ,    1],
        ["b"               , b               ,    1],
        ["ite(a, b, T)"    , ite(a, b, T)    ,    2],
        ["ite(a, b, F)"    , ite(a, b, F)    ,    2],
        ["ite(a, b, b.not)", ite(a, b, b.not),    2],
        ["a.xor(b.xor(c))" , a.xor(b.xor(c)) ,    3],
    ].forEach(arr => {
        let title  = arr[0],
            bdd    = arr[1],
            height = arr[2];
        assert.same(bdd    .height, height, ".height of " + title);
        assert.same(bdd.not.height, height, ".height of not(" + title + ")");
    });
}();


/* BDD.size */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c');
    [
        [T               ,    1],
        [a               ,    3],
        [b               ,    3],
        [ite(a, b, T)    ,    4],
        [ite(a, b, F)    ,    4],
        [ite(a, b, b.not),    5],
        [a.xor(b.xor(c)),     7], // var order doesn't matter since xor is commutative and associative
    ].forEach(arr => {
        let bdd  = arr[0];
        let size = arr[1];
        assert.same(bdd    .size, size);
        assert.same(bdd.not.size, size);
    });
}();



/* BDD.not */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c');

    [   T, F,
        a, b, c,
        ite(a, b, c),
        ite(a, c, b),
        ite(b, a, c),
        ite(b, c, a),
        ite(c, a, b),
        ite(c, b, a),
    ].forEach(p => {
        refute.same(p,     p.not);
        assert.same(p,     p.not.not);
        assert.same(p.not, ite(p, F, T));
    });
}();


/* binary and */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    assert.same(and(a, T), a, "unit (neutral element) of AND is T (a)");
    assert.same(and(T, a), a, "unit (neutral element) of AND is T (b)");
    assert.same(and(a, F), F, "zero of AND is F (a)");
    assert.same(and(F, a), F, "zero of AND is F (b)");
    assert.same(and(a, a), a, "var a is idempotent wrt AND");
    assert.same(and(a, a.not), F, "a AND a.not is F");
    assert.same(and(a, b), and(b, a), "AND is commutative");
    assert.same(and(a, b), ite(a, b, F), "a AND b in terms of ite: ite(a, b, F) (a)");
    assert.same(and(a, b), ite(b, a, F), "a AND b in terms of ite: ite(b, a, F) (b)");
    assert.same(and(a, and(a, b)), and(and(a, a), b), "a AND (a AND b)  ===  (a AND a) AND b");
    assert.same(and(a, and(b, c)), and(and(a, b), c), "a AND (b AND c)  ===  (a AND b) AND c");
}();


/* binary or */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    assert.same(or(a, F), a, "unit (neutral element) of OR is F (a)");
    assert.same(or(F, a), a, "unit (neutral element) of OR is F (b)");
    assert.same(or(a, T), T, "zero of OR is T (a)");
    assert.same(or(T, a), T, "zero of OR is T (b)");
    assert.same(or(a, a), a, "var a is idempotent wrt OR");
    assert.same(or(a, a.not), T, "a OR a.not is T");
    assert.same(or(a, b), or(b, a), "OR is commutative");
    assert.same(or(a, b), ite(a, T, b), "a OR b in terms of ite: ite(a, T, b) (a)");
    assert.same(or(a, b), ite(b, T, a), "a OR b in terms of ite: ite(b, T, a) (b)");
    assert.same(or(a, or(a, b)), or(or(a, a), b), "a OR (a OR b)  ===  (a OR a) OR b");
    assert.same(or(a, or(b, c)), or(or(a, b), c), "a OR (b OR c)  ===  (a OR b) OR c");
}();


/* binary eqv */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    assert.same(eqv(a, T), a, "unit (neutral element) of EQV is T (a)");
    assert.same(eqv(T, a), a, "unit (neutral element) of EQV is T (b)");
    assert.same(eqv(a, F), a.not, "a EQV F is a.not (a)");
    assert.same(eqv(F, a), a.not, "F EQV a is a.not (b)");
    assert.same(eqv(a, a), T, "a EQV a is T");
    assert.same(eqv(a, a.not), F, "a EQV a.not is F");
    assert.same(eqv(a, b), eqv(b, a), "EQV is commutative");
    assert.same(eqv(a, b), ite(a, b, b.not), "a EQV b in terms of ite: ite(a, b, b.not) (a)");
    assert.same(eqv(a, b), ite(b, a, a.not), "a EQV b in terms of ite: ite(b, a, a.not) (b)");
    assert.same(eqv(a, eqv(a, b)), eqv(eqv(a, a), b), "a EQV (a EQV b)  ===  (a EQV a) EQV b");
    assert.same(eqv(a, eqv(b, c)), eqv(eqv(a, b), c), "a EQV (b EQV c)  ===  (a EQV b) EQV c");
}();


/* binary xor */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    assert.same(xor(a, F), a, "unit (neutral element) of XOR is F (a)");
    assert.same(xor(F, a), a, "unit (neutral element) of XOR is F (b)");
    assert.same(xor(a, T), a.not, "a XOR T is a.not (a)");
    assert.same(xor(T, a), a.not, "T XOR a is a.not (b)");
    assert.same(xor(a, a), F, "a XOR a is F");
    assert.same(xor(a, a.not), T, "a XOR a.not is T");
    assert.same(xor(a, b), xor(b, a), "XOR is commutative");
    assert.same(xor(a, b), ite(a, b.not, b), "a XOR b in terms of ite: ite(a, b.not, b) (a)");
    assert.same(xor(a, b), ite(b, a.not, a), "a XOR b in terms of ite: ite(b, a.not, a) (b)");
    assert.same(xor(a, xor(a, b)), xor(xor(a, a), b), "a XOR (a XOR b)  ===  (a XOR a) XOR b");
    assert.same(xor(a, xor(b, c)), xor(xor(a, b), c), "a XOR (b XOR c)  ===  (a XOR b) XOR c");
}();


/* n-ary and */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    assert.same(and(),     T, "empty AND should equal T");
    assert.same(and(a),    a, "AND with one arg should equal that arg");

    // exactly 1 of a, b, c is T:
    result = and(
        and(a,       b.not, c.not).not,
        and(a.not, b,       c.not).not,
        and(a.not, b.not, c      ).not
    ).not;
    exp = ite(a, ite(b, F, c.not), ite(b, c.not, c));
    assert.same(result, exp, "\n" + result.toIteStr() + " should equal\n" + exp.toIteStr());

    result = and(b, b, a.or(c), d, c, b, d, c, a, a.or(c));
    assert.same(result, and(a, b, c, d));
    assert.same(result, ite(a, ite(b, ite(c, d, F), F), F));
}();


/* n-ary or */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d'),
        result, exp;

    assert.same(or(),     F, "empty OR should equal F");
    assert.same(or(a),    a, "OR with one arg should equal that arg");

    // exactly 1 of a, b, c is T:
    result = or(
        or(a.not, b,     c    ).not,    // equiv to and(a, b.not, c.not)
        or(a,     b.not, c    ).not,    // equiv to and(a.not, b, c.not)
        or(a,     b,     c.not).not     // equiv to and(a.not, b.not, c)
    );
    exp = ite(a, ite(b, F, c.not), ite(b, c.not, c));
    assert.same(result, exp, "\n" + result.toIteStr() + " should equal\n" + exp.toIteStr());

    result = or(b, b, a.and(c), d, c, b, d, c, a, a.and(c));
    assert.same(result, or(a, b, c, d));
    assert.same(result, ite(a, T, ite(b, T, ite(c, T, d))));
}();


/* .get */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d');

    function check(l, t, e) {
        let msg = "BDD.get('" + l + "', " + t.toIteStr() + ", " + e.toIteStr() + ")";
        assert.same(BDD.get(l, t, e), ite(BDD.var(l), t, e), msg);
    }

    [
        ['a', T, F],
        ['a', T, T],
        ['a', F, F],
        ['b', T, F],
        ['b', T, T],
        ['b', F, F],
        ['a', b, c],
        ['a', c, b],
        ['b', a, c],
        ['b', c, a],
        ['c', a, b],
        ['c', b, a],
    ].forEach(args => check.apply(null, args));
}();


/* .toSrc() */
() => {
    let a = BDD.var('a'),
        b = BDD.var('b'),
        c = BDD.var('c'),
        d = BDD.var('d');

    function check(bdd) {
        let msg = 'eval("' + bdd.toSrc() + '")(BDD);';
        console.log(msg);
        assert.same(eval(bdd.toSrc())(BDD), bdd, msg);
    }

    [
        T, F,
        a, b, c,
        a.not, b.not, c.not,
        and(a, b, c),
        and(a, b, c.not),
        and(a, c, b),
        and(a, c, b.not),
        and(b, a, c),
        and(b, a, c.not),
        and(b, c, a),
        and(b, c, a.not),
        and(c, a, b),
        and(c, a, b.not),
        and(c, b, a),
        and(c, b, a.not),
    ].forEach(bdd => {
        check(bdd);
    });

}();
