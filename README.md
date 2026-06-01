# Restore Power Safely — Three.js Demo

Interactive safety-training scenario: identify storm-damage hazards on a construction site, make the area safe, then restore power.

## Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:3000/** (see `vite.config.js`).

## Scenario flow

1. **Briefing** — storm damage intro
2. **Identify hazards** — damaged pole, water puddle, scissor lift too close
3. **Make safe** — isolate circuit, move lift, mark work zone
4. **Restore power** — complete the mission

## Stack

Vite · three.js · GLTFLoader · RoomEnvironment · OrbitControls

## Assets

Models in `public/models/`: construction site, scissor lift (`fork-lift.glb`), power pole.
