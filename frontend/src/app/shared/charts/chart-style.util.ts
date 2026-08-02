/** Shared color palette and style helpers for a consistent "modern" 2D chart look
 * (gradient area fills, rounded bars/pie slices) across calculators and the dashboard. */

export const CHART_PALETTE = [
  '#6366f1', // indigo
  '#22c55e', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#14b8a6', // teal
];

/** A top-to-bottom fading linear gradient used for line-chart area fills. */
export function gradientFill(color: string): object {
  return {
    type: 'linearGradient',
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: `${color}66` },
      { offset: 1, color: `${color}05` },
    ],
  };
}
