import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGltfLoader } from './createGltfLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PRESETS, PRESET_IDS } from './presets.js';
import { createAbstractDevice, applyDeviceFinish } from './createAbstractDevice.js';
import { applyGltfColorFinish, frameAndPlace } from './applyGltfFinish.js';
import { createSafetyScenario } from './safetyScenario.js';
import { layoutSiteWorkspace } from './layoutSite.js';

const HDR_PATH = 'https://threejs.org/examples/textures/equirectangular/';

let camera, scene, renderer, controls, pmremGenerator;
let gui;
let currentModel = null;
let gltfContext = null;
let workspaceModels = null;
let safetyScenario = null;
const state = {
  industry: 'furniture',
  finish: 'Warm linen',
};

const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const headlineEl = document.getElementById('headline');
const taglineEl = document.getElementById('tagline');
const infoHintEl = document.getElementById('info-hint');

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
  scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
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
  safetyScenario?.dispose();
  safetyScenario = null;

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
  workspaceModels = null;
}

function loadPreset(industryId) {
  const preset = PRESETS[industryId];
  updateInfoPanel(preset);
  applyEnvironment(preset.environment, preset.background);
  applyCamera(preset);

  disposeModel();
  if (gui) gui.destroy();

  loaderEl.classList.remove('hidden');
  setLoadingProgress(0, `Loading ${preset.label}…`);

  if (preset.guiType === 'procedural') {
    currentModel = createAbstractDevice();
    scene.add(currentModel);
    setupProceduralGui(preset);
    hideLoader();
    return;
  }

  if (preset.guiType === 'workspace') {
    loadWorkspace(preset);
    return;
  }

  if (preset.guiType === 'scenario') {
    loadWorkspace(preset);
    return;
  }

  loadGltf(preset);
}

function loadGltf(preset) {
  const loader = createGltfLoader();

  loader.load(
    preset.model.url,
    (gltf) => {
      currentModel = gltf.scene;
      if (preset.modelTargetHeight) frameAndPlace(currentModel, preset.modelTargetHeight);
      scene.add(currentModel);

      gltfContext = {
        parser: gltf.parser,
        variantsExtension: gltf.userData.gltfExtensions?.KHR_materials_variants,
      };

      setupGuiForPreset(preset);
      hideLoader();
    },
    (event) => {
      if (event.lengthComputable) {
        setLoadingProgress(event.loaded / event.total, 'Loading model…');
      }
    },
    (err) => {
      console.error('Model load failed:', err);
      loaderText.textContent = `Failed to load model: ${err?.message ?? err}`;
    },
  );
}

function loadWorkspace(preset) {
  const loader = createGltfLoader();
  const group = new THREE.Group();
  workspaceModels = {};
  const { models } = preset;
  let loadedCount = 0;

  const loadModel = (def) =>
    new Promise((resolve, reject) => {
      loader.load(
        def.url,
        (gltf) => {
          const model = gltf.scene;
          const placement = def.position ?? [0, 0, 0];
          frameAndPlace(model, def.targetHeight, placement, def.rotation);
          model.userData.workspaceId = def.id;
          group.add(model);
          workspaceModels[def.id] = { object: model, materialKeywords: def.materialKeywords };
          loadedCount += 1;
          setLoadingProgress(loadedCount / models.length, `Loading ${def.label ?? def.id}…`);
          resolve();
        },
        undefined,
        reject,
      );
    });

  Promise.all(models.map(loadModel))
    .then(() => {
      currentModel = group;
      scene.add(group);

      if (preset.guiType === 'scenario') {
        const siteLayout = preset.layout === 'site' ? layoutSiteWorkspace(preset, workspaceModels) : null;
        if (siteLayout) {
          const { siteCenter } = siteLayout;
          controls.target.copy(siteCenter);
          controls.update();
        }
        applyWorkspaceFinish(preset, preset.finishes.find((f) => f.id === preset.defaultFinish));
        infoHintEl.textContent = 'Click hazards and equipment · Drag to orbit · Scroll to zoom';
        safetyScenario = createSafetyScenario({
          scene,
          camera,
          renderer,
          controls,
          workspaceModels,
          layout: siteLayout,
          onHeadlineChange: (phase) => {
            if (phase === 'identify') taglineEl.textContent = 'Identify all hazards on site';
            if (phase === 'remediate') taglineEl.textContent = 'Isolate power · Move lift · Mark boundary';
            if (phase === 'complete') taglineEl.textContent = 'Site secured — ready for repairs';
          },
        });
      } else {
        setupWorkspaceGui(preset);
        infoHintEl.textContent = 'Drag to orbit · Scroll to zoom · Use the panel to change finish';
      }

      hideLoader();
    })
    .catch((err) => {
      console.error('Workspace load failed:', err);
      loaderText.textContent = `Failed to load workspace: ${err?.message ?? err}`;
    });
}

