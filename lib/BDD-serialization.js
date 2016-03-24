"use strict";

const util   = require('util');
const pa     = require('pimped-assert'),
      assert = pa.assert,
      refute = pa.refute;

const BDD = require('./BDD'),
      T      = BDD.True,
      F      = BDD.False,
      ite    = BDD.ite,
      not    = BDD.not,
      and    = BDD.and,
      or     = BDD.or,
      eqv    = BDD.eqv,
      xor    = BDD.xor,
      imp    = BDD.imp
;
const RLE           = require('./RLE'),
      SlotAllocator = require('./SlotAllocator')
;

const FLAG_SWAP  = 1 << 0,
      FLAG_FLIP  = 1 << 1,
      FLAG_REUSE = 1 << 2;

function fmt(x, n) {
    let result = "" + x;
    if (result.length < n) {
        result = " ".repeat(n - result.length) + result;
    }
    return result;
}

function nth(x, n) {
    switch (x % 10) {
        case 1: return fmt(x + "st", n || 0);
        case 2: return fmt(x + "nd", n || 0);
        case 3: return fmt(x + "rd", n || 0);
        default:
            return fmt(x + "th", n || 0);
    }
}

function Program(o, opts) {
    let labels2Idx = {},
        info = new Map();
    this.labelIdx = function (bdd) {
        assert(BDD.isBDD(bdd), "expected a BDD, got " + util.inspect(bdd));
        if (bdd === T) return -2;
        if (bdd === F) return -1;
        let label  = bdd.label,
            result = labels2Idx[label];
        if (result === undefined) {
            if (Object.isFrozen(labels2Idx)) {
                throw new Error("no such label: " + util.inspect(label));
            }
            result = labels2Idx[label] = this.labels.length;
            this.labels.push(label);
        }
        return result;
    };
    let infoByIdx = [];
    this.getInfo = i => infoByIdx[i];
    this.pushInfo = entry => {
        let i = infoByIdx.length;
        infoByIdx[i] = entry;
        return i;
    };
    this.info = info;
    info.program = this;
    addInfo(info, T, 0);
    addInfo(info, F, 1);

    if (BDD.isBDD(o)) {
        this.labels = [];
        this.maxLen = 2;
        Object.defineProperty(this, "BDDsize",          { value: o.size,        enumerable: true });    // TODO: set BDDsize from traversal in _serialize
        Object.defineProperty(this, "BDDheight",        { value: o.height,      enumerable: true });
        Object.defineProperty(this, "labelDeltasRLE",   { value: RLE.init(),    enumerable: true });
        Object.defineProperty(this, "thenSlotsRLE",     { value: RLE.init(),    enumerable: true });
        Object.defineProperty(this, "elseSlotsRLE",     { value: RLE.init(),    enumerable: true });
        if (o.isTerminal) {
            Object.defineProperty(this, "resultSlot", { value: info.get(o).slot, enumerable: true });
        } else {
            _serialize(o, this, opts);
        }
        Object.freeze(labels2Idx);
    } else if (util.isObject(o)) {
        this.labels = o.labels;
        this.maxLen = o.maxLen;
        Object.defineProperty(this, "BDDsize",        { value: o.BDDsize,                       enumerable: true });
        Object.defineProperty(this, "BDDheight",      { value: o.BDDheight,                     enumerable: true });
        Object.defineProperty(this, "labelDeltasRLE", { value: RLE.fromJSON(o.labelDeltasRLE),  enumerable: true });
        Object.defineProperty(this, "thenSlotsRLE",   { value: RLE.fromJSON(o.thenSlotsRLE),    enumerable: true });
        Object.defineProperty(this, "elseSlotsRLE",   { value: RLE.fromJSON(o.elseSlotsRLE),    enumerable: true });
        Object.defineProperty(this, "resultSlot",     { value: o.resultSlot,                    enumerable: true });
    } else {
        throw new TypeError("expected a BDD or JSON (object) - got ", util.inspect(o));
    }
}

