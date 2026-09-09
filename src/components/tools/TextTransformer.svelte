<script lang="ts">
  import { transform } from "../../lib/textTransformer";

  let input = $state("The quick brown fox jumps over the lazy dog");
  let zalgoIntensity = $state(30);
  let zalgoUp = $state(true);
  let zalgoMid = $state(true);
  let zalgoDown = $state(true);
  let copied = $state("");

  async function copy(text: string, name: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied = name;
    setTimeout(() => {
      if (copied === name) copied = "";
    }, 1200);
  }
</script>

<div class="field">
  <textarea
    bind:value={input}
    rows="3"
    spellcheck="false"
  ></textarea>
</div>

{#each Object.entries({"Fonts": ["Bold", "Italic", "Bold Italic", "Cursive", "Bold Cursive", "Gothic", "Bold Gothic", "Double Struck", "Monospace", "Sans-Serif", "Bold Sans-Serif", "Italic Sans-Serif", "Bold Italic Sans-Serif", "Small Caps", "Superscript", "Fullwidth"],
"Enclosed": ["Circled", "Negative Circled", "Squared", "Negative Squared", "Parenthesized", "Regional Indicators"],
"Effects": ["Upside Down", "Mocking", "Leetspeak", "Reverse", "Spaced Out", "Clapback"],
"Encoding": ["Morse", "Binary", "Hex"], "Corrupted": ["Zalgo"],
"Decorations": ["Strikethrough", "Slashed", "Underline", "Double Underline", "Wavy", "Dotted"],
"Enclosing": ["Circle", "Square", "Diamond", "Keycap", "Screen", "Triangle"]}) as [group, items] (group)}
  <section class="group">
    <div class="group-head">
      <h2>{group}</h2>
      {#if group === "Corrupted"}
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
              <input type="range" min="1" max="100" bind:value={zalgoIntensity} />
              <span class="muted">Intensity</span>
            </label>
          </div>
      {/if}
    </div>

    <ul class="results">
      {#each items as name (name)}
      {@const output = transform(name, input, { up: zalgoUp, mid: zalgoMid, down: zalgoDown, intensity: zalgoIntensity })}  
        <li>
          <button
            type="button"
            class="result"
            class:copied={copied === name}
            onclick={() => copy(output, name)}
          >
            <span class="result-name">{name}</span>
            <span class="result-value">{output || " "}</span>
            <span class="result-hint"
              >{copied === name ? "Copied" : "Copy"}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
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
    font-family: revert;
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
