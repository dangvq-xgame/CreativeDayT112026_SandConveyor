import vi from '../i18n/vi.json';
import en from '../i18n/en.json';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../config/constants';
import { LanguageCode } from '../types/level.types';
import { SaveManager } from './SaveManager';

/** Keys of the reference (Vietnamese) dictionary. */
export type I18nKey = keyof typeof vi;
/** Values for `{placeholder}` interpolation. */
export type I18nParams = Record<string, string | number>;

type Dict = Partial<Record<string, string>>;

/** Every language may be incomplete: missing keys fall back to the default language, then to the key. */
const BUILTIN_DICTS: Record<LanguageCode, Dict> = { vi, en };

function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Tiny i18n: `t(key, params?)` with fallback chain current language → default language → key,
 * and `{name}` placeholder interpolation.
 */
export class I18nImpl {
  private lang: LanguageCode;
  private readonly listeners = new Set<(lang: LanguageCode) => void>();

  constructor(
    initialLanguage: LanguageCode = DEFAULT_LANGUAGE,
    private readonly dicts: Record<LanguageCode, Dict> = BUILTIN_DICTS
  ) {
    this.lang = isLanguage(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE;
  }

  /** Switches language (unknown codes are ignored). Persisting it is up to the caller (SaveManager). */
  setLanguage(lang: LanguageCode): void {
    if (!isLanguage(lang) || lang === this.lang) return;
    this.lang = lang;
    for (const cb of [...this.listeners]) cb(lang);
  }

  getLanguage(): LanguageCode {
    return this.lang;
  }

  /** Subscribes to language changes; returns an unsubscribe function. */
  onChange(cb: (lang: LanguageCode) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** `true` if `key` exists in the current or default dictionary. */
  has(key: string): boolean {
    return this.lookup(key) !== undefined;
  }

  /** Translates `key`; unknown keys return the key itself. `{name}` is replaced by `params.name`. */
  t(key: I18nKey | (string & {}), params?: I18nParams): string {
    const text = this.lookup(key) ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
  }

  private lookup(key: string): string | undefined {
    return this.dicts[this.lang]?.[key] ?? this.dicts[DEFAULT_LANGUAGE]?.[key];
  }
}

/** Global i18n singleton, starting in the saved language (`settings.language`). */
export const I18n = new I18nImpl(SaveManager.getSettings().language);
