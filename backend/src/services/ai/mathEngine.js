/**
 * Deterministic math engine for the grounded answer pipeline.
 *
 * Supports arithmetic expressions, percentages, common functions and
 * quadratic equations. Everything is *computed* — never guessed.
 *
 * parseMathExpression("2 + 3 * (4 - 1)^2") -> 29
 * trySolveMath("12x^2 + 7x - 10 = 0")      -> { roots: [...], steps: [...] }
 */

const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

class MathParser {
  constructor (input) {
    this.input = input.replace(/\s+/g, '');
    this.pos = 0;
  }

  parse () {
    const value = this.expression();
    if (this.pos < this.input.length) throw new Error('Unexpected character');
    return value;
  }

  peek () { return this.input[this.pos]; }

  consume (char) {
    if (this.input[this.pos] === char) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  expression () {
    let value = this.term();
    for (;;) {
      if (this.consume('+')) value += this.term();
      else if (this.consume('-')) value -= this.term();
      else return value;
    }
  }

  term () {
    let value = this.unary();
    for (;;) {
      if (this.consume('*')) value *= this.unary();
      else if (this.consume('/')) value /= this.unary();
      else if (this.consume('%')) value %= this.unary();
      else return value;
    }
  }

  unary () {
    if (this.consume('+')) return this.unary();
    if (this.consume('-')) return -this.unary();
    return this.power();
  }

  power () {
    const base = this.primary();
    if (this.consume('^')) {
      const exponent = this.unary();
      return base ** exponent;
    }
    return base;
  }

  primary () {
    if (this.consume('(')) {
      const value = this.expression();
      if (!this.consume(')')) throw new Error('Missing closing parenthesis');
      return value;
    }

    const start = this.pos;
    while (this.pos < this.input.length && /[a-zA-Z_]/.test(this.input[this.pos])) this.pos += 1;
    const name = this.input.slice(start, this.pos).toLowerCase();

    if (name) {
      if (this.consume('(')) {
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function: ${name}`);
        const arg = this.expression();
        if (!this.consume(')')) throw new Error('Missing closing parenthesis');
        return fn(arg);
      }
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new Error(`Unknown identifier: ${name}`);
    }

    const numStart = this.pos;
    while (this.pos < this.input.length && /[0-9.,]/.test(this.input[this.pos])) this.pos += 1;
    const raw = this.input.slice(numStart, this.pos).replace(/,/g, '');
    if (!raw) throw new Error('Expected a number');
    const value = Number(raw);
    if (Number.isNaN(value)) throw new Error('Invalid number');
    return value;
  }
}

/** Evaluate a plain arithmetic expression. Returns null when invalid. */
export function evaluateExpression (raw) {
  try {
    const percent = evaluatePercent(raw);
    if (percent !== null) return percent;

    let input = String(raw).trim();
    input = input
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/(?<=\d)\s*[x×]\s*(?=\d)/g, '*')
      .replace(/\bplus\b/gi, '+')
      .replace(/\bminus\b/gi, '-')
      .replace(/\btimes\b/gi, '*')
      .replace(/\bdivided by\b/gi, '/');
    if (!/[0-9]/.test(input)) return null;
    if (!/^[0-9a-zA-Z_+\-*/^%().,\s]+$/.test(input)) return null;
    const value = new MathParser(input).parse();
    if (!Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/** "20% of 150" or "150 plus 20%" -> number | null (whole-input match only) */
export function evaluatePercent (raw) {
  const text = String(raw).toLowerCase().trim();
  let match = text.match(/^(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)$/);
  if (match) return (Number(match[1]) / 100) * Number(match[2]);
  match = text.match(/^(\d+(?:\.\d+)?)\s*plus\s*(\d+(?:\.\d+)?)\s*%$/);
  if (match) return Number(match[1]) * (1 + Number(match[2]) / 100);
  return null;
}

const normalizeCoeff = (value) => {
  if (value === undefined || value === null || value === '' || value === '+') return 1;
  if (value === '-') return -1;
  return Number(value);
};

/**
 * Solve ax^2 + bx + c = 0 from common text forms:
 *   "12x^2 + 7x - 10 = 0", "x2 - 5x + 6", "2x² − 8x + 6 = 0"
 */
export function solveQuadratic (raw) {
  const text = String(raw)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/²/g, '^2')
    .replace(/−/g, '-')
    .replace(/,/g, '')
    // "12x2 + 5x" style input: x2 -> x^2 (never x20/x1999)
    .replace(/(?<=[+\-*/(\s]|^)(\d*)x2(?![\d.])/g, '$1x^2');

  const equation = text.split('=')[0].replace(/[?.]+$/, '');
  // Try the polynomial starting at the first digit (drops "solve"/"what is"),
  // then the raw equation (handles inputs that already start with x/coefficients).
  const digitStart = equation.search(/\d/);
  const candidates = [
    ...(digitStart > 0 ? [equation.slice(digitStart)] : []),
    equation,
  ];

  let match = null;
  for (const candidate of candidates) {
    match = candidate.match(/^([+-]?\d*\.?\d*)x\^2([+-]\d*\.?\d*)x([+-]\d*\.?\d+)$/);
    if (match) break;
  }
  if (!match) return null;

  const a = normalizeCoeff(match[1]);
  const b = normalizeCoeff(match[2]);
  const c = normalizeCoeff(match[3]);
  if (!a) return null;

  const discriminant = b * b - 4 * a * c;
  const pretty = (value) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6))));
  const steps = [
    `Identify coefficients: a = ${pretty(a)}, b = ${pretty(b)}, c = ${pretty(c)}`,
    `Discriminant: b² − 4ac = ${pretty(b)}² − 4(${pretty(a)})(${pretty(c)}) = ${pretty(discriminant)}`,
  ];

  if (discriminant < 0) {
    steps.push('The discriminant is negative, so there are no real roots.');
    const real = -b / (2 * a);
    const imag = Math.sqrt(-discriminant) / (2 * Math.abs(a));
    return {
      kind: 'quadratic',
      roots: [`${pretty(real)} + ${pretty(Number(imag.toFixed(6)))}i`, `${pretty(real)} - ${pretty(Number(imag.toFixed(6)))}i`],
      discriminant,
      steps,
    };
  }

  const sqrtD = Math.sqrt(discriminant);
  const x1 = (-b + sqrtD) / (2 * a);
  const x2 = (-b - sqrtD) / (2 * a);
  steps.push(`x = (−b ± √(b² − 4ac)) / 2a = (${pretty(-b)} ± ${pretty(Number(sqrtD.toFixed(6)))}) / ${pretty(2 * a)}`);
  if (Math.abs(x1 - x2) < 1e-12) {
    steps.push(`Both roots coincide: x = ${pretty(Number(x1.toFixed(6)))}`);
  } else {
    steps.push(`x₁ = ${pretty(Number(x1.toFixed(6)))}, x₂ = ${pretty(Number(x2.toFixed(6)))}`);
  }
  return {
    kind: 'quadratic',
    roots: [Number(x1.toFixed(6)), Number(x2.toFixed(6))],
    discriminant,
    steps,
  };
}

/** Detect a percentage question (not part of a bigger expression). */
export const isPercentQuestion = (text) => /\d+(\.\d+)?\s*%\s*of\s*\d+/.test(String(text));

export default { evaluateExpression, evaluatePercent, solveQuadratic, isPercentQuestion };
