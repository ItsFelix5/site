// multivariate polynomials: key -> [coefficient, {variable: power}]
type Mono = Record<string, number>;
export type Poly = Map<string, [number, Mono]>;
export type Rel = "=" | "<" | ">" | "≤" | "≥";
export type Step = { t: string; op?: string };

const key = (m: Mono) =>
	Object.keys(m)
		.sort()
		.map((k) => k + m[k])
		.join("");

const cst = (c: number): Poly => new Map(c ? [["", [c, {}]]] : []);
const vr = (v: string): Poly => new Map([[v + 1, [1, { [v]: 1 }]]]);

function add(a: Poly, b: Poly, s = 1): Poly {
	const out: Poly = new Map([...a].map(([k, [c, m]]) => [k, [c, m]]));
	for (const [k, [c, m]] of b) {
		const n = (out.get(k)?.[0] ?? 0) + s * c;
		if (Math.abs(n) < 1e-12) out.delete(k);
		else out.set(k, [n, m]);
	}
	return out;
}

function mul(a: Poly, b: Poly): Poly {
	let out: Poly = new Map();
	for (const [, [c1, m1]] of a)
		for (const [, [c2, m2]] of b) {
			const m = { ...m1 };
			for (const k in m2) m[k] = (m[k] ?? 0) + m2[k];
			out = add(out, new Map([[key(m), [c1 * c2, m]]]));
		}
	return out;
}

const num = (p: Poly) => (p.size === 0 ? 0 : p.size === 1 && p.has("") ? p.get("")![0] : null);
const scaleP = (p: Poly, s: number) => mul(p, cst(s));
const degIn = (p: Poly, v: string) => Math.max(0, ...[...p.values()].map(([, m]) => m[v] ?? 0));

function coef(p: Poly, v: string, k: number): Poly {
	let out: Poly = new Map();
	for (const [, [c, m]] of p)
		if ((m[v] ?? 0) === k) {
			const n = { ...m };
			delete n[v];
			out = add(out, new Map([[key(n), [c, n]]]));
		}
	return out;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const sup = (n: number) => String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);

export function fmt(n: number): string {
	n = Math.round(n * 1e9) / 1e9;
	if (Object.is(n, -0)) n = 0;
	if (!Number.isInteger(n))
		for (let d = 2; d <= 1000; d++) {
			const q = Math.round(n * d);
			if (Math.abs(n * d - q) < 1e-9) return `${q < 0 ? "−" : ""}${Math.abs(q)}/${d}`;
		}
	return String(Number.isInteger(n) ? n : +n.toFixed(4)).replace("-", "−");
}

function show(p: Poly, v?: string): string {
	const deg = (m: Mono) => (v ? (m[v] ?? 0) : 0) * 1e3 + Object.values(m).reduce((a, b) => a + b, 0);
	const ts = [...p].sort(([k1, [, a]], [k2, [, b]]) => deg(b) - deg(a) || (k1 < k2 ? -1 : 1));
	if (!ts.length) return "0";
	return ts
		.map(([, [c, m]], i) => {
			const mono = Object.keys(m)
				.sort()
				.map((k) => k + (m[k] > 1 ? sup(m[k]) : ""))
				.join("");
			const a = Math.abs(c);
			const body = mono ? (a === 1 ? "" : Number.isInteger(a) ? String(a) : `(${fmt(a)})`) + mono : fmt(a);
			return (c < 0 ? (i ? " − " : "−") : i ? " + " : "") + body;
		})
		.join("");
}

const coefStr = (p: Poly) => {
	const n = num(p);
	return n === 1 ? "" : n === -1 ? "−" : p.size ? wrap(p) : "0";
};

const wrap = (p: Poly) => (p.size > 1 ? `(${show(p)})` : show(p));

