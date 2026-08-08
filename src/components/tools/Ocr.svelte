<script lang="ts">
  type Rect = { x: number; y: number; w: number; h: number };
  type KindedRect = Rect & { ignore: boolean };
  type Point = { x: number; y: number };

  function cssVar(name: string, fallback: string): string {
    if (typeof document === "undefined") return fallback;
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || fallback
    );
  }
  const COLOR = {
    extract: {
      stroke: cssVar("--accent", "#6673f1"),
      fill: cssVar("--accent-soft", "rgba(102, 115, 241, 0.16)"),
    },
    ignore: {
      stroke: cssVar("--danger", "#ff6b6b"),
      fill: cssVar("--danger-soft", "rgba(255, 107, 107, 0.16)"),
    },
  };

  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let status = $state("");
  let error = $state("");
  let extracting = $state(false);
  let result = $state("");
  let copyLabel = $state("Copy");

  let fileInput = $state<HTMLInputElement>();
  let dragging = $state(false);

  let canvasEl = $state<HTMLCanvasElement>();
  let containerWidth = $state(0);
  let imgEl = $state<HTMLImageElement | null>(null);
  let naturalWidth = $state(0);
  let naturalHeight = $state(0);
  let shapes = $state<KindedRect[]>([]);
  let rects = $derived(shapes.filter((s) => !s.ignore));
  let ignoreRects = $derived(shapes.filter((s) => s.ignore));

  let scale = $derived(
    naturalWidth && naturalHeight && containerWidth
      ? Math.min(containerWidth / naturalWidth, 480 / naturalHeight, 1)
      : 0,
  );
  let canvasWidth = $derived(Math.max(1, Math.round(naturalWidth * scale)));
  let canvasHeight = $derived(Math.max(1, Math.round(naturalHeight * scale)));

  let drag: { ignore: boolean; start: Point; current: Point } | null = null;

  function setFile(file?: File) {
    if (!file) return;
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    result = "";
    error = "";
    status = "";
    shapes = [];
    naturalWidth = 0;
    naturalHeight = 0;
    imgEl = null;

    const img = new Image();
    img.onload = () => {
      imgEl = img;
      naturalWidth = img.naturalWidth;
      naturalHeight = img.naturalHeight;
    };
    img.src = previewUrl;
  }

  function onPaste(event: ClipboardEvent) {
    const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
      i.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) setFile(file);
  }

  $effect(() => {
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  function drawRect(ctx: CanvasRenderingContext2D, r: KindedRect) {
    ctx.fillStyle = r.ignore ? COLOR.ignore.fill : COLOR.extract.fill;
    ctx.strokeStyle = r.ignore ? COLOR.ignore.stroke : COLOR.extract.stroke;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  function paint(w: number, h: number, temp?: KindedRect) {
    const canvas = canvasEl;
    const img = imgEl;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.lineWidth = 2;

    for (const r of rects) drawRect(ctx, r);
    if (temp?.ignore === false) drawRect(ctx, temp);

    for (const r of ignoreRects) drawRect(ctx, r);
    if (temp?.ignore === true) drawRect(ctx, temp);
  }

  $effect(() => {
    const w = canvasWidth;
    const h = canvasHeight;
    paint(w, h);
  });

  function canvasPoint(event: PointerEvent): Point {
    const canvas = canvasEl;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), canvas.width);
    const y = Math.min(Math.max(event.clientY - bounds.top, 0), canvas.height);
    return { x, y };
  }

  function rectFromDrag(drag: { start: Point; current: Point }): Rect {
    const x = Math.min(drag.start.x, drag.current.x);
    const y = Math.min(drag.start.y, drag.current.y);
    const w = Math.abs(drag.current.x - drag.start.x);
    const h = Math.abs(drag.current.y - drag.start.y);
    return { x, y, w, h };
  }

  function onPointerUp() {
    if (!drag) return;
    const r = rectFromDrag(drag);
    const { ignore, current } = drag;
    drag = null;

    if (r.w > 4 && r.h > 4) {
      shapes = [...shapes, { ...r, ignore }];
      return;
    }

    const hit = rects
      .concat(ignoreRects)
      .toReversed()
      .find(
        (r) =>
          current.x >= r.x &&
          current.x <= r.x + r.w &&
          current.y >= r.y &&
          current.y <= r.y + r.h,
      );
    if (hit) shapes = shapes.filter((s) => s !== hit);
    else paint(canvasWidth, canvasHeight);
  }

  async function extract() {
    if (!selectedFile || !imgEl) return;
    extracting = true;
    error = "";
    result = "";
    status = "Loading OCR engine…";

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (m) => {
          status =
            m.status === "recognizing text"
              ? `Recognizing… ${Math.round(m.progress * 100)}%`
              : m.status;
        },
      });

      const targets: (Rect | null)[] = rects.length ? rects : [null];
      const parts: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        status =
          targets.length > 1
            ? `Recognizing selection ${i + 1} of ${targets.length}…`
            : "Recognizing…";
        const target = targets[i];
        let source;
        if (target) {
          const img = imgEl;
          if (!img) throw new Error("No image loaded");
          const scaleX = naturalWidth / canvasWidth;
          const scaleY = naturalHeight / canvasHeight;
          const region = {
            x: target.x * scaleX,
            y: target.y * scaleY,
            w: target.w * scaleX,
            h: target.h * scaleY,
          };

          const off = document.createElement("canvas");
          off.width = Math.max(1, Math.round(region.w));
          off.height = Math.max(1, Math.round(region.h));
          const ctx = off.getContext("2d")!;
          ctx.drawImage(
            img,
            region.x,
            region.y,
            region.w,
            region.h,
            0,
            0,
            off.width,
            off.height,
          );

          source = await new Promise((resolve, reject) => {
            off.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Could not crop image"));
            }, "image/png");
          });
        } else source = selectedFile;

        if (ignoreRects.length === 0) {
          const { data } = await worker.recognize(source);
          parts.push(data.text.trim());
        } else {
          const { data } = await worker.recognize(source, {}, { blocks: true });

          parts.push(
            (data.blocks ?? [])
              .flatMap((block) =>
                block.paragraphs.flatMap((para) => para.lines),
              )
              .map((line) => {
                const scaleX = naturalWidth / canvasWidth;
                const scaleY = naturalHeight / canvasHeight;
                const ignored = ignoreRects.map((ig) => ({
                  x: ig.x * scaleX - (target ? target.x * scaleX : 0),
                  y: ig.y * scaleY - (target ? target.y * scaleY : 0),
                  w: ig.w * scaleX,
                  h: ig.h * scaleY,
                }));
                const words = line.words.filter((w) => {
                  const cx = (w.bbox.x0 + w.bbox.x1) / 2;
                  const cy = (w.bbox.y0 + w.bbox.y1) / 2;
                  return !ignored.some(
                    (r) =>
                      cx >= r.x &&
                      cx <= r.x + r.w &&
                      cy >= r.y &&
                      cy <= r.y + r.h,
                  );
                });
                if (words.length === 0) return "";
                const lineMidY = (line.bbox.y0 + line.bbox.y1) / 2;
                let out = words[0].text;
                for (let i = 1; i < words.length; i++) {
                  const gapStart = words[i - 1].bbox.x1;
                  const gapEnd = words[i].bbox.x0;
                  out +=
                    (ignored.some(
                      (r) =>
                        r.x < gapEnd &&
                        r.x + r.w > gapStart &&
                        lineMidY >= r.y &&
                        lineMidY <= r.y + r.h,
                    )
                      ? "\t"
                      : " ") + words[i].text;
                }
                return out;
              })
              .filter((s) => s.trim().length > 0)
              .join("\n"),
          );
        }
      }
      result = parts.join("\n\n");

      await worker.terminate();
      status = "Done";
    } catch (err) {
      console.error(err);
      error = "Could not extract text from this image.";
      status = "";
    } finally {
      extracting = false;
    }
  }
