"use strict";

const bitstr = require('../lib/BDD-bitstr').bitstr;

module.exports = {
    bad: bitLen => {
        let badA = bitstr('a', bitLen),
            badB = bitstr('b', bitLen),
            badC = bitstr('c', bitLen);
        return badA.plus(badB).eq(badC);
    },
    good: bitLen => {
        let goodA = bitstr(bitLen, 'a'),
            goodB = bitstr(bitLen, 'b'),
            goodC = bitstr(bitLen, 'c');
        return goodA.plus(goodB).eq(goodC);
    },
};

