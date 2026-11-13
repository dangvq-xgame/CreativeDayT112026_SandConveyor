import { ColorPaletteItem, LevelData } from '../types/level.types';
import { ColorManager } from './ColorManager';

class AssetLoaderImpl {
  private levels = new Map<number, LevelData>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const paletteRes = await fetch('./assets/data/palette.json');
    if (paletteRes.ok) {
      const palette: ColorPaletteItem[] = await paletteRes.json();
      ColorManager.setPalette(palette);
    }

    for (let i = 1; i <= 5; i++) {
      const padded = String(i).padStart(3, '0');
      const res = await fetch(`./assets/data/levels/level-${padded}.json`);
      if (res.ok) {
        const lv: LevelData = await res.json();
        this.levels.set(lv.levelId, lv);
      }
    }
    this.initialized = true;
  }

  getLevel(levelId: number): LevelData {
    const normalized = ((levelId - 1) % 5) + 1;
    const found = this.levels.get(normalized);
    if (!found) {
      throw new Error(`Level ${normalized} not loaded`);
    }
    return structuredClone(found);
  }

  getAllLevels(): LevelData[] {
    return Array.from(this.levels.values()).sort((a, b) => a.levelId - b.levelId);
  }
}

export const AssetLoader = new AssetLoaderImpl();

