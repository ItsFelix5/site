<script lang="ts">
  let text = $state<HTMLTextAreaElement>();
  let b64 = $state<HTMLTextAreaElement>();
  let error = $state<HTMLParagraphElement>();
  let fileInput = $state<HTMLInputElement>();
</script>

<div class="field">
  <div class="field-head">
    <span class="field-label">Text</span>
    <div class="row" style="margin: 0; gap: 0.5rem;">
      <button type="button" class="btn-sm" onclick={() => fileInput?.click()}
        >Choose file…</button
      >
      <button
        type="button"
        class="btn-sm"
        onclick={async (e) => {
          if (!text?.value) return;
          await navigator.clipboard.writeText(text.value);
          (e.target as HTMLButtonElement).textContent = "Copied!";
          setTimeout(
            () => ((e.target as HTMLButtonElement).textContent = "Copy"),
            1200,
          );
        }}>Copy</button
      >
    </div>
  </div>
  <input
    type="file"
    hidden
    bind:this={fileInput}
    onchange={async () => {
      const file = fileInput?.files?.[0];
      if (!file) return;
      error!.textContent = "";
      text!.value = "";
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize)
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      b64!.value = btoa(binary);
    }}
  />
  <textarea
    bind:this={text}
    rows="8"
    placeholder="Type or paste plain text..."
    oninput={() => {
      error!.textContent = "";
      if (!text?.value) {
        b64!.value = "";
        return;
      }
      try {
        b64!.value = btoa(
          String.fromCharCode(...new TextEncoder().encode(text.value)),
        );
      } catch {
        error!.textContent = "Could not encode text";
      }
    }}
    onpaste={(e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        error!.textContent = "";
        text!.value = "";
        const reader = new FileReader();
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          let binary = "";
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize)
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          b64!.value = btoa(binary);
        };
        reader.readAsArrayBuffer(file);
      }
    }}
  ></textarea>
</div>

<div class="field">
  <div class="field-head">
    <span class="field-label">Base64</span>
    <div class="row" style="margin: 0; gap: 0.5rem;">
      <button
        type="button"
        class="btn-sm"
        onclick={async (e) => {
          if (!b64?.value) return;
          await navigator.clipboard.writeText(b64.value);
          (e.target as HTMLButtonElement).textContent = "Copied!";
          setTimeout(
            () => ((e.target as HTMLButtonElement).textContent = "Copy"),
            1200,
          );
        }}>Copy</button
      >
    </div>
  </div>
  <textarea
    bind:this={b64}
    rows="8"
    placeholder="Type or paste Base64..."
    oninput={() => {
      error!.textContent = "";
      if (!b64?.value) {
        text!.value = "";
        return;
      }

      try {
        const bytes = Uint8Array.from(atob(b64.value), (c) => c.charCodeAt(0));
        text!.value = new TextDecoder(undefined, { fatal: true }).decode(bytes);
      } catch {
        error!.textContent = "Invalid Base64";
      }
    }}
  ></textarea>
</div>

<p bind:this={error} class="error"></p>
