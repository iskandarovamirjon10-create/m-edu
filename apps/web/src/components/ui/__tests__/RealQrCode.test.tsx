import { render, screen } from '@testing-library/react';
import { RealQrCode } from '../RealQrCode';
import { describe, it, expect } from 'vitest';

describe('RealQrCode', () => {
  it('renders a valid SVG element with path matrix for a valid URL', () => {
    const { container } = render(
      <RealQrCode
        value="https://m-edu.uz/verify/MEDU12345678"
        title="Verification QR"
        level="M"
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Verification QR');

    // Matrix path
    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')).toContain('M');
  });

  it('renders fallback placeholder if value is empty', () => {
    render(<RealQrCode value="" />);

    expect(screen.getByLabelText('QR kod yaratilmadi')).toBeInTheDocument();
    expect(screen.getByText('QR')).toBeInTheDocument();
  });

  it('supports custom fgColor and bgColor', () => {
    const { container } = render(
      <RealQrCode
        value="https://m-edu.uz"
        fgColor="#1E3A8A"
        bgColor="#F8FAFC"
      />
    );

    const rect = container.querySelector('rect');
    expect(rect).toHaveAttribute('fill', '#F8FAFC');

    const path = container.querySelector('path');
    expect(path).toHaveAttribute('fill', '#1E3A8A');
  });
});
