<script lang="ts">
  import { analyse, normalize, solve } from "../../lib/solver";

  let input = $state("3(x - 1) >= 5x + 2");
  let pick = $state("");
  let el = $state<HTMLInputElement>();

  let parsed = $derived.by(() => {
    try {
      return { p: analyse(input) };
    } catch {
      return { p: null };
    }
  });
  let v = $derived(
    parsed.p?.vars.includes(pick) ? pick : (parsed.p?.vars.at(-1) ?? "x"),
  );
  let res = $derived.by(() => {
    if (!parsed.p) return { steps: [], err: !!input.trim() };
    try {
      return { steps: solve(parsed.p, v), err: false };
    } catch {
      return { steps: [], err: true };
    }
  });

  function insert(s: string) {
    if (!el) return;
    const [a, b] = [el.selectionStart ?? input.length, el.selectionEnd ?? input.length];
    input = input.slice(0, a) + s + input.slice(b);
    queueMicrotask(() => {
      el!.focus();
      el!.setSelectionRange(a + s.length, a + s.length);
    });
  }
</script>

<input
  type="text"
  class="big"
  bind:this={el}
  bind:value={input}
  oninput={() => (input = normalize(input).replace(/\*/g, "·").replace(/-/g, "−"))}
  spellcheck="false"
  autocomplete="off"
  placeholder="2x + 3 = 7"
/>

<div class="row keys">
  {#each ["≤", "≥", "<", ">", "=", "^", "(", ")", "/", "·"] as k}
    <button type="button" class="btn-sm" onclick={() => insert(k)}>{k}</button>
  {/each}
  <span class="spacer"></span>
  {#each parsed.p?.vars ?? [] as x}
    <button
      type="button"
      class="btn-sm"
      class:btn-accent={x === v}
      onclick={() => (pick = x)}>{x}</button
    >
  {/each}
</div>

<div class="steps">
  {#each res.steps as s, i}
    <div class="step card" class:last={i === res.steps.length - 1 && i > 0}>
      <span>{s.t}</span>
      {#if s.op}<span class="muted">{s.op}</span>{/if}
    </div>
  {/each}
  {#if res.err}<p class="error">?</p>{/if}
</div>

<style>
  .big {
    width: 100%;
    box-sizing: border-box;
    font-size: 1.4rem !important;
    padding: 0.8rem 1rem !important;
    margin-bottom: 0.75rem;
  }
  .keys {
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .spacer {
    flex: 1;
  }
  .steps {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .step {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem 1rem;
    font-size: 1.1rem;
  }
  .step.last {
    border-color: var(--accent-border);
    color: var(--accent);
    font-weight: 600;
  }
</style>
