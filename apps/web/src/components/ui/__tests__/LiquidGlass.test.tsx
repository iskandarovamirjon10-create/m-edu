/**
 * Liquid Glass & Design System Regression Tests
 * Verifies that GlassCard, GlassSurface, and Liquid Glass tokens/classes render
 * with proper accessibility, variants, elevations, and backward compatibility.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlassCard } from '../GlassCard';
import { GlassSurface } from '../Glass';

vi.mock('@/lib/design', () => ({
  cn: (...classes: (string | undefined | null | false)[]) =>
    classes.filter(Boolean).join(' '),
  usePrefersReducedMotion: () => false,
}));

describe('GlassCard Component (iOS 27 Liquid Glass V2)', () => {
  it('renders children with default liquid glass classes', () => {
    render(<GlassCard data-testid="test-card">Test Content</GlassCard>);
    const card = screen.getByTestId('test-card');
    expect(card).toBeDefined();
    expect(card.textContent).toBe('Test Content');
    expect(card.className).toContain('backdrop-blur-xl');
    expect(card.className).toContain('rounded-2xl');
  });

  it('renders elevated variant with deeper blur and shadow', () => {
    render(
      <GlassCard variant="elevated" data-testid="elevated-card">
        Elevated
      </GlassCard>,
    );
    const card = screen.getByTestId('elevated-card');
    expect(card.className).toContain('backdrop-blur-2xl');
    expect(card.className).toContain('shadow-card-elevated');
  });

  it('renders interactive variant with hover and active physics', () => {
    render(
      <GlassCard interactive data-testid="interactive-card">
        Clickable
      </GlassCard>,
    );
    const card = screen.getByTestId('interactive-card');
    expect(card.className).toContain('cursor-pointer');
    expect(card.className).toContain('active:scale-[0.985]');
  });

  it('applies custom padding sizes properly', () => {
    const { rerender } = render(
      <GlassCard padding="none" data-testid="padded-card">
        No Padding
      </GlassCard>,
    );
    let card = screen.getByTestId('padded-card');
    expect(card.className).not.toContain('p-5');

    rerender(
      <GlassCard padding="lg" data-testid="padded-card">
        Large Padding
      </GlassCard>,
    );
    card = screen.getByTestId('padded-card');
    expect(card.className).toContain('p-6');
  });
});

describe('GlassSurface Component (Tier & Elevation Architecture)', () => {
  it('renders with default mid elevation and light tone', () => {
    render(<GlassSurface data-testid="glass-surface">Surface Body</GlassSurface>);
    const surface = screen.getByTestId('glass-surface');
    expect(surface).toBeDefined();
    expect(surface.textContent).toBe('Surface Body');
    expect(surface.className).toContain('backdrop-blur-xl');
  });

  it('renders floating elevation for modal and copilot panels', () => {
    render(
      <GlassSurface elevation="floating" data-testid="floating-surface">
        Floating Panel
      </GlassSurface>,
    );
    const surface = screen.getByTestId('floating-surface');
    expect(surface.className).toContain('shadow-[0_24px_56px');
  });

  it('handles keyboard interaction when onClick is passed', () => {
    const handleClick = vi.fn();
    render(
      <GlassSurface onClick={handleClick} data-testid="clickable-surface">
        Interactive Surface
      </GlassSurface>,
    );
    const surface = screen.getByTestId('clickable-surface');
    fireEvent.keyDown(surface, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(surface, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
