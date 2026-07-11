#!/usr/bin/env python3
"""Generate parity fixtures for the TypeScript port (Phase 0 + Phase 1).

This is the ORACLE. It reimplements the Swift app's RNG (splitmix64), the stdlib
`next(upperBound:)` (Lemire) used by shuffle, WheelFactory.makeWheels, and
ContactPointCalculator.wheelHeight — faithfully to the Swift source (NOT to
diagnostic_sim.py, which has two latent bugs: it uses modulo-rejection for the shuffle
and rejection-sampling for false-gate counts where Swift uses plain modulo).

Run:  python3 tools/gen_rng_fixtures.py   (or: npm run fixtures)
Writes test/vectors/{rng,angle,wheels}.json. The TS ports are asserted against these.
64-bit values are decimal strings (they can exceed Number.MAX_SAFE_INTEGER).
"""
import json, math, os

MASK64 = (1 << 64) - 1
def u64(x): return x & MASK64

class SeededRNG:
    def __init__(self, seed):
        self.state = u64(0x9e3779b97f4a7c15) if seed == 0 else u64(seed)

    def next(self):
        self.state = u64(self.state + 0x9e3779b97f4a7c15)
        z = self.state
        z = u64((z ^ (z >> 30)) * 0xbf58476d1ce4e5b9)
        z = u64((z ^ (z >> 27)) * 0x94d049bb133111eb)
        return z ^ (z >> 31)

    def next_double(self):
        return (self.next() >> 11) * (1.0 / (1 << 53))

    def next_double_in(self, lo, hi):
        return lo + self.next_double() * (hi - lo)

    def next_int(self, lo, hi):
        """Swift SeededRNG.nextInt(in:) — plain modulo, always one draw."""
        span = hi - lo + 1
        return lo + (self.next() % span)

    def next_upper_bound(self, bound):
        """Swift stdlib next(upperBound:) — Lemire's nearly-divisionless. [0, bound)."""
        random = self.next()
        m = random * bound
        low = m & MASK64
        if low < bound:
            t = ((1 << 64) - bound) % bound
            while low < t:
                random = self.next()
                m = random * bound
                low = m & MASK64
        return m >> 64

    def random_int(self, lo, hi_excl):
        return lo + self.next_upper_bound(hi_excl - lo)

    def shuffle(self, arr):
        """Swift Array.shuffle(using:) — forward Fisher-Yates via next(upperBound:)."""
        amount = len(arr)
        if amount <= 1:
            return
        current = 0
        while amount > 1:
            r = self.next_upper_bound(amount)
            amount -= 1
            arr[current], arr[current + r] = arr[current + r], arr[current]
            current += 1

# ── geometry ────────────────────────────────────────────────────────────────
def circ(a, b, r):
    d = math.fmod(a - b, r)
    if d < 0:
        d += r
    return min(d, r - d)

def oval_fn(pos, bump, r, ecc, freq):
    if ecc <= 0:
        return 0.0
    delta = math.fmod(pos - bump, r)
    if delta < 0:
        delta += r
    return ecc * math.cos(2 * math.pi * freq * delta / r)

def surface_noise(pos, samples, r):
    if not samples:
        return 0.0
    t = pos / r * len(samples)
    i0 = int(t) % len(samples)   # int() truncates toward zero, like Swift Int()
    i1 = (i0 + 1) % len(samples)
    frac = t - math.floor(t)
    return samples[i0] * (1 - frac) + samples[i1] * frac

# ── WheelFactory (faithful to WheelFactory.swift) ────────────────────────────
def make_wheels(p):
    rng = SeededRNG(int(p['seed']))
    count = p['wheelCount']

    # base heights
    if p.get('baseHeightsByRank') and len(p['baseHeightsByRank']) == count:
        ranked = list(p['baseHeightsByRank'])
    else:
        ranked = [1.0 - p['heightSpread'] * rank / max(count - 1, 1) for rank in range(count)]
    ho = p['heightOrdering']
    if ho['kind'] == 'inOrder':
        ranked.reverse()
    elif ho['kind'] == 'random':
        rng.shuffle(ranked)
    elif ho['kind'] == 'custom':
        ordered = [1.0] * count
        for rank, wi in enumerate(ho['mapping']):
            if wi < count:
                ordered[wi] = ranked[rank]
        ranked = ordered

    nr = p['numberRange']
    fr = p['ovalFrequencyRange']
    nhr = p['noiseHarmonicFrequencyRange']
    amp = p['surfaceNoiseAmplitude']
    fg_cfg = p.get('falseGateConfig')
    gates = p['combination']
    safe = min(count, len(gates))
    wheels = []
    for i in range(safe):
        oval_bump_raw = rng.next_double_in(0.0, nr - 1.0)
        oval_bump = p['ovalBumpPositionOverride'] if p.get('ovalBumpPositionOverride') is not None else oval_bump_raw
        oval_freq = fr[0] if fr[0] == fr[1] else rng.next_double_in(fr[0], fr[1])

        if amp > 0:
            harmonics = [(rng.next_double_in(0.1, 1.0), rng.next_double_in(nhr[0], nhr[1]),
                          rng.next_double_in(0.0, 2 * math.pi)) for _ in range(4)]
            total = sum(h[0] for h in harmonics)
            scale = amp / total if total > 0 else 0.0
            noise = [sum(h[0] * scale * math.sin(h[1] * (j / 200.0 * 2 * math.pi) + h[2]) for h in harmonics)
                     for j in range(200)]
        else:
            noise = [0.0] * 200

        fgs = _false_gates(i, gates[i], p, fg_cfg, rng)
        wheels.append({
            'index': i, 'gatePosition': gates[i], 'baseHeight': ranked[i],
            'noiseSamples': noise, 'falseGates': fgs,
            'ovalBumpPosition': oval_bump, 'ovalFrequency': oval_freq,
        })
    return wheels

