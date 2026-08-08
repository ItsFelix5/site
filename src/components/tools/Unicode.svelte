<script lang="ts">
  const invisibleNames: Record<number, string> = {
    0: "NULL",
    9: "TAB",
    10: "LINE FEED",
    11: "LINE TABULATION",
    12: "FORM FEED",
    13: "CARRIAGE RETURN",
    32: "SPACE",
    127: "DELETE",
    133: "NEXT LINE",
    160: "NO-BREAK SPACE",
    173: "SOFT HYPHEN",
    1564: "ARABIC LETTER MARK",
    5760: "OGHAM SPACE MARK",
    6158: "MONGOLIAN VOWEL SEPARATOR",
    8192: "EN QUAD",
    8193: "EM QUAD",
    8194: "EN SPACE",
    8195: "EM SPACE",
    8196: "THREE-PER-EM SPACE",
    8197: "FOUR-PER-EM SPACE",
    8198: "SIX-PER-EM SPACE",
    8199: "FIGURE SPACE",
    8200: "PUNCTUATION SPACE",
    8201: "THIN SPACE",
    8202: "HAIR SPACE",
    8203: "ZERO WIDTH SPACE",
    8204: "ZERO WIDTH NON-JOINER",
    8205: "ZERO WIDTH JOINER",
    8206: "LEFT-TO-RIGHT MARK",
    8207: "RIGHT-TO-LEFT MARK",
    8232: "LINE SEPARATOR",
    8233: "PARAGRAPH SEPARATOR",
    8234: "LEFT-TO-RIGHT EMBEDDING",
    8235: "RIGHT-TO-LEFT EMBEDDING",
    8236: "POP DIRECTIONAL FORMATTING",
    8237: "LEFT-TO-RIGHT OVERRIDE",
    8238: "RIGHT-TO-LEFT OVERRIDE",
    8239: "NARROW NO-BREAK SPACE",
    8287: "MEDIUM MATHEMATICAL SPACE",
    8288: "WORD JOINER",
    8294: "LEFT-TO-RIGHT ISOLATE",
    8295: "RIGHT-TO-LEFT ISOLATE",
    8296: "FIRST STRONG ISOLATE",
    8297: "POP DIRECTIONAL ISOLATE",
    12288: "IDEOGRAPHIC SPACE",
    65038: "VARIATION SELECTOR (TEXT)",
    65039: "VARIATION SELECTOR (EMOJI)",
    65279: "ZERO WIDTH NO-BREAK SPACE",
  };

  const encoder = new TextEncoder();
  let value = $state("");
  let copied = $state("");

  const rows = $derived(
    Array.from(value, (character, index) => {
      const decimal = character.codePointAt(0)!;
      const name = invisibleNames[decimal];
      const hex = decimal.toString(16).toUpperCase();

      return {
        index,
        character,
        display: name ? `[${name}]` : character,
        codePoint: `U+${hex.padStart(4, "0")}`,
        utf8: [...encoder.encode(character)]
          .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
          .join(" "),
        utf16: Array.from({ length: character.length }, (_, index) =>
          character
            .charCodeAt(index)
            .toString(16)
            .toUpperCase()
            .padStart(4, "0"),
        ).join(" "),
        escape:
          decimal <= 0xffff ? `\\u${hex.padStart(4, "0")}` : `\\u{${hex}}`,
      };
    }),
  );

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    copied = id;
    setTimeout(() => {
      if (copied === id) copied = "";
    }, 900);
  }
</script>

<div class="field">
  <textarea
    id="unicode-input"
    bind:value
    rows="7"
    spellcheck="false"
    placeholder="Type or paste text…"
  ></textarea>
</div>

<div class="metrics" aria-label="Text statistics">
  <span
    ><strong
      >{Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          value,
        ),
      ).length}</strong
    > graphemes</span
  >
  <span><strong>{rows.length}</strong> code points</span>
  <span><strong>{value.length}</strong> UTF-16 units</span>
  <span><strong>{encoder.encode(value).length}</strong> UTF-8 bytes</span>
</div>

{#if rows.length}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Index</th>
          <th>Character</th>
          <th>Code point</th>
          <th>UTF-8</th>
          <th>UTF-16</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr>
            <td>{row.index}</td>
            <td>
              <button
                type="button"
                class:invisible={row.display !== row.character}
                class="value"
                onclick={() => copy(row.character, `${row.index}-character`)}
                >{copied === `${row.index}-character`
                  ? "Copied"
                  : row.display}</button
              >
            </td>
            <td>
              <button
                type="button"
                class="value"
                onclick={() => copy(row.codePoint, `${row.index}-code`)}
              >
                {copied === `${row.index}-code` ? "Copied" : row.codePoint}
              </button>
            </td>
            <td>
              <button
                type="button"
                class="value"
                onclick={() => copy(row.utf8, `${row.index}-utf8`)}
              >
                {copied === `${row.index}-utf8` ? "Copied" : row.utf8}
              </button>
            </td>
            <td>
              <button
                type="button"
                class="value"
                onclick={() => copy(row.utf16, `${row.index}-utf16`)}
              >
                {copied === `${row.index}-utf16` ? "Copied" : row.utf16}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  textarea {
    line-height: 1.55;
  }

  .metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    margin: 0.75rem 0 1.5rem;
    color: var(--muted);
    font-size: 0.75rem;
  }

  .metrics strong {
    color: var(--text);
  }

  .table-wrap {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  th,
  td {
    padding: 0.45rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  th {
    padding: 0.6rem 0.7rem;
    color: var(--muted);
    background: var(--surface);
    font-weight: 500;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  button.value {
    width: 100%;
    border-color: transparent;
    background: transparent;
    text-align: left;
    white-space: nowrap;
  }

  button.value:hover {
    background: var(--surface);
  }

  button.invisible {
    color: var(--danger);
    font-size: 0.7rem;
  }
</style>
