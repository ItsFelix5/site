<script lang="ts">
  import { tick } from "svelte";

  let recordingState = $state<"idle" | "recording" | "paused">("idle");
  let includeAudio = $state(false);
  let errorMessage = $state("");
  let elapsedMs = $state(0);
  let displayMs = $state(0);

  let liveVideo = $state<HTMLVideoElement | null>(null);

  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let recordedChunks: Blob[] = [];
  let timerStart = 0;
  let timerRunning = false;
  let timerHandle: number | undefined;

  function tickTimer() {
    displayMs = elapsedMs + (performance.now() - timerStart);
    timerHandle = requestAnimationFrame(tickTimer);
  }

  function startTimer() {
    timerStart = performance.now();
    timerRunning = true;
    timerHandle = requestAnimationFrame(tickTimer);
  }

  function stopTimer() {
    if (timerHandle) cancelAnimationFrame(timerHandle);
    if (timerRunning) {
      elapsedMs += performance.now() - timerStart;
      timerRunning = false;
    }
    displayMs = elapsedMs;
  }

  function cleanupStream() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (liveVideo) liveVideo.srcObject = null;
  }

  function detachRecorder(recorder: MediaRecorder) {
    recorder.ondataavailable = null;
    recorder.onpause = null;
    recorder.onresume = null;
    recorder.onstop = null;
    recorder.onerror = null;
  }

  function resetToIdle() {
    if (mediaRecorder) detachRecorder(mediaRecorder);
    cleanupStream();
    mediaRecorder = null;
    recordedChunks = [];
    stopTimer();
    elapsedMs = 0;
    displayMs = 0;
    recordingState = "idle";
  }

  function downloadChunks() {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `screen-recording-${Date.now()}.webm`;
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function startRecording() {
    errorMessage = "";

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: includeAudio,
      });
    } catch (error) {
      errorMessage = "Screen capture cancelled or not supported.";
      console.error(error);
      return;
    }

    elapsedMs = 0;
    displayMs = 0;
    recordingState = "recording";
    await tick();

    if (liveVideo) {
      liveVideo.srcObject = stream;
      void liveVideo.play().catch(() => {});
    }

    stream.getVideoTracks()[0].addEventListener("ended", () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive")
        mediaRecorder.stop();
    });

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType:
        (stream.getAudioTracks().length > 0
          ? [
              "video/webm;codecs=vp9,opus",
              "video/webm;codecs=vp8,opus",
              "video/webm",
            ]
          : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        ).find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm",
    });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onpause = () => {
      recordingState = "paused";
    };
    mediaRecorder.onresume = () => {
      recordingState = "recording";
    };
    mediaRecorder.onstop = () => {
      downloadChunks();
      resetToIdle();
    };
    mediaRecorder.onerror = (event) => {
      console.error(
        "[ScreenRecorder] recorder error",
        (event as ErrorEvent).error ?? event,
      );
      errorMessage = "Recording failed :(";
      resetToIdle();
    };
    mediaRecorder.start();
    startTimer();
  }

  function togglePause() {
    if (recordingState === "recording") {
      if (!mediaRecorder || mediaRecorder.state !== "recording") return;

      stopTimer();
      if (liveVideo) liveVideo.pause();
      mediaRecorder.requestData();
      mediaRecorder.pause();
    } else if (recordingState === "paused") {
      if (!mediaRecorder || mediaRecorder.state !== "paused") return;

      startTimer();
      if (liveVideo) void liveVideo.play().catch(() => {});
      mediaRecorder.resume();
    }
  }

  $effect(() => {
    return () => {
      if (mediaRecorder) detachRecorder(mediaRecorder);
      if (timerHandle) cancelAnimationFrame(timerHandle);
      cleanupStream();
    };
  });
</script>

<div>
  <div class="status-bar">
    <span class="dot" data-state={recordingState}></span>
    <span>{recordingState}</span>
    <span class="muted timer">
      {Math.floor(displayMs / 60000)
        .toString()
        .padStart(2, "0")}:{Math.floor((displayMs / 1000) % 60)
        .toString()
        .padStart(2, "0")}</span
    >
  </div>

  <div class="preview">
    {#if recordingState === "idle"}
      <p>No active recording</p>
    {:else}
      <video bind:this={liveVideo} autoplay muted playsinline></video>
    {/if}
  </div>

  <div class="options">
    <label
      ><input
        bind:checked={includeAudio}
        disabled={recordingState !== "idle"}
        type="checkbox"
      /> Include audio</label
    >
  </div>

  <div class="controls">
    <button
      hidden={recordingState !== "idle"}
      onclick={startRecording}
      type="button"
      class="btn-accent">Start recording</button
    >
    <button
      hidden={recordingState === "idle"}
      onclick={togglePause}
      type="button">{recordingState === "paused" ? "Resume" : "Pause"}</button
    >
    <button
      hidden={recordingState !== "paused"}
      onclick={resetToIdle}
      type="button"
      class="btn-danger">Restart</button
    >
    <button
      hidden={recordingState !== "paused"}
      onclick={downloadChunks}
      type="button">Download</button
    >
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    text-transform: capitalize;
  }

  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--muted);
  }

  .dot[data-state="recording"] {
    background: var(--accent);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .dot[data-state="paused"] {
    background: var(--accent-2);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.35;
    }
  }

  .timer {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }

  .preview {
    position: relative;
    aspect-ratio: 16 / 9;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .preview video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .preview p {
    position: absolute;
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .options {
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .options label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    width: fit-content;
  }

  .controls {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
</style>
