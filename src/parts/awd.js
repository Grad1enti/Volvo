import * as THREE from 'three';
import { D } from '../dims.js';
import { M } from '../materials.js';
import { mesh, rbox, group, cylX, cylZ } from '../geom.js';

const Y = new THREE.Vector3(0, 1, 0);
// Prop shaft speed relative to the wheels = rear final-drive ratio.
export const PROP_RATIO = 2.6;

/**
 * A shaft between a and b that can spin about its own axis. Returns the outer
 * (oriented) group; `spinner` rotates about local y.
 */
function shaft(a, b, r, { boots = false, joints = false, marker = true } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const outer = new THREE.Group();
  outer.position.copy(A).add(B).multiplyScalar(0.5);
  outer.quaternion.setFromUnitVectors(Y, B.clone().sub(A).normalize());
  const spinner = new THREE.Group();
  outer.add(spinner);
  spinner.add(mesh(new THREE.CylinderGeometry(r, r, len, 16), M.shaft));
  if (boots) {
    for (const s of [-1, 1]) {
      const boot = new THREE.LatheGeometry(
        Array.from({ length: 9 }, (_, i) => new THREE.Vector2(r + 0.012 + (i % 2) * 0.01 + (s > 0 ? i : 8 - i) * 0.004, i * 0.012)),
        16,
      );
      boot.translate(0, -0.048, 0);
      const bm = mesh(boot, M.boot, [0, s * (len / 2 - 0.07), 0]);
      if (s < 0) bm.rotation.z = Math.PI;
      spinner.add(bm);
      spinner.add(mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.05, 20), M.steel, [0, s * (len / 2 - 0.02), 0]));
    }
  }
  if (joints) {
    for (const s of [-1, 1]) {
      spinner.add(mesh(rbox(r * 3.2, 0.04, r * 3.2, 0.01), M.steel, [0, s * (len / 2 - 0.03), 0]));
      spinner.add(mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.05, 16), M.steel, [0, s * (len / 2 - 0.07), 0]));
    }
  }
  if (marker) {
    // painted balance marks make the rotation readable
    spinner.add(mesh(rbox(0.012, Math.min(0.12, len * 0.25), 0.006, 0.002), M.marker, [0, 0, r + 0.001]));
    spinner.add(mesh(rbox(0.012, Math.min(0.08, len * 0.2), 0.006, 0.002), M.marker, [0, len * 0.25, -r - 0.001]));
  }
  return { outer, spinner };
}

