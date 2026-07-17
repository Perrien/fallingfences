// Pure spark-burst particle model — port of the app's Views/SparkParticleView.swift (the
// "solve celebration" gold particle burst). Cosmetic only: uses Math.random (not the app's
// seeded RNG) since the burst is intentionally non-reproducible, same as the noise generator.
//
// Physics per particle: emitted from an origin at a random angle, travels outward at a
// random speed, arcs downward under a constant "gravity" scaled to the burst's reference
// diameter, and fades linearly over its lifetime. Rendered by the caller as a short streak
// (head/tail points a fixed dt apart) rather than a dot, to read as a spark rather than a ball.

export interface Spark {
  angle: number; // radians, 0..2π
  speed: number; // px/sec, already scaled by the reference diameter
  delay: number; // seconds before this particle starts moving
  lifetime: number; // seconds this particle is visible for once started
  size: number; // stroke width in px
  hue: number; // 0..1, gold range ~0.09-0.15
}

const TAU = Math.PI * 2;
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// diameter is the reference scale (dial diameter for Standard, plot height for Ultra) —
// both particle speed and gravitational pull scale with it so the burst reads proportionally
// at any size.
export function makeSparks(count: number, diameter: number): Spark[] {
  return Array.from({ length: count }, () => ({
    angle: rand(0, TAU),
    speed: rand(0.4, 2.5) * diameter,
    delay: rand(0, 0.4),
    lifetime: rand(1.8, 5.0),
    size: rand(1.5, 3.5),
    hue: rand(0.09, 0.15),
  }));
}

export interface SparkPoint {
  x: number;
  y: number;
  tailX: number;
  tailY: number;
  alpha: number;
}

const TRAIL_DT = 0.04; // seconds between head and tail sample, for the streak look

// Position (relative to the origin) of a spark at time `t` seconds since the burst started,
// or null if the particle hasn't started yet or has already faded out.
export function sparkState(s: Spark, t: number, diameter: number): SparkPoint | null {
  const local = t - s.delay;
  if (local < 0 || local > s.lifetime) return null;
  const gravity = diameter * 0.35;
  const pos = (dt: number) => ({
    x: s.speed * Math.cos(s.angle) * dt,
    y: s.speed * Math.sin(s.angle) * dt + 0.5 * gravity * dt * dt,
  });
  const head = pos(local);
  const tail = pos(Math.max(0, local - TRAIL_DT));
  const alpha = Math.max(0, 1 - local / s.lifetime);
  return { x: head.x, y: head.y, tailX: tail.x, tailY: tail.y, alpha };
}
