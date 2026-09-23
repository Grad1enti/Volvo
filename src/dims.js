// Published exterior dimensions, 2013-2016 V40 Cross Country (metres).
// Length 4370, width 1802 (excl. mirrors), height 1458 (incl. roof rails),
// wheelbase 2647, track ~1559 front / ~1546 rear, tyres 225/50 R17.
export const D = {
  length: 4.37,
  width: 1.802,
  height: 1.458,
  wheelbase: 2.647,
  trackF: 1.559,
  trackR: 1.546,
  frontOverhang: 0.905,
  tyreW: 0.225,
  tyreR: (17 * 25.4 + 2 * 225 * 0.5) / 2000, // 225/50 R17 -> 0.328 m
  rimR: (17 * 25.4) / 2000,
};
D.xFA = D.wheelbase / 2; // front axle x
D.xRA = -D.wheelbase / 2; // rear axle x
D.xFront = D.xFA + D.frontOverhang;
D.xRear = D.xFront - D.length;
D.hw = D.width / 2;
D.wheelY = D.tyreR;