Program.prototype.decodeSlots = function () {
    let swapCount   = 0,
        flipCount   = 0,
        flopCount   = 0,
        thenSlotsIt = this.thenSlots(),
        elseSlotsIt = this.elseSlots(),
        nextThen, thenValue,
        nextElse, elseValue;
    while (!(nextThen = thenSlotsIt.next()).done) {
        nextElse = elseSlotsIt.next();
        thenValue = nextThen.value;
        elseValue = nextElse.value;
        if (thenValue & FLAG_SWAP) swapCount++;
        if (thenValue & FLAG_FLIP) flipCount++;
        if ((thenValue & FLAG_SWAP) && (thenValue & FLAG_FLIP)) flopCount++;
        if (elseValue & FLAG_SWAP) swapCount++;
        if (elseValue & FLAG_FLIP) flipCount++;
        if ((elseValue & FLAG_SWAP) && (elseValue & FLAG_FLIP)) flopCount++;
    }
    Object.defineProperties(this, {
        swapCount: { value: swapCount, enumerable: true, writable: false, configurable: false },
        flipCount: { value: flipCount, enumerable: true, writable: false, configurable: false },
        flopCount: { value: flopCount, enumerable: true, writable: false, configurable: false },
    });
    return this;
};

Object.defineProperties(Program.prototype, {
    labelCount:       { get: function () { return this.labels.length                 }, },
    instructionCount: { get: function () { return this.labelDeltasRLE.decodedLength; }, },

    resultSlot:       { get: function () { return this.getInfo(this.instructionCount - 1).slot; }, },

    swapCount:        { get: function () { return this.decodeSlots().swapCount;      }, }, // decodeSlots returns the instance (this) and on it will
    flipCount:        { get: function () { return this.decodeSlots().flipCount;      }, }, // ... have overridden .swapCount, .flipCount, and
    flopCount:        { get: function () { return this.decodeSlots().flopCount;      }, }, // ... .flopCount with value props holding the actual values.

    labelDeltas:      { value: function () { return this.labelDeltasRLE.values();    }, },
    thenSlots:        { value: function () { return this.thenSlotsRLE.values();      }, },
    elseSlots:        { value: function () { return this.elseSlotsRLE.values();      }, },
});

Program.prototype.init = function (map) {
    let xs = new Array(this.maxLen);
    map = map || (x => x);
    xs[this.info.get(T).slot] = map(T);
    xs[this.info.get(F).slot] = map(F);
    return xs;
};

const decodedInstr_prototype = Object.create({}, {
    labelIndex: { get: function () { return this.labelDelta + Math.max(this.thenLabelIndex, this.elseLabelIndex); } },
    reuseThen:  { get: function () { return !!(this.thenFlags & FLAG_REUSE); } },
    swapThen:   { get: function () { return !!(this.thenFlags & FLAG_SWAP);  } },
    flipThen:   { get: function () { return !!(this.thenFlags & FLAG_FLIP);  } },
    reuseElse:  { get: function () { return !!(this.elseFlags & FLAG_REUSE); } },
    swapElse:   { get: function () { return !!(this.elseFlags & FLAG_SWAP);  } },
    flipElse:   { get: function () { return !!(this.elseFlags & FLAG_FLIP);  } },
});

