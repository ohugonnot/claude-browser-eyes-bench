#!/usr/bin/env python3
# Random interleaved order of the 12 runs (4 conditions x 3), fixed seed stored in harness/SEED.
import os, random
here = os.path.dirname(os.path.abspath(__file__))
seed = int(open(os.path.join(here, 'SEED')).read().strip())
runs = [f"{c}-{n}" for c in ("c0", "c1", "c2", "c3") for n in (1, 2, 3)]
random.Random(seed).shuffle(runs)
print("\n".join(runs))
