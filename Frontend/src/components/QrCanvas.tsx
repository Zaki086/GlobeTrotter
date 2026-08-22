import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QrCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a genuinely scannable QR code onto a canvas.
 *
 * Always drawn in black-on-white regardless of theme — inverted QR codes are
 * unreliable with many scanners, so the caller places this on a white plate.
 */
export function QrCanvas({ value, size = 200, className }: QrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    let cancelled = false;

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    })
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <p className="text-center text-xs text-destructive" role="alert">
        Could not render the QR code.
      </p>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={size}
      height={size}
      role="img"
      aria-label={`QR code linking to ${value}`}
    />
  );
}
