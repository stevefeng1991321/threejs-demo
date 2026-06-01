import * as THREE from 'three';

const HAZARDS = [
  {
    id: 'damagedPole',
    label: 'Damaged conductor on pole',
    detail: 'Storm damage has exposed live conductors at the top of the pole.',
  },
  {
    id: 'waterPuddle',
    label: 'Water pooling near energised equipment',
    detail: 'Standing water creates an electrocution risk around the pole base.',
  },
  {
    id: 'liftProximity',
    label: 'Scissor lift inside exclusion zone',
    detail: 'The scissor lift is parked too close to the energised pole.',
  },
];

const TASKS = [
  {
    id: 'isolateCircuit',
    label: 'Isolate the circuit',
    detail: 'Flip the isolation switch to de-energise the pole.',
  },
  {
    id: 'moveLift',
    label: 'Move scissor lift to safe distance',
    detail: 'Relocate the lift outside the 3 m exclusion zone.',
  },
  {
    id: 'placeBoundary',
    label: 'Mark the work zone boundary',
    detail: 'Place barrier tape to define the safe work area.',
  },
];

function makeClickTarget(position, size, name) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  mesh.position.copy(position);
  mesh.name = name;
  mesh.userData.clickable = true;
  return mesh;
}

export function createSafetyScenario({
  scene,
  camera,
  renderer,
  controls,
  workspaceModels,
  layout,
  onHeadlineChange,
}) {
  if (!layout) throw new Error('Safety scenario requires a site layout');

  const {
    poleCenter,
    poleTopY,
    liftUnsafe,
    liftSafe,
    exclusionRadius,
    switchPosition,
  } = layout;
  const identified = new Set();
  const completed = new Set();
  let phase = 'intro';
  let energized = true;
  let boundaryPlaced = false;
  let liftMoving = false;
  let liftMoveT = 0;
  let liftMoveFrom = new THREE.Vector3();
  let liftMoveTo = new THREE.Vector3();
  let time = 0;

  const root = new THREE.Group();
  root.name = 'safetyScenario';
  scene.add(root);

  const forklift = workspaceModels.forklift.object;
  forklift.position.copy(liftUnsafe);

  const hazardMeshes = {};
  const interactMeshes = {};

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xff4422,
      emissive: 0xff2200,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9,
    }),
  );
  spark.position.set(poleCenter.x, poleTopY - 0.08, poleCenter.z);
  root.add(spark);

  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    new THREE.MeshStandardMaterial({
      color: 0x3a6a8a,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(poleCenter.x - 0.15, 0.015, poleCenter.z + 0.35);
  root.add(puddle);

  hazardMeshes.damagedPole = makeClickTarget(spark.position.clone(), 0.25, 'hazard-damagedPole');
  hazardMeshes.damagedPole.userData.hazardId = 'damagedPole';
  root.add(hazardMeshes.damagedPole);

  hazardMeshes.waterPuddle = makeClickTarget(puddle.position.clone(), 0.45, 'hazard-waterPuddle');
  hazardMeshes.waterPuddle.position.y = 0.05;
  hazardMeshes.waterPuddle.userData.hazardId = 'waterPuddle';
  root.add(hazardMeshes.waterPuddle);

  hazardMeshes.liftProximity = makeClickTarget(new THREE.Vector3(), 0.7, 'hazard-liftProximity');
  hazardMeshes.liftProximity.userData.hazardId = 'liftProximity';
  root.add(hazardMeshes.liftProximity);

  const switchPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.52, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.6, roughness: 0.4, emissive: 0x000000 }),
  );
  switchPanel.position.copy(switchPosition);
  switchPanel.userData.clickable = true;
  switchPanel.userData.taskId = 'isolateCircuit';
  root.add(switchPanel);

  // Larger invisible hit target so it’s easy to click.
  const switchHit = makeClickTarget(new THREE.Vector3(), 0.55, 'task-isolateCircuit');
  switchHit.userData.taskId = 'isolateCircuit';
  switchPanel.add(switchHit);

  const switchLever = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.12, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0x440000, emissiveIntensity: 0.3 }),
  );
  switchLever.position.set(0, 0.02, 0.05);
  switchPanel.add(switchLever);
  interactMeshes.isolateCircuit = switchPanel;

  const boundaryMarker = new THREE.Mesh(
    new THREE.RingGeometry(exclusionRadius - 0.05, exclusionRadius + 0.05, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
  );
  boundaryMarker.rotation.x = -Math.PI / 2;
  boundaryMarker.position.set(poleCenter.x, 0.02, poleCenter.z);
  boundaryMarker.userData.clickable = true;
  boundaryMarker.userData.taskId = 'placeBoundary';
  root.add(boundaryMarker);
  interactMeshes.placeBoundary = boundaryMarker;

  const safeZoneMarker = makeClickTarget(
    new THREE.Vector3(liftSafe.x, liftSafe.y + 0.3, liftSafe.z),
    0.6,
    'safe-zone',
  );
  safeZoneMarker.userData.taskId = 'moveLift';
  root.add(safeZoneMarker);
  interactMeshes.moveLift = safeZoneMarker;

  const modal = document.getElementById('mission-modal');
  const modalTitle = document.getElementById('mission-modal-title');
  const modalBody = document.getElementById('mission-modal-body');
  const modalAction = document.getElementById('mission-modal-action');
  const panel = document.getElementById('mission-panel');
  const circuitStatusEl = document.getElementById('mission-circuit-status');
  const phaseEl = document.getElementById('mission-phase');
  const checklistEl = document.getElementById('mission-checklist');
  const instructionEl = document.getElementById('mission-instruction');
  const toastEl = document.getElementById('mission-toast');
  const restoreBtn = document.getElementById('mission-restore');

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let toastTimer = null;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3200);
  }

  function showModal(title, body, actionLabel, onAction) {
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalAction.textContent = actionLabel;
    modalAction.onclick = onAction;
    modal.classList.remove('hidden');
  }

  function hideModal() {
    modal.classList.add('hidden');
    modalAction.onclick = null;
  }

  function setPhase(next) {
    phase = next;
    panel.classList.toggle('hidden', phase === 'intro');
    updateUI();
    onHeadlineChange?.(phase);
  }

  function updateCircuitStatus() {
    if (!circuitStatusEl) return;
    if (phase === 'intro' || phase === 'identify') {
      circuitStatusEl.textContent = 'Circuit: ⚡ Energized';
      circuitStatusEl.style.color = '#ffd26a';
      return;
    }
    if (energized) {
      circuitStatusEl.textContent = 'Circuit: ⚡ Energized';
      circuitStatusEl.style.color = '#ffd26a';
    } else {
      circuitStatusEl.textContent = 'Circuit: ✓ Isolated';
      circuitStatusEl.style.color = '#7dffa0';
    }
  }

  function updateLiftHazardPosition() {
    const box = new THREE.Box3().setFromObject(forklift);
    box.getCenter(hazardMeshes.liftProximity.position);
  }

  function renderChecklist() {
    if (phase === 'identify') {
      checklistEl.innerHTML = HAZARDS.map((h) => {
        const done = identified.has(h.id);
        return `<li class="${done ? 'done' : ''}">${done ? '✓' : '○'} ${h.label}</li>`;
      }).join('');
      instructionEl.textContent = `Click each hazard in the scene (${identified.size}/${HAZARDS.length} found).`;
      phaseEl.textContent = 'Step 1 — Identify hazards';
      return;
    }

    if (phase === 'remediate') {
      checklistEl.innerHTML = TASKS.map((t) => {
        const done = completed.has(t.id);
        return `<li class="${done ? 'done' : ''}">${done ? '✓' : '○'} ${t.label}</li>`;
      }).join('');
      instructionEl.textContent = 'Make the site safe: isolate power, move the lift, then mark the boundary.';
      phaseEl.textContent = 'Step 2 — Make it safe';
      return;
    }

    if (phase === 'restore') {
      checklistEl.innerHTML =
        '<li class="done">✓ All hazards identified</li><li class="done">✓ Site made safe</li><li>○ Restore power</li>';
      instructionEl.textContent = 'All safety checks passed. Restore power when ready.';
      phaseEl.textContent = 'Step 3 — Restore power';
      return;
    }

    if (phase === 'complete') {
      checklistEl.innerHTML =
        '<li class="done">✓ All hazards identified</li><li class="done">✓ Site made safe</li><li class="done">✓ Power restored</li>';
      instructionEl.textContent = 'You successfully identified hazards, secured the work area, and restored power.';
      phaseEl.textContent = 'Mission complete';
    }
  }

  function updateUI() {
    renderChecklist();
    updateCircuitStatus();

    spark.visible = energized;
    puddle.visible = true;

    // Make the switch visually “call to action” until isolated.
    if (phase === 'remediate' && energized) {
      switchPanel.material.emissive?.setHex?.(0x223366);
    }

    safeZoneMarker.visible = phase === 'remediate' && !completed.has('moveLift');
    boundaryMarker.material.opacity =
      phase === 'remediate' && !boundaryPlaced ? 0.35 : boundaryPlaced ? 0.85 : 0;

    restoreBtn?.classList.toggle('hidden', phase !== 'restore');

    if (phase === 'complete') {
      spark.visible = false;
      puddle.visible = false;
    }
  }

  function beginScenario() {
    hideModal();
    setPhase('identify');
    showToast('Inspect the site and click each hazard.');
  }

  function allHazardsIdentified() {
    return HAZARDS.every((h) => identified.has(h.id));
  }

  function allTasksComplete() {
    return TASKS.every((t) => completed.has(t.id));
  }

  function identifyHazard(id) {
    if (phase !== 'identify' || identified.has(id)) return;
    const hazard = HAZARDS.find((h) => h.id === id);
    identified.add(id);
    showToast(hazard.detail);
    updateUI();

    if (allHazardsIdentified()) {
      setTimeout(() => {
        showModal(
          'Hazards logged',
          'Good work. Now isolate the circuit, move the scissor lift back, and mark a work zone boundary before any repair begins.',
          'Begin making safe',
          () => {
            hideModal();
            setPhase('remediate');
            showToast('Click the isolation switch on the building.');
          },
        );
      }, 600);
    }
  }

  function isolateCircuit() {
    if (phase !== 'remediate' || completed.has('isolateCircuit')) return;
    energized = false;
    spark.visible = false;
    switchLever.rotation.x = -Math.PI / 3;
    switchLever.material.color.setHex(0x33cc66);
    switchLever.material.emissive.setHex(0x114422);
    switchPanel.material.emissive?.setHex?.(0x113322);
    completed.add('isolateCircuit');
    showToast('Circuit isolated — pole de-energised.');
    updateUI();
    checkComplete();
  }

  function moveLift() {
    if (phase !== 'remediate' || completed.has('moveLift') || liftMoving) return;
    liftMoving = true;
    liftMoveT = 0;
    liftMoveFrom.copy(forklift.position);
    liftMoveTo.copy(liftSafe);
    showToast('Moving scissor lift to safe distance…');
  }

  function placeBoundary() {
    if (phase !== 'remediate' || completed.has('placeBoundary')) return;
    boundaryPlaced = true;
    boundaryMarker.material.opacity = 0.85;
    completed.add('placeBoundary');
    showToast('Work zone boundary marked.');
    updateUI();
    checkComplete();
  }

  function restorePower() {
    if (phase !== 'restore') return;
    if (!allHazardsIdentified() || !allTasksComplete() || energized) return;

    // For this prototype, “restoring power” is the final confirmation step.
    setPhase('complete');
    showModal(
      'Mission complete',
      'You successfully identified hazards, secured the work area, and safely restored power.',
      'Restart scenario',
      resetScenario,
    );
  }

  function checkComplete() {
    if (!allTasksComplete()) return;
    setPhase('restore');
    showToast('Safety actions complete. Restore power when ready.');
    updateUI();
  }

  function resetScenario() {
    identified.clear();
    completed.clear();
    energized = true;
    boundaryPlaced = false;
    liftMoving = false;
    liftMoveT = 0;
    forklift.position.copy(liftUnsafe);
    switchLever.rotation.x = 0;
    switchLever.material.color.setHex(0xff3333);
    switchLever.material.emissive.setHex(0x440000);
    boundaryMarker.material.opacity = 0;
    hideModal();
    showModal(
      'Storm damage reported',
      'A severe storm has damaged the local power network. You have arrived on site to make it safe before repairs begin. First, identify every hazard — then isolate power, reposition equipment, and mark the work zone.',
      'Begin inspection',
      beginScenario,
    );
    setPhase('intro');
  }

  function setHoverCursor(enabled) {
    renderer.domElement.style.cursor = enabled ? 'pointer' : '';
  }

  function applyHoverHighlight(object) {
    // Lightweight highlight by boosting emissive/opacity on known interactive visuals.
    const highlight = (mesh, on) => {
      if (!mesh?.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (on) {
          mat.userData._oldEmissive = mat.emissive?.getHex?.() ?? null;
          mat.userData._oldOpacity = mat.opacity ?? null;
          if (mat.emissive) mat.emissive.setHex(0x55aaff);
          if (mat.transparent) mat.opacity = Math.min(1, (mat.opacity ?? 1) + 0.15);
        } else {
          if (mat.emissive && mat.userData._oldEmissive !== null) mat.emissive.setHex(mat.userData._oldEmissive);
          if (mat.userData._oldOpacity !== null) mat.opacity = mat.userData._oldOpacity;
        }
      });
    };

    highlight(spark, false);
    highlight(puddle, false);
    highlight(switchPanel, false);
    highlight(boundaryMarker, false);

    if (!object) return;
    if (isForklift(object)) return; // forklift highlight handled by cursor only for now
    if (object === switchPanel || object.parent === switchPanel) highlight(switchPanel, true);
    if (object === boundaryMarker || object.parent === boundaryMarker) highlight(boundaryMarker, true);
    if (object === spark || object.parent === spark) highlight(spark, true);
    if (object === puddle || object.parent === puddle) highlight(puddle, true);
  }

  function onPointerMove(event) {
    if (phase === 'intro' || liftMoving) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const targets =
      phase === 'identify'
        ? [spark, puddle, forklift]
        : [interactMeshes.isolateCircuit, interactMeshes.moveLift, interactMeshes.placeBoundary, forklift].filter(
            Boolean,
          );

    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) {
      setHoverCursor(false);
      applyHoverHighlight(null);
      return;
    }

    setHoverCursor(true);
    applyHoverHighlight(hits[0].object);
  }

  function isForklift(object) {
    let current = object;
    while (current) {
      if (current === forklift) return true;
      current = current.parent;
    }
    return false;
  }

  function onClick(event) {
    if (phase === 'intro' || liftMoving) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const targets =
      phase === 'identify'
        ? [...Object.values(hazardMeshes), forklift]
        : phase === 'restore'
          ? [forklift] // no scene clicks needed; button handles restore
        : [
            interactMeshes.isolateCircuit,
            interactMeshes.moveLift,
            interactMeshes.placeBoundary,
            forklift,
          ].filter(Boolean);

    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return;

    let obj = hits[0].object;
    while (obj && !obj.userData.hazardId && !obj.userData.taskId && !isForklift(obj) && obj.parent) {
      obj = obj.parent;
    }

    if (phase === 'identify') {
      const hazardId = obj.userData.hazardId ?? obj.parent?.userData?.hazardId;
      if (hazardId) identifyHazard(hazardId);
      else if (isForklift(obj)) identifyHazard('liftProximity');
      return;
    }

    if (phase === 'restore') return;

    if (isForklift(obj)) {
      moveLift();
      return;
    }

    const taskId = obj.userData.taskId ?? obj.parent?.userData?.taskId;
    if (taskId === 'isolateCircuit') isolateCircuit();
    if (taskId === 'moveLift') moveLift();
    if (taskId === 'placeBoundary') placeBoundary();
  }

  function update() {
    time += 0.016;
    updateLiftHazardPosition();

    if (energized && spark.visible) {
      spark.material.emissiveIntensity = 1.5 + Math.sin(time * 8) * 0.8;
      spark.scale.setScalar(1 + Math.sin(time * 6) * 0.15);
    }

    if (liftMoving) {
      liftMoveT = Math.min(liftMoveT + 0.02, 1);
      const eased = 1 - (1 - liftMoveT) ** 3;
      forklift.position.lerpVectors(liftMoveFrom, liftMoveTo, eased);
      if (liftMoveT >= 1) {
        liftMoving = false;
        completed.add('moveLift');
        updateUI();
        checkComplete();
      }
    }
  }

  function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    scene.remove(root);
    root.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((m) => m.dispose());
      }
    });
    hideModal();
    panel.classList.add('hidden');
    clearTimeout(toastTimer);
    restoreBtn?.removeEventListener('click', restorePower);
  }

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  panel.classList.remove('hidden');
  restoreBtn?.addEventListener('click', restorePower);

  showModal(
    'Storm damage reported',
    'A severe storm has damaged the local power network. You have arrived on site to make it safe before repairs begin. First, identify every hazard — then isolate power, reposition equipment, and mark the work zone.',
    'Begin inspection',
    beginScenario,
  );

  updateUI();

  return { update, dispose };
}
