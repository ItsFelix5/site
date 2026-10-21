export type RGB = [number, number, number];

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function toOklch(rgb: RGB): RGB {
	const [r, g, b] = rgb.map((v) => lin(v / 255));
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		Math.hypot(a, bb),
		((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
	];
}

export function fromOklch(L: number, C: number, H: number): RGB {
	for (;;) {
		const a = C * Math.cos((H * Math.PI) / 180);
		const b = C * Math.sin((H * Math.PI) / 180);
		const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
		const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
		const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
		const c = [
			4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
		].map(gam);
		if (C < 0.001 || c.every((v) => v >= -0.0005 && v <= 1.0005))
			return c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)) as RGB;
		C *= 0.97;
	}
}

export const hex = (c: RGB) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

export function toHsl([r, g, b]: RGB): RGB {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const d = max - Math.min(r, g, b);
	const l = max - d / 2;
	let h = 0;
	if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
}

const r = (n: number, p = 0) => +n.toFixed(p);

export const formats = (c: RGB) => {
	const [h, s, l] = toHsl(c);
	const [L, C, H] = toOklch(c);
	return [
		hex(c),
		`rgb(${c.join(" ")})`,
		`hsl(${r(h)} ${r(s * 100)}% ${r(l * 100)}%)`,
		`oklch(${r(L * 100, 1)}% ${r(C, 3)} ${r(H, 1)})`,
	];
};

export const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// lightness ramp keeping hue, chroma eased toward the extremes
export function scale(c: RGB): RGB[] {
	const [, C, H] = toOklch(c);
	return steps.map((_, i) => {
		const t = i / (steps.length - 1);
		return fromOklch(0.98 - t * 0.78, C * (0.25 + 1.5 * Math.sin(Math.PI * (0.1 + 0.8 * t)) ** 2 * 0.5), H);
	});
}

export const harmonies: Record<string, number[]> = {
	complementary: [0, 180],
	"split complementary": [0, 150, 210],
	analogous: [-30, 0, 30],
	triadic: [0, 120, 240],
	tetradic: [0, 90, 180, 270],
	square: [0, 60, 180, 240],
};

export function harmony(c: RGB, angles: number[]): RGB[] {
	const [L, C, H] = toOklch(c);
	return angles.map((a) => fromOklch(L, C, (H + a + 360) % 360));
}
