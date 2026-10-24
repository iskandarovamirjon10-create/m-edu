import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { ROUTE_TITLES } from './index';

const APP_NAME = 'M-EDU';

export function DocumentTitleManager() {
  const location = useLocation();
  const { t, locale } = useSafeI18n();
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Sahifalar tomonidan yuboriladigan maxsus sarlavhalar va bildirishnomalarni tinglaymiz
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCustomTitle = (e: Event) => {
      const title = (e as CustomEvent<string | null>).detail;
      setCustomTitle(title || null);
    };

    const handleUnreadCount = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      setUnreadCount(typeof count === 'number' && count > 0 ? count : 0);
    };

    window.addEventListener('medu:set-title', handleCustomTitle);
    window.addEventListener('medu:unread-count', handleUnreadCount);

    return () => {
      window.removeEventListener('medu:set-title', handleCustomTitle);
      window.removeEventListener('medu:unread-count', handleUnreadCount);
    };
  }, []);

  // Yangi sahifaga o'tilganda maxsus sarlavhani tozalaymiz
  useEffect(() => {
    setCustomTitle(null);
  }, [location.pathname]);

  // Tab sarlavhasini sinxronlashtirish
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let baseTitle = '';

    if (customTitle) {
      baseTitle = customTitle;
    } else {
      const match = ROUTE_TITLES.find((r) => r.pattern.test(location.pathname));
      if (match) {
        if (match.titleKey) {
          const translated = t(match.titleKey);
          baseTitle = translated === match.titleKey ? match.title : translated;
        } else {
          baseTitle = match.title;
        }
      }
    }

    const titlePrefix = unreadCount > 0 ? `(${unreadCount}) ` : '';
    const formattedTitle = baseTitle ? `${baseTitle} — ${APP_NAME}` : APP_NAME;

    document.title = `${titlePrefix}${formattedTitle}`;
  }, [location.pathname, customTitle, unreadCount, t, locale]);

  return null;
}

export default DocumentTitleManager;