function parse(src: string): Poly {
	const toks = src.match(/\d*\.?\d+|[a-zA-Z]|[-+*/^()]/g) ?? [];
	if (toks.join("").length !== src.replace(/\s/g, "").length) throw "?";
	let i = 0;
	const peek = () => toks[i];
	const atomNext = () => !!peek() && /^[\d.a-zA-Z(]/.test(peek());

	function expr(): Poly {
		let p = term();
		while (peek() === "+" || peek() === "-") {
			const s = toks[i++] === "-" ? -1 : 1;
			p = add(p, term(), s);
		}
		return p;
	}
	function term(): Poly {
		let p = unary();
		while (peek() === "*" || peek() === "/" || atomNext()) {
			if (peek() === "/") {
				i++;
				const d = num(unary());
				if (!d) throw "÷";
				p = scaleP(p, 1 / d);
			} else {
				if (peek() === "*") i++;
				p = mul(p, unary());
			}
		}
		return p;
	}
	function unary(): Poly {
		if (peek() === "-") return i++, scaleP(unary(), -1);
		if (peek() === "+") return i++, unary();
		let p = atom();
		if (peek() === "^") {
			i++;
			const n = num(unary());
			if (n === null || !Number.isInteger(n) || n < 0 || n > 8) throw "^";
			let out = cst(1);
			for (let k = 0; k < n; k++) out = mul(out, p);
			p = out;
		}
		return p;
	}
	function atom(): Poly {
		const t = toks[i++];
		if (t === "(") {
			const p = expr();
			if (toks[i++] !== ")") throw ")";
			return p;
		}
		if (!t) throw "…";
		if (/^[a-zA-Z]$/.test(t)) return vr(t);
		if (/^[\d.]/.test(t)) return cst(+t);
		throw t;
	}
	const p = expr();
	if (i < toks.length) throw toks[i];
	return p;
}

const flip: Record<Rel, Rel> = { "=": "=", "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
const strict = (r: Rel) => r === "<" || r === ">";
const up = (r: Rel) => r === ">" || r === "≥";

export function normalize(s: string) {
	return s
		.replace(/<=|=<|≦/g, "≤")
		.replace(/>=|=>|≧/g, "≥")
		.replace(/[−–]/g, "-")
		.replace(/[×·]/g, "*")
		.replace(/÷/g, "/")
		.replace(/[²³]/g, (c) => (c === "²" ? "^2" : "^3"))
		.replace(/==/g, "=");
}

export type Parsed = { L: Poly; R: Poly; rel: Rel; vars: string[] };

export function analyse(src: string): Parsed {
	const parts = normalize(src).split(/(≤|≥|=|<|>)/);
	if (parts.length !== 3) throw "=";
	const L = parse(parts[0]);
	const R = parse(parts[2]);
	const vars = [...new Set([...L, ...R].flatMap(([, [, m]]) => Object.keys(m)))].sort();
	return { L, R, rel: parts[1] as Rel, vars };
}

// exact (-b ± s√r) / 2a for integer coefficients, simplified
function root(b: number, D: number, a: number, sign: 1 | -1): string {
	if (!D) return fmt(-b / (2 * a));
	let s = 1;
	let r = D;
	for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) ((r /= f * f), (s *= f));
	if (r === 1) return fmt((-b + sign * s) / (2 * a));
	const g = gcd(gcd(b, s), 2 * a);
	let [p, q, d] = [-b / g, s / g, (2 * a) / g];
	if (d < 0) [p, q, d] = [-p, -q, -d];
	const rad = `${q === 1 ? "" : q}√${r}`;
	const top = `${p ? fmt(p) : ""}${sign * q < 0 ? " − " : p ? " + " : ""}${rad}`;
	return d === 1 ? top : `(${top})/${d}`;
}

export function solve({ L, R, rel }: Parsed, v: string): Step[] {
	const out: Step[] = [{ t: `${show(L, v)} ${rel} ${show(R, v)}` }];
	const P = add(L, R, -1);
	const d = degIn(P, v);
	if (d > 2) throw "deg";
	const [c0, c1, c2] = [0, 1, 2].map((k) => coef(P, v, k));
	if (d < 2) {
		const A = c1;
		const B = scaleP(c0, -1);
		const moved = `${coefStr(A)}${A.size ? v : ""} ${rel} ${show(B)}`;
		if (moved !== out[0].t) out.push({ t: moved, op: "⇄" });
		const a = num(A);
		if (!A.size) {
			const b = num(B);
			const holds = b === null ? null : { "=": b === 0, "<": 0 < b, ">": 0 > b, "≤": 0 <= b, "≥": 0 >= b }[rel];
			out.push({ t: holds === null ? `0 ${rel} ${show(B)}` : holds ? "ℝ" : "∅" });
			return out;
		}
		let r = rel;
		if (a === null) {
			if (rel !== "=") throw "±";
			out.push({ t: `${v} = ${B.size ? `${wrap(B)}/${wrap(A)}` : "0"}`, op: `÷ ${wrap(A)}` });
			return out;
		}
		if (a < 0) r = flip[rel];
		const res = scaleP(B, 1 / a);
		out.push({ t: `${v} ${r} ${show(res)}`, op: `÷ ${fmt(a)}${a < 0 && rel !== "=" ? " ⇄" : ""}` });
		return out;
	}
	const [a, b, c] = [c2, c1, c0].map(num);
	const std = `${show(P, v)} ${rel} 0`;
	if (std !== out[0].t) out.push({ t: std, op: "⇄" });
	if (a === null || b === null || c === null) {
		if (rel !== "=") throw "±";
		out.push({ t: `${v} = (−${wrap(c1)} ± √(${wrap(c1)}² − 4·${wrap(c2)}·${wrap(c0)})) / 2·${wrap(c2)}`, op: "abc" });
		return out;
	}
	const D = b * b - 4 * a * c;
	out.push({ t: `Δ = ${b < 0 ? `(${fmt(b)})` : fmt(b)}² − 4·${fmt(a)}·${c < 0 ? `(${fmt(c)})` : fmt(c)} = ${fmt(D)}` });
	const whole = [a, b, c].every(Number.isInteger);
	const lab = (sign: 1 | -1) => (whole ? root(b, D, a, sign) : fmt((-b + sign * Math.sqrt(D)) / (2 * a)));
	const outside = up(rel) === a > 0;
	if (D < 0) {
		out.push({ t: rel !== "=" && up(rel) === a > 0 ? "ℝ" : "∅" });
		return out;
	}
	const [x1, x2] = [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)].sort((p, q) => p - q);
	const [l1, l2] = a > 0 ? [lab(-1), lab(1)] : [lab(1), lab(-1)];
	const exact = D ? `${l1}, ${l2}` : l1;
	if (rel === "=") {
		out.push({ t: `${v} = ${exact}` });
		if (whole && Math.sqrt(D) % 1) out.push({ t: `${v} ≈ ${String(+x1.toFixed(4)).replace("-", "−")}, ${String(+x2.toFixed(4)).replace("-", "−")}` });
		return out;
	}
	const [o, cl] = strict(rel) ? ["(", ")"] : ["[", "]"];
	let res: string;
	if (!D) res = outside ? (strict(rel) ? `(−∞, ${l1}) ∪ (${l1}, ∞)` : "ℝ") : strict(rel) ? "∅" : `{${l1}}`;
	else if (outside) res = `(−∞, ${l1}${cl} ∪ ${o}${l2}, ∞)`;
	else res = `${o}${l1}, ${l2}${cl}`;
	out.push({ t: `${v} ∈ ${res}` });
	return out;
}
