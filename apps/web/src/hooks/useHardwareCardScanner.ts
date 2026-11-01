/**
 * M-EDU Hardware Card Scanner Hook (`useHardwareCardScanner.ts`)
 *
 * Professional hardware scanner listener for Kiosks and Turnstiles:
 * 1. USB HID RFID Reader (125kHz EM-Marine, 13.56MHz Mifare keyboard emulators)
 * 2. 1D/2D Barcode & QR Laser Scanners
 * 3. Mobile WebNFC (NDEFReader) for Android tablet direct card taps
 *
 * Algorithms:
 * - Inter-keystroke time threshold (< 45ms per character) distinguishes hardware scanners from human typing.
 * - End-of-transmission carriage return (Enter key) triggers validation and extraction.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

export interface UseHardwareCardScannerOptions {
  enabled?: boolean;
  onScan: (code: string) => void | Promise<void>;
  minCodeLength?: number;
}

export function useHardwareCardScanner({
  enabled = true,
  onScan,
  minCodeLength = 4,
}: UseHardwareCardScannerOptions) {
  const { playPop, playPayment } = usePremiumSound();
  const haptics = useHaptics();

  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isNfcActive, setIsNfcActive] = useState(false);
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const isBusyRef = useRef<boolean>(false);

  // 1. USB HID / Laser Scanner Keystroke Interceptor
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if an editable input/textarea is actively focused by user,
      // EXCEPT when the keystrokes are coming in at superhuman scanner speed (< 35ms)
      const target = event.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key marks end of barcode transmission
      if (event.key === 'Enter') {
        const rawCode = bufferRef.current.trim();
        bufferRef.current = '';

        if (rawCode.length >= minCodeLength) {
          event.preventDefault();
          event.stopPropagation();

          if (!isBusyRef.current) {
            isBusyRef.current = true;
            setLastScannedCode(rawCode);
            playPop();
            haptics.medium();

            Promise.resolve(onScan(rawCode)).finally(() => {
              isBusyRef.current = false;
            });
          }
        }
        return;
      }

      // If characters are typed slower than 50ms, it's human typing — reset buffer
      if (elapsed > 50 && bufferRef.current.length > 0) {
        // If user is in an input, don't clear human input
        if (!isInput) {
          bufferRef.current = '';
        }
      }

      // Append printable single character
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // If human is typing in an input with normal delays (> 50ms), ignore
        if (isInput && elapsed > 45 && bufferRef.current.length === 0) {
          return;
        }

        bufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, minCodeLength, onScan, playPop, haptics]);

  // 2. WebNFC (NDEFReader) for Android Tablet Kiosks
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('NDEFReader' in window)) return;

    let ndef: any = null;
    let abortController: AbortController | null = null;

    async function startNfc(): Promise<void> {
      try {
        const NDEF = (window as any).NDEFReader;
        ndef = new NDEF();
        abortController = new AbortController();
        await ndef.scan({ signal: abortController.signal });
        setIsNfcActive(true);

        ndef.onreading = (event: any) => {
          const serialNumber = event.serialNumber;
          if (serialNumber && !isBusyRef.current) {
            isBusyRef.current = true;
            setLastScannedCode(serialNumber);
            playPayment();
            haptics.heavy();

            Promise.resolve(onScan(serialNumber)).finally(() => {
              isBusyRef.current = false;
            });
          }
        };

        ndef.onreadingerror = () => {
          // Soft read error, keep scanning
        };
      } catch {
        setIsNfcActive(false);
      }
    }

    void startNfc();

    return () => {
      abortController?.abort();
      setIsNfcActive(false);
    };
  }, [enabled, onScan, playPayment, haptics]);

  const clearLastScan = useCallback(() => {
    setLastScannedCode(null);
  }, []);

  return {
    lastScannedCode,
    isNfcActive,
    clearLastScan,
  };
}
