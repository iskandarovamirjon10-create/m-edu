import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { usePageTitle } from '../usePageTitle';

function Probe({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}

describe('usePageTitle', () => {
  it('sets the document title with the M-EDU suffix', () => {
    render(<Probe title="Students" />);
    expect(document.title).toBe('Students — M-EDU');
  });

  it('falls back to the bare brand when no title is provided', () => {
    render(<Probe title="" />);
    expect(document.title).toBe('M-EDU');
  });

  it('restores the previous title on unmount', () => {
    document.title = 'Previous — M-EDU';
    const { unmount } = render(<Probe title="Payments" />);
    expect(document.title).toBe('Payments — M-EDU');
    act(() => unmount());
    expect(document.title).toBe('Previous — M-EDU');
  });
});
