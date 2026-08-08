<script lang="ts">
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SPECIAL_CHARS = "!@#$%^&*()-_=+";
const NONE = [
	"hunter2",
	"password123",
	"¯\\_(ツ)_/¯",
	"123456",
	"admin",
	"qwerty",
	"iloveyou",
	"t ̶͙͎̄̑͋hͤeͧ f̼̰̀͞r̟o͉̯̤̖ͩ͐ͨg̪̟̭͐ k͉̇͋̂ṅ̦̫̪̏͝oẃ̉̆́͐̅͛s̙̩ y̼̞ͦ̚o̻u̱ͤ̾r̃̋ ś͇̥ͯ̅͜i̪̼͋͟n̢͈̜͋͒ͅs 🐸̄",
];

let length = $state(16);
let includeLowercase = $state(true);
let includeUppercase = $state(true);
let includeNumbers = $state(true);
let includeSpecialChars = $state(true);
let result = $state("");
let copyLabel = $state("Copy");

function generate() {
	const PASSWORD_CHARS =
		(includeLowercase ? LOWERCASE : "") +
		(includeUppercase ? UPPERCASE : "") +
		(includeNumbers ? NUMBERS : "") +
		(includeSpecialChars ? SPECIAL_CHARS : "");

	if (!PASSWORD_CHARS) {
		result = NONE[Math.floor(Math.random() * NONE.length)];
		return;
	}

	result = Array.from(
		crypto.getRandomValues(new Uint32Array(length)),
		(n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length],
	).join("");
}
</script>

<div class="row">
  <label class="max-field">
    <input type="checkbox" bind:checked={includeLowercase} />
    <span class="muted">Lowercase</span>
  </label>
  <label class="max-field">
    <input type="checkbox" bind:checked={includeUppercase} />
    <span class="muted">Uppercase</span>
  </label>
  <label class="max-field">
    <input type="checkbox" bind:checked={includeNumbers} />
    <span class="muted">Numbers</span>
  </label>
  <label class="max-field">
    <input type="checkbox" bind:checked={includeSpecialChars} />
    <span class="muted"> Special</span>
  </label>
  <label class="max-field">
    <input type="number" min="1" max="16000" bind:value={length} />
    <span class="muted">Length</span>
  </label>
  <button type="button" class="btn-accent" onclick={generate}>Generate</button>
  <button
    type="button"
    onclick={async () => {
      if (!result) return;
      await navigator.clipboard.writeText(result);
      copyLabel = "Copied!";
      setTimeout(() => (copyLabel = "Copy"), 1200);
    }}>{copyLabel}</button
  >
</div>

<p class="result">{result}</p>

<style>
  .max-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .result {
    flex: 1;
    margin: 0;
    font-size: 1.1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
  }
</style>
