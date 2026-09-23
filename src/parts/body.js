import * as THREE from 'three';
import { D } from '../dims.js';
import { M } from '../materials.js';
import { surface, loftX, mesh, rbox, tube, rod, group, clamp, lerp } from '../geom.js';

// ---------------------------------------------------------------------------
// Body profile. x forward (+ = front), y up, z to the car's right. Metres.
// Stations are tuned to V40 photos; overall numbers come from dims.js.
// ---------------------------------------------------------------------------
const XF = D.xFront, XR = D.xRear, HW = D.hw;
export const ARCH_R = 0.405, ARCH_Y = 0.335;
export const SILL = 0.335;
const WS_BASE = [0.9, 0.985]; // windscreen base (side view)
const ROOF_Y_WS = 1.375; // roof height at top of windscreen
const X_WS_TOP = 0.15;
const X_ROOF_END = -1.6; // hatch top / spoiler, roughly above the rear wheel

// Tailgate side profile (x, y), top to bottom: steep rear screen, then the
// rounded lower tailgate that bulges out above the bumper.
const TG = [[-1.6, 1.362], [-1.8, 1.17], [-1.97, 0.99], [-2.065, 0.86], [-2.108, 0.72], [-2.105, 0.6]];

export function planHW(x) {
  let f = 1;
  if (x > 1.45) { const t = (x - 1.45) / (XF - 1.45 + 0.1); f = Math.sqrt(1 - t * t); }
  if (x < -1.62) { const t = (-1.62 - x) / (-1.62 - XR + 0.12); f = Math.sqrt(1 - t * t); }
  return HW * f;
}
export function hoodY(x) {
  const t = clamp((x - WS_BASE[0]) / (2.14 - WS_BASE[0]), 0, 1.2);
  return WS_BASE[1] - 0.175 * t ** 1.7;
}
/** bottom edge of the side windows: rises along the doors, then kicks up sharply */
export function belt(x) {
  if (x >= WS_BASE[0]) return hoodY(x);
  const b1 = WS_BASE[1] + (WS_BASE[0] + 1.0) * 0.055;
  if (x >= -1.0) return WS_BASE[1] + (WS_BASE[0] - x) * 0.055;
  return b1 + (-1.0 - x) * 0.35;
}
/** shoulder line where the body side starts to tuck in towards the roof */
const shoulder = (x) => (x >= WS_BASE[0] ? hoodY(x) : WS_BASE[1] + (WS_BASE[0] - x) * 0.03);
export function roofY(x) {
  const d = x + 0.45;
  return 1.418 - (d > 0 ? 0.12 : 0.0665) * d * d;
}
const wTop = (x) => roofY(x) - 0.07; // top edge of side windows
/** windscreen side edge: x at height y */
const xWS = (y) => lerp(WS_BASE[0], X_WS_TOP, (y - WS_BASE[1]) / (ROOF_Y_WS - WS_BASE[1]));
/** tailgate side edge: x at height y */
export function xTG(y) {
  if (y >= TG[0][1]) return TG[0][0];
  for (let i = 0; i < TG.length - 1; i++) {
    const [x0, y0] = TG[i], [x1, y1] = TG[i + 1];
    if (y <= y0 && y >= y1) return lerp(x0, x1, (y0 - y) / (y0 - y1));
  }
  return TG[TG.length - 1][0];
}
/** height of the tailgate edge at x (inverse of xTG); above the roof ahead of the hatch */
function yTG(x) {
  if (x >= TG[0][0]) return 9;
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = TG[i], [x1, y1] = TG[i + 1];
    if (x <= x0 && x >= x1) return lerp(y0, y1, (x0 - x) / (x0 - x1));
  }
  return 0.6;
}
export function hwAt(x, y) {
  const p = planHW(x);
  const sh = shoulder(x);
  if (y <= sh) { const t = clamp((y - 0.2) / (sh - 0.2)); return p * (1 - 0.055 * (1 - t) ** 2); }
  const g = clamp((y - sh) / Math.max(0.05, roofY(x) - sh));
  return p * (1 - 0.26 * g ** 1.25);
}
export function archTop(x) {
  for (const xc of [D.xFA, D.xRA]) {
    const dx = x - xc;
    if (Math.abs(dx) < ARCH_R) return ARCH_Y + Math.sqrt(ARCH_R * ARCH_R - dx * dx);
  }
  return -1;
}
const sideBottom = (x) => Math.max(SILL, archTop(x));

