export type Direction = "a-to-b" | "b-to-a";

export interface EditOp {
	type: "equal" | "delete" | "insert";
	text: string;
}

export interface Span {
	from: number;
	to: number;
}

export interface LineInfo {
	text: string;
	kind: "equal" | "modify" | "add" | "remove" | "move";
	hunkIndex?: number;
	moveIndex?: number;
	tokenSpans?: Span[];
}

export type HunkKind = "modify" | "add" | "remove";
export interface Hunk {
	kind: HunkKind;
	aStart: number;
	aEnd: number;
	bStart: number;
	bEnd: number;
}

export interface MovePair {
	aIndex: number;
	bIndex: number;
}

export interface AlignBlock {
	kind: "equal" | "change";
	aStart: number;
	aEnd: number;
	bStart: number;
	bEnd: number;
}

export interface DiffResult {
	a: LineInfo[];
	b: LineInfo[];
	hunks: Hunk[];
	moves: MovePair[];
	blocks: AlignBlock[];
	stats: { added: number; removed: number; modified: number; moved: number };
}

export interface ParsedDiff {
	aText: string;
	bText: string;
}

const TOKEN_RE = /\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g;
const MODIFY_THRESHOLD = 0.3;
const MOVE_MIN_LENGTH = 3;
const MAX_LINE_EDIT_DISTANCE = 256;
const MAX_TOKEN_EDIT_DISTANCE = 128;
const MAX_REFINEMENT_CELLS = 4_000;

export function diffArrays(
	a: string[],
	b: string[],
	equals: (x: string, y: string) => boolean = (x, y) => x === y,
	maxEditDistance = Infinity,
): EditOp[] {
	const max = a.length + b.length;
	if (!max) return [];

	const v: Record<number, number> = { 1: 0 };
	const trace: Record<number, number>[] = [];

	for (let d = 0; d <= max; d++) {
		if (d > maxEditDistance) {
			let start = 0;
			while (start < a.length && start < b.length && equals(a[start], b[start])) start++;

			let aEnd = a.length, bEnd = b.length;
			while (aEnd > start && bEnd > start && equals(a[aEnd - 1], b[bEnd - 1])) {
				aEnd--;
				bEnd--;
			}

			return [
				...a.slice(0, start).map((text) => ({ type: "equal" as const, text })),
				...a.slice(start, aEnd).map((text) => ({ type: "delete" as const, text })),
				...b.slice(start, bEnd).map((text) => ({ type: "insert" as const, text })),
				...a.slice(aEnd).map((text) => ({ type: "equal" as const, text })),
			];
		}
		trace.push({ ...v });
		for (let k = -d; k <= d; k += 2) {
			let x = k === -d || (k !== d && v[k - 1] < v[k + 1]) ? v[k + 1] : v[k - 1] + 1;
			let y = x - k;
			while (x < a.length && y < b.length && equals(a[x], b[y])) { x++; y++; }
			v[k] = x;
			if (x >= a.length && y >= b.length) {
				let x = a.length, y = b.length;
				const ops: EditOp[] = [];

				for (let e = d; e >= 0; e--) {
					const v = trace[e], k = x - y;
					const prevK = k === -e || (k !== e && v[k - 1] < v[k + 1]) ? k + 1 : k - 1;
					const prevX = v[prevK], prevY = prevX - prevK;

					while (x > prevX && y > prevY) { ops.push({ type: "equal", text: a[--x] }); y--; }
					if (!e) continue;
					if (x === prevX) ops.push({ type: "insert", text: b[--y] });
					else ops.push({ type: "delete", text: a[--x] });
				}
				return ops.reverse();
			}
		}
	}
	return [];
}

const tokenize = (line: string) => line.match(TOKEN_RE) ?? [];

