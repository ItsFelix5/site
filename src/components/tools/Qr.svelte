<script lang="ts">
  import qrcode from "qrcode-generator";

  let text = $state("https://");
  let fg = $state("#000000");
  let bg = $state("#ffffff");
  let clear = $state(false);
  let shape = $state<"square" | "round" | "dot">("square");
  let ecc = $state<"L" | "M" | "Q" | "H">("M");
  let margin = $state(2);
  let logo = $state("");
  let file = $state<HTMLInputElement>();

  let svg = $derived.by(() => {
    const q = qrcode(0, logo ? "H" : ecc);
    q.addData(text || " ", "Byte");
    q.make();
    const n = q.getModuleCount();
    const s = n + margin * 2;
    const f = (r: number, c: number) =>
      r < 7 ? c < 7 || c >= n - 7 : r >= n - 7 && c < 7;
    let d = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        const [x, y] = [c + margin, r + margin];
        d +=
          shape === "dot" && !f(r, c)
            ? `<circle cx="${x + 0.5}" cy="${y + 0.5}" r=".5"/>`
            : `<rect x="${x}" y="${y}" width="1.02" height="1.02" rx="${shape === "round" ? 0.35 : 0}"/>`;
      }
    const k = s * 0.22;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s * 16}" height="${s * 16}">${clear ? "" : `<rect width="${s}" height="${s}" fill="${bg}"/>`}<g fill="${fg}">${d}</g>${logo ? `<rect x="${(s - k) / 2 - 0.3}" y="${(s - k) / 2 - 0.3}" width="${k + 0.6}" height="${k + 0.6}" rx=".6" fill="${bg}"/><image href="${logo}" x="${(s - k) / 2}" y="${(s - k) / 2}" width="${k}" height="${k}"/>` : ""}</svg>`;
  });

  function save(blob: Blob, ext: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr.${ext}`;
    a.click();
  }

  function png() {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 1024;
      c.getContext("2d")!.drawImage(img, 0, 0, 1024, 1024);
      c.toBlob((b) => b && save(b, "png"));
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }
</script>

<textarea rows="3" bind:value={text} placeholder="https://"></textarea>

<div class="row opts">
  <input type="color" bind:value={fg} />
  <input type="color" bind:value={bg} disabled={clear} />
  <label><input type="checkbox" bind:checked={clear} /> ∅</label>
  <select bind:value={shape}>
    <option value="square">▪</option>
    <option value="round">▢</option>
    <option value="dot">●</option>
  </select>
  <select bind:value={ecc} disabled={!!logo}>
    {#each ["L", "M", "Q", "H"] as e}<option>{e}</option>{/each}
  </select>
  <input type="range" min="0" max="8" bind:value={margin} />
  <input
    type="file"
    accept="image/*"
    hidden
    bind:this={file}
    onchange={() => {
      const f = file?.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => (logo = r.result as string);
      r.readAsDataURL(f);
    }}
  />
  <button type="button" onclick={() => (logo ? (logo = "") : file?.click())}>
    {logo ? "✕" : "＋"} logo
  </button>
</div>

<div class="qr" class:clear>{@html svg}</div>

<div class="row">
  <button type="button" class="btn-accent" onclick={png}>PNG</button>
  <button
    type="button"
    onclick={() => save(new Blob([svg], { type: "image/svg+xml" }), "svg")}
    >SVG</button
  >
</div>

<style>
  .opts {
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .opts label {
    display: flex;
    gap: 0.3rem;
  }
  input[type="color"] {
    width: 2.4rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
  }
  select {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem;
    font-family: inherit;
  }
  .qr {
    width: min(100%, 360px);
    margin: 0.5rem 0 1rem;
    border-radius: 8px;
    overflow: hidden;
  }
  .qr.clear {
    background: repeating-conic-gradient(var(--surface-2) 0 25%, var(--surface) 0 50%) 0 / 16px 16px;
  }
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
