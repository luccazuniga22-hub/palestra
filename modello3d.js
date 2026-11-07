// Modello 3D dell'allenamento: corpo umano (CC0) con scheletro, muscoli scolpiti e attrezzi.
import * as T from './vendor/three-lite.js';
import { POSE3, IDS } from './esercizi3d.js';
export { IDS };

const UP = new T.Vector3(0, 1, 0);
const V3 = a => new T.Vector3(a[0], a[1], a[2]);
const A3 = v => [v.x, v.y, v.z];
const MAP = { P: 'L', M: 'R' };            // lato della posa -> lato del modello

function lerp(a, b, t) {
  if (typeof a === 'number') return typeof b === 'number' ? a + (b - a) * t : a;
  if (Array.isArray(a)) return a.map((v, i) => lerp(v, b ? b[i] : v, t));
  if (a && typeof a === 'object') { const o = {}; for (const k in a) o[k] = b && k in b ? lerp(a[k], b[k], t) : a[k]; return o; }
  return a;
}

export function create(el, opts = {}) {
  const R = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.outputColorSpace = T.SRGBColorSpace;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.shadowMap.enabled = true;
  R.shadowMap.type = T.PCFSoftShadowMap;
  R.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  el.appendChild(R.domElement);
  const loading = document.createElement('div');
  loading.textContent = 'Carico il modello 3D…';
  loading.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#aeb6c2;font:700 14px Manrope,system-ui,sans-serif;pointer-events:none';
  el.appendChild(loading);

  const scene = new T.Scene();
  scene.background = new T.Color('#141a21');
  scene.fog = new T.Fog('#141a21', 600, 1200);
  const cam = new T.PerspectiveCamera(32, 1, 1, 3000);
  scene.add(new T.HemisphereLight('#e4ecff', '#262b33', .75));
  const sun = new T.DirectionalLight('#ffffff', 2.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 900 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = .6; scene.add(sun); scene.add(sun.target);
  const rim = new T.DirectionalLight('#8fb0ff', 1.3); rim.position.set(-220, 160, -240); scene.add(rim);
  const floor = new T.Mesh(new T.CircleGeometry(260, 72), new T.MeshStandardMaterial({ color: '#1c232c', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new T.Mesh(new T.TorusGeometry(140, .6, 6, 90), new T.MeshBasicMaterial({ color: '#2a3340' }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .3; scene.add(ring);

  const MAT = {
    dark: new T.MeshStandardMaterial({ color: '#39424f', roughness: .65, metalness: .2 }),
    pad: new T.MeshStandardMaterial({ color: '#262c35', roughness: .9 }),
    metal: new T.MeshStandardMaterial({ color: '#b3bdcc', roughness: .25, metalness: .9 }),
    plate: new T.MeshStandardMaterial({ color: '#1f242a', roughness: .5, metalness: .35 }),
  };
  const mk = (g, m) => { const o = new T.Mesh(g, typeof m === 'string' ? MAT[m] : m); o.castShadow = true; o.receiveShadow = true; return o; };

  // ---- modello umano ----
  const SKIN = new T.Color('#d9dde3'), SHORTS = new T.Color('#3a4250'), RED = new T.Color('#e0412a');
  let model = null, mesh = null, colAttr = null, region = null, B = {}, restQ = {}, restLen = {}, soleLocal = {}, K = 80, lastKey = '';
  const qa = new T.Quaternion(), qb = new T.Quaternion(), va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3();
  const LEN = { TH: 32.6, SH: 41.4 };
  let readyCb = null;
  new T.GLTFLoader().load(new URL('./models/uomo.glb', import.meta.url).href, g => {
    const root = g.scene;
    root.traverse(o => { if (o.isBone) B[o.name] = o; if (o.isSkinnedMesh) mesh = o; });
    root.updateMatrixWorld(true);
    const wp = n => B[n].getWorldPosition(new T.Vector3());
    for (const s of ['L', 'R']) {
      restLen['upper_arm' + s] = wp('upper_arm' + s).distanceTo(wp('forearm' + s));
      restLen['forearm' + s] = wp('forearm' + s).distanceTo(wp('hand' + s));
      restLen['thigh' + s] = wp('thigh' + s).distanceTo(wp('shin' + s));
      restLen['shin' + s] = wp('shin' + s).distanceTo(wp('foot' + s));
    }
    K = 82.5;
    model = new T.Group(); model.add(root); model.rotation.y = -Math.PI / 2; model.scale.setScalar(K); scene.add(model);
    model.updateMatrixWorld(true);
    for (const n in B) restQ[n] = B[n].quaternion.clone();
    for (const s of ['L', 'R']) { const q = B['foot' + s].getWorldQuaternion(new T.Quaternion()); soleLocal[s] = new T.Vector3(0, 0, 1).applyQuaternion(q.invert()); }
    let geo = mesh.geometry.clone(); geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    geo = T.mergeVertices(geo, 1e-4);
    geo = subdivide(geo); smooth(geo, 2); geo = subdivide(geo); smooth(geo, 1); geo = subdivide(geo); smooth(geo, 1);
    geo.computeVertexNormals(); sculpt(geo); geo.computeVertexNormals();
    mesh.geometry = geo; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    colAttr = new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3); geo.setAttribute('color', colAttr);
    mesh.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: 0 });
    region = classify(geo, mesh.skeleton);
    soften(geo);
    lastKey = ''; loading.remove();
    if (cur) setExercise(cur);
  }, undefined, () => { loading.textContent = 'Modello 3D non disponibile'; });

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


  // ---- posa dello scheletro ----
  function setWorldQ(b, q) { b.parent.getWorldQuaternion(qa); b.quaternion.copy(qa.invert().multiply(q)); b.updateMatrixWorld(true); }
  function followQ(b) { b.parent.getWorldQuaternion(qa); return qa.clone().multiply(restQ[b.name]); }
  function aimBone(b, dir) { const q0 = followQ(b); va.set(0, 1, 0).applyQuaternion(q0); qb.setFromUnitVectors(va, vb.copy(dir).normalize()); setWorldQ(b, qb.clone().multiply(q0)); }
  function frameQ(y, z) { const Y = y.clone().normalize(), Z = z.clone().normalize(), X = new T.Vector3().crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z)); }
  const restWorld = {};
  function restWorldQ(n) { if (!restWorld[n]) { const chain = []; let b = B[n]; while (b && b.isBone) { chain.unshift(b.name); b = b.parent; } const q = new T.Quaternion().setFromAxisAngle(UP, -Math.PI / 2); for (const m of chain) q.multiply(restQ[m]); restWorld[n] = q; } return restWorld[n]; }
  function twoBone(S, target, L1, L2, pole) {
    const u = vc.subVectors(target, S).clone(); let d = u.length(); u.divideScalar(d || 1); d = Math.min(Math.max(d, Math.abs(L1 - L2) + .01), L1 + L2 - .01);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const n = pole.clone().addScaledVector(u, -pole.dot(u)); if (n.lengthSq() < 1e-6) n.set(0, 0, 1).addScaledVector(u, -u.z); n.normalize();
    return [S.clone().addScaledVector(u, a).addScaledVector(n, h), S.clone().addScaledVector(u, d)];
  }
  function chain(b1, b2, target, pole) {
    const S = B[b1].getWorldPosition(new T.Vector3());
    const [E, H] = twoBone(S, target, restLen[b1] * K, restLen[b2] * K, pole);
    aimBone(B[b1], E.clone().sub(S)); aimBone(B[b2], H.clone().sub(E));
    return H;
  }
  const curlQ = a => new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), a);
  const CURL_G = curlQ(1.05), CURL_R = curlQ(.4), THUMB_G = curlQ(.6);
  function fingers(ms, q, tq) {
    for (const f of ['f_index', 'f_middle', 'f_ring', 'f_pinky']) for (const k of ['01', '02', '03']) { const b = B[f + k + ms]; if (b) b.quaternion.copy(restQ[b.name]).multiply(q); }
    for (const k of ['02', '03']) { const b = B['thumb' + k + ms]; if (b) b.quaternion.copy(restQ[b.name]).multiply(tq || q); }
    B['hand' + ms].updateMatrixWorld(true);
  }
  function gripHand(ms, G, axis, wrist) {
    const hb = B['hand' + ms], q0 = followQ(hb), x0 = new T.Vector3(1, 0, 0).applyQuaternion(q0);
    const Yh = G.clone().sub(wrist).normalize(), Xh = axis.clone().addScaledVector(Yh, -axis.dot(Yh));
    if (Xh.lengthSq() < 1e-6) Xh.copy(x0); Xh.normalize(); if (Xh.dot(x0) < 0) Xh.negate();
    setWorldQ(hb, new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(Xh, Yh, new T.Vector3().crossVectors(Xh, Yh))));
    fingers(ms, CURL_G, THUMB_G);
    return wrist.clone().addScaledVector(Yh, 6.5);
  }
  const PALM = 6.5;
  let frame = null;
  function torsoFrame(p) {
    const pr = (p.pitch || 0) * Math.PI / 180, yr = (p.yaw || 0) * Math.PI / 180, hr = (p.head || 0) * Math.PI / 180;
    const qy = new T.Quaternion().setFromAxisAngle(UP, yr);
    const d = new T.Vector3(0, Math.cos(pr), Math.sin(pr)).applyQuaternion(qy), f = new T.Vector3(0, -Math.sin(pr), Math.cos(pr)).applyQuaternion(qy);
    const X = new T.Vector3().crossVectors(d, f).normalize();
    const hd = d.clone().multiplyScalar(Math.cos(hr)).addScaledVector(f, Math.sin(hr)), hf = f.clone().multiplyScalar(Math.cos(hr)).addScaledVector(d, -Math.sin(hr));
    return { d, f, X, hd, hf, hip: V3(p.hip) };
  }
  const local = (F, v) => F.hip.clone().addScaledVector(F.X, v[0]).addScaledVector(F.d, v[1]).addScaledVector(F.f, v[2]);
  const localDir = (F, v) => new T.Vector3().addScaledVector(F.X, v[0]).addScaledVector(F.d, v[1]).addScaledVector(F.f, v[2]);
  function handTarget(F, h, s) {
    if (!h) return null;
    if (Array.isArray(h.tf)) { const v = h.tf; return local(F, s === 'P' ? v : [-v[0], v[1], v[2]]); }
    if (h.tf === true) return h[s] ? local(F, h[s]) : null;
    return h[s] ? V3(h[s]) : null;
  }
  function poleOf(F, e, s, def) { if (!e || !e[s]) return V3(def); return e.tf ? localDir(F, e[s]) : V3(e[s]); }
  const G = { P: null, M: null }, AX = { P: null, M: null };
  function poseModel(p) {
    const F = torsoFrame(p); frame = F;
    model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    const Rt = frameQ(F.d, F.f), Rh = frameQ(F.hd, F.hf);
    for (const n of ['spine', 'spine001', 'spine002', 'spine003']) setWorldQ(B[n], Rt.clone().multiply(restWorldQ(n)));
    for (const n of ['spine004', 'spine005']) setWorldQ(B[n], Rh.clone().multiply(restWorldQ(n)));
    const m = B.thighL.getWorldPosition(new T.Vector3()).add(B.thighR.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
    model.position.copy(F.hip).sub(m); model.updateMatrixWorld(true);
    for (const s of ['P', 'M']) {
      const ms = MAP[s], sx = s === 'P' ? 1 : -1;
      // braccio
      let tgt = handTarget(F, p.hands, s), ax = p.grip && p.grip[s];
      const pole = poleOf(F, p.epole, s, [sx * .4, -1, -.3]);
      if (!tgt) tgt = B['upper_arm' + ms].getWorldPosition(new T.Vector3()).addScaledVector(F.d, -44).addScaledVector(F.X, sx * 4).addScaledVector(F.f, 3);
      if (ax) {
        const S = B['upper_arm' + ms].getWorldPosition(new T.Vector3());
        const H = chain('upper_arm' + ms, 'forearm' + ms, tgt.clone().addScaledVector(tgt.clone().sub(S).normalize(), -PALM), pole);
        let axis;
        if (ax === 'sag') { const el = B['forearm' + ms].getWorldPosition(new T.Vector3()); axis = new T.Vector3().crossVectors(H.clone().sub(el).normalize(), F.X).normalize(); }
        else axis = V3(ax).normalize();
        G[s] = gripHand(ms, tgt, axis, H); AX[s] = axis;
      } else {
        chain('upper_arm' + ms, 'forearm' + ms, tgt, pole);
        setWorldQ(B['hand' + ms], followQ(B['hand' + ms])); fingers(ms, CURL_R);
        G[s] = B['hand' + ms].getWorldPosition(new T.Vector3()); AX[s] = F.X.clone();
      }
      // gamba
      const ft = p.feet && p.feet[s] ? V3(p.feet[s]) : F.hip.clone().addScaledVector(F.X, sx * 10).setY(5.6);
      chain('thigh' + ms, 'shin' + ms, ft, poleOf(F, p.kpole, s, [0, 0, 1]));
      const fb = B['foot' + ms], q0 = followQ(fb), s0 = soleLocal[ms].clone().applyQuaternion(q0).normalize();
      const fd = V3(p.fdir && p.fdir[s] ? p.fdir[s] : [0, 0, 1]).normalize();
      qb.setFromUnitVectors(s0, fd); setWorldQ(fb, qb.clone().multiply(q0));
    }
    model.updateMatrixWorld(true);
  }

  // ---- attrezzi ----
  let eqG = new T.Group(); scene.add(eqG); let dyns = [];
  const E = {
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    mid: (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    add3(o) { eqG.add(o); return o; },
    box(w, h, d, pos, m = 'dark') { const o = mk(new T.BoxGeometry(w, h, d), m); o.position.set(...pos); return E.add3(o); },
    pad(w, h, d) { return E.add3(mk(new T.BoxGeometry(w, h, d), 'pad')); },
    cyl(r, len, axis, pos, m = 'dark') { const o = mk(new T.CylinderGeometry(r, r, len, 28), m); if (axis === 'x') o.rotation.z = Math.PI / 2; if (axis === 'z') o.rotation.x = Math.PI / 2; o.position.set(...pos); return E.add3(o); },
    beam(a, b, r = 2, m = 'dark') { const o = mk(new T.CylinderGeometry(r, r, 1, 14), m); E.setBeam(o, a, b); return E.add3(o); },
    setBeam(o, a, b) { const A = V3(a), Bv = V3(b), d = Bv.clone().sub(A), L = d.length(); o.position.copy(A).add(Bv).multiplyScalar(.5); o.scale.set(1, Math.max(L, .01), 1); if (L > 1e-6) o.quaternion.setFromUnitVectors(UP, d.divideScalar(L)); },
    place(o, pos, normal) { o.position.set(...pos); if (normal) o.quaternion.setFromUnitVectors(UP, V3(normal).normalize()); },
    orient(o, axis, pos) { o.position.set(...pos); o.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), V3(axis).normalize()); },
    slab(w, len, th, c, lenDir, normal, m = 'pad') { const o = mk(new T.BoxGeometry(w, th, len), m); const Zv = V3(lenDir).normalize(), Yv = V3(normal).addScaledVector(Zv, -V3(normal).dot(Zv)).normalize(), Xv = new T.Vector3().crossVectors(Yv, Zv); o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(Xv, Yv, Zv)); o.position.set(...c); return E.add3(o); },
    bar(len, plateR = 0) {
      const g = new T.Group(), b = mk(new T.CylinderGeometry(1.4, 1.4, len, 18), 'metal'); b.rotation.z = Math.PI / 2; g.add(b);
      if (plateR) for (const sx of [1, -1]) { const pl = mk(new T.CylinderGeometry(plateR, plateR, 3.5, 30), 'plate'); pl.rotation.z = Math.PI / 2; pl.position.x = sx * (len / 2 - 6); g.add(pl); }
      g.userData.bar = b; return E.add3(g);
    },
    barbell(len = 180) {
      const g = new T.Group(), b = mk(new T.CylinderGeometry(1.4, 1.4, len, 18), 'metal'); b.rotation.z = Math.PI / 2; g.add(b);
      for (const sx of [1, -1]) { for (const [x, r, w, m] of [[62, 18.5, 4.5, 'plate'], [67, 18.5, 4.5, 'plate'], [72, 3.2, 3, 'metal'], [56, 2.6, 6, 'metal']]) { const p = mk(new T.CylinderGeometry(r, r, w, 36), m); p.rotation.z = Math.PI / 2; p.position.x = sx * x; g.add(p); } }
      return E.add3(g);
    },
    dumbbells() {
      const one = () => { const g = new T.Group(), h = mk(new T.CylinderGeometry(1.3, 1.3, 13, 16), 'metal'); h.rotation.z = Math.PI / 2; g.add(h); for (const sx of [1, -1]) { const p = mk(new T.CylinderGeometry(7, 7, 4.5, 28), 'plate'); p.rotation.z = Math.PI / 2; p.position.x = sx * 8.5; g.add(p); } return E.add3(g); };
      return { P: one(), M: one() };
    },
    hold(o, pos, axis) { E.orient(o, axis, pos); },
    line() { const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: '#c4ccd8' })); return E.add3(l); },
    setLine(l, a, b) { l.geometry.setFromPoints([V3(a), V3(b)]); },
    cableColumn(base, h, pulley) { E.box(10, h, 10, [base[0], h / 2, base[2]]); E.box(30, 3, 30, [base[0], 1.5, base[2]]); if (pulley) E.cyl(4.5, 4, 'x', pulley, 'metal'); },
    rope(from) {
      const l0 = E.line(), l1 = E.line(), l2 = E.line();
      return (gp, gm) => { const knot = [(gp[0] + gm[0]) / 2, Math.max(gp[1], gm[1]) + 8, (gp[2] + gm[2]) / 2]; E.setLine(l0, from, knot); E.setLine(l1, knot, gp); E.setLine(l2, knot, gm); };
    },
    handles(sides, axis) { const hs = sides.map(s => [s, E.cyl(1.5, 13, 'x', [0, 0, 0], 'metal')]); E.dyn(c => { for (const [s, h] of hs) E.orient(h, axis, c.G[s]); }); },
    machineSeat(hipY, back) { E.box(34, 6, 32, [0, hipY - 11, 2], 'pad'); E.box(6, hipY - 14, 6, [0, (hipY - 14) / 2, 2]); E.box(40, 3, 34, [0, 1.5, 4]); if (back) { E.box(32, 62, 6, [0, hipY + 30, -14], 'pad'); E.box(6, hipY + 50, 6, [0, (hipY + 50) / 2, -19]); } },
    inclineBench(pitch, hipY) {
      const pr = pitch * Math.PI / 180, d = [0, Math.cos(pr), Math.sin(pr)], f = [0, -Math.sin(pr), Math.cos(pr)];
      E.box(30, 6, 30, [0, hipY - 11, 4], 'pad');
      const c = [0, hipY + d[1] * 28 - f[1] * 11, d[2] * 28 - f[2] * 11]; E.slab(30, 70, 7, c, d, f);
      E.box(6, hipY - 14, 6, [0, (hipY - 14) / 2, 4]); E.beam([0, 0, c[2] - 6], [c[0], c[1] - 6, c[2] + 4], 3); E.box(40, 3, 80, [0, 1.5, -10]);
    },
    rack() { for (const sx of [1, -1]) { E.box(5, 170, 5, [sx * 58, 85, -26]); E.box(5, 170, 5, [sx * 58, 85, 22]); E.box(5, 5, 26, [sx * 58, 108, 10]); } E.box(130, 3, 70, [0, 1.5, -2]); },
    dyn(fn) { dyns.push(fn); },
  };
  function buildEquip(def) { scene.remove(eqG); eqG = new T.Group(); scene.add(eqG); dyns = []; if (def.eq) def.eq(E); }

  // ---- camera: si gira col dito ----
  let az = .9, elv = .2, dist = 420, tgt = new T.Vector3(0, 90, 0), defAz = .9, defEl = .2;
  function camUpdate() {
    cam.position.set(tgt.x + dist * Math.sin(az) * Math.cos(elv), tgt.y + dist * Math.sin(elv), tgt.z + dist * Math.cos(az) * Math.cos(elv)); cam.lookAt(tgt);
    sun.position.set(tgt.x + 230, tgt.y + 260, tgt.z + 150); sun.target.position.copy(tgt);
  }
  let drag = null;
  R.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az, el: elv }; R.domElement.setPointerCapture(e.pointerId); });
  R.domElement.addEventListener('pointermove', e => { if (!drag) return; az = drag.az - (e.clientX - drag.x) * .012; if (e.pointerType === 'mouse') elv = Math.max(-.05, Math.min(1.1, drag.el + (e.clientY - drag.y) * .008)); camUpdate(); });
  const end = () => drag = null; R.domElement.addEventListener('pointerup', end); R.domElement.addEventListener('pointercancel', end);
  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(el);

  let cur = null, def = null, cache = {};
  const W = (n, s) => A3(B[n + MAP[s]].getWorldPosition(new T.Vector3()));
  function poseAt(t) { return lerp(def.A, Object.assign({}, def.A, def.B), t); }
  function runDyn(p) { const c = { G: { P: A3(G.P), M: A3(G.M) }, A: { P: A3(AX.P), M: A3(AX.M) }, W, p }; for (const fn of dyns) fn(c); }
  function setExercise(ex) {
    cur = ex; def = POSE3[ex.id]; if (!def) return;
    lastKey = ''; buildEquip(def);
    if (!model) { resize(); return; }
    const box = new T.Box3();
    for (const t of [0, .5, 1]) { const p = poseAt(t); poseModel(p); runDyn(p); for (const n in B) if (!/f_|thumb|heel/.test(n)) box.expandByPoint(B[n].getWorldPosition(new T.Vector3())); box.expandByPoint(G.P); box.expandByPoint(G.M); }
    box.expandByScalar(14); box.expandByPoint(box.min.clone().setY(0));
    const c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3());
    tgt.copy(c); dist = Math.max(s.y, Math.max(s.x, s.z)) * 2.0 + 10;
    defAz = az = def.cam ? def.cam.az : .9; defEl = elv = def.cam ? def.cam.el : .18;
    camUpdate(); resize();
  }
  function reset() { az = defAz; elv = defEl; camUpdate(); }
  function update(ex, t, op) {
    if (cur !== ex) setExercise(ex);
    if (model && def) { const p = poseAt(t); poseModel(p); runDyn(p); paint(ex.m, op); }
    R.render(scene, cam);
  }
  return { update, reset, resize, has: id => !!POSE3[id] };
}