def _false_gates(wi, gate, p, cfg, rng):
    if not cfg:
        return []
    elig = cfg.get('eligibleWheelIndices')
    if elig is not None and wi not in elig:
        return []
    dist = cfg['distribution']
    cr = cfg['countRange']
    k = dist['kind']
    if k == 'lastWheelOnly':
        if wi != p['wheelCount'] - 1:
            return []
        count = rng.next_int(cr[0], cr[1])
    elif k == 'allWheels':
        count = rng.next_int(cr[0], cr[1])
    elif k == 'randomSubset':
        if rng.next_double() >= dist['probability']:
            return []
        count = rng.next_int(cr[0], cr[1])
    elif k == 'halvingBase':
        n, prob = 0, dist['probability']
        while prob > 0.001:
            if rng.next_double() < prob:
                n += 1
                prob /= 2
            else:
                break
        count = n
    if count <= 0:
        return []

    nr = p['numberRange']
    min_sep = 2.0 * p['gateWidth']
    seam = p['gateSeamBuffer']
    cand_lo = math.ceil(seam)
    cand_hi = min(nr - 1, math.floor(nr - seam))
    positions, attempts = [], 0
    while len(positions) < count and attempts < 300 and cand_lo <= cand_hi:
        attempts += 1
        cand = math.trunc(rng.next_double_in(cand_lo, cand_hi))
        too_close = circ(cand, gate, nr) < min_sep or any(circ(cand, pp, nr) < min_sep for pp in positions)
        if not too_close:
            positions.append(cand)
    width = cfg['width'] if cfg['width'] is not None else p['gateWidth']
    dr = cfg['depthRatioRange']
    return [{'position': pos, 'depthRatio': rng.next_double_in(dr[0], dr[1]), 'width': width} for pos in positions]

def wheel_height(w, p, pos):
    nr = p['numberRange']
    oval = oval_fn(pos, w['ovalBumpPosition'], nr, p['ovalEccentricity'], w['ovalFrequency'])
    noise = surface_noise(pos, w['noiseSamples'], nr)
    surface = w['baseHeight'] + oval + noise
    def alpha_sq(d, width):
        a = max(0.0, 1.0 - d / width)
        return a * a
    cut = alpha_sq(circ(pos, w['gatePosition'], nr), p['gateWidth'])
    for fg in w['falseGates']:
        cut += alpha_sq(circ(pos, fg['position'], nr), fg['width']) * fg['depthRatio']
    cut = min(1.0, cut)
    return surface - max(0.0, surface) * cut

# ── fixture assembly ─────────────────────────────────────────────────────────
def next_seq(seed, n):
    r = SeededRNG(seed); return [str(r.next()) for _ in range(n)]
def dbl_seq(seed, n):
    r = SeededRNG(seed); return [repr(r.next_double()) for _ in range(n)]
def dbl_in_seq(seed, lo, hi, n):
    r = SeededRNG(seed); return [repr(r.next_double_in(lo, hi)) for _ in range(n)]
def int_seq(seed, lo, hi, n):
    r = SeededRNG(seed); return [r.next_int(lo, hi) for _ in range(n)]

rng_fixtures = {
    "_comment": "Oracle output for the TS SeededRNG port. 64-bit ints are decimal strings.",
    "next": {"42": next_seq(42, 20), "1": next_seq(1, 1), "2": next_seq(2, 1),
             "0": next_seq(0, 1), "12345": next_seq(12345, 10), "99": next_seq(99, 4)},
    "nextDouble": {"99": dbl_seq(99, 8), "7": dbl_seq(7, 8)},
    "nextDoubleIn": {"7:-5:5": {"seed": 7, "lo": -5.0, "hi": 5.0, "values": dbl_in_seq(7, -5.0, 5.0, 8)}},
    "nextInt": {"13:0:39": {"seed": 13, "lo": 0, "hi": 39, "values": int_seq(13, 0, 39, 20)}},
}

