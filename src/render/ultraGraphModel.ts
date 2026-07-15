// Pure data-shaping for the Ultra fence-height graph. Port of the gate-marker logic in
// Views/UltraGraphView.drawExtremeLow. Kept UI-free so it's unit-testable.

export interface GateMarkers {
  minValue: number; // the fence-height minimum (the gate floor)
  indices: number[]; // every sweep index whose value ties the minimum (ticks)
  segments: [number, number][]; // consecutive index pairs within 5 positions (connectors)
}

// The gate signature: every index where the fence height equals its global minimum (within
// eps), plus connector segments between consecutive extremes that are within 5 positions
// (a true gate has width, so its floor spans a few adjacent samples). Mirrors Swift's
// `abs(data[i] - minV) < eps` filter + `extremeIndices[i+1] - extremeIndices[i] <= 5` join.
export function gateMarkers(data: number[], eps = 1e-9): GateMarkers {
  if (data.length === 0) return { minValue: 0, indices: [], segments: [] };
  let minValue = Infinity;
  for (const v of data) if (v < minValue) minValue = v;

  const indices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i] - minValue) < eps) indices.push(i);
  }

  const segments: [number, number][] = [];
  for (let i = 0; i < indices.length - 1; i++) {
    if (indices[i + 1] - indices[i] <= 5) segments.push([indices[i], indices[i + 1]]);
  }
  return { minValue, indices, segments };
}

// X-axis label positions: every `step` (default 10) across [0, numberRange), so a 100-dial
// yields 0,10,…,90. Values are dial positions (== sweep indices).
export function xAxisLabels(numberRange: number, step = 10): number[] {
  const labels: number[] = [];
  for (let p = 0; p < numberRange; p += step) labels.push(p);
  return labels;
}

// Velocity-scaled 1-finger scrub: converts a horizontal pixel delta into a dial-index
// delta. The scale only ever *slows* movement (max 1.0) — slow drags cap at `minScale`
// (30%) so fine adjustments are easy to land; fast drags map 1:1 with the graph. Mirrors
// UltraManipulationView.handleIndexDrag (no zoom, so pxPerUnit = plotWidth / numberRange).
export function scrubIndexDelta(
  dxPx: number,
  vxPxPerSec: number,
  plotWidth: number,
  numberRange: number,
  referenceV = 800,
  minScale = 0.3,
): number {
  const scale = Math.max(minScale, Math.min(1.0, Math.abs(vxPxPerSec) / referenceV));
  const pxPerUnit = Math.max(1, plotWidth) / Math.max(1, numberRange);
  return (dxPx / pxPerUnit) * scale;
}
