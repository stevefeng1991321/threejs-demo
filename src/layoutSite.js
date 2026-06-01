import * as THREE from 'three';
import { frameAndPlace } from './applyGltfFinish.js';

function groundObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  object.position.y += -box.min.y;
}

export function layoutSiteWorkspace(preset, workspaceModels) {
  const poleDef = preset.models.find((m) => m.id === 'powerPole');
  const liftDef = preset.models.find((m) => m.id === 'forklift');
  const construction = workspaceModels.construction.object;

  groundObject(construction);

  const buildingBox = new THREE.Box3().setFromObject(construction);
  const buildingCenter = buildingBox.getCenter(new THREE.Vector3());
  const buildingSize = buildingBox.getSize(new THREE.Vector3());

  const gap = 0.5;
  const poleX = buildingBox.max.x + gap;
  const poleZ = buildingCenter.z;

  frameAndPlace(workspaceModels.powerPole.object, poleDef.targetHeight, [poleX, 0, poleZ]);
  groundObject(workspaceModels.powerPole.object);

  const poleBox = new THREE.Box3().setFromObject(workspaceModels.powerPole.object);
  const poleCenter = poleBox.getCenter(new THREE.Vector3());
  const poleTopY = poleBox.max.y;

  // Use the narrative-safe distance (matches UI copy) and place the lift close
  // to the pole but still outside the building footprint.
  const exclusionRadius = 3.0;

  const liftUnsafe = new THREE.Vector3(poleCenter.x - 1.4, 0, poleCenter.z + 0.5);
  if (liftUnsafe.x <= buildingBox.max.x + 0.25) liftUnsafe.x = buildingBox.max.x + 0.25;

  frameAndPlace(
    workspaceModels.forklift.object,
    liftDef.targetHeight,
    liftUnsafe.toArray(),
    liftDef.rotation ?? [0, -0.5, 0],
  );
  groundObject(workspaceModels.forklift.object);

  const liftUnsafeFinal = workspaceModels.forklift.object.position.clone();

  const liftSafe = new THREE.Vector3(
    buildingBox.min.x - 1.6,
    liftUnsafeFinal.y,
    buildingBox.max.z + Math.max(buildingSize.z * 0.5, 0.6),
  );

  // Place the isolation switch as a freestanding object near the building front.
  const switchPosition = new THREE.Vector3(buildingBox.min.x + 1.0, 0.55, buildingBox.max.z + 0.8);

  return {
    poleCenter: new THREE.Vector3(poleCenter.x, 0, poleCenter.z),
    poleTopY,
    liftUnsafe: liftUnsafeFinal,
    liftSafe,
    exclusionRadius,
    switchPosition,
    siteCenter: new THREE.Vector3(buildingCenter.x, buildingSize.y * 0.35, buildingCenter.z),
  };
}