Program.prototype.decode = function (cb) {
    let n            = this.instructionCount,
        pc           = 0,
        deltasIt     = this.labelDeltas(),
        thenSlotsIt  = this.thenSlots(),
        elseSlotsIt  = this.elseSlots(),
        labelIndexes = this.init(this.labelIdx),
        allocator    = SlotAllocator.init(2, this.maxLen),
        labelDelta,
        targetSlot,
        thenSlot,
        thenFlags,
        elseSlot,
        elseFlags,
        instr = Object.create(decodedInstr_prototype, {
            pc:             { get: () => pc                     },
            slot:           { get: () => targetSlot             },
            maxLen:         { get: () => allocator.maxLen       },
            labelDelta:     { get: () => labelDelta             },
            thenSlot:       { get: () => thenSlot               },
            thenFlags:      { get: () => thenFlags              },
            thenLabelIndex: { get: () => labelIndexes[thenSlot] },
            elseSlot:       { get: () => elseSlot               },
            elseFlags:      { get: () => elseFlags              },
            elseLabelIndex: { get: () => labelIndexes[elseSlot] },
        })
    ;
    while (pc < n) {
        let thenValue = thenSlotsIt.next().value,
            elseValue = elseSlotsIt.next().value;
        labelDelta = deltasIt.next().value;

        thenSlot   = thenValue >>> 3;
        thenFlags  = thenValue & (FLAG_SWAP | FLAG_FLIP | FLAG_REUSE);
        elseSlot   = elseValue >>> 3;
        elseFlags  = elseValue & (FLAG_SWAP | FLAG_FLIP | FLAG_REUSE);
        targetSlot = allocator.get(thenSlot, instr.reuseThen, elseSlot, instr.reuseElse);

        cb(instr);

        labelIndexes[targetSlot] = instr.labelIndex;
        pc++;
    }
};

Program.prototype.run = function (cb) {
    let results      = this.init(),
        labels       = this.init(() => undefined),
        thenChildren = this.init(),
        elseChildren = this.init()
    ;
    this.decode(instr => {
        let label      = this.labels[instr.labelIndex],
            thenSlot   = instr.thenSlot,    thenChild = results[thenSlot],
            elseSlot   = instr.elseSlot,    elseChild = results[elseSlot],
            targetSlot = instr.slot
        ;

        // implement swap by letting cb construct it, so any label mappings are applied correctly:
        if (instr.swapThen) thenChild = cb(labels[thenSlot], elseChildren[thenSlot], thenChildren[thenSlot], instr);
        if (instr.flipThen) thenChild = flip(thenChild);

        // implement swap by letting cb construct it, so any label mappings are applied correctly:
        if (instr.swapElse) elseChild = cb(labels[elseSlot], elseChildren[elseSlot], thenChildren[elseSlot], instr);
        if (instr.flipElse) elseChild = flip(elseChild);

        // keep operands for later (in particular to be able to handle swaps)
        labels[targetSlot] = label;
        thenChildren[targetSlot] = thenChild;
        elseChildren[targetSlot] = elseChild;

        results[targetSlot] = cb(label, thenChild, elseChild, instr);
    });
    return results[this.resultSlot];
};

Program.prototype.stats = function () {
    let jsonLength = JSON.stringify(this).length,
        result = {
        maxLen:             this.maxLen,
        labelCount:         this.labelCount,
        instructionCount:   this.instructionCount,
        swapCount:          this.swapCount,
        flipCount:          this.flipCount,
        flopCount:          this.flopCount,
        BDDheight:          this.BDDheight,
        BDDsize:            this.BDDsize,
        JSONlength:         jsonLength,
        bitsPerNode:        Math.round(jsonLength * 80 / this.BDDsize) / 10,
        labelDeltasPct:     Math.round(this.labelDeltasRLE.encodedLength / this.labelDeltasRLE.decodedLength * 1000) / 10,
        thenSlotsPct:       Math.round(this.thenSlotsRLE.encodedLength / this.thenSlotsRLE.decodedLength * 1000) / 10,
        elseSlotsPct:       Math.round(this.elseSlotsRLE.encodedLength / this.elseSlotsRLE.decodedLength * 1000) / 10,
    };
    Object.defineProperty(result, "toString", {
        value: function () { return util.inspect(this) }
    });
    return result;
};

