"use strict";

const util = require('util');
const gv   = require('graphviz-js');
const BDD    = require('../lib/BDD'),
      bitstr = require('../lib/BDD-bitstr').bitstr;


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
                //+ '\n' + x.satPathCount + '/' + x.neg.satPathCount,
        });
        if ((x.onTrue !== BDD.False) || !omitFalse) {
          g.addPath(x, x.onTrue);//.where({ fontsize: 9,  label: x.onTrue.satPathCount });
        }
        if ((x.onFalse !== BDD.False) || !omitFalse) {
          g.addPath(x, x.onFalse);//.where({ fontsize: 9, label: x.onFalse.satPathCount });
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



var bs  = bitstr('b', 4),
    bs_ = bs.next;

//p = bs_.eqv(bitstr_plus_(bs, bs));
//p = bs_.eqv(bitstr_plus_(bs, bs));  // ignores overflow (includes wrap-around)
p = bs.plus(bs).eq(bs_);  // excepts overflow (excludes wrap-around)
//p = bs_.lt(bs);
//p = b1.or(b1_).eqv(b1.and(b1_));

const w = 2,
      h = 2,
      bitLen = 4;
var a1  = bitstr('a1_', bitLen),
    a2  = bitstr('a2_', bitLen),
    a3  = bitstr('a3_', bitLen);

function no_overlap(a, b) {
    return a.neq(b);
}

function moves(as) {
    var right     = as.next.eq(as.plus(1)),
        can_right = as.neq(w - 1).and(as.neq(w + w - 1));   // as % w < w - 2
    var left      = as.next.plus(1).eq(as),
        can_left  = as.neq(0).and(as.neq(w));
    var down      = as.next.eq(as.plus(2)),
        can_down  = as.lt((h-1) * w);
    var up        = as.next.plus(2).eq(as),
        can_up    = as.gte(w);

    return as.next.neq(as).and(
            right.and(can_right)
        .or(left.and( can_left ))
        .or(down.and( can_down ))
        .or(up.and(   can_up   ))
    );
}


p =     moves(a1).and(a2.eq(a2.next))       //.and(a3.eq(a3.next))      //
    .or(moves(a2).and(a1.eq(a1.next))   )   //.and(a3.eq(a3.next)))     //
    //.or(moves(a3).and(a1.eq(a1.next)).and(a2.eq(a2.next)))
    .and(
             no_overlap(a1,      a2     )
        .and(no_overlap(a1.next, a2.next))
        //.and(no_overlap(a1,      a3     ))
        //.and(no_overlap(a2,      a3     ))
        //.and(no_overlap(a1.next, a3.next))
        //.and(no_overlap(a3.next, a2.next))
    )
;


function plusA(as, bs) {
    var bitLen = bs.length,
        sum    = new Array(bitLen),
        carry  = BDD.False;
    for (let i = 0, a, b; i < bitLen; i++) {
        a = as[i];
        b = bs[i];
        sum[i] = carry.xor(a).xor(b);           // sum[i]    = 1  <=>  nr of 1s in {this[i], bs[i], carry} is odd
        carry = carry.ite(a.or(b), a.and(b));   // carry-out = 1  <=>  nr of 1s in {this[i], bs[i], carry} is two or three
    }
    sum = bitstr.apply(null, sum);
    return sum;
}

function plusB(as, bs) {
    var bitLen = bs.length,
        sum    = new Array(bitLen),
        carry  = BDD.False;
    for (let i = 0, a, b; i < bitLen; i++) {
        a = as[i];
        b = bs[i];
        sum[i] = carry.ite(a.eqv(b), a.xor(b));           // sum[i]    = 1  <=>  nr of 1s in {this[i], bs[i], carry} is odd
        carry = carry.ite(a.or(b), a.and(b));   // carry-out = 1  <=>  nr of 1s in {this[i], bs[i], carry} is two or three
    }
    sum = bitstr.apply(null, sum);
    return sum;
}




var BDDstats_old;

BDDstats_old = BDD.stats();
p = plusA(a1, a2);
console.log(BDD.stats().diff(BDDstats_old));

BDDstats_old = BDD.stats();
p = plusB(a1, a2);
console.log(BDD.stats().diff(BDDstats_old));



process.exit();
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

function explicit_LTS(p, vectorVars, mkLabel) {
    let label2idx = {},
        i         = 0,
        ttlBits   = 0,
        extract   = {}, // for each vectorVar (alias): a fn that takes a complete valuation and extracts the value of the single vectorVar (alias)
        satPaths  = 0,
        explEdges = new Set(),
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
            }
            for (let to of fromBinary(primed)) {
                if (!explNodes.has(to)) {
                    explNodes.add(to);
                }
                explEdges.add((from << ttlBits) | to);
            }
        }
    }
    return {
        ttlBits:  ttlBits,
        satPaths: satPaths,
        explEdges: explEdges.size,
        explNodes: explNodes.size,
        addToGraph: g => {
            var mask = (1 << ttlBits) - 1;
            g.node("explStats", {
                label: "ttlBits: " + ttlBits + ' (expl. states <= ' + (1 << ttlBits) + ')\l'
                     + "\nsatPaths: " + satPaths + '\l'
                     + '\nexpl. edges:' + explEdges.size + '\l'
                     + '\nexpl. nodes:' + explNodes.size + '\l',
                color: "invis",
            });
            explNodes.forEach(node => g.node(node, { label: mkLabel(node, extract), fontname: "Courier" }));
            explEdges.forEach(edge => g.addPath(edge >>> ttlBits, edge & mask));
        },
    };
}

function mkLabel2(n, extract) {
    var lines = (new Array(h)).fill("_".repeat(w));
    Object.keys(extract).forEach(k => {
        var p = extract[k](n),
            x = p % w,
            y = Math.floor(p / w);
        lines[y] = lines[y].substr(0, x) + k.substr(1) + lines[y].substr(x + 1);
    });
    return lines.join('\n');
}

//explicit_LTS(g, { a: as });
var explStats;
explStats = explicit_LTS(p, { a1: a1, a2: a2 });    //, mkLabel2);
//explStats.addToGraph(g);
console.log('size of transition rel.: ' + p.size);
var BDDstats = BDD.stats();
//console.log(BDDstats);
console.log('instances: ' + BDDstats.instCount
        + '\n getCalls: ' + BDDstats.getCalls
        + '\nsizeCalls: ' + BDDstats.sizeCalls
        + '\n iteCalls: ' + util.inspect(BDDstats.iteCalls)
);

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


