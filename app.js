import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// --- DOM Elements ---
const viewportContainer = document.getElementById('viewport-container');
const canvas = document.getElementById('webgl-canvas');
const hotspotsLayer = document.getElementById('hotspots-layer');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const dropOverlay = document.getElementById('drop-overlay');

const modelTitleEl = document.getElementById('model-title');
const modelSubtitleEl = document.getElementById('model-subtitle');
const statFilesizeEl = document.getElementById('stat-filesize');
const statVertsEl = document.getElementById('stat-verts');
const statTrisEl = document.getElementById('stat-tris');
const statFpsEl = document.getElementById('stat-fps');

const hotspotCard = document.getElementById('hotspot-card');
const hotspotCardIndex = document.getElementById('hotspot-card-index');
const hotspotCardTitle = document.getElementById('hotspot-card-title');
const hotspotCardDesc = document.getElementById('hotspot-card-desc');
const hotspotCardCoords = document.getElementById('hotspot-card-coords');
const hotspotCardClose = document.getElementById('hotspot-card-close');
const hotspotCardDelete = document.getElementById('hotspot-card-delete');
const hotspotSidebarList = document.getElementById('hotspot-sidebar-list');

const placementBanner = document.getElementById('placement-banner');
const btnCancelPlacement = document.getElementById('btn-cancel-placement');
const dialogAddHotspot = document.getElementById('dialog-add-hotspot');
const formAddHotspot = document.getElementById('form-add-hotspot');
const inputHotspotTitle = document.getElementById('input-hotspot-title');
const inputHotspotDesc = document.getElementById('input-hotspot-desc');
const dialogCoordsPreview = document.getElementById('dialog-coords-preview');

// --- Three.js Core Setup ---
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// Studio Supplemental Lights
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(2.5, 4.0, 3.0);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
rimLight.position.set(-3.0, 1.5, -2.5);
scene.add(rimLight);

// Reference Grid
const gridHelper = new THREE.GridHelper(3.0, 24, 0x38bdf8, 0x1e293b);
gridHelper.position.y = -0.002;
gridHelper.material.opacity = 0.45;
gridHelper.material.transparent = true;
scene.add(gridHelper);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
const DEFAULT_CAM_POS = new THREE.Vector3(0.0, 0.58, 1.45);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0.0, 0.32, 0.0);
camera.position.copy(DEFAULT_CAM_POS);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.25;
controls.maxDistance = 8.0;
controls.target.copy(DEFAULT_CAM_TARGET);
controls.update();

// Root group that holds the loaded GLB model and hotspot 3D anchors
const modelPivot = new THREE.Group();
scene.add(modelPivot);

// 3D Surface Cursor Ring for "Add Hotspot" raycast placement mode
const cursorRingGeo = new THREE.RingGeometry(0.014, 0.022, 32);
const cursorRingMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  side: THREE.DoubleSide,
  depthTest: false,
  transparent: true,
  opacity: 0.95
});
const surfaceCursor = new THREE.Mesh(cursorRingGeo, cursorRingMat);
surfaceCursor.visible = false;
scene.add(surfaceCursor);

// --- Loaders ---
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
gltfLoader.setDRACOLoader(dracoLoader);

// --- Application State ---
let currentModelRoot = null;
let currentActiveFileUrl = 'cells-lite.glb';
let currentCustomBlobUrl = null;
let meshList = [];
let animationMixer = null;
let gltfClips = [];
let activeClipAction = null;

let isPlayingAnim = true;
let procAnimMode = 'pulse-turntable';
let animSpeed = 1.0;
let pulseAmplitude = 0.04; // 4%
let elapsedAnimTime = 0;

let hotspotsVisible = true;
let isPlacingHotspot = false;
let pendingHotspotHit = null;
let activeHotspotId = null;

// Smooth Camera Flight State
let camTransition = null;

