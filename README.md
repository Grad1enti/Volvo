# Volvo V40 Cross Country T4 AWD + LPG: 3D exploded view

Interactive, stylized 3D model of a 2014 V40 Cross Country T4 AWD (2.0 L five-cylinder
B5204T9, Aisin 6-speed Geartronic, Haldex Gen-5 AWD) with an aftermarket LPG system.

**Open `volvo-v40-cc.html`**. It is one self-contained file (three.js bundled, no CDN, no
network needed), so you can copy it to a phone and open it in Chrome.

- Drag to orbit, pinch or scroll to zoom, tap a part for its name and description
- **Pull apart** slider explodes the parts (staggered, with dashed guide lines)
- Category chips show one system at a time with the body as a ghosted shell
- **Drive** spins the wheels, driveshafts (wheel speed) and prop shaft (× 2.6 final drive)
- Light/dark mode and `prefers-reduced-motion` are respected

Proportions use the published dimensions: length 4370, width 1802, height 1458,
wheelbase 2647, track ≈1559/1546 mm, 225/50 R17 tyres.

## Build

```sh
npm install
npm run build        # -> dist/index.html and volvo-v40-cc.html
npm run shot out.png explode=0.6 cat=lpg   # headless screenshot (uses /opt/pw-browsers/chromium)
```

Source: `src/parts/{body,chassis,powertrain,awd,lpg}.js` hold the parts, one module per category.
