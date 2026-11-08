const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const AVATARS = [
  {
    slug: 'cyber-scholar',
    name: 'Cyber Scholar',
    title: 'Tahlilchi va Kashfiyotchi',
    description: 'Chuqur mantiq, ilmiy tadqiqot va kiber-intellekt egasi. Har bir savolga matematik aniqlik bilan yondashadi.',
    element: 'TECH',
    rarity: 'COMMON',
    c1: '#00F2FE',
    c2: '#4FACFE',
    accent: '#00C9FF',
    glow: '#00F2FE',
    symbol: '🎓',
    silhouette: 'scholar',
  },
  {
    slug: 'quantum-owl',
    name: 'Quantum Owl',
    title: 'Tungi Daho',
    description: 'Tunning qorong\'uligida ham eng yashirin haqiqatlarni ko\'ra oladigan, kvant ehtimolliklarini hisoblovchi dono alloma.',
    element: 'QUANTUM',
    rarity: 'RARE',
    c1: '#8A2387',
    c2: '#E94057',
    accent: '#F27121',
    glow: '#E94057',
    symbol: '🦉',
    silhouette: 'owl',
  },
  {
    slug: 'neon-samurai',
    name: 'Neon Samurai',
    title: 'Tezkor Qilich',
    description: 'Yashin tezligidagi reflekslar va sharaf kodeksi. Qat\'iyatli va har qanday shiddatli duelda birinchi zarba beruvchi.',
    element: 'NEON',
    rarity: 'RARE',
    c1: '#FF0844',
    c2: '#FF4E50',
    accent: '#FFB199',
    glow: '#FF0844',
    symbol: '⚔️',
    silhouette: 'samurai',
  },
  {
    slug: 'algorithm-dragon',
    name: 'Algorithm Dragon',
    title: 'Mantiq Giganti',
    description: 'Cheksiz hisoblash quvvati va mag\'rur ruhiyat. Murakkab algoritmlarni bir necha soniyada parchalab tashlaydi.',
    element: 'VOID',
    rarity: 'EPIC',
    c1: '#00F5D4',
    c2: '#00BBF9',
    accent: '#70E000',
    glow: '#00F5D4',
    symbol: '🐉',
    silhouette: 'dragon',
  },
  {
    slug: 'astro-voyager',
    name: 'Astro Voyager',
    title: 'Koinot Sayyohi',
    description: 'Koinotning cheksiz sirlarini zabt etgan kashfiyotchi. Har bir yangi duel u uchun yangi yulduz tizimini kashf qilishdek.',
    element: 'COSMIC',
    rarity: 'COMMON',
    c1: '#FA709A',
    c2: '#FEE140',
    accent: '#38EF7D',
    glow: '#FEE140',
    symbol: '🚀',
    silhouette: 'astronaut',
  },
  {
    slug: 'matrix-fox',
    name: 'Matrix Fox',
    title: 'Ayyor Zukko',
    description: 'Chaqqon va noan\'anaviy fikrlash ustasi. Raqib kutmagan yondashuvlar bilan g\'alabani ilib ketadi.',
    element: 'TECH',
    rarity: 'COMMON',
    c1: '#F39C12',
    c2: '#E67E22',
    accent: '#F1C40F',
    glow: '#F39C12',
    symbol: '🦊',
    silhouette: 'fox',
  },
  {
    slug: 'pixel-panther',
    name: 'Pixel Panther',
    title: 'Kiber Pantera',
    description: 'Sokin, ammo xatoga o\'rin qoldirmaydigan yirtqich tezlik. Sekundning yuzdan bir ulushida to\'g\'ri qaror qabul qiladi.',
    element: 'NEON',
    rarity: 'RARE',
    c1: '#FF007F',
    c2: '#7928CA',
    accent: '#00D2FF',
    glow: '#FF007F',
    symbol: '🐆',
    silhouette: 'panther',
  },
  {
    slug: 'arcane-falcon',
    name: 'Arcane Falcon',
    title: 'Uzoqni Ko\'rar Strateg',
    description: 'Maydonga balanddan nazar tashlab, butun o\'yin strategiyasini bir necha qadam oldindan rejalashtiruvchi lochin.',
    element: 'QUANTUM',
    rarity: 'RARE',
    c1: '#0052D4',
    c2: '#4364F7',
    accent: '#6FB1FC',
    glow: '#4364F7',
    symbol: '🦅',
    silhouette: 'falcon',
  },
  {
    slug: 'solar-phoenix',
    name: 'Solar Phoenix',
    title: 'Quyosh Qaqnusi',
    description: 'Har qanday mag\'lubiyatdan yangi bilim va g\'azab bilan qayta tug\'iladi. Uning intellektual alangi hech qachon so\'nmaydi.',
    element: 'FIRE',
    rarity: 'EPIC',
    c1: '#FF416C',
    c2: '#FF4B2B',
    accent: '#F9D423',
    glow: '#FF416C',
    symbol: '🔥',
    silhouette: 'phoenix',
  },
  {
    slug: 'binary-titan',
    name: 'Binary Titan',
    title: 'Temir Iroda',
    description: 'Tizimli mustahkamlik va buzilmas konsentratsiya. Bosim ostida ham birorta xatoga yo\'l qo\'ymaydigan sovuqqon gigant.',
    element: 'TECH',
    rarity: 'RARE',
    c1: '#4B6CB7',
    c2: '#182848',
    accent: '#00F2FE',
    glow: '#4B6CB7',
    symbol: '🤖',
    silhouette: 'titan',
  },
  {
    slug: 'vortex-wolf',
    name: 'Vortex Wolf',
    title: 'Girdob Bo\'risi',
    description: 'Jamoaviy duel (2v2) ustasi. O\'z sherigini ilhomlantirib, dushman jamoani aql girdobiga g\'arq qiladi.',
    element: 'VOID',
    rarity: 'RARE',
    c1: '#00C9FF',
    c2: '#92FE9D',
    accent: '#00E5FF',
    glow: '#00C9FF',
    symbol: '🐺',
    silhouette: 'wolf',
  },
  {
    slug: 'infinite-sage',
    name: 'Infinite Sage',
    title: 'Grandmaster Alloma',
    description: 'Barcha bilimlarning cho\'qqisi. Vaqt va makon to\'siqlaridan oshib o\'tgan mutlaq intellektual donishmand.',
    element: 'COSMIC',
    rarity: 'LEGENDARY',
    c1: '#F9D423',
    c2: '#FF4E50',
    accent: '#00F2FE',
    glow: '#F9D423',
    symbol: '🧙‍♂️',
    silhouette: 'sage',
  },
];

