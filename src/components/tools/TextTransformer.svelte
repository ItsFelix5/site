<script lang="ts">
  import {
    decorate,
    decorations,
    enclosingMarks,
    styles,
    transform,
    type DecorationId,
    type DecorationStyle,
    type StyleGroup,
  } from "../../lib/textTransformer";

  const allDecorations = [...decorations, ...enclosingMarks];
  const groups = [...new Set(styles.map((s) => s.group))] as StyleGroup[];

  let input = $state(
    "The quick brown fox jumps over the lazy dog. h̸̢̛̯́̕o̴̠͐w̷̱̌ ̶͙̌d̵͉̈i̶̜̽d̸͇̈ ̴͖̀ẃ̷͙e̶̮͐ ̸̗̒g̶͖̈é̶͓t̸̬̀ ̶͈̏h̸͙̒e̷̥̒r̵͔̈é̴̜",
  );
  let zalgoIntensity = $state(30);
  let zalgoUp = $state(true);
  let zalgoMid = $state(true);
  let zalgoDown = $state(true);
  let activeDecorations = $state<Record<DecorationId, boolean>>(
    Object.fromEntries(allDecorations.map((d) => [d.id, false])) as Record<
      DecorationId,
      boolean
    >,
  );
  let copied = $state("");

  const activeDecorationIds = $derived(
    allDecorations.map((d) => d.id).filter((id) => activeDecorations[id]),
  );

  // Zalgo's marks are randomised on every call, so it gets its own derived
  // value keyed only on the input it actually depends on. That way toggling
  // a decoration (which only re-runs the cheap `decorate` pass below) can't
  // reroll the corruption on every other row along with it.
  const rawOutputs = $derived(
    styles.map((style) => ({
      ...style,
      raw: transform(style.id, input, {
        intensity: zalgoIntensity,
        up: zalgoUp,
        mid: zalgoMid,
        down: zalgoDown,
      }),
    })),
  );

  const results = $derived(
    rawOutputs.map((r) => ({
      ...r,
      output: decorate(r.raw, activeDecorationIds),
    })),
  );

  async function copy(text: string, id: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied = id;
    setTimeout(() => {
      if (copied === id) copied = "";
    }, 1200);
  }
</script>

{#snippet checkboxGroup(items: DecorationStyle[])}
  {#each items as item (item.id)}
    <label class="max-field">
      <input type="checkbox" bind:checked={activeDecorations[item.id]} />
      <span class="muted">{item.name}</span>
    </label>
  {/each}
{/snippet}

<div class="field">
  <textarea
    bind:value={input}
    rows="3"
    spellcheck="false"
    placeholder="Type or paste text…"
  ></textarea>
</div>

<details class="options">
  <summary>Decorations &amp; enclosing marks</summary>
  <div class="options-body">
    <div class="row option-row">
      {@render checkboxGroup(decorations)}
    </div>
    <div class="row option-row">
      {@render checkboxGroup(enclosingMarks)}
    </div>
  </div>
</details>

{#each groups as group (group)}
  <section class="group">
    <div class="group-head">
      <h2>{group}</h2>
      {#if group === "Corrupted"}
        <details class="zalgo-options">
          <summary>Settings</summary>
          <div class="row zalgo-controls">
            <label class="max-field">
              <input type="checkbox" bind:checked={zalgoUp} />
              <span class="muted">Up</span>
            </label>
            <label class="max-field">
              <input type="checkbox" bind:checked={zalgoMid} />
              <span class="muted">Mid</span>
            </label>
            <label class="max-field">
              <input type="checkbox" bind:checked={zalgoDown} />
              <span class="muted">Down</span>
            </label>
            <label class="max-field intensity">
              <input type="range" min="0" max="100" bind:value={zalgoIntensity} />
              <span class="muted">Intensity</span>
            </label>
          </div>
        </details>
      {/if}
    </div>

    <ul class="results">
      {#each results.filter((r) => r.group === group) as result (result.id)}
        <li>
          <button
            type="button"
            class="result"
            class:copied={copied === result.id}
            onclick={() => copy(result.output, result.id)}
          >
            <span class="result-name">{result.name}</span>
            <span class="result-value">{result.output || " "}</span>
            <span class="result-hint"
              >{copied === result.id ? "✓ Copied" : "Copy"}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .options {
    margin-bottom: 1.25rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }

  .options summary {
    cursor: pointer;
    padding: 0.6rem 0.8rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .options summary:hover {
    color: var(--text);
  }

  .options-body {
    padding: 0 0.8rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .option-row {
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .max-field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }

  .intensity {
    flex: 1;
    min-width: 10rem;
  }

  .intensity input[type="range"] {
    flex: 1;
  }

  .group {
    margin-bottom: 1.75rem;
  }

  .group-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .group-head h2 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .zalgo-options {
    font-size: 0.75rem;
  }

  .zalgo-options summary {
    cursor: pointer;
    color: var(--muted);
  }

  .zalgo-options summary:hover {
    color: var(--text);
  }

  .zalgo-controls {
    margin-top: 0.5rem;
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .results li + li {
    border-top: 1px solid var(--border);
  }

  .result {
    display: grid;
    grid-template-columns: 9rem 1fr auto;
    align-items: start;
    gap: 0.75rem;
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0.55rem 0.8rem;
    text-align: left;
    font-size: 0.88rem;
  }

  .result:hover {
    background: var(--surface);
  }

  .result-name {
    color: var(--muted);
    font-size: 0.78rem;
    padding-top: 0.15rem;
  }

  .result-value {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .result-hint {
    color: var(--muted);
    font-size: 0.72rem;
    white-space: nowrap;
    padding-top: 0.2rem;
    opacity: 0;
  }

  .result:hover .result-hint,
  .result:focus-visible .result-hint {
    opacity: 1;
  }

  .result.copied .result-hint {
    opacity: 1;
    color: var(--accent);
  }

  @media (max-width: 640px) {
    .result {
      grid-template-columns: 1fr;
      gap: 0.15rem;
    }

    .result-hint {
      opacity: 1;
    }
  }
</style>
