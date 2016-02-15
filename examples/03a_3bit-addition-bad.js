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

let bitLen = 4,
    a = bitstr('a', bitLen),    //   bitstr(BDD.var('0a'), BDD.var('1a'), BDD.var('2a'), BDD.var('3a')),    //
    b = bitstr('b', bitLen),    //   bitstr(BDD.var('0b'), BDD.var('1b'), BDD.var('2b'), BDD.var('3b')),    //
    c = bitstr('c', bitLen),    //   bitstr(BDD.var('0c'), BDD.var('1c'), BDD.var('2c'), BDD.var('3c')),    //
    p;

let bit0   = xor(a[0], b[0]),   // bit0 is 1  iff  exactly one of a[0], b[0] is 1
    carry0 = and(a[0], b[0]),
    bit1   = ite(carry0, eqv(a[1], b[1]), xor(a[1], b[1])),
    carry1 = ite(carry0, or( a[1], b[1]), and(a[1], b[1])),
    bit2   = ite(carry1, eqv(a[2], b[2]), xor(a[2], b[2])),
    carry2 = ite(carry1, or( a[2], b[2]), and(a[2], b[2])),
    bit3   = ite(carry2, eqv(a[3], b[3]), xor(a[3], b[3])),
    carry3 = ite(carry2, or( a[3], b[3]), and(a[3], b[3]))
;

//p = carry3;
p = eqv(c[0], bit0).and(eqv(c[1], bit1)).and(eqv(c[2], bit2)).and(eqv(c[3], bit3));


gv.render(p);
