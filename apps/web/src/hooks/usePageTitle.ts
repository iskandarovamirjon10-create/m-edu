import { useEffect } from 'react';

/**
 * Set the browser tab title for the current page, e.g.
 *   usePageTitle('Students');
 * renders as "Students — M-EDU".
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — M-EDU` : 'M-EDU';
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default usePageTitle;
