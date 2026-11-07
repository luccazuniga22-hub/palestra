// Pose 3D degli esercizi e attrezzi.
// Unità: 1 = circa 1,2 cm (82,5 unità = 1 metro). Asse y in alto, z davanti alla persona, x di lato.
// Lato P = x positiva, lato M = x negativa.
// Ogni esercizio ha due pose: A (partenza, muscolo allungato) e B (arrivo, muscolo contratto).
// Campi della posa:
//   hip      centro del bacino [x,y,z]
//   pitch    inclinazione del busto in gradi (+ in avanti, - indietro)
//   yaw      rotazione del busto in gradi (facoltativo)
//   head     inclinazione della testa in gradi (+ mento verso il petto)
//   hands    posizione delle mani {P:[x,y,z], M:[x,y,z]} oppure {tf:[lato, su, avanti]} rispetto al busto
//   grip     direzione dell'attrezzo impugnato per ogni mano ([x,y,z] o 'sag'); senza grip la mano è libera
//   epole    direzione verso cui puntano i gomiti
//   feet     posizione delle caviglie
//   kpole    direzione verso cui puntano le ginocchia
//   fdir     direzione dei piedi (dal tallone alla punta)

const S = (x, y, z) => ({ P: [x, y, z], M: [-x, y, z] });
const B2 = v => ({ P: v, M: v });
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