Program.prototype.toJSON = function () {
    return {
        maxLen:         this.maxLen,
        BDDsize:        this.BDDsize,
        BDDheight:      this.BDDheight,
        resultSlot:     this.resultSlot,
        labels:         this.labels,
        labelDeltasRLE: this.labelDeltasRLE,
        thenSlotsRLE:   this.thenSlotsRLE,
        elseSlotsRLE:   this.elseSlotsRLE,
    };
};

Program.prototype.optimize = function () {
    let n  = this.instructionCount,
        thenSlots = this.thenSlotsRLE.clear(),
        elseSlots = this.elseSlotsRLE.clear(),
        allocator = SlotAllocator.init(2, this.maxLen);
    let lines = ["    test.init([0,1], { maxLenLimit: "];
    for (let pc = 0; pc < n; pc++) {
        let instr = this.getInfo(pc),
            thenSlot = instr.thenSlot, reuseThen = instr.reuseThen, swapThen = instr.swapThen, flipThen = instr.flipThen,
            elseSlot = instr.elseSlot, reuseElse = instr.reuseElse, swapElse = instr.swapElse, flipElse = instr.flipElse;
        // change target slot (affects only then/else slots in *subsequent* instructions)
        instr.slot = allocator.get(thenSlot, reuseThen, elseSlot, reuseElse);
        thenSlots.add((thenSlot << 3) | (reuseThen ? FLAG_REUSE : 0) | (swapThen ? FLAG_SWAP : 0) | (flipThen ? FLAG_FLIP : 0) );
        elseSlots.add((elseSlot << 3) | (reuseElse ? FLAG_REUSE : 0) | (swapElse ? FLAG_SWAP : 0) | (flipElse ? FLAG_FLIP : 0) );

        lines.push(
            "    .step(" + fmt(instr.thenChild.labelIndex < 0 ? instr.thenChild.slot - 2 : instr.thenChild.instruction, ("-" + this.maxLen).length)
                    + ", " + fmt(reuseThen, 5) + ", "
                    + fmt(instr.elseChild.labelIndex < 0 ? instr.elseChild.slot - 2 : instr.elseChild.instruction, ("-" + this.maxLen).length)
                    + ", " + fmt(reuseElse, 5)
                + ")"
                + "    // " + instr.code
        );
    }
    this.maxLen = allocator.maxLen;
    //console.log("--- maxLen=" + this.maxLen);
    lines[0] += this.maxLen + ', title: "(height ' + this.BDDheight + ", size " + this.BDDsize + ')" })';
    lines.push(";");
    //console.log(lines.join("\n    "));

    return this;
};

Program.prototype.toString = function () {
    let n      = (this.maxLen + "").length,
        m      = (this.labels.length + "").length,
        o      = (this.instructionCount + "").length,
        result = ["let _ = new Array(" + this.maxLen + "),  // BDDheight = " + this.BDDheight + ", BDDsize = " + this.BDDsize,
                  "    g = " + JSON.stringify(this.labels),
                  "      .map(l => (s,t,e) => { _[s] = get(l, _[t], _[e]) });",
        ];
    this.init().slice(0, 2).forEach(bdd => {
        let info = this.info.get(bdd),
            maxP = info.maxParent,
            minP = info.minParent;
        result.push(
            util.format("%s_[%s] = %s; %s// %s  { minP: %s, maxP: %s }",
                fmt("", 2 + m),
                fmt(info.slot, n), // targetSlot
                bdd.toString(),
                fmt("", 2*n),
                fmt("", o),
                fmt(minP, n),
                fmt(maxP, n)
            )
        );
    });
    this.decode(instr => {
        let pc   = instr.pc,
            minP = instr.minParent,
            maxP = instr.maxParent,
            line = util.format("/*%s*/ g[%s](%s, %s%s, %s%s); // labelDelta: %s, maxLen: %s, minP: %s, maxP: %s",
                fmt(instr.pc, o),
                fmt(instr.labelIndex, m),
                fmt(instr.slot, n),
                (instr.swapThen ? "s" : " ") + (instr.flipThen ? "f" : " ") + fmt(instr.thenSlot, n),
                (instr.reuseThen ? "*" : " "),
                (instr.swapElse ? "s" : " ") + (instr.flipElse ? "f" : " ") + fmt(instr.elseSlot, n),
                (instr.reuseElse ? "*" : " "),
                fmt((instr.labelDelta < 0 ? "-" : "+") + instr.labelDelta, m),
                fmt(instr.maxLen, n),
                fmt(isFinite(minP) ? minP : "-", n),
                fmt(isFinite(maxP) ? maxP : "-", n)
            );
        //console.log(line);
        result.push(line);
    });
    result.push("return _[" + this.resultSlot + "];");
    return result.join("\n");
};

