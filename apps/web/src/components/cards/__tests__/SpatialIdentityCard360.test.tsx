import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpatialIdentityCard360 } from '../SpatialIdentityCard360';
import { RealQrCode } from '../../ui/RealQrCode';

describe('RealQrCode component', () => {
  it('renders standard ISO/IEC 18004 SVG matrix with correct path data', () => {
    const { container } = render(
      <RealQrCode value="https://m-edu.uz/verify/ST-12345" title="Student QR Pass" />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Student QR Pass');

    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    const d = path?.getAttribute('d');
    expect(d).toContain('M');
    expect(d).toContain('h1v1h-1z');
  });

  it('handles custom fgColor and bgColor properly', () => {
    const { container } = render(
      <RealQrCode
        value="TEST_CODE"
        fgColor="#0F172A"
        bgColor="#FFFFFF"
        margin={1}
      />
    );
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('#FFFFFF');
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#0F172A');
  });
});

describe('SpatialIdentityCard360 Real QR integration', () => {
  it('renders real scannable QR code tile on back face by default', () => {
    render(
      <SpatialIdentityCard360
        data={{
          id: 'std-test-999',
          codeOrId: 'ST-999',
          fullName: 'Amirjon Aliyev',
          role: 'STUDENT',
          attendanceRate: 98,
          gpaOrMastery: 4.8,
          phone: '+998901234567',
          email: 'amirjon@example.com',
        }}
      />
    );

    // Verify name and ID display
    expect(screen.getAllByText('Amirjon Aliyev').length).toBeGreaterThanOrEqual(1);

    // Verify QR tile is present with real QR SVG
    const qrSvg = screen.getByLabelText(/Raqamli identifikator: ST-999|Haqiqiy raqamli QR pass/i);
    expect(qrSvg).toBeTruthy();
    expect(qrSvg.tagName.toLowerCase()).toBe('svg');

    const qrPath = qrSvg.querySelector('path');
    expect(qrPath?.getAttribute('d')).toContain('h1v1h-1z');
  });

  it('honors custom qrValue if supplied', () => {
    render(
      <SpatialIdentityCard360
        data={{
          id: 'usr-100',
          fullName: 'Teacher Karim',
          role: 'TEACHER',
        }}
        qrValue="https://m-edu.uz/verify/custom-teacher-link"
      />
    );

    const qrTile = document.querySelector('[title="Skanerlash havolasi: https://m-edu.uz/verify/custom-teacher-link"]');
    expect(qrTile).toBeTruthy();
  });
});
