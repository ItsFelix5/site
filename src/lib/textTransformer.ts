const graphemes = (text: string) =>
	Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
		({ segment }) => segment,
	);

const mapGraphemes = (text: string, fn: (char: string) => string) =>
	graphemes(text).map((g) => (Array.from(g).length === 1 ? fn(g) : g)).join("");

type CodePointMap = {
	upperBase?: number;
	lowerBase?: number;
	digitBase?: number;
	holes?: Record<string, number>;
	space?: number;
};

const styleMaps: Record<string, CodePointMap> = {
	"Bold": { upperBase: 0x1d400, lowerBase: 0x1d41a, digitBase: 0x1d7ce },
	"Italic": { upperBase: 0x1d434, lowerBase: 0x1d44e, holes: { h: 0x210e } },
	"Bold Italic": { upperBase: 0x1d468, lowerBase: 0x1d482 },
	"Cursive": {
		upperBase: 0x1d49c, lowerBase: 0x1d4b6,
		holes: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110,
			L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
	},
	"Bold Cursive": { upperBase: 0x1d4d0, lowerBase: 0x1d4ea },
	"Gothic": {
		upperBase: 0x1d504, lowerBase: 0x1d51e,
		holes: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
	},
	"Bold Gothic": { upperBase: 0x1d56c, lowerBase: 0x1d586 },
	"Double Struck": {
		upperBase: 0x1d538, lowerBase: 0x1d552, digitBase: 0x1d7d8,
		holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
	},
	"Monospace": { upperBase: 0x1d670, lowerBase: 0x1d68a, digitBase: 0x1d7f6 },
	"Sans-Serif": { upperBase: 0x1d5a0, lowerBase: 0x1d5ba, digitBase: 0x1d7e2 },
	"Bold Sans-Serif": { upperBase: 0x1d5d4, lowerBase: 0x1d5ee, digitBase: 0x1d7ec },
	"Italic Sans-Serif": { upperBase: 0x1d608, lowerBase: 0x1d622 },
	"Bold Italic Sans-Serif": { upperBase: 0x1d63c, lowerBase: 0x1d656 },
	"Small Caps": {
		holes: {
			a: 0x1d00, b: 0x299, c: 0x1d04, d: 0x1d05, e: 0x1d07, f: 0xa730, g: 0x262,
			h: 0x29c, i: 0x26a, j: 0x1d0a, k: 0x1d0b, l: 0x29f, m: 0x1d0d, n: 0x274,
			o: 0x1d0f, p: 0x1d18, r: 0x280, s: 0xa731, t: 0x1d1b, u: 0x1d1c,
			v: 0x1d20, w: 0x1d21, y: 0x28f, z: 0x1d22,
		},
	},
	"Fullwidth": { upperBase: 0xff21, lowerBase: 0xff41, digitBase: 0xff10, space: 0x3000 },
	"Circled": { upperBase: 0x24b6, lowerBase: 0x24d0, holes: { "0": 0x24ea, ...Array.from({ length: 9 }, (_, i) => ({ [String(i + 1)]: 0x2460 + i })) } as Record<string, number> },
};

const superscript: Record<string, number> = {
	a: 0x1d43, b: 0x1d47, c: 0x1d9c, d: 0x1d48, e: 0x1d49, f: 0x1da0, g: 0x1d4d,
	h: 0x2b0, i: 0x2071, j: 0x2b2, k: 0x1d4f, l: 0x2e1, m: 0x1d50, n: 0x207f,
	o: 0x1d52, p: 0x1d56, r: 0x2b3, s: 0x2e2, t: 0x1d57, u: 0x1d58, v: 0x1d5b,
	w: 0x2b7, x: 0x2e3, y: 0x2b8, z: 0x1dbb,
	"0": 0x2070, "1": 0xb9, "2": 0xb2, "3": 0xb3, "4": 0x2074, "5": 0x2075,
	"6": 0x2076, "7": 0x2077, "8": 0x2078, "9": 0x2079,
};