export const POSE3 = {

  // ---------------- UPPER ----------------
  'incline-db-press': {
    A: { hip: [0, 53, 0], pitch: -50, head: 8, hands: S(23, 89, -30), grip: B2(X), epole: S(.5, -1, 0), feet: S(16, 5.6, 40), kpole: S(.2, .4, 1) },
    B: { hands: S(18, 133, -36) },
    eq(E) {
      E.inclineBench(-50, 53);
      const d = E.dumbbells(); E.dyn(c => { E.hold(d.P, c.G.P, X); E.hold(d.M, c.G.M, X); });
    },
    cam: { az: .75, el: .22 },
  },
  'pec-deck': {
    A: { hip: [0, 53, 0], pitch: 0, hands: S(42, 122, 3), grip: B2(Y), epole: S(1, -.4, -.3), feet: S(13, 5.6, 32), kpole: S(.1, .2, 1) },
    B: { hands: S(8, 114, 27), epole: S(.6, -.6, .3) },
    eq(E) {
      E.machineSeat(53, true);
      E.box(8, 170, 8, [0, 85, -26]); E.box(80, 8, 8, [0, 168, -26]);
      const lev = ['P', 'M'].map(s => [s, E.beam([0, 0, 0], [0, 1, 0], 2.2), E.beam([0, 0, 0], [0, 1, 0], 2.2), E.pad(5, 26, 6), E.cyl(1.5, 14, 'y', [0, 0, 0], 'metal')]);
      E.dyn(c => { for (const [s, top, down, pad, h] of lev) { const g = c.G[s], sx = s === 'P' ? 1 : -1, el = c.W('forearm', s); E.setBeam(top, [sx * 4, 168, -26], [g[0], 168, g[2]]); E.setBeam(down, [g[0], 168, g[2]], [g[0], g[1] + 7, g[2]]); E.place(h, g); E.place(pad, [(g[0] + el[0]) / 2, (g[1] + el[1]) / 2, (g[2] + el[2]) / 2 + 5]); } });
    },
    cam: { az: .55, el: .2 },
  },
  'machine-lateral-raise': {
    A: { hip: [0, 53, 0], pitch: 0, hands: S(20, 77, 19), epole: S(.6, -1, -.2), feet: S(13, 5.6, 32), kpole: S(.1, .2, 1) },
    B: { hands: S(44, 101, 18), epole: S(1, .2, -.3) },
    eq(E) {
      E.machineSeat(53, true);
      E.box(8, 175, 8, [0, 87, -26]);
      const pads = ['P', 'M'].map(s => [s, E.cyl(4.6, 14, 'z', [0, 0, 0], 'pad'), E.beam([0, 0, 0], [0, 1, 0], 2)]);
      E.dyn(c => { for (const [s, p, l] of pads) { const e = c.W('forearm', s), sx = s === 'P' ? 1 : -1; E.place(p, [e[0] + sx * 6, e[1] + 1, e[2]]); E.setBeam(l, [sx * 14, 103, -22], [e[0] + sx * 6, e[1] + 1, -7]); } });
    },
    cam: { az: .45, el: .18 },
  },
  'lat-pulldown': {
    A: { hip: [0, 53, 0], pitch: -6, hands: S(34, 152, 4), grip: B2(X), epole: S(1, -.3, 0), feet: S(14, 5.6, 32), kpole: S(.1, .2, 1) },
    B: { pitch: -16, hands: S(32, 109, 9), epole: S(.8, -1, -.6) },
    eq(E) {
      E.machineSeat(53, false);
      E.cyl(5, 40, 'x', [0, 66, 24], 'pad'); E.box(6, 30, 6, [0, 50, 24]);
      E.box(10, 205, 10, [0, 102, -34]); E.box(8, 8, 52, [0, 202, -10]); E.cyl(5, 4, 'x', [0, 198, 12], 'metal');
      const bar = E.bar(110), cab = E.line();
      E.dyn(c => { const m = E.mid(c.G.P, c.G.M); E.orient(bar, X, m); E.setLine(cab, m, [0, 196, 12]); });
    },
    cam: { az: .5, el: .12 },
  },
  'machine-row': {
    A: { hip: [0, 53, -4], pitch: 10, hands: S(17, 96, 50), grip: B2(Y), epole: S(.4, -.2, -1), feet: S(14, 12, 40), kpole: S(.2, .5, 1) },
    B: { pitch: 0, hands: S(19, 94, 10) },
    eq(E) {
      E.box(30, 6, 30, [0, 42, -6], 'pad'); E.box(6, 39, 6, [0, 20, -6]); E.box(36, 3, 30, [0, 1.5, -6]);
      E.box(26, 38, 6, [0, 88, 24], 'pad'); E.box(6, 70, 6, [0, 35, 28]);
      E.box(40, 4, 14, [0, 9, 44]); E.box(8, 180, 8, [0, 90, 72]);
      const lev = ['P', 'M'].map(s => [s, E.beam([0, 0, 0], [0, 1, 0], 2.2), E.cyl(1.5, 14, 'y', [0, 0, 0], 'metal')]);
      E.dyn(c => { for (const [s, l, h] of lev) { const g = c.G[s], sx = s === 'P' ? 1 : -1; E.place(h, g); E.setBeam(l, [sx * 20, 170, 66], [g[0], g[1] + 7, g[2]]); } });
    },
    cam: { az: 1.1, el: .2 },
  },
  'triceps-pushdown': {
    A: { hip: [0, 78, 0], pitch: 10, hands: S(5, 111, 27), grip: B2(Y), epole: S(.2, -1, -.4), feet: S(11, 5.6, 0), kpole: S(0, 0, 1) },
    B: { hands: S(7, 82, 17) },
    eq(E) { E.cableColumn([0, 0, 40], 224); const r = E.rope([0, 216, 33]); E.dyn(c => r(c.G.P, c.G.M)); },
    cam: { az: 1.1, el: .15 },
  },
  'preacher-curl': {
    A: { hip: [0, 53, -8], pitch: 16, hands: S(13, 70, 44), grip: B2(X), epole: S(0, -1, .8), feet: S(14, 5.6, 26), kpole: S(.1, .3, 1) },
    B: { hands: S(12, 101, 31) },
    eq(E) {
      E.box(28, 6, 26, [0, 42, -10], 'pad'); E.box(6, 39, 6, [0, 20, -10]); E.box(36, 3, 30, [0, 1.5, -8]);
      E.slab(44, 32, 7, [0, 76, 22], [0, -.75, .66], [0, .66, .75]); E.box(6, 64, 6, [0, 32, 34]); E.box(36, 3, 30, [0, 1.5, 34]);
      const bar = E.bar(54, 9); E.dyn(c => E.orient(bar, X, E.mid(c.G.P, c.G.M)));
    },
    cam: { az: 1.2, el: .15 },
  },

  // ---------------- LOWER ----------------
  'lying-leg-curl': {
    A: { hip: [0, 51, 0], pitch: 90, head: -25, hands: S(17, 36, 60), grip: B2(X), epole: S(.6, 0, -1), feet: S(10, 49, -72), kpole: S(0, -1, -.3), fdir: B2([0, -1, -.2]) },
    B: { feet: S(10, 83, -16), fdir: B2([0, -.2, -1]) },
    eq(E) {
      E.box(32, 6, 100, [0, 41, 22], 'pad'); E.box(6, 38, 6, [0, 19, 60]); E.box(6, 38, 6, [0, 19, -16]); E.box(40, 3, 100, [0, 1.5, 22]);
      E.cyl(1.4, 50, 'x', [0, 36, 64], 'metal');
      const rol = E.cyl(5.5, 36, 'x', [0, 0, 0], 'pad'), lev = E.beam([0, 0, 0], [0, 1, 0], 2);
      E.dyn(c => { const a = E.mid(c.W('foot', 'P'), c.W('foot', 'M')), f = E.norm(c.p.fdir.P), r = [a[0], a[1] - f[1] * 7, a[2] - f[2] * 7]; E.place(rol, r); E.setBeam(lev, [22, 49, -32], [22, r[1], r[2]]); });
    },
    cam: { az: 1.35, el: .25 },
  },
  'squat': {
    start: 'B',
    A: { hip: [0, 47, -22], pitch: 42, head: -15, hands: { tf: [26, 49, -7] }, grip: B2(X), epole: S(.3, -1, -.6), feet: S(15, 5.6, 2), kpole: S(.45, 0, 1) },
    B: { hip: [0, 78, 0], pitch: 6, head: 0 },
    eq(E) { const bar = E.barbell(180); E.dyn(c => E.orient(bar, X, E.mid(c.G.P, c.G.M))); E.rack(); },
    cam: { az: .9, el: .18 },
  },
  'leg-extension': {
    A: { hip: [0, 54, 0], pitch: -14, hands: S(23, 47, 6), grip: B2(Z), epole: S(.5, -1, 0), feet: S(10, 14, 36), kpole: S(0, 1, .2), fdir: B2([0, -.2, 1]) },
    B: { feet: S(10, 52, 73), fdir: B2([0, 1, .35]) },
    eq(E) {
      E.box(32, 6, 40, [0, 45, 12], 'pad'); E.box(6, 42, 6, [0, 21, 8]); E.box(38, 3, 40, [0, 1.5, 10]);
      E.slab(30, 56, 7, [0, 80, -16], [0, .97, -.24], [0, .24, .97]);
      for (const sx of [1, -1]) { E.cyl(1.5, 14, 'z', [sx * 23, 47, 6], 'metal'); E.box(4, 8, 4, [sx * 23, 43, 0]); }
      const rol = E.cyl(5.5, 34, 'x', [0, 0, 0], 'pad'), lev = E.beam([0, 0, 0], [0, 1, 0], 2);
      E.dyn(c => { const a = E.mid(c.W('foot', 'P'), c.W('foot', 'M')), f = E.norm(c.p.fdir.P), r = [0, a[1] + f[1] * 6.5 - 2, a[2] + f[2] * 6.5]; E.place(rol, r); E.setBeam(lev, [20, 54, 33], [20, r[1], r[2]]); });
    },
    cam: { az: 1.25, el: .18 },
  },
  'hip-thrust': {
    A: { hip: [0, 18, 25], pitch: -65, head: 35, hands: S(26, 31, 33), grip: B2(X), epole: S(.4, .5, -.5), feet: S(15, 5.6, 58), kpole: S(.2, 1, .3) },
    B: { hip: [0, 40, 28], pitch: -90, head: 50, hands: S(26, 53, 32) },
    eq(E) { E.box(120, 33, 30, [0, 16.5, -30], 'pad'); const bar = E.barbell(180); E.dyn(c => E.orient(bar, X, E.mid(c.G.P, c.G.M))); },
    cam: { az: .25, el: .42 },
  },
  'standing-calf-raise': {
    A: { hip: [0, 84, -2], pitch: 2, hands: S(23, 137, 4), grip: B2(Z), epole: S(.5, -1, .2), feet: S(10, 13, -1), kpole: S(0, 0, 1), fdir: B2([0, .45, 1]) },
    B: { hip: [0, 95, 1], hands: S(23, 148, 7), feet: S(10, 23, 2), fdir: B2([0, -.75, 1]) },
    eq(E) {
      E.box(60, 10, 26, [0, 5, 15], 'dark');
      E.box(10, 190, 10, [0, 95, -32]);
      const yoke = [E.pad(12, 6, 16), E.pad(12, 6, 16)], arm = E.beam([0, 0, 0], [0, 1, 0], 2.5), cross = E.beam([0, 0, 0], [0, 1, 0], 2);
      E.handles(['P', 'M'], Z);
      E.dyn(c => { const sP = c.W('upper_arm', 'P'), sM = c.W('upper_arm', 'M'); E.place(yoke[0], [sP[0] - 4, sP[1] + 6.5, sP[2]]); E.place(yoke[1], [sM[0] + 4, sM[1] + 6.5, sM[2]]); E.setBeam(cross, [sP[0] - 4, sP[1] + 8, sP[2] - 9], [sM[0] + 4, sM[1] + 8, sM[2] - 9]); E.setBeam(arm, [0, sP[1] + 8, -30], [0, sP[1] + 8, sP[2] - 9]); });
    },
    cam: { az: .9, el: .12 },
  },
  'machine-ab-crunch': {
    A: { hip: [0, 53, 0], pitch: -8, head: 0, hands: { tf: [12, 57, 9] }, grip: B2(X), epole: S(.6, -.6, .5), feet: S(12, 8, 34), kpole: S(.1, .3, 1) },
    B: { pitch: 34, head: 22 },
    eq(E) {
      E.machineSeat(53, false);
      E.slab(30, 58, 7, [0, 84, -16], [0, .99, -.14], [0, .14, .99]);
      E.cyl(5, 34, 'x', [0, 12, 40], 'pad'); E.box(6, 12, 6, [0, 6, 40]);
      E.box(8, 170, 8, [0, 85, -30]);
      const bar = E.bar(40, 0), arm = E.beam([0, 0, 0], [0, 1, 0], 2.5);
      E.dyn(c => { const m = E.mid(c.G.P, c.G.M); E.orient(bar, X, m); E.setBeam(arm, [0, 130, -28], [0, m[1], m[2] - 2]); });
    },
    cam: { az: 1.2, el: .15 },
  },

  // ---------------- PUSH ----------------
  'incline-chest-press': {
    A: { hip: [0, 53, 0], pitch: -35, head: 6, hands: S(22, 97, -19), grip: B2(X), epole: S(.6, -1, -.2), feet: S(15, 5.6, 36), kpole: S(.2, .4, 1) },
    B: { hands: S(14, 122, 12) },
    eq(E) {
      E.inclineBench(-35, 53);
      const lev = ['P', 'M'].map(s => [s, E.beam([0, 0, 0], [0, 1, 0], 2.4), E.cyl(1.6, 14, 'x', [0, 0, 0], 'metal')]);
      E.box(8, 160, 8, [0, 80, -60]);
      E.dyn(c => { for (const [s, l, h] of lev) { const g = c.G[s], sx = s === 'P' ? 1 : -1; E.place(h, g); E.setBeam(l, [sx * 30, 150, -58], [g[0] + sx * 7, g[1], g[2]]); } });
    },
    cam: { az: .8, el: .2 },
  },
  'cable-fly': {
    A: { hip: [0, 77, 0], pitch: 12, hands: S(58, 116, 12), grip: B2(Y), epole: S(1, -.2, -.4), feet: { P: [12, 5.6, 14], M: [-12, 5.6, -12] }, kpole: S(0, 0, 1) },
    B: { hands: S(5, 108, 44), epole: S(1, -.4, -.2) },
    eq(E) {
      const pul = [E.cableColumn([90, 0, -8], 200, [90, 122, -2]), E.cableColumn([-90, 0, -8], 200, [-90, 122, -2])];
      const cb = [E.line(), E.line()]; E.dyn(c => { E.setLine(cb[0], [88, 122, -2], c.G.P); E.setLine(cb[1], [-88, 122, -2], c.G.M); });
      E.handles(['P', 'M'], Y);
    },
    cam: { az: .35, el: .18 },
  },
  'shoulder-press': {
    A: { hip: [0, 53, 0], pitch: -4, hands: S(30, 112, 4), grip: B2(X), epole: S(.6, -1, .2), feet: S(15, 5.6, 32), kpole: S(.2, .3, 1) },
    B: { hands: S(16, 154, 1), epole: S(1, -.2, .1) },
    eq(E) { E.machineSeat(53, true); const d = E.dumbbells(); E.dyn(c => { E.hold(d.P, c.G.P, X); E.hold(d.M, c.G.M, X); }); },
    cam: { az: .45, el: .12 },
  },
  'cable-lateral-raise': {
    A: { hip: [0, 77, 0], pitch: 3, hands: { P: [8, 81, 14], M: [-50, 112, 4] }, grip: { P: Y, M: Y }, epole: { P: [.8, -.4, -.2], M: [-.4, -1, -.3] }, feet: S(12, 5.6, 0), kpole: S(0, 0, 1) },
    B: { hands: { P: [61, 124, 7], M: [-50, 112, 4] }, epole: { P: [.4, 1, -.2], M: [-.4, -1, -.3] } },
    eq(E) {
      E.box(8, 200, 8, [-56, 100, 4]); E.cyl(4.5, 4, 'z', [-50, 12, 8], 'metal');
      const cb = E.line(); E.dyn(c => E.setLine(cb, [-50, 12, 8], c.G.P)); E.handles(['P'], Y);
      E.cyl(1.5, 16, 'y', [-50, 112, 4], 'metal');
    },
    cam: { az: .3, el: .12 },
  },
  'cable-overhead-extension': {
    A: { hip: [0, 75, -4], pitch: 30, head: -10, hands: { tf: [5, 54, -9] }, grip: B2(Y), epole: { tf: true, P: [.15, 1, .9], M: [-.15, 1, .9] }, feet: { P: [12, 5.6, 16], M: [-12, 5.6, -18] }, kpole: S(0, 0, 1) },
    B: { hands: { tf: [8, 82, 35] } },
    eq(E) { E.cableColumn([0, 0, -95], 210, [0, 118, -88]); const r = E.rope([0, 118, -88]); E.dyn(c => r(c.G.P, c.G.M)); },
    cam: { az: 1.3, el: .15 },
  },
  'dips': {
    start: 'B',
    A: { hip: [0, 84, -10], pitch: 25, head: 5, hands: S(27, 122, 6), grip: B2(Z), epole: S(.2, .25, -1), feet: S(8, 26, -40), kpole: S(0, -.2, 1) },
    B: { hip: [0, 115, -4], pitch: 12, feet: S(8, 58, -34) },
    eq(E) {
      for (const sx of [1, -1]) { E.cyl(2.2, 80, 'z', [sx * 27, 119, 4], 'metal'); E.box(5, 119, 5, [sx * 27, 59.5, 40]); E.box(5, 119, 5, [sx * 27, 59.5, -32]); }
      E.box(64, 3, 80, [0, 1.5, 4]);
    },
    cam: { az: 1.0, el: .12 },
  },

  // ---------------- PULL ----------------
  'pull-up': {
    A: { hip: [0, 90, 0], pitch: -4, hands: S(34, 190, 0), grip: B2(X), epole: S(1, -.6, 0), feet: S(7, 20, -9), kpole: S(0, 0, 1) },
    B: { hip: [0, 130, 2], pitch: -8, feet: S(7, 60, -9) },
    eq(E) { E.cyl(1.8, 150, 'x', [0, 190, 0], 'metal'); for (const sx of [1, -1]) E.box(6, 196, 6, [sx * 72, 98, 0]); E.box(150, 3, 40, [0, 1.5, 0]); },
    cam: { az: .5, el: .05 },
  },
  't-bar-row': {
    A: { hip: [0, 72, -12], pitch: 50, head: -20, hands: S(5, 53, 29), grip: B2(Z), epole: S(.3, -.2, -1), feet: S(15, 5.6, 2), kpole: S(.25, 0, 1) },
    B: { hands: S(6, 81, 21) },
    eq(E) {
      const bar = E.beam([0, 0, 0], [0, 1, 0], 1.6, 'metal'), pl = E.cyl(14, 6, 'y', [0, 0, 0], 'plate'), hd = E.cyl(1.4, 14, 'x', [0, 0, 0], 'metal');
      E.box(16, 6, 16, [0, 3, -110]);
      E.dyn(c => { const m = E.mid(c.G.P, c.G.M), pv = [0, 4, -110], dir = E.norm(E.sub(m, pv)); E.setBeam(bar, pv, E.add(m, E.mul(dir, 3))); E.place(pl, E.add(pv, E.mul(E.sub(m, pv), .955)), dir); E.orient(hd, X, m); });
    },
    cam: { az: 1.45, el: .2 },
  },
  'single-arm-cable-row': {
    A: { hip: [0, 53, 0], pitch: 16, yaw: -12, hands: { P: [13, 91, 54], M: [-12, 58, 24] }, grip: { P: Y }, epole: { P: [.5, -.3, -1], M: [-.6, -.3, 0] }, feet: S(14, 5.6, 30), kpole: S(.2, .3, 1) },
    B: { pitch: 0, yaw: 10, hands: { P: [19, 90, 6], M: [-12, 58, 24] } },
    eq(E) {
      E.box(30, 6, 34, [0, 42, -2], 'pad'); E.box(6, 39, 6, [0, 20, -2]); E.box(36, 3, 34, [0, 1.5, -2]);
      E.cableColumn([13, 0, 112], 200, [13, 91, 106]); const cb = E.line(); E.dyn(c => E.setLine(cb, [13, 91, 106], c.G.P)); E.handles(['P'], Y);
    },
    cam: { az: 1.15, el: .2 },
  },
  'reverse-fly': {
    A: { hip: [0, 53, 0], pitch: 6, hands: S(8, 104, 47), grip: B2(Y), epole: S(1, .1, 0), feet: S(14, 5.6, 32), kpole: S(.2, .3, 1) },
    B: { hands: S(61, 104, 6) },
    eq(E) {
      E.box(30, 6, 30, [0, 42, -4], 'pad'); E.box(6, 39, 6, [0, 20, -4]); E.box(36, 3, 30, [0, 1.5, 0]);
      E.box(24, 38, 6, [0, 80, 20], 'pad'); E.box(6, 62, 6, [0, 31, 22]);
      E.box(8, 175, 8, [0, 87, 60]); E.box(8, 8, 50, [0, 170, 38]);
      const lev = ['P', 'M'].map(s => [s, E.beam([0, 0, 0], [0, 1, 0], 2.2), E.cyl(1.5, 14, 'y', [0, 0, 0], 'metal')]);
      E.dyn(c => { for (const [s, l, h] of lev) { const g = c.G[s]; E.place(h, g); E.setBeam(l, [0, 170, 16], [g[0], g[1] + 7, g[2]]); } });
    },
    cam: { az: 2.6, el: .22 },
  },
  'bayesian-curl': {
    A: { hip: [0, 77, -2], pitch: 6, hands: { P: [18, 76, -30], M: [-18, 83, 1] }, grip: { P: Y }, epole: { P: [.2, -1, -.6], M: [-.3, -1, -.2] }, feet: { P: [12, 5.6, 12], M: [-12, 5.6, -14] }, kpole: S(0, 0, 1) },
    B: { hands: { P: [17, 121, 0], M: [-18, 83, 1] } },
    eq(E) { E.cableColumn([16, 0, -92], 200, [16, 20, -86]); const cb = E.line(); E.dyn(c => E.setLine(cb, [16, 20, -86], c.G.P)); E.handles(['P'], Y); },
    cam: { az: 1.5, el: .12 },
  },
  'hammer-curl': {
    A: { hip: [0, 78, 0], pitch: 3, hands: S(18, 81, 6), grip: B2('sag'), epole: S(.2, -1, -.4), feet: S(11, 5.6, 0), kpole: S(0, 0, 1) },
    B: { hands: S(18, 119, 14) },
    eq(E) { const d = E.dumbbells(); E.dyn(c => { E.hold(d.P, c.G.P, c.A.P); E.hold(d.M, c.G.M, c.A.M); }); },
    cam: { az: .9, el: .12 },
  },

  // ---------------- LEGS ----------------
  'leg-press': {
    start: 'B',
    A: { hip: [0, 40, 0], pitch: -56, head: 18, hands: S(23, 37, 6), grip: B2(Z), epole: S(.5, -1, 0), feet: S(12, 64, 29), kpole: S(.25, 1, -.2), fdir: B2([0, .77, -.64]) },
    B: { feet: S(12, 85, 54) },
    eq(E) {
      E.slab(34, 66, 7, [0, 60, -26], [0, .56, -.83], [0, .83, .56]); E.box(34, 6, 30, [0, 31, 4], 'pad'); E.box(6, 28, 6, [0, 14, 0]); E.box(60, 3, 160, [0, 1.5, 40]);
      for (const sx of [1, -1]) { E.beam([sx * 26, 20, 20], [sx * 26, 140, 163], 2.5, 'dark'); E.cyl(1.5, 14, 'z', [sx * 23, 37, 6], 'metal'); E.box(4, 34, 4, [sx * 26, 17, 6]); }
      const pl = E.pad(56, 6, 40), u = E.norm([0, .64, .77]);
      E.dyn(c => { const a = E.mid(c.W('foot', 'P'), c.W('foot', 'M')); E.place(pl, E.add(a, E.mul(u, 6)), u); });
    },
    cam: { az: 1.3, el: .2 },
  },
  'seated-leg-curl': {
    A: { hip: [0, 54, 0], pitch: -14, hands: S(23, 47, 6), grip: B2(Z), epole: S(.5, -1, 0), feet: S(10, 50, 74), kpole: S(0, 1, .1), fdir: B2([0, 1, .25]) },
    B: { feet: S(10, 19, 14), fdir: B2([0, -.15, 1]) },
    eq(E) {
      E.box(32, 6, 40, [0, 45, 12], 'pad'); E.box(6, 42, 6, [0, 21, 8]); E.box(38, 3, 40, [0, 1.5, 10]);
      E.slab(30, 56, 7, [0, 80, -16], [0, .97, -.24], [0, .24, .97]);
      E.cyl(5, 34, 'x', [0, 64, 25], 'pad'); E.box(4, 20, 4, [20, 58, 25]);
      for (const sx of [1, -1]) E.cyl(1.5, 14, 'z', [sx * 23, 47, 6], 'metal');
      const rol = E.cyl(5.5, 34, 'x', [0, 0, 0], 'pad'), lev = E.beam([0, 0, 0], [0, 1, 0], 2);
      E.dyn(c => { const a = E.mid(c.W('foot', 'P'), c.W('foot', 'M')), f = E.norm(c.p.fdir.P), r = [0, a[1] - f[1] * 7 - 1, a[2] - f[2] * 7]; E.place(rol, r); E.setBeam(lev, [20, 54, 33], [20, r[1], r[2]]); });
    },
    cam: { az: 1.25, el: .18 },
  },
  'back-extension': {
    A: { hip: [0, 72, 12], pitch: 125, head: -10, hands: { tf: true, P: [-9, 40, 10], M: [9, 37, 10] }, epole: { tf: true, P: [.5, -1, .6], M: [-.5, -1, .6] }, feet: S(10, 20, -40), kpole: S(0, -.4, 1), fdir: B2([0, -.7, .7]) },
    B: { pitch: 45, head: -15 },
    eq(E) {
      const L = E.norm([0, .707, .707]), N = [0, .707, -.707];
      E.slab(34, 26, 8, [0, 62, 22], L, N);
      E.slab(30, 22, 4, [0, 12, -32], [0, .707, .707], [0, .707, -.707]);
      E.cyl(5, 30, 'x', [0, 28, -42], 'pad');
      E.beam([0, 55, 30], [0, 0, 50], 3, 'dark'); E.beam([0, 12, -30], [0, 0, -30], 3, 'dark'); E.box(40, 3, 100, [0, 1.5, 10]);
    },
    cam: { az: 1.4, el: .18 },
  },
};

// Gli esercizi uguali in più giorni usano la stessa posa
export const IDS = Object.keys(POSE3);
