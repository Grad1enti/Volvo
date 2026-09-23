import * as THREE from 'three';
import { clamp } from './geom.js';

export const CATEGORIES = [
  { id: 'body', label: 'Body', color: '#5b87b8' },
  { id: 'chassis', label: 'Chassis', color: '#d9902b' },
  { id: 'powertrain', label: 'Powertrain', color: '#d5483e' },
  { id: 'awd', label: 'AWD', color: '#8b62d9' },
  { id: 'lpg', label: 'LPG', color: '#1ea386' },
];
export const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const GHOST = 0.1;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Holds every part: its assembled position, explode offset, per-part materials
 * (so each part can be ghosted / highlighted on its own) and its guide line.
 */
export class Registry {
  constructor(scene) {
    this.parts = [];
    this.spinners = [];
    this.root = new THREE.Group();
    this.guides = new THREE.Group();
    scene.add(this.root, this.guides);
  }

  /**
   * @param {object} o
   * @param {string} o.name
   * @param {string} o.desc
   * @param {string} o.cat
   * @param {THREE.Object3D} o.object  geometry in assembled (car) coordinates
   * @param {number[]} o.explode       offset [x,y,z] in metres at full pull-apart
   * @param {number} [o.delay]         0..1 stagger (0 = moves first)
   */
  add({ name, desc, cat, object, explode = [0, 0, 0], delay = 0 }) {
    const outer = new THREE.Group();
    outer.add(object);
    outer.name = name;
    this.root.add(outer);
    const part = {
      id: this.parts.length, name, desc, cat, outer,
      dir: new THREE.Vector3(...explode),
      delay: clamp(delay),
      alpha: 1, alphaTarget: 1,
      mats: [], meshes: [],
    };
    const clones = new Map();
    object.traverse((o) => {
      if (!o.isMesh) return;
      if (!clones.has(o.material)) {
        const m = o.material.clone();
        m.userData.base = {
          opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite,
          emissive: m.emissive ? m.emissive.clone() : null, emissiveIntensity: m.emissiveIntensity ?? 1,
        };
        clones.set(o.material, m);
        part.mats.push(m);
      }
      o.material = clones.get(o.material);
      o.userData.part = part;
      part.meshes.push(o);
    });
    // anchor = centre of the part when assembled, used for guide lines
    this.root.updateMatrixWorld(true);
    part.anchor = new THREE.Box3().setFromObject(outer).getCenter(new THREE.Vector3());
    const lg = new THREE.BufferGeometry().setFromPoints([part.anchor, part.anchor.clone()]);
    const lm = new THREE.LineDashedMaterial({
      color: catById[cat].color, dashSize: 0.045, gapSize: 0.035, transparent: true, opacity: 0.85, depthWrite: false,
    });
    part.guide = new THREE.Line(lg, lm);
    part.guide.visible = false;
    part.guide.raycast = () => {};
    part.guide.renderOrder = 2;
    this.guides.add(part.guide);
    this.parts.push(part);
    return part;
  }

  /** Register a sub-object that spins in "drive" mode; ratio is relative to wheel speed. */
  spin(obj, axis, ratio = 1) {
    this.spinners.push({ obj, axis, ratio });
  }

  /**
   * Apply pull-apart amount t (0..1) with per-part stagger. Ghosted / hidden
   * parts ease back to their assembled position so the shell stays intact.
   * Returns true while any part is still moving.
   */
  update(t, dt) {
    const S = 0.4;
    let busy = false;
    for (const p of this.parts) {
      const active = p.alphaTarget === 1;
      const target = active ? easeInOut(clamp((t - p.delay * S) / (1 - S))) : 0;
      if (p.e === undefined) p.e = target;
      if (active && p.settled) p.e = target; // follow the slider directly
      else if (p.e !== target) {
        const step = dt * 2.5;
        p.e = Math.abs(target - p.e) <= step ? target : p.e + Math.sign(target - p.e) * step;
        busy = true;
      }
      if (p.e === target) p.settled = active;
      if (p.e === p.lastE) continue;
      p.lastE = p.e;
      p.outer.position.copy(p.dir).multiplyScalar(p.e);
      const show = p.e > 0.01 && p.alphaTarget === 1;
      p.guide.visible = show;
      if (show) {
        const a = p.guide.geometry.attributes.position;
        a.setXYZ(1, p.anchor.x + p.outer.position.x, p.anchor.y + p.outer.position.y, p.anchor.z + p.outer.position.z);
        a.needsUpdate = true;
        p.guide.geometry.computeBoundingSphere();
        p.guide.computeLineDistances();
      }
    }
    return busy;
  }

  setFilter(cat) {
    for (const p of this.parts) {
      p.settled = false;
      if (cat === 'all' || p.cat === cat) p.alphaTarget = 1;
      else if (p.cat === 'body') p.alphaTarget = GHOST;
      else p.alphaTarget = 0;
    }
  }

  /** Move part opacity toward target; instant when dt is Infinity. Returns true while animating. */
  updateFade(dt) {
    let busy = false;
    for (const p of this.parts) {
      if (p.alpha === p.alphaTarget) continue;
      const step = dt * 3.5;
      p.alpha = Math.abs(p.alphaTarget - p.alpha) <= step ? p.alphaTarget : p.alpha + Math.sign(p.alphaTarget - p.alpha) * step;
      this.applyAlpha(p);
      busy = true;
    }
    return busy;
  }

  applyAlpha(p) {
    const full = p.alpha >= 0.999;
    for (const m of p.mats) {
      const b = m.userData.base;
      const wasT = m.transparent;
      m.transparent = full ? b.transparent : true;
      m.opacity = full ? b.opacity : b.opacity * p.alpha;
      m.depthWrite = full ? b.depthWrite : false;
      if (wasT !== m.transparent) m.needsUpdate = true;
    }
    p.outer.visible = p.alpha > 0.001;
    p.pickable = p.alphaTarget === 1;
  }

  highlight(part, on) {
    if (!part) return;
    const c = new THREE.Color(catById[part.cat].color);
    for (const m of part.mats) {
      if (!m.emissive) continue;
      const b = m.userData.base;
      if (on) { m.emissive.copy(c); m.emissiveIntensity = 0.55; }
      else { m.emissive.copy(b.emissive); m.emissiveIntensity = b.emissiveIntensity; }
    }
  }

  pickables() {
    const out = [];
    for (const p of this.parts) if (p.alphaTarget === 1 && p.outer.visible) out.push(...p.meshes);
    return out;
  }
}
