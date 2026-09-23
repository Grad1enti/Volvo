import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Parametric surface patch fn(u, v) -> [x, y, z] on a (nu x nv) grid.
 * With `thick` > 0 it becomes a solid panel: an inner skin is offset along the
 * (outward-oriented) normal and the four edges are stitched closed.
 * `keep(center)` can drop individual quads, e.g. to cut window openings.
 */
export function surface(nu, nv, fn, thick = 0, keep = null) {
  const W = nu + 1;
  const P = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(new THREE.Vector3(...fn(i / nu, j / nv)));
  const at = (i, j) => P[j * W + i];

  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const N = P.map((_, k) => {
    const i = k % W, j = (k / W) | 0;
    a.subVectors(at(Math.min(i + 1, nu), j), at(Math.max(i - 1, 0), j));
    b.subVectors(at(i, Math.min(j + 1, nv)), at(i, Math.max(j - 1, 0)));
    return new THREE.Vector3().crossVectors(a, b).normalize();
  });
  // Orient normals away from the car's centre line so the thickness goes inward.
  let s = 0;
  const ref = new THREE.Vector3();
  P.forEach((p, k) => { s += N[k].dot(ref.set(p.x * 0.3, p.y - 0.6, p.z)); });
  const flip = s < 0;
  if (flip) N.forEach((n) => n.negate());

  const pos = [], idx = [];
  const quad = (A, B, C, D, rev) => { // A-B-C-D counter-clockwise when !rev
    if (rev) idx.push(A, C, B, A, D, C); else idx.push(A, B, C, A, C, D);
  };
  const push = (v) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };

  const c = new THREE.Vector3();
  const kept = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (keep) {
      c.copy(at(i, j)).add(at(i + 1, j)).add(at(i + 1, j + 1)).add(at(i, j + 1)).multiplyScalar(0.25);
      if (!keep(c)) continue;
    }
    kept.push([i, j]);
  }
  const outer = P.map(push);
  for (const [i, j] of kept) {
    quad(outer[j * W + i], outer[j * W + i + 1], outer[(j + 1) * W + i + 1], outer[(j + 1) * W + i], flip);
  }
  if (thick > 0) {
    const inner = P.map((p, k) => push(p.clone().addScaledVector(N[k], -thick)));
    for (const [i, j] of kept) {
      quad(inner[j * W + i], inner[j * W + i + 1], inner[(j + 1) * W + i + 1], inner[(j + 1) * W + i], !flip);
    }
    // edges: duplicate vertices so edge faces get their own crisp normals
    const edge = (ks) => {
      const o = ks.map((k) => push(P[k]));
      const n = ks.map((k) => push(P[k].clone().addScaledVector(N[k], -thick)));
      for (let q = 0; q < ks.length - 1; q++) quad(o[q], o[q + 1], n[q + 1], n[q], false);
    };
    const row = (j) => Array.from({ length: W }, (_, i) => j * W + i);
    const col = (i) => Array.from({ length: nv + 1 }, (_, j) => j * W + i);
    edge(row(0)); edge(row(nv)); edge(col(0)); edge(col(nu));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Loft along X through superellipse cross-sections.
 * sections: [{ x, y0, y1, hwBot, hwTop, zc?, e? }] - e is the superellipse exponent (2 = ellipse, higher = boxier)
 */
export function loftX(sections, around = 28, caps = true) {
  const pos = [], idx = [];
  const ring = (s) => {
    const e = s.e ?? 5, zc = s.zc ?? 0;
    const out = [];
    for (let k = 0; k < around; k++) {
      const t = (k / around) * Math.PI * 2;
      const c = Math.cos(t), sn = Math.sin(t);
      const ez = Math.sign(c) * Math.abs(c) ** (2 / e);
      const ey = Math.sign(sn) * Math.abs(sn) ** (2 / e);
      const yy = lerp(s.y0, s.y1, (ey + 1) / 2);
      const hw = lerp(s.hwBot, s.hwTop, (ey + 1) / 2);
      out.push([s.x, yy, zc + ez * hw]);
    }
    return out;
  };
  const rings = sections.map(ring);
  rings.forEach((r) => r.forEach((p) => pos.push(...p)));
  for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < around; k++) {
    const a = r * around + k, b = r * around + ((k + 1) % around);
    const c = (r + 1) * around + ((k + 1) % around), d = (r + 1) * around + k;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!caps) return g;
  // caps as separate flat fans (own normals)
  const capGeo = (r, flip) => {
    const pts = rings[r];
    const cy = pts.reduce((s, p) => s + p[1], 0) / around;
    const cz = pts.reduce((s, p) => s + p[2], 0) / around;
    const cp = [pts[0][0], cy, cz, ...pts.flat()];
    const ci = [];
    for (let k = 0; k < around; k++) {
      const a = 1 + k, b = 1 + ((k + 1) % around);
      if (flip) ci.push(0, b, a); else ci.push(0, a, b);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setIndex(ci);
    cg.computeVertexNormals();
    return cg;
  };
  return mergeSimple([g, capGeo(0, false), capGeo(rings.length - 1, true)]);
}

/** Merge non-indexed-compatible geometries (position + normal + index only). */
export function mergeSimple(geos) {
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g of geos) {
    const gi = g.index ? g : g.toNonIndexed();
    if (!gi.attributes.normal) gi.computeVertexNormals();
    const p = gi.attributes.position.array, n = gi.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    if (gi.index) for (const i of gi.index.array) idx.push(i + off);
    else for (let i = 0; i < p.length / 3; i++) idx.push(i + off);
    off += p.length / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function mesh(geo, mat, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

export const rbox = (w, h, d, r = 0.01, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);

/** Cylinder whose axis runs along X (default three.js cylinders run along Y). */
export function cylX(r1, r2, len, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** Cylinder whose axis runs along Z. */
export function cylZ(r1, r2, len, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Tube through a list of points. */
export function tube(points, r, seg = 64, radial = 10, tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

/** Cylinder between two points (for struts, links, shafts). */
export function rod(a, b, r, seg = 12, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

/** Group helper */
export function group(...children) {
  const g = new THREE.Group();
  children.flat().forEach((c) => c && g.add(c));
  return g;
}
