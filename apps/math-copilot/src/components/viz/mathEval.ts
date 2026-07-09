/**
 * Safe mathematical expression evaluator for visualization.
 * Only exposes Math.* functions — no access to globals.
 */

const SCOPE_KEYS = [
  "x", "y", "t",
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "sinh", "cosh", "tanh",
  "sqrt", "cbrt", "abs", "ceil", "floor", "round",
  "exp", "log", "log2", "log10",
  "pow", "sign", "max", "min",
  "PI", "E", "LN2", "LN10", "LOG2E", "SQRT2",
];

const SCOPE_VALS: number[] = [
  0, 0, 0,
  Math.sin as unknown as number, Math.cos as unknown as number,
  Math.tan as unknown as number, Math.asin as unknown as number,
  Math.acos as unknown as number, Math.atan as unknown as number,
  Math.atan2 as unknown as number,
  Math.sinh as unknown as number, Math.cosh as unknown as number,
  Math.tanh as unknown as number,
  Math.sqrt as unknown as number, Math.cbrt as unknown as number,
  Math.abs as unknown as number, Math.ceil as unknown as number,
  Math.floor as unknown as number, Math.round as unknown as number,
  Math.exp as unknown as number, Math.log as unknown as number,
  Math.log2 as unknown as number, Math.log10 as unknown as number,
  Math.pow as unknown as number, Math.sign as unknown as number,
  Math.max as unknown as number, Math.min as unknown as number,
  Math.PI, Math.E, Math.LN2, Math.LN10, Math.LOG2E, Math.SQRT2,
];

export type EvalFn = (x: number, y?: number, t?: number) => number;

const _cache = new Map<string, EvalFn>();

/** Compile an expression string into a reusable function (x, y?, t?) => number. */
export function compileExpr(expr: string): EvalFn {
  if (_cache.has(expr)) return _cache.get(expr)!;
  try {
    const normalized = expr.replace(/\*\*/g, "**"); // already valid JS exponentiation
    // eslint-disable-next-line no-new-func
    const raw = new Function(...SCOPE_KEYS, `"use strict"; return (${normalized});`);
    const compiled: EvalFn = (x: number, y = 0, t = 0) => {
      const vals = [...SCOPE_VALS];
      vals[0] = x; vals[1] = y; vals[2] = t;
      try {
        const v = (raw as (...a: unknown[]) => number)(...vals);
        return isFinite(v) ? v : NaN;
      } catch { return NaN; }
    };
    _cache.set(expr, compiled);
    return compiled;
  } catch {
    const fallback: EvalFn = () => NaN;
    _cache.set(expr, fallback);
    return fallback;
  }
}

/** Sample a single expression over [xMin, xMax]. */
export function sampleFunction(
  expr: string,
  xMin: number,
  xMax: number,
  points = 400,
): { x: number[]; y: number[] } {
  const fn = compileExpr(expr);
  const x: number[] = [];
  const y: number[] = [];
  const step = (xMax - xMin) / (points - 1);
  for (let i = 0; i < points; i++) {
    const xi = xMin + i * step;
    x.push(xi);
    y.push(fn(xi));
  }
  return { x, y };
}

/** Sample multiple expressions over [xMin, xMax] simultaneously. */
export function sampleMulti(
  exprs: string[],
  xMin: number,
  xMax: number,
  points = 400,
): { x: number[]; ys: number[][] } {
  const fns = exprs.map(compileExpr);
  const x: number[] = [];
  const ys: number[][] = exprs.map(() => []);
  const step = (xMax - xMin) / (points - 1);
  for (let i = 0; i < points; i++) {
    const xi = xMin + i * step;
    x.push(xi);
    fns.forEach((fn, fi) => ys[fi].push(fn(xi)));
  }
  return { x, ys };
}

/** Evaluate an expression once with a named-parameter map. */
export function evalWithParams(
  expr: string,
  params: Record<string, number>,
): number {
  try {
    const pKeys = Object.keys(params);
    const pVals = Object.values(params);
    // eslint-disable-next-line no-new-func
    const raw = new Function(...SCOPE_KEYS, ...pKeys, `"use strict"; return (${expr});`);
    const v = (raw as (...a: unknown[]) => number)(...SCOPE_VALS, ...pVals);
    return isFinite(v) ? v : NaN;
  } catch { return NaN; }
}

/** Sample an expression over [xMin, xMax] with additional named parameters. */
export function sampleWithParams(
  expr: string,
  xMin: number,
  xMax: number,
  params: Record<string, number>,
  points = 400,
): { x: number[]; y: number[] } {
  try {
    const pKeys = Object.keys(params);
    const pVals = Object.values(params);
    // eslint-disable-next-line no-new-func
    const raw = new Function(...SCOPE_KEYS, ...pKeys, `"use strict"; return (${expr});`);
    const x: number[] = [];
    const y: number[] = [];
    const step = (xMax - xMin) / (points - 1);
    for (let i = 0; i < points; i++) {
      const xi = xMin + i * step;
      const scopeVals = [...SCOPE_VALS];
      scopeVals[0] = xi;
      try {
        const v = (raw as (...a: unknown[]) => number)(...scopeVals, ...pVals);
        y.push(isFinite(v) ? v : NaN);
      } catch { y.push(NaN); }
      x.push(xi);
    }
    return { x, y };
  } catch { return { x: [], y: [] }; }
}

/** Sample a 3-D surface z = f(x, y) over the given ranges. */
export function sampleSurface(
  expr: string,
  xRange: [number, number],
  yRange: [number, number],
  points = 50,
): { x: number[]; y: number[]; z: number[][] } {
  const fn = compileExpr(expr);
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[][] = [];
  const xStep = (xRange[1] - xRange[0]) / (points - 1);
  const yStep = (yRange[1] - yRange[0]) / (points - 1);
  for (let j = 0; j < points; j++) xs.push(xRange[0] + j * xStep);
  for (let i = 0; i < points; i++) {
    const yv = yRange[0] + i * yStep;
    ys.push(yv);
    zs.push(xs.map(xv => fn(xv, yv)));
  }
  return { x: xs, y: ys, z: zs };
}
