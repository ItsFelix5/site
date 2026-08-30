<script lang="ts">
  import {
    decorate,
    decorations,
    enclosingMarks,
    styles,
    transform,
    type DecorationId,
  } from "../../lib/textTransformer";

  const allDecorations = [...decorations, ...enclosingMarks];

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

  const results = $derived(
    styles.map((style) => ({
      ...style,
      output: decorate(
        transform(style.id, input, {
          intensity: zalgoIntensity,
          up: zalgoUp,
          mid: zalgoMid,
          down: zalgoDown,
        }),
        activeDecorationIds,
      ),
    })),
  );

  async function copy(text: string, id: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied = id;
    setTimeout(() => {
      if (copied === id) copied = "";
    }, 900);
  }
</script>

<div class="field">
  <textarea
    bind:value={input}
    rows="4"
    spellcheck="false"
    placeholder="Type or paste text…"
  ></textarea>
</div>

<div class="row zalgo-controls">
  <span class="field-label">Zalgo</span>
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

<div class="field">
  <span class="field-label">Decorations</span>
  <div class="row decoration-controls">
    {#each decorations as decoration (decoration.id)}
      <label class="max-field">
        <input type="checkbox" bind:checked={activeDecorations[decoration.id]} />
        <span class="muted">{decoration.name}</span>
      </label>
    {/each}
  </div>
</div>

<div class="field">
  <span class="field-label">Enclosing marks</span>
  <div class="row decoration-controls">
    {#each enclosingMarks as mark (mark.id)}
      <label class="max-field">
        <input type="checkbox" bind:checked={activeDecorations[mark.id]} />
        <span class="muted">{mark.name}</span>
      </label>
    {/each}
  </div>
</div>

<div class="table-wrap">
  <table>
    <tbody>
      {#each results as result (result.id)}
        <tr>
          <td class="name">{result.name}</td>
          <td>
            <button
              type="button"
              class="value"
              onclick={() => copy(result.output, result.id)}
            >
              {copied === result.id ? "Copied" : result.output || " "}
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .zalgo-controls {
    margin: 0 0 1rem;
  }

  .decoration-controls {
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .max-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .intensity {
    flex: 1;
    min-width: 10rem;
  }

  .intensity input[type="range"] {
    flex: 1;
  }

  .table-wrap {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  td {
    padding: 0;
    border-bottom: 1px solid var(--border);
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  td.name {
    padding: 0 0 0 0.7rem;
    width: 11rem;
    min-width: 11rem;
    color: var(--muted);
    white-space: nowrap;
  }

  button.value {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    text-align: left;
    padding: 0.5rem 0.7rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  button.value:hover {
    background: var(--surface);
  }
</style>