// Default 3D Hotspots sampled directly from cells.glb surface geometry
const hotspots = [
  {
    id: 'hs-1',
    title: 'Central Nucleus Core',
    description: 'High-density chromatin & nucleoplasm region at the center of the stylized cell body.',
    position: new THREE.Vector3(-0.0151, 0.3214, 0.3302),
    normal: new THREE.Vector3(-0.0303, 0.9875, -0.1546),
    anchorObj: null,
    domEl: null
  },
  {
    id: 'hs-2',
    title: 'Apical Membrane Crest',
    description: 'Upper phospholipid bilayer fold exhibiting strong normal-map surface relief.',
    position: new THREE.Vector3(0.0743, 0.5293, -0.0275),
    normal: new THREE.Vector3(-0.4848, 0.0202, 0.8744),
    anchorObj: null,
    domEl: null
  },
  {
    id: 'hs-3',
    title: 'Lateral Organelle Cluster',
    description: 'Peripheral organelle pocket responsible for metabolic energy transport and signaling.',
    position: new THREE.Vector3(-0.4357, 0.3004, 0.2155),
    normal: new THREE.Vector3(0.8190, 0.3700, -0.4385),
    anchorObj: null,
    domEl: null
  },
  {
    id: 'hs-4',
    title: 'Basal Cytoplasmic Matrix',
    description: 'Structural cytoskeleton base supporting cellular adhesion and intracellular tension.',
    position: new THREE.Vector3(0.3775, 0.1655, 0.2652),
    normal: new THREE.Vector3(0.5333, -0.1717, 0.8283),
    anchorObj: null,
    domEl: null
  }
];

// --- Helper: Convert Base64 fallback to ArrayBuffer ---
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// --- Load GLB Model (via URL or ArrayBuffer) ---
async function loadGlbModel(sourceUrl, displayTitle, displaySizeLabel) {
  showLoading(`Loading ${displayTitle}…`);
  try {
    let gltf;
    try {
      gltf = await gltfLoader.loadAsync(sourceUrl);
    } catch (fetchErr) {
      // If opened via file:// protocol where browser blocks fetch(), seamlessly fall back to inline Base64 buffer
      if (window.__INLINE_CELLS_GLB_BASE64__ && sourceUrl.includes('cells')) {
        const buffer = base64ToArrayBuffer(window.__INLINE_CELLS_GLB_BASE64__);
        gltf = await new Promise((resolve, reject) => {
          gltfLoader.parse(buffer, '', resolve, reject);
        });
      } else {
        throw fetchErr;
      }
    }
    setupLoadedGltf(gltf, displayTitle, displaySizeLabel);
  } catch (err) {
    console.error('Error loading GLB:', err);
    loadingText.textContent = `Failed to load ${displayTitle}. Try dragging & dropping the .glb file directly onto the window.`;
    setTimeout(hideLoading, 2600);
  }
}

