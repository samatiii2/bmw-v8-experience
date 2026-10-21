import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

// An explanatory, dimensionless S65-style model, not production CAD.
// Cylinders 1–4 / 5–8 share four cross-plane throws; firing order 1-5-4-8-7-2-6-3.
const FIRING = [0, 450, 630, 180, 90, 540, 360, 270];
const THROWS = [0, 270, 90, 180];
const DEG = Math.PI / 180;
const PARTS = ['intake', 'heads', 'valves', 'pistons', 'rods', 'crank', 'exhaust', 'block', 'sump', 'flywheel'];
const mod = (a, b) => ((a % b) + b) % b;

export function createEngineViewer({ container, onSelect = () => {}, onError = () => {} }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    onError(error);
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111b26');
  scene.fog = new THREE.Fog('#111b26', 17, 35);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(8.7, 6.1, 9.5);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'engine-webgl-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D 90-degree cross-plane V8 engine. Drag to orbit, pinch or wheel to zoom. Arrow keys orbit; plus and minus zoom. Click a component to select it.');
  container.appendChild(canvas);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 4.4;
  controls.maxDistance = 23;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.enablePan = true;
  controls.autoRotateSpeed = 0.45;
  controls.update();

  const geometries = new Set();
  const materials = new Set();
  const geometry = (g) => { geometries.add(g); return g; };
  const material = (color, metalness = 0.7, roughness = 0.3, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
    materials.add(m);
    return m;
  };
  const silver = material('#cbd1d0');
  const cream = material('#ded9c8', 0.58, 0.34);
  const dark = material('#35414b', 0.8, 0.36);
  const steel = material('#88959d', 0.9, 0.22);
  const orange = material('#ed8239', 0.62, 0.29);
  const copper = material('#bb8359', 0.78, 0.28);
  const black = material('#111b22', 0.3, 0.52);
  const cyan = material('#6cdbeb', 0.3, 0.23);
  const boltGeo = geometry(new THREE.CylinderGeometry(0.052, 0.052, 0.045, 6));
  const boxGeo = geometry(new THREE.BoxGeometry(1, 1, 1));
  const shaftGeo = geometry(new THREE.CylinderGeometry(1, 1, 1, 20));
  const sphereGeo = geometry(new THREE.SphereGeometry(1, 10, 8));
  const ringGeo = geometry(new THREE.TorusGeometry(1, 0.035, 6, 32));
  const edgeGeo = geometry(new THREE.EdgesGeometry(boxGeo));
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#849596', transparent: true, opacity: 0.3 });
  materials.add(edgeMaterial);
  const pickables = [];
  const groups = Object.fromEntries(PARTS.map((id) => {
    const group = new THREE.Group();
    group.name = id;
    scene.add(group);
    return [id, group];
  }));
  const sections = [];
  const explosions = [];
  const meshes = [];
  function mesh(g, m, parent, id) {
    const object = new THREE.Mesh(g, m);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    if (id) {
      object.userData.part = id;
      object.userData.baseMaterial = m;
      pickables.push(object);
      meshes.push(object);
    }
    return object;
  }
  function box(parent, id, m, x, y, z, sx, sy, sz, edged = false) {
    const object = mesh(boxGeo, m, parent, id);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    if (edged) object.add(new THREE.LineSegments(edgeGeo, edgeMaterial));
    return object;
  }
  function cylinder(parent, id, m, radius, length, x, y, z, axis = 'y') {
    const object = mesh(shaftGeo, m, parent, id);
    object.position.set(x, y, z);
    object.scale.set(radius, length, radius);
    if (axis === 'z') object.rotation.x = Math.PI / 2;
    if (axis === 'x') object.rotation.z = Math.PI / 2;
    return object;
  }
  function ring(parent, id, m, radius, x, y, z, axis = 'y') {
    const object = mesh(ringGeo, m, parent, id);
    object.scale.setScalar(radius);
    object.position.set(x, y, z);
    if (axis === 'y') object.rotation.x = Math.PI / 2;
    if (axis === 'x') object.rotation.y = Math.PI / 2;
    return object;
  }
  function bolt(parent, id, x, y, z) {
    const object = mesh(boltGeo, steel, parent, id);
    object.position.set(x, y, z);
    return object;
  }
  function bankGroup(id, bank, offset) {
    const group = new THREE.Group();
    group.rotation.z = -bank * Math.PI / 4;
    groups[id].add(group);
    explosions.push({ group, offset: new THREE.Vector3(bank * offset, offset * 0.72, 0) });
    return group;
  }
  function tube(parent, id, m, points, radius) {
    const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return mesh(geometry(new THREE.TubeGeometry(path, 22, radius, 8, false)), m, parent, id);
  }

  scene.add(new THREE.HemisphereLight('#e5f4ff', '#403c31', 2.8));
  const key = new THREE.DirectionalLight('#fff1d6', 4.5);
  key.position.set(5, 10, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 30 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#7bcde6', 3.4);
  rim.position.set(-6, 4, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffad75', 1.8);
  fill.position.set(2, 1, -7);
  scene.add(fill);
  const floor = mesh(geometry(new THREE.PlaneGeometry(70, 70)), material('#17232e', 0.22, 0.8), scene);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.47;
  floor.castShadow = false;
  const grid = new THREE.GridHelper(24, 48, '#334757', '#243440');
  grid.position.y = -1.465;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  geometries.add(grid.geometry);
  materials.add(grid.material);
  scene.add(grid);

  // Structural crankcase, a finned wet-looking representation of the sump,
  // and bolted end plates retain context when the occluding shells are removed.
  box(groups.block, 'block', dark, 0, -0.17, 0, 1.72, 0.34, 4.65, true);
  for (const z of [-2.32, 2.32]) {
    box(groups.block, 'block', cream, 0, 0.18, z, 1.6, 1.04, 0.11, true);
    for (const x of [-0.65, 0.65]) bolt(groups.block, 'block', x, 0.72, z);
  }
  const sump = box(groups.sump, 'sump', dark, 0, -0.76, 0, 1.65, 0.68, 4.35, true);
  sections.push(sump);
  box(groups.sump, 'sump', silver, 0, -1.12, 0, 1.55, 0.09, 4.2, true);
  for (let i = 0; i < 11; i++) {
    box(groups.sump, 'sump', steel, 0, -1.2, -1.9 + i * 0.38, 1.56, 0.075, 0.055);
  }
  explosions.push({ group: groups.sump, offset: new THREE.Vector3(0, -0.22, 0) });
  explosions.push({ group: groups.crank, offset: new THREE.Vector3(0, 0.2, 0.75) });
  explosions.push({ group: groups.flywheel, offset: new THREE.Vector3(0, 0, -1.35) });
  const crankRotor = new THREE.Group();
  groups.crank.add(crankRotor);
  cylinder(crankRotor, 'crank', steel, 0.14, 5.12, 0, 0, 0, 'z');
  const crankRadius = 0.38;
  for (let i = 0; i < 5; i++) {
    cylinder(crankRotor, 'crank', silver, 0.24, 0.24, 0, 0, -2.2 + i * 1.1, 'z');
  }
  for (let i = 0; i < 4; i++) {
    const phase = THROWS[i] * DEG;
    const x = crankRadius * Math.sin(phase);
    const y = crankRadius * Math.cos(phase);
    const z = -1.65 + i * 1.1;
    cylinder(crankRotor, 'crank', copper, 0.16, 0.65, x, y, z, 'z');
    for (const dz of [-0.4, 0.4]) {
      const web = box(crankRotor, 'crank', steel, x * 0.28, y * 0.28, z + dz, 0.52, 0.91, 0.16, true);
      web.rotation.z = -phase;
      cylinder(crankRotor, 'crank', dark, 0.29, 0.17, -x * 0.83, -y * 0.83, z + dz, 'z');
    }
  }
  const flywheelRotor = new THREE.Group();
  groups.flywheel.add(flywheelRotor);
  cylinder(flywheelRotor, 'flywheel', steel, 0.8, 0.18, 0, 0, -2.72, 'z');
  cylinder(flywheelRotor, 'flywheel', dark, 0.51, 0.2, 0, 0, -2.73, 'z');
  cylinder(flywheelRotor, 'flywheel', silver, 0.19, 0.27, 0, 0, -2.74, 'z');
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24;
    const tooth = box(flywheelRotor, 'flywheel', silver, Math.sin(a) * 0.8, Math.cos(a) * 0.8, -2.72, 0.07, 0.09, 0.19);
    tooth.rotation.z = -a;
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    cylinder(flywheelRotor, 'flywheel', black, 0.065, 0.015, Math.sin(a) * 0.62, Math.cos(a) * 0.62, -2.825, 'z');
  }
  cylinder(groups.crank, 'crank', dark, 0.43, 0.22, 0, 0, 2.69, 'z');
  ring(groups.crank, 'crank', orange, 0.4, 0, 0, 2.82, 'z');

  const pistons = [];
  const rods = [];
  const valves = [];
  const cams = [];
  const blades = [];
  const glows = [];
  const flows = [];
  const pistonGeo = geometry(new THREE.CylinderGeometry(0.345, 0.345, 0.34, 32));
  const sleeveGeo = geometry(new THREE.CylinderGeometry(0.405, 0.405, 0.93, 28, 1, true));
  const funnelGeo = geometry(new THREE.CylinderGeometry(0.31, 0.19, 0.31, 24, 1, true));
  const valveGeo = geometry(new THREE.CylinderGeometry(0.125, 0.105, 0.035, 16));
  const bladeGeo = geometry(new THREE.CylinderGeometry(0.187, 0.187, 0.018, 24));
  const lobeGeo = geometry(new THREE.SphereGeometry(1, 14, 10));
  const gasGeo = geometry(new THREE.CylinderGeometry(0.31, 0.31, 1, 20));
  const rodAxis = new THREE.Vector3(0, 1, 0);
  for (const bank of [-1, 1]) {
    const block = bankGroup('block', bank, 0.28);
    const heads = bankGroup('heads', bank, 0.95);
    const train = bankGroup('valves', bank, 1.42);
    const intake = bankGroup('intake', bank, 1.95);
    const pistonGroup = bankGroup('pistons', bank, 0.48);
    const exhaust = bankGroup('exhaust', bank, 1.3);
    const rodGroup = new THREE.Group();
    groups.rods.add(rodGroup);
    explosions.push({ group: rodGroup, offset: new THREE.Vector3(bank * 0.22, 0.18, 0.3) });
    for (const x of [-0.47, 0.47]) {
      const wall = box(block, 'block', cream, x, 1.64, 0, 0.15, 1.32, 4.58, true);
      sections.push(wall);
    }
    for (const y of [1.05, 2.22]) {
      for (const x of [-0.46, 0.46]) box(block, 'block', silver, x, y, 0, 0.12, 0.11, 4.62, true);
    }
    const headShell = box(heads, 'heads', cream, 0, 2.53, 0, 1.04, 0.49, 4.65, true);
    const cover = box(heads, 'heads', dark, 0, 3.03, 0, 1.02, 0.19, 4.66, true);
    sections.push(headShell, cover);
    for (const x of [-0.46, 0.46]) {
      box(heads, 'heads', silver, x, 2.83, 0, 0.09, 0.09, 4.68, true);
      for (let i = 0; i < 9; i++) bolt(heads, 'heads', x, 2.9, -2.1 + i * 0.525);
    }
    for (const side of [-1, 1]) {
      const cam = new THREE.Group();
      cam.position.set(side * 0.29, 2.96, 0);
      train.add(cam);
      cylinder(cam, 'valves', steel, 0.067, 4.7, 0, 0, 0, 'z');
      cylinder(cam, 'valves', orange, 0.23, 0.075, 0, 0, 2.43, 'z');
      ring(cam, 'valves', steel, 0.23, 0, 0, 2.48, 'z');
      cams.push(cam);
      for (let i = 0; i < 4; i++) {
        const index = (bank < 0 ? 0 : 4) + i;
        for (const dz of [-0.16, 0.16]) {
          const lobe = mesh(lobeGeo, copper, cam, 'valves');
          const peak = (FIRING[index] + (side === -bank ? 450 : 270)) * DEG / 2;
          lobe.position.set(Math.sin(peak) * 0.046, -Math.cos(peak) * 0.046, -1.65 + i * 1.1 + bank * 0.09 + dz);
          lobe.scale.set(0.095, 0.15, 0.066);
          lobe.rotation.z = peak;
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const index = (bank < 0 ? 0 : 4) + i;
      const z = -1.65 + i * 1.1 + bank * 0.09;
      const sleeve = mesh(sleeveGeo, steel, block, 'block');
      sleeve.position.set(0, 1.73, z);
      sections.push(sleeve);
      ring(block, 'block', silver, 0.405, 0, 2.215, z);
      ring(block, 'block', steel, 0.405, 0, 1.26, z);
      for (const x of [-0.46, 0.46]) {
        cylinder(block, 'block', steel, 0.027, 1.09, x, 1.73, z);
        bolt(block, 'block', x, 2.31, z);
      }
      const piston = new THREE.Group();
      piston.position.z = z;
      pistonGroup.add(piston);
      mesh(pistonGeo, silver, piston, 'pistons');
      cylinder(piston, 'pistons', cream, 0.322, 0.02, 0, 0.18, 0);
      for (const y of [0.095, 0.035, -0.04]) ring(piston, 'pistons', dark, 0.346, 0, y, 0);
      cylinder(piston, 'pistons', dark, 0.092, 0.71, 0, -0.07, 0, 'z');
      pistons.push({ piston, bank, index, station: i });
      const rod = new THREE.Group();
      rodGroup.add(rod);
      box(rod, 'rods', copper, 0, 0.5, 0, 0.12, 1, 0.12, true);
      for (const x of [-0.077, 0.077]) box(rod, 'rods', silver, x, 0.5, 0, 0.033, 0.92, 0.17);
      const bigEnd = cylinder(rodGroup, 'rods', copper, 0.225, 0.17, 0, 0, z, 'z');
      const bigRing = ring(rodGroup, 'rods', silver, 0.171, 0, 0, z + 0.09, 'z');
      const smallEnd = cylinder(rodGroup, 'rods', copper, 0.115, 0.18, 0, 0, z, 'z');
      rods.push({ rod, bigEnd, bigRing, smallEnd, bank, station: i, z });
      for (const side of [-1, 1]) {
        for (const dz of [-0.16, 0.16]) {
          const valve = new THREE.Group();
          valve.position.set(side * 0.21, 2.33, z + dz);
          valve.rotation.z = -side * 0.12;
          train.add(valve);
          mesh(valveGeo, side === -bank ? silver : copper, valve, 'valves');
          cylinder(valve, 'valves', steel, 0.023, 0.43, 0, 0.23, 0);
          cylinder(valve, 'valves', dark, 0.071, 0.065, 0, 0.48, 0);
          for (let r = 0; r < 5; r++) ring(valve, 'valves', steel, 0.06, 0, 0.3 + r * 0.028, 0);
          valves.push({ valve, index, intake: side === -bank });
        }
      }
      cylinder(train, 'valves', cream, 0.06, 0.26, 0, 2.72, z);
      cylinder(train, 'valves', steel, 0.034, 0.15, 0, 2.52, z);
      const glowMaterial = material('#ffae36', 0, 1, {
        emissive: '#ff7b12', emissiveIntensity: 2, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const gas = mesh(gasGeo, glowMaterial, pistonGroup, 'pistons');
      gas.position.z = z;
      gas.castShadow = false;
      const sparkMaterial = material('#fff8c8', 0, 0.4, { emissive: '#fff1a2', emissiveIntensity: 5 });
      const spark = mesh(sphereGeo, sparkMaterial, train, 'valves');
      spark.scale.setScalar(0.075);
      spark.position.set(0, 2.39, z);
      spark.castShadow = false;
      glows.push({ gas, spark, index, piston });
      const mouth = mesh(funnelGeo, orange, intake, 'intake');
      mouth.position.set(-bank * 0.08, 3.42, z);
      ring(intake, 'intake', silver, 0.31, -bank * 0.08, 3.575, z);
      const throat = mesh(geometry(new THREE.CylinderGeometry(0.197, 0.197, 0.37, 20, 1, true)), dark, intake, 'intake');
      throat.position.set(-bank * 0.08, 3.1, z);
      const blade = mesh(bladeGeo, copper, intake, 'intake');
      blade.position.set(-bank * 0.08, 3.17, z);
      cylinder(intake, 'intake', silver, 0.019, 0.44, -bank * 0.08, 3.17, z, 'z');
      blades.push(blade);
      tube(intake, 'intake', silver, [[-bank * 0.08, 2.95, z], [-bank * 0.22, 2.72, z], [-bank * 0.2, 2.45, z]], 0.135);
      const path = [[bank * 0.38, 2.48, z], [bank * 0.77, 2.45, z], [bank * 1.06, 1.98, z], [bank * 1.08, 0.9, z - 0.15], [bank * 0.94, 0.36, -2.34]];
      tube(exhaust, 'exhaust', copper, path, 0.115);
      ring(exhaust, 'exhaust', steel, 0.145, bank * 0.45, 2.48, z, 'x');
      const exhaustCurve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)));
      for (const kind of ['intake', 'exhaust']) {
        const flowGroup = kind === 'intake' ? intake : exhaust;
        const dots = [];
        for (let n = 0; n < 5; n++) {
          const dot = mesh(sphereGeo, kind === 'intake' ? cyan : orange, flowGroup, kind);
          dot.scale.setScalar(0.044);
          dot.castShadow = false;
          dots.push(dot);
        }
        flows.push({ dots, kind, index, z, bank, curve: exhaustCurve });
      }
    }
    cylinder(exhaust, 'exhaust', dark, 0.23, 0.65, bank * 0.94, 0.36, -2.61, 'z');
    ring(exhaust, 'exhaust', orange, 0.235, bank * 0.94, 0.36, -2.94, 'z');
  }

  const state = { degrees: 0, throttle: 0.24, running: false, reducedMotion: false };
  let disposed = false;
  let contextLost = false;
  let inViewport = true;
  let frame = 0;
  let lastTime = 0;
  let explode = 0;
  let explodeTarget = 0;
  let cutaway = true;
  let selected = null;
  let isolated = false;
  let autoRotate = false;
  let cameraTransition = null;
  let pointerStart = null;
  const highlightMaterials = new Map();
  const journal = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const presets = {
    hero: [[8.7, 6.1, 9.5], [0, 1.2, 0]],
    front: [[0, 3.1, 12.4], [0, 1.2, 0]],
    side: [[12.8, 3.1, 0.4], [0, 1.1, 0]],
    top: [[0.05, 14.3, 0.06], [0, 1.1, 0]],
    crank: [[5.8, 2.3, 6.7], [0, 0.15, 0]],
  };
  function setVisibility() {
    for (const id of PARTS) groups[id].visible = !isolated || !selected || id === selected;
    for (const object of sections) object.visible = !cutaway || object.userData.part === selected;
  }
  function applyHighlight() {
    for (const object of meshes) {
      const base = object.userData.baseMaterial;
      if (object.userData.part !== selected) {
        object.material = base;
        continue;
      }
      if (!highlightMaterials.has(base)) {
        const highlight = base.clone();
        highlight.emissive.set('#ffad51');
        highlight.emissiveIntensity = 0.32;
        highlightMaterials.set(base, highlight);
        materials.add(highlight);
      }
      object.material = highlightMaterials.get(base);
    }
  }
  function updateMechanics() {
    const theta = (mod(state.degrees, 720) - 45) * DEG;
    crankRotor.rotation.z = -theta;
    flywheelRotor.rotation.z = -theta;
    for (const { piston, bank, station } of pistons) {
      const phi = theta + THROWS[station] * DEG;
      const projected = crankRadius * Math.cos(phi - bank * Math.PI / 4);
      const lateral = crankRadius * Math.sin(phi - bank * Math.PI / 4);
      piston.position.y = projected + Math.sqrt(1.75 ** 2 - lateral ** 2);
    }
    for (const item of rods) {
      const phi = theta + THROWS[item.station] * DEG;
      journal.set(crankRadius * Math.sin(phi), crankRadius * Math.cos(phi), item.z);
      const projected = journal.x * item.bank * Math.SQRT1_2 + journal.y * Math.SQRT1_2;
      const lateral = journal.x * Math.SQRT1_2 - journal.y * item.bank * Math.SQRT1_2;
      const distance = projected + Math.sqrt(1.75 ** 2 - lateral ** 2);
      end.set(item.bank * Math.SQRT1_2 * distance, Math.SQRT1_2 * distance, item.z);
      direction.subVectors(end, journal);
      item.rod.position.copy(journal);
      const rodLength = direction.length();
      item.rod.quaternion.setFromUnitVectors(rodAxis, direction.divideScalar(rodLength));
      item.rod.scale.y = rodLength;
      item.bigEnd.position.copy(journal);
      item.bigRing.position.copy(journal);
      item.bigRing.position.z += 0.09;
      item.smallEnd.position.copy(end);
    }
    // Public cycle zero is intake TDC; cylinder 1 ignites at 360 degrees.
    for (const cam of cams) cam.rotation.z = -mod(state.degrees - 360, 1440) * DEG / 2;
    for (const { valve, index, intake } of valves) {
      const cycle = mod(state.degrees - FIRING[index] - 360, 720);
      const start = intake ? 360 : 180;
      const lift = cycle > start && cycle < start + 180 ? Math.sin((cycle - start) * Math.PI / 180) : 0;
      valve.position.y = 2.33 - lift * 0.15;
    }
    for (const blade of blades) blade.rotation.z = state.throttle * Math.PI * 0.48;
    for (const { gas, spark, index, piston } of glows) {
      const cycle = mod(state.degrees - FIRING[index] - 360, 720);
      const crown = piston.position.y + 0.19;
      const height = Math.max(0.025, 2.33 - crown);
      gas.position.y = crown + height / 2;
      gas.scale.y = height;
      const power = cycle < 160 ? Math.sin(Math.PI * cycle / 180) * 0.48 + 0.15 : 0;
      gas.material.opacity = power * (0.45 + state.throttle * 0.55);
      gas.visible = power > 0;
      spark.visible = cycle < 17;
    }
    for (const flow of flows) {
      const cycle = mod(state.degrees - FIRING[flow.index] - 360, 720);
      const active = flow.kind === 'intake' ? cycle >= 360 && cycle < 540 : cycle >= 180 && cycle < 360;
      for (let n = 0; n < flow.dots.length; n++) {
        const dot = flow.dots[n];
        dot.visible = active;
        if (!active) continue;
        const t = mod(cycle / 110 + n / flow.dots.length, 1);
        if (flow.kind === 'intake') dot.position.set(-flow.bank * (0.08 + t * 0.1), 3.8 - t * 1.43, flow.z);
        else {
          dot.position.copy(flow.curve.getPoint(t));
          // Offset the tracer just outside the opaque runner for readable flow.
          dot.position.x += flow.bank * 0.13;
        }
      }
    }
  }
  function moveCamera(position, target) {
    cameraTransition = {
      position: new THREE.Vector3(...position),
      target: new THREE.Vector3(...target),
    };
    if (state.reducedMotion) {
      camera.position.copy(cameraTransition.position);
      controls.target.copy(cameraTransition.target);
      cameraTransition = null;
      controls.update();
    }
    wake();
  }
  function draw(time) {
    frame = 0;
    if (disposed || contextLost || !inViewport || document.hidden) return;
    const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
    lastTime = time;
    const blend = state.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
    explode += (explodeTarget - explode) * blend;
    if (Math.abs(explodeTarget - explode) < 0.001) explode = explodeTarget;
    for (const entry of explosions) entry.group.position.copy(entry.offset).multiplyScalar(explode);
    if (cameraTransition) {
      camera.position.lerp(cameraTransition.position, blend);
      controls.target.lerp(cameraTransition.target, blend);
      if (camera.position.distanceToSquared(cameraTransition.position) < 0.0001 &&
          controls.target.distanceToSquared(cameraTransition.target) < 0.0001) {
        camera.position.copy(cameraTransition.position);
        controls.target.copy(cameraTransition.target);
        cameraTransition = null;
      }
    }
    controls.autoRotate = autoRotate && !state.reducedMotion && !cameraTransition;
    controls.enableDamping = !state.reducedMotion;
    controls.update(dt);
    updateMechanics();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  }
  function wake() {
    if (!frame && !disposed && !contextLost && inViewport && !document.hidden) {
      lastTime = 0;
      frame = requestAnimationFrame(draw);
    }
  }
  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Preserve horizontal framing on narrow screens, including exploded banks.
    camera.fov = 2 * Math.atan(Math.tan(19 * DEG) * Math.max(1, 1.5 / camera.aspect)) / DEG;
    camera.updateProjectionMatrix();
    wake();
  }
  function onVisibility() { if (document.hidden) pause(); else wake(); }
  function onControlsStart() { cameraTransition = null; wake(); }
  function onPointerDown(event) {
    if (pointerStart) { pointerStart = null; return; }
    if (event.isPrimary !== false && event.button === 0) {
      pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
  }
  function onPointerUp(event) {
    const start = pointerStart;
    pointerStart = null;
    if (!start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const hit = hits.find(({ object }) => {
      for (let node = object; node; node = node.parent) if (!node.visible) return false;
      return !object.material.transparent || object.material.opacity > 0.1;
    });
    if (hit) onSelect(hit.object.userData.part);
  }
  function cancelPointer() { pointerStart = null; }
  function onKey(event) {
    const allowed = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
    if (!allowed.includes(event.key)) return;
    event.preventDefault();
    cameraTransition = null;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (event.key === 'ArrowRight') spherical.theta += 0.12;
    if (event.key === 'ArrowUp') spherical.phi -= 0.1;
    if (event.key === 'ArrowDown') spherical.phi += 0.1;
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    if (event.key === '-' || event.key === '_') spherical.radius *= 1.1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.06, controls.maxPolarAngle);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
    wake();
  }
  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    pause();
    onError(new Error('The 3D graphics context was lost. Switch to the accessible engine diagram.'));
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  const intersectionObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
    inViewport = entries.some((entry) => entry.isIntersecting);
    if (inViewport) wake(); else pause();
  }, { rootMargin: '80px' }) : null;
  intersectionObserver?.observe(container);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  controls.addEventListener('start', onControlsStart);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('webglcontextlost', onContextLost);
  setVisibility();
  resize();
  updateMechanics();
  wake();

  return {
    update(next = {}) {
      if (disposed) return;
      if (Number.isFinite(next.degrees)) state.degrees = next.degrees;
      if (Number.isFinite(next.throttle)) state.throttle = THREE.MathUtils.clamp(next.throttle, 0, 1);
      if (typeof next.running === 'boolean') state.running = next.running;
      if (typeof next.reducedMotion === 'boolean') state.reducedMotion = next.reducedMotion;
      wake();
    },
    setView(name) {
      if (disposed || !presets[name]) return;
      moveCamera(...presets[name]);
    },
    setExplode(value) {
      if (disposed || !Number.isFinite(value)) return;
      explodeTarget = THREE.MathUtils.clamp(value, 0, 1);
      wake();
    },
    setCutaway(value) {
      if (disposed) return;
      cutaway = Boolean(value);
      setVisibility();
      wake();
    },
    setPart(id, isolate = false) {
      if (disposed || (id !== null && !PARTS.includes(id))) return;
      selected = id;
      isolated = Boolean(isolate) && id !== null;
      applyHighlight();
      setVisibility();
      if (isolated) {
        const heights = { intake: 2.6, heads: 1.9, valves: 2, pistons: 1.3, rods: 0.8, crank: 0.1, exhaust: 1.5, block: 0.9, sump: -0.75, flywheel: 0 };
        const target = [0, heights[id] + explode * (id === 'intake' ? 1.4 : 0.4), id === 'flywheel' ? -2.7 - explode * 1.35 : 0];
        moveCamera([target[0] + 6.3, target[1] + 3.6, target[2] + 7.1], target);
      }
      wake();
    },
    setAutoRotate(value) { if (!disposed) { autoRotate = Boolean(value); wake(); } },
    reset() {
      if (disposed) return;
      selected = null;
      isolated = false;
      autoRotate = false;
      cutaway = true;
      explodeTarget = 0;
      applyHighlight();
      setVisibility();
      moveCamera(...presets.hero);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
