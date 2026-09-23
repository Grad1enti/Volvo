import * as THREE from 'three';
import { D } from '../dims.js';
import { M } from '../materials.js';
import { mesh, rbox, rod, tube, group, cylZ, lerp } from '../geom.js';

/** Helical coil spring between points a and b. */
export function coil(a, b, radius, turns, wire, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const axis = B.clone().sub(A);
  const len = axis.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  const pts = [];
  const n = Math.round(turns * 24);
  for (let i = 0; i <= n; i++) {
    const t = i / n, ang = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(ang) * radius, t * len, Math.sin(ang) * radius).applyQuaternion(q).add(A));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return mesh(new THREE.TubeGeometry(curve, n * 2, wire, 6, false), mat);
}

/** Tyre + alloy wheel centred at the origin, axis along +z (face towards +z). */
function wheelAssembly() {
  const R = D.tyreR, W = D.tyreW, rr = D.rimR;
  const g = new THREE.Group();
  // tyre cross-section revolved around the axle
  const prof = [];
  const sh = 0.035; // shoulder radius
  prof.push(new THREE.Vector2(rr + 0.004, -W * 0.44));
  prof.push(new THREE.Vector2(rr + 0.03, -W * 0.5));
  for (let i = 0; i <= 6; i++) { const f = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(R - sh + sh * Math.cos(f), -W / 2 + sh + sh * Math.sin(f))); }
  for (let i = 0; i <= 6; i++) { const f = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(R - sh + sh * Math.cos(f), W / 2 - sh + sh * Math.sin(f))); }
  prof.push(new THREE.Vector2(rr + 0.03, W * 0.5));
  prof.push(new THREE.Vector2(rr + 0.004, W * 0.44));
  const tyre = new THREE.LatheGeometry(prof, 56);
  tyre.rotateX(Math.PI / 2);
  g.add(mesh(tyre, M.rubber));
  // tread grooves (circumferential), subtle
  for (const z of [-0.05, 0, 0.05]) {
    const t = new THREE.TorusGeometry(R + 0.0005, 0.006, 4, 64);
    g.add(mesh(t, M.black, [0, 0, z]));
  }
  // rim barrel + lip
  g.add(mesh(cylZ(rr, rr, W * 0.86, 40, true), M.darkAlu));
  const lip = new THREE.TorusGeometry(rr, 0.009, 6, 48);
  g.add(mesh(lip, M.alu, [0, 0, W * 0.42]));
  // five double spokes
  const face = W * 0.36;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const d of [-0.12, 0.12]) {
      const sp = mesh(rbox(0.026, rr * 0.8, 0.028, 0.008), M.alu);
      const ang = a + d;
      sp.position.set(Math.cos(ang + Math.PI / 2) * rr * 0.5, Math.sin(ang + Math.PI / 2) * rr * 0.5, face);
      sp.rotation.z = ang;
      g.add(sp);
    }
  }
  g.add(mesh(cylZ(0.07, 0.075, 0.05, 24), M.alu, [0, 0, face - 0.005]));
  g.add(mesh(cylZ(0.035, 0.035, 0.012, 20), M.black, [0, 0, face + 0.024]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    g.add(mesh(cylZ(0.009, 0.009, 0.012, 8), M.chrome, [Math.cos(a) * 0.052, Math.sin(a) * 0.052, face + 0.024]));
  }
  return g;
}

function brake(front) {
  const r = front ? 0.15 : 0.143, th = front ? 0.028 : 0.012;
  const disc = new THREE.Group();
  disc.add(mesh(cylZ(r, r, th, 48), M.disc));
  disc.add(mesh(cylZ(0.085, 0.085, 0.05, 32), M.steel, [0, 0, 0.025]));
  // drilled marks so rotation is visible
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    disc.add(mesh(cylZ(0.008, 0.008, th + 0.002, 8), M.black, [Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, 0]));
  }
  const cal = new THREE.Group();
  cal.add(mesh(rbox(0.1, front ? 0.16 : 0.12, 0.07, 0.02), M.caliper));
  cal.add(mesh(rbox(0.06, 0.12, 0.02, 0.008), M.darkAlu, [0.015, 0, -0.04]));
  const a = Math.PI * 0.82; // trailing position, behind the axle
  cal.position.set(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 0);
  cal.rotation.z = a - Math.PI;
  return { disc, cal };
}

