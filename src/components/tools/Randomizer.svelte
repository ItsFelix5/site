<script lang="ts">
  let min = $state(1);
  let max = $state(6);
  let rolls = $state<number[]>([]);
</script>

<div class="row">
  <input type="number" bind:value={min} />
  -
  <input type="number" bind:value={max} />
  <button
    type="button"
    class="btn-accent"
    onclick={() => {
      min = Math.max(1, Math.round(min) || 1);
      max = Math.max(min + 1, Math.round(max) || 6);
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      rolls = [value, ...rolls];
    }}>Randomize</button
  >
</div>

<p class="result">{rolls[0]}</p>
<p class="muted history">{rolls.slice(1).join(" · ")}</p>

<style>
  .result {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
  }

  .history {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    min-height: 1.2em;
    text-overflow: ellipsis;
  }
</style>
