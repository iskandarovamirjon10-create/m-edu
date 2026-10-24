/**
 * Design Tokens & Cascade Layer Architecture Test
 * Verifies that design-tokens.css and globals.css adhere to strict CSS Cascade Layering,
 * unified Liquid Glass V2 tokens, normalized z-index hierarchy, and accessibility rules.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Design Tokens & CSS Architecture Verification', () => {
  const stylesDir = path.resolve(__dirname, '..');
  const tokensCssPath = path.join(stylesDir, 'design-tokens.css');
  const globalsCssPath = path.join(stylesDir, 'globals.css');

  const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  it('declares identical, strict Cascade Layer order in both CSS files', () => {
    const expectedLayerDeclaration =
      '@layer reset, tokens, base, typography, glass, components, motion, focus, utilities, print;';

    expect(tokensCss).toContain(expectedLayerDeclaration);
    expect(globalsCss).toContain(expectedLayerDeclaration);
  });

  it('defines unified iOS 27 Liquid Glass optical tokens', () => {
    expect(tokensCss).toContain('--liquid-glass-opacity:');
    expect(tokensCss).toContain('--liquid-glass-blur:');
    expect(tokensCss).toContain('--liquid-glass-specular:');
    expect(tokensCss).toContain('--liquid-glass-saturate:');
    expect(tokensCss).toContain('--liquid-glass-refraction:');

    // Three standardized tiers
    expect(tokensCss).toContain('--glass-tier-subtle-bg:');
    expect(tokensCss).toContain('--glass-tier-card-bg:');
    expect(tokensCss).toContain('--glass-tier-floating-bg:');
  });

  it('defines normalized, collision-free z-index hierarchy', () => {
    expect(tokensCss).toContain('--z-below: -1;');
    expect(tokensCss).toContain('--z-base: 0;');
    expect(tokensCss).toContain('--z-sticky: 20;');
    expect(tokensCss).toContain('--z-header: 30;');
    expect(tokensCss).toContain('--z-sidebar: 40;');
    expect(tokensCss).toContain('--z-dropdown: 50;');
    expect(tokensCss).toContain('--z-copilot: 60;');
    expect(tokensCss).toContain('--z-modal-backdrop: 70;');
    expect(tokensCss).toContain('--z-modal: 75;');
    expect(tokensCss).toContain('--z-toast: 90;');
    expect(tokensCss).toContain('--z-tooltip: 100;');
    expect(tokensCss).toContain('--z-max: 999;');
  });

  it('includes complete true-black OLED mode calibrations', () => {
    expect(tokensCss).toContain('[data-theme="oled"]');
    expect(tokensCss).toContain('--bg-base: #000000;');
    expect(tokensCss).toContain('--bg-page: #000000;');
    expect(globalsCss).toContain('[data-theme="oled"]');
  });

  it('implements comprehensive accessibility media queries in both files', () => {
    // Reduced transparency
    expect(tokensCss).toContain('(prefers-reduced-transparency: reduce)');
    expect(globalsCss).toContain('(prefers-reduced-transparency: reduce)');

    // Reduced motion
    expect(tokensCss).toContain('(prefers-reduced-motion: reduce)');
    expect(globalsCss).toContain('(prefers-reduced-motion: reduce)');

    // High contrast
    expect(tokensCss).toContain('(prefers-contrast: more)');
    expect(globalsCss).toContain('(prefers-contrast: more)');
  });

  it('provides backward-compatible aliases for all existing glass classes in globals.css', () => {
    expect(globalsCss).toContain('.glass-subtle');
    expect(globalsCss).toContain('.glass');
    expect(globalsCss).toContain('.glass-card');
    expect(globalsCss).toContain('.liquid-glass-card');
    expect(globalsCss).toContain('.apple-glass');
    expect(globalsCss).toContain('.medu-glass');
    expect(globalsCss).toContain('.liquid-glass-surface');
    expect(globalsCss).toContain('.glass-floating');
    expect(globalsCss).toContain('.glass-modal');
  });

  it('includes mobile blur optimization at max-width 768px', () => {
    expect(globalsCss).toContain('@media (max-width: 768px)');
    expect(globalsCss).toContain('backdrop-filter: blur(14px)');
  });
});
