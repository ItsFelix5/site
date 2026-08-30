export interface TransformStyle {
	id: string;
	name: string;
}

export const styles: TransformStyle[] = [
	{ id: "bold", name: "Bold" },
	{ id: "italic", name: "Italic" },
	{ id: "bold-italic", name: "Bold Italic" },
	{ id: "script", name: "Script / Cursive" },
	{ id: "bold-script", name: "Bold Script / Cursive" },
	{ id: "fraktur", name: "Fraktur / Gothic" },
	{ id: "bold-fraktur", name: "Bold Fraktur / Gothic" },
	{ id: "double-struck", name: "Double-Struck" },
	{ id: "monospace", name: "Monospace" },
	{ id: "sans-serif", name: "Sans-Serif" },
	{ id: "sans-serif-bold", name: "Sans-Serif Bold" },
	{ id: "sans-serif-italic", name: "Sans-Serif Italic" },
	{ id: "sans-serif-bold-italic", name: "Sans-Serif Bold Italic" },
	{ id: "small-caps", name: "Small Caps" },
	{ id: "fullwidth", name: "Fullwidth" },
	{ id: "circled", name: "Circled" },
	{ id: "negative-circled", name: "Negative Circled" },
	{ id: "squared", name: "Squared" },
	{ id: "negative-squared", name: "Negative Squared" },
	{ id: "parenthesized", name: "Parenthesized" },
	{ id: "regional-indicators", name: "Regional Indicators" },
	{ id: "superscript", name: "Superscript" },
	{ id: "upside-down", name: "Upside Down" },
	{ id: "mocking", name: "Mocking SpongeBob" },
	{ id: "leetspeak", name: "Leetspeak" },
	{ id: "reverse", name: "Reverse" },
	{ id: "spaced-out", name: "Spaced Out" },
	{ id: "clapback", name: "Clapback 👏" },
	{ id: "zalgo", name: "Zalgo" },
];

export type StyleId = (typeof styles)[number]["id"];

export interface DecorationStyle {
	id: string;
	name: string;
}

// Decorations layer combining marks on top of whichever style is selected
// above, so e.g. Bold + Strikethrough or Fullwidth + Wavy both work.
export const decorations: DecorationStyle[] = [
	{ id: "strikethrough", name: "Strikethrough" },
	{ id: "slashed", name: "Slashed" },
	{ id: "underline", name: "Underline" },
	{ id: "double-underline", name: "Double Underline" },
	{ id: "wavy", name: "Wavy" },
	{ id: "dotted", name: "Dotted" },
];

// Enclosing marks draw a shape *around* whatever they're attached to. Unlike
// the precomposed Circled/Squared styles above (Latin letters and digits
// only), these are combining diacritics, so they work on any character —
// including digits, punctuation, or an already-styled letter.
export const enclosingMarks: DecorationStyle[] = [
	{ id: "enclosing-circle", name: "Circle" },
	{ id: "enclosing-square", name: "Square" },
	{ id: "enclosing-diamond", name: "Diamond" },
	{ id: "enclosing-keycap", name: "Keycap" },
	{ id: "enclosing-screen", name: "Screen" },
	{ id: "enclosing-triangle", name: "Triangle" },
];

export type DecorationId =
	| (typeof decorations)[number]["id"]
	| (typeof enclosingMarks)[number]["id"];

const DECORATION_MARKS: Record<DecorationId, number> = {
	strikethrough: 0x0336,
	slashed: 0x0335,
	underline: 0x0332,
	"double-underline": 0x0333,
	wavy: 0x0334,
	dotted: 0x0307,
	"enclosing-circle": 0x20dd,
	"enclosing-square": 0x20de,
	"enclosing-diamond": 0x20df,
	"enclosing-keycap": 0x20e3,
	"enclosing-screen": 0x20e2,
	"enclosing-triangle": 0x20e4,
};

// Splits on grapheme clusters rather than UTF-16 code units or raw code
// points, so an emoji sequence or a letter with its own combining marks
// (e.g. pasted-in zalgo text) moves through every transform as one unit
// instead of being torn apart.
function graphemes(text: string): string[] {
	return Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
		(s) => s.segment,
	);
}

