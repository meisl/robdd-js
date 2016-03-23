"use strict";

const addition = require('./03_n-bit-addition-common'),
      gv       = require('../lib/BDD-gv');

let bitLen = 8,
    bdd    = addition.good(bitLen),
    height = bdd.height,
    size   = bdd.size;

console.log(bitLen + "-addition, GOOD variable ordering: height: " + height + ", size: " + size);
if (size < 1000) {
    gv.render(bdd);
} else {
    console.log("too large to render...");
}