export function buildChassis(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'chassis', object, explode, delay });
  const sides = [[-1, 'left'], [1, 'right']];

  // --- Wheels and brakes ---
  for (const [xa, tr, front] of [[D.xFA, D.trackF / 2, true], [D.xRA, D.trackR / 2, false]]) {
    for (const [s, sn] of sides) {
      const pos = [xa, D.wheelY, s * tr];
      const holder = new THREE.Group();
      holder.position.set(...pos);
      if (s < 0) holder.scale.z = -1; // mirror so the wheel face points outward
      const spin = new THREE.Group();
      spin.add(wheelAssembly());
      holder.add(spin);
      reg.spin(spin, 'z', 1);
      add(`${front ? 'Front' : 'Rear'} wheel (${sn})`,
        '17-inch alloy wheel with a 225/50 R17 tyre, about 66 cm across. The Cross Country sits a little higher than a normal V40 for more ground clearance.',
        holder, [front ? 0.1 : -0.1, -0.05, s * 1.25], 0.3);

      const bh = new THREE.Group();
      bh.position.set(pos[0], pos[1], s * (tr - 0.075));
      if (s < 0) bh.scale.z = -1;
      const { disc, cal } = brake(front);
      const bspin = new THREE.Group();
      bspin.add(disc);
      bh.add(bspin, cal);
      reg.spin(bspin, 'z', 1);
      add(`${front ? 'Front' : 'Rear'} brake (${sn})`,
        front
          ? 'Ventilated 300 mm front disc with a sliding caliper. When you brake, hydraulic pressure squeezes the pads onto the spinning disc.'
          : 'Solid rear disc and caliper. The rear caliper also works as the electric parking brake.',
        bh, [0, 0.05, s * 0.8], 0.42);
    }
  }

  // --- Front subframe (with anti-roll bar and steering rack) ---
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      g.add(rod([1.72, 0.27, s * 0.42], [0.98, 0.25, s * 0.38], 0.035, 10, M.rustSteel));
      g.add(mesh(rbox(0.08, 0.06, 0.08, 0.015), M.black, [0.98, 0.29, s * 0.38]));
    }
    g.add(mesh(rbox(0.12, 0.06, 0.86, 0.02), M.rustSteel, [1.08, 0.25, 0]));
    g.add(mesh(rbox(0.08, 0.05, 0.86, 0.02), M.rustSteel, [1.62, 0.27, 0]));
    // anti-roll bar
    g.add(mesh(tube([[1.2, 0.33, 0.62], [1.12, 0.31, 0.5], [1.1, 0.31, 0], [1.12, 0.31, -0.5], [1.2, 0.33, -0.62]], 0.012, 40, 8), M.black));
    // steering rack + tie rods
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 16).rotateX(Math.PI / 2), M.alu, [1.17, 0.36, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 16).rotateX(Math.PI / 2), M.darkAlu, [1.17, 0.36, -0.2]));
    for (const s of [-1, 1]) g.add(rod([1.17, 0.36, s * 0.35], [1.2, 0.38, s * 0.66], 0.011, 8, M.steel));
    add('Front subframe', 'Steel cradle bolted under the engine bay. It carries the lower suspension arms, the anti-roll bar and the steering rack.',
      g, [0.15, -0.7, 0], 0.55);
  }

  // --- Front MacPherson struts ---
  for (const [s, sn] of sides) {
    const g = new THREE.Group();
    const z = (v) => s * v;
    const bot = [D.xFA - 0.02, 0.42, z(0.65)], top = [D.xFA - 0.07, 0.9, z(0.57)];
    g.add(rod(bot, [lerp(bot[0], top[0], 0.55), lerp(bot[1], top[1], 0.55), lerp(bot[2], top[2], 0.55)], 0.032, 16, M.black));
    g.add(rod([lerp(bot[0], top[0], 0.5), lerp(bot[1], top[1], 0.5), lerp(bot[2], top[2], 0.5)], top, 0.012, 10, M.chrome));
    g.add(coil([lerp(bot[0], top[0], 0.36), lerp(bot[1], top[1], 0.36), lerp(bot[2], top[2], 0.36)], [lerp(bot[0], top[0], 0.94), lerp(bot[1], top[1], 0.94), lerp(bot[2], top[2], 0.94)], 0.068, 5.5, 0.009, M.spring));
    const seat = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24), M.steel, [lerp(bot[0], top[0], 0.36), lerp(bot[1], top[1], 0.36), lerp(bot[2], top[2], 0.36)]);
    const mount = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.04, 24), M.black, top);
    g.add(seat, mount);
    // knuckle / hub carrier
    g.add(mesh(rbox(0.1, 0.24, 0.06, 0.02), M.steel, [D.xFA, 0.34, z(0.7)]));
    // lower control arm (A-arm)
    g.add(rod([D.xFA, 0.22, z(0.69)], [1.08, 0.25, z(0.38)], 0.018, 8, M.rustSteel));
    g.add(rod([D.xFA, 0.22, z(0.69)], [1.55, 0.26, z(0.4)], 0.018, 8, M.rustSteel));
    add(`Front MacPherson strut (${sn})`,
      'Spring and shock absorber in one unit, with the hub carrier and lower wishbone. The strut also acts as the steering pivot for the front wheel.',
      g, [0, 0.45, s * 0.55], 0.5);
  }

  // --- Rear subframe ---
  {
    const g = new THREE.Group();
    const xa = D.xRA;
    for (const s of [-1, 1]) g.add(rod([xa + 0.32, 0.3, s * 0.48], [xa - 0.3, 0.3, s * 0.48], 0.03, 10, M.rustSteel));
    g.add(mesh(rbox(0.07, 0.06, 1.0, 0.02), M.rustSteel, [xa + 0.22, 0.3, 0]));
    g.add(mesh(rbox(0.07, 0.06, 1.0, 0.02), M.rustSteel, [xa - 0.22, 0.3, 0]));
    for (const s of [-1, 1]) for (const dx of [0.32, -0.3]) g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), M.black, [xa + dx, 0.34, s * 0.48]));
    g.add(mesh(tube([[xa - 0.08, 0.27, 0.64], [xa - 0.12, 0.27, 0.45], [xa - 0.12, 0.27, -0.45], [xa - 0.08, 0.27, -0.64]], 0.01, 30, 8), M.black));
    add('Rear subframe', 'Rear cradle that holds the multilink arms and, on the AWD car, the rear differential. Rubber bushings isolate road noise from the cabin.',
      g, [-0.15, -0.7, 0], 0.55);
  }

  // --- Rear multilink suspension ---
  for (const [s, sn] of sides) {
    const g = new THREE.Group();
    const xa = D.xRA, z = (v) => s * v;
    g.add(mesh(rbox(0.12, 0.22, 0.07, 0.02), M.steel, [xa, 0.34, z(0.69)])); // wheel carrier
    g.add(rod([xa + 0.03, 0.33, z(0.66)], [xa + 0.6, 0.37, z(0.6)], 0.02, 8, M.rustSteel)); // trailing arm
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 14).rotateX(Math.PI / 2), M.black, [xa + 0.6, 0.37, z(0.6)]));
    g.add(rod([xa + 0.02, 0.47, z(0.66)], [xa + 0.04, 0.43, z(0.36)], 0.013, 8, M.steel)); // upper arm
    g.add(rod([xa - 0.14, 0.29, z(0.66)], [xa - 0.16, 0.29, z(0.36)], 0.011, 8, M.steel)); // toe link
    // lower arm with spring seat
    g.add(rod([xa - 0.04, 0.24, z(0.66)], [xa - 0.05, 0.26, z(0.33)], 0.02, 8, M.rustSteel));
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 20), M.steel, [xa - 0.05, 0.265, z(0.5)]));
    g.add(coil([xa - 0.05, 0.27, z(0.5)], [xa - 0.05, 0.5, z(0.5)], 0.06, 4.5, 0.009, M.spring));
    // damper
    g.add(rod([xa - 0.11, 0.27, z(0.62)], [xa - 0.15, 0.55, z(0.6)], 0.026, 14, M.black));
    g.add(rod([xa - 0.15, 0.55, z(0.6)], [xa - 0.17, 0.72, z(0.59)], 0.01, 8, M.chrome));
    add(`Rear multilink suspension (${sn})`,
      'Several separate arms locate each rear wheel precisely, with a coil spring and separate shock absorber. This keeps the tyre flat on the road over bumps.',
      g, [0, -0.2, s * 0.6], 0.5);
  }
}
