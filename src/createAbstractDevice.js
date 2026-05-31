import * as THREE from 'three';

/**
 * Stylized abstract product (dashboard / hub) for SaaS-style demos.
 */
export function createAbstractDevice() {
  const device = new THREE.Group();
  device.name = 'AbstractDevice';

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, 0.12, 48),
    new THREE.MeshPhysicalMaterial({
      name: 'body',
      color: 0xf0f2f5,
      metalness: 0.35,
      roughness: 0.45,
    }),
  );
  base.position.y = 0.06;
  base.userData.finishPart = 'body';
  device.add(base);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.55, 0.42, 4, 4, 4),
    new THREE.MeshPhysicalMaterial({
      name: 'body',
      color: 0xf0f2f5,
      metalness: 0.5,
      roughness: 0.35,
    }),
  );
  body.position.y = 0.42;
  body.userData.finishPart = 'body';
  device.add(body);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.34, 0.04),
    new THREE.MeshPhysicalMaterial({
      name: 'screen',
      color: 0x1a2332,
      emissive: 0x2244aa,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.2,
    }),
  );
  screen.position.set(0, 0.48, 0.22);
  screen.userData.finishPart = 'screen';
  device.add(screen);

  const accent = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.028, 16, 48),
    new THREE.MeshPhysicalMaterial({
      name: 'accent',
      color: 0x4a9eff,
      emissive: 0x4a9eff,
      emissiveIntensity: 0.25,
      metalness: 0.6,
      roughness: 0.25,
    }),
  );
  accent.rotation.x = Math.PI / 2;
  accent.position.set(0, 0.72, 0.08);
  accent.userData.finishPart = 'accent';
  device.add(accent);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.5, 24),
    new THREE.MeshPhysicalMaterial({
      name: 'body',
      color: 0xd8dce3,
      metalness: 0.7,
      roughness: 0.3,
    }),
  );
  pedestal.position.y = 0.25;
  pedestal.userData.finishPart = 'body';
  device.add(pedestal);

  return device;
}

export function applyDeviceFinish(device, finish) {
  device.traverse((object) => {
    if (!object.isMesh || !object.userData.finishPart) return;

    const part = object.userData.finishPart;
    const mat = object.material;

    if (part === 'body') mat.color.setHex(finish.body);
    if (part === 'screen') {
      mat.color.setHex(finish.screen);
      mat.emissive.setHex(finish.screenEmissive ?? finish.screen);
    }
    if (part === 'accent') {
      mat.color.setHex(finish.accent);
      mat.emissive.setHex(finish.accent);
    }
  });
}
