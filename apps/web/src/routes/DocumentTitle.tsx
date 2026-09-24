import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n/I18nProvider';
import { ROUTE_TITLES } from './index';

export function DocumentTitleManager() {
  const location = useLocation();
  const { t, locale } = useI18n();

  useEffect(() => {
    const match = ROUTE_TITLES.find((r) => r.pattern.test(location.pathname));
    let title = '';
    if (match) {
      if (match.titleKey) {
        const translated = t(match.titleKey);
        title = translated === match.titleKey ? match.title : translated;
      } else {
        title = match.title;
      }
    }
    document.title = title ? `${title} — M-EDU` : 'M-EDU';
  }, [location.pathname, t, locale]);

  return null;
}