function setupLoadedGltf(gltf, displayTitle, displaySizeLabel) {
  // Clean up previous model
  if (currentModelRoot) {
    modelPivot.remove(currentModelRoot);
    currentModelRoot.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
      }
    });
  }

  currentModelRoot = gltf.scene;
  modelPivot.position.set(0, 0, 0);
  modelPivot.rotation.set(0, 0, 0);
  modelPivot.scale.set(1, 1, 1);
  modelPivot.add(currentModelRoot);

  // Inspect meshes, count vertices & triangles, and snapshot original maps
  meshList = [];
  let totalVerts = 0;
  let totalTris = 0;

  currentModelRoot.traverse((child) => {
    if (child.isMesh) {
      meshList.push(child);
      const geom = child.geometry;
      if (geom) {
        const posAttr = geom.attributes.position;
        if (posAttr) totalVerts += posAttr.count;
        if (geom.index) {
          totalTris += Math.floor(geom.index.count / 3);
        } else if (posAttr) {
          totalTris += Math.floor(posAttr.count / 3);
        }
      }

      // Clone material so our configurator edits cleanly and store original textures
      if (child.material) {
        const mat = child.material;
        if (!mat.userData.originalMapsSaved) {
          mat.userData.originalMapsSaved = true;
          mat.userData.origMap = mat.map || null;
          mat.userData.origNormalMap = mat.normalMap || null;
          mat.userData.origRoughnessMap = mat.roughnessMap || null;
          mat.userData.origMetalnessMap = mat.metalnessMap || null;
        }
      }
    }
  });

  // Auto-center and normalize scale if user drops an arbitrary external .glb with huge/tiny bounds
  const box = new THREE.Box3().setFromObject(currentModelRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && (maxDim > 2.5 || maxDim < 0.15)) {
    const scaleFactor = 0.85 / maxDim;
    currentModelRoot.scale.multiplyScalar(scaleFactor);
    box.setFromObject(currentModelRoot);
    box.getCenter(center);
    currentModelRoot.position.x -= center.x;
    currentModelRoot.position.y -= box.min.y;
    currentModelRoot.position.z -= center.z;
  }

  // Update Header Stats
  modelTitleEl.textContent = displayTitle;
  statFilesizeEl.textContent = displaySizeLabel;
  statVertsEl.textContent = totalVerts.toLocaleString();
  statTrisEl.textContent = totalTris.toLocaleString();

  // Setup Embedded glTF Animations (if any)
  setupEmbeddedAnimations(gltf.animations || []);

  // Re-apply current Material Configurator state
  applyMaterialSettings();

  // Re-attach 3D Hotspot anchors to modelPivot
  rebuildHotspotDomAndAnchors();

  hideLoading();
}

// --- Material & Texture Configurator ---
const matState = {
  tint: '#ffffff',
  emissive: '#000000',
  mono: false,
  roughness: 0.65,
  metalness: 0.10,
  normalScale: 1.0,
  opacity: 1.0,
  useBaseColorMap: true,
  useNormalMap: true,
  useRmMap: true,
  wireframe: false
};

function applyMaterialSettings() {
  meshList.forEach((mesh) => {
    const mat = mesh.material;
    if (!mat) return;

    const showColorTex = matState.useBaseColorMap && !matState.mono;
    mat.map = showColorTex ? mat.userData.origMap : null;
    mat.normalMap = matState.useNormalMap ? mat.userData.origNormalMap : null;
    mat.roughnessMap = matState.useRmMap ? mat.userData.origRoughnessMap : null;
    mat.metalnessMap = matState.useRmMap ? mat.userData.origMetalnessMap : null;

    if (mat.color) mat.color.set(matState.tint);
    if (mat.emissive) mat.emissive.set(matState.emissive);
    if (typeof mat.roughness === 'number') mat.roughness = matState.roughness;
    if (typeof mat.metalness === 'number') mat.metalness = matState.metalness;
    if (mat.normalScale) mat.normalScale.set(matState.normalScale, matState.normalScale);

    mat.wireframe = matState.wireframe;
    mat.transparent = matState.opacity < 0.99;
    mat.opacity = matState.opacity;
    mat.depthWrite = matState.opacity > 0.5;
    mat.needsUpdate = true;
  });
}

// --- Embedded + Procedural Animations ---
const selectGltfClip = document.getElementById('select-gltf-clip');
const clipStatusNote = document.getElementById('clip-status-note');

function setupEmbeddedAnimations(animations) {
  if (animationMixer) {
    animationMixer.stopAllAction();
    animationMixer = null;
  }
  gltfClips = animations;
  selectGltfClip.innerHTML = '';

  if (animations.length === 0) {
    const opt = document.createElement('option');
    opt.value = 'none';
    opt.textContent = 'No embedded keyframe clips (0 tracks)';
    selectGltfClip.appendChild(opt);
    clipStatusNote.innerHTML = 'This <code>.glb</code> has 0 embedded keyframe clips. Active procedural 3D bio-animations are driving the model below.';
  } else {
    animationMixer = new THREE.AnimationMixer(currentModelRoot);
    animations.forEach((clip, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `${idx + 1}. ${clip.name || 'Animation Clip'} (${clip.duration.toFixed(1)}s)`;
      selectGltfClip.appendChild(opt);
    });
    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = 'Disable Embedded Clip';
    selectGltfClip.appendChild(noneOpt);

    clipStatusNote.textContent = `Found ${animations.length} embedded keyframe animation clip(s)! Playing clip #1.`;
    playEmbeddedClip(0);
  }
}