function generateSvg({ slug, name, title, c1, c2, accent, glow, symbol, silhouette, mode, size = 1024 }) {
  const isThumb = mode === 'thumbnail';
  const isBattle = mode === 'battle';
  const isVictory = mode === 'victory';

  const viewBox = `0 0 ${size} ${size}`;
  const center = size / 2;
  const radius = size * 0.42;

  // Mode-dependent effects
  const auraOpacity = isBattle ? '0.55' : isVictory ? '0.65' : '0.35';
  const ringStroke = isVictory ? '#FFD700' : isBattle ? '#FF0844' : c1;
  const badgeText = isVictory ? 'VICTORY' : isBattle ? 'IN BATTLE' : title.toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">
  <defs>
    <!-- Background Blur and Glow Filters -->
    <filter id="glow-${slug}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${size * 0.035}" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.8" />
    </filter>

    <!-- Gradients -->
    <linearGradient id="grad-main-${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="1" />
      <stop offset="100%" stop-color="${c2}" stop-opacity="1" />
    </linearGradient>
    <linearGradient id="grad-glass-${slug}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45" />
    </linearGradient>
    <radialGradient id="grad-core-${slug}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${glow}" stop-opacity="${auraOpacity}" />
      <stop offset="60%" stop-color="${c2}" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#0B0F19" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="grad-rim-${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${c1}" stop-opacity="0.8" />
    </linearGradient>
  </defs>

  <!-- Deep Aura Core -->
  <circle cx="${center}" cy="${center}" r="${radius * 1.15}" fill="url(#grad-core-${slug})" />

  <!-- Outer Cyber Rings -->
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${ringStroke}" stroke-width="${size * 0.008}" stroke-dasharray="${size * 0.04} ${size * 0.02}" opacity="0.75" />
  <circle cx="${center}" cy="${center}" r="${radius * 0.94}" fill="none" stroke="url(#grad-rim-${slug})" stroke-width="${size * 0.004}" opacity="0.6" />

  ${isBattle ? `
  <!-- Battle Mode Energy Sparks -->
  <polygon points="${center},${center - radius * 1.05} ${center + size * 0.04},${center - radius * 0.88} ${center - size * 0.04},${center - radius * 0.88}" fill="#FF0844" opacity="0.9" />
  <polygon points="${center},${center + radius * 1.05} ${center + size * 0.04},${center + radius * 0.88} ${center - size * 0.04},${center + radius * 0.88}" fill="#FF0844" opacity="0.9" />
  ` : ''}

  ${isVictory ? `
  <!-- Victory Crown Glow & Starburst -->
  <circle cx="${center}" cy="${center}" r="${radius * 1.05}" fill="none" stroke="#FFD700" stroke-width="${size * 0.012}" stroke-dasharray="${size * 0.02} ${size * 0.03}" />
  <polygon points="${center},${center - radius * 1.1} ${center + size * 0.05},${center - radius * 0.92} ${center},${center - radius * 0.96} ${center - size * 0.05},${center - radius * 0.92}" fill="#FFD700" />
  ` : ''}

  <!-- Main Cyber-Glass Vessel (PBR Spherical Capsule) -->
  <g filter="url(#drop-shadow)">
    <!-- Base Body Sphere -->
    <circle cx="${center}" cy="${center}" r="${radius * 0.88}" fill="#0A0F1D" />
    <circle cx="${center}" cy="${center}" r="${radius * 0.88}" fill="url(#grad-main-${slug})" opacity="0.32" />
    <circle cx="${center}" cy="${center}" r="${radius * 0.88}" fill="url(#grad-glass-${slug})" />

    <!-- Inner Radial Glow -->
    <circle cx="${center}" cy="${center}" r="${radius * 0.80}" fill="none" stroke="url(#grad-main-${slug})" stroke-width="${size * 0.012}" filter="url(#glow-${slug})" opacity="0.85" />
  </g>

  <!-- Central Character Holographic Silhouette & Monogram Emblem -->
  <g transform="translate(${center}, ${center * 0.95})">
    <!-- Emblem Backing Hexagon -->
    <polygon points="0,${-size * 0.22} ${size * 0.19},${-size * 0.11} ${size * 0.19},${size * 0.11} 0,${size * 0.22} ${-size * 0.19},${size * 0.11} ${-size * 0.19},${-size * 0.11}" 
      fill="rgba(10, 15, 29, 0.7)" stroke="${accent}" stroke-width="${size * 0.006}" opacity="0.9" />

    <!-- 3D Geometric Character Silhouette Anchor -->
    <circle cx="0" cy="0" r="${size * 0.14}" fill="url(#grad-main-${slug})" opacity="0.25" filter="url(#glow-${slug})" />

    <!-- Character Symbol Avatar Feature -->
    <text x="0" y="${size * 0.05}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.16}" text-anchor="middle" dominant-baseline="middle" filter="url(#drop-shadow)">${symbol}</text>
  </g>

  <!-- Specular Highlights (Liquid Glass Refraction) -->
  <ellipse cx="${center}" cy="${center - radius * 0.55}" rx="${radius * 0.48}" ry="${radius * 0.18}" fill="#ffffff" opacity="0.22" />
  <ellipse cx="${center - radius * 0.45}" cy="${center - radius * 0.35}" rx="${radius * 0.15}" ry="${radius * 0.08}" fill="#ffffff" opacity="0.35" transform="rotate(-25, ${center - radius * 0.45}, ${center - radius * 0.35})" />

  <!-- Lower Cyber Identification Nameplate -->
  <g transform="translate(${center}, ${center + radius * 0.65})">
    <rect x="${-size * 0.28}" y="${-size * 0.05}" width="${size * 0.56}" height="${size * 0.09}" rx="${size * 0.025}" 
      fill="rgba(11, 15, 25, 0.85)" stroke="url(#grad-rim-${slug})" stroke-width="${size * 0.004}" filter="url(#drop-shadow)" />
    <text x="0" y="${-size * 0.005}" font-family="'Segoe UI', Roboto, sans-serif" font-size="${size * 0.038}" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="1.5">
      ${name.toUpperCase()}
    </text>
    <text x="0" y="${size * 0.026}" font-family="'Segoe UI', Roboto, sans-serif" font-size="${size * 0.022}" font-weight="600" fill="${accent}" text-anchor="middle" letter-spacing="1">
      ${badgeText}
    </text>
  </g>
</svg>`;
}

async function buildPipeline() {
  console.log('🚀 Starting Mind Arena 3D Avatar Asset Pipeline...');

  const webPublicBase = path.resolve('apps/web/public/avatars/arena');
  const apiModuleBase = path.resolve('apps/api/src/modules/mind-arena/avatars');

  fs.mkdirSync(webPublicBase, { recursive: true });
  fs.mkdirSync(apiModuleBase, { recursive: true });

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    standardResolution: '1024x1024',
    thumbnailResolution: '256x256',
    format: 'image/png',
    fallbackFormat: 'image/svg+xml',
    totalAvatars: AVATARS.length,
    avatars: {},
  };

  for (const avatar of AVATARS) {
    const avatarDir = path.join(webPublicBase, avatar.slug);
    fs.mkdirSync(avatarDir, { recursive: true });

    console.log(`Rendering assets for: ${avatar.name} (${avatar.slug})...`);

    const modes = [
      { key: 'default', mode: 'default', size: 1024 },
      { key: 'battle', mode: 'battle', size: 1024 },
      { key: 'victory', mode: 'victory', size: 1024 },
      { key: 'thumbnail', mode: 'thumbnail', size: 256 },
    ];

    const avatarManifestEntry = {
      slug: avatar.slug,
      name: avatar.name,
      title: avatar.title,
      description: avatar.description,
      element: avatar.element,
      rarity: avatar.rarity,
      status: 'AVAILABLE',
      colorPalette: {
        primary: avatar.c1,
        secondary: avatar.c2,
        accent: avatar.accent,
        glow: avatar.glow,
      },
      assets: {},
    };

    for (const m of modes) {
      const svgContent = generateSvg({ ...avatar, mode: m.mode, size: m.size });
      const svgPath = path.join(avatarDir, `${m.key}.svg`);
      const pngPath = path.join(avatarDir, `${m.key}.png`);

      fs.writeFileSync(svgPath, svgContent, 'utf8');

      // Render high-quality PNG with Sharp
      await sharp(Buffer.from(svgContent))
        .resize(m.size, m.size)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(pngPath);

      const pngStats = fs.statSync(pngPath);
      const pngBuffer = fs.readFileSync(pngPath);
      const sha256 = crypto.createHash('sha256').update(pngBuffer).digest('hex');

      avatarManifestEntry.assets[m.key] = {
        pngPath: `/avatars/arena/${avatar.slug}/${m.key}.png`,
        svgPath: `/avatars/arena/${avatar.slug}/${m.key}.svg`,
        width: m.size,
        height: m.size,
        mimeType: 'image/png',
        byteSize: pngStats.size,
        contentHash: `sha256:${sha256}`,
      };
    }

    // Generate 3D Master Specification file
    const master3dSpec = {
      assetVersion: '1.0.0',
      avatarSlug: avatar.slug,
      geometry: {
        modelType: 'ProceduralPbrVessel',
        silhouetteAnchor: avatar.silhouette,
        primitiveCount: 14200,
        boundingVolume: { radius: 1.0, center: [0, 0, 0] },
      },
      materials: [
        {
          id: 'liquid-glass-shell',
          type: 'RefractiveGlass',
          transmission: 0.92,
          roughness: 0.08,
          ior: 1.52,
          clearcoat: 1.0,
          dispersion: 0.04,
        },
        {
          id: 'cyber-core',
          type: 'PbrEmissive',
          baseColor: avatar.c1,
          secondaryColor: avatar.c2,
          emissiveIntensity: 3.5,
          roughness: 0.25,
          metalness: 0.85,
        },
        {
          id: 'holographic-crest',
          type: 'VolumetricHologram',
          accentColor: avatar.accent,
          flickerFrequencyHz: 0.0,
        },
      ],
      lightingRig: {
        keyLight: { color: avatar.accent, intensity: 2.2, position: [2, 3, 4] },
        fillLight: { color: avatar.c1, intensity: 1.4, position: [-3, 1, 2] },
        rimLight: { color: '#FFFFFF', intensity: 3.0, position: [0, 4, -4] },
      },
      cameraPresets: {
        hero: { fov: 35, position: [0, 0, 3.2], target: [0, 0, 0] },
        combat: { fov: 42, position: [0.3, -0.2, 2.8], target: [0, 0.1, 0] },
        portrait: { fov: 28, position: [0, 0.1, 2.5], target: [0, 0.15, 0] },
      },
    };

    const masterPath = path.join(avatarDir, 'master.json');
    fs.writeFileSync(masterPath, JSON.stringify(master3dSpec, null, 2), 'utf8');

    manifest.avatars[avatar.slug] = avatarManifestEntry;
  }

  // Write manifests
  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(webPublicBase, 'manifest.json'), manifestJson, 'utf8');
  fs.writeFileSync(path.join(apiModuleBase, 'avatar-manifest.json'), manifestJson, 'utf8');

  console.log(`✅ Asset Pipeline Complete! Total Avatars: ${AVATARS.length}. Generated both PNGs, SVGs, master 3D specs, and manifests.`);
}

buildPipeline().catch((err) => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
