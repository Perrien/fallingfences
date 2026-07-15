<script lang="ts">
  // Ultra solve sheet. Score is a flat wheelCount × 500 — no efficiency, no probe history
  // (Ultra has no dialing step). Gate positions in raw array order (W1 = wheels[0]).
  let {
    score,
    wheelCount,
    gatePositions,
    difficulty,
    onNewLock,
    onClose,
  }: {
    score: number;
    wheelCount: number;
    gatePositions: number[];
    difficulty: number;
    onNewLock: () => void;
    onClose: () => void;
  } = $props();
</script>

<div class="backdrop" role="presentation" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="card" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="crest">✔</div>
    <h2>Opened!</h2>
    <p class="combo">{gatePositions.map((g) => g.toFixed(0)).join(' – ')}</p>

    <div class="rows">
      <div class="row"><span>Difficulty</span><b>{String(difficulty).padStart(4, '0')}</b></div>
      <div class="row"><span>Wheels</span><b>{wheelCount}</b></div>
      <div class="row total"><span>Score</span><b>{score}</b></div>
    </div>

    <div class="actions">
      <button class="ghost" onclick={onClose}>Keep exploring</button>
      <button class="primary" onclick={onNewLock}>New lock</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 10;
  }
  .card {
    width: min(92vw, 380px);
    background: var(--card);
    border: 1px solid var(--divider);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .crest {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--solve);
    color: var(--elevated);
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }
  h2 {
    margin: 0.25rem 0 0;
    color: var(--solve);
  }
  .combo {
    margin: 0;
    font-family: ui-monospace, monospace;
    font-size: 1.25rem;
    letter-spacing: 0.05em;
    color: var(--text);
    text-align: center;
    word-break: break-word;
  }
  .rows {
    width: 100%;
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.9rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--text-secondary);
  }
  .row b {
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }
  .row.total {
    margin-top: 0.35rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--divider);
    font-size: 1.05rem;
  }
  .row.total b {
    font-size: 1.2rem;
  }
  .actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 1rem;
    width: 100%;
  }
  .actions button {
    flex: 1;
    padding: 0.7rem;
    border-radius: 10px;
    border: 1px solid var(--divider);
    background: var(--panel);
    color: var(--text);
    cursor: pointer;
    font-size: 0.95rem;
  }
  .actions .primary {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
    color: #fff;
  }
</style>
