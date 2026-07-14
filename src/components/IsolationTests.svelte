<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';
  import {
    type WheelIsolationTest,
    rowWidth,
    testWheelCount,
    winnerRowIndex,
    defaultControl,
  } from '../models/WheelIsolationTest';

  let { store }: { store: GameStore } = $props();

  const fmt = (v: number) => (v === Math.round(v) ? String(v) : v.toFixed(2));
  const fmtReading = (v: number | null) => (v === null ? '—' : v.toFixed(2));

  function addTest() {
    store.addIsolationTest(0, defaultControl(store.profile));
  }

  function commitPositions(t: WheelIsolationTest, tp: string, cp: string) {
    const tpn = Number(tp);
    const cpn = Number(cp);
    if (Number.isFinite(tpn) && Number.isFinite(cpn)) store.repopulateIsolationTest(t.id, tpn, cpn);
  }

  // Display order: W1 (first digit dialed) = internal index wheelCount-1, descending.
  const displayCols = (wc: number) => Array.from({ length: wc }, (_, d) => wc - 1 - d);
</script>

<section class="pane">
  <div class="pane-head">
    <span>WHEEL ISOLATION</span>
    <button class="new" onclick={addTest}>+ New test</button>
  </div>

  {#if store.isolationTests.length === 0}
    <p class="empty">No tests yet. Add one, set Test/Control positions, then AUTO to find the gate wheel.</p>
  {:else}
    <div class="tests">
      {#each store.isolationTests as test (test.id)}
        {@const wc = testWheelCount(test)}
        {@const winner = winnerRowIndex(test)}
        {@const cols = displayCols(wc)}
        <div class="card">
          <div class="card-head">
            <label>T <input type="number" value={test.testPosition} onchange={(e) => store.repopulateIsolationTest(test.id, Number(e.currentTarget.value), test.controlPosition)} /></label>
            <label>C <input type="number" value={test.controlPosition} onchange={(e) => store.repopulateIsolationTest(test.id, test.testPosition, Number(e.currentTarget.value))} /></label>
            <button class="auto" onclick={() => store.autoRunIsolationTest(test.id)}>AUTO</button>
            <button class="del" onclick={() => store.removeIsolationTest(test.id)} aria-label="Delete test">✕</button>
          </div>

          <div class="status">
            {#if winner !== null}
              <span class="win">✔ {test.rows[winner].label} — gate candidate</span>
            {:else if test.rows.every((r) => rowWidth(r) !== null)}
              <span>Inconclusive</span>
            {:else}
              <span>{test.rows.filter((r) => rowWidth(r) !== null).length}/{test.rows.length} recorded</span>
            {/if}
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th></th>
                  {#each cols as internalIdx, d (internalIdx)}
                    <th class="whcol" title="Tap to fill this column from the Test row" onclick={() => store.fillIsolationColumn(test.id, internalIdx)}>W{d + 1}</th>
                  {/each}
                  <th>LCP</th>
                  <th>RCP</th>
                  <th>Width</th>
                </tr>
              </thead>
              <tbody>
                {#each test.rows as row, rowIdx (row.id)}
                  <tr class:winner={winner === rowIdx}>
                    <td class="label">{row.label}</td>
                    {#each cols as internalIdx (internalIdx)}
                      <td class="pos">
                        <input
                          type="number"
                          value={fmt(row.wheelPositions[internalIdx])}
                          onchange={(e) => store.setIsolationRowPosition(test.id, rowIdx, internalIdx, Number(e.currentTarget.value))}
                        />
                      </td>
                    {/each}
                    <td>{fmtReading(row.lcpReading)}</td>
                    <td>{fmtReading(row.rcpReading)}</td>
                    <td>{fmtReading(rowWidth(row))}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if winner !== null}
            <div class="card-foot">
              <button
                class="setcand"
                onclick={() => store.appendCandidate(wc - 1 - (winner - 2), fmt(test.testPosition))}
              >
                Set Candidate — {test.rows[winner].label}: {fmt(test.testPosition)}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .pane {
    width: 100%;
    max-width: 460px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .pane-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
  }
  .pane-head span {
    font-family: var(--font-typewriter);
  }
  .new {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    border: none;
    border-radius: 5px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .empty {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    margin: 0;
  }
  .tests {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .card {
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    background: var(--card);
    overflow: hidden;
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.7rem;
    background: var(--panel);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .card-head label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .card-head input {
    width: 3.2rem;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--divider);
    border-radius: 6px;
    padding: 0.2rem 0.3rem;
  }
  .auto {
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    border: none;
    border-radius: 5px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .del {
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .status {
    padding: 0.35rem 0.7rem;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }
  .status .win {
    color: var(--solve);
    font-weight: 700;
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    width: 100%;
  }
  th,
  td {
    padding: 0.25rem 0.4rem;
    text-align: center;
    white-space: nowrap;
    border-top: 1px solid var(--divider);
  }
  thead th {
    border-top: none;
    color: var(--text-secondary);
    font-weight: 600;
  }
  .whcol {
    color: var(--accent-blue);
    cursor: pointer;
  }
  td.label {
    text-align: left;
    font-weight: 600;
    color: var(--text);
  }
  td.pos input {
    width: 2.8rem;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid transparent;
    border-radius: 4px;
    text-align: center;
    font-family: inherit;
    font-size: inherit;
  }
  td.pos input:focus {
    border-color: var(--divider);
    background: var(--elevated);
    outline: none;
  }
  tr.winner {
    background: color-mix(in srgb, var(--solve) 15%, transparent);
  }
  tr.winner td {
    color: var(--solve);
  }
  .card-foot {
    padding: 0.5rem 0.7rem 0.6rem;
    border-top: 1px solid var(--divider);
  }
  .setcand {
    width: 100%;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--solve);
    background: color-mix(in srgb, var(--solve) 12%, transparent);
    border: none;
    border-radius: 5px;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
  }
</style>