# nextUpperBound + shuffle (Lemire) — replaces the old modulo swiftInt fixtures.
def upper_bound_seq(seed, bounds):
    r = SeededRNG(seed); return [str(r.next_upper_bound(b)) for b in bounds]
def shuffle_result(seed, n):
    r = SeededRNG(seed); arr = list(range(n)); r.shuffle(arr); return arr

rng_fixtures["nextUpperBound"] = {
    "12345:decreasing": {"seed": 12345, "bounds": [10, 9, 8, 7, 6, 5, 4, 3, 2],
                          "results": upper_bound_seq(12345, [10, 9, 8, 7, 6, 5, 4, 3, 2])},
    "42:mixed": {"seed": 42, "bounds": [2, 3, 40, 100, 7],
                 "results": upper_bound_seq(42, [2, 3, 40, 100, 7])},
}
rng_fixtures["shuffle"] = {
    "77:range10": {"seed": 77, "n": 10, "result": shuffle_result(77, 10)},
    "1:range5": {"seed": 1, "n": 5, "result": shuffle_result(1, 5)},
}

# AngleNormalizer
def circular_distance(a, b, r):
    d = math.fmod(a - b, r)
    if d < 0: d += r
    return min(d, r - d)
def normalize_position(pp, r):
    m = math.fmod(pp, r)
    if m < 0: m += r
    return m
angle_fixtures = {
    "_comment": "Oracle for AngleNormalizer.ts.",
    "circularDistance": [{"a": a, "b": b, "r": r, "expected": repr(circular_distance(a, b, r))}
                          for (a, b, r) in [(10, 90, 100), (90, 10, 100), (0, 0, 100), (49, 51, 100),
                                            (0, 50, 100), (0, 99, 100), (25.5, 74.5, 100), (100, 0, 100)]],
    "normalizePosition": [{"p": pp, "r": r, "expected": repr(normalize_position(pp, r))}
                           for (pp, r) in [(-5, 100), (105, 100), (0, 100), (99.9, 100), (-0.1, 100),
                                           (250, 100), (-250, 100)]],
}

