// Presentation only: these helpers never alter usage values or bucket calculations.
const lightStops = [[228, 244, 250], [185, 221, 235], [127, 182, 207], [48, 105, 135], [23, 52, 75]];
const darkStops = [[13, 35, 50], [22, 65, 85], [30, 112, 137], [64, 176, 184], [117, 221, 217]];
const cssRgb = (rgb: number[]) => `rgb(${rgb.map(Math.round).join(', ')})`;

export function heatmapColor(position: number, lowConfidence = false, dark = false) {
  const stops = dark ? darkStops : lightStops;
  const foam = dark ? [17, 41, 57] : [252, 254, 255];
  const scaled = Math.max(0, Math.min(1, position)) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const fraction = scaled - index;
  const rgb = stops[index].map((channel, i) => {
    const mixed = channel + (stops[index + 1][i] - channel) * fraction;
    return Math.round(lowConfidence ? mixed * .4 + foam[i] * .6 : mixed);
  });
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  // Black or white, whichever gives the higher WCAG contrast ratio.
  return { backgroundColor: cssRgb(rgb), color: luminance > .179 ? '#000000' : '#ffffff' };
}

export function heatmapRange(values: (number | null)[]) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!known.length) return null;
  return { min: Math.min(...known), max: Math.max(...known) };
}

export function heatmapPosition(value: number, range: { min: number; max: number }) {
  // An equal-value range stays uniform; zero stays pale rather than appearing busy.
  return range.max === range.min ? Math.max(0, Math.min(1, value / 100)) : (value - range.min) / (range.max - range.min);
}

export function heatmapGradient(range: { min: number; max: number }, dark = false) {
  const stops = dark ? darkStops : lightStops;
  if (range.min === range.max) return heatmapColor(heatmapPosition(range.min, range), false, dark).backgroundColor;
  return `linear-gradient(to right, ${stops.map(cssRgb).join(', ')})`;
}

export const rangeLabel = (value: number) => `${Number(value.toFixed(2))}%`;
