"use strict";

const util   = require('util'),
      gv     = require('../lib/BDD-gv');
const RLE = require('../lib/RLE');
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


// best: {"maxLen":13,"BDDsize":47,"labels":["y3","y2","y1","y0","x3","x2","x1","x0"],"ts":[2,1,1,1,-5,6,1,1,0,-3,-3,7,-9,10,1,0,0,-2,-1,-2,-3,0,2,3,-8,12,0,0,0,-1,-3,0,-1,3,0,0,-1,-1,0,1,-2,0,0,0,0],"code":[33554433,50397697,67240705,84083713,256,100728833,117573121,134416129,134481160,83951874,33686785,151192065,65792,167903233,184748545,184813835,184879115,151126275,134416641,100794630,50529793,50595843,84017413,134415617,131328,201523201,201590796,201655052,201722636,184746244,134414599,134482696,117637378,167969034,168036106,168101898,151191817,134414598,134482184,151191813,117637376,117704967,117770247,117836295,117902343]}
// min:  {"maxLen":13,"BDDsize":47,"labels":["y3","y2","y1","y0","x3","x2","x1","x0"],"ts":[2,1,1,1,-5,6,1,1,-3,-3,6,1,-9,10,1,-2,-4,-2,6,-3,5,-2,-7,9,-11,12,-1,-2,-4,-1,3,-3,3,1,-1,-3,-1,3,-3,-1,-2,0,0,0,0],"code":[33554433,50397697,67240705,84083713,256,100728833,117573121,134416129,84149512,33620226,134349313,151193601,65792,167903233,184748545,151259403,84215049,50462979,151192321,100794630,184747521,151259403,33685762,184746497,131328,201523201,184814348,151324939,84280585,67305732,117637383,67372039,117637384,134414602,117704456,67437575,50528515,100860166,50594566,33751298,196864,262656,328448,394240,460032]}
// max:  {"maxLen":13,"BDDsize":47,"labels":["y3","y2","y1","y0","x3","x2","x1","x0"],"ts":[2,1,1,1,-5,6,1,1,0,-3,-3,7,-9,10,1,0,0,-2,-1,-2,-3,5,-3,-2,-3,12,0,0,0,-1,-3,3,-3,2,0,1,-1,-1,1,-1,-1,1,1,1,1],"code":[33554433,50397697,67240705,84083713,256,100728833,117573121,134416129,134481160,83951874,33686785,151192065,65792,167903233,184748545,184813835,184879115,151126275,134416641,100794630,50529793,134481923,84017413,50529537,131328,201523201,201589516,201656332,201722636,184746244,134414599,184814344,134414594,167969034,168036362,184879882,167969033,151191814,168036873,151191813,134414592,151259400,168102409,184945418,201788427]}

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
            size   = p.size,
            height = p.height,
            info   = "size: " + p.size + ", height: " + p.height + " / " + title + " = " + p.toIteStr(),
            lbls   = s.labels,
            foobar = BDD.var('foobar');

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
        console.log(info + ":");
        let ls = RLE.init(...s.labelDeltas());
        console.log("labelDeltas:  (" + ls.encodedLength + "/" + ls.decodedLength + ") " + ls);
        let tgs = RLE.init(...s.targetSlots());
        console.log("targetSlots:  (" + tgs.encodedLength + "/" + tgs.decodedLength + ") " + tgs);
        let ths = RLE.init(...s.thenSlots());
        console.log("  thenSlots:  (" + ths.encodedLength + "/" + ths.decodedLength + ") " + ths);
        let els = RLE.init(...s.elseSlots());
        console.log("  elseSlots:  (" + els.encodedLength + "/" + els.decodedLength + ") " + els);

        console.log(s.instructionCount + " instructions: " + s.instructions.join(','));
        let jsonObj = s.toJSON();
        let jsonTxt = JSON.stringify(s);
        console.log(jsonTxt);
        console.log(s.toString());
        console.log(info);
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


