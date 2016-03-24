"use strict";

const util   = require('util'),
      gv     = require('../lib/BDD-gv');
const RLE = require('../lib/RLE');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute,
      forEachCombi = pa.forEachCombi;

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


// best: {"maxLen":13,"BDDsize":47,"labels":["y3","y2","y1","y0","x3","x2","x1","x0"],"ts":[2,1,1,1,-5,6,1,1,0,-3,-3,7,-9,10,1,0,0,-2,-1,-2,-3,0,2,3,-8,12,0,0,0,-1,-3,0,-1,3,0,0,-1,-1,0,1,-2,0,0,0,0],"code":[33554433,50397697,67240705,84083713,256,100728833,117573121,134416129,134481160,83951874,33686785,151192065,65792,167903233,184748545,184813835,184879115,151126275,134416641,100794630,50529793,50595843,84017413,134415617,131328,201523201,201590796,201655052,201722636,184746244,134414599,134482696,117637378,167969034,168036106,168101898,151191817,134414598,134482184,151191813,117637376,117704967,117770247,117836295,117902343]}
// min:  {"maxLen":13,"BDDsize":47,"labels":["y3","y2","y1","y0","x3","x2","x1","x0"],"ts":[2,1,1,1,-5,6,1,1,-3,-3,6,1,-9,10,1,-2,-4,-2,6,-3,5,-2,-7,9,-11,12,-1,-2,-4,-1,3,-3,3,1,-1,-3,-1,3,-3,-1,-2,0,0,0,0],"code":[33554433,50397697,67240705,84083713,256,100728833,117573121,134416129,84149512,33620226,134349313,151193601,65792,167903233,184748545,151259403,84215049,50462979,151192321,100794630,184747521,151259403,33685762,184746497,131328,201523201,184814348,151324939,84280585,67305732,117637383,67372039,117637384,134414602,117704456,67437575,50528515,100860166,50594566,33751298,196864,262656,328448,394240,460032]}
// max:  {"maxLen":13,"BDDsize":47,"labels":["y3","y2","y1","y0","x3","x2","x1","x0"],"ts":[2,1,1,1,-5,6,1,1,0,-3,-3,7,-9,10,1,0,0,-2,-1,-2,-3,5,-3,-2,-3,12,0,0,0,-1,-3,3,-3,2,0,1,-1,-1,1,-1,-1,1,1,1,1],"code":[33554433,50397697,67240705,84083713,256,100728833,117573121,134416129,134481160,83951874,33686785,151192065,65792,167903233,184748545,184813835,184879115,151126275,134416641,100794630,50529793,134481923,84017413,50529537,131328,201523201,201589516,201656332,201722636,184746244,134414599,184814344,134414594,167969034,168036362,184879882,167969033,151191814,168036873,151191813,134414592,151259400,168102409,184945418,201788427]}


() => {
    let a  = BDD.var('a'),
        b  = BDD.var('b'),
        c  = BDD.var('c'),
        d  = BDD.var('d'),
        bitLen = 8,
        x_plus_y_eq_z_BAD  = bitstr('x', bitLen).plus(bitstr('y', bitLen)).eq(bitstr('z', bitLen)),
        x_plus_y_eq_z_GOOD = bitstr(bitLen, 'x').plus(bitstr(bitLen, 'y')).eq(bitstr(bitLen, 'z')),
        p  = and( eqv(a, d), eqv(b, c) ),
        q1 = or( and(a, b, c, d), and(a.not, b.not, d.not) ),
        q2 = or( and(a.not, b, c, d), and(a, b.not, d.not) ),
        s = serialize(x_plus_y_eq_z_BAD).optimize();
    //gv.render(x_plus_y_eq_z_GOOD);
    process.exit();
}();