// Applies `fn` to every grapheme that is a single code point (a plain
// letter/digit/punctuation mark) and leaves multi-code-point clusters
// (emoji, accented letters, existing combining sequences) untouched.
function mapGraphemes(text: string, fn: (single: string) => string): string {
	return graphemes(text)
		.map((g) => (Array.from(g).length === 1 ? fn(g) : g))
		.join("");
}

interface CodePointMapOptions {
	upperBase?: number;
	lowerBase?: number;
	digitBase?: number;
	holes?: Record<string, number>;
	space?: number;
}

function codePointMap(
	text: string,
	{ upperBase, lowerBase, digitBase, holes = {}, space }: CodePointMapOptions,
): string {
	return mapGraphemes(text, (ch) => {
		if (holes[ch] !== undefined) return String.fromCodePoint(holes[ch]);
		if (space !== undefined && ch === " ") return String.fromCodePoint(space);

		const code = ch.codePointAt(0)!;
		if (upperBase !== undefined && code >= 65 && code <= 90)
			return String.fromCodePoint(upperBase + (code - 65));
		if (lowerBase !== undefined && code >= 97 && code <= 122)
			return String.fromCodePoint(lowerBase + (code - 97));
		if (digitBase !== undefined && code >= 48 && code <= 57)
			return String.fromCodePoint(digitBase + (code - 48));

		return ch;
	});
}

const circledDigitHoles: Record<string, number> = { "0": 0x24ea };
for (let d = 1; d <= 9; d++) circledDigitHoles[String(d)] = 0x2460 + (d - 1);

const smallCapsHoles: Record<string, number> = {
	a: 0x1d00,
	b: 0x0299,
	c: 0x1d04,
	d: 0x1d05,
	e: 0x1d07,
	f: 0xa730,
	g: 0x0262,
	h: 0x029c,
	i: 0x026a,
	j: 0x1d0a,
	k: 0x1d0b,
	l: 0x029f,
	m: 0x1d0d,
	n: 0x0274,
	o: 0x1d0f,
	p: 0x1d18,
	r: 0x0280,
	s: 0xa731,
	t: 0x1d1b,
	u: 0x1d1c,
	v: 0x1d20,
	w: 0x1d21,
	y: 0x028f,
	z: 0x1d22,
};

// Every lowercase letter except "q" has a real Unicode superscript glyph;
// no case-distinct uppercase forms exist for a good chunk of the alphabet
// (C, F, Q, S, X, Y, Z), so rather than leaving those full-size and having
// them stick out among the tiny ones, superscript folds case and always
// uses the lowercase glyph. "q" has no superscript form in any case and is
// left as-is — a single rare letter, and the only real gap left.
const superscriptLetters: Record<string, number> = {
	a: 0x1d43,
	b: 0x1d47,
	c: 0x1d9c,
	d: 0x1d48,
	e: 0x1d49,
	f: 0x1da0,
	g: 0x1d4d,
	h: 0x02b0,
	i: 0x2071,
	j: 0x02b2,
	k: 0x1d4f,
	l: 0x02e1,
	m: 0x1d50,
	n: 0x207f,
	o: 0x1d52,
	p: 0x1d56,
	r: 0x02b3,
	s: 0x02e2,
	t: 0x1d57,
	u: 0x1d58,
	v: 0x1d5b,
	w: 0x02b7,
	x: 0x02e3,
	y: 0x02b8,
	z: 0x1dbb,
};

const superscriptDigits: Record<string, number> = {
	"0": 0x2070,
	"1": 0x00b9,
	"2": 0x00b2,
	"3": 0x00b3,
	"4": 0x2074,
	"5": 0x2075,
	"6": 0x2076,
	"7": 0x2077,
	"8": 0x2078,
	"9": 0x2079,
};

function superscript(text: string): string {
	return mapGraphemes(text, (ch) => {
		if (superscriptDigits[ch] !== undefined)
			return String.fromCodePoint(superscriptDigits[ch]);
		const lower = ch.toLowerCase();
		return superscriptLetters[lower] !== undefined
			? String.fromCodePoint(superscriptLetters[lower])
			: ch;
	});
}

