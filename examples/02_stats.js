"use strict";

const util = require('util');

const BDD    = require('../lib/BDD'),
      bitstr = require('../lib/BDD-bitstr').bitstr;


var bitLen = 9,
    a1     = bitstr('a1', bitLen),
    a2     = bitstr('a2', bitLen),
    a3     = bitstr('a3', bitLen),
    p;

console.log('====================');
console.log(BDD.stats());
console.log('====================');

/*
var a10 = a1[0],    a20 = a2[0],    a30 = a3[0],
    a11 = a1[1],    a21 = a2[1],    a31 = a3[1],
    a12 = a1[2],    a22 = a2[2],    a32 = a3[2],
    a13 = a1[3],    a23 = a2[3],    a33 = a3[3],
    a14 = a1[4],    a24 = a2[4],    a34 = a3[4]
;
*/

function tryit() {
    var getCalls = BDD.stats().getCalls,
        diff;
    //p = a1_plus_a2.neq2( a3);

    p = a1.neq(a3);
    //p = a1.neq2(a3);

/*
    p =      a1[0].xor(a3[0])
        .or( a1[1].xor(a3[1]) )
        .or( a1[2].xor(a3[2]) )
        .or( a1[3].xor(a3[3]) )
        .or( a1[4].xor(a3[4]) )
    p =      a10.xor(a30)
        .or( a11.xor(a31) )
        .or( a12.xor(a32) )
        .or( a13.xor(a33) )
        .or( a14.xor(a34) )
*/

    diff = BDD.stats().getCalls - getCalls;
    console.log('getCalls: ' + diff);
    return diff;
}

var before = new Array(3).fill(0);

while (true) {
    let t0 = tryit();
    if (before.every(t => t === t0)) {
        break;
    }
    before.shift();
    before.push(t0);
}


console.log('====================');
console.log(BDD.stats());
console.log('====================');
