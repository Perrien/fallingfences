<script lang="ts">
  import StartScreen from './components/StartScreen.svelte';
  import ManipulationScreen from './components/ManipulationScreen.svelte';
  import type { GameStore } from './state/GameStore.svelte';

  let store = $state<GameStore | null>(null);
</script>

{#if store}
  <ManipulationScreen {store} onExit={() => (store = null)} />
{:else}
  <StartScreen onStart={(s) => (store = s)} />
{/if}