const upsideDownMap: Record<string, string> = {
	a: "ɐ",
	b: "q",
	c: "ɔ",
	d: "p",
	e: "ǝ",
	f: "ɟ",
	g: "ƃ",
	h: "ɥ",
	i: "ᴉ",
	j: "ɾ",
	k: "ʞ",
	l: "l",
	m: "ɯ",
	n: "u",
	o: "o",
	p: "d",
	q: "b",
	r: "ɹ",
	s: "s",
	t: "ʇ",
	u: "n",
	v: "ʌ",
	w: "ʍ",
	x: "x",
	y: "ʎ",
	z: "z",
	A: "∀",
	B: "ᙠ",
	C: "Ɔ",
	D: "ᗡ",
	E: "Ǝ",
	F: "Ⅎ",
	G: "⅁",
	H: "H",
	I: "I",
	J: "ſ",
	K: "ʞ",
	L: "˥",
	M: "W",
	N: "N",
	O: "O",
	P: "Ԁ",
	Q: "Ò",
	R: "ᴚ",
	S: "S",
	T: "⊥",
	U: "∩",
	V: "Λ",
	W: "M",
	X: "X",
	Y: "⅄",
	Z: "Z",
	"0": "0",
	"1": "Ɩ",
	"2": "ᄅ",
	"3": "Ɛ",
	"4": "ㄣ",
	"5": "5",
	"6": "9",
	"7": "ㄥ",
	"8": "8",
	"9": "6",
	".": "˙",
	",": "'",
	"'": ",",
	'"': "„",
	"!": "¡",
	"?": "¿",
	"(": ")",
	")": "(",
	"[": "]",
	"]": "[",
	"{": "}",
	"}": "{",
	"<": ">",
	">": "<",
	"&": "⅋",
	_: "‾",
	";": "؛",
};

const leetMap: Record<string, string> = {
	a: "4",
	A: "4",
	b: "8",
	B: "8",
	e: "3",
	E: "3",
	g: "9",
	G: "9",
	i: "1",
	I: "1",
	l: "1",
	L: "1",
	o: "0",
	O: "0",
	s: "5",
	S: "5",
	t: "7",
	T: "7",
};

// Combining marks used to build "zalgo" text, grouped by where they render
// relative to the base character. Marks documented as spanning *two* base
// characters (the "double" diacritics, and the Cyrillic millions sign) are
// deliberately excluded — applied to a single character they render with
// stray width/overhang instead of stacking cleanly.
const ZALGO_UP = [
	0x030d, 0x030e, 0x0304, 0x0305, 0x033f, 0x0311, 0x0306, 0x0310, 0x0352,
	0x0357, 0x0351, 0x0307, 0x0308, 0x030a, 0x0342, 0x0343, 0x0344, 0x034a,
	0x034b, 0x034c, 0x0303, 0x0302, 0x030c, 0x0350, 0x0300, 0x0301, 0x030b,
	0x030f, 0x0312, 0x0313, 0x0314, 0x033d, 0x0309, 0x0363, 0x0364, 0x0365,
	0x0366, 0x0367, 0x0368, 0x0369, 0x036a, 0x036b, 0x036c, 0x036d, 0x036e,
	0x036f, 0x033e, 0x035b, 0x0346, 0x031a,
].map((code) => String.fromCodePoint(code));

const ZALGO_DOWN = [
	0x0316, 0x0317, 0x0318, 0x0319, 0x031c, 0x031d, 0x031e, 0x031f, 0x0320,
	0x0324, 0x0325, 0x0326, 0x0329, 0x032a, 0x032b, 0x032c, 0x032d, 0x032e,
	0x032f, 0x0330, 0x0331, 0x0332, 0x0333, 0x0339, 0x033a, 0x033b, 0x033c,
	0x0345, 0x0347, 0x0348, 0x0349, 0x034d, 0x034e, 0x0353, 0x0354, 0x0355,
	0x0356, 0x0359, 0x035a, 0x0323,
].map((code) => String.fromCodePoint(code));

const ZALGO_MID = [
	0x0315, 0x031b, 0x0340, 0x0341, 0x0358, 0x0321, 0x0322, 0x0327, 0x0328,
	0x0334, 0x0335, 0x0336, 0x0338, 0x0337,
].map((code) => String.fromCodePoint(code));

export interface ZalgoOptions {
	intensity: number;
	up: boolean;
	mid: boolean;
	down: boolean;
}

