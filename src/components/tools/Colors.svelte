<script lang="ts">
  import { type RGB, formats, harmonies, harmony, hex, scale, steps } from "../../lib/color";

  let text = $state("#f43f7a");
  let rgb = $state<RGB>([244, 63, 122]);
  let copied = $state("");

  const ctx = (typeof document !== "undefined" &&
    document.createElement("canvas").getContext("2d", { willReadFrequently: true }))!;

  function set(s: string) {
    text = s;
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    const a = ctx.fillStyle;
    ctx.fillStyle = "#fff";
    ctx.fillStyle = s;
    if (a !== ctx.fillStyle) return;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    rgb = [d[0], d[1], d[2]];
  }

  async function copy(s: string) {
    await navigator.clipboard.writeText(s);
    copied = s;
    setTimeout(() => copied === s && (copied = ""), 1000);
  }

  let ramp = $derived(scale(rgb));
</script>

{#snippet swatches(list: RGB[], labels?: (number | string)[])}
  <div class="sw">
    {#each list as c, i}
      <button
        type="button"
        style="background:{hex(c)}"
        title={hex(c)}
        onclick={() => copy(hex(c))}
      >
        <span class:dark={c[0] * 0.3 + c[1] * 0.6 + c[2] * 0.1 > 150}>
          {copied === hex(c) ? "✓" : (labels?.[i] ?? "")}
        </span>
      </button>
    {/each}
  </div>
{/snippet}

<div class="row">
  <input
    type="color"
    value={hex(rgb)}
    oninput={(e) => set(e.currentTarget.value)}
  />
  <input
    type="text"
    bind:value={text}
    oninput={() => set(text)}
    spellcheck="false"
    placeholder="#f43f7a"
  />
</div>

<div class="fmts">
  {#each formats(rgb) as f}
    <button type="button" class="btn-sm" onclick={() => copy(f)}>
      {copied === f ? "✓" : f}
    </button>
  {/each}
</div>

{@render swatches(ramp, steps)}
<button
  type="button"
  class="btn-sm"
  onclick={() =>
    copy(ramp.map((c, i) => `--color-${steps[i]}: ${hex(c)};`).join("\n"))}
>
  CSS
</button>

{#each Object.entries(harmonies) as [name, angles]}
  <p class="muted">{name}</p>
  {@render swatches(harmony(rgb, angles))}
{/each}

<style>
  .fmts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
  }
  input[type="color"] {
    width: 3rem;
    height: 2.2rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
  }
  .sw {
    display: flex;
    margin-bottom: 0.5rem;
  }
  .sw button {
    flex: 1;
    height: 3.5rem;
    padding: 0 !important;
    border-radius: 0 !important;
    border: none !important;
    font-size: 0.7rem !important;
  }
  .sw button:first-child {
    border-radius: 6px 0 0 6px !important;
  }
  .sw button:last-child {
    border-radius: 0 6px 6px 0 !important;
  }
  .sw span {
    color: #fff;
  }
  .sw span.dark {
    color: #000;
  }
  p {
    margin: 1.25rem 0 0.4rem;
    font-size: 0.8rem;
  }
</style>