function playEmbeddedClip(index) {
  if (!animationMixer) return;
  animationMixer.stopAllAction();
  if (index === 'none' || !gltfClips[index]) {
    activeClipAction = null;
    return;
  }
  activeClipAction = animationMixer.clipAction(gltfClips[index]);
  activeClipAction.reset().play();
}

selectGltfClip.addEventListener('change', (e) => {
  const val = e.target.value;
  playEmbeddedClip(val === 'none' ? 'none' : Number(val));
});

// --- 3D Hotspots Management ---
function rebuildHotspotDomAndAnchors() {
  hotspotsLayer.innerHTML = '';
  hotspotSidebarList.innerHTML = '';

  // Remove old anchor objects from modelPivot
  hotspots.forEach((hs) => {
    if (hs.anchorObj && hs.anchorObj.parent) {
      hs.anchorObj.parent.remove(hs.anchorObj);
    }
  });

  hotspots.forEach((hs, idx) => {
    // 1. Create 3D anchor inside modelPivot so pin tracks procedural rotation/pulse/float
    const anchor = new THREE.Object3D();
    anchor.position.copy(hs.position);
    modelPivot.add(anchor);
    hs.anchorObj = anchor;

    // 2. Create 2D projected pin button
    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'hotspot-pin' + (hs.id === activeHotspotId ? ' active' : '');
    pinBtn.setAttribute('aria-label', `Hotspot ${idx + 1}: ${hs.title}`);
    pinBtn.innerHTML = `<span>${idx + 1}</span><span class="hotspot-pin-label">${escapeHtml(hs.title)}</span>`;
    pinBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selectHotspot(hs.id);
    });
    hotspotsLayer.appendChild(pinBtn);
    hs.domEl = pinBtn;

    // 3. Create Sidebar List Item
    const item = document.createElement('div');
    item.className = 'hotspot-list-item' + (hs.id === activeHotspotId ? ' active' : '');
    item.innerHTML = `
      <h4><span class="hotspot-card-badge">#${idx + 1}</span> ${escapeHtml(hs.title)}</h4>
      <p>${escapeHtml(hs.description)}</p>
    `;
    item.addEventListener('click', () => selectHotspot(hs.id));
    hotspotSidebarList.appendChild(item);
  });

  hotspotsLayer.style.display = hotspotsVisible ? 'block' : 'none';
}

function selectHotspot(id) {
  const index = hotspots.findIndex((h) => h.id === id);
  if (index === -1) return;
  const hs = hotspots[index];
  activeHotspotId = id;

  // Update active classes
  hotspots.forEach((h) => {
    if (h.domEl) h.domEl.classList.toggle('active', h.id === id);
  });
  Array.from(hotspotSidebarList.children).forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Populate floating detail card
  hotspotCardIndex.textContent = `#${index + 1}`;
  hotspotCardTitle.textContent = hs.title;
  hotspotCardDesc.textContent = hs.description;
  hotspotCardCoords.textContent = `XYZ: (${hs.position.x.toFixed(2)}, ${hs.position.y.toFixed(2)}, ${hs.position.z.toFixed(2)})`;
  hotspotCard.hidden = false;

  // Compute world position & normal of the hotspot and fly camera smoothly toward it
  const worldPos = new THREE.Vector3();
  hs.anchorObj.getWorldPosition(worldPos);

  const worldNormal = hs.normal.clone().applyQuaternion(modelPivot.quaternion).normalize();
  const viewDir = worldPos.clone().sub(DEFAULT_CAM_TARGET).normalize();
  const offsetDir = viewDir.add(worldNormal.multiplyScalar(0.35)).normalize();
  if (offsetDir.lengthSq() < 0.01) offsetDir.set(0, 0.3, 1).normalize();

  const desiredCamPos = worldPos.clone().add(offsetDir.multiplyScalar(0.75));
  desiredCamPos.y = Math.max(0.12, desiredCamPos.y);

  flyCameraTo(desiredCamPos, worldPos);
}