function zalgo(text: string, { intensity, up, mid, down }: ZalgoOptions): string {
	// Scale gently: most of the slider's range should still look like text,
	// not noise. Only the very top of the range piles marks on thick.
	const maxMarks =
		intensity <= 0 ? 0 : Math.max(1, Math.round((intensity / 100) ** 1.5 * 6));
	const pools = [up && ZALGO_UP, mid && ZALGO_MID, down && ZALGO_DOWN].filter(
		(pool): pool is string[] => Array.isArray(pool),
	);
	if (!pools.length || !maxMarks) return text;

	return graphemes(text)
		.map((g) => {
			if (g === "\n" || g === "\r") return g;
			let out = g;
			for (const pool of pools) {
				const count = Math.floor(Math.random() * (maxMarks + 1));
				for (let i = 0; i < count; i++) {
					out += pool[Math.floor(Math.random() * pool.length)];
				}
			}
			return out;
		})
		.join("");
}

export function decorate(text: string, active: DecorationId[]): string {
	if (!active.length) return text;
	const marks = active.map((id) => String.fromCodePoint(DECORATION_MARKS[id])).join("");
	return graphemes(text)
		.map((g) => (g === "\n" || g === "\r" ? g : g + marks))
		.join("");
}

function wordsOf(text: string): string[] {
	return text.trim().split(/\s+/).filter(Boolean);
}

function spacedOut(text: string): string {
	return graphemes(text).join(" ");
}

function clapback(text: string): string {
	const words = wordsOf(text);
	return words.length ? words.map((w) => w.toUpperCase()).join(" 👏 ") : text;
}

// Maps every letter to its uppercase counterpart's enclosed-alphanumeric
// glyph at `base` (these Unicode blocks only define capital forms).
function uppercaseEnclosed(text: string, base: number): string {
	return mapGraphemes(text, (ch) => {
		const code = ch.toUpperCase().codePointAt(0)!;
		return code >= 65 && code <= 90 ? String.fromCodePoint(base + (code - 65)) : ch;
	});
}

function squared(text: string): string {
	return uppercaseEnclosed(text, 0x1f130);
}

function negativeSquared(text: string): string {
	return uppercaseEnclosed(text, 0x1f170);
}

// Two adjacent Regional Indicator symbols render as a country flag emoji in
// most fonts, so "US" would silently become 🇺🇸 instead of two letters. A
// zero-width non-joiner between consecutive ones breaks that pairing
// (flag formation requires the pair to be immediately adjacent) without
// being visible itself.
const ZWNJ = String.fromCodePoint(0x200c);

function regionalIndicators(text: string): string {
	const out: string[] = [];
	let prevWasFlagLetter = false;

	for (const g of graphemes(text)) {
		const code = Array.from(g).length === 1 ? g.toUpperCase().codePointAt(0)! : -1;
		if (code >= 65 && code <= 90) {
			if (prevWasFlagLetter) out.push(ZWNJ);
			out.push(String.fromCodePoint(0x1f1e6 + (code - 65)));
			prevWasFlagLetter = true;
		} else {
			out.push(g);
			prevWasFlagLetter = false;
		}
	}

	return out.join("");
}

function negativeCircled(text: string): string {
	return mapGraphemes(text, (ch) => {
		if (ch >= "0" && ch <= "9") {
			return ch === "0"
				? String.fromCodePoint(0x24ff)
				: String.fromCodePoint(0x2775 + Number(ch));
		}
		const code = ch.toUpperCase().codePointAt(0)!;
		return code >= 65 && code <= 90
			? String.fromCodePoint(0x1f150 + (code - 65))
			: ch;
	});
}

// Parenthesized Latin letters only exist in lowercase form, and
// parenthesized digits only exist for 1-9.
function parenthesized(text: string): string {
	return mapGraphemes(text, (ch) => {
		if (ch >= "1" && ch <= "9") return String.fromCodePoint(0x2473 + Number(ch));
		const code = ch.toLowerCase().codePointAt(0)!;
		return code >= 97 && code <= 122
			? String.fromCodePoint(0x249c + (code - 97))
			: ch;
	});
}

function upsideDown(text: string): string {
	return graphemes(text)
		.map((g) => upsideDownMap[g] ?? g)
		.reverse()
		.join("");
}