/* deserialize with label mapping (different ordering than in original) */
() => {
    let vars   = ["a", "b", "c", "d", "e", "f", "g", "h"].map(BDD.var),  // even nr of vars!
        n      = vars.length,
        bitLen = n / 2,
        conj   = and.apply(null, vars),
        goodA  = [],
        goodB  = [],
        badA   = [],
        badB   = [];
    // sort vars by label:
    for (let p = conj, i = n; !p.isTerminal; p = p.onTrue) {
        let v = BDD.var(p.label);
        vars[--i] = v;
        ((i % 2 === 0) ? goodA : goodB).unshift(v);
        ((i < bitLen)  ? badA  : badB ).unshift(v);
    }
    let good = T,
        bad  = T,
        g2b  = {},
        b2g  = {},
        goodS = [],
        badS  = [];
    for (let i = 0; i < bitLen; i++) {
        good = and(good, eqv(goodA[i], goodB[i]));
        bad  = and(bad,  eqv(badA[i],  badB[i]));
        g2b[goodA[i].label] = badA[i].label;
        g2b[goodB[i].label] = badB[i].label;
        b2g[badA[i].label] = goodA[i].label;
        b2g[badB[i].label] = goodB[i].label;
        goodS.push("(" + goodA[i] + " <-> " + goodB[i] + ")");
        badS.push( "(" + badA[i]  + " <-> " + badB[i] + ")");
    }
    goodS = goodS.join(" & ");
    badS  = badS.join(" & ");

    console.log("vars:", vars);
    console.log("good:", goodA, goodB, "~> " + goodS + " / " + good.toIteStr());
    console.log(" bad:", badA,  badB,  "~> " + badS + " / " + bad.toIteStr());
    console.log("g2b:", g2b);
    console.log("b2g:", b2g);

    refute.same(good, bad);
    assert(good.size < bad.size);


    forEachCombi({
        optimize:  [false, true],
        useSwap:   [false, true],
        useFlip:   [false, true],
        useFlop:   [false, true],
        roundTrip: [false], // TODO: roundtrip
    }, opts => {
        let goodP = serialize(good, opts),
            badP  = serialize(bad,  opts);
        if (opts.optimize) {
            goodP = goodP.optimize();
            badP  = badP.optimize();
        }
        if (opts.roundTrip) {
            goodP = BDDser.fromJSON(JSON.stringify(goodP));
            badP = BDDser.fromJSON(JSON.stringify(badP));
        }
        // sanity (of tests)
        function msg1(what) {
            return "\n" + goodP.toString() + "\n" + badP.toString()
                + "\n" + "should have " + what;
        }
        let flopCount = goodP.flopCount + badP.flopCount,
            flipCount = goodP.flipCount + badP.flipCount - flopCount, // pure flips
            swapCount = goodP.swapCount + badP.swapCount - flopCount; // pure swaps
        if (opts.useSwap) {
            refute.same(swapCount, 0, msg1("at least one swap"));
        } else {
            assert.same(swapCount, 0, msg1("NO swap"));
        }
        if (opts.useFlip) {
            refute.same(flipCount, 0, msg1("at least one flip"));
        } else {
            assert.same(flipCount, 0, msg1("NO flip"));
        }
        if (opts.useFlop) {
            refute.same(flopCount, 0, msg1("at least one flop"));
        } else {
            assert.same(flopCount, 0, msg1("NO flop"));
        }


        let badFromGood = goodP.run((label, thenChild, elseChild) => BDD.get(g2b[label], thenChild, elseChild)),
            goodFromBad = badP.run( (label, thenChild, elseChild) => BDD.get(b2g[label], thenChild, elseChild));

        function msg2(a, x, program) {
            return "options: " + util.inspect(opts)
                + "\n" + (BDD.isBDD(a) ? a.toIteStr() : util.inspect(a))
                + "\n" + (BDD.isBDD(x) ? x.toIteStr() : util.inspect(x))
                + "\n" + program.toString()
                + "\n" + (program === goodP ? "bad from good under " + util.inspect(g2b) : "good from bad under " + util.inspect(g2b))
            ;
        }

        assert.same(badFromGood, bad,  msg2(badFromGood, bad,  goodP));
        assert.same(goodFromBad, good, msg2(goodFromBad, good, badP ));

    });


}();


