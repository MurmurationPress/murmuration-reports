import { LineChartData } from "./LineChartData";

const WIDTH = 960, FONT = 32, LINE = 40, PAD = 32, MAX_HEIGHT = 1200;
const FONTS = "DejaVu Sans, Liberation Sans, Arial, sans-serif";
const COLOURS = ["#2457a7", "#b54708", "#16803a", "#7a3e9d"];
const DASHES = ["", "14 8", "3 9", "14 6 3 6"];
const IDENTITIES = ["solid/circle", "dashed/square", "dotted/triangle", "dash-dot/diamond"];
const esc = (value: string) => {
  for (const char of value) {
    const point = char.codePointAt(0)!;
    if ((point < 32 && ![9,10,13].includes(point)) || (point >= 0xd800 && point <= 0xdfff) || point === 0xfffe || point === 0xffff) {
      throw Error("Publication text contains an invalid XML character; remove controls or unpaired surrogates before generation.");
    }
  }
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
};
const coordinate = (value: number) => {
  if (!Number.isFinite(value)) throw Error("Publication chart geometry is not finite; adjust the domain/data.");
  return Number(value.toFixed(4)).toString();
};
// Qualified fonts share this glyph subset. Wide Latin digraphs need more than
// one em; use a larger allowance instead of silently underestimating them.
const widthBound = (text: string) => [...text].reduce((sum, char) => sum + FONT * (/^[\u01c4-\u01cc\u01f1-\u01f3]$/u.test(char) ? 1.6 : 1.2), 0);
function layoutError(field: string, reason: string): never {
  throw Error(`Publication ${field}: ${reason}. Shorten or restructure the text; labels are never shrunk or truncated.`);
}
/** Deliberately conservative bound, independent of the host DOM/font/theme. */
export function wrapPublicationText(raw: string, field: string, width: number, maxLines: number): string[] {
  const text = raw.trim().replace(/\s+/gu, " ");
  for (const char of text) {
    if (!/[\x20-\x7e\u00a0-\u024f\u0374-\u0375\u037a-\u037e\u0384-\u038a\u038c\u038e-\u03a1\u03a3-\u03ce\u03d0-\u03ff\u2010\u2012-\u2022\u2026\u2212\u2264\u2265]/u.test(char) || /[\p{C}\p{M}]/u.test(char)) {
      layoutError(field, `unsupported glyph U+${char.codePointAt(0)!.toString(16).toUpperCase()}; use the documented publication glyph set`);
    }
  }
  if (!text) return [];
  const lines: string[] = []; let line = "";
  for (const word of text.split(" ")) {
    if (widthBound(word) > width) layoutError(field, "an unbreakable word exceeds the available width");
    const next = line ? `${line} ${word}` : word;
    if (widthBound(next) > width) { lines.push(line); line = word; } else line = next;
  }
  lines.push(line);
  if (lines.length > maxLines) layoutError(field, `text needs ${lines.length} lines; the limit is ${maxLines}`);
  return lines;
}
function marker(index: number, x: number, y: number, attributes = ""): string {
  const common = `${attributes} fill="#ffffff" stroke="${COLOURS[index]}" stroke-width="3"`;
  if (index === 0) return `<circle ${common} cx="${coordinate(x)}" cy="${coordinate(y)}" r="7"/>`;
  const offsets = index === 1 ? [[-7,-7],[7,-7],[7,7],[-7,7]] : index === 2 ? [[0,-8],[8,7],[-8,7]] : [[0,-9],[9,0],[0,9],[-9,0]];
  return `<polygon ${common} points="${offsets.map(([dx,dy]) => `${coordinate(x+dx)},${coordinate(y+dy)}`).join(" ")}"/>`;
}
function domain(data: LineChartData): [number, number] {
  if (data.definition.yMin !== undefined && data.definition.yMax !== undefined) return [data.definition.yMin, data.definition.yMax];
  let min = Infinity, max = -Infinity;
  for (const point of data.points) for (const value of point.values) { min = Math.min(min, value); max = Math.max(max, value); }
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * .1);
    const lower = min - padding, upper = max + padding;
    // Near the finite numeric boundary a one-sided domain is sufficient.
    min = Number.isFinite(lower) ? lower : min;
    max = Number.isFinite(upper) ? upper : max;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw Error("Publication automatic Y domain cannot be resolved; supply finite distinct y_min/y_max.");
  return [min, max];
}
function tickLabels(values: number[]): string[] {
  for (let precision = 6; precision <= 17; precision++) {
    const labels = values.map(value => {
      const rounded = Number(value.toPrecision(precision));
      const plain = String(rounded);
      return plain.length <= 7 ? plain : rounded.toExponential(precision-1).replace(/\.?0+(?=e)/u, "").replace(/e\+/u, "e");
    });
    if (new Set(labels).size === labels.length) return labels;
  }
  throw Error("Publication Y ticks cannot be labelled distinctly; choose a wider domain.");
}
export function renderPublicationLineChartSvg(data: LineChartData): string {
  const definition = data.definition;
  const [min, max] = domain(data);
  // Convex interpolation avoids max-min overflow and duplicate machine values.
  const ticks = [...new Set(Array.from({length:5}, (_,i) => i === 0 ? min : i === 4 ? max : (1-i/4)*min + i/4*max).filter(value => value >= min && value <= max))].sort((a,b)=>a-b);
  const labels = tickLabels(ticks);
  const tickWidth = Math.max(...labels.map(widthBound));
  if (tickWidth > 360) layoutError("Y tick labels", "numeric labels exceed 360 units; choose a more readable domain");
  const left = PAD + tickWidth + 20, right = WIDTH - PAD - 10, plotWidth = right-left;
  const body: string[] = []; let cursor = PAD + FONT;
  const textLine = (text: string, x: number, y: number, attributes = "") =>
    body.push(`<text x="${coordinate(x)}" y="${coordinate(y)}" ${attributes}>${esc(text)}</text>`);
  const paragraph = (raw: string | undefined, field: string, maxLines: number, x = PAD, width = WIDTH-2*PAD) => {
    if (!raw) return;
    for (const line of wrapPublicationText(raw, field, width, maxLines)) { textLine(line,x,cursor); cursor += LINE; }
    cursor += 8;
  };
  paragraph(definition.title,"title",3);
  paragraph(definition.subtitle,"subtitle",2);
  // Horizontal labels reserve their own lines rather than rely on rotated metrics.
  paragraph(definition.yAxisLabel,"Y axis label",2);
  const top = cursor + 8, bottom = top + 300;
  const xMin = data.points[0].timestamp, xMax = data.points[data.points.length-1].timestamp;
  const x = (stamp: number) => left + (xMax === xMin ? .5 : (stamp-xMin)/(xMax-xMin))*plotWidth;
  const span = max-min;
  const fraction = (value: number) => Number.isFinite(span) ? (value-min)/span : (value/2-min/2)/(max/2-min/2);
  const y = (value: number) => bottom-fraction(value)*300;
  ticks.forEach((value,i) => {
    body.push(`<line x1="${coordinate(left)}" y1="${coordinate(y(value))}" x2="${right}" y2="${coordinate(y(value))}" stroke="#b8bec6" stroke-width="3" stroke-dasharray="3 9"/>`);
    textLine(labels[i],left-16,y(value)+10,'text-anchor="end"');
  });
  body.push(`<line x1="${coordinate(left)}" y1="${top}" x2="${coordinate(left)}" y2="${bottom}" stroke="#52606d" stroke-width="3"/>`);
  body.push(`<line x1="${coordinate(left)}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#52606d" stroke-width="3"/>`);
  // ISO dates use bounded endpoint labels, staggered when widths would overlap.
  cursor = bottom+LINE;
  const dates = xMin === xMax ? [data.points[0].date] : [data.points[0].date,data.points[data.points.length-1].date];
  for (const date of dates) wrapPublicationText(date,"date label",plotWidth,1);
  if (dates.length === 1) textLine(dates[0],left+plotWidth/2,cursor,'text-anchor="middle"');
  else {
    textLine(dates[0],left,cursor);
    if (dates.reduce((sum,date)=>sum+widthBound(date),0)+16 > plotWidth) cursor += LINE;
    textLine(dates[1],right,cursor,'text-anchor="end"');
  }
  cursor += LINE;
  paragraph(definition.xAxisLabel,"X axis label",2);
  definition.series.forEach((series,index) => {
    const dash = DASHES[index] ? ` stroke-dasharray="${DASHES[index]}"` : "";
    const attributes = `data-series="${esc(series.property)}" data-style="${IDENTITIES[index]}"`;
    const points = data.points.map(point => `${coordinate(x(point.timestamp))},${coordinate(y(point.values[index]))}`).join(" ");
    body.push(`<polyline ${attributes} points="${points}" fill="none" stroke="${COLOURS[index]}" stroke-width="3" stroke-linejoin="round"${dash}/>`);
    for (const point of data.points) body.push(marker(index,x(point.timestamp),y(point.values[index]),`${attributes} data-date="${point.date}"`));
    const lines = wrapPublicationText(series.label,`series[${index}].label`,WIDTH-2*PAD-90,2);
    body.push(`<line data-legend="${esc(series.property)}" data-style="${IDENTITIES[index]}" x1="${PAD}" y1="${cursor-10}" x2="${PAD+60}" y2="${cursor-10}" stroke="${COLOURS[index]}" stroke-width="3"${dash}/>`);
    body.push(marker(index,PAD+30,cursor-10,`data-legend="${esc(series.property)}"`));
    for (const line of lines) { textLine(line,PAD+90,cursor); cursor += LINE; }
    cursor += 8;
  });
  paragraph(definition.caption,"caption",6);
  const height = cursor+PAD;
  if (height > MAX_HEIGHT) layoutError("layout", `height ${height} exceeds ${MAX_HEIGHT} units; shorten titles, axes, legends or caption`);
  const description = `Line chart with ${definition.series.length} series and ${data.points.length} observations from ${data.points[0].date} to ${data.points[data.points.length-1].date}. Y range ${min} to ${max}. Series in order: ${definition.series.map((s,i) => `${s.label} (${IDENTITIES[i]})`).join("; ")}.${definition.caption ? " " + definition.caption : ""}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="chart-title chart-desc">`,
    `  <title id="chart-title">${esc(definition.title)}</title>`,
    `  <desc id="chart-desc">${esc(description)}</desc>`,
    `  <rect width="${WIDTH}" height="${height}" fill="#ffffff"/>`,
    `  <g font-family="${FONTS}" font-size="${FONT}" fill="#17212b">`,
    ...body.map(line => "    "+line),
    "  </g>", "</svg>", ""
  ].join("\n");
}
