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
  scene.background = new T.Color('#1a212b');
  scene.fog = new T.Fog('#1a212b', 650, 1300);
  const cam = new T.PerspectiveCamera(32, 1, 1, 3000);
  scene.add(new T.HemisphereLight('#eef3ff', '#39404c', 1.0));
  // luce frontale che segue la camera: il lato che guardi è sempre leggibile
  const fill = new T.DirectionalLight('#fff4ea', 1.0); scene.add(fill); scene.add(fill.target);
  const sun = new T.DirectionalLight('#ffffff', 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 900 });
  sun.shadow.radius = 5; sun.shadow.bias = -0.0005; sun.shadow.normalBias = .6; scene.add(sun); scene.add(sun.target);
  const rim = new T.DirectionalLight('#8fb0ff', 1.3); rim.position.set(-220, 160, -240); scene.add(rim);
  const floor = new T.Mesh(new T.CircleGeometry(260, 72), new T.MeshStandardMaterial({ color: '#2a323e', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new T.Mesh(new T.TorusGeometry(140, .6, 6, 90), new T.MeshBasicMaterial({ color: '#3a4554' }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .3; scene.add(ring);

  const MAT = {
    dark: new T.MeshStandardMaterial({ color: '#4d596b', roughness: .6, metalness: .15 }),
    pad: new T.MeshStandardMaterial({ color: '#2b323d', roughness: .85 }),
    metal: new T.MeshStandardMaterial({ color: '#cfd7e2', roughness: .32, metalness: .45 }),
    plate: new T.MeshStandardMaterial({ color: '#2c333c', roughness: .5, metalness: .2 }),
  };
  const mk = (g, m) => { const o = new T.Mesh(g, typeof m === 'string' ? MAT[m] : m); o.castShadow = true; o.receiveShadow = true; return o; };

  // ---- modello umano ----
  const SKIN = new T.Color('#e2d4ca'), SHORTS = new T.Color('#232932'), RED = new T.Color('#e0412a');
  let model = null, mesh = null, colAttr = null, region = null, B = {}, restQ = {}, restLen = {}, soleLocal = {}, K = 80, lastKey = '';
  const qa = new T.Quaternion(), qb = new T.Quaternion(), va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3();
  const LEN = { TH: 32.6, SH: 41.4 };
  let readyCb = null;
  // Il corpo è un modello MakeHuman (CC0). Le ossa vengono rinominate con i nomi usati dal resto del codice.
  const RENAME = { pelvis: 'spine', spine_01: 'spine001', spine_02: 'spine002', spine_03: 'spine003', neck_01: 'spine004', head: 'spine005' };
  function boneName(n) {
    if (RENAME[n]) return RENAME[n];
    const m = n.match(/^(.*)_(l|r)$/); if (!m) return n;
    const S = m[2].toUpperCase(), base = m[1];
    const lim = { clavicle: 'shoulder', upperarm: 'upper_arm', lowerarm: 'forearm', hand: 'hand', thigh: 'thigh', calf: 'shin', foot: 'foot', ball: 'toe' }[base];
    if (lim) return lim + S;
    const f = base.match(/^(index|middle|ring|pinky|thumb)_(\d\d)$/); if (f) return (f[1] === 'thumb' ? 'thumb' : 'f_' + f[1]) + f[2] + S;
    return n;
  }
  const T_OLD = 49.9;      // distanza bacino-spalle (in unità) per cui sono state scritte le pose
  let T_NEW = T_OLD;
  new T.GLTFLoader().load(new URL('./models/atleta.glb', import.meta.url).href, g => {
    const root = g.scene, extra = [];
    root.traverse(o => { if (o.isBone) { o.name = boneName(o.name); B[o.name] = o; } if (o.isSkinnedMesh) { if (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count) { if (mesh) extra.push(mesh); mesh = o; } else extra.push(o); } });
    for (const o of extra) { o.frustumCulled = false; o.castShadow = false; if (o.material) { o.material.roughness = .25; o.material.metalness = 0; } }
    root.updateMatrixWorld(true);
    const wp = n => B[n].getWorldPosition(new T.Vector3());
    for (const s of ['L', 'R']) {
      restLen['upper_arm' + s] = wp('upper_arm' + s).distanceTo(wp('forearm' + s));
      restLen['forearm' + s] = wp('forearm' + s).distanceTo(wp('hand' + s));
      restLen['thigh' + s] = wp('thigh' + s).distanceTo(wp('shin' + s));
      restLen['shin' + s] = wp('shin' + s).distanceTo(wp('foot' + s));
    }
    K = (LEN.TH + LEN.SH) / (restLen.thighL + restLen.shinL);
    T_NEW = wp('upper_armL').add(wp('upper_armR')).multiplyScalar(.5).distanceTo(wp('thighL').add(wp('thighR')).multiplyScalar(.5)) * K;
    model = new T.Group(); model.add(root); model.scale.setScalar(K); scene.add(model);
    model.updateMatrixWorld(true);
    for (const n in B) restQ[n] = B[n].quaternion.clone();
    measureHands();
    for (const s of ['L', 'R']) { const q = B['foot' + s].getWorldQuaternion(new T.Quaternion()); soleLocal[s] = new T.Vector3(0, 0, 1).applyQuaternion(q.invert()); }
    let geo = mesh.geometry.clone(); for (const k of Object.keys(geo.attributes)) if (!['position', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
    geo = T.mergeVertices(geo, 1e-5);
    geo = subdivide(geo); smooth(geo, 1);
    geo.computeVertexNormals();
    mesh.geometry = geo; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    colAttr = new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3); geo.setAttribute('color', colAttr);
    mesh.material = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .5, metalness: 0, sheen: .35, sheenRoughness: .55, sheenColor: new T.Color('#ffe2d2'), clearcoat: .06, clearcoatRoughness: .6 });
    region = classify(geo, mesh.skeleton);
    soften(geo);
    shade = cavity(geo);
    makeShorts(geo);
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
    tor(.36, .57, 30, 30, .024, true, 1);        // pettorali (piatti e larghi, bordo basso netto)
    tor(.45, .6, 54, 8, -.006);                  // solco tra pettorale e deltoide
    tor(-.02, .07, 28, 7, -.006);                // linee a V del basso ventre
    tor(.04, .24, 92, 34, -.009);                // vita più stretta (forma a V)
    tor(.36, .58, 0, 5, -.007, false);           // solco dello sterno
    for (const [y0, y1] of [[.025, .1], [.1, .18], [.18, .26], [.26, .34]]) tor(y0, y1, 11, 9, .01); // addominali (8 blocchi)
    for (const yy of [.1, .18, .26]) tor(yy - .008, yy + .008, 11, 12, -.006); // solchi orizzontali degli addominali
    tor(0, .35, 0, 3.5, -.008, false);           // linea alba
    tor(.04, .27, 42, 16, .011);                 // obliqui
    for (const yy of [.31, .35, .39]) tor(yy - .022, yy + .022, 62, 9, .007); // dentato anteriore
    tor(.2, .5, 112, 26, .03);                   // dorsali (forma a V)
    tor(.57, .68, 148, 26, .022);                // trapezi alti
    tor(.42, .58, 160, 15, .013);                // trapezio medio e romboidi
    tor(.03, .6, 180, 5, -.008, false);          // solco della colonna
    tor(.02, .3, 167, 9, .013);                  // lombari
    tor(-.17, .04, 152, 26, .028);               // glutei
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
      lim(top, el, 0, .42, out, .028, .1);                      // deltoide laterale
      lim(top, el, 0, .4, [1, 0, sg * .4], .02, .1);            // deltoide anteriore
      lim(top, el, .05, .4, [.7, 0, sg * .7], -.004, .1);       // solco deltoide anteriore-laterale
      lim(top, el, .05, .4, [-.7, 0, sg * .7], -.004, .1);      // solco deltoide laterale-posteriore
      lim(top, el, 0, .4, [-1, 0, sg * .4], .02, .1);           // deltoide posteriore
      lim(sh, el, .28, .92, fw, .021, .085, .9);                // bicipite
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
      lim(hp, kn, .3, .9, [0, 0, sg], -.004, .12);              // solco laterale della coscia
      lim(hp, kn, .05, .7, inn, .011, .12);                     // adduttori
      lim(kn, an, .07, .46, [-1, 0, -sg * .45], .03, .09, .8);  // gastrocnemio mediale
      lim(kn, an, .07, .4, [-1, 0, sg * .45], .022, .09, .8);   // gastrocnemio laterale
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
        if (/spine004/.test(bn) && p.y < .73) disp += .01;    // collo più robusto
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
      // massa atletica generale
      if (/upper_arm/.test(bn)) disp += .008; else if (/forearm/.test(bn)) disp += .006; else if (/thigh/.test(bn)) disp += .011; else if (/shin/.test(bn)) disp += .007;
      if (disp) P.setXYZ(i, p.x + nn.x * disp, p.y + nn.y * disp, p.z + nn.z * disp);
    }
    P.needsUpdate = true;
  }
  // zone dei muscoli sul modello a riposo (x avanti, y su, z = destra del modello)
  function classify(geo, sk) {
    const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, out = [];
    // le soglie qui sotto sono scritte in un sistema "di riferimento" (x avanti, y dal bacino, z verso destra): converto le coordinate del modello
    const YM = [[0, -.99], [.075, -.915], [.981, -.018], [1.45, .585], [1.554, .648], [1.653, .706], [1.81, .95]];
    const ymap = y => { for (let i = 1; i < YM.length; i++) if (y <= YM[i][0] || i === YM.length - 1) { const [a, b] = [YM[i - 1], YM[i]]; return b[1] + (y - b[0]) * (b[1] - a[1]) / (b[0] - a[0]); } };
    const toRef = v => v.set(v.z, ymap(v.y), -v.x * .85);
    const pv = new T.Vector3(), raw = new T.Vector3(), arm = {};
    for (const S of ['L', 'R']) { const sp = B['upper_arm' + S].getWorldPosition(new T.Vector3()).applyMatrix4(new T.Matrix4().copy(mesh.matrixWorld).invert()), ep = B['forearm' + S].getWorldPosition(new T.Vector3()).applyMatrix4(new T.Matrix4().copy(mesh.matrixWorld).invert()); arm[S] = { s: sp, u: ep.clone().sub(sp).normalize(), len: ep.distanceTo(sp) }; }
    const sh = { L: B.upper_armL.getWorldPosition(new T.Vector3()), R: B.upper_armR.getWorldPosition(new T.Vector3()) };
    model.updateMatrixWorld(true);
    // posizioni spalle nello spazio del modello
    const inv = new T.Matrix4().copy(mesh.matrixWorld).invert(); sh.L.applyMatrix4(inv); sh.R.applyMatrix4(inv); toRef(sh.L); toRef(sh.R);
    for (let i = 0; i < P.count; i++) {
      let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } }
      toRef(pv.fromBufferAttribute(P, i));
      const bn = sk.bones[best].name, x = pv.x, y = pv.y, z = pv.z, nx = N.getZ(i), nz = -N.getX(i), az = Math.abs(z);
      const side = z < 0 ? 'L' : 'R', dSh = Math.hypot(x - sh[side].x, y - sh[side].y, z - sh[side].z);
      let hair = false, shoe = false;
      if (/spine00[456]/.test(bn) && y > .78) { const th = Math.atan2(az, x - .005) * 180 / Math.PI, line = th < 50 ? .89 : th < 100 ? .89 - (th - 50) / 50 * .03 : .86 - (th - 100) / 80 * .07; hair = y > line; }
      if (hair || shoe) { out.push({ r: null, shorts: false, hair, shoe }); continue; }
      let r = null;
      const isArm = /upper_arm|shoulder/.test(bn);
      // spalla e braccio: posizione lungo l'osso del braccio (0 = spalla, 1 = gomito), nello spazio del modello
      raw.fromBufferAttribute(P, i); const A = arm[side], t = raw.sub(A.s).dot(A.u) / A.len;
      const delt = () => nx > .62 ? 'shoulderFront' : nx < -.55 ? 'shoulderRear' : 'shoulderSide';
      if (/upper_arm/.test(bn)) { r = t < .4 ? delt() : nx > .1 ? 'biceps' : nx < -.1 ? 'triceps' : null;
      } else if (/forearm/.test(bn)) r = 'forearm';
      else if (/thigh/.test(bn)) { if (y < -.12) r = nx > .15 ? 'quads' : nx < -.15 ? 'hams' : (nx > 0 ? 'quads' : 'hams'); if (y > -.17 && nx < -.2) r = 'glutes'; }
      else if (/shin/.test(bn)) { if (nx < -.05 && y > -.72) r = 'calves'; }
      else if (/shoulder/.test(bn) && t > -.12 && nx < .75) r = delt();
      else if (/spine|pelvis|shoulder/.test(bn) && !/spine00[45]/.test(bn)) {
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


  // ---- ombre nei solchi (curvatura): scurisce gli incavi tra i muscoli, schiarisce le parti sporgenti ----
  let shade = null;
  function cavity(geo) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array, n = P.length / 3;
    const nb = Array.from({ length: n }, () => []);
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
    const relax = (src, it) => { let q = Float32Array.from(src); for (let k = 0; k < it; k++) { const o = new Float32Array(q.length); for (let v = 0; v < n; v++) { const L = nb[v]; if (!L.length) { o[v * 3] = q[v * 3]; o[v * 3 + 1] = q[v * 3 + 1]; o[v * 3 + 2] = q[v * 3 + 2]; continue; } let x = 0, y = 0, z = 0; for (const u of L) { x += q[u * 3]; y += q[u * 3 + 1]; z += q[u * 3 + 2]; } o[v * 3] = x / L.length; o[v * 3 + 1] = y / L.length; o[v * 3 + 2] = z / L.length; } q = o; } return q; };
    const blur1 = (arr, it) => { for (let k = 0; k < it; k++) { const q = arr.slice(); for (let v = 0; v < n; v++) { let t = q[v] * 2, c = 2; for (const u of nb[v]) { t += q[u]; c++; } arr[v] = t / c; } } return arr; };
    const curv = Q => { const c = new Float32Array(n); for (let v = 0; v < n; v++) c[v] = (Q[v * 3] - P[v * 3]) * N[v * 3] + (Q[v * 3 + 1] - P[v * 3 + 1]) * N[v * 3 + 1] + (Q[v * 3 + 2] - P[v * 3 + 2]) * N[v * 3 + 2]; return c; };
    const big = curv(relax(P, 14)), small = curv(relax(P, 3));
    const hp = arr => { const b = blur1(arr.slice(), 18); for (let v = 0; v < n; v++) arr[v] -= b[v]; return arr; };
    hp(big); hp(small);
    const out = new Float32Array(n);
    for (let v = 0; v < n; v++) { const c = big[v] / .005 + small[v] / .0012 * .6; out[v] = 1 - .32 * Math.min(1, Math.max(0, c)) + .07 * Math.min(1, Math.max(0, -c)); }
    return blur1(out, 1);
  }

  // pantaloncini: un vero capo con spessore, staccato dalla pelle, con orlo e cintura
  function makeShorts(geo) {
    const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, I = geo.index.array;
    const Y0 = .7, Y1 = 1.045, map = new Map(), pos = [], si = [], sw = [], col = [], idx = [], c = new T.Color();
    const inside = v => { const y = P.getY(v); return y > Y0 && y < Y1 && !/hand|forearm|f_|thumb|upper_arm/.test(mesh.skeleton.bones[SI.getX(v)].name); };
    const add = v => { let m = map.get(v); if (m !== undefined) return m; m = pos.length / 3; map.set(v, m);
      let y = P.getY(v); const t = (y - Y0) / (Y1 - Y0), band = t > .9, off = band ? .013 : .019 - .012 * Math.min(1, t * 1.6);
      pos.push(P.getX(v) + N.getX(v) * off, y, P.getZ(v) + N.getZ(v) * off);
      for (let j = 0; j < 4; j++) { si.push(SI.getComponent(v, j)); sw.push(SW.getComponent(v, j)); }
      c.set(band ? '#3a424e' : '#1f252d'); col.push(c.r, c.g, c.b); return m; };
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], d = I[i + 2]; if (inside(a) && inside(b) && inside(d)) idx.push(add(a), add(b), add(d)); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new T.BufferAttribute(new Uint16Array(si), 4)); g.setAttribute('skinWeight', new T.BufferAttribute(new Float32Array(sw), 4));
    g.setIndex(idx); g.computeVertexNormals();
    const sh = new mesh.constructor(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, side: 2 }));
    sh.bind(mesh.skeleton, mesh.bindMatrix); sh.frustumCulled = false; sh.castShadow = true; sh.receiveShadow = true;
    mesh.parent.add(sh);
  }
  let soft = null, shortsSoft = null, hairSoft = null, shoeSoft = null;
  const HAIRC = new T.Color('#3b302a'), SHOEC = new T.Color('#2b3139');
  function soften(geo) {
    const I = geo.index.array, n = region.length, nb = Array.from({ length: n }, () => []);
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
    const blur = (arr, it) => { for (let k = 0; k < it; k++) { const q = arr.slice(); for (let v = 0; v < n; v++) { let t = q[v] * 2, c = 2; for (const u of nb[v]) { t += q[u]; c++; } arr[v] = t / c; } } return arr; };
    soft = {};
    for (const k of Object.keys(MUSCLE_KEYS)) { const a = new Float32Array(n); let any = false; for (let i = 0; i < n; i++) if (region[i].r === k) { a[i] = 1; any = true; } if (any) soft[k] = blur(a, 4); }
    const sh = new Float32Array(n); for (let i = 0; i < n; i++) sh[i] = region[i].shorts ? 1 : 0; shortsSoft = blur(sh, 1);
    hairSoft = blur(Float32Array.from(region, g => g.hair ? 1 : 0), 1); shoeSoft = blur(Float32Array.from(region, g => g.shoe ? 1 : 0), 1);
  }
  const MUSCLE_KEYS = { chest: 1, back: 1, lats: 1, abs: 1, lowerBack: 1, glutes: 1, quads: 1, hams: 1, calves: 1, biceps: 1, triceps: 1, forearm: 1, shoulderFront: 1, shoulderSide: 1, shoulderRear: 1 };
  function paint(keys, op) {
    const key = keys.join() + '|' + op.toFixed(2); if (key === lastKey) return; lastKey = key;
    const c = new T.Color(), a = colAttr.array, act = keys.filter(k => soft[k]).map(k => soft[k]), str = .5 + .5 * op;
    for (let i = 0; i < region.length; i++) {
      c.copy(SKIN).lerp(SHORTS, shortsSoft[i]); if (hairSoft[i] > 0) c.lerp(HAIRC, hairSoft[i]); if (shoeSoft[i] > 0) c.lerp(SHOEC, shoeSoft[i]);
      let m = 0; for (const arr of act) if (arr[i] > m) m = arr[i];
      if (m > 0) c.lerp(RED, Math.min(1, m * 1.6) * str);
      if (shade) c.multiplyScalar(shade[i]);
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
  function restWorldQ(n) { if (!restWorld[n]) { const chain = []; let b = B[n]; while (b && b.isBone) { chain.unshift(b.name); b = b.parent; } const q = new T.Quaternion(); for (const m of chain) q.multiply(restQ[m]); restWorld[n] = q; } return restWorld[n]; }
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
  // ---- mani: misure prese dall'anatomia del modello (nocche, palmo, asse di chiusura delle dita) ----
  const HAND = {}, FING = ['f_index', 'f_middle', 'f_ring', 'f_pinky'];
  function measureHands() {
    const pos = n => B[n].getWorldPosition(new T.Vector3());
    for (const ms of ['L', 'R']) {
      const w = pos('hand' + ms), K = new T.Vector3(); for (const f of FING) K.add(pos(f + '01' + ms)); K.multiplyScalar(.25);
      const fwd = K.clone().sub(w), kf = fwd.length(); fwd.normalize();
      const across = pos('f_pinky01' + ms).sub(pos('f_index01' + ms)); across.addScaledVector(fwd, -across.dot(fwd)).normalize();
      const bend = new T.Vector3(); for (const f of FING) { const a = pos(f + '01' + ms), b = pos(f + '02' + ms), c = pos(f + '03' + ms); bend.add(new T.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(b))); }
      let n = new T.Vector3().crossVectors(across, fwd);
      if (bend.length() > 1e-4 ? bend.dot(across) < 0 : n.y > 0) { across.negate(); n.negate(); }
      const Mr = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across, fwd, n));
      const ax = {}; for (const f of FING.concat(['thumb'])) for (const k of ['01', '02', '03']) { const nm = f + k + ms; if (!B[nm]) continue; const qi = restWorldQ(nm).clone().invert(); ax[nm] = { curl: across.clone().applyQuaternion(qi), side: n.clone().negate().applyQuaternion(qi) }; }
      HAND[ms] = { kf, across, fwd, n, toRest: Mr.invert().multiply(restWorldQ('hand' + ms)), ax };
    }
  }
  const qx = new T.Quaternion();
  const GRIP = [1.2, 1.35, .7], RELAX = [.22, .32, .22];
  function fingers(ms, ang, grip) {
    const H = HAND[ms];
    for (const f of FING) ['01', '02', '03'].forEach((k, i) => { const b = B[f + k + ms]; if (b) b.quaternion.copy(restQ[b.name]).multiply(qx.setFromAxisAngle(H.ax[b.name].curl, ang[i])); });
    // pollice: si chiude attraverso il palmo, sotto l'attrezzo
    ['01', '02', '03'].forEach((k, i) => { const b = B['thumb' + k + ms]; if (!b) return; b.quaternion.copy(restQ[b.name]); if (grip) b.quaternion.multiply(qx.setFromAxisAngle(H.ax[b.name].side, [.35, .45, .5][i])).multiply(qx.setFromAxisAngle(H.ax[b.name].curl, [.45, .2, .2][i])); });
    B['hand' + ms].updateMatrixWorld(true);
  }
  // presa: le nocche stanno sull'attrezzo, il palmo lo tocca e le dita lo avvolgono
  // prese di spinta: il palmo spinge sull'attrezzo e il polso è piegato all'indietro (gradi)
  const PUSH = { 'incline-db-press': 55, 'incline-chest-press': 55, 'shoulder-press': 55, 'dips': 80, 'squat': 45, 'triceps-pushdown': 25 };
  function gripHand(ms, G, axis, pole) {
    const H = HAND[ms], hb = B['hand' + ms], ua = 'upper_arm' + ms, fa = 'forearm' + ms;
    const S = B[ua].getWorldPosition(new T.Vector3());
    chain(ua, fa, G.clone().addScaledVector(G.clone().sub(S).normalize(), -H.kf), pole);
    let Xh, fwd, n;
    for (let it = 0; it < 2; it++) {
      const E = B[fa].getWorldPosition(new T.Vector3());
      fwd = G.clone().sub(E); fwd.addScaledVector(axis, -fwd.dot(axis)).normalize();
      const nat = H.across.clone().applyQuaternion(followQ(hb).multiply(restWorldQ('hand' + ms).clone().invert()));
      Xh = axis.clone(); if (Xh.dot(nat) < 0) Xh.negate();
      n = new T.Vector3().crossVectors(Xh, fwd);
      const ext = (PUSH[cur.id] || 0) * Math.PI / 180;
      if (ext) { const fp = fwd.clone(); let best = null; for (const sg of [1, -1]) { const f2 = fp.clone().applyAxisAngle(axis, sg * ext), n2 = new T.Vector3().crossVectors(Xh, f2); if (!best || n2.dot(fp) > best[1].dot(fp)) best = [f2, n2]; } fwd = best[0]; n = best[1]; }
      chain(ua, fa, G.clone().addScaledVector(n, -2.3).addScaledVector(fwd, -(H.kf - .5)), pole);
    }
    setWorldQ(hb, new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(Xh, fwd, n)).multiply(H.toRest));
    fingers(ms, GRIP, true);
    return hb.getWorldPosition(new T.Vector3()).addScaledVector(n, 2.3).addScaledVector(fwd, H.kf - .5);
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
    const k = T_NEW / T_OLD;
    if (Array.isArray(h.tf)) { const v = h.tf; return local(F, [s === 'P' ? v[0] : -v[0], v[1] * k, v[2]]); }
    if (h.tf === true) return h[s] ? local(F, [h[s][0], h[s][1] * k, h[s][2]]) : null;
    return h[s] ? V3(h[s]) : null;
  }
  function poleOf(F, e, s, def) { if (!e || !e[s]) return V3(def); return e.tf ? localDir(F, e[s]) : V3(e[s]); }
  // esercizi in cui le mani stanno su un appoggio fisso: 'hang' = il corpo è appeso alle mani, 'fix' = maniglie accanto al bacino
  const RETARGET = { 'pull-up': 'hang', 'dips': 'hang', 'leg-extension': 'fix', 'seated-leg-curl': 'fix', 'leg-press': 'fix', 'lying-leg-curl': 'fix', 'hip-thrust': 'fix' };
  const G = { P: null, M: null }, AX = { P: null, M: null };
  function poseModel(p) {
    const F = torsoFrame(p); frame = F;
    const dT = T_NEW - T_OLD, mode = RETARGET[cur.id];
    const hang = new T.Vector3(); if (mode === 'hang') { hang.copy(F.d).multiplyScalar(-dT); F.hip.add(hang); }
    model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    const Rt = frameQ(F.d, F.f), Rh = frameQ(F.hd, F.hf);
    for (const n of ['spine', 'spine001', 'spine002', 'spine003']) setWorldQ(B[n], Rt.clone().multiply(restWorldQ(n)));
    for (const n of ['spine004', 'spine005']) setWorldQ(B[n], Rh.clone().multiply(restWorldQ(n)));
    const m = B.thighL.getWorldPosition(new T.Vector3()).add(B.thighR.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
    model.position.copy(F.hip).sub(m); model.updateMatrixWorld(true);
    if (mode === 'hang') {   // il corpo si avvicina alle mani quanto basta perché le braccia arrivino alla presa
      const ms = MAP.P, S = B['upper_arm' + ms].getWorldPosition(new T.Vector3()), t0 = handTarget(F, p.hands, 'P');
      const max = (restLen['upper_arm' + ms] + restLen['forearm' + ms]) * K * .985 + HAND[ms].kf, v = t0.clone().sub(S), d = v.length();
      if (d > max) { v.setX(0).normalize().multiplyScalar(d - max); model.position.add(v); F.hip.add(v); hang.add(v); model.updateMatrixWorld(true); }
    }
    for (const s of ['P', 'M']) {
      const ms = MAP[s], sx = s === 'P' ? 1 : -1;
      // braccio
      let tgt = handTarget(F, p.hands, s), ax = p.grip && p.grip[s];
      if (tgt && !mode && !(p.hands && p.hands.tf)) tgt.addScaledVector(F.d, dT);
      const pole = poleOf(F, p.epole, s, [sx * .4, -1, -.3]);
      if (!tgt) tgt = B['upper_arm' + ms].getWorldPosition(new T.Vector3()).addScaledVector(F.d, -44).addScaledVector(F.X, sx * 4).addScaledVector(F.f, 3);
      if (ax) {
        let axis;
        if (ax === 'sag') { chain('upper_arm' + ms, 'forearm' + ms, tgt, pole); const el = B['forearm' + ms].getWorldPosition(new T.Vector3()); axis = new T.Vector3().crossVectors(tgt.clone().sub(el).normalize(), F.X).normalize(); }
        else axis = V3(ax).normalize();
        G[s] = gripHand(ms, tgt, axis, pole); AX[s] = axis;
      } else {
        chain('upper_arm' + ms, 'forearm' + ms, tgt, pole);
        setWorldQ(B['hand' + ms], followQ(B['hand' + ms])); fingers(ms, RELAX, false);
        G[s] = B['hand' + ms].getWorldPosition(new T.Vector3()); AX[s] = F.X.clone();
      }
      // gamba
      const ft = p.feet && p.feet[s] ? V3(p.feet[s]) : F.hip.clone().addScaledVector(F.X, sx * 10).setY(5.6);
      if (p.feet && p.feet[s]) ft.add(hang);
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
  let az = .9, elv = .2, dist = 420, zoomK = 1, tgt = new T.Vector3(0, 90, 0), defAz = .9, defEl = .2, anim = null;
  const clampZ = k => Math.max(.5, Math.min(1.5, k));
  function camUpdate() {
    const d = dist * zoomK;
    cam.position.set(tgt.x + d * Math.sin(az) * Math.cos(elv), tgt.y + d * Math.sin(elv), tgt.z + d * Math.cos(az) * Math.cos(elv)); cam.lookAt(tgt);
    sun.position.set(tgt.x + 230, tgt.y + 260, tgt.z + 150); sun.target.position.copy(tgt);
    fill.position.copy(cam.position); fill.target.position.copy(tgt);
  }
  // un dito: gira il modello. Due dita: zoom.
  const ptr = new Map(); let drag = null, pinch = null;
  const gap = () => { const [a, b] = [...ptr.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const cv = R.domElement;
  cv.addEventListener('pointerdown', e => {
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); anim = null;
    if (ptr.size === 1) drag = { x: e.clientX, y: e.clientY, az, el: elv }; else if (ptr.size === 2) { drag = null; pinch = { d: gap(), k: zoomK }; }
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptr.size >= 2) zoomK = clampZ(pinch.k * pinch.d / gap());
    else if (drag) { az = drag.az - (e.clientX - drag.x) * .012; if (e.pointerType === 'mouse') elv = Math.max(-.05, Math.min(1.1, drag.el + (e.clientY - drag.y) * .008)); }
    else return;
    camUpdate();
  });
  const end = e => { ptr.delete(e.pointerId); drag = null; pinch = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); zoomK = clampZ(zoomK * (1 + e.deltaY * .01)); camUpdate(); }, { passive: false });
  function zoom(f) { zoomK = clampZ(zoomK * f); camUpdate(); }
  const VIEWS = { fronte: [0, .1], lato: [Math.PI / 2, .1], dietro: [Math.PI, .12] };
  function view(n) { const v = VIEWS[n] || [defAz, defEl]; let da = v[0] - az; da = Math.atan2(Math.sin(da), Math.cos(da)); anim = { az: az + da, el: v[1] }; }
  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); lastFrame = ''; }
  new ResizeObserver(resize).observe(el);

  let cur = null, def = null, cache = {}, lastFrame = '';
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
    defAz = az = def.cam ? def.cam.az : .9; defEl = elv = def.cam ? def.cam.el : .18; zoomK = 1; anim = null;
    camUpdate(); resize();
  }
  function reset() { az = defAz; elv = defEl; zoomK = 1; anim = null; camUpdate(); }
  function update(ex, t, op) {
    if (cur !== ex) setExercise(ex);
    if (anim) { az += (anim.az - az) * .2; elv += (anim.el - elv) * .2; if (Math.abs(anim.az - az) < .002 && Math.abs(anim.el - elv) < .002) { az = anim.az; elv = anim.el; anim = null; } camUpdate(); }
    // se niente è cambiato (animazione in pausa, camera ferma) non ridisegna: risparmia batteria
    const key = ex.id + '|' + t.toFixed(4) + '|' + op + '|' + az.toFixed(4) + '|' + elv.toFixed(4) + '|' + (dist * zoomK).toFixed(1) + '|' + el.clientWidth + 'x' + el.clientHeight + '|' + !!model;
    if (key === lastFrame) return; lastFrame = key;
    if (model && def) { const p = poseAt(t); poseModel(p); runDyn(p); paint(ex.m, op); }
    R.render(scene, cam);
  }
  return { _look(x, y, z, k, a, e) { tgt.set(x, y, z); zoomK = k; if (a !== undefined) { az = a; elv = e; } camUpdate(); }, _hand: s => A3(G[s]), update, reset, view, zoom, resize, has: id => !!POSE3[id] };
}
