import { AssetLoader } from '../../core/AssetLoader';
import { ColorManager } from '../../core/ColorManager';
import { LevelData } from '../../types/level.types';
import { LevelValidator } from './LevelValidator';
import { normalizeLevelData } from './normalizeLevel';

export class LevelLoader {
  private static readonly warnedLevels = new Set<number>();

  /**
   * Fetches a level from the {@link AssetLoader} (ids loop over the level count), fills defaults and
   * validates it. Validation problems are logged once per level but never block play.
   */
  static loadLevel(levelId: number): LevelData {
    const data = normalizeLevelData(AssetLoader.getLevel(levelId));
    const check = LevelValidator.validate(data, { knownColorIds: ColorManager.getColorIds() });
    if (!check.valid && !LevelLoader.warnedLevels.has(data.levelId)) {
      LevelLoader.warnedLevels.add(data.levelId);
      console.warn(`Level ${data.levelId} validation warnings:`, check.errors);
    }
    return data;
  }
}
