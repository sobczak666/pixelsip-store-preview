// Pixel Sip — podgląd 3D tumblera (Three.js). Tekstura = zbrandowany nadruk, owinięty na cylindrze.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const mount = document.getElementById('tumbler3d');
if (mount) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(0, 0.6, 8.6);

  // światła
  scene.add(new THREE.HemisphereLight(0xbfcfff, 0x20143a, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ea8ff, 1.1); rim.position.set(5, 2, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xff4fa3, 0.5); fill.position.set(3, -2, 4); scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableZoom = false;
  controls.autoRotate = true; controls.autoRotateSpeed = -1.6;
  controls.minPolarAngle = Math.PI * 0.44; controls.maxPolarAngle = Math.PI * 0.62;
  controls.enableDamping = true; controls.dampingFactor = 0.08;

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();

  // materiały (wg realnego zdjęcia: korpus matowy biały, rant/słomka polerowana stal, pokrywka przezroczysty plastik)
  const steel = new THREE.MeshStandardMaterial({ color: 0xe4e8f2, metalness: 0.96, roughness: 0.16 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fc, metalness: 0.18, roughness: 0.5 });
  const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xeaeef9, metalness: 0, roughness: 0.05, transmission: 0.94, ior: 1.45, thickness: 0.35, transparent: true });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.06, roughness: 0.52 });

  let tumbler = null, bodyMesh = null, lastH = 8, currentCap = 900, currentTex = null;
  const FR = 0.16;                                   // promień zaokrąglenia dna
  function fitCamera() {
    // dopasuj pełną wysokość (ze słomką) z zapasem, by nie ucinało góry przy pochyleniu
    const dist = (lastH / 2 * 1.25) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, lastH * 0.03, dist);
    controls.target.set(0, 0, 0); controls.update();
  }
  function buildTumbler(bodyH) {
    if (tumbler) { scene.remove(tumbler); tumbler.traverse(o => { o.geometry?.dispose(); }); }
    const g = new THREE.Group();
    // shell: prosty korpus + zaokrąglone dno (LatheGeometry), białe
    const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(1 - FR, 0)];
    for (let k = 1; k <= 7; k++) { const a = -Math.PI / 2 + (Math.PI / 2) * (k / 7); pts.push(new THREE.Vector2((1 - FR) + FR * Math.cos(a), FR + FR * Math.sin(a))); }
    pts.push(new THREE.Vector2(1, bodyH - 0.02)); pts.push(new THREE.Vector2(0.965, bodyH));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 160), shellMat));
    // nadruk na prostym boku (cienko nad shellem, bez z-fightu)
    const pb = FR + 0.01, pt = bodyH - 0.22;
    const print = new THREE.Mesh(new THREE.CylinderGeometry(1.006, 1.006, pt - pb, 160, 1, true), bodyMat);
    print.position.y = (pb + pt) / 2; bodyMesh = print; g.add(print);
    // rant (polerowana stal na górze korpusu)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.014, 1.006, 0.22, 160, 1, true), steel);
    rim.position.y = bodyH - 0.11; g.add(rim);
    // pokrywka: niska, przezroczysta (dwa stopnie)
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.0, 0.12, 96), lidMat); lid.position.y = bodyH + 0.04; g.add(lid);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.94, 0.11, 96), lidMat); dome.position.y = bodyH + 0.14; g.add(dome);
    // słomka pod kątem (jak na zdjęciu — w prawo)
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, bodyH * 0.5, 24), steel);
    straw.position.set(0.27, bodyH + 0.16, 0.06); straw.rotation.z = -0.34; g.add(straw);
    scene.add(g); tumbler = g;
    const box = new THREE.Box3().setFromObject(g);
    g.position.y = -(box.max.y + box.min.y) / 2;
    lastH = box.max.y - box.min.y; fitCamera();
    return g;
  }
  buildTumbler(6.2);

  // tekstura składana parametrycznie w store.js -> canvas -> CanvasTexture
  let canvasTex = null;
  function setTextureCanvas(canvas) {
    if (!canvas) return;
    if (!canvasTex) {
      canvasTex = new THREE.CanvasTexture(canvas);
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      canvasTex.wrapS = THREE.RepeatWrapping; canvasTex.wrapT = THREE.ClampToEdgeWrapping;
      canvasTex.anisotropy = maxAniso;
      canvasTex.center.set(0.5, 0.5); canvasTex.offset.x = 0.25;
      bodyMat.map = canvasTex; bodyMat.color.set(0xffffff); bodyMat.needsUpdate = true;
    } else { canvasTex.image = canvas; }
    canvasTex.needsUpdate = true;
  }
  function setSize(cap) {
    if (cap === currentCap) return; currentCap = cap;
    buildTumbler(cap >= 900 ? 6.2 : 5.1);  // bodyMat (z teksturą) jest reużywany w nowym meshu
  }

  // API dla store.js
  window.Tumbler = { setTextureCanvas, setSize };
  window.__t3d = { controls, camera, scene, renderer, render: () => renderer.render(scene, camera) };  // QA
  if (window.__tumblerWant) setSize(window.__tumblerWant.cap);
  if (window.__tumblerCanvas) setTextureCanvas(window.__tumblerCanvas);

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight || w;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fitCamera();
  }
  new ResizeObserver(resize).observe(mount); resize();

  let raf;
  function animate() { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
  animate();
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else animate(); });
}
