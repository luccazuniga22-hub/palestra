// Modello 3D dell'omino (prototipo) basato su Three.js
import * as T from './vendor/three-lite.js';

const UP = new T.Vector3(0, 1, 0);
const SW = 17, HW = 8.5;

function pr(prof, t) {
  for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) {
    const [t0, r0] = prof[i - 1], [t1, r1] = prof[i], k = (t - t0) / ((t1 - t0) || 1);
    return r0 + (r1 - r0) * (.5 - .5 * Math.cos(Math.PI * k));
  }
  return prof[prof.length - 1][1];
}
function lathe(prof, L, sx = 1, sz = 1) {
  const pts = [], r0 = prof[0][1], r1 = prof[prof.length - 1][1];
  for (let k = 0; k <= 4; k++) { const a = k / 4 * Math.PI / 2; pts.push(new T.Vector2(Math.max(.01, r0 * Math.sin(a)), -r0 * Math.cos(a) * .8)); }
  for (let i = 1; i <= 12; i++) { const t = i / 12; pts.push(new T.Vector2(pr(prof, t), t * L)); }
  for (let k = 1; k <= 4; k++) { const a = k / 4 * Math.PI / 2; pts.push(new T.Vector2(Math.max(.01, r1 * Math.cos(a)), L + r1 * Math.sin(a) * .8)); }
  const g = new T.LatheGeometry(pts, 28);
  if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz);
  g.computeVertexNormals();
  return g;
}
const tmp = new T.Vector3();
function place(m, a, b) {
  m.position.copy(a);
  tmp.subVectors(b, a); const L = tmp.length();
  if (L > 1e-6) m.quaternion.setFromUnitVectors(UP, tmp.divideScalar(L));
}
function basis(m, y, z) {
  const Y = y.clone().normalize(), Z = z.clone().normalize(), X = new T.Vector3().crossVectors(Y, Z).normalize();
  Z.crossVectors(X, Y).normalize();
  m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
}

