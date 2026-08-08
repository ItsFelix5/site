export const tools = [
	{
		slug: "base64",
		name: "Base64",
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
		slug: "ocr",
		name: "OCR",
	},
	{
		slug: "password-generator",
		name: "Password Generator",
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
		slug: "unicode",
		name: "Unicode Analyser",
	},
] as const;

export type ToolSlug = (typeof tools)[number]["slug"];
