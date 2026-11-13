import { AssetLoader } from './core/AssetLoader';
import { SaveManager } from './core/SaveManager';
import { GameScene } from './scenes/GameScene';

async function bootstrap(): Promise<void> {
  await AssetLoader.init();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const stage = document.getElementById('stage') as HTMLElement;
  const scene = new GameScene(canvas, stage);

  const initialLevel = SaveManager.getData().currentLevel || 1;
  scene.startLevel(initialLevel);

  new ResizeObserver(() => {
    scene.recalculateLayout();
  }).observe(stage);

  let lastTime = performance.now();
  function loop(now: number): void {
    requestAnimationFrame(loop);
    const dtSec = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    scene.update(now, dtSec);
    scene.render(now);
  }

  requestAnimationFrame(loop);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap Sand Conveyor:', err);
});

