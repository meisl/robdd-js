Motivation:
---
can be exploited in serialization by
reflecting some of the symmetry in the BDD's structure;
takes advantage of sharing if implemented right.


Define non-boolean operations on BDDs:
---
- swap: exchange thenChild/elseChild
- flip ("recursive swap")
- flop: flip-then-swap (same as swap-then-flip, as proved below)


Theorems 
---
...about swap, flip, their concatenation (flop) plus some stuff re the connection to Boolean NOT


Implementation notes
---
What to take care of in BDD ctor in store when precalculated (particularly flip, since swap is rather cheap);
discuss how this interacts with precalculation of Boolean NOT.

