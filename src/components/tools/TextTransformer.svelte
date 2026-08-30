<script lang="ts">
  import {
    decorate,
    decorations,
    styles,
    transform,
    type DecorationId,
    type StyleId,
  } from "../../lib/textTransformer";

  let input = $state(
    "The quick brown fox jumps over the lazy dog. h̸̢̛̯́̕o̴̠͐w̷̱̌ ̶͙̌d̵͉̈i̶̜̽d̸͇̈ ̴͖̀ẃ̷͙e̶̮͐ ̸̗̒g̶͖̈é̶͓t̸̬̀ ̶͈̏h̸͙̒e̷̥̒r̵͔̈é̴̜",
  );
  let styleId = $state<StyleId>("zalgo");
  let zalgoIntensity = $state(30);
  let zalgoUp = $state(true);
  let zalgoMid = $state(true);
  let zalgoDown = $state(true);
  let activeDecorations = $state<Record<DecorationId, boolean>>(
    Object.fromEntries(decorations.map((d) => [d.id, false])) as Record<
      DecorationId,
      boolean
    >,
  );
  let copyLabel = $state("Copy");

  const styled = $derived(
    transform(styleId, input, {
      intensity: zalgoIntensity,
      up: zalgoUp,
      mid: zalgoMid,
      down: zalgoDown,
    }),
  );

  const output = $derived(
    decorate(
      styled,
      decorations.map((d) => d.id).filter((id) => activeDecorations[id]),
    ),
  );
</script>

<div class="field">
  <textarea
    bind:value={input}
    rows="4"
    spellcheck="false"
    placeholder="Type or paste text…"
  ></textarea>
</div>

<div class="field">
  <span class="field-label">Style</span>
  <div class="style-grid" role="group" aria-label="Text style">
    {#each styles as style (style.id)}
      <button
        type="button"
        class="style-btn"
        class:active={styleId === style.id}
        onclick={() => (styleId = style.id)}>{style.name}</button
      >
    {/each}
  </div>
</div>

{#if styleId === "zalgo"}
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
{/if}

<div class="row decoration-controls">
  {#each decorations as decoration (decoration.id)}
    <label class="max-field">
      <input type="checkbox" bind:checked={activeDecorations[decoration.id]} />
      <span class="muted">{decoration.name}</span>
    </label>
  {/each}
</div>

<div class="field">
  <div class="field-head">
    <span class="field-label">Result</span>
    <button
      type="button"
      class="btn-sm"
      onclick={async () => {
        if (!output) return;
        await navigator.clipboard.writeText(output);
        copyLabel = "Copied!";
        setTimeout(() => (copyLabel = "Copy"), 1200);
      }}>{copyLabel}</button
    >
  </div>
  <textarea readonly rows="6" value={output} placeholder="Result…"></textarea>
</div>

<style>
  .zalgo-controls {
    margin-top: -0.25rem;
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

  .style-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .style-btn {
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
  }

  .style-btn.active {
    background: var(--surface-2);
    border-color: var(--accent-border);
    color: var(--accent);
  }
</style>
