'use client';

import * as React from 'react';
import QRCode from 'qrcode';

export interface RealQrCodeProps extends React.SVGProps<SVGSVGElement> {
  /** The real value to encode (URL, token, identifier, vCard, etc.) */
  value: string;
  /** Quiet zone margin in modules (default: 2) */
  margin?: number;
  /** Foreground module color (default: #000000) */
  fgColor?: string;
  /** Background color (default: #FFFFFF) */
  bgColor?: string;
  /** Error correction level: L (7%), M (15%), Q (25%), H (30%). Default: 'M' */
  level?: 'L' | 'M' | 'Q' | 'H';
  /** Optional accessible title / label */
  title?: string;
}

/**
 * Standard ISO/IEC 18004 compliant real QR code SVG component.
 * Produces crisp, vector-sharp, camera-scannable QR matrices.
 */
export function RealQrCode({
  value,
  margin = 2,
  fgColor = '#000000',
  bgColor = '#FFFFFF',
  level = 'M',
  title = 'Real Scannable QR Code',
  className = '',
  ...svgProps
}: RealQrCodeProps) {
  const qrData = React.useMemo(() => {
    if (!value || typeof value !== 'string') return null;
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: level });
      const size = qr.modules.size;
      let d = '';
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (qr.modules.get(x, y)) {
            d += `M${x},${y}h1v1h-1z `;
          }
        }
      }
      return { d, size };
    } catch (err) {
      console.error('[RealQrCode] Failed to compute QR matrix:', err);
      return null;
    }
  }, [value, level]);

  if (!qrData) {
    return (
      <div
        className={`grid place-items-center rounded-lg bg-slate-100 text-[10px] font-medium text-slate-400 dark:bg-slate-800 ${className}`}
        aria-label="QR kod yaratilmadi"
      >
        QR
      </div>
    );
  }

  const totalSize = qrData.size + margin * 2;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
      className={className}
      {...svgProps}
    >
      <title>{title}</title>
      {bgColor !== 'transparent' && (
        <rect width={totalSize} height={totalSize} fill={bgColor} rx={margin > 0 ? 1 : 0} />
      )}
      <g transform={`translate(${margin}, ${margin})`}>
        <path d={qrData.d} fill={fgColor} />
      </g>
    </svg>
  );
}

export default RealQrCode;
