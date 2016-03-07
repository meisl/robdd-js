"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;


/* module under test: */
const RLE = require('../lib/RLE');


() => {
    let rle   = RLE.init(),
        added = [];

    assert.same(rle.decodedLength, 0);
    assert.same(rle.encodedLength, 0);

    function testAdd(x) {
        assert.same(rle.decodedLength, added.length);
        rle.add(x);
        added.push(x);
        assert.same(rle.decodedLength, added.length);
        assert.deepEqual([...rle], added, util.inspect(rle.codes));
    }

    testAdd(1);
    assert.same(rle.encodedLength, 2, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ [ 1 ] ]);

    [1, 1, 2, 2].forEach(testAdd);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, { '2x': 2 } ]);

    testAdd(1);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, [ 2, 2, 1 ] ]);

    testAdd(3);
    assert.same(rle.encodedLength, 7, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, [ 2, 2, 1, 3 ] ]);

    testAdd(3);
    assert.same(rle.encodedLength, 8, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, [ 2, 2, 1 ], { '2x': 3 } ]);

    testAdd(1);
    assert.same(rle.encodedLength, 9, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, [ 2, 2, 1, 3, 3, 1 ] ]);

    testAdd(1);
    assert.same(rle.encodedLength, 10, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, [ 2, 2, 1, 3, 3 ], { '2x': 1 } ]);

    [2, 3, 4].forEach(testAdd);
    assert.same(rle.encodedLength, 13, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(rle.toJSON(), [ { '3x': 1 }, [2, 2, 1, 3, 3, 1, 1, 2, 3, 4 ] ]);


    rle = RLE.init();
    added = [];
    [1,1,1,1,1,1,1,1,1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 2, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 } ]);

    [2,2].forEach(testAdd);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 }, { '2x': 2 } ]);

    testAdd(1);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 }, [ 2, 2, 1 ] ]);

    testAdd(1);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 }, { '2x': 2 }, { '2x': 1 } ]);

    [1,1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 }, { '2x': 2 }, { '5x': 1 } ]);

    [2,1,3,4,1,2,1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 15, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 }, { '2x': 2 }, { '5x': 1 }, [ 2, 1, 3, 4, 1, 2 ], { '2x': 1 } ]);

    testAdd(7);
    assert.same(rle.encodedLength, 16, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(rle.toJSON(), [ { '10x': 1 }, { '2x': 2 }, { '5x': 1 }, [ 2, 1, 3, 4, 1, 2, 1, 1, 7 ] ]);

}();

