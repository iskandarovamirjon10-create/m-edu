/**
 * Executive Confetti & Glass Chime — Ultra-Luxury Celebration Engine
 *
 * Designed for high-prestige moments (Tuition payments, graduations, achievements):
 *  - 24k Gold leaf flakes (#FFD700, #F59E0B, #FBBF24, #D97706)
 *  - Royal Sapphire and Emerald glints (#38BDF8, #34D399, #A855F7)
 *  - Multi-dimensional physics: air resistance, gravity, 3D tumbling (roll, pitch, yaw)
 *  - Sparkling diamond shimmer glints with specular highlights
 *  - Zero external dependencies, automatic canvas cleanup, mobile GPU-friendly
 */

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  shape: 'rect' | 'ribbon' | 'sparkle' | 'circle';
  opacity: number;
  scaleY: number;
  decay: number;
}

const LUXURY_PALETTE = [
  '#FFD700', // 24K Pure Gold
  '#F59E0B', // Warm Amber Gold
  '#FBBF24', // Sunlit Gold
  '#FDE68A', // Pale Shimmer Gold
  '#38BDF8', // Cyan Sapphire
  '#60A5FA', // Apple Blue
  '#34D399', // Emerald Mint
  '#C084FC', // Amethyst Violet
  '#FFFFFF', // Diamond Specular
];

/**
 * Procedural Web Audio API Crystal Glass Chime
 * Harmonic C-Major 9th chord with diamond sparkle decay
 */
export function playExecutiveGlassChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 1046.5, delay: 0.0, vol: 0.08, dur: 0.45 }, // C6
      { freq: 1318.5, delay: 0.04, vol: 0.09, dur: 0.55 }, // E6
      { freq: 1567.98, delay: 0.08, vol: 0.1, dur: 0.65 }, // G6
      { freq: 1975.53, delay: 0.12, vol: 0.11, dur: 0.8 }, // B6
      { freq: 2093.0, delay: 0.16, vol: 0.12, dur: 1.1 }, // C7 (High crystalline ringing)
      { freq: 4186.01, delay: 0.18, vol: 0.03, dur: 0.3 }, // C8 (Diamond sparkle overtone)
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(n.freq, now + n.delay);
      filter.Q.setValueAtTime(4.0, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(n.vol, now + n.delay + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.05);

      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {
          // Cleaned
        }
      };
    });

    // Cleanup audio context after notes settle
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch {
    // Non-blocking fallback
  }

  // Tactile haptic pulse on mobile devices
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([15, 40, 20, 60]);
    }
  } catch {
    // Optional
  }
}

/**
 * Fires luxury physics confetti on screen
 */
export function fireExecutiveConfetti(options?: {
  originX?: number; // 0..1
  originY?: number; // 0..1
  particleCount?: number;
  playSound?: boolean;
}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (options?.playSound !== false) {
    playExecutiveGlassChime();
  }

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const rawCtx = canvas.getContext('2d');
  if (!rawCtx) {
    document.body.removeChild(canvas);
    return;
  }
  const ctx: CanvasRenderingContext2D = rawCtx;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = (canvas.width = window.innerWidth * dpr);
  let height = (canvas.height = window.innerHeight * dpr);

  const onResize = () => {
    width = canvas.width = window.innerWidth * dpr;
    height = canvas.height = window.innerHeight * dpr;
  };
  window.addEventListener('resize', onResize, { passive: true });

  const originX = (options?.originX ?? 0.5) * width;
  const originY = (options?.originY ?? 0.65) * height;
  const count = options?.particleCount ?? 80;

  const particles: ConfettiParticle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * 0.9 + 0.05) * Math.PI; // Upward fan arc (30° to 150°)
    const speed = (Math.random() * 18 + 12) * dpr;
    const color = LUXURY_PALETTE[Math.floor(Math.random() * LUXURY_PALETTE.length)];
    const shapeRand = Math.random();
    const shape: ConfettiParticle['shape'] =
      shapeRand < 0.45 ? 'rect' : shapeRand < 0.75 ? 'ribbon' : shapeRand < 0.9 ? 'sparkle' : 'circle';

    particles.push({
      x: originX,
      y: originY,
      vx: -Math.cos(angle) * speed + (Math.random() - 0.5) * 6 * dpr,
      vy: -Math.sin(angle) * speed - Math.random() * 6 * dpr,
      width: (shape === 'ribbon' ? Math.random() * 6 + 14 : Math.random() * 8 + 8) * dpr,
      height: (shape === 'ribbon' ? Math.random() * 3 + 4 : Math.random() * 8 + 8) * dpr,
      color,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.random() * 0.12 + 0.05,
      shape,
      opacity: 1,
      scaleY: 1,
      decay: Math.random() * 0.005 + 0.008,
    });
  }

  let animationFrame = 0;
  let startTime = performance.now();

  function render(currentTime: number) {
    const elapsed = currentTime - startTime;
    ctx.clearRect(0, 0, width, height);

    let activeParticles = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.opacity <= 0.01) continue;
      activeParticles++;

      // Physical dynamics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.42 * dpr; // Gravity
      p.vx *= 0.985; // Air drag
      p.vy *= 0.985;
      p.rotation += p.rotationSpeed;
      p.wobble += p.wobbleSpeed;
      p.scaleY = Math.cos(p.wobble);

      // Fade out as it settles
      if (elapsed > 1000) {
        p.opacity = Math.max(0, p.opacity - p.decay);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(1, p.scaleY);
      ctx.globalAlpha = p.opacity;

      ctx.fillStyle = p.color;

      if (p.shape === 'rect' || p.shape === 'ribbon') {
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        // Add subtle gold metallic specular shine on rect edges
        if (p.color === '#FFD700' || p.color === '#F59E0B') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height * 0.35);
        }
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'sparkle') {
        // 4-pointed diamond glint
        const r = p.width / 2;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.3, -r * 0.3);
        ctx.lineTo(r, 0);
        ctx.lineTo(r * 0.3, r * 0.3);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.3, r * 0.3);
        ctx.lineTo(-r, 0);
        ctx.lineTo(-r * 0.3, -r * 0.3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    if (activeParticles > 0 && elapsed < 4500) {
      animationFrame = requestAnimationFrame(render);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', onResize);
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  animationFrame = requestAnimationFrame(render);
}