</script>

<div
  class="dropzone"
  class:dragging
  class:has-file={!!previewUrl}
  role="region"
  aria-label="Image dropzone"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => {
    e.preventDefault();
    dragging = false;
    setFile(
      Array.from(e.dataTransfer?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      ),
    );
  }}
>
  <input
    bind:this={fileInput}
    id="ocr-file-input"
    type="file"
    accept="image/*"
    onchange={() => setFile(fileInput?.files?.[0])}
    hidden
  />
  {#if previewUrl}
    <div class="canvas-wrap" bind:clientWidth={containerWidth}>
      <canvas
        bind:this={canvasEl}
        width={canvasWidth}
        height={canvasHeight}
        onpointerdown={(e) => {
          if (!canvasEl) return;
          e.preventDefault();
          canvasEl.setPointerCapture(e.pointerId);
          const start = canvasPoint(e);
          drag = { ignore: e.button === 2, start, current: start };
        }}
        onpointermove={(e) => {
          if (!drag) return;
          drag.current = canvasPoint(e);
          paint(canvasWidth, canvasHeight, {
            ...rectFromDrag(drag),
            ignore: drag.ignore,
          });
        }}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        oncontextmenu={(e) => e.preventDefault()}
      ></canvas>
    </div>
    <div class="canvas-controls">
      <span class="filename">{selectedFile?.name}</span>
      <div class="spacer"></div>
      <button class="btn-sm" type="button" onclick={() => fileInput?.click()}>
        Change image
      </button>
    </div>
  {:else}
    <label class="dropzone-label" for="ocr-file-input">
      <span class="dropzone-hint">
        Drop an image, paste from clipboard, or click to choose a file
      </span>
    </label>
  {/if}
</div>

<div class="row">
  <button
    type="button"
    class="btn-accent"
    disabled={!selectedFile || extracting}
    onclick={extract}
  >
    Extract text
  </button>
</div>

<p class="status muted">{status}</p>

<div class="field">
  <div class="field-head">
    <label class="field-label" for="result">Text</label>
    {#if result}
      <button
        class="btn-sm"
        type="button"
        onclick={async () => {
          if (!result) return;
          await navigator.clipboard.writeText(result);
          copyLabel = "Copied!";
          setTimeout(() => (copyLabel = "Copy"), 1200);
        }}>{copyLabel}</button
      >
    {/if}
  </div>
  <textarea
    id="result"
    rows="10"
    placeholder="Extracted text will appear here..."
    bind:value={result}
  ></textarea>
</div>

{#if error}
  <p class="error">{error}</p>
{/if}

<style>
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    box-sizing: border-box;
    padding: 1.5rem;
    margin-bottom: 1rem;
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 8px;
    color: inherit;
    font-family: inherit;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .dropzone:hover {
    border-color: var(--accent-border);
  }

  .dropzone.dragging {
    border-color: var(--accent);
    background: var(--surface-2);
  }

  .dropzone.has-file {
    padding: 0.75rem;
    align-items: stretch;
  }

  .dropzone-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    cursor: pointer;
  }

  .dropzone-hint {
    font-size: 0.85rem;
    color: var(--muted);
    text-align: center;
  }

  .canvas-wrap {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  canvas {
    display: block;
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: crosshair;
    touch-action: none;
  }

  .canvas-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    margin-top: 0.6rem;
  }

  .filename {
    font-size: 0.8rem;
    color: var(--muted);
    word-break: break-all;
  }

  .spacer {
    flex: 1;
  }
</style>
