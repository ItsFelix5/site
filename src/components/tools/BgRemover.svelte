<script lang="ts">
  let src = $state("");
  let out = $state("");
  let busy = $state(false);
  let pct = $state(0);
  let err = $state(false);
  let drag = $state(false);
  let input = $state<HTMLInputElement>();

  async function run(file?: File) {
    if (!file?.type.startsWith("image/")) return;
    src = URL.createObjectURL(file);
    out = "";
    err = false;
    busy = true;
    pct = 0;
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      out = URL.createObjectURL(
        await removeBackground(file, {
          progress: (_, cur, total) => (pct = cur / total),
        }),
      );
    } catch (e) {
      console.error(e);
      err = true;
    }
    busy = false;
  }

  $effect(() => {
    const paste = (e: ClipboardEvent) =>
      run(
        [...(e.clipboardData?.files ?? [])].find((f) =>
          f.type.startsWith("image/"),
        ),
      );
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  });
</script>

<input
  type="file"
  accept="image/*"
  hidden
  bind:this={input}
  onchange={() => run(input?.files?.[0])}
/>

<div
  class="drop"
  class:drag
  role="button"
  tabindex="0"
  onclick={() => input?.click()}
  onkeydown={(e) => e.key === "Enter" && input?.click()}
  ondragover={(e) => (e.preventDefault(), (drag = true))}
  ondragleave={() => (drag = false)}
  ondrop={(e) => (e.preventDefault(), (drag = false), run(e.dataTransfer?.files[0]))}
>
  {#if src}
    <div class="pair">
      <img src={src} alt="" />
      <div class="chk">
        {#if out}<img src={out} alt="" />{/if}
      </div>
    </div>
  {:else}
    <span class="muted">⤓</span>
  {/if}
</div>

{#if busy}<progress value={pct}></progress>{/if}
{#if err}<p class="error">?</p>{/if}
{#if out}
  <a href={out} download="cutout.png"><button type="button" class="btn-accent">PNG</button></a>
{/if}

<style>
  progress {
    width: 100%;
    margin-top: 1rem;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    width: 100%;
  }
  .pair img {
    width: 100%;
    max-height: 420px;
    object-fit: contain;
    border-radius: 6px;
  }
  .chk {
    background: repeating-conic-gradient(var(--surface-2) 0 25%, var(--surface) 0 50%) 0 / 16px 16px;
    border-radius: 6px;
    min-height: 4rem;
  }
  a {
    display: inline-block;
    margin-top: 1rem;
  }
</style>
