<script lang="ts">
  import { beginner, standard, advanced, expert, ultra, randomSeed, type LockProfile } from '../models/LockProfile';
  import { makeRandom } from '../models/Combination';
  import { GameStore } from '../state/GameStore.svelte';
  import { UltraGameStore } from '../state/UltraGameStore.svelte';

  let {
    onStart,
    onStartUltra,
  }: { onStart: (s: GameStore) => void; onStartUltra: (s: UltraGameStore) => void } = $props();

  const presets: { name: string; make: (seed?: bigint) => LockProfile; blurb: string }[] = [
    { name: 'Beginner', make: beginner, blurb: '3 wheels · wide gates · no false gates' },
    { name: 'Standard', make: standard, blurb: '3–4 wheels · occasional false gate' },
    { name: 'Advanced', make: advanced, blurb: '3–5 wheels · tighter gates' },
    { name: 'Expert', make: expert, blurb: '4–5 wheels · frequent false gates' },
  ];

  // Ultra wheel-count options; 15 is the default. Pick one, then hit Ultra to start.
  const ultraSizes = [15, 20, 25, 30];
  let ultraWheels = $state(15);

  function start(make: (seed?: bigint) => LockProfile) {
    const profile = make(randomSeed());
    const combination = makeRandom({
      wheelCount: profile.wheelCount,
      numberRange: profile.numberRange,
      forbiddenCenter: profile.contactAreaCenter,
      forbiddenHalfWidth: (15 / 360) * profile.numberRange,
      seamBuffer: profile.gateSeamBuffer,
    });
    onStart(new GameStore(profile, combination));
  }

  // Ultra can't reuse the presets array (its make returns a plain profile too, but the
  // store type differs), so it has its own entry point.
  function startUltra() {
    const profile = ultra(ultraWheels, randomSeed());
    const combination = makeRandom({
      wheelCount: profile.wheelCount,
      numberRange: profile.numberRange,
      forbiddenCenter: profile.contactAreaCenter,
      forbiddenHalfWidth: (15 / 360) * profile.numberRange,
      seamBuffer: profile.gateSeamBuffer,
    });
    onStartUltra(new UltraGameStore(profile, combination));
  }
</script>

<main>
  <h1>Falling Fences</h1>
  <p class="sub">Choose a lock to crack</p>
  <div class="grid">
    {#each presets as p}
      <button class="preset" onclick={() => start(p.make)}>
        <span class="name">{p.name}</span>
        <span class="blurb">{p.blurb}</span>
      </button>
    {/each}
    <button class="preset ultra" onclick={startUltra}>
      <span class="name">Ultra</span>
      <span class="blurb">{ultraWheels} wheels · analytical / graph reading</span>
    </button>
    <div class="ultra-sizes" role="group" aria-label="Ultra wheel count">
      {#each ultraSizes as n}
        <button
          class="size"
          class:active={n === ultraWheels}
          aria-pressed={n === ultraWheels}
          onclick={() => (ultraWheels = n)}
        >
          {n}
        </button>
      {/each}
    </div>
  </div>
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 6vw, 2.75rem);
    letter-spacing: 0.02em;
  }
  .sub {
    margin: 0 0 1rem;
    color: var(--text-secondary);
  }
  .grid {
    display: grid;
    gap: 0.6rem;
    width: min(92vw, 460px);
  }
  .preset {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    padding: 0.9rem 1.1rem;
    border-radius: 12px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }
  .preset:hover {
    border-color: var(--text-secondary);
    background: var(--chip);
  }
  .preset.ultra {
    margin-top: 0.4rem;
    border-color: var(--accent-blue, var(--text-secondary));
  }
  .ultra-sizes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem;
  }
  .size {
    padding: 0.5rem 0;
    border-radius: 10px;
    border: 1px solid var(--divider);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    transition: border-color 0.15s, background 0.15s;
  }
  .size:hover {
    border-color: var(--text-secondary);
    background: var(--chip);
  }
  .size.active {
    border-color: var(--accent-blue);
    background: var(--accent-blue);
    color: #fff;
  }
  .name {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .blurb {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
</style>
