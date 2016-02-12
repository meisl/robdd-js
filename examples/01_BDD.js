"use strict";

const util = require('util');
const BDD  = require('../lib/BDD');
const gv   = require('graphviz-js');


var a = BDD.var('a');
var b = BDD.var('b');
var c = BDD.var('c');
var d = BDD.var('d');
var e = BDD.var('e');

var g = gv.digraph();

const omitFalse = true; //false;  //

g.on('node', function (x) {
    if (typeof x !== "object") {
        return;
    }
    //console.log('event node: ', x);
    g.node(x, { height: 0.4, fixedsize: true, });
    if (x === BDD.True) {
        g.node(x, { rank: 0, shape: "square", label: "T", color: "green", fontcolor: "green" });
    } else if (x === BDD.False) {
        g.node(x, { rank: 0, shape: "square", label: "F", color: "red",   fontcolor: "red"   });
    } else {
        g.node(x, {
            shape: "circle",
            fontsize: 9,
            label: x.label
                + '\n' + x.satPathCount + '/' + x.neg.satPathCount,
        });
        if ((x.onTrue !== BDD.False) || !omitFalse) {
          g.addPath(x, x.onTrue).where({ fontsize: 9,  label: x.onTrue.satPathCount });
        }
        if ((x.onFalse !== BDD.False) || !omitFalse) {
          g.addPath(x, x.onFalse).where({ fontsize: 9, label: x.onFalse.satPathCount });
        }
    }

        //g.node(x.not());
});

g.edgeIf( (from, to) => from.onTrue  === to, { color: "green" });
g.edgeIf( (from, to) => from.onFalse === to, { color: "red", style: "dashed" });

//g.edgeIf( (from, to) => (to === BDD.False) && (from !== BDD.True), { style: "invis", constraint: false });




var p;

p = a.ite(BDD.True, BDD.False);  // a
p = a.ite(BDD.False, BDD.True);  // not a
p = a.ite(a, a);                 // a

p = a.ite(b, c);
p = a.ite(c, b);

p = a.ite(b, a);    // a.ite(b, False)
p = a.ite(a, b);    // a.ite(True, b)

p = b.ite(a, c);    // a.ite(b.ite(True, c), b.ite(False, c))
p = b.ite(c, a);    // a.ite(b.ite(c, True), b.ite(c, False))

p = c.ite(a, b);    // a.ite(c.ite(True, b), c.ite(False, b))
p = c.ite(b, a);    //

var b0 = BDD.var("b0");  var b0_ = BDD.var("b0'");
var b1 = BDD.var("b1");  var b1_ = BDD.var("b1'");
var b2 = BDD.var("b2");  var b2_ = BDD.var("b2'");
var b3 = BDD.var("b3");  var b3_ = BDD.var("b3'");
var b4 = BDD.var("b4");  var b4_ = BDD.var("b4'");
p = b0.xor(b0_)
    .and(b1.xor(b1_).eqv(b0.and(b0_.not())))
    .and(b2.xor(b2_).eqv(b1.and(b1_.not())))
    //.or(b2.and(b1).and(b0).and(b2_.and(b1_).and(b0_.not())))
    //.and(b3.xor(b3_).eqv(b2.and(b2_.not())))
/*
    .and(b1.and(      b0).eqv(      b1_.not().and(b0_.not())))
    .and(b1.not().and(b0).eqv(      b1_.and(      b0_.not())))

    .and(b1.not().and(b0.not()).imp(b1_.not().and(b0_      )))
    .and(b1.and(      b0.not()).imp(b1_.and(      b0_      )))
*/
;

// b' = b + k  encoded as a BDD:
function bitstr_eqv(bs, cs) {
    var result = BDD.True,
        bitLen = bs.length;
    if (bitLen !== cs.length) {
        throw new TypeError("bitstrs must have same length - got " + bitLen + " !== " + cs.length);
    }
    for (let i = 0; i < bitLen; i++) {
        result = result.and(bs[i].eqv(cs[i]));
    }
    return result;
}

function bitstr_plus(bs, k) {
    var bitLen = bs.length,
        sum    = new Array(bitLen),
        carry  = BDD.False;
    for (let i = 0, phi; i < bitLen; i++, k >>>= 1) {
        if (k & 1) {
            sum[i] = carry.eqv(bs[i]);
            carry = carry.or(bs[i]);
        } else {
            sum[i] = carry.xor(bs[i]);
            carry = carry.and(bs[i]);
        }
    }
    sum.eqv  = function (xs) { return carry.not().and(bitstr_eqv(this, xs)) };
    sum.plus = function (k)  { return bitstr_plus(this, k) };
    return sum;
}

