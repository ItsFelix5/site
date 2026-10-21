export const tools = [
	{
		slug: "background-remover",
		name: "Background Remover",
	},
	{
		slug: "base64",
		name: "Base64",
	},
	{
		slug: "colors",
		name: "Colors",
	},
	{
		slug: "diff",
		name: "Diff",
	},
	{
		slug: "dns-lookup",
		name: "DNS Lookup",
	},
	{
		slug: "solver",
		name: "Equation Solver",
	},
	{
		slug: "media",
		name: "Media Editor",
	},
	{
		slug: "ocr",
		name: "OCR",
	},
	{
		slug: "password-generator",
		name: "Password Generator",
	},
	{
		slug: "qr-code",
		name: "QR Code",
	},
	{
		slug: "randomizer",
		name: "Randomizer",
	},
	{
		slug: "recorder",
		name: "Recorder",
	},
	{
		slug: "text-transformer",
		name: "Text Transformer",
	},
	{
		slug: "unicode",
		name: "Unicode Analyser",
	},
] as const;

export type ToolSlug = (typeof tools)[number]["slug"];