function tokenDiffSpans(a: string, b: string): { aSpans: Span[]; bSpans: Span[] } {
	let aPos = 0, bPos = 0;
	const aSpans: Span[] = [], bSpans: Span[] = [];

	for (const { type, text } of diffArrays(
		tokenize(a), tokenize(b), undefined, MAX_TOKEN_EDIT_DISTANCE,
	)) {
		const len = text.length;
		if (type === "equal") { aPos += len; bPos += len; }
		else if (type === "delete") { aSpans.push({ from: aPos, to: aPos + len }); aPos += len; }
		else { bSpans.push({ from: bPos, to: bPos + len }); bPos += len; }
	}
	return { aSpans, bSpans };
}

function addHunk(
	hunks: Hunk[], kind: HunkKind, aStart: number, aEnd: number, bStart: number, bEnd: number,
): number {
	hunks.push({ kind, aStart, aEnd, bStart, bEnd });
	return hunks.length - 1;
}

function markModifiedPairs(
	pairs: Array<[number, number]>, a: LineInfo[], b: LineInfo[], aLines: string[], bLines: string[], hunkIndex: number,
) {
	for (const [ai, bi] of pairs) {
		const { aSpans, bSpans } = tokenDiffSpans(aLines[ai], bLines[bi]);
		Object.assign(a[ai], { kind: "modify", hunkIndex, tokenSpans: aSpans });
		Object.assign(b[bi], { kind: "modify", hunkIndex, tokenSpans: bSpans });
	}
}

const STRIP_WHITESPACE_RE = /\s+/g;

function splitSpansByLine(indices: number[], lines: string[], spans: Span[]): Span[][] {
	const perLine: Span[][] = indices.map(() => []);
	const starts: number[] = [];
	let cursor = 0;

	for (const index of indices) {
		starts.push(cursor);
		cursor += lines[index].length + 1;
	}

	for (const span of spans) {
		for (let i = 0; i < indices.length; i++) {
			const lineStart = starts[i], lineEnd = lineStart + lines[indices[i]].length;
			const from = Math.max(span.from, lineStart), to = Math.min(span.to, lineEnd);
			if (to > from) perLine[i].push({ from: from - lineStart, to: to - lineStart });
		}
	}
	return perLine;
}

