import { describe, expect, it, vi } from 'vitest';
import { ColorManagerImpl, DEFAULT_PALETTE, UNKNOWN_COLOR_HEX } from '../../src/core/ColorManager';
import { I18nImpl } from '../../src/core/I18n';
import en from '../../src/i18n/en.json';
import vi_ from '../../src/i18n/vi.json';

describe('ColorManager', () => {
  it('returns palette entries for known colorIds', () => {
    const cm = new ColorManagerImpl();
    expect(cm.getColor(5).name).toBe('Vibrant Orange');
    expect(cm.hasColor(12)).toBe(true);
    expect(cm.getColorIds()).toEqual(DEFAULT_PALETTE.map((p) => p.colorId));
  });

  it('falls back to a neutral gray for unknown colorIds (regression: looked exactly like color 1)', () => {
    const cm = new ColorManagerImpl();
    const unknown = cm.getColor(99);
    expect(unknown.colorId).toBe(99);
    expect(unknown.bodyHex).toBe(UNKNOWN_COLOR_HEX.bodyHex);
    expect(unknown.bodyHex).not.toBe(cm.getColor(1).bodyHex);
    expect(cm.getColor(99)).toBe(unknown); // cached, no per-frame allocation
    expect(cm.hasColor(99)).toBe(false);
  });

  it('skips invalid palette entries and keeps the current palette if nothing is valid', () => {
    const cm = new ColorManagerImpl();
    expect(cm.setPalette([])).toBe(0);
    expect(cm.setPalette([{ colorId: 'x' }, null, 42])).toBe(0);
    expect(cm.hasColor(1)).toBe(true);

    const accepted = cm.setPalette([
      { colorId: 1, name: 'A', bodyHex: '#000000', shadowHex: '#111111', handleHex: '#222222', sandHex: '#333' },
      { colorId: 2, name: 'B', bodyHex: 'nope', shadowHex: '#111111', handleHex: '#222222', sandHex: '#333333' }
    ]);
    expect(accepted).toBe(1);
    expect(cm.getColor(1).bodyHex).toBe('#000000');
    expect(cm.hasColor(2)).toBe(false);
  });

  it('parses 6- and 3-digit hex and rejects garbage', () => {
    const cm = new ColorManagerImpl();
    expect(cm.hexToNumber('#3898FF')).toBe(0x3898ff);
    expect(cm.hexToNumber('3898ff')).toBe(0x3898ff);
    expect(cm.hexToNumber('#fff')).toBe(0xffffff);
    expect(cm.hexToNumber('#zzzzzz')).toBe(0);
    expect(cm.hexToRgb('#102030')).toEqual([16, 32, 48]);
  });

  it('mixHex blends and clamps the ratio (regression: ratio > 1 produced invalid hex)', () => {
    const cm = new ColorManagerImpl();
    expect(cm.mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(cm.mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(cm.mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(cm.mixHex('#000000', '#ffffff', 3)).toBe('#ffffff');
    expect(cm.mixHex('#000000', '#ffffff', -1)).toBe('#000000');
    expect(cm.mixNumber('#000000', '#ffffff', 1)).toBe(0xffffff);
    // memoized result is stable
    expect(cm.mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('I18n', () => {
  it('translates in the current language', () => {
    const i18n = new I18nImpl('en');
    expect(i18n.t('next_level')).toBe(en.next_level);
    i18n.setLanguage('vi');
    expect(i18n.t('next_level')).toBe(vi_.next_level);
  });

  it('falls back to the default language, then to the key (regression: en missing key returned the key)', () => {
    const i18n = new I18nImpl('en', { vi: { only_vi: 'Chỉ VI' }, en: {} });
    expect(i18n.t('only_vi')).toBe('Chỉ VI');
    expect(i18n.t('missing.key')).toBe('missing.key');
    expect(i18n.has('only_vi')).toBe(true);
    expect(i18n.has('missing.key')).toBe(false);
  });

  it('interpolates {placeholders} and leaves unknown ones untouched', () => {
    const i18n = new I18nImpl('en', { vi: {}, en: { lvl: 'Level {n} of {total} {x}' } });
    expect(i18n.t('lvl', { n: 2, total: 5 })).toBe('Level 2 of 5 {x}');
  });

  it('ignores unsupported languages and notifies changes', () => {
    const i18n = new I18nImpl('vi');
    const cb = vi.fn();
    const off = i18n.onChange(cb);
    i18n.setLanguage('fr' as never);
    expect(i18n.getLanguage()).toBe('vi');
    i18n.setLanguage('en');
    i18n.setLanguage('en');
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    i18n.setLanguage('vi');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(new I18nImpl('xx' as never).getLanguage()).toBe('vi');
  });
});