hotspotCardClose.addEventListener('click', () => {
  activeHotspotId = null;
  hotspotCard.hidden = true;
  hotspots.forEach((h) => h.domEl?.classList.remove('active'));
  Array.from(hotspotSidebarList.children).forEach((el) => el.classList.remove('active'));
});

hotspotCardDelete.addEventListener('click', () => {
  if (!activeHotspotId) return;
  const idx = hotspots.findIndex((h) => h.id === activeHotspotId);
  if (idx !== -1) {
    hotspots.splice(idx, 1);
    activeHotspotId = null;
    hotspotCard.hidden = true;
    rebuildHotspotDomAndAnchors();
  }
});

// Project 3D Hotspots onto 2D Viewport Overlay every frame
const projVec = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();
const worldNorm = new THREE.Vector3();
const camToPin = new THREE.Vector3();

function updateHotspotsProjection() {
  if (!hotspotsVisible) return;
  const rect = canvas.getBoundingClientRect();
  normalMatrix.getNormalMatrix(modelPivot.matrixWorld);

  hotspots.forEach((hs) => {
    if (!hs.anchorObj || !hs.domEl) return;
    hs.anchorObj.getWorldPosition(projVec);

    // Check facing ratio relative to camera
    worldNorm.copy(hs.normal).applyMatrix3(normalMatrix).normalize();
    camToPin.copy(projVec).sub(camera.position).normalize();
    const dot = worldNorm.dot(camToPin);

    projVec.project(camera);

    // Behind camera clipping plane
    if (projVec.z > 1) {
      hs.domEl.style.display = 'none';
      return;
    }

    const x = (projVec.x * 0.5 + 0.5) * rect.width;
    const y = (-projVec.y * 0.5 + 0.5) * rect.height;

    hs.domEl.style.display = 'flex';
    hs.domEl.style.left = `${x}px`;
    hs.domEl.style.top = `${y}px`;
    hs.domEl.classList.toggle('occluded', dot > 0.25);
  });
}

// --- Raycasting to Place New 3D Surface Hotspots ---
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function setPlacementMode(enabled) {
  isPlacingHotspot = enabled;
  viewportContainer.classList.toggle('placing-hotspot', enabled);
  placementBanner.hidden = !enabled;
  const btnAdd = document.getElementById('btn-add-hotspot');
  btnAdd.classList.toggle('active', enabled);
  btnAdd.setAttribute('aria-pressed', String(enabled));
  if (!enabled) {
    surfaceCursor.visible = false;
  }
}

document.getElementById('btn-add-hotspot').addEventListener('click', () => {
  setPlacementMode(!isPlacingHotspot);
});

document.getElementById('btn-sidebar-add-hotspot').addEventListener('click', () => {
  setPlacementMode(true);
});

btnCancelPlacement.addEventListener('click', () => setPlacementMode(false));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isPlacingHotspot) {
    setPlacementMode(false);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!isPlacingHotspot || meshList.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(meshList, true);
  if (hits.length > 0) {
    const hit = hits[0];
    surfaceCursor.visible = true;
    surfaceCursor.position.copy(hit.point);
    if (hit.face) {
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      surfaceCursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      surfaceCursor.position.addScaledVector(n, 0.003);
    }
  } else {
    surfaceCursor.visible = false;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  if (!isPlacingHotspot || e.button !== 0 || meshList.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(meshList, true);
  if (hits.length > 0) {
    const hit = hits[0];
    // Convert hit point & normal into modelPivot local space
    const localPoint = modelPivot.worldToLocal(hit.point.clone());
    const worldNormal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);
    const invPivotQuat = modelPivot.quaternion.clone().invert();
    const localNormal = worldNormal.applyQuaternion(invPivotQuat).normalize();

    pendingHotspotHit = { position: localPoint, normal: localNormal };
    setPlacementMode(false);

    dialogCoordsPreview.textContent = `Surface Point: (${localPoint.x.toFixed(3)}, ${localPoint.y.toFixed(3)}, ${localPoint.z.toFixed(3)})`;
    inputHotspotTitle.value = '';
    inputHotspotDesc.value = '';
    dialogAddHotspot.showModal();
    inputHotspotTitle.focus();
  }
});