let flipMap = new Map();

function flip(bdd) {
    let result = flipMap.get(bdd);
    if (result === undefined) {
        result = bdd.isTerminal
            ? bdd
            : BDD.get(bdd.label, flip(bdd.onFalse), flip(bdd.onTrue));
        flipMap.set(bdd, result);
        flipMap.set(result, bdd);
    }
    return result;
}

function swap(bdd) {
    return bdd.isTerminal
        ? bdd
        : BDD.get(bdd.label, bdd.onFalse, bdd.onTrue)
    ;
}



function _serialize(bdd, prg, opts) {
    let entry;
    if (!(entry = prg.info.get(bdd))) {
        if (opts.useSwap && (entry = prg.info.get(swap(bdd)))) {
            entry = entry.swapped;
        } else if (opts.useFlip && (entry = prg.info.get(flip(bdd)))) {
            entry = entry.flipped;
        } else if (opts.useFlop && (entry = prg.info.get(swap(flip(bdd))))) {
            entry = entry.swapped.flipped;  //  entry.flipped.swapped;  //
        } else {
            let thenInfo,
                elseInfo;
            //if (bdd.onTrue.satPathCount > bdd.onFalse.satPathCount) { // (10: >: 285/296  | <: 288/315) / (9: >: 149/156 | <: 154/148 | t,e: 147/158 | e,t: 159/147)
            //    thenInfo = _serialize(bdd.onTrue,  prg);
            //    elseInfo = _serialize(bdd.onFalse, prg);
            //} else {
                thenInfo = _serialize(bdd.onTrue,  prg, opts);
                elseInfo = _serialize(bdd.onFalse, prg, opts);
            //}

            entry = addInfo(prg.info, bdd, thenInfo, elseInfo);   // in there: targetSlot is set to prg.maxLen++
            //console.log(">>>> " + entry.code);

            refute.same(entry.program.BDDsize, undefined);
            if (bdd.onTrue.isTerminal) {
                assert.same(entry.swapThen, false, "no point in swapping terminal then-child " + bdd.onTrue + " in " + entry.code);
            }
            if (bdd.onFalse.isTerminal) {
                assert.same(entry.swapElse, false, "no point in swapping terminal else-child " + bdd.onFalse + " in " + entry.code);
            }
            assert.same(entry.swapThen, thenInfo.isSwapped, ".swapThen in " + entry.code);
            assert.same(entry.swapElse, elseInfo.isSwapped, ".swapElse in " + entry.code);
        }
    }
    return entry;
}

function InfoEntry() {
}