export function buildAWD(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'awd', object, explode, delay });
  const wy = D.wheelY;

  // Driveline layout (x forward, z right)
  const FD = [1.3, 0.34, -0.24]; // front differential (in the gearbox case)
  const PTU = [1.2, 0.33, 0.02]; // angle gear / power take-off
  const RD = [D.xRA, 0.33, 0]; // rear differential
  const CPL = [D.xRA + 0.2, 0.34, 0]; // Haldex coupling, bolted to the front of the rear diff

  // --- Front differential ---
  {
    const g = group(
      mesh(cylZ(0.12, 0.12, 0.16, 32), M.gearbox, FD),
      mesh(cylZ(0.07, 0.07, 0.24, 24), M.gearbox, FD),
      mesh(new THREE.SphereGeometry(0.075, 20, 14), M.gearbox, [FD[0] - 0.06, FD[1] - 0.02, FD[2]]),
    );
    add('Front differential', 'Built into the bottom of the gearbox case. It splits drive between the left and right front wheels and lets them turn at different speeds in corners.',
      g, [0, -0.35, -0.45], 0.78);
  }

  // --- Angle gear (PTU) ---
  {
    const g = group(
      mesh(rbox(0.2, 0.17, 0.2, 0.05), M.gearbox, PTU),
      mesh(cylX(0.06, 0.05, 0.1, 20), M.gearbox, [PTU[0] - 0.14, PTU[1], PTU[2]]),
      mesh(cylZ(0.05, 0.05, 0.22, 20), M.gearbox, [PTU[0], PTU[1], PTU[2] - 0.1]),
    );
    add('Angle gear (power take-off)', 'A bevel gearbox on the side of the transmission. It turns the drive through 90° and sends it backwards into the prop shaft.',
      g, [0.15, -0.4, 0.25], 0.8);
  }

  // --- Prop shaft (two piece with centre bearing) ---
  {
    const g = new THREE.Group();
    const a = [PTU[0] - 0.19, PTU[1] - 0.005, 0.02], mid = [-0.05, 0.3, 0.01], b = [CPL[0] + 0.12, CPL[1], 0];
    const s1 = shaft(a, mid, 0.032, { joints: true });
    const s2 = shaft(mid, b, 0.032, { joints: true });
    g.add(s1.outer, s2.outer);
    reg.spin(s1.spinner, 'y', PROP_RATIO);
    reg.spin(s2.spinner, 'y', PROP_RATIO);
    g.add(mesh(rbox(0.06, 0.08, 0.16, 0.02), M.black, [mid[0], mid[1] + 0.02, mid[2]])); // centre bearing
    add('Prop shaft', 'Two-piece steel shaft running under the floor from the front angle gear to the rear axle. It spins faster than the wheels because the rear differential gears it down.',
      g, [0, -0.6, 0], 0.72);
  }

  // --- Rear electronically controlled coupling (Haldex Gen 5) ---
  {
    const g = group(
      mesh(cylX(0.085, 0.08, 0.2, 32), M.alu, CPL),
      mesh(cylX(0.05, 0.05, 0.06, 20), M.alu, [CPL[0] + 0.12, CPL[1], 0]),
      mesh(rbox(0.1, 0.05, 0.09, 0.01), M.black, [CPL[0] - 0.02, CPL[1] + 0.1, 0.02]), // control unit / pump
      mesh(cylZ(0.022, 0.022, 0.06, 12), M.black, [CPL[0] + 0.05, CPL[1] + 0.09, 0.07]),
    );
    add('Rear electronic coupling (Haldex Gen 5)', 'An electronically controlled multi-plate clutch. Normally the car is mostly front-wheel drive; when the front starts to slip, the coupling clamps and sends torque to the rear within milliseconds.',
      g, [-0.3, -0.45, 0.2], 0.8);
  }

  // --- Rear differential ---
  {
    const g = group(
      mesh(new THREE.SphereGeometry(0.11, 28, 20), M.gearbox, RD),
      mesh(cylZ(0.1, 0.1, 0.05, 28), M.gearbox, [RD[0], RD[1], RD[2] + 0.07]),
      mesh(cylZ(0.05, 0.05, 0.32, 20), M.gearbox, RD),
      mesh(cylX(0.06, 0.07, 0.08, 20), M.gearbox, [RD[0] + 0.1, RD[1], 0]),
    );
    for (const s of [-1, 1]) g.add(mesh(rbox(0.05, 0.05, 0.08, 0.01), M.black, [RD[0] - 0.03, RD[1] + 0.1, s * 0.12]));
    add('Rear differential', 'Final drive for the rear wheels, mounted on the rear subframe. Like the front one, it lets the left and right wheels turn at different speeds.',
      g, [-0.2, -0.5, -0.2], 0.85);
  }

  // --- Driveshafts ---
  const ds = (name, a, b, explode, extra) => {
    const g = new THREE.Group();
    const s = shaft(a, b, 0.02, { boots: true });
    g.add(s.outer);
    reg.spin(s.spinner, 'y', 1);
    if (extra) for (const e of extra) { const x = shaft(e[0], e[1], 0.022, {}); g.add(x.outer); reg.spin(x.spinner, 'y', 1); g.add(mesh(rbox(0.06, 0.1, 0.05, 0.01), M.black, [e[1][0], e[1][1] + 0.02, e[1][2] - 0.02])); }
    add(name, 'Axle shaft with a constant-velocity (CV) joint at each end, inside rubber boots. It turns at exactly wheel speed while the suspension moves up and down.',
      g, explode, 0.75);
  };
  ds('Driveshaft (front left)', [FD[0], FD[1], FD[2] - 0.13], [D.xFA, wy, -(D.trackF / 2 - 0.1)], [0, -0.3, -0.55]);
  ds('Driveshaft (front right)', [PTU[0] + 0.06, 0.33, 0.24], [D.xFA, wy, D.trackF / 2 - 0.1], [0, -0.3, 0.55],
    [[[PTU[0] + 0.02, 0.335, PTU[2] + 0.1], [PTU[0] + 0.06, 0.33, 0.25]]]);
  for (const s of [-1, 1]) {
    ds(`Driveshaft (rear ${s < 0 ? 'left' : 'right'})`, [RD[0], RD[1], s * 0.17], [D.xRA, wy, s * (D.trackR / 2 - 0.1)], [0, -0.3, s * 0.5]);
  }
}
