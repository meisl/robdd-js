"use strict";

const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

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

/* unit under test: */
const stats = BDD.stats;

() => {
    assert.typeof(stats, "function", "BDD exports a .stats function");
}();
