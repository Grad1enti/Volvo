import * as THREE from 'three';
import { M } from '../materials.js';
import { mesh, rbox, tube, group, cylX, cylZ, lerp } from '../geom.js';

// Transverse 2.0 L five-cylinder (B5204T9). Cylinders run across the car (z),
// intake faces forward, exhaust manifold and turbo face the bulkhead, and the
// Aisin gearbox sits on the left (-z) end of the engine.
export const ENG = { x: 1.44, crankY: 0.45, z0: -0.16, z1: 0.44 };
export const cylZs = [0, 1, 2, 3, 4].map((i) => lerp(-0.08, 0.36, i / 4));

export function buildPowertrain(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'powertrain', object, explode, delay });
  const zc = (ENG.z0 + ENG.z1) / 2, zl = ENG.z1 - ENG.z0;

  // --- Engine ---
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.3, 0.36, zl, 0.03), M.engine, [ENG.x, 0.54, zc])); // block
    g.add(mesh(rbox(0.27, 0.1, 0.5, 0.02), M.engineDark, [ENG.x + 0.02, 0.32, zc + 0.02])); // sump
    g.add(mesh(rbox(0.28, 0.12, zl - 0.04, 0.025), M.engine, [ENG.x - 0.01, 0.78, zc])); // head
    g.add(mesh(rbox(0.25, 0.07, zl - 0.08, 0.03), M.cover, [ENG.x - 0.01, 0.87, zc])); // cam cover
    for (const z of cylZs) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 14), M.engineDark, [ENG.x - 0.01, 0.92, z])); // coil packs
    // timing belt cover and pulleys on the right-hand end
    g.add(mesh(rbox(0.3, 0.5, 0.04, 0.03), M.cover, [ENG.x, 0.6, ENG.z1 + 0.02]));
    g.add(mesh(cylZ(0.085, 0.085, 0.03, 32), M.steel, [ENG.x + 0.05, ENG.crankY, ENG.z1 + 0.06]));
    g.add(mesh(cylZ(0.07, 0.07, 0.14, 24), M.alu, [ENG.x + 0.2, 0.64, 0.3])); // alternator
    g.add(mesh(cylZ(0.055, 0.055, 0.12, 24), M.alu, [ENG.x + 0.19, 0.42, 0.28])); // A/C compressor
    // oil filter and dipstick
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16), M.marker, [ENG.x + 0.17, 0.46, 0.05]));
    add('Engine – 2.0 five-cylinder turbo', 'The T4’s 2.0-litre inline five-cylinder petrol engine (B5204T9), about 180 hp and 300 Nm. It sits sideways across the engine bay and still runs on petrol for cold starts before switching to LPG.',
      g, [0.05, 0.95, 0.15], 0.72);
  }

  // --- Turbocharger (with exhaust manifold) ---
  {
    const g = new THREE.Group();
    const tx = 1.13, ty = 0.58, tz = 0.06;
    for (const z of cylZs) g.add(mesh(tube([[1.3, 0.73, z], [1.24, 0.7, z], [1.2, 0.64, lerp(z, tz + 0.06, 0.5)], [tx + 0.03, ty + 0.02, tz + 0.08]], 0.018, 20, 8), M.exhaust));
    g.add(mesh(new THREE.TorusGeometry(0.055, 0.035, 12, 28), M.exhaust, [tx, ty, tz + 0.06])); // turbine housing
    g.add(mesh(cylZ(0.03, 0.03, 0.09, 16), M.steel, [tx, ty, tz])); // cartridge
    const comp = mesh(new THREE.TorusGeometry(0.06, 0.032, 12, 28), M.alu, [tx, ty, tz - 0.07]); // compressor housing
    g.add(comp);
    g.add(mesh(cylZ(0.035, 0.04, 0.06, 20, true), M.alu, [tx, ty, tz - 0.12]));
    // heat shield
    g.add(mesh(rbox(0.02, 0.18, 0.5, 0.01), M.alu, [1.22, 0.68, 0.14]));
    add('Turbocharger', 'Exhaust gas spins a turbine, which drives a compressor that pushes extra air into the engine. That is how a 2.0-litre engine makes 180 hp.',
      g, [-0.5, 0.65, 0.2], 0.62);
  }

  // --- Intake, throttle, air filter and front-mounted intercooler ---
  {
    const g = new THREE.Group();
    g.add(mesh(cylZ(0.055, 0.055, 0.48, 24), M.engineDark, [1.68, 0.78, 0.15])); // plenum
    for (const z of cylZs) g.add(mesh(tube([[1.66, 0.76, z], [1.64, 0.7, z], [1.6, 0.7, z]], 0.025, 12, 10), M.engineDark));
    g.add(mesh(cylZ(0.045, 0.045, 0.08, 20), M.alu, [1.68, 0.78, 0.43])); // throttle body
    g.add(mesh(rbox(0.07, 0.22, 0.64, 0.02), M.intercooler, [1.99, 0.37, 0])); // intercooler
    g.add(mesh(rbox(0.074, 0.16, 0.58, 0.01), M.black, [1.99, 0.37, 0]));
    // charge pipes: compressor -> intercooler -> throttle
    g.add(mesh(tube([[1.13, 0.58, -0.07], [1.12, 0.8, -0.22], [1.5, 0.86, -0.36], [1.84, 0.64, -0.36], [1.96, 0.42, -0.32]], 0.03, 60, 10), M.hose));
    g.add(mesh(tube([[1.96, 0.42, 0.32], [1.9, 0.62, 0.42], [1.76, 0.78, 0.5], [1.7, 0.78, 0.46]], 0.03, 40, 10), M.hose));
    // air filter box above the gearbox and inlet duct to the turbo
    g.add(mesh(rbox(0.36, 0.13, 0.26, 0.03), M.cover, [1.42, 0.86, -0.42]));
    g.add(mesh(tube([[1.25, 0.84, -0.36], [1.12, 0.74, -0.24], [1.13, 0.6, -0.16]], 0.035, 30, 10), M.hose));
    add('Intake and intercooler', 'Fresh air goes through the air filter to the turbo, then through the intercooler behind the bumper to cool it down, and into the intake manifold that feeds each cylinder.',
      g, [0.65, 0.55, 0], 0.64);
  }

  // --- Radiator and fan ---
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.035, 0.42, 0.68, 0.01), M.intercooler, [1.86, 0.62, 0]));
    g.add(mesh(rbox(0.05, 0.38, 0.6, 0.02), M.black, [1.81, 0.62, 0]));
    for (const z of [-0.15, 0.15]) g.add(mesh(cylX(0.13, 0.13, 0.03, 24), M.cover, [1.78, 0.62, z]));
    add('Radiator and fan', 'Cools the engine’s coolant with air flowing in through the grille. On this car the coolant also warms the LPG reducer.',
      g, [0.95, 0.35, 0], 0.6);
  }

  // --- Exhaust with close-coupled catalytic converter ---
  {
    const g = new THREE.Group();
    // downpipe + cat
    g.add(mesh(tube([[1.13, 0.54, 0.14], [1.08, 0.42, 0.16], [0.98, 0.3, 0.17], [0.92, 0.27, 0.17]], 0.03, 30, 10), M.exhaust));
    g.add(mesh(cylX(0.075, 0.075, 0.3, 24), M.cat, [0.76, 0.27, 0.17]));
    g.add(mesh(cylX(0.03, 0.075, 0.06, 24), M.cat, [0.93, 0.27, 0.17]));
    g.add(mesh(cylX(0.075, 0.03, 0.06, 24), M.cat, [0.59, 0.27, 0.17]));
    // pipe under the tunnel, middle silencer, rear silencer, tailpipe
    g.add(mesh(tube([[0.56, 0.27, 0.17], [0.2, 0.25, 0.18], [-0.1, 0.24, 0.18]], 0.026, 30, 10), M.exhaust));
    const mid = mesh(cylX(0.07, 0.07, 0.5, 24), M.exhaust, [-0.37, 0.24, 0.18]);
    mid.scale.set(1, 0.8, 1.25);
    g.add(mid);
    g.add(mesh(tube([[-0.62, 0.24, 0.18], [-1.1, 0.22, 0.2], [-1.4, 0.21, 0.2], [-1.48, 0.21, 0.08]], 0.026, 40, 10), M.exhaust));
    g.add(mesh(rbox(0.22, 0.09, 0.62, 0.04), M.exhaust, [-1.58, 0.21, 0.2]));
    g.add(mesh(tube([[-1.62, 0.21, 0.48], [-1.9, 0.22, 0.5], [-2.05, 0.24, 0.5]], 0.028, 30, 10), M.exhaust));
    g.add(mesh(cylX(0.036, 0.036, 0.06, 20, true), M.chrome, [-2.05, 0.24, 0.5]));
    add('Exhaust and catalytic converter', 'Burnt gases leave the turbo, pass through the catalytic converter that cleans them, then two silencers before the tailpipe. It runs beside the prop shaft under the car.',
      g, [0, -0.45, 0.35], 0.5);
  }

  // --- Automatic gearbox (Aisin 6-speed Geartronic) ---
  {
    const g = new THREE.Group();
    g.add(mesh(cylZ(0.2, 0.17, 0.12, 36), M.gearbox, [ENG.x - 0.02, 0.5, ENG.z0 - 0.06])); // bell housing
    g.add(mesh(rbox(0.32, 0.32, 0.26, 0.05), M.gearbox, [ENG.x - 0.06, 0.5, ENG.z0 - 0.25]));
    g.add(mesh(cylZ(0.14, 0.12, 0.08, 32), M.gearbox, [ENG.x - 0.02, 0.52, ENG.z0 - 0.42]));
    g.add(mesh(rbox(0.26, 0.05, 0.3, 0.02), M.engineDark, [ENG.x - 0.06, 0.33, ENG.z0 - 0.25])); // oil pan / valve body
    g.add(mesh(rbox(0.06, 0.08, 0.1, 0.01), M.black, [ENG.x + 0.12, 0.6, ENG.z0 - 0.3])); // TCM connector
    add('Automatic gearbox – 6-speed Geartronic', 'Aisin six-speed torque-converter automatic, mounted on the end of the engine. You can also change gear yourself with the Geartronic lever.',
      g, [0.1, 0.55, -0.6], 0.68);
  }
}
