import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Registry, CATEGORIES, catById } from './registry.js';
import { D } from './dims.js';
import { buildBody } from './parts/body.js';
import { buildChassis } from './parts/chassis.js';
import { buildPowertrain } from './parts/powertrain.js';
import { buildAWD } from './parts/awd.js';
import { buildLPG } from './parts/lpg.js';

const $ = (id) => document.getElementById(id);
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedMQ.matches;

// ---------- renderer / scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 6, 4);
scene.add(sun, new THREE.HemisphereLight(0xdfe8f5, 0x3a3530, 0.5));

const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.6, 0);
controls.minDistance = 1.2;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.66;
controls.enableDamping = !reduced;
controls.dampingFactor = 0.09;
controls.zoomToCursor = false;

// soft contact shadow (canvas-generated, no external assets)
{
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 64, 4, 128, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.setTransform(2, 0, 0, 1, -128, 0);
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(D.length * 1.35, D.width * 1.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.renderOrder = -1;
  scene.add(shadow);
}

// ---------- parts ----------
const reg = new Registry(scene);
reg.root.add(reg.guides);
buildBody(reg);
buildChassis(reg);
buildPowertrain(reg);
buildAWD(reg);
buildLPG(reg);

// ---------- state ----------
const state = {
  explodeTarget: 0, explode: 0,
  cat: 'all', selected: null,
  drive: false, dirty: true,
};

// ---------- camera framing ----------
const LIFT = 0.45, DOLLY = 0.45, TARGET_Y = 0.55;
let baseDist = 10; // camera distance with the car assembled; updated whenever the user zooms
const VIEW = { az: 38, el: 20, dist: 1 };
function viewport() {
  const w = innerWidth, h = innerHeight;
  const panel = document.querySelector('.panel').getBoundingClientRect();
  const top = document.querySelector('.top').getBoundingClientRect();
  const free = Math.max(200, panel.top - top.bottom);
  return { w, h, free, offset: (h - (top.bottom + free / 2)) - h / 2 };
}
function fitDistance() {
  const { w, free } = viewport();
  const vf = THREE.MathUtils.degToRad(camera.fov) * (free / innerHeight);
  const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  const r = 2.55;
  return r / Math.sin(Math.min(vf, hf) / 2) * (camera.aspect < 1 ? 0.95 : 0.85);
}
function setView(az = VIEW.az, el = VIEW.el, scale = 1) {
  baseDist = fitDistance() * scale;
  const d = baseDist * (1 + DOLLY * state.explode);
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  controls.target.set(0, TARGET_Y + state.explode * LIFT * 0.8, 0);
  camera.position.set(
    controls.target.x + d * Math.cos(e) * Math.sin(a),
    controls.target.y + d * Math.sin(e),
    controls.target.z + d * Math.cos(e) * Math.cos(a),
  );
  controls.update();
  state.dirty = true;
}
function resize() {
  const { w, h, offset } = viewport();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.setViewOffset(w, h, 0, offset, w, h);
  camera.updateProjectionMatrix();
  state.dirty = true;
}
addEventListener('resize', resize);
resize();
setView();

// ---------- UI ----------
const chips = $('chips');
const chipDefs = [{ id: 'all', label: 'All', color: null }, ...CATEGORIES];
for (const c of chipDefs) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.dataset.cat = c.id;
  b.innerHTML = (c.color ? `<span class="cat-dot" style="background:${c.color}"></span>` : '') + c.label;
  b.addEventListener('click', () => setCategory(c.id));
  chips.append(b);
}
function setCategory(cat) {
  state.cat = cat;
  for (const b of chips.children) b.setAttribute('aria-checked', String(b.dataset.cat === cat));
  reg.setFilter(cat);
  if (reduced) reg.updateFade(Infinity);
  if (state.selected && reg.parts[state.selected.id].alphaTarget !== 1) select(null);
  state.dirty = true;
}
setCategory('all');

const slider = $('explode');
slider.addEventListener('input', () => { state.explodeTarget = slider.value / 100; state.dirty = true; hideHint(); });