// side window opening (daylight opening): t = 0 at belt, 1 at window top.
// The rear quarter window ends in a point where the rising belt meets the roofline.
const dloFront = (t) => lerp(0.82, 0.2, t);
const dloRear = (t) => lerp(-1.44, -1.3, t);
function inDLO(x, y) {
  const b = belt(x), top = wTop(x);
  const t = (y - b) / (top - b);
  return t > 0 && t < 1 && x < dloFront(t) && x > dloRear(t);
}

// ---------------------------------------------------------------------------
function sidePanel(side, x0, x1, bot, top, mat, { nu = 60, nv = 14, thick = 0.018, out = 0 } = {}) {
  return mesh(surface(nu, nv, (u, v) => {
    const x = lerp(x0, x1, u);
    const y = lerp(bot(x), top(x), v);
    return [x, y, side * (hwAt(x, y) + out)];
  }, thick), mat);
}
/** Horizontal ledge that closes the top of a door / quarter panel at the beltline. */
function beltLedge(side, x0, x1, mat) {
  return mesh(surface(40, 2, (u, v) => {
    const x = lerp(x0, x1, u);
    const b = belt(x);
    return [x, b, side * lerp(hwAt(x, b - 0.001), hwAt(x, b + 0.001) - 0.004, v)];
  }, 0.01), mat);
}

function doorHandle(side, x, y) {
  const m = mesh(rbox(0.15, 0.028, 0.03, 0.012), M.paint);
  m.position.set(x, y, side * (hwAt(x, y) + 0.01));
  return m;
}

function mirror(side) {
  const x0 = 0.7, x1 = 0.92, zc = side * (hwAt(0.81, 1.0) + 0.13);
  const secs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = lerp(x0, x1, t); // t = 0 at the (blunt) glass end
    const k = Math.sqrt(Math.max(0, 1 - t ** 2.2)) * 0.9 + 0.1;
    secs.push({ x, y0: 0.975 + 0.03 * (1 - k), y1: 1.1 - 0.02 * (1 - k), hwBot: 0.1 * k, hwTop: 0.1 * k, zc, e: 3.5 });
  }
  const cap = mesh(loftX(secs, 24), M.gloss); // Cross Country mirrors are gloss black
  const glassSide = mesh(rbox(0.01, 0.1, 0.18, 0.03), M.gloss, [x0 - 0.001, 1.037, zc]);
  const arm = mesh(rbox(0.12, 0.035, 0.12, 0.012), M.cladding, [0.86, 0.99, side * (hwAt(0.86, 0.99) + 0.05)]);
  return group(cap, glassSide, arm);
}

