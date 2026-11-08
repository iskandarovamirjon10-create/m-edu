import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlassButton } from '../GlassButton';

describe('GlassButton (Apple Liquid Glass)', () => {
  it('renders icon button correctly with size="icon" and children SVG', () => {
    const { container } = render(
      <GlassButton
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Buyruq paneli"
        className="h-10 w-10 min-w-[2.5rem] p-0"
      >
        <svg data-testid="test-icon" width="16" height="16" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </GlassButton>,
    );

    const icon = screen.getByTestId('test-icon');
    expect(icon).toBeInTheDocument();

    // Verify it is inside data-btn-icon and not truncated inside data-btn-label
    const iconContainer = container.querySelector('[data-btn-icon]');
    expect(iconContainer).not.toBeNull();
    expect(iconContainer).toContainElement(icon);

    const labelContainer = container.querySelector('[data-btn-label]');
    expect(labelContainer).toBeNull();
  });

  it('renders text and label when size="md"', () => {
    const { container } = render(
      <GlassButton type="button" variant="primary">
        O'quvchi qo'shish
      </GlassButton>,
    );

    expect(screen.getByText("O'quvchi qo'shish")).toBeInTheDocument();
    const labelContainer = container.querySelector('[data-btn-label]');
    expect(labelContainer).not.toBeNull();
  });
});