export function computeDiff(aText: string, bText: string): DiffResult {
	const aLines = aText.split("\n"), bLines = bText.split("\n");
	const ops = diffArrays(aLines, bLines, undefined, MAX_LINE_EDIT_DISTANCE);
	const blocks: AlignBlock[] = [];
	let ai1 = 0, bi1 = 0, i1 = 0;

	while (i1 < ops.length) {
		const equal = ops[i1].type === "equal", aStart = ai1, bStart = bi1;
		while (i1 < ops.length && (ops[i1].type === "equal") === equal) {
			if (ops[i1].type !== "insert") ai1++;
			if (ops[i1].type !== "delete") bi1++;
			i1++;
		}
		blocks.push({ kind: equal ? "equal" : "change", aStart, aEnd: ai1, bStart, bEnd: bi1 });
	}
	const a = aLines.map<LineInfo>((text) => ({ text, kind: "equal" }));
	const b = bLines.map<LineInfo>((text) => ({ text, kind: "equal" }));
	const hunks: Hunk[] = [];
	let ai = 0, bi = 0, i = 0;

	while (i < ops.length) {
		if (ops[i].type === "equal") { ai++; bi++; i++; continue; }

		const dels: number[] = [], inss: number[] = [];
		while (i < ops.length && ops[i].type !== "equal") {
			if (ops[i].type === "delete") dels.push(ai++);
			else inss.push(bi++);
			i++;
		}

		const stripped = dels.map((index) => aLines[index]).join("").replace(STRIP_WHITESPACE_RE, "");
		if (stripped.length > 0 && stripped === inss.map((index) => bLines[index]).join("").replace(STRIP_WHITESPACE_RE, "")) {
			const hunkIndex = addHunk(hunks, "modify", dels[0], dels.at(-1)! + 1, inss[0], inss.at(-1)! + 1);
			const { aSpans, bSpans } = tokenDiffSpans(
				dels.map((index) => aLines[index]).join("\n"),
				inss.map((index) => bLines[index]).join("\n"),
			);

			splitSpansByLine(dels, aLines, aSpans).forEach((tokenSpans, i) =>
				Object.assign(a[dels[i]], { kind: "modify", hunkIndex, tokenSpans }),
			);
			splitSpansByLine(inss, bLines, bSpans).forEach((tokenSpans, i) =>
				Object.assign(b[inss[i]], { kind: "modify", hunkIndex, tokenSpans }),
			);
			continue;
		}

		const n = dels.length, m = inss.length;
		if (!n || !m) {
			const hunkIndex = n
				? addHunk(hunks, "remove", dels[0], dels.at(-1)! + 1, bi, bi)
				: addHunk(hunks, "add", ai, ai, inss[0], inss.at(-1)! + 1);
			for (const index of dels) Object.assign(a[index], { kind: "remove", hunkIndex });
			for (const index of inss) Object.assign(b[index], { kind: "add", hunkIndex });
			continue;
		}

		const hunkIndex = addHunk(
			hunks, "modify", dels[0], dels.at(-1)! + 1, inss[0], inss.at(-1)! + 1,
		);
		const pairs = n * m > MAX_REFINEMENT_CELLS
			? dels.slice(0, Math.min(n, m)).map((aIndex, index) => [aIndex, inss[index]] as [number, number])
			: matchModifiedPairs(dels, inss, aLines, bLines);
		const matchedA = new Set(pairs.map(([index]) => index));
		const matchedB = new Set(pairs.map(([, index]) => index));
		markModifiedPairs(pairs, a, b, aLines, bLines, hunkIndex);
		for (const index of dels) {
			if (!matchedA.has(index)) Object.assign(a[index], { kind: "remove", hunkIndex });
		}
		for (const index of inss) {
			if (!matchedB.has(index)) Object.assign(b[index], { kind: "add", hunkIndex });
		}
	}

	const added = new Map<string, number[]>();
	b.forEach((line, index) => {
		const key = line.text.trim();
		if (line.kind !== "add" || key.length < MOVE_MIN_LENGTH) return;
		const indices = added.get(key) ?? [];
		indices.push(index);
		added.set(key, indices);
	});

	const moves: MovePair[] = [];
	a.forEach((line, aIndex) => {
		if (line.kind !== "remove") return;
		const key = line.text.trim(), matches = added.get(key);
		if (key.length < MOVE_MIN_LENGTH || !matches?.length) return;

		const bIndex = matches.shift()!, moveIndex = moves.length;
		moves.push({ aIndex, bIndex });
		Object.assign(line, { kind: "move", moveIndex, hunkIndex: undefined });
		Object.assign(b[bIndex], { kind: "move", moveIndex, hunkIndex: undefined });
	});

	const blockedHunks = new Set<number>();
	for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
		const hunk = hunks[hunkIndex];
		const block = blocks.find((candidate) =>
			candidate.kind === "change" &&
			hunk.aStart >= candidate.aStart && hunk.aEnd <= candidate.aEnd &&
			hunk.bStart >= candidate.bStart && hunk.bEnd <= candidate.bEnd,
		);
		if (block && moves.some((move) =>
			(move.aIndex >= block.aStart && move.aIndex < block.aEnd) ||
			(move.bIndex >= block.bStart && move.bIndex < block.bEnd),
		)) blockedHunks.add(hunkIndex);
	}

	const visibleHunks: Hunk[] = [];
	const hunkIndices = new Map<number, number>();
	for (const line of [...a, ...b]) {
		if (line.hunkIndex === undefined) continue;
		if (blockedHunks.has(line.hunkIndex)) {
			line.hunkIndex = undefined;
			continue;
		}
		let visibleIndex = hunkIndices.get(line.hunkIndex);
		if (visibleIndex === undefined) {
			visibleIndex = visibleHunks.length;
			hunkIndices.set(line.hunkIndex, visibleIndex);
			visibleHunks.push(hunks[line.hunkIndex]);
		}
		line.hunkIndex = visibleIndex;
	}

	const stats = {
		added: b.filter((l) => l.kind === "add").length,
		removed: a.filter((l) => l.kind === "remove").length,
		modified: a.filter((l) => l.kind === "modify").length,
		moved: moves.length,
	};
	return { a, b, hunks: visibleHunks, moves, blocks, stats };
}

