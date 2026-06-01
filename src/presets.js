export const PRESETS = {
  site: {
    id: 'site',
    label: 'Site',
    headline: 'Restore power safely',
    tagline: 'Storm damage scenario — make the site safe',
    layout: 'site',
    guiType: 'scenario',
    camera: {
      position: [9, 4.5, 9],
      target: [0.5, 1.2, 0],
      minDistance: 4,
      maxDistance: 25,
    },
    environment: 'room',
    background: 0x8a9498,
    models: [
      {
        id: 'construction',
        label: 'Building',
        url: '/models/construction-site.glb',
        targetHeight: 2.5,
        position: [0, 0, 0],
        materialKeywords: { body: ['bina'], accent: ['merdiven'] },
      },
      {
        id: 'forklift',
        label: 'Scissor lift',
        url: '/models/fork-lift.glb',
        targetHeight: 1.2,
        rotation: [0, -0.5, 0],
      },
      {
        id: 'powerPole',
        label: 'Power pole',
        url: '/models/power-pole.glb',
        targetHeight: 1.4,
      },
    ],
    finishes: [
      {
        id: 'storm-damage',
        label: 'Storm damage',
        construction: { body: 0x8a9098, accent: 0x5a6068, metalness: 0.25, roughness: 0.7 },
        forklift: { body: 0xf5c518, metalness: 0.35, roughness: 0.55, applyToUnmatched: true },
        powerPole: { body: 0x9098a0, metalness: 0.65, roughness: 0.45, applyToUnmatched: true },
      },
    ],
    defaultFinish: 'storm-damage',
  },
};

export const PRESET_IDS = Object.keys(PRESETS);
