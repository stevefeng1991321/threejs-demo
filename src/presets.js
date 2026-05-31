const ASSETS = 'https://threejs.org/examples/';

export const PRESETS = {
  furniture: {
    id: 'furniture',
    label: 'Furniture',
    headline: '3D product viewer',
    tagline: 'Lounge chair — fabric & frame finishes',
    model: {
      type: 'gltf',
      url: `${ASSETS}models/gltf/SheenChair.glb`,
    },
    camera: {
      position: [-0.9, 0.75, 1.4],
      target: [0, 0.35, 0],
      minDistance: 0.8,
      maxDistance: 6,
    },
    environment: 'room',
    background: 0xbbbbbb,
    variantLabels: {
      'Mango Velvet': 'Warm linen',
      'Peacock Velvet': 'Deep teal',
    },
    defaultVariant: 'Mango Velvet',
  },

  saas: {
    id: 'saas',
    label: 'SaaS',
    headline: '3D product viewer',
    tagline: 'Abstract device — brand color themes',
    model: { type: 'procedural' },
    camera: {
      position: [1.8, 1.1, 2.2],
      target: [0, 0.35, 0],
      minDistance: 1.2,
      maxDistance: 8,
    },
    environment: 'room',
    background: 0x0f1218,
    finishes: [
      {
        id: 'cloud',
        label: 'Cloud white',
        body: 0xf0f2f5,
        accent: 0x4a9eff,
        screen: 0x1a2332,
        screenEmissive: 0x3366cc,
      },
      {
        id: 'graphite',
        label: 'Graphite',
        body: 0x3a3f48,
        accent: 0x7c5cff,
        screen: 0x0d1117,
        screenEmissive: 0x5533aa,
      },
      {
        id: 'coral',
        label: 'Coral accent',
        body: 0x2a2d33,
        accent: 0xff6b4a,
        screen: 0x141820,
        screenEmissive: 0xcc4422,
      },
    ],
    defaultFinish: 'cloud',
  },
};

export const PRESET_IDS = Object.keys(PRESETS);
