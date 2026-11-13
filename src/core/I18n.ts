import vi from '../i18n/vi.json';
import en from '../i18n/en.json';

type Dict = typeof vi;
const dicts: Record<'vi' | 'en', Dict> = { vi, en };

class I18nImpl {
  private lang: 'vi' | 'en' = 'vi';

  setLanguage(lang: 'vi' | 'en'): void {
    this.lang = lang;
  }

  getLanguage(): 'vi' | 'en' {
    return this.lang;
  }

  t(key: keyof Dict): string {
    return dicts[this.lang][key] ?? key;
  }
}

export const I18n = new I18nImpl();