/* */
() => {
    let s, p,
        a       = BDD.var('a'),
        b       = BDD.var('b'),
        c       = BDD.var('c'),
        d       = BDD.var('d'),
        bitLen  = 4,
        xs      = bitstr('x', bitLen),
        ys      = bitstr('y', bitLen);

    function check(title, p, s) {
        let actual,
            expected,
            size    = p.size,
            height  = p.height,
            bddInfo = "size: " + p.size + ", height: " + p.height + " / " + title + " = " + p.toIteStr(),
            lbls    = s.labels,
            foobar  = BDD.var('foobar');

        assert.throws( () => s.labelIdx(foobar), ".labelIdx on BDD " + util.inspect(p) + " with BDD with non-existent label / labels now: " + util.inspect(s.labels));

        if (p.isTerminal) {
            actual = s.labelIdx(p);
            assert(actual < 0, "labelIdx(" + p + ") should be < 0 - but it is " + actual);
            refute.same(actual, s.labelIdx(p.not), "labelIdx(" + p + ") should be !== labelIdx(" + p.not + ")");
        } else {
            actual = s.labels.indexOf(p.label);
            assert(actual >= 0, p.label + " should be contained in .labels: " + util.inspect(s.labels));
            expected = actual;
            actual = s.labelIdx(p);
            assert.same(actual, expected, "labelIdx((bdd '" + p.label + "', ...)");
        }
        console.log(bddInfo + ":");
        let ls = RLE.init(...s.labelDeltas());
        console.log("labelDeltas:  (" + ls.encodedLength + "/" + ls.decodedLength + ") " + ls);
        let ths = RLE.init(...s.thenSlots());
        console.log("  thenSlots:  (" + ths.encodedLength + "/" + ths.decodedLength + ") " + ths);
        let els = RLE.init(...s.elseSlots());
        console.log("  elseSlots:  (" + els.encodedLength + "/" + els.decodedLength + ") " + els);

        console.log(s.instructionCount + " instructions ");
        let stats   = s.stats(),
            jsonObj = s.toJSON(),
            jsonTxt = JSON.stringify(s);
        console.log(jsonTxt);
        console.log(s.toString());
        console.log(bddInfo);

        refute.same(s.maxLen,           undefined, "program.maxLen");
        refute.same(s.instructionCount, undefined, "program.instructionCount");
        refute.same(s.swapCount,        undefined, "program.swapCount");
        refute.same(s.flipCount,        undefined, "program.flipCount");
        refute.same(s.flopCount,        undefined, "program.flopCount");
        refute.same(s.BDDsize,          undefined, "program.BDDsize");
        refute.same(s.BDDheight,        undefined, "program.BDDheight");
        refute.same(s.labelCount,       undefined, "program.labelCount");
        assert.same(s.labelCount,       s.labels.length, "program.labelCount === program.labels.length");

        assert.same(stats.maxLen,           s.maxLen,           "program.stats().maxLen === program.maxLen"                         + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.instructionCount, s.instructionCount, "program.stats().instructionCount === program.instructionCount"     + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.swapCount,        s.swapCount,        "program.stats().swapCount === program.swapCount"                   + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.flipCount,        s.flipCount,        "program.stats().flipCount === program.flipCount"                   + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.flopCount,        s.flopCount,        "program.stats().flopCount === program.flopCount"                   + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.BDDsize,          s.BDDsize,          "program.stats().BDDsize === program.BDDsize"                       + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.BDDheight,        s.BDDheight,        "program.stats().BDDheight === program.BDDheight"                   + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.labelCount,       s.labels.length,    "program.stats().labelCount === program.labels.length"              + " for bdd of {" + bddInfo + "}\n");
        assert.same(stats.JSONlength,       jsonTxt.length,     "program.stats().JSONlength === JSON.stringify(program).length"     + " for bdd of {" + bddInfo + "}\n");

        assert.same(jsonObj.maxLen,     s.maxLen,       "program.toJSON().maxLen === program.maxLen");
        assert.same(jsonObj.BDDsize,    s.BDDsize,      "program.toJSON().BDDsize === program.BDDsize");
        assert.same(jsonObj.BDDheight,  s.BDDheight,    "program.toJSON().BDDheight === program.BDDheight");

        assert.same(JSON.stringify(jsonObj), jsonTxt, "JSON.stringify(program.toJSON()) === JSON.stringify(program)");

        assert.same(s.BDDsize,   size,   ".BDDsize");
        assert.same(s.BDDheight, height, ".BDDheight");
        assert(s.maxLen <= Math.max(2, s.BDDsize), ".maxLen should be lte max(.BDDsize, 2)");

        expected = Math.max(0, size - 2);
        actual   = s.instructionCount;
        assert(actual <= expected, "should have " + expected + " or less instructions but has " + actual + ":\n" + util.inspect(s));

        assert.same(deserialize(s), p, s);
        //assert.same(deserialize(jsonTxt), p, "deserialize from JSON (text):\n" + jsonTxt);
        console.log("---------");
    }

    //gv.render(xs.eq(ys));

    let testData = [
        ["T"                   , T                      ],
        ["F"                   , F                      ],
        ["a"                   , a                      ],
        ["b"                   , b                      ],
        ["a.not"               , a.not                  ],
        ["b.not"               , b.not                  ],
        ["and(a, b)"           , and(a, b)              ],

        ["xor(a, b)"           , xor(a, b)              ],
        ["xs.eq(ys)"           , xs.eq(ys)              ],

        ["xs.neq(ys)"          , xs.neq(ys)             ],
        ["xs.lte(ys)"          , xs.lte(ys)             ],
        ["xs.eq(7)"            , xs.eq(7)               ],
        ["ite(a, b, c)"        , ite(a, b, c)           ],
        ["ite(a, and(b, c), d)", ite(a, and(b, c), d)   ],
        ["ite(a, d, and(b, c))", ite(a, d, and(b, c))   ],
    ];

    testData.forEach(pair => ((title, bdd) => check(title, bdd, serialize(bdd)))(...pair));
    console.log("------------------------- optimized -------------------------");
    testData.forEach(pair => ((title, bdd) => check(title, bdd, serialize(bdd).optimize()))(...pair));
}();