formAddHotspot.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pendingHotspotHit) return;
  const newId = 'hs-' + Date.now();
  hotspots.push({
    id: newId,
    title: inputHotspotTitle.value.trim() || `Surface Feature #${hotspots.length + 1}`,
    description: inputHotspotDesc.value.trim() || 'User-defined 3D surface annotation.',
    position: pendingHotspotHit.position,
    normal: pendingHotspotHit.normal,
    anchorObj: null,
    domEl: null
  });
  pendingHotspotHit = null;
  dialogAddHotspot.close();
  rebuildHotspotDomAndAnchors();
  selectHotspot(newId);
});

document.getElementById('btn-close-dialog').addEventListener('click', () => dialogAddHotspot.close());
document.getElementById('btn-cancel-dialog').addEventListener('click', () => dialogAddHotspot.close());

// --- Smooth Camera Flight ---
function flyCameraTo(targetCamPos, targetLookAt) {
  camTransition = {
    startPos: camera.position.clone(),
    endPos: targetCamPos.clone(),
    startTarget: controls.target.clone(),
    endTarget: targetLookAt.clone(),
    progress: 0
  };
}

// Cancel automatic flight if user manually grabs OrbitControls
controls.addEventListener('start', () => {
  camTransition = null;
});

// --- UI Event Listeners ---

// 1. Sidebar Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('aria-controls');
    tabBtns.forEach((b) => {
      const isSelected = b === btn;
      b.classList.toggle('active', isSelected);
      b.setAttribute('aria-selected', String(isSelected));
    });
    tabPanels.forEach((panel) => {
      panel.hidden = panel.id !== targetId;
    });
  });
});

// 2. LOD / Optimized Size Preset Switcher
document.querySelectorAll('#lod-preset-list .preset-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#lod-preset-list .preset-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const lodFile = btn.dataset.lod;
    const sizeText = btn.dataset.size;
    currentActiveFileUrl = lodFile;
    loadGlbModel(lodFile, lodFile, sizeText);
  });
});

// 3. Download Active Optimized GLB Button
document.getElementById('btn-download-glb').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = currentCustomBlobUrl || currentActiveFileUrl;
  a.download = currentCustomBlobUrl ? modelTitleEl.textContent : currentActiveFileUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// 4. Material Swatches & Sliders
document.querySelectorAll('#color-swatches .swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#color-swatches .swatch-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    matState.tint = btn.dataset.tint || '#ffffff';
    matState.emissive = btn.dataset.emissive || '#000000';
    matState.mono = btn.dataset.mono === 'true';
    document.getElementById('input-custom-color').value = matState.tint;
    applyMaterialSettings();
  });
});

document.getElementById('input-custom-color').addEventListener('input', (e) => {
  matState.tint = e.target.value;
  matState.mono = false;
  document.querySelectorAll('#color-swatches .swatch-btn').forEach((b) => b.classList.remove('active'));
  applyMaterialSettings();
});

function bindSlider(sliderId, outputId, formatFn, onChangeFn) {
  const slider = document.getElementById(sliderId);
  const out = document.getElementById(outputId);
  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    out.textContent = formatFn(val);
    onChangeFn(val);
  });
}

bindSlider('slider-roughness', 'out-roughness', (v) => v.toFixed(2), (v) => {
  matState.roughness = v;
  applyMaterialSettings();
});

bindSlider('slider-metalness', 'out-metalness', (v) => v.toFixed(2), (v) => {
  matState.metalness = v;
  applyMaterialSettings();
});