const driveEl = $('drive');
driveEl.addEventListener('change', () => setDrive(driveEl.checked));
function setDrive(on) {
  state.drive = on;
  driveEl.checked = on;
  updateStat();
  state.dirty = true;
}
// Road speed for the demo; wheels, driveshafts and prop shaft all derive from it.
const REAR_DIFF_RATIO = 2.6; // prop shaft turns this much faster than the rear wheels
function speedKmh() { return reduced ? 3 : 8; }
function updateStat() {
  if (!state.drive) { $('stat').textContent = ''; return; }
  const wheelRpm = (speedKmh() / 3.6 / D.tyreR) * 60 / (2 * Math.PI);
  $('stat').textContent = `${speedKmh()} km/h · wheels ${wheelRpm.toFixed(0)} rpm · prop ${(wheelRpm * REAR_DIFF_RATIO).toFixed(0)} rpm`;
}

$('resetView').addEventListener('click', () => setView());

// info card
function select(part) {
  if (state.selected) reg.highlight(state.selected, false);
  state.selected = part;
  const info = $('info');
  if (!part) { info.hidden = true; state.dirty = true; return; }
  reg.highlight(part, true);
  const c = catById[part.cat];
  $('infoDot').style.background = c.color;
  $('infoCat').textContent = c.label;
  $('infoName').textContent = part.name;
  $('infoDesc').textContent = part.desc;
  info.hidden = false;
  state.dirty = true;
}
$('infoClose').addEventListener('click', () => select(null));
addEventListener('keydown', (e) => { if (e.key === 'Escape') select(null); });

// tap to pick (ignore drags / pinches)
const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now(), multi: false } : (down && (down.multi = true), down);
  hideHint();
});
canvas.addEventListener('pointerup', (e) => {
  if (!down || !e.isPrimary || down.multi) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved > 8 || performance.now() - down.t > 600) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(reg.pickables(), false)[0];
  const part = hit ? hit.object.userData.part : null;
  select(part && part !== state.selected ? part : null);
});
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; $('hint').classList.add('gone'); } }

controls.addEventListener('change', () => { state.dirty = true; });
reducedMQ.addEventListener('change', (e) => { reduced = e.matches; controls.enableDamping = !reduced; updateStat(); });

// ---------- loop ----------
let lastT = performance.now();
controls.addEventListener('end', () => { baseDist = camera.position.distanceTo(controls.target) / (1 + DOLLY * state.explode); });
let lastExplode = -1;
function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  // explode easing toward slider value
  if (reduced) state.explode = state.explodeTarget;
  else state.explode += (state.explodeTarget - state.explode) * Math.min(1, dt * 7);
  if (Math.abs(state.explode - state.explodeTarget) < 1e-4) state.explode = state.explodeTarget;
  if (state.explode !== lastExplode) {
    reg.setExplode(state.explode);
    // lift the whole car as it comes apart so parts pushed downward stay above the floor
    reg.root.position.y = state.explode * LIFT;
    // follow with the camera: raise the target with the lift and dolly out as parts spread
    const off = camera.position.clone().sub(controls.target);
    controls.target.y += (state.explode - Math.max(0, lastExplode)) * LIFT * 0.8;
    off.setLength(baseDist * (1 + DOLLY * state.explode));
    camera.position.copy(controls.target).add(off);
    lastExplode = state.explode;
    state.dirty = true;
  }
  if (reg.updateFade(reduced ? Infinity : dt)) state.dirty = true;
  if (state.drive) {
    const w = (speedKmh() / 3.6) / D.tyreR; // wheel angular speed, rad/s
    for (const s of reg.spinners) s.obj.rotation[s.axis] -= w * s.ratio * dt;
    state.dirty = true;
  }
  if (controls.update()) state.dirty = true;
  if (state.dirty) {
    renderer.render(scene, camera);
    state.dirty = false;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Small API used by the headless screenshot script (and handy from devtools).
window.app = {
  ready: true,
  reg,
  setExplode(v, instant) {
    state.explodeTarget = v; slider.value = String(Math.round(v * 100));
    if (instant) state.explode = v;
    state.dirty = true;
  },
  setCategory(c) { setCategory(c); reg.updateFade(Infinity); },
  setView(az, el, s) { setView(az, el, s); },
  setDrive,
  selectByName(n) { select(reg.parts.find((p) => p.name === n) || null); },
  settle: () => new Promise((r) => setTimeout(r, 400)),
  camDist: () => [camera.position.distanceTo(controls.target), state.explode, baseDist, reg.root.position.y],
};
