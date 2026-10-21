<script lang="ts">
  type Kind = "image" | "video" | "audio";

  let file = $state<File>();
  let kind = $state<Kind>("image");
  let url = $state("");
  let dur = $state(0);
  let start = $state(0);
  let end = $state(0);
  let crop = $state<[number, number, number, number] | null>(null);
  let size = $state(100);
  let quality = $state(80);
  let fix = $state(false);
  let busy = $state(false);
  let pct = $state(0);
  let err = $state(false);
  let out = $state<{ url: string; bytes: number; name: string } | null>(null);
  let drag = $state(false);
  let input = $state<HTMLInputElement>();
  let el = $state<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>();
  let box = $state<HTMLDivElement>();
  let from: [number, number] | null = null;

  const timed = $derived(kind !== "image");
  const framed = $derived(kind !== "audio");

  function load(f?: File) {
    const k = f?.type.split("/")[0] as Kind;
    if (!f || !["image", "video", "audio"].includes(k)) return;
    file = f;
    kind = k;
    url = URL.createObjectURL(f);
    crop = null;
    out = null;
    err = false;
    dur = start = end = 0;
  }

  function meta() {
    if (!timed || !el) return;
    dur = end = (el as HTMLMediaElement).duration;
    start = 0;
  }

  const point = (e: PointerEvent): [number, number] => {
    const b = box!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    ];
  };

  function up() {
    if (from && crop && (crop[2] < 0.02 || crop[3] < 0.02)) crop = null;
    from = null;
  }

  function seek(t: number) {
    if (el && timed) (el as HTMLMediaElement).currentTime = t;
  }

  async function image() {
    const img = el as HTMLImageElement;
    const [cx, cy, cw, ch] = crop ?? [0, 0, 1, 1];
    const sw = Math.round(cw * img.naturalWidth);
    const sh = Math.round(ch * img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((sw * size) / 100));
    c.height = Math.max(1, Math.round((sh * size) / 100));
    const g = c.getContext("2d")!;
    g.drawImage(img, cx * img.naturalWidth, cy * img.naturalHeight, sw, sh, 0, 0, c.width, c.height);
    if (fix) {
      // per-channel auto levels
      const d = g.getImageData(0, 0, c.width, c.height);
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255;
        let hi = 0;
        for (let i = ch; i < d.data.length; i += 4) {
          lo = Math.min(lo, d.data[i]);
          hi = Math.max(hi, d.data[i]);
        }
        if (hi > lo)
          for (let i = ch; i < d.data.length; i += 4)
            d.data[i] = ((d.data[i] - lo) * 255) / (hi - lo);
      }
      g.putImageData(d, 0, 0);
    }
    const type = file!.type === "image/png" && quality === 100 ? "image/png" : "image/webp";
    return new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, quality / 100));
  }

  async function media() {
    const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ff = new FFmpeg();
    ff.on("progress", ({ progress }) => (pct = Math.min(1, Math.max(0, progress))));
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    await ff.writeFile("in", await fetchFile(file!));
    const v = el as HTMLVideoElement;
    const vf: string[] = [];
    if (crop && kind === "video") {
      const ev = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
      vf.push(`crop=${ev(crop[2] * v.videoWidth)}:${ev(crop[3] * v.videoHeight)}:${Math.round(crop[0] * v.videoWidth)}:${Math.round(crop[1] * v.videoHeight)}`);
    }
    if (size < 100) vf.push(`scale=trunc(iw*${size / 100}/2)*2:-2`);
    const ext = kind === "video" ? "mp4" : "mp3";
    const args = ["-ss", String(start), "-t", String(end - start), "-i", "in"];
    if (kind === "video")
      args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", String(Math.round(40 - quality * 0.22)), "-c:a", "aac", "-b:a", `${Math.round(48 + quality * 1.2)}k`);
    else args.push("-c:a", "libmp3lame", "-b:a", `${Math.round(48 + quality * 2.7)}k`);
    if (vf.length) args.push("-vf", vf.join(","));
    if (fix) args.push("-af", "loudnorm");
    await ff.exec([...args, `out.${ext}`]);
    const data = (await ff.readFile(`out.${ext}`)) as Uint8Array;
    ff.terminate();
    return new Blob([data as BlobPart], { type: `${kind}/${ext === "mp3" ? "mpeg" : ext}` });
  }

  async function run() {
    busy = true;
    err = false;
    pct = 0;
    out = null;
    try {
      const b = kind === "image" ? await image() : await media();
      const ext = kind === "image" ? "webp" : kind === "video" ? "mp4" : "mp3";
      out = { url: URL.createObjectURL(b), bytes: b.size, name: `${file!.name.replace(/\.[^.]+$/, "")}.${ext}` };
    } catch (e) {
      console.error(e);
      err = true;
    }
    busy = false;
  }

  const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${Math.round(n / 1e3)} KB`);
</script>

<input
  type="file"
  accept="image/*,video/*,audio/*"
  hidden
  bind:this={input}
  onchange={() => load(input?.files?.[0])}
/>

{#if !file}
  <div
    class="drop"
    class:drag
    role="button"
    tabindex="0"
    onclick={() => input?.click()}
    onkeydown={(e) => e.key === "Enter" && input?.click()}
    ondragover={(e) => (e.preventDefault(), (drag = true))}
    ondragleave={() => (drag = false)}
    ondrop={(e) => (e.preventDefault(), (drag = false), load(e.dataTransfer?.files[0]))}
  >
    <span class="muted">⤓</span>
  </div>
{:else}
  <div
    class="stage"
    bind:this={box}
    onpointerdown={(e) => {
      if (!framed || (kind === "video" && e.offsetY > box!.clientHeight - 48)) return;
      box!.setPointerCapture(e.pointerId);
      from = point(e);
      crop = [...from, 0, 0];
    }}
    onpointermove={(e) => {
      if (!from) return;
      const p = point(e);
      crop = [Math.min(from[0], p[0]), Math.min(from[1], p[1]), Math.abs(p[0] - from[0]), Math.abs(p[1] - from[1])];
    }}
    onpointerup={up}
    onpointercancel={up}
  >
    {#if kind === "image"}
      <img bind:this={el} src={url} alt="" draggable="false" />
    {:else if kind === "video"}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={el} src={url} controls onloadedmetadata={meta}></video>
    {:else}
      <audio bind:this={el} src={url} controls onloadedmetadata={meta}></audio>
    {/if}
    {#if crop}
      <div
        class="crop"
        style="left:{crop[0] * 100}%;top:{crop[1] * 100}%;width:{crop[2] * 100}%;height:{crop[3] * 100}%"
      ></div>
    {/if}
  </div>

  {#if timed && dur}
    <div class="row">
      <input type="range" min="0" max={dur} step="0.01" bind:value={start}
        oninput={() => { start = Math.min(start, end); seek(start); }} />
      <input type="range" min="0" max={dur} step="0.01" bind:value={end}
        oninput={() => { end = Math.max(start, end); seek(end); }} />
      <span class="muted">{(end - start).toFixed(1)}s</span>
    </div>
  {/if}

  <div class="row">
    {#if framed}
      <label>⤢ <input type="range" min="10" max="100" bind:value={size} /> <span class="muted">{size}%</span></label>
    {/if}
    <label>◐ <input type="range" min="1" max="100" bind:value={quality} /> <span class="muted">{quality}</span></label>
    <label><input type="checkbox" bind:checked={fix} /> ≈</label>
  </div>

  <div class="row">
    <button type="button" class="btn-accent" disabled={busy} onclick={run}>▶</button>
    <button type="button" onclick={() => ((file = undefined), (out = null))}>✕</button>
    {#if busy && kind !== "image"}<progress value={pct}></progress>{/if}
    {#if err}<span class="error">?</span>{/if}
  </div>

  {#if out}
    <div class="row">
      <a href={out.url} download={out.name}><button type="button" class="btn-accent">⤓ {out.name}</button></a>
      <span class="muted">{kb(file.size)} → {kb(out.bytes)}</span>
    </div>
    {#if kind === "image"}<img class="res" src={out.url} alt="" />
    {:else if kind === "video"}<!-- svelte-ignore a11y_media_has_caption --><video class="res" src={out.url} controls></video>
    {:else}<audio src={out.url} controls></audio>{/if}
  {/if}
{/if}

<style>
  .stage {
    position: relative;
    display: inline-block;
    max-width: 100%;
    margin-bottom: 1rem;
    touch-action: none;
    user-select: none;
  }
  .stage :global(img),
  .stage :global(video) {
    display: block;
    max-width: 100%;
    max-height: 420px;
    border-radius: 6px;
  }
  .crop {
    position: absolute;
    pointer-events: none;
    border: 2px solid var(--accent);
    background: var(--accent-soft);
    box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.5);
  }
  .row {
    flex-wrap: wrap;
  }
  .row label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  progress {
    flex: 1;
  }
  .res {
    max-width: 100%;
    max-height: 320px;
    border-radius: 6px;
  }
</style>
