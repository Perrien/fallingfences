<script lang="ts">
  import type { GameStore } from '../state/GameStore.svelte';

  let { store }: { store: GameStore } = $props();

  // Selected wheel is shared with the Auto Probe panel via store.selectedWheelIndex (internal
  // index). Display index d (W{d+1}) ↔ internal index wheelCount-1-d.
  const selectedDisplay = $derived(store.wheelCount - 1 - store.selectedWheelIndex);

  // Button label: the wheel's candidate value, or 'X' when none entered.
  function label(displayIdx: number): string {
    const idx = store.wheelCount - 1 - displayIdx;
    const c = store.wheelNotes[idx]?.candidate ?? '';
    return c.trim() === '' ? 'X' : c;
  }

  const anyCandidate = $derived(store.wheelNotes.some((n) => n.candidate.trim() !== ''));
</script>

<div class="cands">
  <div class="wheel-btns">
    {#each Array.from({ length: store.wheelCount }) as _, d (d)}
      <button class="wbtn" class:sel={selectedDisplay === d} onclick={() => store.setSelectedWheel(store.wheelCount - 1 - d)}>
        <span class="wname">W{d + 1}</span>
        <span class="wval">{label(d)}</span>
      </button>
    {/each}
  </div>

  <label class="field">
    <span class="flabel">Candidate — Wheel {selectedDisplay + 1}</span>
    <input
      type="text"
      placeholder="e.g. 23  (or 10, 23 for multiple)"
      value={store.wheelNotes[store.selectedWheelIndex]?.candidate ?? ''}
      oninput={(e) => store.setCandidate(store.selectedWheelIndex, e.currentTarget.value)}
    />
  </label>

  <label class="field">
    <span class="flabel">Notes</span>
    <textarea
      rows="6"
      placeholder="Observations for this wheel…"
      value={store.wheelNotes[store.selectedWheelIndex]?.notes ?? ''}
      oninput={(e) => store.setNote(store.selectedWheelIndex, e.currentTarget.value)}
    ></textarea>
  </label>

  <button class="lock-btn" disabled={!anyCandidate} onclick={() => store.lockToCandidates()}>
    Lock to Candidates
  </button>
</div>

<style>
  .cands {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }
  .wheel-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .wbtn {
    flex: 1 1 auto;
    min-width: 3.2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0.35rem 0.4rem;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: var(--card);
    color: var(--text);
    cursor: pointer;
  }
  .wbtn.sel {
    border-color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
  }
  .wname {
    font-size: 0.65rem;
    color: var(--text-tertiary);
    letter-spacing: 0.04em;
  }
  .wval {
    font-family: ui-monospace, monospace;
    font-size: 0.95rem;
    font-weight: 700;
  }
  .wbtn.sel .wval {
    color: var(--accent-blue);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .flabel {
    font-size: 0.72rem;
    color: var(--text-secondary);
    letter-spacing: 0.04em;
  }
  .field input,
  .field textarea {
    background: var(--elevated);
    color: var(--text);
    border: 1px solid var(--divider);
    border-radius: 8px;
    padding: 0.5rem;
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
  }
  .field input {
    font-family: ui-monospace, monospace;
  }
  .lock-btn {
    margin-top: 0.25rem;
    padding: 0.6rem;
    border-radius: 8px;
    border: 1px solid var(--accent-blue);
    background: var(--accent-blue);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .lock-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
