"use strict";

const util   = require('util'),
      gv     = require('graphviz-js'),
      BDD    = require('./BDD'),
      bitstr = require('./BDD-bitstr').bitstr;

function withDefaults(defaults, f) {
    let result;
    f.defaults = defaults;
    result = function () {
        let optsPos = f.length - 1,
            args    = Array.prototype.slice.call(arguments, 0),
            opts    = Object.assign({}, defaults, args[optsPos] || {});
        args[optsPos] = opts;
        return f.apply(this, args);
    };
    return result;
}

const graphFromBDD = withDefaults({
        omitFalse:  true,   // don't draw edges to terminal False
        satPaths:   false,  // label edges with satPathCount (= nr of paths to terminal True)
    },
    function (bdd, opts) {
        console.log(opts);
        let g = gv.digraph();
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
                if ((x.onTrue !== BDD.False) || !opts.omitFalse) {
                    let e = g.addPath(x, x.onTrue);
                    if (opts.satPaths) {
                        e.where({ fontsize: 9,  label: x.onTrue.satPathCount });
                    }
                }
                if ((x.onFalse !== BDD.False) || !opts.omitFalse) {
                    let e = g.addPath(x, x.onFalse);
                    if (opts.satPaths) {
                        e.where({ fontsize: 9,  label: x.onFalse.satPathCount });
                    }
                }
            }
        });

        g.edgeIf( (from, to) => from.onTrue  === to, { color: "green" });
        g.edgeIf( (from, to) => from.onFalse === to, { color: "red", style: "dashed" });

        //g.edgeIf( (from, to) => (to === BDD.False) && (from !== BDD.True), { style: "invis", constraint: false });

        g.node(bdd);

        let BDDstats = BDD.stats();
        g.label('size: ' + bdd.size + '\ninsts: ' + BDDstats.instCount + ', get: ' + BDDstats.getCalls + '\nite: ' + util.inspect(BDDstats.iteCalls));
        g.labelloc('b');
        g.fontsize(12);

        // if we did draw edges to False, then let's have True to the left and False to the right
        if (!bdd.isTerminal && !opts.omitFalse) {
           g.addPath(BDD.True, BDD.False).where({style: "invis"});
        }

        return g;
    }
);




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


/*
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
*/




module.exports = {
    digraph: graphFromBDD,
    render:  function (bdd, opts) {
        return this.digraph(bdd, opts).render(opts);
    },

};
