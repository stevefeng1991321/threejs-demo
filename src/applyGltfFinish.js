import * as THREE from 'three';

function meshLabel(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const matNames = mats.map((m) => m?.name ?? '').join(' ');
  return `${mesh.name} ${matNames}`.toLowerCase();
}

function cloneMaterials(mesh) {
  if (mesh.userData.finishReady) return;
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((m) => m.clone());
  } else if (mesh.material) {
    mesh.material = mesh.material.clone();
  }
  mesh.userData.finishReady = true;
}

/**
 * Client-style color finishes for glTF products (e.g. MacBook shells).
 */
export function applyGltfColorFinish(root, finish, keywords = {}) {
  const bodyKeys = keywords.body ?? ['body', 'aluminum', 'metal', 'case', 'lid', 'shell', 'chassis', 'frame', 'top', 'bina'];
  const screenKeys = keywords.screen ?? ['screen', 'display', 'glass', 'monitor'];
  const keyboardKeys = keywords.keyboard ?? ['keyboard', 'key', 'trackpad', 'pad'];
  const accentKeys = keywords.accent ?? ['accent', 'trim', 'stair', 'merdiven', 'detail'];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    cloneMaterials(child);
    const label = meshLabel(child);
    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      if (!mat?.color) return;

      if (screenKeys.some((k) => label.includes(k))) {
        mat.color.setHex(finish.screen ?? 0x111111);
        if (mat.emissive) {
          mat.emissive.setHex(finish.screenEmissive ?? 0x223355);
          mat.emissiveIntensity = finish.screenEmissiveIntensity ?? 0.15;
        }
        return;
      }

      if (keyboardKeys.some((k) => label.includes(k))) {
        mat.color.setHex(finish.keyboard ?? finish.body);
        if (mat.metalness !== undefined) mat.metalness = 0.2;
        if (mat.roughness !== undefined) mat.roughness = 0.6;
        return;
      }

      if (accentKeys.some((k) => label.includes(k))) {
        mat.color.setHex(finish.accent ?? finish.body);
        if (mat.metalness !== undefined) mat.metalness = finish.metalness ?? 0.4;
        if (mat.roughness !== undefined) mat.roughness = finish.roughness ?? 0.55;
        return;
      }

      if (bodyKeys.some((k) => label.includes(k)) || finish.applyToUnmatched) {
        mat.color.setHex(finish.body);
        if (mat.metalness !== undefined) mat.metalness = finish.metalness ?? 0.85;
        if (mat.roughness !== undefined) mat.roughness = finish.roughness ?? 0.4;
      }
    });
  });
}

export function centerAndFrameModel(object, targetHeight = 0.35) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const scale = targetHeight / Math.max(size.y, 0.001);
  object.scale.setScalar(scale);
  object.position.set(-center.x * scale, -center.y * scale + targetHeight * 0.02, -center.z * scale);

  return { scale, box };
}

export function frameAndPlace(object, targetHeight, position = [0, 0, 0], rotation = [0, 0, 0]) {
  centerAndFrameModel(object, targetHeight);
  object.position.x += position[0];
  object.position.y += position[1];
  object.position.z += position[2];
  object.rotation.set(...rotation);
}