function setupGuiForPreset(preset) {
  switch (preset.guiType) {
    case 'variants':
      setupVariantGui(preset);
      break;
    case 'color':
      setupColorFinishGui(preset);
      break;
    case 'procedural':
      setupProceduralGui(preset);
      break;
    case 'workspace':
      setupWorkspaceGui(preset);
      break;
    default:
      break;
  }
}

function setupVariantGui(preset) {
  const { variantsExtension, parser } = gltfContext;

  if (!variantsExtension) {
    gui = new GUI({ title: 'Controls' });
    return;
  }

  const variantNames = variantsExtension.variants.map((v) => v.name);
  const finishOptions = variantNames.map((name) => preset.variantLabels[name] ?? name);
  const labelToVariant = Object.fromEntries(
    variantNames.map((name) => [preset.variantLabels[name] ?? name, name]),
  );

  state.finish = preset.variantLabels[preset.defaultVariant] ?? finishOptions[0];
  selectGltfVariant(parser, variantsExtension, labelToVariant[state.finish]);

  gui = new GUI({ title: 'Options' });
  gui.add(state, 'finish', finishOptions).name('Fabric').onChange((label) => {
    selectGltfVariant(parser, variantsExtension, labelToVariant[label]);
  });
}

function setupColorFinishGui(preset) {
  const finishOptions = preset.finishes.map((f) => f.label);
  const labelToFinish = Object.fromEntries(preset.finishes.map((f) => [f.label, f]));

  if (!finishOptions.includes(state.finish)) {
    state.finish =
      preset.finishes.find((f) => f.id === preset.defaultFinish)?.label ?? finishOptions[0];
  }
  applyGltfColorFinish(currentModel, labelToFinish[state.finish], preset.materialKeywords);

  gui = new GUI({ title: 'Options' });
  gui.add(state, 'finish', finishOptions).name('Finish').onChange((label) => {
    applyGltfColorFinish(currentModel, labelToFinish[label], preset.materialKeywords);
  });
}

function applyWorkspaceFinish(preset, finish) {
  preset.models.forEach((def) => {
    const partFinish = finish[def.id];
    const entry = workspaceModels?.[def.id];
    if (!partFinish || !entry) return;
    applyGltfColorFinish(entry.object, partFinish, def.materialKeywords);
  });
}

function setupWorkspaceGui(preset) {
  const finishOptions = preset.finishes.map((f) => f.label);
  const labelToFinish = Object.fromEntries(preset.finishes.map((f) => [f.label, f]));

  if (!finishOptions.includes(state.finish)) {
    state.finish =
      preset.finishes.find((f) => f.id === preset.defaultFinish)?.label ?? finishOptions[0];
  }
  applyWorkspaceFinish(preset, labelToFinish[state.finish]);

  gui = new GUI({ title: 'Options' });
  gui.add(state, 'finish', finishOptions).name('Site theme').onChange((label) => {
    applyWorkspaceFinish(preset, labelToFinish[label]);
  });
}

function setupProceduralGui(preset) {
  const finishOptions = preset.finishes.map((f) => f.label);
  const labelToFinish = Object.fromEntries(preset.finishes.map((f) => [f.label, f]));

  state.finish =
    preset.finishes.find((f) => f.id === preset.defaultFinish)?.label ?? finishOptions[0];
  applyDeviceFinish(currentModel, labelToFinish[state.finish]);

  gui = new GUI({ title: 'Options' });
  gui.add(state, 'finish', finishOptions).name('Theme').onChange((label) => {
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
  safetyScenario?.update();
  renderer.render(scene, camera);
}
