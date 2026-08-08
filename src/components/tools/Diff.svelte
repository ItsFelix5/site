<script lang="ts">
import {
  defaultKeymap,
  history,
  historyKeymap,
  isolateHistory,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from "@codemirror/commands";
import {
  HighlightStyle,
  LanguageDescription,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Range,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  gutter,
  GutterMarker,
  keymap,
  lineNumbers,
  WidgetType,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { applyHunk, applyMove, computeDiff } from "../../lib/diff";

const LANGUAGES: { name: string; test: (sample: string) => boolean }[] = [
	{
		name: "JSON",
		test: (s: string): boolean => {
			if (!/^[[{][\s\S]*[\]}]$/.test(s)) return false;
			try {
				JSON.parse(s);
				return true;
			} catch {
				return false;
			}
		},
	},
	{
		name: "HTML",
		test: (s) => /^\s*<!doctype html/i.test(s) || /^\s*<html[\s>]/i.test(s),
	},
	{ name: "XML", test: (s) => /^\s*<\?xml[\s>]/.test(s) },
	{ name: "PHP", test: (s) => /^\s*<\?php/.test(s) },
	{ name: "Shell", test: (s) => /^\s*#!.*\b(ba|z)?sh\b/.test(s) },
	{
		name: "YAML",
		test: (s) =>
			/^---\s*\n/.test(s) || /^[\w.-]+:\s.*\n(?:[\w.-]+:|\s*-\s)/.test(s),
	},
	{
		name: "Go",
		test: (s) => /^\s*package\s+\w+\s*$/m.test(s) || /:=\s/.test(s),
	},
	{
		name: "Rust",
		test: (s) => /^\s*(fn\s+\w+\(|let mut |impl\s+\w+|use\s+std::)/m.test(s),
	},
	{
		name: "Python",
		test: (s) =>
			/^\s*(def\s+\w+\(.*\):|elif\s|from\s+\w+\s+import\s)/m.test(s) &&
			!/[;{}]/.test(s),
	},
	{
		name: "SQL",
		test: (s) =>
			/\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE)\b/i.test(
				s,
			),
	},
	{
		name: "C++",
		test: (s) => /^\s*(#include\s*<|std::|int main\s*\()/m.test(s),
	},
	{
		name: "Java",
		test: (s) =>
			/^\s*(public\s+(final\s+)?class\s|System\.out\.println)/m.test(s),
	},
	{
		name: "Markdown",
		test: (s) =>
			/^#{1,6}\s|^\s*[-*]\s.+\n\s*[-*]\s|\[[^\]]+\]\([^)]+\)/m.test(s) &&
			!/[;{}=]/.test(s),
	},
	{
		name: "CSS",
		test: (s) => /[.#]?[\w-]+\s*\{[^}]*[\w-]+\s*:\s*[^;]+;/.test(s),
	},
	{
		name: "TypeScript",
		test: (s) =>
			/\b(interface\s+\w+|:\s*(string|number|boolean)\b)/.test(s) &&
			/\b(function|const|let|=>)\b/.test(s),
	},
	{
		name: "JSX",
		test: (s) =>
			/<[A-Za-z][\w.]*[\s>][\s\S]*<\/[A-Za-z]/.test(s) &&
			/\b(function|const|let|=>|import)\b/.test(s),
	},
	{
		name: "JavaScript",
		test: (s) => /\b(function|const|let|var|=>|console\.)\b/.test(s),
	},
];

type Side = "a" | "b";

const refreshDiff = StateEffect.define<null>();

let aView: EditorView | undefined;
let bView: EditorView | undefined;

let aText = $state("");
let bText = $state("");
const diff = $derived(computeDiff(aText, bText));

const undoDepthSeen: Record<Side, number> = { a: 0, b: 0 };
const redoDepthSeen: Record<Side, number> = { a: 0, b: 0 };
const undoOrder: Side[] = [];
const redoOrder: Side[] = [];

function syncHistory(side: Side, state: EditorState) {
	const done = undoDepth(state);
	const undone = redoDepth(state);

	if (done > undoDepthSeen[side]) {
		undoOrder.push(side);
	} else if (done < undoDepthSeen[side]) {
		const index = undoOrder.lastIndexOf(side);
		if (index !== -1) undoOrder.splice(index, 1);
	}
	undoDepthSeen[side] = done;

	if (undone === 0 && redoDepthSeen[side] > 0) {
		for (let index = redoOrder.length - 1; index >= 0; index--) {
			if (redoOrder[index] === side) redoOrder.splice(index, 1);
		}
	} else if (undone > redoDepthSeen[side]) {
		redoOrder.push(side);
	} else if (undone < redoDepthSeen[side]) {
		const index = redoOrder.lastIndexOf(side);
		if (index !== -1) redoOrder.splice(index, 1);
	}
	redoDepthSeen[side] = undone;
}

function combinedUndo(): boolean {
	const side = undoOrder.at(-1);
	const view = side === "a" ? aView : side === "b" ? bView : undefined;
	return view ? undo(view) : false;
}

function combinedRedo(): boolean {
	const side = redoOrder.at(-1);
	const view = side === "a" ? aView : side === "b" ? bView : undefined;
	return view ? redo(view) : false;
}

class SpacerWidget extends WidgetType {
	lines = 0;

	eq(other: SpacerWidget) {
		return other.lines === this.lines;
	}

	toDOM(view: EditorView) {
		const element = document.createElement("div");
		element.className = "diff-spacer";
		element.style.height = `${this.lines * view.defaultLineHeight}px`;
		element.onmousedown = (event) => {
			event.preventDefault();
			const pos = view.posAtDOM(element);
			view.dispatch({ selection: EditorSelection.cursor(pos) });
			view.focus();
		};
		return element;
	}

	ignoreEvent() {
		return true;
	}
}

class ActionMarker extends GutterMarker {
	key = "";
	text = "";
	title = "";
	action = () => {};

	eq(other: ActionMarker) {
		return other.key === this.key;
	}

	toDOM() {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "diff-action";
		button.textContent = this.text;
		button.title = this.title;
		button.onclick = (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.action();
		};
		return button;
	}
}

function buildDecorations(state: EditorState, side: Side): DecorationSet {
	const ranges: Range<Decoration>[] = [];
	const lines = side === "a" ? diff.a : diff.b;
	const lineCount = Math.min(lines.length, state.doc.lines);

	for (let index = 0; index < lineCount; index++) {
		const info = lines[index];
		if (info.kind === "equal") continue;

		const line = state.doc.line(index + 1);
		ranges.push(
			Decoration.line({ class: `cm-line-${info.kind}` }).range(line.from),
		);

		for (const span of info.tokenSpans ?? []) {
			const from = line.from + span.from;
			const to = line.from + span.to;

			if (to > from && to <= line.to) {
				ranges.push(
					Decoration.mark({ class: "cm-token-changed" }).range(from, to),
				);
			}
		}
	}

	for (const block of diff.blocks) {
		if (block.kind !== "change") continue;

		const aCount = block.aEnd - block.aStart;
		const bCount = block.bEnd - block.bStart;
		const missing = side === "a" ? bCount - aCount : aCount - bCount;

		if (missing <= 0) continue;

		const end = side === "a" ? block.aEnd : block.bEnd;
		const widget = new SpacerWidget();
		widget.lines = missing;
		ranges.push(
			Decoration.widget({
				block: true,
				side: -1,
				widget,
			}).range(
				end <= 0
					? 0
					: end >= state.doc.lines
						? state.doc.length
						: state.doc.line(end + 1).from,
			),
		);
	}

	return Decoration.set(ranges, true);
}

function replaceText(view: EditorView, text: string) {
	const current = view.state.doc.toString();
	if (current === text) return;

	let start = 0;
	let oldEnd = current.length;
	let newEnd = text.length;

	while (start < oldEnd && start < newEnd && current[start] === text[start]) {
		start++;
	}

	while (
		oldEnd > start &&
		newEnd > start &&
		current[oldEnd - 1] === text[newEnd - 1]
	) {
		oldEnd--;
		newEnd--;
	}

	view.dispatch({
		changes: {
			from: start,
			to: oldEnd,
			insert: text.slice(start, newEnd),
		},
		annotations: isolateHistory.of("full"),
	});
}

const ignoreScroll: Record<Side, boolean> = { a: false, b: false };

let viewport = $state({ top: 0, height: 1 });

function updateViewport(view: EditorView) {
	const dom = view.scrollDOM;
	const max = dom.scrollHeight - dom.clientHeight;

	viewport = {
		top: max > 0 ? Math.min(1, Math.max(0, dom.scrollTop / max)) : 0,
		height:
			dom.scrollHeight > 0
				? Math.min(1, dom.clientHeight / dom.scrollHeight)
				: 1,
	};
}

function scrollToRatio(ratio: number) {
	if (!aView) return;

	const dom = aView.scrollDOM;
	const max = dom.scrollHeight - dom.clientHeight;
	dom.scrollTop = Math.max(0, Math.min(max, ratio * max));
}

type OverviewKind = "add" | "remove" | "modify";
interface OverviewMark {
	top: number;
	height: number;
	kind: OverviewKind;
}

const overview = $derived.by((): OverviewMark[] => {
	let total = 0;
	for (const block of diff.blocks) {
		const aCount = block.aEnd - block.aStart;
		const bCount = block.bEnd - block.bStart;
		total += block.kind === "equal" ? aCount : Math.max(aCount, bCount);
	}
	if (total <= 0) return [];

	const marks: OverviewMark[] = [];
	let offset = 0;

	for (const block of diff.blocks) {
		const aCount = block.aEnd - block.aStart;
		const bCount = block.bEnd - block.bStart;
		const length = block.kind === "equal" ? aCount : Math.max(aCount, bCount);

		if (block.kind === "change") {
			const kind: OverviewKind =
				aCount === 0 ? "add" : bCount === 0 ? "remove" : "modify";
			marks.push({
				top: offset / total,
				height: Math.max(length / total, 0.003),
				kind,
			});
		}

		offset += length;
	}

	return marks;
});

const languageCompartment = new Compartment();
let languageChoice = $state("auto");
let loadedLanguageName: string | null = null;

const detectedLanguage = $derived.by(() => {
	const sample = aText.slice(0, 4000).trim() || bText.slice(0, 4000).trim();
	if (!sample) return null;

	for (const rule of LANGUAGES) if (rule.test(sample)) return rule.name;
	return null;
});

$effect(() => {
	const name =
		languageChoice === "auto"
			? detectedLanguage
			: languageChoice === "plain"
				? null
				: languageChoice;
	if (name === loadedLanguageName) return;
	loadedLanguageName = name;

	if (!name) {
		aView?.dispatch({ effects: languageCompartment.reconfigure([]) });
		bView?.dispatch({ effects: languageCompartment.reconfigure([]) });
		return;
	}

	LanguageDescription.matchLanguageName(languages, name)
		?.load()
		.then((support) => {
			if (loadedLanguageName !== name) return;
			aView?.dispatch({ effects: languageCompartment.reconfigure(support) });
			bView?.dispatch({ effects: languageCompartment.reconfigure(support) });
		});
});

function editor(node: HTMLDivElement, side: Side) {
	const view = new EditorView({
		parent: node,
		state: EditorState.create({
			doc: side === "a" ? aText : bText,
			extensions: [
				history(),
				keymap.of([
					{ key: "Mod-z", run: combinedUndo, preventDefault: true },
					{
						key: "Mod-y",
						mac: "Mod-Shift-z",
						run: combinedRedo,
						preventDefault: true,
					},
					{ linux: "Ctrl-Shift-z", run: combinedRedo, preventDefault: true },
					...defaultKeymap,
					...historyKeymap,
				]),
				lineNumbers(),
				languageCompartment.of([]),
				syntaxHighlighting(
					HighlightStyle.define([
						{
							tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
							color: "var(--syntax-comment)",
							fontStyle: "italic",
						},
						{
							tag: [
								t.keyword,
								t.controlKeyword,
								t.definitionKeyword,
								t.moduleKeyword,
								t.operatorKeyword,
								t.self,
							],
							color: "var(--syntax-keyword)",
						},
						{
							tag: [t.string, t.docString, t.character, t.attributeValue],
							color: "var(--syntax-string)",
						},
						{
							tag: [t.special(t.string), t.regexp, t.escape],
							color: "var(--syntax-string-special)",
						},
						{
							tag: [t.number, t.integer, t.float, t.unit],
							color: "var(--syntax-number)",
						},
						{
							tag: [t.bool, t.null, t.atom, t.constant(t.variableName)],
							color: "var(--syntax-constant)",
						},
						{
							tag: [
								t.definition(t.variableName),
								t.function(t.variableName),
								t.macroName,
							],
							color: "var(--syntax-function)",
						},
						{
							tag: [t.propertyName, t.attributeName, t.labelName],
							color: "var(--syntax-property)",
						},
						{
							tag: [t.typeName, t.className, t.namespace, t.tagName],
							color: "var(--syntax-type)",
						},
						{
							tag: [t.meta, t.annotation, t.processingInstruction],
							color: "var(--syntax-meta)",
						},
						{
							tag: [t.operator, t.punctuation, t.bracket, t.separator],
							color: "var(--syntax-punctuation)",
						},
						{ tag: t.invalid, color: "var(--danger)" },
						{
							tag: t.link,
							color: "var(--syntax-link)",
							textDecoration: "underline",
						},
						{
							tag: t.heading,
							fontWeight: "600",
							color: "var(--syntax-keyword)",
						},
						{ tag: t.strong, fontWeight: "600" },
						{ tag: t.emphasis, fontStyle: "italic" },
					]),
				),
				StateField.define<DecorationSet>({
					create: (state) => buildDecorations(state, side),
					update(value, transaction) {
						const refresh = transaction.effects.some((effect) =>
							effect.is(refreshDiff),
						);

						if (refresh) return buildDecorations(transaction.state, side);
						if (transaction.docChanged) return value.map(transaction.changes);
						return value;
					},
					provide: (field) => EditorView.decorations.from(field),
				}),
				gutter({
					class: "diff-gutter",
					lineMarkerChange(update) {
						return update.transactions.some((transaction) =>
							transaction.effects.some((effect) => effect.is(refreshDiff)),
						);
					},
					lineMarker(view, block) {
						const lineIndex = view.state.doc.lineAt(block.from).number - 1;
						const info = (side === "a" ? diff.a : diff.b)[lineIndex];
						if (
							!info ||
							(info.kind !== "move" && info.hunkIndex === undefined) ||
							!(side === "a"
								? info.kind === "remove" ||
									info.kind === "modify" ||
									info.kind === "move"
								: info.kind === "add" ||
									info.kind === "modify" ||
									info.kind === "move")
						)
							return null;

						const marker = new ActionMarker();
						marker.key = `${side}-${info.kind === "move" ? `move-${info.moveIndex}` : info.hunkIndex}`;
						marker.text = info.kind === "move" ? "↕" : side === "a" ? "›" : "‹";
						marker.title =
							info.kind === "move"
								? side === "a"
									? "Move this line in B to match A"
									: "Move this line in A to match B"
								: side === "a"
									? "Copy this change into B"
									: "Copy this change into A";
						marker.action = () => {
							if (!aView || !bView) return;

							const a = aView.state.doc.toString();
							const b = bView.state.doc.toString();
							const next =
								info.kind === "move"
									? (() => {
											const move = diff.moves[info.moveIndex!];
											return move
												? applyMove(
														a,
														b,
														move,
														diff,
														side === "a" ? "a-to-b" : "b-to-a",
													)
												: null;
										})()
									: (() => {
											const hunk = diff.hunks[info.hunkIndex!];
											return hunk
												? applyHunk(
														a,
														b,
														hunk,
														side === "a" ? "a-to-b" : "b-to-a",
													)
												: null;
										})();
							if (!next) return;

							replaceText(aView, next.aText);
							replaceText(bView, next.bText);

							const target = side === "a" ? bView : aView;
							target.focus();
						};
						return marker;
					},
				}),
				EditorView.contentAttributes.of({
					spellcheck: "false",
					autocapitalize: "off",
					autocorrect: "off",
				}),
				EditorView.updateListener.of((update) => {
					syncHistory(side, update.state);

					if (!update.docChanged) return;

					const text = update.state.doc.toString();
					if (side === "a") aText = text;
					else bText = text;
				}),
				EditorView.theme(
					{
						"&": {
							height: "100%",
							fontSize: "0.85rem",
							color: "var(--text)",
							backgroundColor: "transparent",
						},
						".cm-content": {
							padding: "0.5rem 0",
						},
						".cm-gutters": {
							color: "var(--muted)",
							backgroundColor: "var(--bg)",
							border: "none",
						},
						".cm-activeLine, .cm-activeLineGutter": {
							backgroundColor:
								"color-mix(in srgb, var(--text) 3%, transparent)",
						},
						"&.cm-focused": {
							outline: "none",
						},
					},
					{ dark: true },
				),
			],
		}),
	});

	if (side === "a") aView = view;
	else bView = view;

	const onScroll = () => {
		if (!view) return;

		if (ignoreScroll[side]) {
			ignoreScroll[side] = false;
			return;
		}

		ignoreScroll[side === "a" ? "b" : "a"] = true;
		(side === "a" ? bView : aView)!.scrollDOM.scrollLeft =
			view.scrollDOM.scrollLeft;
		(side === "a" ? bView : aView)!.scrollDOM.scrollTop =
			view.scrollDOM.scrollTop;
		updateViewport(view);
	};

	view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

	const resizeObserver = new ResizeObserver(() => updateViewport(view));
	resizeObserver.observe(view.scrollDOM);

	return {
		destroy() {
			view.scrollDOM.removeEventListener("scroll", onScroll);
			resizeObserver.disconnect();
			view.destroy();

			if (aView === view) aView = undefined;
			if (bView === view) bView = undefined;
		},
	};
}

$effect(() => {
	diff;
	aView?.dispatch({ effects: refreshDiff.of(null) });
	bView?.dispatch({ effects: refreshDiff.of(null) });

	requestAnimationFrame(() => {
		if (aView) updateViewport(aView);
	});
});
</script>

<div class="stats">
	  <span class="stat-modify">{diff.stats.modified} changed</span>
	  <span class="stat-unique">{diff.stats.removed} only in A</span>
	  <span class="stat-unique">{diff.stats.added} only in B</span>
	  <span class="stat-move">{diff.stats.moved} moved</span>
  <select class="lang-select" bind:value={languageChoice} aria-label="Syntax highlighting language">
    <option value="auto">Auto highlight{detectedLanguage ? ` (${detectedLanguage})` : ""}</option>
    <option value="plain">Plain text</option>
    {#each LANGUAGES as {name} (name)}
      <option value={name}>{name}</option>
    {/each}
  </select>
</div>

<div class="diff-grid">
  <div class="pane" id="diff-pane-a" use:editor={"a"}></div>
  <div class="pane" id="diff-pane-b" use:editor={"b"}></div>
  <div
    class="diff-overview"
    onpointerdown={(event) => {
	event.preventDefault();

	const track = event.currentTarget as HTMLElement;
	const rect = track.getBoundingClientRect();
	const ratioAt = (clientY: number) => (clientY - rect.top) / rect.height;

	scrollToRatio(ratioAt(event.clientY));
	track.setPointerCapture(event.pointerId);

	const onMove = (moveEvent: PointerEvent) =>
		scrollToRatio(ratioAt(moveEvent.clientY));
	const onUp = () => track.removeEventListener("pointermove", onMove);

	track.addEventListener("pointermove", onMove);
	track.addEventListener("pointerup", onUp, { once: true });
}}
    role="scrollbar"
    aria-orientation="vertical"
    aria-controls="diff-pane-a diff-pane-b"
    aria-valuenow={Math.round(viewport.top * 100)}
    tabindex="0"
  >
    {#each overview as mark, index (index)}
      <div
        class="diff-overview-mark diff-overview-{mark.kind}"
        style={`top:${mark.top * 100}%; height:${mark.height * 100}%`}
      ></div>
    {/each}
    <div
      class="diff-overview-thumb"
      style={`top:${viewport.top * (1 - viewport.height) * 100}%; height:${viewport.height * 100}%`}
    ></div>
  </div>
</div>

<style>
  .stats {
    --diff-add: oklch(78% 0.15 145);
    --diff-remove: oklch(72% 0.18 25);
    --diff-modify: oklch(79% 0.15 75);
	--diff-move: oklch(78% 0.14 240);
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

	  .stat-modify {
	    color: var(--diff-modify);
	  }

	  .stat-move {
	    color: var(--diff-move);
	  }

  .stats .stat-unique:nth-child(2) {
    color: var(--diff-remove);
  }

  .stats .stat-unique:nth-child(3) {
    color: var(--diff-add);
  }

  .lang-select {
    margin-left: auto;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .lang-select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .diff-grid {
    --diff-add: oklch(78% 0.15 145);
    --diff-remove: oklch(72% 0.18 25);
	    --diff-modify: oklch(79% 0.15 75);
	    --diff-move: oklch(78% 0.14 240);
    --syntax-comment: oklch(66% 0.035 270);
    --syntax-keyword: oklch(78% 0.15 342);
    --syntax-string: oklch(80% 0.14 145);
    --syntax-string-special: oklch(82% 0.14 195);
    --syntax-number: oklch(80% 0.15 75);
    --syntax-constant: oklch(79% 0.14 305);
    --syntax-function: oklch(79% 0.13 235);
    --syntax-property: oklch(80% 0.12 200);
    --syntax-type: oklch(79% 0.14 285);
    --syntax-meta: oklch(76% 0.11 35);
    --syntax-punctuation: oklch(72% 0.035 270);
    --syntax-link: oklch(81% 0.13 215);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 14px;
    gap: 1px;
    height: calc(100vh - 13rem);
    min-height: 420px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--border);
  }

  .pane {
    min-width: 0;
    min-height: 0;
    background: var(--bg);
  }

  :global(.pane .cm-editor) {
    height: 100%;
  }

  :global(.pane .cm-scroller) {
    scrollbar-width: none;
  }

  :global(.pane .cm-scroller::-webkit-scrollbar) {
    width: 0;
    height: 10px;
  }

  :global(.pane .cm-scroller::-webkit-scrollbar-thumb) {
    background: var(--border);
    border-radius: 4px;
  }

  .diff-overview {
    position: relative;
    background: var(--bg);
    cursor: pointer;
    touch-action: none;
  }

  .diff-overview-mark {
    position: absolute;
    left: 3px;
    right: 3px;
    border-radius: 1px;
  }

  .diff-overview-modify {
    background: var(--diff-modify);
  }

  .diff-overview-add {
    background: var(--diff-add);
  }

  .diff-overview-remove {
    background: var(--diff-remove);
  }

  .diff-overview-thumb {
    position: absolute;
    left: 1px;
    right: 1px;
    background: color-mix(in srgb, var(--text) 12%, transparent);
    border-radius: 3px;
    pointer-events: none;
  }

  .diff-overview:hover .diff-overview-thumb {
    background: color-mix(in srgb, var(--text) 18%, transparent);
  }

  :global(.cm-line-modify) {
    background: color-mix(in srgb, var(--diff-modify) 12%, transparent);
    box-shadow: inset 3px 0 var(--diff-modify);
  }

  :global(.cm-line-add) {
    background: color-mix(in srgb, var(--diff-add) 12%, transparent);
    box-shadow: inset 3px 0 var(--diff-add);
  }

	  :global(.cm-line-remove) {
    background: color-mix(in srgb, var(--diff-remove) 12%, transparent);
    box-shadow: inset 3px 0 var(--diff-remove);
	  }

	  :global(.cm-line-move) {
	    background: color-mix(in srgb, var(--diff-move) 12%, transparent);
	    box-shadow: inset 3px 0 var(--diff-move);
	  }

  :global(.cm-token-changed) {
    background: color-mix(in srgb, var(--diff-modify) 40%, transparent);
    border-radius: 2px;
  }

  :global(.diff-gutter) {
    min-width: 1.4rem;
  }

  :global(.diff-gutter .diff-action) {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 4px;
    color: var(--muted);
    background: transparent;
    font: inherit;
    font-size: 0.8rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    outline: none;
    transition: opacity 0.15s, background-color 0.15s, color 0.15s;
  }

  :global(.diff-gutter .diff-action:hover) {
    color: var(--bg);
    background: var(--accent);
    opacity: 1;
  }

  :global(.diff-spacer) {
    background: color-mix(in srgb, var(--text) 1.5%, transparent);
  }

  @media (max-width: 640px) {
    .diff-grid {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
      height: calc(100vh - 16rem);
    }

    .diff-overview {
      display: none;
    }
  }
</style>
