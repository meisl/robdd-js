"use strict";

const add = require('./03_n-bit-addition-common'),
      gv  = require('../lib/BDD-gv');

let bitLen = 8,
    bdd    = add.bad(bitLen),
    height = bdd.height,
    size   = bdd.size;

console.log(bitLen + "-addition, BAD variable ordering: height: " + height + ", size: " + size);
if (size < 1000) {
    gv.render(bdd);
} else {
    console.log("too large to render...");
}