const upsideDown: Record<string, string> = {
	a:"ɐ",b:"q",c:"ɔ",d:"p",e:"ǝ",f:"ɟ",g:"ƃ",h:"ɥ",i:"ᴉ",j:"ɾ",k:"ʞ",l:"l",m:"ɯ",
	n:"u",o:"o",p:"d",q:"b",r:"ɹ",s:"s",t:"ʇ",u:"n",v:"ʌ",w:"ʍ",x:"x",y:"ʎ",z:"z",
	A:"∀",B:"ᙠ",C:"Ɔ",D:"ᗡ",E:"Ǝ",F:"Ⅎ",G:"⅁",H:"H",I:"I",J:"ſ",K:"ʞ",L:"˥",M:"W",
	N:"N",O:"O",P:"Ԁ",Q:"Ò",R:"ᴚ",S:"S",T:"⊥",U:"∩",V:"Λ",W:"M",X:"X",Y:"⅄",Z:"Z",
	"0":"0","1":"Ɩ","2":"ᄅ","3":"Ɛ","4":"ㄣ","5":"5","6":"9","7":"ㄥ","8":"8","9":"6",
	".":"˙",",":"'", "'":",", '"':"„","!":"¡","?":"¿","(":")",")":"(","[":"]","]":"[",
	"{":"}","}":"{","<":">",">":"<","&":"⅋","_":"‾",";":"؛",
};

const leet: Record<string, string> = {
	a:"4",A:"4",b:"8",B:"8",e:"3",E:"3",g:"9",G:"9",i:"1",I:"1",l:"1",L:"1",
	o:"0",O:"0",s:"5",S:"5",t:"7",T:"7",
};

