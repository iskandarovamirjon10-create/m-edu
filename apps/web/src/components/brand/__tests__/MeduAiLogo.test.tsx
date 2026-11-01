import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MeduAiLogo } from '../MeduAiLogo';

describe('MeduAiLogo Suite', () => {
  it('renders official AI logo image with proper attributes', () => {
    render(<MeduAiLogo size="md" alt="M-EDU AI" />);

    const img = screen.getByRole('img', { name: /M-EDU AI/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('medu-ai-logo.png'));
  });

  it('renders ambient glow element when glow=true', () => {
    const { container } = render(<MeduAiLogo size="lg" glow />);

    // Glow span is aria-hidden
    const glowSpan = container.querySelector('.blur-md');
    expect(glowSpan).toBeInTheDocument();
  });

  it('falls back to celestial 4-pointed SVG sparkle star when image fails to load', () => {
    const { container } = render(<MeduAiLogo size="sm" alt="M-EDU AI" />);

    const img = screen.getByRole('img', { name: /M-EDU AI/i });
    // Trigger image error
    fireEvent.error(img);

    // Image is replaced by SVG sparkle star
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
  });
});
