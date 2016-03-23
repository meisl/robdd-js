"use strict";

const util = require('util');

const BDD    = require('../lib/BDD'),
      ite    = BDD.ite,
      and    = BDD.and,
      or     = BDD.or,
      xor    = BDD.xor,
      eqv    = BDD.eqv,
      gv     = require('../lib/BDD-gv'),
      bitstr = require('../lib/BDD-bitstr').bitstr;

let bitLen = 8,
    badA = bitstr('a', bitLen),
    badB = bitstr('b', bitLen),
    badC = bitstr('c', bitLen),
    bad = badA.plus(badB).eq(badC),
    goodA = bitstr(bitLen, 'a'),
    goodB = bitstr(bitLen, 'b'),
    goodC = bitstr(bitLen, 'c'),
    good = goodA.plus(goodB).eq(goodC);

console.log(bad.size);

console.log(good.size);
gv.render(good);
