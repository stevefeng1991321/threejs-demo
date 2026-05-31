import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PRESETS, PRESET_IDS } from './presets.js';
import { createAbstractDevice, applyDeviceFinish } from './createAbstractDevice.js';

const HDR_PATH = 'https://threejs.org/examples/textures/equirectangular/';

let camera, scene, renderer, controls, pmremGenerator;
let gui, finishController;
let currentModel = null;
let gltfContext = null;

const state = {
  industry: 'furniture',
  finish: 'Warm linen',
};

const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const headlineEl = document.getElementById('headline');
const taglineEl = document.getElementById('tagline');

init();
animate();

function setLoadingProgress(fraction, label) {
  const pct = Math.round(fraction * 100);
  loaderFill.style.width = `${pct}%`;
  loaderText.textContent = label ?? `Loading… ${pct}%`;
}

function hideLoader() {
  loaderEl.classList.add('hidden');
}

function updateInfoPanel(preset) {
  headlineEl.textContent = preset.headline;
  taglineEl.textContent = preset.tagline;
}

function init() {
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);

  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  window.addEventListener('resize', onWindowResize);

  setupIndustryButtons();
  applyEnvironment('room');
  loadPreset(state.industry);
}

function setupIndustryButtons() {
  const container = document.getElementById('industry-tabs');
  PRESET_IDS.forEach((id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = PRESETS[id].label;
    btn.dataset.industry = id;
    btn.classList.toggle('active', id === state.industry);
    btn.addEventListener('click', () => {
      if (state.industry === id) return;
      state.industry = id;
      container.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.industry === id));
      loadPreset(id);
    });
    container.appendChild(btn);
  });
}

function applyEnvironment(mode, backgroundColor) {
  if (mode === 'hdr') {
    new RGBELoader()
      .setPath(HDR_PATH)
      .load('quarry_01_1k.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;
      });
    return;
  }

  scene.background = new THREE.Color(backgroundColor ?? 0xbbbbbb);
  const roomEnv = new RoomEnvironment();
  const envMap = pmremGenerator.fromScene(roomEnv, 0.04).texture;
  scene.environment = envMap;
  roomEnv.dispose?.();
}

function applyCamera(preset) {
  const { position, target, minDistance, maxDistance } = preset.camera;
  camera.position.set(...position);
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  controls.target.set(...target);
  controls.update();
}

function disposeModel() {
  if (!currentModel) return;

  scene.remove(currentModel);
  currentModel.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => m.dispose());
    }
  });
  currentModel = null;
  gltfContext = null;
}

function loadPreset(industryId) {
  const preset = PRESETS[industryId];
  updateInfoPanel(preset);
  applyEnvironment(preset.environment, preset.background);
  applyCamera(preset);

  disposeModel();
  if (gui) gui.destroy();

  loaderEl.classList.remove('hidden');
  setLoadingProgress(0, `Loading ${preset.label.toLowerCase()}…`);

  if (preset.model.type === 'procedural') {
    currentModel = createAbstractDevice();
    scene.add(currentModel);
    setupSaasGui(preset);
    hideLoader();
    return;
  }

  loadGltf(preset);
}

function loadGltf(preset) {
  const loader = new GLTFLoader();

  loader.load(
    preset.model.url,
    (gltf) => {
      currentModel = gltf.scene;
      scene.add(currentModel);

      const variantsExtension = gltf.userData.gltfExtensions?.KHR_materials_variants;
      gltfContext = { parser: gltf.parser, variantsExtension };

      setupFurnitureGui(preset, gltf);
      hideLoader();
    },
    (event) => {
      if (event.lengthComputable) {
        setLoadingProgress(event.loaded / event.total, 'Loading model…');
      }
    },
    (err) => {
      console.error('Model load failed:', err);
      loaderText.textContent = 'Failed to load model.';
    },
  );
}

function setupFurnitureGui(preset, gltf) {
  const { variantsExtension, parser } = gltfContext;

  if (!variantsExtension) {
    gui = new GUI({ title: 'Controls' });
    gui.add({ note: 'No material variants' }, 'note');
    return;
  }

  const variantNames = variantsExtension.variants.map((v) => v.name);
  const finishOptions = variantNames.map((name) => preset.variantLabels[name] ?? name);

  const labelToVariant = Object.fromEntries(
    variantNames.map((name) => [preset.variantLabels[name] ?? name, name]),
  );

  const defaultLabel = preset.variantLabels[preset.defaultVariant] ?? variantNames[0];
  state.finish = defaultLabel;

  selectGltfVariant(parser, variantsExtension, labelToVariant[state.finish]);

  gui = new GUI({ title: 'Finish' });
  finishController = gui.add(state, 'finish', finishOptions).name('Fabric');
  finishController.onChange((label) => {
    selectGltfVariant(parser, variantsExtension, labelToVariant[label]);
  });
}

function setupSaasGui(preset) {
  const finishOptions = preset.finishes.map((f) => f.label);
  const labelToFinish = Object.fromEntries(preset.finishes.map((f) => [f.label, f]));

  state.finish = preset.finishes.find((f) => f.id === preset.defaultFinish)?.label ?? finishOptions[0];
  applyDeviceFinish(currentModel, labelToFinish[state.finish]);

  gui = new GUI({ title: 'Theme' });
  finishController = gui.add(state, 'finish', finishOptions).name('Colorway');
  finishController.onChange((label) => {
    applyDeviceFinish(currentModel, labelToFinish[label]);
  });
}

function selectGltfVariant(parser, extension, variantName) {
  const variantIndex = extension.variants.findIndex(
    (v) => v.name === variantName || v.name.toLowerCase().includes(String(variantName).toLowerCase()),
  );

  if (variantIndex === -1) return;

  currentModel.traverse(async (object) => {
    if (!object.isMesh || !object.userData.gltfExtensions) return;

    const meshVariantDef = object.userData.gltfExtensions.KHR_materials_variants;
    if (!meshVariantDef) return;

    if (!object.userData.originalMaterial) {
      object.userData.originalMaterial = object.material;
    }

    const mapping = meshVariantDef.mappings.find((m) => m.variants.includes(variantIndex));

    if (mapping) {
      object.material = await parser.getDependency('material', mapping.material);
      parser.assignFinalMaterial(object);
    } else {
      object.material = object.userData.originalMaterial;
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