Object.defineProperties(InfoEntry.prototype, {
    slot:      { get: function () {
                        return this._slot;
                      },
                 set: function (s) {
                        if (s !== this.slot) {
                            Object.defineProperty(this, "_slot", { value: s, enumerable: false, writable: true });
                        }
                        return s;
                    },
                 enumerable: true,
               },
    instruction:   { get: function () { throw new Error("no instruction for " + util.inspect(this)); } },
    maxParent:     { get: function () { let ps = this.parents, n = ps.length; return n === 0 ? Infinity : ps[n - 1].instruction; }, configurable: false },
    minParent:     { get: function () { return Math.min(...this.parents.map(p => p.instruction));   }, configurable: false },
    thenSlot:      { get: function () { return this.thenChild.slot; },      enumerable: true, configurable: false },
    elseSlot:      { get: function () { return this.elseChild.slot; },      enumerable: true, configurable: false },
    swapThen:      { get: function () { return this.thenChild.isSwapped; }, enumerable: true, configurable: false },
    swapElse:      { get: function () { return this.elseChild.isSwapped; }, enumerable: true, configurable: false },
    flipThen:      { get: function () { return this.thenChild.isFlipped; }, enumerable: true, configurable: false },
    flipElse:      { get: function () { return this.elseChild.isFlipped; }, enumerable: true, configurable: false },
    reuseThen: {
        get: function () { return this.thenChild.maxParent === this.instruction; },
        enumerable:   true,
        configurable: false,
    },
    reuseElse: {
        get: function () {
            return (this.thenSlot !== this.elseSlot) // don't reuse the same slot twice!
                && (this.elseChild.maxParent === this.instruction);
        },
        enumerable:   true,
        configurable: false,
    },
    isSwapped:     { enumerable: true, configurable: false, value: false },
    swapped: {
        get: function () {
            // If we get in here we know two things: a) *this* is NOT swapped and b) its swapped instance hasn't been constructed yet.
            // This is because in executing this getter we replace it (the very getter) by *this*' swapped instance:
            let _swapped = Object.create(this, {
                // isFlipped taken from prototype, ie. *this*
                isSwapped: { enumerable: true, configurable: false, value: true, /* shadows *this*' prototype's isSwapped */  },
                swapped:   { enumerable: true, configurable: false, value: this, /* shadows *this*' prototype's swapped */    },
            });
            Object.defineProperty(this,
                "swapped", { enumerable: true, configurable: false, value: _swapped } // configurable: false to prevent further changes
            );
            let x = _swapped.flipped; // call getter (from *this*) to set prop .flipped on _swapped (needs _swapped.swapped initialized!)

            _swapped = Object.freeze(_swapped); // let's freeze it to enforce that every write to it actually happens on *this*
            // Note: we DO NOT add _swapped to this.program.info!
            return _swapped;
        }
    },
    isFlipped:     { enumerable: true, configurable: false, value: false },
    flipped: {
        get: function () {
            // If we get in here we know two things: a) *this* is NOT flipped and b) its flipped instance hasn't been constructed yet.
            // This is because in executing this getter we replace it (the very getter) by *this*' flipped instance:
            let _flipped = Object.create(this, {
                // isSwapped taken from prototype, ie. *this*
                isFlipped: { enumerable: true, configurable: false, value: true, /* shadows *this*' prototype's isFlipped */  },
                flipped:   { enumerable: true, configurable: false, value: this, /* shadows *this*' prototype's flipped */    },
            });
            Object.defineProperty(this,
                "flipped", { enumerable: true, configurable: false, value: _flipped } // configurable: false to prevent further changes
            );
            let x = _flipped.swapped; // call getter (from *this*) to set prop .swapped on _flipped (needs _flipped.flipped initialized!)

            _flipped = Object.freeze(_flipped); // let's freeze it to enforce that every write to it actually happens on *this*
            // Note: we DO NOT add _flipped to this.program.info!
            return _flipped;
        }
    },
    code: {
        get: function () {
            let n      = (this.program.BDDsize + "").length,
                m      = n + "swap(".length,
                o      = ("" + (this.program.BDDheight*2)).length,
                result = [" ".repeat(n) + ":", fmt(this.slot, n), "<-"];
            if (this.program.info.get(T) === this) {
                result.push("T");
            } else if (this.program.info.get(F) === this) {
                result.push("F");
            } else {
                result[0] = fmt(this.instruction, n) + ": ";
                result.push("[" + fmt(this.labelIndex, o) + "/" + (this.labelDelta < 0 ? this.labelDelta : "+" + this.labelDelta) + "],");
                if (this.swapThen) {
                    if (this.flipThen) {
                        result.push("flop(" + fmt(this.thenSlot, n) + "),");
                    } else {
                        result.push("swap(" + fmt(this.thenSlot, n) + "),");
                    }
                } else if (this.flipThen) {
                    result.push("flip(" + fmt(this.thenSlot, n) + "),");
                } else {
                    result.push(fmt(this.thenSlot, m) + " ,");
                }
                if (this.swapElse) {
                    if (this.flipElse) {
                        result.push("flop(" + fmt(this.elseSlot, n) + ")");
                    } else {
                        result.push("swap(" + fmt(this.elseSlot, n) + ")");
                    }
                } else if (this.flipElse) {
                    result.push("flip(" + fmt(this.elseSlot, n) + ")");
                } else {
                    result.push(fmt(this.elseSlot, m) + " ");
                }
            }
            result.push("// maxParent: ");
            result.push(this.maxParent);
            return result.join(' ');
        },
        enumerable: true,
    }
});

