<script lang="ts">
  // Phase 0 shell — proves the Vite + Svelte + PWA + Pages pipeline end-to-end.
  // The simulation core (SeededRNG, AngleNormalizer) is ported and parity-tested
  // under test/parity; the UI arrives in Phase 1.
</script>

<main>
  <h1>Falling Fences</h1>
  <p class="tag">Future home of Falling Fences</p>
  <p class="phase">Phase&nbsp;0 · foundation</p>
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    text-align: center;
    padding: 2rem;
  }
  h1 {
    font-size: clamp(1.75rem, 6vw, 3rem);
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.02em;
  }
  .tag {
    font-size: clamp(1rem, 3.5vw, 1.25rem);
    color: #b8a898;
    margin: 0;
  }
  .phase {
    font-size: 0.8rem;
    color: #7080a0;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