// ---------------------------------------------------------------------------
export function buildBody(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'body', object, explode, delay });

  // --- Hood ---
  const hood = mesh(surface(50, 24, (u, v) => {
    const x = lerp(2.14, WS_BASE[0] + 0.005, u);
    const s = v * 2 - 1;
    let y = hoodY(x) + 0.035 * (1 - s * s) * clamp((x - 0.64) * 3);
    if (x > 2.04) y -= ((x - 2.04) / 0.1) ** 2 * 0.035;
    return [x, y, s * hwAt(x, hoodY(x)) * 0.985];
  }, 0.018), M.paint);
  add('Hood', 'The bonnet over the engine bay. It hinges at the windscreen end and is held shut by a latch behind the grille.',
    hood, [0.35, 0.9, 0], 0.05);

  // --- Front bumper with Cross Country cladding ---
  {
    const xs = [1.7, 1.8, 1.9, 1.98, 2.05, 2.1, 2.15, 2.19, 2.21, XF];
    const topY = (x) => (x < 2.12 ? hoodY(x) - 0.012 : lerp(0.79, 0.75, (x - 2.12) / (XF - 2.12)));
    const bump = loftX(xs.map((x) => ({ x, y0: 0.4, y1: topY(x), hwBot: planHW(x) * 0.985, hwTop: hwAt(x, topY(x)) * 0.975, e: 7 })), 36);
    const clad = loftX(xs.map((x) => ({ x: x + 0.008, y0: 0.19, y1: 0.43, hwBot: planHW(x) * 0.95, hwTop: planHW(x) * 1.0 + 0.008, e: 6 })), 36);
    const g = group(mesh(bump, M.paint), mesh(clad, M.cladding));
    // grille
    const gy = 0.665;
    g.add(mesh(rbox(0.04, 0.2, 0.64, 0.03), M.chrome, [XF - 0.005, gy, 0]));
    g.add(mesh(rbox(0.04, 0.17, 0.6, 0.025), M.gloss, [XF + 0.004, gy, 0]));
    for (let i = -6; i <= 6; i++) g.add(mesh(rbox(0.012, 0.16, 0.012, 0.004), M.darkAlu, [XF + 0.024, gy, i * 0.045]));
    // lower intake + silver skid plate
    g.add(mesh(rbox(0.04, 0.1, 0.6, 0.02), M.gloss, [XF + 0.005, 0.36, 0]));
    g.add(mesh(rbox(0.05, 0.05, 0.52, 0.02), M.alu, [XF - 0.005, 0.225, 0]));
    // vertical LED daytime running lights (a Cross Country signature)
    for (const s of [-1, 1]) {
      const x = 2.155, z = s * (planHW(x) * 0.97);
      const drl = mesh(rbox(0.025, 0.16, 0.035, 0.01), M.headlight, [x, 0.33, z]);
      drl.rotation.y = s * 0.85;
      g.add(drl);
    }
    add('Front bumper', 'Plastic front bumper cover with the grille, the lower air intake and the Cross Country black cladding and silver skid plate that protect it on rough roads.',
      g, [1.05, -0.05, 0], 0);
  }

  // --- Rear bumper ---
  {
    const xs = [-1.7, -1.8, -1.9, -1.98, -2.04, -2.08, -2.11, -2.13, XR];
    const bump = loftX(xs.map((x) => ({ x, y0: 0.39, y1: 0.605, hwBot: planHW(x) * 0.985, hwTop: planHW(x) * 0.975, e: 7 })), 36);
    // the lower edge sweeps up towards the back, tucking the bumper in underneath
    const tuck = (x) => 0.2 + 0.14 * clamp((-1.88 - x) / (-1.88 - XR)) ** 1.3;
    const clad = loftX(xs.map((x) => ({ x: x - 0.008, y0: tuck(x), y1: 0.41, hwBot: planHW(x) * (0.95 - 0.06 * (tuck(x) - 0.2) / 0.14), hwTop: planHW(x) + 0.008, e: 6 })), 36);
    const g = group(mesh(bump, M.paint), mesh(clad, M.cladding));
    const skid = mesh(rbox(0.2, 0.012, 0.6, 0.006), M.alu, [-2.035, tuck(-2.035) - 0.004, 0]);
    skid.rotation.z = -0.5;
    g.add(skid);
    for (const s of [-1, 1]) g.add(mesh(rbox(0.02, 0.03, 0.14, 0.01), M.taillight, [XR + 0.004, 0.36, s * 0.42]));
    add('Rear bumper', 'Rear bumper cover with black protective cladding along the bottom and a silver skid-plate insert.',
      g, [-1.05, -0.05, 0], 0);
  }

  // --- Headlights ---
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const lamp = surface(28, 6, (u, v) => {
        const x = lerp(2.19, 1.76, u);
        const top = (x < 2.12 ? hoodY(x) : 0.8) - 0.012;
        const y = lerp(top - lerp(0.085, 0.05, u), top, v);
        return [x, y, s * (hwAt(x, y) * 0.975 + 0.004)];
      }, 0.03);
      g.add(mesh(lamp, M.headlight));
      const inner = surface(20, 3, (u, v) => {
        const x = lerp(2.17, 1.84, u);
        const top = (x < 2.12 ? hoodY(x) : 0.8) - 0.03;
        const y = lerp(top - 0.03, top, v);
        return [x, y, s * (hwAt(x, y) * 0.975 + 0.007)];
      }, 0.005);
      g.add(mesh(inner, M.chrome));
    }
    add('Headlights', 'Swept-back headlamp units. They hold the main and dipped beams plus the indicators.', g, [0.7, 0.25, 0], 0.08);
  }

  // --- Front fenders (wings) ---
  for (const s of [-1, 1]) {
    const f = sidePanel(s, 1.72, 0.905, sideBottom, (x) => hoodY(x) - 0.004, M.paint, { nu: 70, nv: 16 });
    // small inward flange along the hood shut-line
    const fl = mesh(surface(40, 2, (u, v) => {
      const x = lerp(1.72, 0.905, u), y = hoodY(x) - 0.004;
      return [x, y - v * 0.01, s * lerp(hwAt(x, y), hwAt(x, y) - 0.035, v)];
    }, 0.006), M.paint);
    add(s > 0 ? 'Front fender (right)' : 'Front fender (left)',
      'The front wing that covers the wheel. It is a bolt-on steel panel, so it is easy to replace after a knock.',
      group(f, fl), [0.3, 0.1, s * 0.65], 0.12);
  }

  // --- Doors ---
  for (const s of [-1, 1]) {
    const fd = group(
      sidePanel(s, 0.895, -0.245, () => SILL, belt, M.paint),
      beltLedge(s, 0.895, -0.245, M.paint),
      doorHandle(s, -0.08, 0.95),
      mirror(s),
    );
    add(s > 0 ? 'Front door (right)' : 'Front door (left)', 'Front door with its wing mirror. Inside are the window regulator, speaker and side-impact beam.',
      fd, [0.05, 0, s * 0.85], 0.1);
    const rd = group(
      sidePanel(s, -0.26, -1.12, sideBottom, belt, M.paint),
      beltLedge(s, -0.26, -1.12, M.paint),
      doorHandle(s, -0.95, 1.0),
    );
    add(s > 0 ? 'Rear door (right)' : 'Rear door (left)', 'Rear passenger door. Its rear edge is shaped around the wheel arch.',
      rd, [-0.1, 0, s * 0.85], 0.12);
    // rear quarter panel: from the rear door back to the tailgate opening
    const rq = group(
      sidePanel(s, -1.135, -2.1, (x) => (x < -1.7 ? 0.6 : sideBottom(x)), (x) => Math.min(belt(x), yTG(x)), M.paint, { nu: 60, nv: 16 }),
    );
    add(s > 0 ? 'Rear quarter panel (right)' : 'Rear quarter panel (left)',
      'The fixed rear side panel around the back wheel. It is welded to the body, so it is part of the car’s structure.',
      rq, [-0.35, 0, s * 0.65], 0.14);
  }

  // --- Roof with pillars (greenhouse frame, window openings cut out) ---
  {
    const g = new THREE.Group();
    const roof = surface(60, 26, (u, v) => {
      const x = lerp(X_WS_TOP + 0.03, X_ROOF_END - 0.02, u);
      const s = v * 2 - 1;
      return [x, roofY(x) + 0.028 * (1 - s * s), s * hwAt(x, roofY(x) - 0.002)];
    }, 0.02);
    g.add(mesh(roof, M.paint));
    for (const s of [-1, 1]) {
      const yLo = WS_BASE[1] - 0.004, yHi = 1.418;
      const side = surface(200, 80, (u, v) => {
        const y = lerp(yLo, yHi, v);
        const x0 = xWS(Math.min(y, ROOF_Y_WS)) + 0.004, x1 = xTG(y) + 0.004;
        const x = lerp(x0, x1, u);
        const yy = Math.min(y, roofY(x));
        return [x, yy, s * hwAt(x, yy)];
      }, 0.02, (c) => c.y > belt(c.x) - 0.004 && c.y < roofY(c.x) - 0.0005 && !inDLO(c.x, c.y));
      g.add(mesh(side, M.paint));
    }
    add('Roof and pillars', 'The roof panel and the A-, B- and C-pillars around the windows. Together they form the safety cage that protects the occupants in a rollover.',
      g, [0, 1.0, 0], 0.08);
  }

  // --- Windscreen ---
  {
    const ws = surface(24, 24, (u, v) => {
      const y = lerp(WS_BASE[1] + 0.005, ROOF_Y_WS + 0.003, u);
      const x = xWS(y) + 0.004;
      const s = v * 2 - 1;
      return [x + 0.018 * (1 - s * s), y + 0.012 * (1 - s * s), s * hwAt(x, y) * 0.985];
    }, 0.006);
    add('Windscreen', 'Laminated front glass. It is bonded into the frame and adds stiffness to the body; the rain sensor and camera sit behind the mirror.',
      mesh(ws, M.glass), [0.6, 0.55, 0], 0.15);
  }

  // --- Side glass (with glossy black B-pillar trim and chrome surround) ---
  for (const s of [-1, 1]) {
    const gl = surface(70, 14, (u, v) => {
      const t = v;
      const x = lerp(dloFront(t) + 0.01, dloRear(t) - 0.01, u);
      const b = belt(x), top = wTop(x);
      const y = lerp(b - 0.004, top + 0.006, t);
      return [x, y, s * (hwAt(x, y) + 0.002)];
    }, 0.005);
    const bp = surface(4, 12, (u, v) => {
      const x = lerp(-0.18, -0.29, u);
      const y = lerp(belt(x), wTop(x) + 0.005, v);
      return [x, y, s * (hwAt(x, y) + 0.006)];
    }, 0.004);
    const trimPts = [];
    for (let i = 0; i <= 30; i++) { const x = lerp(dloFront(0), dloRear(0), i / 30); trimPts.push([x, belt(x) + 0.002, s * (hwAt(x, belt(x)) + 0.002)]); }
    for (let i = 1; i <= 30; i++) {
      const t = i / 30;
      const x = lerp(dloRear(0), dloRear(1), t);
      const y = lerp(belt(x), wTop(x), t);
      trimPts.push([x, y, s * (hwAt(x, y) + 0.004)]);
    }
    for (let i = 1; i <= 40; i++) {
      const x = lerp(dloRear(1), dloFront(1), i / 40);
      trimPts.push([x, wTop(x) + 0.004, s * (hwAt(x, wTop(x)) + 0.004)]);
    }
    for (let i = 1; i <= 16; i++) {
      const t = 1 - i / 16;
      const x = lerp(dloFront(0), dloFront(1), t);
      const y = lerp(belt(x), wTop(x), t);
      trimPts.push([x, y, s * (hwAt(x, y) + 0.004)]);
    }
    const trim = tube(trimPts, 0.006, 240, 6, 0.1);
    add(s > 0 ? 'Side windows (right)' : 'Side windows (left)',
      'Door and rear quarter glass with the glossy black B-pillar trim and chrome window surround.',
      group(mesh(gl, M.glass), mesh(bp, M.gloss), mesh(trim, M.chrome)), [0, 0.35, s * 0.6], 0.16);
  }

  // --- Tailgate with rear screen and roof spoiler ---
  {
    const path = TG;
    const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const along = (u) => curve.getPointAt(u);
    const tg = surface(40, 30, (u, v) => {
      const p = along(u), s = v * 2 - 1;
      return [p.x - 0.03 * (1 - s * s) * Math.sin(u * Math.PI), p.y, s * hwAt(p.x, p.y) * 0.99];
    }, 0.02);
    const g = group(mesh(tg, M.paint));
    const glass = surface(24, 24, (u, v) => {
      const p = along(lerp(0.03, 0.52, u)), s = (v * 2 - 1) * 0.86;
      return [p.x - 0.03 * (1 - s * s) * Math.sin(lerp(0.03, 0.52, u) * Math.PI) - 0.006, p.y + 0.004, s * hwAt(p.x, p.y) * 0.99];
    }, 0.004);
    g.add(mesh(glass, M.glass));
    // gloss-black panel below the rear screen
    const panel = surface(12, 20, (u, v) => {
      const uu = lerp(0.53, 0.72, u), p = along(uu), s = (v * 2 - 1) * lerp(0.8, 0.72, u);
      return [p.x - 0.03 * (1 - s * s) * Math.sin(uu * Math.PI) - 0.005, p.y, s * hwAt(p.x, p.y) * 0.99];
    }, 0.004);
    g.add(mesh(panel, M.gloss));
    // spoiler
    const sp = loftX([
      { x: -1.54, y0: 1.35, y1: 1.395, hwBot: 0.63, hwTop: 0.6, e: 4 },
      { x: -1.64, y0: 1.345, y1: 1.4, hwBot: 0.64, hwTop: 0.61, e: 4 },
      { x: -1.74, y0: 1.325, y1: 1.365, hwBot: 0.62, hwTop: 0.6, e: 4 },
    ], 24);
    g.add(mesh(sp, M.paint));
    // number plate recess (blank) and chrome strip
    const pl = mesh(rbox(0.012, 0.12, 0.52, 0.01), M.alu, [-2.1, 0.745, 0]);
    pl.rotation.z = 0.14;
    g.add(pl);
    const cs = mesh(rbox(0.012, 0.018, 0.9, 0.006), M.chrome, [-2.085, 0.84, 0]);
    cs.rotation.z = 0.2;
    g.add(cs);
    add('Tailgate', 'The rear hatch with its heated rear screen and roof spoiler. Gas struts hold it open; the boot and spare-wheel well are underneath.',
      g, [-0.85, 0.4, 0], 0.05);
  }

  // --- Tail lights (vertical units on the rear pillars, wrapping onto the tailgate) ---
  for (const s of [-1, 1]) {
    const sideLamp = surface(10, 20, (u, v) => {
      const y = lerp(0.78, 1.28, v);
      const x0 = xTG(y) + 0.004;
      const x = lerp(x0, x0 + lerp(0.13, 0.04, v), u);
      return [x, y, s * (hwAt(x, y) + 0.004)];
    }, 0.02);
    const rearLamp = surface(8, 20, (u, v) => {
      const y = lerp(0.78, 1.1, v);
      const x = xTG(y) - 0.006;
      const k = lerp(0.99, 0.84 + 0.06 * v, u);
      return [x, y, s * hwAt(x, y) * k];
    }, 0.02);
    add(s > 0 ? 'Tail light (right)' : 'Tail light (left)',
      'LED rear light cluster: tail, brake and indicator lights, wrapping from the pillar onto the tailgate.',
      group(mesh(sideLamp, M.taillight), mesh(rearLamp, M.taillight)), [-0.55, 0.15, s * 0.4], 0.1);
  }

  // --- Roof rails ---
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const x = lerp(0.05, -1.5, i / 12);
        const y = roofY(x) + (i === 0 || i === 12 ? 0.012 : 0.042);
        pts.push([x, y, s * (hwAt(x, roofY(x)) - 0.075)]);
      }
      g.add(mesh(tube(pts, 0.014, 60, 8, 0.4), M.alu));
      for (const x of [0.01, -1.46]) g.add(mesh(rbox(0.1, 0.035, 0.04, 0.012), M.black, [x, roofY(x) + 0.012, s * (hwAt(x, roofY(x)) - 0.075)]));
    }
    add('Roof rails', 'Aluminium roof rails, standard on the Cross Country. They carry crossbars for a roof box or bike rack.',
      g, [0, 1.45, 0], 0);
  }

  // --- Side sill and wheel-arch cladding ---
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const sill = surface(40, 5, (u, v) => {
      const x = lerp(D.xFA - ARCH_R - 0.02, D.xRA + ARCH_R + 0.02, u);
      const y = lerp(0.2, SILL + 0.06, v);
      return [x, y, s * (hwAt(x, y) + 0.012 + 0.008 * Math.sin(v * Math.PI))];
    }, 0.015);
    g.add(mesh(sill, M.cladding));
    for (const xc of [D.xFA, D.xRA]) {
      const flare = surface(48, 3, (u, v) => {
        const a = lerp(-0.12, Math.PI + 0.12, u);
        const r = ARCH_R + 0.005 + v * 0.07;
        const x = xc + r * Math.cos(a), y = Math.max(0.2, ARCH_Y + r * Math.sin(a));
        return [x, y, s * (hwAt(x, y) + 0.01 + 0.01 * Math.sin(v * Math.PI))];
      }, 0.02);
      g.add(mesh(flare, M.cladding));
    }
    add(s > 0 ? 'Side cladding (right)' : 'Side cladding (left)',
      'Black wheel-arch flares and sill protection, one of the Cross Country’s visual cues. They protect the paint from stone chips.',
      g, [0, -0.12, s * 1.1], 0);
  }

  // --- Dashboard (left-hand drive) ---
  {
    const secs = [0.28, 0.36, 0.5, 0.66, 0.82].map((x) => {
      const t = (x - 0.28) / 0.54;
      return { x, y0: 0.52 + 0.1 * t, y1: lerp(0.9, 0.97, t), hwBot: 0.62, hwTop: hwAt(x, 0.95) * 0.92, e: 6 };
    });
    const g = group(mesh(loftX(secs, 32), M.interior));
    g.add(mesh(rbox(0.16, 0.08, 0.3, 0.03), M.interior, [0.36, 0.93, -0.37])); // instrument binnacle
    g.add(mesh(rbox(0.3, 0.3, 0.2, 0.03), M.interior, [0.2, 0.45, 0])); // centre console
    const wheel = new THREE.TorusGeometry(0.185, 0.017, 10, 40);
    wheel.rotateY(Math.PI / 2);
    wheel.rotateZ(-0.35);
    g.add(mesh(wheel, M.black, [0.1, 0.84, -0.37]));
    g.add(rod([0.1, 0.84, -0.37], [0.36, 0.76, -0.37], 0.025, 12, M.black));
    g.add(mesh(rbox(0.05, 0.1, 0.12, 0.02), M.black, [0.1, 0.84, -0.37]));
    add('Dashboard', 'Simplified dashboard with the steering wheel and centre console, shown so you can see where the LPG switch is mounted.',
      g, [-0.4, 0.55, 0], 0.2);
  }
}