bindSlider('slider-normal', 'out-normal', (v) => v.toFixed(2), (v) => {
  matState.normalScale = v;
  applyMaterialSettings();
});

bindSlider('slider-opacity', 'out-opacity', (v) => v.toFixed(2), (v) => {
  matState.opacity = v;
  applyMaterialSettings();
});

bindSlider('slider-exposure', 'out-exposure', (v) => v.toFixed(2), (v) => {
  renderer.toneMappingExposure = v;
});

document.getElementById('chk-basecolor').addEventListener('change', (e) => {
  matState.useBaseColorMap = e.target.checked;
  applyMaterialSettings();
});

document.getElementById('chk-normalmap').addEventListener('change', (e) => {
  matState.useNormalMap = e.target.checked;
  applyMaterialSettings();
});

document.getElementById('chk-rmmap').addEventListener('change', (e) => {
  matState.useRmMap = e.target.checked;
  applyMaterialSettings();
});

document.getElementById('chk-wireframe').addEventListener('change', (e) => {
  matState.wireframe = e.target.checked;
  applyMaterialSettings();
});

// 5. Procedural Animation Modes & Playback Controls
document.querySelectorAll('#proc-anim-list .preset-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#proc-anim-list .preset-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    procAnimMode = btn.dataset.anim;
    if (procAnimMode === 'none') {
      modelPivot.position.set(0, 0, 0);
      modelPivot.scale.set(1, 1, 1);
    }
  });
});

const btnPlayPause = document.getElementById('btn-play-pause');
btnPlayPause.addEventListener('click', () => {
  isPlayingAnim = !isPlayingAnim;
  btnPlayPause.textContent = isPlayingAnim ? 'Pause Animation' : 'Resume Animation';
});

bindSlider('slider-anim-speed', 'out-anim-speed', (v) => `${v.toFixed(1)}x`, (v) => {
  animSpeed = v;
  if (animationMixer) animationMixer.timeScale = v;
});

bindSlider('slider-pulse-amp', 'out-pulse-amp', (v) => `${v}%`, (v) => {
  pulseAmplitude = v / 100;
});

// 6. Bottom Camera & Viewport Toolbar
document.querySelectorAll('[data-cam]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.cam;
    if (view === 'reset') {
      flyCameraTo(DEFAULT_CAM_POS, DEFAULT_CAM_TARGET);
    } else if (view === 'front') {
      flyCameraTo(new THREE.Vector3(0, 0.34, 1.45), DEFAULT_CAM_TARGET);
    } else if (view === 'side') {
      flyCameraTo(new THREE.Vector3(1.45, 0.34, 0), DEFAULT_CAM_TARGET);
    } else if (view === 'top') {
      flyCameraTo(new THREE.Vector3(0, 1.65, 0.05), DEFAULT_CAM_TARGET);
    }
  });
});

const btnToggleHotspots = document.getElementById('btn-toggle-hotspots');
btnToggleHotspots.addEventListener('click', () => {
  hotspotsVisible = !hotspotsVisible;
  btnToggleHotspots.classList.toggle('active', hotspotsVisible);
  btnToggleHotspots.setAttribute('aria-pressed', String(hotspotsVisible));
  hotspotsLayer.style.display = hotspotsVisible ? 'block' : 'none';
  if (!hotspotsVisible) hotspotCard.hidden = true;
});

const btnToggleGrid = document.getElementById('btn-toggle-grid');
btnToggleGrid.classList.add('active');
btnToggleGrid.addEventListener('click', () => {
  gridHelper.visible = !gridHelper.visible;
  btnToggleGrid.classList.toggle('active', gridHelper.visible);
  btnToggleGrid.setAttribute('aria-pressed', String(gridHelper.visible));
});

document.getElementById('btn-screenshot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${modelTitleEl.textContent.replace(/\.[^.]+$/, '')}-snapshot.png`;
  a.click();
});

