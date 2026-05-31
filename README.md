# 3D Product Viewer — Three.js Client Demo

Client-facing interactive demo with two industry presets:

| Preset | Model | Finishes |
|--------|--------|----------|
| **Furniture** | [Sheen Chair](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair) (glTF) | Warm linen / Deep teal (`KHR_materials_variants`) |
| **MacBook** | MacBook Pro (glTF in `public/models/`) | Silver / Space Gray / Midnight / Starlight |
| **SaaS** | Procedural abstract device | Cloud white / Graphite / Coral accent |

## Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:3000/** (see `vite.config.js`).

## For clients

- Use **Furniture** / **MacBook** / **SaaS** tabs to switch use cases.
- Use the **Finish** or **Theme** panel to change materials.
- Orbit and zoom to inspect the product.

## Stack

Vite · three.js · GLTFLoader · RoomEnvironment · OrbitControls · lil-gui

Assets: Sheen Chair from [three.js examples CDN](https://threejs.org/examples/models/gltf/SheenChair.glb). MacBook models in `public/models/` (Draco-compressed; decoder loaded from three.js CDN). Source: [macbookpro-3d-landing](https://github.com/aarxnmendez/macbookpro-3d-landing) (educational clone; portfolio demos only).
