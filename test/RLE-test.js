"use strict";

const util   = require('util'),
      stream = require('stream');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;


/* module under test: */
const RLE = require('../lib/RLE');


() => {
    let rle,
        added;

    function testAdd(x) {
        assert.throws( () => { rle.decodedLength = 0; }, "setting .decodedLength");
        assert.same(rle.decodedLength, added.length, ".decodedLength");
        rle.add(x);
        added.push(x);
        assert.same(rle.decodedLength, added.length, ".decodedLength");
        assert.same(rle.maxValue, Math.max(...added), ".maxValue");
        assert.same(rle.minValue, Math.min(...added), ".minValue");
        assert.deepEqual([...rle.values()], added, util.inspect(rle.codes));

        let rle2;
        rle2 = RLE.init(added);
        assert.deepEqual([...rle2.values()], added);
        assert.deepEqual(rle2.toJSON(), rle.toJSON());
        rle2 = RLE.init(...added);
        assert.deepEqual([...rle2.values()], added);
        assert.deepEqual(rle2.toJSON(), rle.toJSON());
    }

    function roundtrip(rle) {
        return RLE.fromJSON(JSON.stringify(rle)).inspect();
    }

    rle = RLE.init();
    added = [];
    [1,2].forEach(testAdd);
    assert.same(rle.encodedLength, 3, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ 1, 2 ]);

    testAdd(2);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ 1, [ 2, 2 ] ]);

    added = [];
    assert.same(rle.clear(), rle, ".clear() returns the RLE instance");
    assert.same(rle.encodedLength, 0, "encodedLength for rle(" + added.join(',') + ")");
    assert.same(rle.decodedLength, 0, "decodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual([...rle.values()], [], ".values() after .clear()");

    rle = RLE.init();
    added = [];
    testAdd(1);
    assert.same(rle.encodedLength, 2, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ 1 ]);

    [1, 1, 2, 2].forEach(testAdd);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], [ 2, 2 ] ]);

    testAdd(1);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], 2, 2, 1 ]);

    testAdd(3);
    assert.same(rle.encodedLength, 7, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], 2, 2, 1, 3 ]);

    testAdd(3);
    assert.same(rle.encodedLength, 8, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], 2, 2, 1, [ 2, 3 ] ]);

    testAdd(1);
    assert.same(rle.encodedLength, 9, "encodedLength for rle(" + added.join(',') + ") / " + rle);
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], 2, 2, 1, 3, 3, 1 ]);

    testAdd(1);
    assert.same(rle.encodedLength, 10, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], 2, 2, 1, 3, 3, [ 2, 1 ] ]);

    [2, 3, 4].forEach(testAdd);
    assert.same(rle.encodedLength, 13, "encodedLength for rle(" + added.join(',') + ")");
    assert.deepEqual(roundtrip(rle), [ [ 3, 1 ], 2, 2, 1, 3, 3, 1, 1, 2, 3, 4 ]);


    rle = RLE.init();
    added = [];
    [1,1,1,1,1,1,1,1,1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 2, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ] ]);

    [2,2].forEach(testAdd);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ], [ 2, 2 ] ]);

    testAdd(1);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ], 2, 2, 1 ]);

    testAdd(1);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ], [ 2, 2 ], [ 2, 1 ] ]);

    [1,1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 6, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ], [ 2, 2 ], [ 5, 1 ] ]);

    [2,1,3,4,1,2,1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 15, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ], [ 2, 2 ], [ 5, 1 ], 2, 1, 3, 4, 1, 2, [ 2, 1 ] ]);

    testAdd(7);
    assert.same(rle.encodedLength, 16, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 10, 1 ], [ 2, 2 ], [ 5, 1 ], 2, 1, 3, 4, 1, 2, 1, 1, 7 ]);


    rle = RLE.init();
    added = [];
    [1,1].forEach(testAdd);
    assert.same(rle.encodedLength, 2, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ [ 2, 1 ] ]);

    testAdd(2);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [ 1, 1, 2 ]);

    testAdd(2);
    assert.same(rle.encodedLength, 4, "encodedLength for rle(" + added.join(',') + ") / " + util.inspect(rle.toJSON()));
    assert.deepEqual(roundtrip(rle), [  [ 2, 1 ],  [ 2, 2 ] ]);
}();

() => {
    process.exit();

    let foo = RLE.inflateFromInts();
    //foo.pause();

    let data = [0,7,-20,1,-1,2,2,1,2,3],
        i    = 0,
        n    = data.length;
    let st = new stream.Readable({
        highWaterMark: 3,
        objectMode: true,
        read: function (k) {
            if (i < n) {
                //k = Math.min(k || Infinity, n - i) + i;
                //console.log("    k=" + k + ", i=" + i);
                //this.push(new Buffer(data.slice(i, k)));
                //i = k;
                console.log(">>>" + this.push(data[i++]));
            } else {
                console.log("pushing null");
                this.push(null);
            }
        },
    });

    function readableToArray() {
        let result = [],
            x      = null;
        this.pause();
        while ((x = this.read()) !== null) {
            result.push(x);
        }
        return result;
    }

    st.then = function (s) {
        if (this._readableState.objectMode !== true) {
            throw new Error("NYI: non-objectMode source");
        }
        if (s._writableState.objectMode !== true) {
            throw new Error("NYI: non-writableObjectMode transform");
        }
        let source     = this,
            _transform = s._transform,
            _flush     = s._flush,
            pushCalled,
            result     = new stream.Readable({
                objectMode: s._readableState.objectMode,
                read: function (k) {
                    let data;
                    pushCalled = false;
                    do {
                        data = source.read(k);
                        console.log(".then.read() called: got " + util.inspect(data) + " from source");
                        if (data === null) {
                            _flush.call(this, () => {});
                            this.push(null);
                        } else {
                            _transform.call(this, data, null, () => {});
                        }
                    } while (!pushCalled);
                }
            }),
            origPush   = Object.getPrototypeOf(result).push.bind(result);
        result.push = function (data) {
            let result = origPush(data);
            pushCalled = true;
            console.log("then.push(" + util.inspect(data) + ") ~> " + result);
            return result;
        };
        return result;
    };

    let bar = st.then(foo);

    bar.on('end',    ()             => { console.log("evt end(" + [...arguments].join(', ') + ')'); });
    bar.on('repeat', (count, value) => { console.log("evt repeat " + count + ": " + value) });
    bar.on('asis',   values         => { console.log("evt asis: " + util.inspect(values)) });
    bar.on('data',   v              => { console.log("evt data: " + util.inspect(v)) });
    bar.on('readable', ()           => { console.log("evt readable") });



    bar.toArray = readableToArray;
    let actual = bar.toArray();
    console.log(actual);

process.exit();



    console.log(bar);
    console.log(bar.isPaused());
    console.log("bar.read(): " + bar.read());
    console.log("bar.read(): " + bar.read());
    //st.pause();
    console.log(bar.isPaused());
    console.log("bar.read(): " + bar.read());


    console.log('--------------------------');
}();