// 7. File Input & Drag-and-Drop Custom .GLB Loader
function handleCustomFile(file) {
  if (!file) return;
  if (currentCustomBlobUrl) URL.revokeObjectURL(currentCustomBlobUrl);
  currentCustomBlobUrl = URL.createObjectURL(file);
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  modelSubtitleEl.textContent = 'Custom Loaded 3D Asset';
  loadGlbModel(currentCustomBlobUrl, file.name, `${sizeMB} MB`);
}

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleCustomFile(file);
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.hidden = false;
});

dropOverlay.addEventListener('dragleave', (e) => {
  if (e.target === dropOverlay) {
    dropOverlay.hidden = true;
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (file && /\.(glb|gltf)$/i.test(file.name)) {
    handleCustomFile(file);
  }
});

// --- Resize Handling ---
function onResize() {
  const rect = viewportContainer.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}
window.addEventListener('resize', onResize);
onResize();

// --- Utilities ---
function showLoading(msg) {
  loadingText.textContent = msg;
  loadingOverlay.hidden = false;
}
function hideLoading() {
  loadingOverlay.hidden = true;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Render & Animation Loop ---
const clock = new THREE.Clock();
let frameCount = 0;
let fpsAccumTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  frameCount++;
  fpsAccumTime += dt;
  if (fpsAccumTime >= 0.5) {
    statFpsEl.textContent = String(Math.min(144, Math.round(frameCount / fpsAccumTime)));
    frameCount = 0;
    fpsAccumTime = 0;
  }

  // Update Embedded GLB Keyframe Mixer
  if (animationMixer && isPlayingAnim) {
    animationMixer.update(dt * animSpeed);
  }

  // Update Procedural 3D Motion
  if (isPlayingAnim && procAnimMode !== 'none') {
    elapsedAnimTime += dt * animSpeed;

    if (procAnimMode === 'pulse-turntable') {
      modelPivot.rotation.y += dt * 0.38 * animSpeed;
      const s = 1.0 + Math.sin(elapsedAnimTime * 2.4) * pulseAmplitude;
      const sy = 1.0 + Math.cos(elapsedAnimTime * 2.4) * (pulseAmplitude * 0.75);
      modelPivot.scale.set(s, sy, s);
      modelPivot.position.y = Math.sin(elapsedAnimTime * 1.5) * 0.012;
    } else if (procAnimMode === 'respiration') {
      const s = 1.0 + Math.sin(elapsedAnimTime * 2.6) * pulseAmplitude;
      const sy = 1.0 + Math.cos(elapsedAnimTime * 2.6) * (pulseAmplitude * 0.8);
      modelPivot.scale.set(s, sy, s);
      modelPivot.position.y = 0;
    } else if (procAnimMode === 'float') {
      modelPivot.position.y = Math.sin(elapsedAnimTime * 1.8) * 0.035;
      modelPivot.rotation.z = Math.sin(elapsedAnimTime * 1.1) * 0.06;
      modelPivot.rotation.x = Math.cos(elapsedAnimTime * 0.9) * 0.05;
      modelPivot.scale.set(1, 1, 1);
    } else if (procAnimMode === 'turntable') {
      modelPivot.rotation.y += dt * 0.55 * animSpeed;
      modelPivot.scale.set(1, 1, 1);
      modelPivot.position.y = 0;
    }
  }

  // Update Camera Smooth Flight Transition
  if (camTransition) {
    camTransition.progress = Math.min(1, camTransition.progress + dt * 2.4);
    const t = 1 - Math.pow(1 - camTransition.progress, 3); // cubic ease-out
    camera.position.lerpVectors(camTransition.startPos, camTransition.endPos, t);
    controls.target.lerpVectors(camTransition.startTarget, camTransition.endTarget, t);
    if (camTransition.progress >= 1) {
      camTransition = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
  updateHotspotsProjection();
}

// Start Loop & Load Default Ultra-Lite Optimized cells-lite.glb
animate();
loadGlbModel('cells-lite.glb', 'cells-lite.glb', '2.61 MB (-95.7%)');
