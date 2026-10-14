import { LineChartData } from "./LineChartData";
export interface YAxisPolicy {
  minimum: "auto" | "zero" | number;
  maximum: "auto" | number;
  ticks: "auto" | "integer" | { step: number };
}
const fail = (reason: string): never => {
  throw Error(
    `y_axis: ${reason}. Choose finite readable endpoints or a larger positive tick step.`,
  );
};
export function parseYAxis(value: unknown): YAxisPolicy {
  if (value === undefined)
    return { minimum: "auto", maximum: "auto", ticks: "auto" };
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("must be a mapping");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some((key) => !["minimum", "maximum", "ticks"].includes(key))
  )
    fail("contains an unknown option; use minimum, maximum or ticks");
  const minimum = "minimum" in v ? v.minimum : "auto",
    maximum = "maximum" in v ? v.maximum : "auto",
    ticks = "ticks" in v ? v.ticks : "auto";
  if (
    !(
      minimum === "auto" ||
      minimum === "zero" ||
      (typeof minimum === "number" && Number.isFinite(minimum))
    )
  )
    fail("minimum must be auto, zero or a finite number");
  if (
    !(
      maximum === "auto" ||
      (typeof maximum === "number" && Number.isFinite(maximum))
    )
  )
    fail("maximum must be auto or a finite number");
  if (
    typeof minimum === "number" &&
    typeof maximum === "number" &&
    minimum >= maximum
  )
    fail("minimum must be less than maximum");
  if (minimum === "zero" && typeof maximum === "number" && maximum < 0)
    fail("maximum excludes zero despite the include-zero minimum policy");
  if (
    !(
      ticks === "auto" ||
      ticks === "integer" ||
      (ticks &&
        typeof ticks === "object" &&
        !Array.isArray(ticks) &&
        Object.keys(ticks).length === 1 &&
        "step" in ticks &&
        typeof (ticks as any).step === "number" &&
        Number.isFinite((ticks as any).step) &&
        (ticks as any).step > 0)
    )
  )
    fail(
      "ticks must be auto, integer or a mapping with only a positive finite step",
    );
  return {
    minimum: minimum as YAxisPolicy["minimum"],
    maximum: maximum as YAxisPolicy["maximum"],
    ticks: ticks as YAxisPolicy["ticks"],
  };
}
function nice(raw: number): number {
  if (!(raw > 0 && Number.isFinite(raw)))
    fail("automatic interval is not representable");
  const power = 10 ** Math.floor(Math.log10(raw));
  if (!power) return Number.MIN_VALUE;
  for (const factor of [1, 2, 2.5, 5, 10])
    if (factor * power >= raw && Number.isFinite(factor * power))
      return factor * power;
  return fail("automatic interval exceeds the numeric range");
}
const clean = (n: number) => Number(n.toPrecision(15));
function niceInteger(raw: number): number {
  const target = Math.max(1, raw),
    power = 10 ** Math.floor(Math.log10(target));
  for (const factor of [1, 2, 5, 10]) {
    const step = factor * power;
    if (step >= target && Number.isFinite(step) && Number.isInteger(step))
      return step;
  }
  return fail("integer tick interval exceeds the numeric range");
}
export function readableYAxis(data: LineChartData): {
  min: number;
  max: number;
  ticks: number[];
} {
  const policy = data.definition.yAxis ?? {
    minimum: data.definition.yMin ?? "auto",
    maximum: data.definition.yMax ?? "auto",
    ticks: "auto",
  };
  let lo = Infinity,
    hi = -Infinity;
  for (const p of data.points)
    for (const [i, v] of p.values.entries()) {
      if (typeof policy.minimum === "number" && v < policy.minimum)
        throw Error(
          `${p.sourcePath}: ${data.definition.series[i].property}=${v} is below the explicit y_axis minimum ${policy.minimum}. Correct data or change the endpoint; no clipping is performed.`,
        );
      if (typeof policy.maximum === "number" && v > policy.maximum)
        throw Error(
          `${p.sourcePath}: ${data.definition.series[i].property}=${v} is above the explicit y_axis maximum ${policy.maximum}. Correct data or change the endpoint; no clipping is performed.`,
        );
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  const dataLo = lo,
    dataHi = hi;
  // A constant series needs visible domain padding, then include-zero extends
  // the automatic side while preserving every negative/positive observation.
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.max(Math.abs(lo) * 0.1, Number.MIN_VALUE);
    lo -= pad;
    hi += pad;
  }
  if (policy.minimum === "zero") {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  // `zero` is an include-zero policy, not a hard lower endpoint. In
  // particular, negative data remains visible and the automatic maximum is
  // extended to zero.
  const lower = typeof policy.minimum === "number" ? policy.minimum : lo,
    upper = typeof policy.maximum === "number" ? policy.maximum : hi;
  if (!(Number.isFinite(lower) && Number.isFinite(upper) && lower < upper))
    fail("resolved minimum must be less than maximum");
  const automatic = nice(upper / 5 - lower / 5);
  const step =
    typeof policy.ticks === "object"
      ? policy.ticks.step
      : policy.ticks === "integer"
        ? niceInteger(automatic)
        : automatic;
  // Outward rounding is independent of an explicit tick step.
  const min =
    typeof policy.minimum === "number"
      ? policy.minimum
      : Math.floor(lower / automatic) * automatic;
  const max =
    typeof policy.maximum === "number"
      ? policy.maximum
      : Math.ceil(upper / automatic) * automatic;
  if (
    !(
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min < max &&
      min <= dataLo &&
      max >= dataHi
    )
  )
    fail("outward bounds are not representable");
  let first = Math.ceil(min / step),
    last = Math.floor(max / step);
  if (
    !Number.isSafeInteger(first) ||
    !Number.isSafeInteger(last) ||
    last - first + 1 > 9
  )
    fail("tick grid is unrepresentable or exceeds nine readable ticks");
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) {
    const v = clean(i * step);
    if (v >= min && v <= max && Number.isFinite(v) && !ticks.includes(v))
      ticks.push(v === 0 ? 0 : v);
  }
  if (!ticks.length) fail("no grid ticks fall inside the domain");
  const span = max - min,
    frac = (v: number) =>
      Number.isFinite(span)
        ? (v - min) / span
        : (v / 2 - min / 2) / (max / 2 - min / 2);
  for (let i = 1; i < ticks.length; i++)
    if ((frac(ticks[i]) - frac(ticks[i - 1])) * 480 < 48 - 1e-8)
      fail("tick labels would overlap");
  return { min, max, ticks };
}
