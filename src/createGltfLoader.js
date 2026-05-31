import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const DRACO_DECODER_PATH = 'https://threejs.org/examples/jsm/libs/draco/gltf/';

let dracoLoader;

function getDracoLoader() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    dracoLoader.preload();
  }
  return dracoLoader;
}

/** GLTFLoader with Draco support (required for MacBook models). */
export function createGltfLoader() {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  return loader;
}