function bitstr_plus_(as, bs) {
    var bitLen = as.length,
        sum    = new Array(bitLen),
        carry  = BDD.False;
    for (let i = 0, a, b; i < bitLen; i++) {
        a = as[i];
        b = bs[i];
        sum[i] = carry.xor(a).xor(b);           // sum[i]    = 1  <=>  nr of 1s in {as[i], bs[i], carry} is odd
        carry = carry.ite(a.or(b), a.and(b));   // carry-out = 1  <=>  nr of 1s in {as[i], bs[i], carry} is two or three
    }
    sum.eqv  = function (xs) { return carry.not().and(bitstr_eqv(this, xs)) };
    sum.plus = function (k)  { return bitstr_plus(this, k) };
    return sum;
}

function bitstr_lt(as, bs) {
    let acc = BDD.False,
        n = as.length;
    if (bs.length !== n) {
        throw new TypeError("cannot compare bitstrs of different lengths");
    }
    for (let i = 0; i < n; i++) {
        acc = as[i].xor(bs[i]).ite(bs[i], acc);
    }
    return acc;
}

var bs  = [b0, b1, b2, b3],
    bs_ = [b0_, b1_, b2_, b3_];
bs.eqv   = function (xs) { return bitstr_eqv(this, xs) };
bs.plus  = function (k)  { return bitstr_plus(this, k) };
bs.lt    = function (xs) { return bitstr_lt(this, xs)  };
bs_.eqv  = function (xs) { return bitstr_eqv(this, xs) };
bs_.plus = function (k)  { return bitstr_plus(this, k) };
bs_.lt   = function (xs) { return bitstr_lt(this, xs)  };


//p = bs_.eqv(bitstr_plus_(bs, bs));
//p = bs_.eqv(bitstr_plus_(bs, bs));  // ignores overflow (includes wrap-around)
p = bitstr_plus_(bs, bs).eqv(bs_);  // excepts overflow (excludes wrap-around)
//p = bs_.lt(bs);
//p = b1.or(b1_).eqv(b1.and(b1_));

function filterIterator(it, f) {
    return function* () {
        var v = it.next();
        while (!v.done) {
            if (f(v.value)) {
                yield v.value;
            }
            v = it.next();
        }
        return v;
    }();
}

function mkBitStr(prefix, length) {
    const result = [],
          next   = [];
    for (let i = 0; i < length; i++) {
        let label = prefix + i;
        result.push(BDD.var(label      ));
        next.push(  BDD.var(label + "'"));
    }
    result.eqv  = function (xs) { return bitstr_eqv(this, xs) };
    result.plus = function (k)  { return bitstr_plus(this, k) };
    next.eqv    = function (xs) { return bitstr_eqv(this, xs) };
    next.plus   = function (k)  { return bitstr_plus(this, k) };

    result.next = next;
    next.before = result;
    return result;
}

var a1  = mkBitStr('a1_', 3),
    a2  = mkBitStr('a2_', 3),
    a3  = mkBitStr('a3_', 3);

function no_overlap(a, b) {
    return a.eqv(b).not();
}

function moves(as) {
    var right     = as.next.eqv(as.plus(1)),
        can_right = as.eqv([BDD.False, BDD.True, BDD.True]).not().and(as.eqv([BDD.True, BDD.True, BDD.True]).not());
    var left      = as.next.plus(1).eqv(as),
        can_left  = as.eqv([BDD.False, BDD.False, BDD.False]).not().and(as.eqv([BDD.True,  BDD.False, BDD.False]).not());
    var down      = as.next.eqv(as.plus(2)),
        can_down  = bitstr_lt(as, [BDD.True, BDD.False, BDD.False]);
    var up        = as.next.plus(2).eqv(as),
        can_up    = bitstr_lt([BDD.False, BDD.True, BDD.True], as);
    return as.next.eqv(as).not().and(
            right.and(can_right)
        .or(left.and( can_left ))
        .or(down.and( can_down ))
        .or(up.and(   can_up   ))
    );
}


p =     moves(a1).and(a2.eqv(a2.next)).and(a3.eqv(a3.next))
    .or(moves(a2).and(a1.eqv(a1.next)).and(a3.eqv(a3.next)))
    .or(moves(a3).and(a1.eqv(a1.next)).and(a2.eqv(a2.next)))
    .and(
             no_overlap(a1,      a2     )
        .and(no_overlap(a1,      a3     ))
        .and(no_overlap(a2,      a3     ))
        .and(no_overlap(a1.next, a2.next))
        .and(no_overlap(a1.next, a3.next))
        .and(no_overlap(a3.next, a2.next))
    )
;

g.node(p);

