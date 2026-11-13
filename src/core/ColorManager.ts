import { ColorId, ColorPaletteItem } from '../types/level.types';

const DEFAULT_PALETTE: ColorPaletteItem[] = [
  { colorId: 1, name: 'Sky Blue', bodyHex: '#3898FF', shadowHex: '#0058C4', handleHex: '#003980', sandHex: '#2C7BDB' },
  { colorId: 2, name: 'Royal Blue', bodyHex: '#2D4AB0', shadowHex: '#14249E', handleHex: '#0A1766', sandHex: '#2D4AC4' },
  { colorId: 3, name: 'Charcoal Black', bodyHex: '#3A3A42', shadowHex: '#202026', handleHex: '#141418', sandHex: '#2E2E32' },
  { colorId: 4, name: 'Leaf Green', bodyHex: '#3FAC1D', shadowHex: '#28840B', handleHex: '#155602', sandHex: '#499431' },
  { colorId: 5, name: 'Vibrant Orange', bodyHex: '#FF7A29', shadowHex: '#C44B00', handleHex: '#803100', sandHex: '#F06E22' },
  { colorId: 6, name: 'Candy Pink', bodyHex: '#FF66B5', shadowHex: '#C73882', handleHex: '#851D52', sandHex: '#F27BB8' },
  { colorId: 7, name: 'Royal Violet', bodyHex: '#8A4FFF', shadowHex: '#5411AD', handleHex: '#320570', sandHex: '#9662F0' },
  { colorId: 8, name: 'Ruby Red', bodyHex: '#F0524F', shadowHex: '#B52422', handleHex: '#75100E', sandHex: '#E03E3B' },
  { colorId: 9, name: 'Aqua Cyan', bodyHex: '#36C5F0', shadowHex: '#1880A0', handleHex: '#0A5168', sandHex: '#45C4E6' },
  { colorId: 10, name: 'Sunny Gold', bodyHex: '#FFD13B', shadowHex: '#C99610', handleHex: '#825E04', sandHex: '#F7C843' },
  { colorId: 11, name: 'Cream White', bodyHex: '#F5EFE0', shadowHex: '#B8AE99', handleHex: '#807764', sandHex: '#FFFFFF' },
  { colorId: 12, name: 'Lime Meadow', bodyHex: '#A8E028', shadowHex: '#78A810', handleHex: '#4E7006', sandHex: '#9BE01E' }
];

class ColorManagerImpl {
  private map = new Map<ColorId, ColorPaletteItem>();

  constructor() {
    this.setPalette(DEFAULT_PALETTE);
  }

  setPalette(items: ColorPaletteItem[]): void {
    this.map.clear();
    for (const item of items) {
      this.map.set(item.colorId, item);
    }
  }

  getColor(colorId: ColorId): ColorPaletteItem {
    return (
      this.map.get(colorId) ?? {
        colorId,
        name: `Color ${colorId}`,
        bodyHex: '#3898FF',
        shadowHex: '#0058C4',
        handleHex: '#003980',
        sandHex: '#3898FF'
      }
    );
  }

  hasColor(colorId: ColorId): boolean {
    return this.map.has(colorId);
  }

  hexToNumber(hex: string): number {
    const clean = hex.replace('#', '');
    return parseInt(clean, 16);
  }

  hexToRgb(hex: string): [number, number, number] {
    const n = this.hexToNumber(hex);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  mixHex(hexA: string, hexB: string, ratio: number): string {
    const a = this.hexToRgb(hexA);
    const b = this.hexToRgb(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * ratio);
    const g = Math.round(a[1] + (b[1] - a[1]) * ratio);
    const bl = Math.round(a[2] + (b[2] - a[2]) * ratio);
    return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
  }

  mixNumber(hexA: string, hexB: string, ratio: number): number {
    return this.hexToNumber(this.mixHex(hexA, hexB, ratio));
  }
}

export const ColorManager = new ColorManagerImpl();