# Wheel/height fixtures — a set of profiles exercising every RNG draw path.
SAMPLE_POSITIONS = [0, 10, 20, 30, 50, 59]
PROFILES = [
    {"name": "diagnosticParity",  # seed 12345 — the Swift DiagnosticParityTests ground truth
     "profile": {"seed": "12345", "wheelCount": 3, "numberRange": 100,
                 "heightOrdering": {"kind": "random"}, "heightSpread": 0.07, "baseHeightsByRank": None,
                 "surfaceNoiseAmplitude": 0.06, "measurementNoise": 0.04, "noiseHarmonicFrequencyRange": [1.0, 5.0],
                 "ovalEccentricity": 0.15, "ovalFrequencyRange": [0.25, 2.0], "ovalBumpPositionOverride": None,
                 "gateWidth": 1.8, "gateSeamBuffer": 1.8,
                 "falseGateConfig": {"countRange": [1, 3], "depthRatioRange": [0.20, 0.55], "width": None,
                                     "distribution": {"kind": "halvingBase", "probability": 0.95}, "eligibleWheelIndices": None},
                 "contactAreaCenter": 50.0, "contactAreaWidth": 8.33, "rcpSensitivity": 2.5, "lcpSensitivity": 1.0},
     "combination": [20, 50, 80]},
    {"name": "inOrderAllWheels",  # inOrder base heights, noise, allWheels + 2 false gates/wheel
     "profile": {"seed": "42", "wheelCount": 4, "numberRange": 100,
                 "heightOrdering": {"kind": "inOrder"}, "heightSpread": 0.30, "baseHeightsByRank": None,
                 "surfaceNoiseAmplitude": 0.10, "measurementNoise": 0.0, "noiseHarmonicFrequencyRange": [1.0, 5.0],
                 "ovalEccentricity": 0.0, "ovalFrequencyRange": [1.0, 1.0], "ovalBumpPositionOverride": None,
                 "gateWidth": 3.0, "gateSeamBuffer": 0.0,
                 "falseGateConfig": {"countRange": [2, 2], "depthRatioRange": [0.7, 0.7], "width": None,
                                     "distribution": {"kind": "allWheels"}, "eligibleWheelIndices": None},
                 "contactAreaCenter": 50.0, "contactAreaWidth": 8.33, "rcpSensitivity": 2.5, "lcpSensitivity": 1.0},
     "combination": [20, 45, 70, 90]},
    {"name": "randomSubsetOval",  # randomSubset(1.0) + oval freq 1.0 + noise
     "profile": {"seed": "7", "wheelCount": 3, "numberRange": 60,
                 "heightOrdering": {"kind": "inOrder"}, "heightSpread": 0.20, "baseHeightsByRank": None,
                 "surfaceNoiseAmplitude": 0.04, "measurementNoise": 0.0, "noiseHarmonicFrequencyRange": [1.0, 5.0],
                 "ovalEccentricity": 0.10, "ovalFrequencyRange": [1.0, 1.0], "ovalBumpPositionOverride": None,
                 "gateWidth": 2.5, "gateSeamBuffer": 0.0,
                 "falseGateConfig": {"countRange": [1, 2], "depthRatioRange": [0.20, 0.50], "width": None,
                                     "distribution": {"kind": "randomSubset", "probability": 1.0}, "eligibleWheelIndices": None},
                 "contactAreaCenter": 30.0, "contactAreaWidth": 5.0, "rcpSensitivity": 2.5, "lcpSensitivity": 1.0},
     "combination": [12, 34, 50]},
    {"name": "lastWheelOnly",  # lastWheelOnly distribution, no noise, no oval
     "profile": {"seed": "99", "wheelCount": 3, "numberRange": 80,
                 "heightOrdering": {"kind": "inOrder"}, "heightSpread": 0.15, "baseHeightsByRank": None,
                 "surfaceNoiseAmplitude": 0.0, "measurementNoise": 0.0, "noiseHarmonicFrequencyRange": [1.0, 5.0],
                 "ovalEccentricity": 0.0, "ovalFrequencyRange": [1.0, 1.0], "ovalBumpPositionOverride": None,
                 "gateWidth": 2.0, "gateSeamBuffer": 0.0,
                 "falseGateConfig": {"countRange": [1, 1], "depthRatioRange": [0.5, 0.5], "width": None,
                                     "distribution": {"kind": "lastWheelOnly"}, "eligibleWheelIndices": None},
                 "contactAreaCenter": 40.0, "contactAreaWidth": 6.67, "rcpSensitivity": 2.5, "lcpSensitivity": 1.0},
     "combination": [15, 40, 65]},
]

def build_expected(entry):
    p = dict(entry["profile"])
    p["combination"] = entry["combination"]
    wheels = make_wheels(p)
    return {
        "baseHeights": [w["baseHeight"] for w in wheels],
        "ovalFrequencies": [w["ovalFrequency"] for w in wheels],
        "ovalBumps": [w["ovalBumpPosition"] for w in wheels],
        "falseGates": [[{"position": fg["position"], "depthRatio": repr(fg["depthRatio"]), "width": fg["width"]}
                        for fg in w["falseGates"]] for w in wheels],
        "noiseFirst8": [[repr(x) for x in w["noiseSamples"][:8]] for w in wheels],
        "heights": {"positions": SAMPLE_POSITIONS,
                    "perWheel": [[repr(wheel_height(w, p, pos)) for pos in SAMPLE_POSITIONS] for w in wheels]},
    }

wheels_fixtures = {
    "_comment": "Oracle for WheelFactory.makeWheels + ContactPointCalculator.wheelHeight. "
                "Floats as repr() strings; parse with parseFloat on the TS side.",
    "profiles": [{"name": e["name"], "profile": e["profile"], "combination": e["combination"],
                  "expected": build_expected(e)} for e in PROFILES],
}

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "test", "vectors")
os.makedirs(out, exist_ok=True)
for name, data in [("rng", rng_fixtures), ("angle", angle_fixtures), ("wheels", wheels_fixtures)]:
    with open(os.path.join(out, name + ".json"), "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

print("Wrote rng.json, angle.json, wheels.json")
dp = wheels_fixtures["profiles"][0]["expected"]
print("diagnosticParity (seed 12345) — Swift ground-truth check:")
print("  baseHeights      =", [round(x, 4) for x in dp["baseHeights"]], "(expect ~[1.0, 0.965, 0.93])")
print("  ovalFrequencies  =", [round(float(x), 3) for x in dp["ovalFrequencies"]], "(expect ~[0.558, 0.764, 1.771])")
print("  falseGate posns  =", [[fg["position"] for fg in w] for w in dp["falseGates"]],
      "(expect [[79],[34,41] or [41,34],[3,12,28] in some order])")
print("  heights @ pos 0  =", [round(float(w[0]), 4) for w in dp["heights"]["perWheel"]],
      "(expect ~[0.8502, 0.8807, 1.0114])")