function matchModifiedPairs(
	dels: number[], inss: number[], aLines: string[], bLines: string[],
): Array<[number, number]> {
	const n = dels.length, m = inss.length;
	const sim = Array.from({ length: n }, (_, i) =>
		Array.from({ length: m }, (_, j) => {
			if (aLines[dels[i]] === bLines[inss[j]]) return 1;
			const total = aLines[dels[i]].length + bLines[inss[j]].length;
			if (!total) return 1;
			return (2 * diffArrays(
				tokenize(aLines[dels[i]]), tokenize(bLines[inss[j]]), undefined, MAX_TOKEN_EDIT_DISTANCE,
			).reduce((count, op) => count + (op.type === "equal" ? op.text.length : 0), 0)) / total;
		})
	);
	const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
	const from = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));

	for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
		let best = dp[i - 1][j], move = 1;
		if (dp[i][j - 1] > best) { best = dp[i][j - 1]; move = 2; }
		const score = sim[i - 1][j - 1];
		const matched = dp[i - 1][j - 1] + score;
		if (score >= MODIFY_THRESHOLD && matched > best) { best = matched; move = 3; }
		dp[i][j] = best;
		from[i][j] = move;
	}

	const pairs: Array<[number, number]> = [];
	for (let i = n, j = m; i && j;) {
		const move = from[i][j];
		if (move === 3) pairs.push([dels[--i], inss[--j]]);
		else if (move === 1) i--;
		else j--;
	}
	return pairs.reverse();
}

export function applyHunk(aText: string, bText: string, hunk: Hunk, direction: Direction): ParsedDiff {
	const a = aText.split("\n"), b = bText.split("\n");
	if (direction === "a-to-b") {
		b.splice(hunk.bStart, hunk.bEnd - hunk.bStart, ...a.slice(hunk.aStart, hunk.aEnd));
		return { aText, bText: b.join("\n") };
	}
	a.splice(hunk.aStart, hunk.aEnd - hunk.aStart, ...b.slice(hunk.bStart, hunk.bEnd));
	return { aText: a.join("\n"), bText };
}

function equalIndices(lines: LineInfo[]): number[] {
	return lines.flatMap((line, index) => line.kind === "equal" ? [index] : []);
}

function anchoredIndex(sourceIndex: number, source: number[], target: number[], targetLength: number): number {
	const anchorCount = source.findIndex((index) => index >= sourceIndex);
	const count = anchorCount < 0 ? source.length : anchorCount;
	return target[count] ?? targetLength;
}

function moveLine(lines: string[], from: number, before: number): string[] {
	const copy = [...lines], [line] = copy.splice(from, 1);
	copy.splice(from < before ? before - 1 : before, 0, line);
	return copy;
}

export function applyMove(
	aText: string, bText: string, move: MovePair, diff: DiffResult, direction: Direction,
): ParsedDiff {
	const a = aText.split("\n"), b = bText.split("\n");
	const equalA = equalIndices(diff.a), equalB = equalIndices(diff.b);
	if (direction === "a-to-b") {
		const before = anchoredIndex(move.aIndex, equalA, equalB, diff.b.length);
		return { aText, bText: moveLine(b, move.bIndex, before).join("\n") };
	}
	const before = anchoredIndex(move.bIndex, equalB, equalA, diff.a.length);
	return { aText: moveLine(a, move.aIndex, before).join("\n"), bText };
}
