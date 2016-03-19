"use strict";

let fileStream = (() => {
    const start        = process.hrtime(),
          outName      = module.filename + ".out",
          util         = require('util'),
          fs           = require('fs'),
          stdout_write = process.stdout.write,
          process_exit = process.exit;
    let fileStream = fs.createWriteStream(outName, { flags: "w" }); // at start, open for writing

    fileStream.cork();

    function stdout_write_wrapper() {
        stdout_write.call(process.stdout, ...arguments);
        fileStream.write(...arguments);
        let ws = fileStream._writableState;
        if (ws.needDrain) {
            fs.appendFileSync(outName, Buffer.concat(ws.getBuffer().map(writeReq => writeReq.chunk), ws.length));
            //fileStream.end();
            fileStream = fs.createWriteStream(outName, { flags: "a" }); // from now on append
            fileStream.cork();
        }
    };

    process.on("exit", code => {
        let now    = process.hrtime(),
            prec   = 100, // 10**2
            time   = Math.round((now[0] - start[0])*prec + (now[1] - start[1]) / (1e9/prec)) / prec,
            endMsg = "\n" + "-".repeat(20) + "\nexit code: " + code + ", time: " + time + " sec";
        console.log(endMsg);
        process.stdout.write = stdout_write;
        let ws = fileStream._writableState;
        fs.appendFileSync(outName, Buffer.concat(ws.getBuffer().map(writeReq => writeReq.chunk), ws.length));
    });

    process.stdout.write = stdout_write_wrapper;
}());



const util   = require('util'),
      assert = require('pimped-assert').assert;

const BDD    = require('../lib/BDD'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      and    = BDD.and,
      or     = BDD.or,
      xor    = BDD.xor,
      eqv    = BDD.eqv,
      imp    = (p, q) => or(p.not, q),
      gv     = require('../lib/BDD-gv'),
      bitstr = require('../lib/BDD-bitstr').bitstr,
      common = require('./06_n-Queens-common'),
      exactly1          = common.exactly1,
      exactly1_withAND  = common.exactly1_withAND,
      atmost1           = common.atmost1,
      pairwise_neq      = common.pairwise_neq
      ;
const BDDser = require('../lib/BDD-serialization'),
      serialize   = BDDser.serialize,
      deserialize = BDDser.deserialize
;


let n = 10,
    rank = common.makeRanks(n, { interleaved: false, MSBfirst: false }),
    bitLen = rank[0].length,
    p, q, r,
    stats1, stats2
;

q = T;
//q = rank[0].lt(rank[1])  // remove a tiny bit of symmetry

let constraints = [
    ...rank.map(r => r.lte(n - 1)),  // ATTENTION: r.lt(n) yields F if n > (1 << (r.length-1))
    ...pairwise_neq(rank),
    q
];

function diagonalMoves(ranks, distance) {
    let n  = ranks.length,
        k  = n - distance,
        cs = [];
    for (let a = 0, b = a + distance; a < k; a++, b++) {
        let tlbr = imp( ranks[a].lt(k),  ranks[b].neq(ranks[a].plus(distance)) ),
            trbl = imp( ranks[b].lt(k),  ranks[a].neq(ranks[b].plus(distance)) );
        cs.push(tlbr);
        cs.push(trbl);
    }
    return cs;  //  [and.apply(null, cs)];  //
}



for (let d = n - 1; d > 0; d--) {
    let moves = diagonalMoves(rank, d),
        sizes = moves.map(m => m.size),
        ttlSize = sizes.reduce((acc, s) => acc + s);
    console.log(n + "x" + n + "/d" + d + ": " + moves.length + " moves, size(s): " + ttlSize + " = " + sizes.join(" + "));
    moves.forEach(move => constraints.push(move));
    console.log("  constraints: " + constraints.length + " formulas");
    console.log("  ~> " + q.size + " nodes, " + q.satPathCount + " satPaths, " + (Math.round(BDD.stats().calls.ttl/100000)/10) + "M calls");
}
q = and.apply(null, constraints);
console.log("  ~> " + q.size + " nodes, " + q.satPathCount + " satPaths, " + (Math.round(BDD.stats().calls.ttl/100000)/10) + "M calls");


try {
    common.checkSolution(n, q);
} catch (e) {
    let s = q.size;
    if (s > 1000) {
        console.log("size = " + s + " too large to render as graph");
    } else {
        gv.render(q, { satPathCount: true });
    }
    console.log("n: " + n + "\n" + e);
}

console.log(BDD.stats());
//gv.render(q);
console.log("-----------------");
let s = serialize(q, { useSwap: true, useFlip: true, useFlop: true });
console.log("serialize(q):\n" + s.stats());
console.log("pass 2...");
s = s.optimize();
console.log("serialize(q).optimize():\n" + s.stats());


//process.exit();


// make (smaller) solution BDD with different variable ordering
let map = {},
    rankI = common.makeRanks(n, { interleaved: true, MSBfirst: true });
for (let r = 0; r < n; r++) {
    for (let b = 0; b < bitLen; b++) {
        let key = rank[r][b].toString(),
            val = rankI[r][b];
        map[key] = val;
        map["!" + key] = val.not;
    }
}


function byLabelReverse(p, q) {
    let r = BDD.byLabel(q, p);
    if (r === 0) {
        if (p !== q) {
            if (p.onTrue === T) {
                r = -1;
            } else if (q.onTrue === T) {
                r = +1;
            }
        }
    }
    return r;
}

function csCmp(a, b) {
    let n = a.length,
        m = b.length,
        i = 0,
        r = byLabelReverse(a[i], b[i]);
    i++;
    while ((r === 0) && (i < n) && (i < m)) {
        r = byLabelReverse(a[i], b[i]);
        i++;
    }
    if (r === 0) {
        r = (n < m) ? -1 : (n > m ? +1 : 0);
    }
    return r;
}

function rename_sat(q) {
    let ds = new Array(q.satPathCount),
        j  = 0;
    for (let p of q.satPaths()) {
        ds[j++] = and.apply(null, [...p()].map(v => map[v.toString()]));
    }
    return or.apply(null, ds);
}

function rename_ser() {
    let k = 1000,
        i = 0,
        j = k,
        start = process.hrtime(),
        tm = 0,
        result = s.run((label, thenChild, elseChild, t) => {
            if (--j === 0) {
                let now  = process.hrtime(),
                    prec = 100, // 10**2
                    time = Math.round((now[0] - start[0])*prec + (now[1] - start[1]) / (1e9/prec)) / prec;
                i += k;
                j = k;
                console.log(i + " after " + time + " sec (" + (Math.round(t*prec) / prec) + " sec for src-ops)");
            }
            tm = t;
            return ite(map[label], thenChild, elseChild);
        });
    let now  = process.hrtime(),
        prec = 100, // 10**2
        time = Math.round((now[0] - start[0])*prec + (now[1] - start[1]) / (1e9/prec)) / prec;
    i += k - j;
    console.log(i + " after " + time + " sec (" + (Math.round(tm*prec) / prec) + " sec for src-ops)");
    return result;
}

console.log("----------------");
p = rename_sat(q);    //rename_ser();   //
console.log("  ~> " + p.size + " nodes, " + p.satPathCount + " satPaths, " + (Math.round(BDD.stats().calls.ttl/100000)/10) + "M calls");
console.log(BDD.stats());
common.checkSolution(n, p);


//gv.render(q);
console.log("-----------------");
let t = serialize(p, { useSwap: true, useFlip: true, useFlop: true }).optimize();
console.log("serialize(p).optimize():\n" + t.stats());
//console.log(t.toString());

