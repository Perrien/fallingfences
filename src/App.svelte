<script lang="ts">
  import StartScreen from './components/StartScreen.svelte';
  import ManipulationScreen from './components/ManipulationScreen.svelte';
  import UltraScreen from './components/UltraScreen.svelte';
  import type { GameStore } from './state/GameStore.svelte';
  import type { UltraGameStore } from './state/UltraGameStore.svelte';

  type Screen =
    | { kind: 'start' }
    | { kind: 'dial'; store: GameStore }
    | { kind: 'ultra'; store: UltraGameStore };

  let screen = $state<Screen>({ kind: 'start' });
</script>

{#if screen.kind === 'dial'}
  <ManipulationScreen store={screen.store} onExit={() => (screen = { kind: 'start' })} />
{:else if screen.kind === 'ultra'}
  <UltraScreen store={screen.store} onExit={() => (screen = { kind: 'start' })} />
{:else}
  <StartScreen
    onStart={(s) => (screen = { kind: 'dial', store: s })}
    onStartUltra={(s) => (screen = { kind: 'ultra', store: s })}
  />
{/if}
