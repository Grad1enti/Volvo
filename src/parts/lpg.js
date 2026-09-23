import * as THREE from 'three';
import { M } from '../materials.js';
import { mesh, rbox, tube, group, cylX, cylZ } from '../geom.js';
import { hwAt } from './body.js';
import { cylZs } from './powertrain.js';

// Aftermarket sequential LPG (autogas) system. Positions follow a typical
// installation: toroidal tank in the spare-wheel well, filler next to the
// petrol flap (right rear), copper supply line under the floor on the side away
// from the exhaust, reducer and injectors in the engine bay.
export function buildLPG(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'lpg', object, explode, delay });

  const TANK = [-1.76, 0.4, 0];
  const MV = [TANK[0] + 0.1, 0.44, -0.02]; // multivalve, inside the tank's centre hole
  const FILL = [-1.62, 0.84, hwAt(-1.62, 0.84) - 0.01];
  const RED = [1.05, 0.66, -0.42]; // reducer / vaporizer
  const RAIL = [1.6, 0.875, 0.15];
  const ECU = [1.6, 0.7, 0.6];
  const SW = [0.268, 0.83, 0.12]; // dashboard switch

  // --- Toroidal tank ---
  {
    const g = new THREE.Group();
    const torus = new THREE.TorusGeometry(0.2, 0.11, 24, 64);
    torus.rotateX(Math.PI / 2);
    g.add(mesh(torus, M.lpgTank, TANK));
    // weld seam
    const seam = new THREE.TorusGeometry(0.31, 0.004, 6, 64);
    seam.rotateX(Math.PI / 2);
    g.add(mesh(seam, M.steel, TANK));
    // mounting straps
    for (const z of [-0.16, 0.16]) g.add(mesh(rbox(0.72, 0.012, 0.035, 0.004), M.black, [TANK[0], TANK[1] + 0.112, z]));
    add('LPG tank (toroidal)', 'A doughnut-shaped gas tank in the spare-wheel well, roughly 62 cm across and 22 cm tall, holding about 50 litres. It is filled to 80 %, so there is room for the liquid to expand.',
      g, [-0.45, 1.0, 0], 0.6);
  }

  // --- Multivalve with sealed vent box ---
  {
    const g = group(
      mesh(rbox(0.07, 0.06, 0.1, 0.01), M.alu, MV),
      mesh(rbox(0.1, 0.07, 0.13, 0.02), M.black, [MV[0], MV[1] + 0.06, MV[2]]),
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 18), M.marker, [MV[0] - 0.02, MV[1] + 0.1, MV[2] + 0.02]),
    );
    add('Multivalve', 'Mounted on the tank. It stops filling at 80 %, drives the fuel gauge, and has an electric shut-off valve plus an excess-flow valve that closes if a line breaks. The black box around it vents any leak outside the car.',
      g, [-0.3, 1.45, 0.2], 0.65);
  }

  // --- Filler valve ---
  {
    const g = new THREE.Group();
    g.add(mesh(cylZ(0.022, 0.022, 0.06, 20), M.brass, [FILL[0], FILL[1], FILL[2] - 0.02]));
    g.add(mesh(cylZ(0.028, 0.028, 0.012, 20), M.black, [FILL[0], FILL[1], FILL[2] + 0.012])); // cap
    g.add(mesh(rbox(0.09, 0.09, 0.012, 0.01), M.steel, [FILL[0], FILL[1], FILL[2] - 0.05]));
    add('LPG filler valve', 'Where you fill up with autogas, next to the petrol filler. It has a non-return valve, so gas can only go in.',
      g, [0, 0.2, 0.55], 0.55);
  }

  // --- Filler line: filler -> multivalve ---
  add('Filler line', 'Copper pipe that carries liquid LPG from the filler valve into the tank through the multivalve.',
    group(mesh(tube([[FILL[0], FILL[1], FILL[2] - 0.05], [-1.63, 0.8, 0.76], [-1.64, 0.6, 0.62], [-1.66, 0.46, 0.4], [-1.68, 0.45, 0.2], [MV[0], MV[1], MV[2] + 0.05]], 0.006, 80, 6), M.copper)),
    [-0.1, 0.35, 0.45], 0.62);

  // --- Gas supply line under the car (left side, away from the exhaust) ---
  {
    const pts = [
      [MV[0], MV[1] - 0.02, MV[2] - 0.05], [-1.62, 0.3, -0.12], [-1.5, 0.245, -0.3], [-1.2, 0.235, -0.42],
      [-0.4, 0.235, -0.44], [0.5, 0.235, -0.44], [0.9, 0.27, -0.46], [0.99, 0.45, -0.46], [RED[0] - 0.02, RED[1] - 0.05, RED[2] - 0.03],
    ];
    const g = group(mesh(tube(pts, 0.005, 220, 6, 0.3), M.copper));
    for (const x of [-1.0, -0.5, 0, 0.45]) g.add(mesh(rbox(0.03, 0.02, 0.04, 0.005), M.black, [x, 0.235, -0.44])); // clips
    add('Gas supply line', 'Thin copper pipe that runs under the floor from the tank to the engine bay, carrying liquid LPG under pressure. It is clipped to the body on the opposite side from the hot exhaust.',
      g, [0, -0.5, -0.4], 0.7);
  }

  // --- Reducer / vaporizer + gas filter ---
  {
    const g = new THREE.Group();
    const body = mesh(cylX(0.07, 0.07, 0.07, 32), M.alu, RED);
    const cover = mesh(cylX(0.072, 0.06, 0.03, 32), M.alu, [RED[0] + 0.05, RED[1], RED[2]]);
    g.add(body, cover);
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 16), M.lpgGreen, [RED[0] - 0.02, RED[1] + 0.07, RED[2] - 0.03])); // inlet solenoid
    // coolant hoses from the heater circuit (the reducer needs heat to boil the LPG)
    g.add(mesh(tube([[RED[0], RED[1] - 0.06, RED[2] + 0.03], [1.08, 0.56, -0.3], [1.2, 0.6, -0.18], [1.3, 0.66, -0.12]], 0.011, 40, 8), M.hose));
    g.add(mesh(tube([[RED[0], RED[1] - 0.06, RED[2] - 0.04], [1.02, 0.52, -0.3], [1.15, 0.5, -0.14], [1.3, 0.56, -0.12]], 0.011, 40, 8), M.hose));
    // gas filter + hose to the injector rail
    const F = [1.12, 0.82, -0.2];
    g.add(mesh(cylX(0.026, 0.026, 0.11, 20), M.alu, F));
    g.add(mesh(tube([[RED[0] + 0.02, RED[1] + 0.07, RED[2]], [1.08, 0.8, -0.3], [F[0] - 0.06, F[1], F[2]]], 0.009, 30, 8), M.hose));
    g.add(mesh(tube([[F[0] + 0.06, F[1], F[2]], [1.35, 0.95, -0.12], [1.55, 0.93, 0.0], [RAIL[0], RAIL[1], RAIL[2] - 0.24]], 0.009, 50, 8), M.hose));
    add('Reducer / vaporizer', 'Turns liquid LPG into gas and drops its pressure to about 1 bar above intake pressure. Engine coolant flows through it to stop it freezing as the gas expands. The gas filter sits right after it.',
      g, [-0.2, 0.75, -0.5], 0.75);
  }

  // --- Gas injector rail (5 injectors for the five cylinders) ---
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.045, 0.035, 0.46, 0.01), M.alu, RAIL));
    g.add(mesh(cylZ(0.012, 0.012, 0.04, 12), M.brass, [RAIL[0], RAIL[1], RAIL[2] - 0.245]));
    for (const z of cylZs) {
      g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 14), M.lpgGreen, [RAIL[0], RAIL[1] - 0.035, z]));
      g.add(mesh(tube([[RAIL[0], RAIL[1] - 0.06, z], [1.63, 0.8, z], [1.62, 0.74, z]], 0.005, 16, 6), M.hose));
      g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8), M.brass, [1.62, 0.735, z])); // nozzle in runner
    }
    g.add(mesh(rbox(0.04, 0.03, 0.05, 0.008), M.black, [RAIL[0] - 0.04, RAIL[1], RAIL[2] + 0.3])); // MAP sensor
    add('Gas injector rail', 'Five gas injectors, one per cylinder, fed from the filter. They spray gaseous LPG into each intake runner at the same moment as the petrol injectors would.',
      g, [0.2, 1.1, 0.1], 0.8);
  }

  // --- LPG ECU ---
  {
    const g = new THREE.Group();
    const box = mesh(rbox(0.15, 0.1, 0.035, 0.01), M.pcb, ECU);
    g.add(box);
    g.add(mesh(rbox(0.05, 0.03, 0.04, 0.006), M.black, [ECU[0] - 0.05, ECU[1] - 0.06, ECU[2]]));
    // wiring loom to the dashboard switch, through the bulkhead
    g.add(mesh(tube([[ECU[0] - 0.05, ECU[1] - 0.07, ECU[2]], [1.4, 0.82, 0.62], [1.05, 0.9, 0.52], [0.9, 0.88, 0.4], [0.55, 0.9, 0.25], [SW[0] + 0.03, SW[1], SW[2]]], 0.005, 80, 6), M.black));
    add('LPG ECU', 'The gas system’s own computer. It reads the petrol injector signals and translates them into gas injector timing, and switches between petrol and gas.',
      g, [0.3, 0.8, 0.55], 0.7);
  }

  // --- Dashboard switch ---
  {
    const g = new THREE.Group();
    const sw = mesh(rbox(0.018, 0.05, 0.09, 0.008), M.black, SW);
    g.add(sw);
    g.add(mesh(rbox(0.006, 0.02, 0.02, 0.004), M.cover, [SW[0] - 0.01, SW[1] - 0.008, SW[2] + 0.026]));
    for (let i = 0; i < 4; i++) g.add(mesh(rbox(0.004, 0.008, 0.008, 0.002), i === 3 ? M.marker : M.lpgGreen, [SW[0] - 0.01, SW[1] + 0.012, SW[2] - 0.03 + i * 0.013]));
    add('LPG switch', 'Small switch on the dashboard. The LEDs show how much gas is left, and the button changes between petrol and LPG. The car starts on petrol and switches to gas once the engine is warm.',
      g, [-0.35, 0.6, 0], 0.6);
  }
}
