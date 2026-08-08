<script lang="ts">
let domain = $state("");
let status = $state("");
let byType = $state<
	[
		string,
		{
			name: string;
			type: number;
			TTL: number;
			data: string;
		}[],
	][]
>([]);

async function runLookup(): Promise<void> {
	status = `Looking up ${domain}…`;

	try {
		byType = await Promise.all(
			["A", "AAAA", "MX", "TXT", "NS", "CNAME", "CAA"].map(async (type) => {
				const res = await fetch(
					`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
					{
						headers: {
							accept: "application/dns-json",
						},
					},
				);

				if (!res.ok) throw new Error(`DNS query failed (${res.status})`);

				const { Answer }: any = await res.json();
				return [type, Answer ?? []] as const;
			}),
		);

		status = `Results for ${domain}`;
	} catch (err) {
		console.error(err);
		byType = [];
		status = "Lookup failed. Check the domain and try again.";
	}
}
</script>

<div class="row">
  <input
    type="text"
    placeholder="example.com"
    bind:value={domain}
    onkeydown={(event) => {
      if (event.key === "Enter") runLookup();
      else
        domain = domain
          .trim()
          .replace(/^https?:\/\//i, "")
          .replace(/\/.*$/, "");
    }}
  />

  <button type="button" class="btn-accent" onclick={runLookup}> Lookup </button>
</div>

<p class="status muted">{status}</p>

<div>
  {#each byType.filter(([_, answers]) => answers.length > 0) as [type, answers] (type)}
    <div class="record-group">
      <div class="record-heading">
        <span class="badge">{type}</span>
        <span class="count muted">{answers.length}</span>
      </div>

      <div class="record-table">
        {#each answers as answer, i (i)}
          <div class="record-row">
            <span class="name">{answer.name}</span>
            <span class="ttl muted">{answer.TTL}s</span>
            <span class="value">{answer.data}</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <p class="muted">No records found.</p>
  {/each}
</div>

<style>
  input {
    flex: 1;
  }

  .record-group {
    margin-bottom: 1.5rem;
  }

  .record-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--accent-border);
    color: var(--accent);
    background: var(--surface-2);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .count {
    font-size: 0.8rem;
  }

  .record-table {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .record-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) 4rem minmax(0, 2fr);
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .record-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .record-row:hover {
    background: var(--surface);
  }

  .value {
    word-break: break-all;
  }

  @media (max-width: 520px) {
    .record-row {
      grid-template-columns: 1fr;
      gap: 0.15rem;
    }
  }
</style>
