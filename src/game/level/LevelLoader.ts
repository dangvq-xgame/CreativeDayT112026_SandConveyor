import { AssetLoader } from '../../core/AssetLoader';
import { LevelData } from '../../types/level.types';
import { LevelValidator } from './LevelValidator';

export class LevelLoader {
  static loadLevel(levelId: number): LevelData {
    const data = AssetLoader.getLevel(levelId);
    const check = LevelValidator.validate(data);
    if (!check.valid) {
      console.warn(`Level ${levelId} validation warnings:`, check.errors);
    }
    return data;
  }
}

