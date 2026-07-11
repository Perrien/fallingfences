<script lang="ts">
  import type { SolveScoreResult } from '../sim/SolveScoring';

  let {
    result,
    efficiency,
    manualSweepCount,
    lifetimeProbeCount,
    gatePositions,
    difficulty,
    onNewLock,
    onClose,
  }: {
    result: SolveScoreResult;
    efficiency: number;
    manualSweepCount: number;
    lifetimeProbeCount: number;
    gatePositions: number[];
    difficulty: number;
    onNewLock: () => void;
    onClose: () => void;
  } = $props();

  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const pct = (f: number) => `${f > 0 ? '+' : ''}${Math.round(f * 100)}%`;
</script>

<div class="backdrop" role="presentation" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="card" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="crest">✔</div>
    <h2>Cracked!</h2>
    <p class="combo">{gatePositions.map((g) => g.toFixed(0)).join(' – ')}</p>

    <div class="rows">
      <div class="row"><span>Difficulty</span><b>{String(difficulty).padStart(4, '0')}</b></div>
      <div class="row"><span>Base score</span><b>{result.base}</b></div>
      <div class="row">
        <span>Efficiency ({efficiency.toFixed(2)}× · {lifetimeProbeCount} probes)</span>
        <b class={result.efficiencyPoints >= 0 ? 'pos' : 'neg'}>{sign(result.efficiencyPoints)} ({pct(result.efficiencyModifier)})</b>
      </div>
      {#if result.manualProbeBonusPoints > 0}
        <div class="row">
          <span>Manual sweep bonus ({manualSweepCount})</span>
          <b class="pos">{sign(result.manualProbeBonusPoints)} ({pct(result.manualProbeBonus)})</b>
        </div>
      {/if}
      <div class="row total"><span>Total</span><b>{Math.round(result.total)}</b></div>
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
    background: #26262b;
    border: 1px solid #4a4a52;
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
    background: #4ac07a;
    color: #10331f;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }
  h2 {
    margin: 0.25rem 0 0;
    color: #4ac07a;
  }
  .combo {
    margin: 0;
    font-family: ui-monospace, monospace;
    font-size: 1.4rem;
    letter-spacing: 0.06em;
    color: #f0e4d8;
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
    color: #b8a898;
  }
  .row b {
    font-variant-numeric: tabular-nums;
    color: #f0e4d8;
  }
  .row .pos {
    color: #4ac07a;
  }
  .row .neg {
    color: #e0574a;
  }
  .row.total {
    margin-top: 0.35rem;
    padding-top: 0.5rem;
    border-top: 1px solid #4a4a52;
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
    border: 1px solid #4a4a52;
    background: #1e1e22;
    color: #f0e4d8;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .actions .primary {
    background: #3a5bd0;
    border-color: #3a5bd0;
  }
</style>