function *fromBinary(bits, idx) {
    idx = idx || 0;
    if (idx >= bits.length) {    // recursion bottom
        yield 0;
    } else {
        if (bits[idx] === undefined) {
            for (let x of fromBinary(bits, idx + 1)) {
                yield x;                // as if bits[idx] were 0
                yield (1 << idx) + x;   // as if bits[idx] were 1
            }
        } else {
            for (let x of fromBinary(bits, idx + 1)) {
                yield (bits[idx] << idx) + x;
            }
        }
    }
}

function explicit_LTS(g, vectorVars, mkLabel) {
    let label2idx = {},
        i         = 0,
        ttlBits   = 0,
        extract   = {}, // for each vectorVar (alias): a fn that takes a complete valuation and extracts the value of the single vectorVar (alias)
        satPaths  = 0,
        explEdges = 0,
        explNodes = new Set();
    for (let alias in vectorVars) {
        const vector = vectorVars[alias],
              vecLen = vector.length;
        ttlBits += vecLen;

        extract[alias] = ((start, len) => n => (n >>> start) & ((1 << len) - 1))(i, vecLen);

        for (let k = 0; k < vecLen; k++, i++) {
            const label = vector[k].label;
            label2idx[label] = i;
            // the ith in vsflat corresponds to the kth bit in vectorVars[alias]
        }
    }
    if (mkLabel === undefined) {
        mkLabel = (n, extract) => Object.keys(extract)
            .map(alias => alias + '=' + extract[alias](n))
            .join("\n");
    }

    for (let q of p.satPaths()) {
        satPaths++;
        let primed   = new Array(ttlBits);
        let unprimed = new Array(ttlBits);
        for (let v of q()) {
            let label     = v.label,
                isPrimed  = label.substr(label.length - 1, 1) === "'",
                name      = isPrimed ? label.substr(0, label.length - 1) : label;
            let i = label2idx[name];
            if (i !== undefined) {
                (isPrimed ? primed : unprimed)[i] = v.onTrue === BDD.True ? 1 : 0;
            }
        }
        for (let from of fromBinary(unprimed)) {
            if (!explNodes.has(from)) {
                explNodes.add(from);
                g.node(from, { label: mkLabel(from, extract), fontname: "Courier" });
            }
            for (let to of fromBinary(primed)) {
                if (!explNodes.has(to)) {
                    explNodes.add(to);
                    g.node(to, { label: mkLabel(to, extract), fontname: "Courier" });
                }
                g.addPath(from, to);
                explEdges++;
            }
        }
    }
    g.node("explStats", {
        label: "ttlBits: " + ttlBits + ' (expl. states <= ' + (1 << ttlBits) + ')\l'
             + "\nsatPaths: " + satPaths + '\l'
             + '\nexpl. edges:' + explEdges + '\l'
             + '\nexpl. nodes:' + explNodes.size + '\l',
        color: "invis",
    });
    return {
        ttlBits:  ttlBits,
        satPaths: satPaths,
        explEdges: explEdges,
        explNodes: explNodes.size,
    };
}

//explicit_LTS(g, { a: as });
var explStats = explicit_LTS(g, { a1: a1, a2: a2 , a3: a3 },
//    n => "" + n // mkLabel
    (n, extract) => {
        var w = 4,
            h = 2,
            lines = (new Array(h)).fill("_".repeat(w));
        Object.keys(extract).forEach(k => {
            var p = extract[k](n),
                x = p % w,
                y = Math.floor(p / w);
            lines[y] = lines[y].substr(0, x) + k.substr(1) + lines[y].substr(x + 1);
        });
        return lines.join('\n');
    }
);

var BDDstats = BDD.stats();
//console.log(BDDstats);
console.log('insts: ' + BDDstats.instCount + ', get: ' + BDDstats.getCalls + '\nite: ' + util.inspect(BDDstats.iteCalls));
console.log('size of transition rel.: ' + p.size());
console.log(explStats);

process.exit();


/* without no_overlap:
insts: 1068, get: 29181
ite: { terminal: 29386, var: 12850, irrelevantHead: 228, other: 8473 }
{ ttlBits: 9, satPaths: 2688, explEdges: 2688 }
*/
/* with no_overlap:
insts: 15538, get: 110265
ite: { terminal: 109510,
  var: 46152,
  irrelevantHead: 1248,
  other: 59227 }
{ ttlBits: 9, satPaths: 1216, explEdges: 1260 }
*/

g.label('insts: ' + BDDstats.instCount + ', get: ' + BDDstats.getCalls + '\nite: ' + util.inspect(BDDstats.iteCalls));

//g.node(a.ite(b, c));
//g.label('(ite a b c)');

g.labelloc('b');
g.fontsize(12);

if (!p.isTerminal && !omitFalse) {
   g.addPath(BDD.True, BDD.False).where({style: "invis"});
}

g.render();

console.log('----');

/*
for (let p of BDD.instances()) {
    console.log("" + p);
}
*/


