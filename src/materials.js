import * as THREE from 'three';

const std = (color, roughness = 0.5, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide, ...extra });

export const M = {
  paint: new THREE.MeshPhysicalMaterial({
    color: 0x3c6e96, roughness: 0.32, metalness: 0.55, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide,
  }),
  cladding: std(0x23262a, 0.78, 0.0),
  gloss: std(0x0d0f12, 0.18, 0.3),
  glass: std(0x121b24, 0.05, 0.5, { transparent: true, opacity: 0.8 }),
  headlight: std(0xdfe8f2, 0.08, 0.3, { transparent: true, opacity: 0.8, emissive: 0x9fb4c8, emissiveIntensity: 0.25 }),
  taillight: std(0xa3121c, 0.2, 0.2, { emissive: 0x6a0710, emissiveIntensity: 0.5 }),
  chrome: std(0xd9dde2, 0.14, 1.0),
  alu: std(0xb8bec6, 0.3, 0.9),
  darkAlu: std(0x6d747c, 0.4, 0.8),
  steel: std(0x8a9097, 0.45, 0.85),
  rustSteel: std(0x6a5a50, 0.6, 0.6),
  rubber: std(0x191a1c, 0.9, 0.0),
  black: std(0x202225, 0.6, 0.2),
  caliper: std(0x2a2d31, 0.4, 0.5),
  disc: std(0x9aa0a6, 0.35, 0.9),
  engine: std(0x9ba2aa, 0.45, 0.75),
  engineDark: std(0x3a3e44, 0.55, 0.4),
  cover: std(0x1f2124, 0.55, 0.1),
  exhaust: std(0x8c8378, 0.5, 0.8),
  cat: std(0xb4b0a8, 0.35, 0.9),
  gearbox: std(0xa7adb3, 0.5, 0.7),
  shaft: std(0x51565c, 0.4, 0.8),
  boot: std(0x141516, 0.85, 0.0),
  intercooler: std(0x55595e, 0.5, 0.6),
  hose: std(0x1b1c1e, 0.75, 0.0),
  spring: std(0x9a2a2a, 0.45, 0.5),
  lpgTank: std(0xd8dcdf, 0.45, 0.35),
  lpgGreen: std(0x2f8f5b, 0.45, 0.2),
  copper: std(0xb8733d, 0.35, 0.9),
  brass: std(0xc9a44b, 0.35, 0.9),
  pcb: std(0x2b2f35, 0.5, 0.3),
  interior: std(0x2a2c30, 0.8, 0.0),
  marker: std(0xe8c547, 0.5, 0.2),
};