export function create(el, { LEN }) {
  const R = new T.WebGLRenderer({ antialias: true });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.outputColorSpace = T.SRGBColorSpace;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.shadowMap.enabled = true;
  R.shadowMap.type = T.PCFSoftShadowMap;
  R.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  el.appendChild(R.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color('#141a21');
  scene.fog = new T.Fog('#141a21', 420, 900);
  const cam = new T.PerspectiveCamera(32, 1, 1, 3000);

  scene.add(new T.HemisphereLight('#e4ecff', '#262b33', .75));
  const sun = new T.DirectionalLight('#ffffff', 2.9);
  sun.position.set(230, 260, 130); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 230, bottom: -60, near: 10, far: 800 });
  sun.shadow.bias = -0.0006; scene.add(sun);
  const rim = new T.DirectionalLight('#8fb0ff', 1.3); rim.position.set(-180, 140, -220); scene.add(rim);

  const floor = new T.Mesh(new T.CircleGeometry(190, 64), new T.MeshStandardMaterial({ color: '#1c232c', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new T.Mesh(new T.TorusGeometry(120, .6, 6, 90), new T.MeshBasicMaterial({ color: '#2a3340' }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .3; scene.add(ring);

  const musM = null;
  const EQ = {
    dark: new T.MeshStandardMaterial({ color: '#363f4c', roughness: .7 }),
    pad: new T.MeshStandardMaterial({ color: '#2a313b', roughness: .85 }),
    metal: new T.MeshStandardMaterial({ color: '#a7b2c2', roughness: .28, metalness: .85 }),
    plate: new T.MeshStandardMaterial({ color: '#23292f', roughness: .55, metalness: .3 }),
  };
  const mk = (g, m) => { const o = new T.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };

  // ---- modello umano (CC0, con scheletro) ----
  const SKIN = new T.Color('#d9dde3'), SHORTS = new T.Color('#3a4250'), RED = new T.Color('#e0412a');
  const MAP = { R: 'L', L: 'R' };          // lato dell'omino 2D -> lato del modello
  let model = null, mesh = null, colAttr = null, region = null, B = {}, restQ = {}, restLen = {}, soleLocal = {}, K = 80, lastKey = '';
  const qa = new T.Quaternion(), qb = new T.Quaternion(), va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3();
  new T.GLTFLoader().load(new URL('./models/uomo.glb', import.meta.url).href, g => {
    const root = g.scene;
    root.traverse(o => { if (o.isBone) B[o.name] = o; if (o.isSkinnedMesh) mesh = o; });
    root.updateMatrixWorld(true);
    // lunghezze a riposo (unità del modello)
    const wp = n => B[n].getWorldPosition(new T.Vector3());
    for (const s of ['L', 'R']) {
      restLen['upper_arm' + s] = wp('upper_arm' + s).distanceTo(wp('forearm' + s));
      restLen['forearm' + s] = wp('forearm' + s).distanceTo(wp('hand' + s));
      restLen['thigh' + s] = wp('thigh' + s).distanceTo(wp('shin' + s));
      restLen['shin' + s] = wp('shin' + s).distanceTo(wp('foot' + s));
    }
    K = (LEN.TH + LEN.SH) / (restLen.thighL + restLen.shinL);
    model = new T.Group(); model.add(root); model.rotation.y = -Math.PI / 2; model.scale.setScalar(K); scene.add(model);
    model.updateMatrixWorld(true);
    for (const n in B) restQ[n] = B[n].quaternion.clone();
    for (const s of ['L', 'R']) { const q = B['foot' + s].getWorldQuaternion(new T.Quaternion()); soleLocal[s] = new T.Vector3(0, 0, 1).applyQuaternion(q.invert()); }
    // superficie liscia + colori per vertice
    let geo = mesh.geometry.clone(); geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    geo = T.mergeVertices(geo, 1e-4);
    geo = subdivide(geo); smooth(geo, 2); geo = subdivide(geo); smooth(geo, 1); geo = subdivide(geo); smooth(geo, 1);
    geo.computeVertexNormals(); sculpt(geo); geo.computeVertexNormals();
    mesh.geometry = geo; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const n = geo.attributes.position.count;
    colAttr = new T.BufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('color', colAttr);
    mesh.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: 0 });
    region = classify(geo, mesh.skeleton);
    soften(geo);
    lastKey = '';
  });


  // ---- suddivisione (più poligoni = corpo più liscio) ----
  function subdivide(geo) {
    const P = geo.attributes.position.array, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, I = geo.index.array;
    const pos = Array.from(P), si = [], sw = [], n0 = P.length / 3;
    for (let i = 0; i < n0; i++) for (let j = 0; j < 4; j++) { si.push(SI.getComponent(i, j)); sw.push(SW.getComponent(i, j)); }
    const map = new Map(), out = [];
    const mid = (a, b) => {
      const k = a < b ? a * 4194304 + b : b * 4194304 + a; let m = map.get(k); if (m !== undefined) return m;
      m = pos.length / 3; for (let c = 0; c < 3; c++) pos.push((pos[a * 3 + c] + pos[b * 3 + c]) / 2);
      const acc = {}; for (const v of [a, b]) for (let j = 0; j < 4; j++) { const w = sw[v * 4 + j]; if (w > 0) acc[si[v * 4 + j]] = (acc[si[v * 4 + j]] || 0) + w / 2; }
      const top = Object.entries(acc).sort((x, y) => y[1] - x[1]).slice(0, 4), tot = top.reduce((t, x) => t + x[1], 0) || 1;
      for (let j = 0; j < 4; j++) { si.push(top[j] ? +top[j][0] : 0); sw.push(top[j] ? top[j][1] / tot : 0); }
      map.set(k, m); return m;
    };
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('skinIndex', new T.BufferAttribute(new Uint16Array(si), 4));
    g.setAttribute('skinWeight', new T.BufferAttribute(new Float32Array(sw), 4));
    g.setIndex(out); return g;
  }
  function smooth(geo, it) {
    const P = geo.attributes.position.array, I = geo.index.array, n = P.length / 3, nb = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    const NB = nb.map(x => [...x]);
    const step = f => { const Q = P.slice(); for (let v = 0; v < n; v++) { const L = NB[v]; if (!L.length) continue; let x = 0, y = 0, z = 0; for (const u of L) { x += Q[u * 3]; y += Q[u * 3 + 1]; z += Q[u * 3 + 2]; } x /= L.length; y /= L.length; z /= L.length; P[v * 3] += f * (x - Q[v * 3]); P[v * 3 + 1] += f * (y - Q[v * 3 + 1]); P[v * 3 + 2] += f * (z - Q[v * 3 + 2]); } };
    for (let k = 0; k < it; k++) { step(.5); step(-.53); }
  }
  // ---- muscoli scolpiti (posizioni a riposo in metri: x avanti, y su, z = destra del modello) ----
  function sculpt(geo) {
    const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, n = P.count, bones = mesh.skeleton.bones;
    const inv = new T.Matrix4().copy(mesh.matrixWorld).invert();
    const rp = nm => B[nm].getWorldPosition(new T.Vector3()).applyMatrix4(inv);
    const W = u => u >= 1 ? 0 : (1 - u * u) ** 2;
    // profilo verticale: 0 = morbido, 1 = pettorale (bordo basso netto, sale piano verso la clavicola), 2 = naso (più sporgente in basso)
    const prof = (m, y) => { const u = (y - (m.y0 + m.y1) / 2) / ((m.y1 - m.y0) / 2); if (Math.abs(u) >= 1.15) return 0;
      if (m.shape === 1) return u < -1 ? 0 : u < -.65 ? Math.sin((u + 1) / .35 * Math.PI / 2) : Math.max(0, 1 - ((u + .65) / 1.75) ** 2);
      if (m.shape === 2) return u < -1 ? 0 : u < -.6 ? (u + 1) / .4 : Math.max(0, 1 - (u + .6) / 1.6 * .85);
      return W(Math.abs(u)); };
    const thW = (m, th) => { let dth = Math.abs(th - m.th); if (dth > 180) dth = 360 - dth; return m.shape === 1 ? (dth < m.hw * .35 ? 1 : W((dth - m.hw * .35) / (m.hw * .65))) : W(dth / m.hw); };
    // muscoli del busto in coordinate cilindriche: altezza y e angolo th attorno all'asse del busto (0 = davanti, 90 = lato destro, 180 = dietro)
    const TOR = [];
    const tor = (y0, y1, th, hw, amp, sym = true, shape = 0) => { TOR.push({ y0, y1, th, hw, amp, shape }); if (sym && th) TOR.push({ y0, y1, th: -th, hw, amp, shape }); };
    const HEAD = [];
    const hd = (y0, y1, th, hw, amp, sym = true, shape = 0) => { HEAD.push({ y0, y1, th, hw, amp, shape }); if (sym && th) HEAD.push({ y0, y1, th: -th, hw, amp, shape }); };
    tor(.36, .57, 30, 30, .02, true, 1);         // pettorali (piatti e larghi, bordo basso netto)
    tor(.36, .58, 0, 5, -.007, false);           // solco dello sterno
    for (const [y0, y1] of [[.025, .1], [.1, .18], [.18, .26], [.26, .34]]) tor(y0, y1, 11, 9, .009); // addominali (8 blocchi)
    tor(0, .35, 0, 3.5, -.008, false);           // linea alba
    tor(.04, .27, 42, 16, .011);                 // obliqui
    for (const yy of [.31, .35, .39]) tor(yy - .022, yy + .022, 62, 9, .007); // dentato anteriore
    tor(.2, .5, 112, 26, .022);                  // dorsali (forma a V)
    tor(.57, .68, 148, 26, .018);                // trapezi alti
    tor(.42, .58, 160, 15, .013);                // trapezio medio e romboidi
    tor(.03, .6, 180, 5, -.008, false);          // solco della colonna
    tor(.02, .3, 167, 9, .013);                  // lombari
    tor(-.17, .04, 152, 26, .026);               // glutei
    tor(-.16, -.02, 180, 4, -.01, false);        // solco tra i glutei
    // viso
    hd(.775, .855, 0, 8, .017, false, 2);        // naso (punta in basso)
    hd(.856, .878, 22, 22, .007);                // arcate sopracciliari
    hd(.825, .855, 25, 12, -.009);               // orbite degli occhi
    hd(.795, .835, 48, 18, .006);                // zigomi
    hd(.765, .773, 0, 16, -.004, false);         // linea della bocca
    hd(.773, .79, 0, 13, .004, false);           // labbra
    hd(.733, .765, 0, 18, .007, false);          // mento
    hd(.738, .785, 68, 16, .006);                // angolo della mandibola
    hd(.795, .865, 90, 8, .013);                 // orecchie
    hd(.645, .725, 32, 14, .006);                // muscoli del collo
    // muscoli degli arti lungo un segmento osso: lato (avanti/esterno/dietro/interno), da t0 a t1
    const LIM = [];
    for (const sg of [-1, 1]) {
      const S = sg < 0 ? 'L' : 'R', sh = rp('upper_arm' + S), el = rp('forearm' + S), wr = rp('hand' + S), hp = rp('thigh' + S), kn = rp('shin' + S), an = rp('foot' + S), top = sh.clone().add(new T.Vector3(0, .05, sg * .01));
      const out = [0, 0, sg], fw = [1, 0, 0], bw = [-1, 0, 0], inn = [0, 0, -sg];
      const lim = (a, b, t0, t1, side, amp, maxR = .09, pk = 1) => LIM.push({ a, b, t0, t1, side: new T.Vector3(...side).normalize(), amp, maxR, pk });
      lim(top, el, 0, .42, out, .02, .1);                       // deltoide laterale
      lim(top, el, 0, .4, [1, 0, sg * .4], .016, .1);           // deltoide anteriore
      lim(top, el, 0, .4, [-1, 0, sg * .4], .015, .1);          // deltoide posteriore
      lim(sh, el, .28, .92, fw, .019, .085, .9);                // bicipite
      lim(sh, el, .45, .95, [.3, 0, sg], -.004, .085);          // solco bicipite-tricipite
      lim(sh, el, .2, .9, bw, .016, .085);                      // tricipite capo lungo
      lim(sh, el, .25, .75, [-.6, 0, sg], .01, .085);           // tricipite capo laterale
      lim(el, wr, 0, .5, [.5, 0, sg], .014, .07, .8);           // brachioradiale
      lim(el, wr, 0, .55, [.2, 0, -sg], .011, .07, .8);         // flessori
      lim(hp, kn, .1, .88, [1, 0, sg * .1], .017, .12);         // retto femorale
      lim(hp, kn, .2, .9, [.55, 0, sg], .02, .12);              // vasto laterale
      lim(hp, kn, .62, .95, [.55, 0, -sg], .013, .12, 1.8);     // vasto mediale (goccia)
      lim(hp, kn, .3, .85, [.8, 0, sg * .55], -.005, .12);      // solco tra i quadricipiti
      lim(hp, kn, .1, .88, bw, .016, .12);                      // femorali
      lim(hp, kn, .05, .7, inn, .011, .12);                     // adduttori
      lim(kn, an, .07, .46, [-1, 0, -sg * .45], .024, .09, .8); // gastrocnemio mediale
      lim(kn, an, .07, .4, [-1, 0, sg * .45], .017, .09, .8);   // gastrocnemio laterale
      lim(kn, an, .1, .38, bw, -.004, .09);                     // solco tra i due capi
      lim(kn, an, .4, .72, bw, .008, .09);                      // soleo
      lim(kn, an, .05, .5, [.4, 0, sg], .008, .09);             // tibiale
    }
    const p = new T.Vector3(), nn = new T.Vector3(), d = new T.Vector3(), u = new T.Vector3(), q = new T.Vector3();
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } }
      const bn = bones[best].name; if (/hand|f_|thumb|toe|foot|heel/.test(bn)) continue;
      p.fromBufferAttribute(P, i); nn.fromBufferAttribute(N, i); let disp = 0;
      if (/spine00[45]/.test(bn)) {
        const th = Math.atan2(p.z, p.x - .005) * 180 / Math.PI;
        for (const m of HEAD) { if (p.y < m.y0 - .01 || p.y > m.y1 + .01) continue; disp += m.amp * prof(m, p.y) * thW(m, th); }
        if (disp) P.setXYZ(i, p.x + nn.x * disp, p.y + nn.y * disp, p.z + nn.z * disp);
        continue;
      }
      if (/spine|pelvis/.test(bn) || (/thigh/.test(bn) && p.y > -.2 && p.x < 0)) {
        const th = Math.atan2(p.z, p.x - .025) * 180 / Math.PI;
        for (const m of TOR) {
          if (p.y < m.y0 - .02 || p.y > m.y1 + .02) continue;
          disp += m.amp * prof(m, p.y) * thW(m, th);
        }
      }
      if (!/spine|pelvis/.test(bn)) for (const m of LIM) {
        u.subVectors(m.b, m.a); const L = u.length(); u.divideScalar(L);
        const t = q.subVectors(p, m.a).dot(u) / L; if (t < m.t0 || t > m.t1) continue;
        d.copy(q).addScaledVector(u, -t * L); const rad = d.length(); if (rad > m.maxR) continue; d.divideScalar(rad || 1);
        const sc = (t - m.t0) / (m.t1 - m.t0), along = Math.pow(Math.sin(Math.PI * Math.pow(sc, m.pk)), .7), side = Math.max(0, d.dot(m.side));
        disp += m.amp * along * Math.pow(side, 1.6);
      }
      if (disp) P.setXYZ(i, p.x + nn.x * disp, p.y + nn.y * disp, p.z + nn.z * disp);
    }
    P.needsUpdate = true;
  }
  // zone dei muscoli sul modello a riposo (x avanti, y su, z = destra del modello)
  function classify(geo, sk) {
    const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, out = [];
    const sh = { L: B.upper_armL.getWorldPosition(new T.Vector3()), R: B.upper_armR.getWorldPosition(new T.Vector3()) };
    model.updateMatrixWorld(true);
    // posizioni spalle nello spazio del modello
    const inv = new T.Matrix4().copy(mesh.matrixWorld).invert(); sh.L.applyMatrix4(inv); sh.R.applyMatrix4(inv);
    for (let i = 0; i < P.count; i++) {
      let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } }
      const bn = sk.bones[best].name, x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), nz = N.getZ(i), az = Math.abs(z);
      const side = z < 0 ? 'L' : 'R', dSh = Math.hypot(x - sh[side].x, y - sh[side].y, z - sh[side].z);
      let r = null;
      const isArm = /upper_arm|shoulder/.test(bn);
      if (dSh < .2 && az > .11 && y > .4 && !/spine00[45]|forearm|hand/.test(bn)) { out.push({ r: nx > .4 ? 'shoulderFront' : nx < -.4 ? 'shoulderRear' : 'shoulderSide', shorts: false }); continue; }
      if (/upper_arm/.test(bn) || (/shoulder/.test(bn) && az > .1)) {
        if (dSh < .17 || /shoulder/.test(bn)) r = nx > .35 ? 'shoulderFront' : nx < -.35 ? 'shoulderRear' : 'shoulderSide';
        else r = nx > .1 ? 'biceps' : nx < -.1 ? 'triceps' : null;
      } else if (/forearm/.test(bn)) r = 'forearm';
      else if (/thigh/.test(bn)) { if (y < -.12) r = nx > .15 ? 'quads' : nx < -.15 ? 'hams' : (nx > 0 ? 'quads' : 'hams'); if (y > -.17 && nx < -.2) r = 'glutes'; }
      else if (/shin/.test(bn)) { if (nx < -.05 && y > -.72) r = 'calves'; }
      else if (/spine|pelvis/.test(bn) && !/spine00[45]/.test(bn)) {
        if (y < .04 && y > -.2 && nx < -.25) r = 'glutes';
        else if (nx > .3 && y > .38 && y < .6 && az < .17) r = 'chest';
        else if (nx > .3 && y > .02 && y < .36 && az < .1) r = 'abs';
        else if (nx < -.3 && y > .42) r = 'back';
        else if (y > .18 && y < .46 && (az > .08 && nx < .25)) r = 'lats';
        else if (nx < -.35 && y > .02 && y < .26 && az < .08) r = 'lowerBack';
      }
      const shorts = y > -.31 && y < .09 && !isArm && !/forearm|hand|f_|thumb/.test(bn);
      out.push({ r, shorts });
    }
    return out;
  }

  let soft = null, shortsSoft = null;
  function soften(geo) {
    const I = geo.index.array, n = region.length, nb = Array.from({ length: n }, () => []);
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
    const blur = (arr, it) => { for (let k = 0; k < it; k++) { const q = arr.slice(); for (let v = 0; v < n; v++) { let t = q[v] * 2, c = 2; for (const u of nb[v]) { t += q[u]; c++; } arr[v] = t / c; } } return arr; };
    soft = {};
    for (const k of Object.keys(MUSCLE_KEYS)) { const a = new Float32Array(n); let any = false; for (let i = 0; i < n; i++) if (region[i].r === k) { a[i] = 1; any = true; } if (any) soft[k] = blur(a, 4); }
    const sh = new Float32Array(n); for (let i = 0; i < n; i++) sh[i] = region[i].shorts ? 1 : 0; shortsSoft = blur(sh, 1);
  }
  const MUSCLE_KEYS = { chest: 1, back: 1, lats: 1, abs: 1, lowerBack: 1, glutes: 1, quads: 1, hams: 1, calves: 1, biceps: 1, triceps: 1, forearm: 1, shoulderFront: 1, shoulderSide: 1, shoulderRear: 1 };
  function paint(keys, op) {
    const key = keys.join() + '|' + op.toFixed(2); if (key === lastKey) return; lastKey = key;
    const c = new T.Color(), a = colAttr.array, act = keys.filter(k => soft[k]).map(k => soft[k]), str = .5 + .5 * op;
    for (let i = 0; i < region.length; i++) {
      c.copy(SKIN).lerp(SHORTS, shortsSoft[i]);
      let m = 0; for (const arr of act) if (arr[i] > m) m = arr[i];
      if (m > 0) c.lerp(RED, Math.min(1, m * 1.6) * str);
      a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
    }
    colAttr.needsUpdate = true;
  }

  // posa: orienta le ossa del modello
  function setWorldQ(b, q) { b.parent.getWorldQuaternion(qa); b.quaternion.copy(qa.invert().multiply(q)); b.updateMatrixWorld(true); }
  function followQ(b) { b.parent.getWorldQuaternion(qa); return qa.clone().multiply(restQ[b.name]); }
  function aimBone(b, dir) { const q0 = followQ(b); va.set(0, 1, 0).applyQuaternion(q0); qb.setFromUnitVectors(va, vb.copy(dir).normalize()); setWorldQ(b, qb.clone().multiply(q0)); }
  function frameQ(y, z) { const Y = y.clone().normalize(), Z = z.clone().normalize(), X = new T.Vector3().crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z)); }
  const restWorld = {};
  function restWorldQ(n) { return restWorld[n] || (restWorld[n] = new T.Quaternion().setFromAxisAngle(UP, -Math.PI / 2).multiply(worldRestFromLocal(n))); }
  function worldRestFromLocal(n) { const chain = []; let b = B[n]; while (b && b.isBone) { chain.unshift(b.name); b = b.parent; } const q = new T.Quaternion(); for (const m of chain) q.multiply(restQ[m]); return q; }
  function twoBone(S, target, L1, L2, pole) {
    const u = vc.subVectors(target, S); let d = u.length(); u.divideScalar(d || 1); d = Math.min(Math.max(d, Math.abs(L1 - L2) + .01), L1 + L2 - .01);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const n = pole.clone().addScaledVector(u, -pole.dot(u)); if (n.lengthSq() < 1e-6) n.set(0, 0, 1).addScaledVector(u, -u.z); n.normalize();
    const E = S.clone().addScaledVector(u, a).addScaledVector(n, h), H = S.clone().addScaledVector(u, d);
    return [E, H];
  }
  function limb(b1, b2, root, mid, end, l1, l2, abs) {
    const S = B[b1].getWorldPosition(new T.Vector3());
    const L1 = restLen[b1] * K, L2 = restLen[b2] * K;
    const target = abs ? abs.clone() : S.clone().addScaledVector(vb.subVectors(end, root), (L1 + L2) / (l1 + l2));
    const u = vb.subVectors(end, root).normalize(), pole = mid.clone().sub(root); pole.addScaledVector(u, -pole.dot(u));
    const [E, H] = twoBone(S, target, L1, L2, pole);
    aimBone(B[b1], E.clone().sub(S)); aimBone(B[b2], H.clone().sub(E));
    return H;
  }
  // presa: la barra passa nel palmo e le dita la avvolgono
  const GRIPS = {
    'squat': (J, P, ex) => { const b = barSquat(J, ex); return { R: b.clone().add(new T.Vector3(24, 0, 0)), L: b.clone().add(new T.Vector3(-24, 0, 0)), axis: new T.Vector3(1, 0, 0) }; },
    'lat-pulldown': (J, P) => ({ R: P.R.h.clone(), L: P.L.h.clone(), axis: new T.Vector3(1, 0, 0) }),
  };
  function barSquat(J, ex) { const b = [J.sh[0] - 3 * J.d[0] - 6 * J.fr[0], J.sh[1] - 3 * J.d[1] - 6 * J.fr[1]]; return new T.Vector3(0, ex.g - b[1], b[0] - (ex.vb[0] + ex.vb[2] / 2)); }
  const CURL_G = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 1.05), THUMB_G = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), .6);
  function gripHand(ms, G, axis, wrist) {
    const hb = B['hand' + ms], q0 = followQ(hb), x0 = new T.Vector3(1, 0, 0).applyQuaternion(q0);
    const Y = G.clone().sub(wrist).normalize(), X = axis.clone().addScaledVector(Y, -axis.dot(Y)).normalize();
    if (X.dot(x0) < 0) X.negate();
    const Z = new T.Vector3().crossVectors(X, Y);
    setWorldQ(hb, new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z)));
    for (const f of ['f_index', 'f_middle', 'f_ring', 'f_pinky']) for (const k of ['01', '02', '03']) { const b = B[f + k + ms]; if (b) b.quaternion.copy(restQ[b.name]).multiply(CURL_G); }
    for (const k of ['02', '03']) { const b = B['thumb' + k + ms]; if (b) b.quaternion.copy(restQ[b.name]).multiply(THUMB_G); }
    hb.updateMatrixWorld(true);
  }
  const CURL = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), .55);
  function poseModel(P) {
    model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    const Rt = frameQ(P.d, P.f), Rh = frameQ(P.hd, P.hf);
    for (const n of ['spine', 'spine001', 'spine002', 'spine003']) setWorldQ(B[n], Rt.clone().multiply(restWorldQ(n)));
    for (const n of ['spine004', 'spine005']) setWorldQ(B[n], Rh.clone().multiply(restWorldQ(n)));
    // porta il bacino sul punto dell'anca
    const m = B.thighL.getWorldPosition(new T.Vector3()).add(B.thighR.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
    model.position.copy(P.hip).sub(m); model.updateMatrixWorld(true);
    const grip = GRIPS[cur && cur.id] ? GRIPS[cur.id](curJ, P, cur) : null; lastGrip = grip;
    for (const s of ['R', 'L']) {
      const q = P[s], ms = MAP[s];
      if (grip) {
        const S = B['upper_arm' + ms].getWorldPosition(new T.Vector3()), G = grip[s];
        const wristT = G.clone().addScaledVector(G.clone().sub(S).normalize(), -6.5);
        const H = limb('upper_arm' + ms, 'forearm' + ms, q.sh, q.e, q.h, LEN.UA, LEN.FA, wristT);
        gripHand(ms, G, grip.axis, H);
      } else {
        limb('upper_arm' + ms, 'forearm' + ms, q.sh, q.e, q.h, LEN.UA, LEN.FA);
        setWorldQ(B['hand' + ms], followQ(B['hand' + ms]));
        for (const f of ['f_index', 'f_middle', 'f_ring', 'f_pinky']) for (const k of ['01', '02', '03']) { const b = B[f + k + ms]; if (b) { b.quaternion.copy(restQ[b.name]).multiply(CURL); } }
      }
      limb('thigh' + ms, 'shin' + ms, q.hip, q.k, q.a, LEN.TH, LEN.SH);
      const fb = B['foot' + ms], q0 = followQ(fb), s0 = soleLocal[ms].clone().applyQuaternion(q0);
      qb.setFromUnitVectors(s0.normalize(), vb.subVectors(q.t, q.a).normalize()); setWorldQ(fb, qb.clone().multiply(q0));
    }
    model.updateMatrixWorld(true);
  }

  // conversione 2D -> 3D
  function to3D(J, ex) {
    const X0 = ex.vb[0] + ex.vb[2] / 2, Y0 = ex.g;
    if (J.view === 'side') {
      const V = (p, x) => new T.Vector3(x, Y0 - p[1], p[0] - X0), D = q => new T.Vector3(0, -q[1], q[0]);
      return {
        hip: V(J.hip, 0), d: D(J.d), f: D(J.fr), head: V(J.head, 0), hd: D(J.hdir), hf: D(J.hfr),
        R: { sh: V(J.sh, SW), e: V(J.ne, SW), h: V(J.nh, SW), hip: V(J.hip, HW), k: V(J.nk, HW + 2), a: V(J.na, HW + 3), t: V(J.nt, HW + 4) },
        L: { sh: V(J.sh, -SW), e: V(J.fe, -SW), h: V(J.fh, -SW), hip: V(J.hip, -HW), k: V(J.fk, -HW - 2), a: V(J.fan, -HW - 3), t: V(J.ft, -HW - 4) },
      };
    }
    const V = (p, z) => new T.Vector3(p[0] - J.cx, Y0 - p[1], z), dz = (a, b, L) => Math.sqrt(Math.max(0, L * L - (a[0] - b[0]) ** 2 - (a[1] - b[1]) ** 2));
    const arm = (sh, A) => { const ez = dz(sh, A.e, LEN.UA); return { sh: V(sh, 0), e: V(A.e, ez), h: V(A.h, ez + dz(A.e, A.h, LEN.FA)) }; };
    const leg = (hp, Lg, sg) => { const kz = dz(hp, Lg.k, LEN.TH), a = V(Lg.a, kz); return { hip: V(hp, 0), k: V(Lg.k, kz), a, t: a.clone().add(new T.Vector3(sg * 3, -1, 13)) }; };
    return {
      hip: V(J.hc, 0), d: new T.Vector3(0, 1, 0), f: new T.Vector3(0, 0, 1), head: V(J.head, 0), hd: new T.Vector3(0, 1, 0), hf: new T.Vector3(0, 0, 1),
      R: Object.assign(arm(J.shR, J.R), leg(J.hipR, J.RL, 1)), L: Object.assign(arm(J.shL, J.L), leg(J.hipL, J.LL, -1)),
    };
  }

  // attrezzi (solo per il prototipo)
  let eqG = new T.Group(); scene.add(eqG); let eqUpdate = null;
  const box = (w, h, d, m) => mk(new T.BoxGeometry(w, h, d), m);
  const cylX = (r, len, m) => { const o = mk(new T.CylinderGeometry(r, r, len, 24), m); o.rotation.z = Math.PI / 2; return o; };
  function buildEquip(id, P) {
    scene.remove(eqG); eqG = new T.Group(); scene.add(eqG); eqUpdate = null;
    const y = P.hip.y;
    if (id === 'squat') {
      const bar = new T.Group(); bar.add(cylX(1.4, 210, EQ.metal));
      for (const x of [-1, 1]) for (const [off, r, w] of [[58, 17, 4.5], [63, 17, 4.5], [69, 4, 3]]) { const p = cylX(r, w, r > 5 ? EQ.plate : EQ.metal); p.position.x = x * off; bar.add(p); }
      eqG.add(bar);
      eqUpdate = (J, P3, ex) => { bar.position.copy(barSquat(J, ex)); };
    }
    if (id === 'machine-lateral-raise' || id === 'lat-pulldown') {
      const seat = box(44, 8, 34, EQ.pad); seat.position.set(0, y - 10, 8); eqG.add(seat);
      const post = box(6, y - 14, 6, EQ.dark); post.position.set(0, (y - 14) / 2, 8); eqG.add(post);
      const foot = box(40, 3, 30, EQ.dark); foot.position.set(0, 1.5, 8); eqG.add(foot);
    }
    if (id === 'machine-lateral-raise') {
      const back = box(42, 64, 6, EQ.pad); back.position.set(0, y + 26, -11); eqG.add(back);
      const col = box(8, y + 70, 8, EQ.dark); col.position.set(0, (y + 70) / 2, -22); eqG.add(col);
      const pads = ['R', 'L'].map(s => { const o = mk(new T.CylinderGeometry(4.6, 4.6, 12, 20), EQ.pad); o.rotation.x = Math.PI / 2; eqG.add(o); return [s, o]; });
      eqUpdate = (J, P3, ex, W) => { for (const [s, o] of pads) { const e = W('forearm', s) || P3[s].e; o.position.set(e.x + (s === 'R' ? 6 : -6), e.y + 2, e.z); } };
    }
    if (id === 'lat-pulldown') {
      const col = box(10, 260, 10, EQ.dark); col.position.set(0, 130, -40); eqG.add(col);
      const beam = box(8, 8, 60, EQ.dark); beam.position.set(0, 256, -12); eqG.add(beam);
      const pul = mk(new T.CylinderGeometry(5, 5, 4, 20), EQ.metal); pul.rotation.z = Math.PI / 2; pul.position.set(0, 250, 14); eqG.add(pul);
      const kp = mk(new T.CylinderGeometry(4.5, 4.5, 40, 20), EQ.pad); kp.rotation.z = Math.PI / 2; eqG.add(kp);
      const bar = new T.Group(); bar.add(cylX(1.5, 1, EQ.metal)); eqG.add(bar);
      const cab = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: '#c4ccd8' })); eqG.add(cab);
      eqUpdate = (J, P3, ex, W) => {
        const r = P3.R.h, l = P3.L.h, w = (r.x - l.x) + 26;
        bar.position.set(0, (r.y + l.y) / 2, (r.z + l.z) / 2); bar.children[0].scale.y = w;
        cab.geometry.setFromPoints([new T.Vector3(0, bar.position.y, bar.position.z), new T.Vector3(0, 245, 14)]);
        const k = P3.R.k; kp.position.set(0, k.y + 9, k.z - 2);
      };
    }
  }

  // camera e rotazione col dito
  let az = .9, elv = .2, dist = 420, tgt = new T.Vector3(0, 90, 0), defAz = .9, defEl = .2;
  function camUpdate() { cam.position.set(tgt.x + dist * Math.sin(az) * Math.cos(elv), tgt.y + dist * Math.sin(elv), tgt.z + dist * Math.cos(az) * Math.cos(elv)); cam.lookAt(tgt); }
  let drag = null;
  R.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az, el: elv }; R.domElement.setPointerCapture(e.pointerId); });
  R.domElement.addEventListener('pointermove', e => { if (!drag) return; az = drag.az - (e.clientX - drag.x) * .012; if (e.pointerType === 'mouse') elv = Math.max(-.05, Math.min(1.1, drag.el + (e.clientY - drag.y) * .008)); camUpdate(); });
  const end = () => drag = null; R.domElement.addEventListener('pointerup', end); R.domElement.addEventListener('pointercancel', end);

  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(el);

  let cur = null;
  function setExercise(ex, J) {
    cur = ex;
    const P = to3D(J, ex);
    buildEquip(ex.id, P);
    const vb = ex.vb; tgt.set(0, ex.g - (vb[1] + vb[3] / 2), 0);
    dist = vb[2] * 1.65;
    defAz = az = ex.view === 'side' ? .95 : .45; defEl = elv = .16;
    camUpdate(); resize();
  }
  function reset() { az = defAz; elv = defEl; camUpdate(); }

  let curJ = null, lastGrip = null;
  const W = (n, s) => model ? B[n + MAP[s]].getWorldPosition(new T.Vector3()) : null;
  function update(J, ex, op) {
    if (cur !== ex) setExercise(ex, J);
    const P = to3D(J, ex); curJ = J;
    if (model) { poseModel(P); paint(ex.m, op); }
    if (eqUpdate) eqUpdate(J, P, ex, W);
    R.render(scene, cam);
  }
  return { update, reset, resize };
}
