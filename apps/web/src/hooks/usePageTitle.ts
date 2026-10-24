import { useEffect } from 'react';

/**
 * Set the browser tab title for the current page, e.g.
 *   usePageTitle('Students');
 * renders as "Students — M-EDU" and syncs with DocumentTitleManager.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const previousTitle = document.title;
    document.title = title ? `${title} — M-EDU` : 'M-EDU';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medu:set-title', { detail: title }));
    }
    return () => {
      document.title = previousTitle;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('medu:set-title', { detail: null }));
      }
    };
  }, [title]);
}

export default usePageTitle;