function mocking(text: string): string {
	let letterIndex = 0;
	return graphemes(text)
		.map((g) => {
			if (!/^[a-z]$/i.test(g)) return g;
			const out = letterIndex % 2 === 0 ? g.toLowerCase() : g.toUpperCase();
			letterIndex++;
			return out;
		})
		.join("");
}

export function transform(
	id: StyleId,
	text: string,
	zalgoOptions: ZalgoOptions,
): string {
	switch (id) {
		case "bold":
			return codePointMap(text, {
				upperBase: 0x1d400,
				lowerBase: 0x1d41a,
				digitBase: 0x1d7ce,
			});
		case "italic":
			return codePointMap(text, {
				upperBase: 0x1d434,
				lowerBase: 0x1d44e,
				holes: { h: 0x210e },
			});
		case "bold-italic":
			return codePointMap(text, {
				upperBase: 0x1d468,
				lowerBase: 0x1d482,
			});
		case "script":
			return codePointMap(text, {
				upperBase: 0x1d49c,
				lowerBase: 0x1d4b6,
				holes: {
					B: 0x212c,
					E: 0x2130,
					F: 0x2131,
					H: 0x210b,
					I: 0x2110,
					L: 0x2112,
					M: 0x2133,
					R: 0x211b,
					e: 0x212f,
					g: 0x210a,
					o: 0x2134,
				},
			});
		case "bold-script":
			return codePointMap(text, {
				upperBase: 0x1d4d0,
				lowerBase: 0x1d4ea,
			});
		case "fraktur":
			return codePointMap(text, {
				upperBase: 0x1d504,
				lowerBase: 0x1d51e,
				holes: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
			});
		case "bold-fraktur":
			return codePointMap(text, {
				upperBase: 0x1d56c,
				lowerBase: 0x1d586,
			});
		case "double-struck":
			return codePointMap(text, {
				upperBase: 0x1d538,
				lowerBase: 0x1d552,
				digitBase: 0x1d7d8,
				holes: {
					C: 0x2102,
					H: 0x210d,
					N: 0x2115,
					P: 0x2119,
					Q: 0x211a,
					R: 0x211d,
					Z: 0x2124,
				},
			});
		case "monospace":
			return codePointMap(text, {
				upperBase: 0x1d670,
				lowerBase: 0x1d68a,
				digitBase: 0x1d7f6,
			});
		case "sans-serif":
			return codePointMap(text, {
				upperBase: 0x1d5a0,
				lowerBase: 0x1d5ba,
				digitBase: 0x1d7e2,
			});
		case "sans-serif-bold":
			return codePointMap(text, {
				upperBase: 0x1d5d4,
				lowerBase: 0x1d5ee,
				digitBase: 0x1d7ec,
			});
		case "sans-serif-italic":
			return codePointMap(text, {
				upperBase: 0x1d608,
				lowerBase: 0x1d622,
			});
		case "sans-serif-bold-italic":
			return codePointMap(text, {
				upperBase: 0x1d63c,
				lowerBase: 0x1d656,
			});
		case "small-caps":
			return codePointMap(text, { holes: smallCapsHoles });
		case "fullwidth":
			return codePointMap(text, {
				upperBase: 0xff21,
				lowerBase: 0xff41,
				digitBase: 0xff10,
				space: 0x3000,
			});
		case "circled":
			return codePointMap(text, {
				upperBase: 0x24b6,
				lowerBase: 0x24d0,
				holes: circledDigitHoles,
			});
		case "negative-circled":
			return negativeCircled(text);
		case "squared":
			return squared(text);
		case "negative-squared":
			return negativeSquared(text);
		case "parenthesized":
			return parenthesized(text);
		case "regional-indicators":
			return regionalIndicators(text);
		case "superscript":
			return superscript(text);
		case "upside-down":
			return upsideDown(text);
		case "mocking":
			return mocking(text);
		case "leetspeak":
			return mapGraphemes(text, (ch) => leetMap[ch] ?? ch);
		case "reverse":
			return graphemes(text).reverse().join("");
		case "spaced-out":
			return spacedOut(text);
		case "clapback":
			return clapback(text);
		case "zalgo":
			return zalgo(text, zalgoOptions);
		default:
			return text;
	}
}
