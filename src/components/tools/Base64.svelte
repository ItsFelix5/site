<script lang="ts">
let text = $state<HTMLTextAreaElement>();
let b64 = $state<HTMLTextAreaElement>();
let error = $state<HTMLParagraphElement>();
</script>

<div class="field">
  <div class="field-head">
    <span class="field-label">Text</span>
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
  ></textarea>
</div>

<div class="field">
  <div class="field-head">
    <span class="field-label">Base64</span>
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