const morseMap: Record<string, string> = {
	A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
	I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
	Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
	Y: "-.--", Z: "--..",
	"0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
	"5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
	".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
	"/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
	";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
	'"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};

const marks: Record<string, number> = {
	"Strikethrough": 0x336, "Slashed": 0x335, "Underline": 0x332, "Double Underline": 0x333,
	"Wavy": 0x334, "Dotted": 0x307, "Circle": 0x20dd, "Square": 0x20de,
	"Diamond": 0x20df, "Keycap": 0x20e3, "Screen": 0x20e2,
	"Triangle": 0x20e4,
};

const enclosed = (text: string, base: number) =>
	mapGraphemes(text, (ch) => {
		const code = ch.toUpperCase().codePointAt(0)!;
		return code >= 65 && code <= 90 ? String.fromCodePoint(base + code - 65) : ch;
	});

const zalgoPools = {
	up: [0x30d,0x30e,0x304,0x305,0x33f,0x311,0x306,0x310,0x352,0x357,0x351,0x307,0x308,0x30a,0x342,0x343,0x344,0x34a,0x34b,0x34c,0x303,0x302,0x30c,0x350,0x300,0x301,0x30b,0x30f,0x312,0x313,0x314,0x33d,0x309,0x33e,0x35b,0x346,0x31a],
	mid: [0x315,0x31b,0x340,0x341,0x358,0x321,0x322,0x327,0x328,0x334,0x335,0x336,0x338,0x337],
	down: [0x316,0x317,0x318,0x319,0x31c,0x31d,0x31e,0x31f,0x320,0x324,0x325,0x326,0x329,0x32a,0x32b,0x32c,0x32d,0x32e,0x32f,0x330,0x331,0x332,0x333,0x339,0x33a,0x33b,0x33c,0x345,0x347,0x348,0x349,0x34d,0x34e,0x353,0x354,0x355,0x356,0x359,0x35a,0x323],
};

export function transform(
	name: string,
	text: string,
	zalgoOptions: { intensity: number; up: boolean; mid: boolean; down: boolean },
): string {
	const map = styleMaps[name];
	if (map) return mapGraphemes(text, (ch) => {
		if (map.holes?.[ch] !== undefined) return String.fromCodePoint(map.holes[ch]);
		if (ch === " " && map.space !== undefined) return String.fromCodePoint(map.space);

		const code = ch.codePointAt(0)!;
		if (map.upperBase !== undefined && code >= 65 && code <= 90)
			return String.fromCodePoint(map.upperBase + code - 65);
		if (map.lowerBase !== undefined && code >= 97 && code <= 122)
			return String.fromCodePoint(map.lowerBase + code - 97);
		if (map.digitBase !== undefined && code >= 48 && code <= 57)
			return String.fromCodePoint(map.digitBase + code - 48);

		return ch;
	})

	const mark = marks[name];
	if (mark !== undefined) {
		const suffix = String.fromCodePoint(mark);
		return graphemes(text).map((g) => (/[\r\n]/.test(g) || (g == " " && name.startsWith("enclosing")) ? g : g + suffix)).join("");
	}

	switch (name) {
		case "Negative Circled": return mapGraphemes(text, (ch) => {
			if (ch >= "0" && ch <= "9")
				return String.fromCodePoint(ch === "0" ? 0x24ff : 0x2775 + +ch);
			const code = ch.toUpperCase().codePointAt(0)!;
			return code >= 65 && code <= 90 ? String.fromCodePoint(0x1f150 + code - 65) : ch;
		});
		case "Squared": return enclosed(text, 0x1f130);
		case "Negative Squared": return enclosed(text, 0x1f170);
		case "Parenthesized": return mapGraphemes(text, (ch) => {
			if (ch >= "1" && ch <= "9") return String.fromCodePoint(0x2473 + +ch);
			const code = ch.toLowerCase().codePointAt(0)!;
			return code >= 97 && code <= 122 ? String.fromCodePoint(0x249c + code - 97) : ch;
		});
		case "Regional Indicators": {
			const out: string[] = [];
			let previous = false;

			for (const g of graphemes(text)) {
				const code = Array.from(g).length === 1 ? g.toUpperCase().codePointAt(0)! : -1;
				if (code >= 65 && code <= 90) {
					if (previous) out.push("\u200c");
					out.push(String.fromCodePoint(0x1f1e6 + code - 65));
					previous = true;
				} else {
					out.push(g);
					previous = false;
				}
			}
			return out.join("");
		}
		case "Superscript": return mapGraphemes(text, (ch) =>
			superscript[ch.toLowerCase()] !== undefined
				? String.fromCodePoint(superscript[ch.toLowerCase()])
				: ch
		);
		case "Upside Down": return graphemes(text).map((g) => upsideDown[g] ?? g).reverse().join("");
		case "Mocking": {
			let index = 0;
			return graphemes(text).map((g) => {
				if (!/^[a-z]$/i.test(g)) return g;
				return index++ % 2 ? g.toUpperCase() : g.toLowerCase();
			}).join("");
		}
		case "Leetspeak": return mapGraphemes(text, (ch) => leet[ch] ?? ch);
		case "Morse": return text.split(/\s+/).filter(Boolean)
			.map((word) => Array.from(word.toUpperCase()).map((ch) => morseMap[ch] ?? ch).join(" "))
			.join(" / ");
		case "Binary": return Array.from(new TextEncoder().encode(text))
			.map((byte) => byte.toString(2).padStart(8, "0")).join(" ");
		case "Hex": return Array.from(new TextEncoder().encode(text))
			.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
		case "Reverse": return graphemes(text).reverse().join("");
		case "Spaced Out": return graphemes(text).join(" ");
		case "Clapback": return text.trim().split(/\s+/).filter(Boolean).map((w) => w.toUpperCase()).join(" 👏 ");
		case "Zalgo": {
			const max = (zalgoOptions.intensity / 100) ** 1.5 * 8;
			const pools = [zalgoOptions.up && zalgoPools.up, zalgoOptions.mid && zalgoPools.mid, zalgoOptions.down && zalgoPools.down]
				.filter((pool): pool is number[] => !!pool)
				.flat();

			if (!pools.length) return text;

			return graphemes(text).map((g) => {
				if (g === "\n" || g === "\r") return g;
				let result = g;
				const marks = Math.floor(Math.random() * (max + 1));
				for (let i = 0; i < marks; i++)
					result += String.fromCodePoint(pools[Math.floor(Math.random() * pools.length)]);
				return result;
			}).join("");
		}
		default: return text;
	}
}