function addInfo(info, bdd, p, q) {
    let prg   = info.program,
        entry = Object.create(InfoEntry.prototype, {
            program:     { value: prg,               enumerable: false,  writable: false },
            labelIndex:  { value: prg.labelIdx(bdd), enumerable: true,   writable: false },
            parents:     { value: [],                enumerable: false,  writable: false },
        })
    ;

    info.set(bdd, entry);
    if (bdd.isTerminal) {
        let slot = p;
        // override inherited accessor slot:
        Object.defineProperty(entry, "slot", { value: slot, enumerable: true, writable: false });
    } else {
        let thenChild   = p,
            elseChild   = q,
            m           = Math.max(thenChild.labelIndex, elseChild.labelIndex),
            labelDelta  = entry.labelIndex - m,    //(m < 0) ? -labelIndex : labelIndex - m;
            pc          = prg.pushInfo(entry);
        Object.defineProperty(entry, "labelDelta",  { value: labelDelta, enumerable: true, writable: false });
        prg.labelDeltasRLE.add(labelDelta);
        entry.slot = prg.maxLen++;
        Object.defineProperty(entry, "instruction", { value: pc,         enumerable: true, writable: false });

        thenChild.parents.push(entry);
        Object.defineProperty(entry, "thenChild", { value: thenChild, enumerable: true, configurable: false });

        elseChild.parents.push(entry);
        Object.defineProperty(entry, "elseChild", { value: elseChild, enumerable: true, configurable: false });

    }
    return entry;
}

function serialize(bdd, opts) {
    opts = Object.assign({
        useSwap: true,
        useFlip: true,
        useFlop: true,
    }, opts || {});
    let p         = new Program(bdd, opts),
        n         = p.instructionCount,
        thenSlots = p.thenSlotsRLE.clear(),
        elseSlots = p.elseSlotsRLE.clear();
    for (let i = 0; i < n; i++) {
        let instr  = p.getInfo(i);
        // don't add reuse flags!
        thenSlots.add((instr.thenSlot << 3) | (instr.swapThen ? FLAG_SWAP : 0) | (instr.flipThen ? FLAG_FLIP : 0));
        elseSlots.add((instr.elseSlot << 3) | (instr.swapElse ? FLAG_SWAP : 0) | (instr.flipElse ? FLAG_FLIP : 0));
    }
    return p;
}


function fromJSON(jsonTxt) {
    return new Program(JSON.parse(jsonTxt));
}

function deserialize(p) {
    if (util.isString(p)) {
        p = fromJSON(p);
    }
    return p.run(BDD.get);
}


module.exports = {
    serialize:   serialize,
    deserialize: deserialize,
    fromJSON:    fromJSON,
};


