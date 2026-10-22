/* ==========================================================================
   材份 · 三维拆装
   ========================================================================== */
(function () {
  'use strict';

  var Q = new URLSearchParams(location.search);
  var STATE = Q.get('state') || 'start';
  var MODE = Q.get('mode') || 'train';
  var HUD = Q.get('hud') !== '0';

  var P = {
    preset: Q.get('preset') || 'shizi',
    chu: 30, gongScale: 1, kou: 10, zucai: false
  };

  /* ================= 基础场景 ================= */
  var stage = document.getElementById('stage');
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();

  // 背景：暖色天光渐变
  (function bg() {
    var c = document.createElement('canvas');
    c.width = c.height = 1024;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(512, 430, 40, 512, 470, 760);
    g.addColorStop(0, '#2b2f38');
    g.addColorStop(0.42, '#191d24');
    g.addColorStop(1, '#07090c');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 1024);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    scene.background = t;
  })();

  var camera = new THREE.PerspectiveCamera(32, stage.clientWidth / stage.clientHeight, 20, 1600);

  var hemi = new THREE.HemisphereLight(0xcddcff, 0x241a10, 0.30);
  scene.add(hemi);

  var key = new THREE.DirectionalLight(0xffd79c, 0.68);
  key.position.set(120, 200, 130);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.near = 20;
  key.shadow.camera.far = 700;
  key.shadow.camera.left = -95;
  key.shadow.camera.right = 95;
  key.shadow.camera.top = 110;
  key.shadow.camera.bottom = -80;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.22;
  scene.add(key);

  var fill = new THREE.DirectionalLight(0x7ba4ff, 0.34);
  fill.position.set(-160, 90, -120);
  scene.add(fill);

  var rim = new THREE.DirectionalLight(0xffb469, 0.85);
  rim.position.set(30, 40, -190);
  scene.add(rim);

  // 环境反射
  try {
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.06).texture;
  } catch (e) { }

  /* 地面与光晕已移除：改为柱头语境，避免 SSAO 在地面上产生块状伪影 */
  var LEGACY_GROUND = false;
  // 地面接影
  // 地面接影（默认停用，避免 SSAO 在地面上产生块状伪影）
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.32 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  if (LEGACY_GROUND) scene.add(ground);

  // 地面光晕（停用）
  (function pool() {
    if (!LEGACY_GROUND) return;
    var c = document.createElement('canvas');
    c.width = c.height = 512;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(256, 256, 10, 256, 256, 250);
    g.addColorStop(0, 'rgba(255,196,120,0.55)');
    g.addColorStop(0.45, 'rgba(200,140,70,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    var tex = new THREE.CanvasTexture(c);
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.26
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.3;
    scene.add(m);
  })();

  // 浮尘
  var dust = (function () {
    var n = 320, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var r = 60 + Math.random() * 190;
      var a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r * 0.9;
      pos[i * 3 + 1] = Math.random() * 190 - 8;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.9;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var m = new THREE.Points(g, KIT.materials().dust);
    scene.add(m);
    return m;
  })();

  /* ================= 后处理（辉光） ================= */
  var composer = null, bloom = null;
  try {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    // 接触暗部：屏幕空间环境光遮蔽
    if (THREE.SSAOPass && THREE.SSAOShader && Q.get('ssao') !== '0') {
      var ssao = new THREE.SSAOPass(scene, camera, stage.clientWidth, stage.clientHeight);
      ssao.kernelRadius = 6;
      ssao.minDistance = 0.001;
      ssao.maxDistance = 0.012;
      ssao.output = 0;
      composer.addPass(ssao);
      window.__SSAO = ssao;
    }
    bloom = new THREE.UnrealBloomPass(
      new THREE.Vector2(stage.clientWidth, stage.clientHeight), 0.18, 0.62, 0.98);
    composer.addPass(bloom);
  } catch (e) {
    composer = null;
  }

  /* ================= 相机轨道 ================= */
  var orbit = {
    target: new THREE.Vector3(0, 27, 0),
    theta: 0.88, phi: 1.12, radius: 208,
    tTheta: 0.88, tPhi: 1.12, tRadius: 208,
    minPhi: 0.22, maxPhi: 1.46, minR: 150, maxR: 560
  };
  function applyCamera() {
    var sp = Math.sin(orbit.phi);
    camera.position.set(
      orbit.radius * sp * Math.sin(orbit.theta) + orbit.target.x,
      orbit.radius * Math.cos(orbit.phi) + orbit.target.y,
      orbit.radius * sp * Math.cos(orbit.theta) + orbit.target.z
    );
    camera.lookAt(orbit.target);
  }
  applyCamera();


  (function contactShadow() {
    if (!LEGACY_GROUND) return;
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 4, 128, 128, 124);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(170, 170),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.25;
    scene.add(m);
  })();
  /* ================= 构件 ================= */
  var root = new THREE.Group();
  scene.add(root);

  var pieces = [], byId = {}, waste = [];

  function clearRoot() {
    root.traverse(function (o) {
      if (o.isMesh || o.isLine) {
        if (o.geometry && o.geometry !== undefined) {
          if (o.geometry.userData && o.geometry.userData.shared) return;
          o.geometry.dispose();
        }
      }
    });
    while (root.children.length) root.remove(root.children[0]);
    waste.length = 0;
    pieces = []; byId = {};
  }

  function makeGhost(group) {
    var ghost = group.clone(true);
    var meshes = [];
    ghost.traverse(function (o) { if (o.isMesh) meshes.push(o); });
    meshes.forEach(function (o) {
      o.material = KIT.materials().ghost;
      o.castShadow = false;
      o.receiveShadow = false;
      var edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(o.geometry, 42),
        KIT.materials().ghostLine
      );
      o.add(edges);
    });
    return ghost;
  }

  function rebuild(reset) {
    clearRoot();
    var built = GRADES.build({
      preset: P.preset, chu: P.chu, gongScale: P.gongScale,
      kou: P.kou, zucai: P.zucai
    });
    var defs = built.pieces;

    defs.forEach(function (d) {
      var g = d.build();
      g.traverse(function (o) {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.material.envMapIntensity = 0.16;
        }
      });
      var target = new THREE.Vector3().fromArray(d.pos);
      g.position.copy(target);
      if (d.rot) g.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
      g.userData.pieceId = d.id;

      var ghost = makeGhost(g);

      // 不可见的拾取代理：薄板太难点中，放大一点更好抓
      (function () {
        var lb = new THREE.Box3();
        g.updateMatrixWorld(true);
        g.traverse(function (o) {
          if (!o.isMesh) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          var b = o.geometry.boundingBox.clone();
          b.applyMatrix4(o.matrix);
          lb.union(b);
        });
        if (lb.isEmpty()) return;
        var sz = lb.getSize(new THREE.Vector3());
        var ct = lb.getCenter(new THREE.Vector3());
        var proxy = new THREE.Mesh(
          new THREE.BoxGeometry(sz.x + 8, sz.y + 8, sz.z + 8),
          new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
        );
        proxy.position.copy(ct);
        proxy.userData.isProxy = true;
        g.add(proxy);
      })();
      ghost.position.copy(target);
      if (d.rot) ghost.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
      ghost.visible = false;

      // 轴线导轨
      var axis = new THREE.Vector3().fromArray(d.axis).normalize();
      // 拆开方向朝向镜头外侧，避免构件挡住视线
      var camAz = new THREE.Vector3(Math.sin(0.98), 0, Math.cos(0.98));
      if (axis.y === 0 && axis.dot(camAz) > 0) axis.negate();
      var from = target.clone();
      var to = target.clone().addScaledVector(axis, d.off);
      var lineGeo = new THREE.BufferGeometry().setFromPoints([from, to]);
      var lineMat = new THREE.LineDashedMaterial({
        color: 0xd8a24a, dashSize: 4, gapSize: 5,
        transparent: true, opacity: 0.0, depthWrite: false
      });
      var guide = new THREE.Line(lineGeo, lineMat);
      guide.computeLineDistances();
      root.add(guide);

      root.add(ghost);
      root.add(g);

      pieces.push({
        def: d, group: g, ghost: ghost, guide: guide,
        target: target, axis: axis,
        state: 'idle', s: d.off, hover: 0, glow: 0
      });
      byId[d.id] = pieces[pieces.length - 1];
    });

    if (reset) { startTime = 0; elapsed = 0; errors = 0; finished = false; started = false; }
    pieces.forEach(function (p) {
      p.group.position.copy(p.target).addScaledVector(p.axis, p.def.off);
      p.ghost.visible = true;
    });
    buildContext();
    fitCamera();
    buildList();
    if (pieces.length) showInfo(pieces[0]);
    updateHUD();
  }


  function fitCamera(withAngles) {
    if (!pieces.length) return;
    var box = new THREE.Box3();
    pieces.forEach(function (p) {
      var b = new THREE.Box3().setFromObject(p.group);
      if (!b.isEmpty()) box.union(b);
    });
    if (box.isEmpty()) return;
    var sphere = box.getBoundingSphere(new THREE.Sphere());
    var halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    orbit.target.copy(sphere.center);
    orbit.target.y -= sphere.radius * 0.14;
    orbit.tRadius = Math.max(140, sphere.radius / Math.sin(halfFov) * 1.10);
    if (withAngles) { orbit.tPhi = 1.26; orbit.tTheta = 0.78; }
    if (Q.get('zoom') === '1') {
      orbit.target.set(0, 36, 20);
      orbit.tRadius = 120;
      orbit.tPhi = 1.32;
      orbit.tTheta = 1.02;
    }
  }
  var ctx = null;
  function buildContext(defs) {
    if (ctx) { root.remove(ctx); ctx = null; }
    var g = new THREE.Group();
    var matWood = new THREE.MeshStandardMaterial({ color: 0x2a1e12, roughness: 0.94, metalness: 0.0 });
    var matStone = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 1.0, metalness: 0.0 });

    var col = new THREE.Mesh(new THREE.CylinderGeometry(19, 21, 150, 28), matWood);
    col.position.set(0, -75, 0);
    col.receiveShadow = true; col.castShadow = true;
    g.add(col);

    var plate = new THREE.Mesh(new THREE.BoxGeometry(132, 11, 46), matWood);
    plate.position.set(0, -5.5, 0);
    plate.receiveShadow = true; plate.castShadow = true;
    g.add(plate);

    var base = new THREE.Mesh(new THREE.CylinderGeometry(30, 33, 8, 28), matStone);
    base.position.set(0, -154, 0);
    base.receiveShadow = true;
    g.add(base);

    ctx = g;
    root.add(g);
  }


  /* ---------- 建筑语境：柱头 + 普拍枋（不可拾取，只做尺度参照） ---------- */
  var ctxGroup = null;
  function buildContext() {
    if (ctxGroup) { root.remove(ctxGroup); ctxGroup = null; }
    var g = new THREE.Group();
    var wood = new THREE.MeshStandardMaterial({ color: 0x080605, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.03 });
    var stone = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.02 });

    var col = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 120, 28), wood);
    col.position.set(0, -72, 0);
    col.castShadow = true; col.receiveShadow = true;
    g.add(col);

    var plate = new THREE.Mesh(new THREE.BoxGeometry(128, 10, 44), wood);
    plate.position.set(0, -5, 0);
    plate.castShadow = true; plate.receiveShadow = true;
    g.add(plate);

    // 撩檐枋：压在跳头之上，屋檐的重量就从这里传下来
    var topY = 0;
    pieces.forEach(function (p) { topY = Math.max(topY, p.target.y + (p.def.h || 10)); });
    if (false && topY > 0) {
      var beam = new THREE.Mesh(new THREE.BoxGeometry(178, 13, 24), wood);
      beam.position.set(0, topY + 9, 22);
      beam.castShadow = true; beam.receiveShadow = true;
      g.add(beam);
    }

    var base = new THREE.Mesh(new THREE.CylinderGeometry(32, 36, 10, 32), stone);
    base.position.set(0, -206, 0);
    base.receiveShadow = true;
    g.add(base);

    ctxGroup = g;
    root.add(g);
  }
  /* ================= 状态 ================= */
  var elapsed = 0, errors = 0, started = false, finished = false, startTime = 0;
  var clock = new THREE.Clock();
  var ray = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var drag = null, orbitDrag = null;

  function nextPiece() {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].state !== 'done') return pieces[i];
    return null;
  }
  function remaining() { return pieces.filter(function (p) { return p.state !== 'done'; }).length; }

  /* ================= 拾取与拖动 ================= */
  function pointerNDC(e) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function hitPiece() {
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(root.children, true);
    var cand = [];
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && !o.userData.pieceId) o = o.parent;
      if (!o || !o.userData || !o.userData.pieceId) continue;
      var pc = byId[o.userData.pieceId];
      if (!pc || pc.state === 'done') continue;
      if (cand.indexOf(pc) < 0) cand.push(pc);
      if (cand.length >= 4) break;
    }
    if (!cand.length) return null;
    // 优先抓“当前可以装”且离指针最近的那一件：悬浮构件互相遮挡时，点击才符合直觉
    var best = null, bestD = 1e9, bestAny = null, bestAnyD = 1e9;
    for (var j = 0; j < cand.length; j++) {
      var c = cand[j];
      var v = c.group.position.clone().project(camera);
      var d = (v.x - ndc.x) * (v.x - ndc.x) + (v.y - ndc.y) * (v.y - ndc.y);
      if (d < bestAnyD) { bestAnyD = d; bestAny = c; }
      if (depsReady(c) === true && d < bestD) { bestD = d; best = c; }
    }
    return best || bestAny;
  }
  function axisS(target, axis) {
    var o = ray.ray.origin, d = ray.ray.direction;
    var w0 = new THREE.Vector3().subVectors(o, target);
    var a = d.dot(d), b = d.dot(axis), c = axis.dot(axis);
    var dd = d.dot(w0), e = axis.dot(w0);
    var den = a * c - b * b;
    if (Math.abs(den) < 1e-6) return 0;
    return (a * e - b * dd) / den;
  }

  var canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    pointerNDC(e);
    var p = hitPiece();
    if (p && p.state !== 'done') {
      drag = { p: p, s0: p.s, g0: axisS(p.target, p.axis) };
      p.guide.material.opacity = 0.42;
      p.ghost.visible = true;
      showInfo(p);
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      e.preventDefault();
      return;
    }
    orbitDrag = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
  });

  canvas.addEventListener('pointermove', function (e) {
    pointerNDC(e);
    if (drag) {
      ray.setFromCamera(ndc, camera);
      var p = drag.p;
      var s = drag.s0 + (axisS(p.target, p.axis) - drag.g0);
      s = Math.max(0, Math.min(p.def.off, s));
      p.s = s;
      p.group.position.copy(p.target).addScaledVector(p.axis, s);
      setHint(s < 14 ? '松手，即落位' : '沿轴线推进 · 对准虚影');
      return;
    }
    if (orbitDrag) {
      orbit.tTheta -= (e.clientX - orbitDrag.x) * 0.0055;
      orbit.tPhi -= (e.clientY - orbitDrag.y) * 0.0045;
      orbit.tPhi = Math.max(orbit.minPhi, Math.min(orbit.maxPhi, orbit.tPhi));
      orbitDrag = { x: e.clientX, y: e.clientY };
      return;
    }
    var h = hitPiece();
    pieces.forEach(function (p) { p.hover = (h === p) ? 1 : 0; });
    canvas.style.cursor = h && h.state !== 'done' ? 'grab' : 'default';
  });

  function endPointer(e) {
    if (drag) {
      ray.setFromCamera(ndc, camera);
      var p = drag.p;
      drag = null;
      p.guide.material.opacity = 0;
      canvas.style.cursor = 'grab';
      if (p.s < 14) tryPlace(p); else settle(p);
    }
    orbitDrag = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    orbit.tRadius = Math.max(orbit.minR, Math.min(orbit.maxR, orbit.tRadius + e.deltaY * 0.28));
  }, { passive: false });

  /* ================= 约束与落位 ================= */
  function depsReady(p) {
    for (var i = 0; i < p.def.deps.length; i++) {
      var d = byId[p.def.deps[i]];
      if (!d || d.state !== 'done') return d ? d.def.name : '前置构件';
    }
    return true;
  }

  function tryPlace(p) {
    if (MODE === 'exam' || !finished) { /* 计时 */ }
    var ok = depsReady(p);
    if (ok !== true) {
      errors++;
      toast('顺序不对：先装好「' + ok + '」');
      settle(p);
      updateHUD();
      return;
    }
    p.state = 'done';
    p.s = 0;
    tweenTo(p.group.position, p.target, 150, function () { p.flash = performance.now(); });
    p.ghost.visible = false;
    p.guide.material.opacity = 0;
    if (!started) { started = true; startTime = performance.now(); }
    click();
    updateHUD();
    fitCamera(false);
    var n = nextPiece();
    if (n) showInfo(n);
    if (remaining() === 0) finish();
  }

  function settle(p) {
    p.state = 'idle';
    var dest = p.target.clone().addScaledVector(p.axis, p.def.off);
    tweenTo(p.group.position, dest, 260);
    p.s = p.def.off;
    p.ghost.visible = true;
  }

  var tweens = [];
  function tweenTo(vec, to, ms, done) {
    tweens.push({ v: vec, a: vec.clone(), b: to.clone(), t0: performance.now(), ms: ms, done: done });
  }
  function stepTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var t = tweens[i];
      var k = Math.min(1, (now - t.t0) / t.ms);
      var e = 1 - Math.pow(1 - k, 3);
      t.v.lerpVectors(t.a, t.b, e);
      if (k >= 1) { tweens.splice(i, 1); if (t.done) t.done(); }
    }
  }

  /* ================= 音效 ================= */
  var actx = null, muted = false;
  function click(freq) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq || 460, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.18);
    } catch (e) { }
  }

  /* ================= HUD ================= */
  var el = {
    time: document.getElementById('time'),
    prog: document.getElementById('prog'),
    progBar: document.getElementById('progBar'),
    err: document.getElementById('err'),
    list: document.getElementById('list'),
    info: document.getElementById('info'),
    hint: document.getElementById('hint'),
    toast: document.getElementById('toast'),
    done: document.getElementById('done'),
    title: document.getElementById('stageTitle'),
    sub: document.getElementById('stageSub')
  };

  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function buildList() {
    if (!el.list) return;
    el.list.innerHTML = '';
    pieces.forEach(function (p, i) {
      var b = document.createElement('button');
      b.className = 'row';
      b.dataset.id = p.def.id;
      b.innerHTML =
        '<span class="idx">' + ('0' + (i + 1)).slice(-2) + '</span>' +
        '<span class="nm">' + p.def.name + '</span>' +
        '<span class="dot"></span>';
      b.addEventListener('click', function () {
        showInfo(p);
        orbit.target.lerp(p.target.clone().add(new THREE.Vector3(0, 8, 0)), 0.6);
      });
      el.list.appendChild(b);
    });
  }

  function updateHUD() {
    var done = pieces.length - remaining();
    if (el.prog) el.prog.textContent = done + ' / ' + pieces.length;
    if (el.progBar) el.progBar.style.width = (done / Math.max(1, pieces.length) * 100) + '%';
    if (el.err) el.err.textContent = errors;
    if (el.time) el.time.textContent = fmt(elapsed);
    if (!el.list) return;
    var n = nextPiece();
    pieces.forEach(function (p) {
      p.ghost.visible = (n === p) && !drag;
      if (p.guide && !drag) p.guide.material.opacity = p.state === 'done' ? 0 : (n === p ? 0.34 : 0.10);
      var b = el.list.querySelector('[data-id="' + p.def.id + '"]');
      if (!b) return;
      b.classList.toggle('done', p.state === 'done');
      b.classList.toggle('next', n === p);
    });
    if (el.title && pieces.length) {
      el.title.textContent = GRADES.PRESETS.filter(function (x) { return x.id === P.preset; })[0].name;
      el.sub.textContent = pieces.length + ' 件构件 · ' + (P.zucai ? '足材' : '单材');
    }
  }

  function showInfo(p) {
    if (!el.info) return;
    var d = p.def;
    el.info.innerHTML =
      '<div class="info-head"><h3>' + d.name + '</h3><span>' + d.qing + '</span></div>' +
      '<div class="spec"><b>材份</b><p>' + d.spec + '</p></div>' +
      '<p class="role">' + d.role + '</p>' +
      '<div class="tip"><i>装法</i>' + d.tip + '</div>' +
      '<div class="tags"><span>' + (d.axis[1] ? '竖向落位' : '水平推入') + '</span>' +
      '<span>' + (d.deps.length ? '需先装 ' + d.deps.map(function (x) { return byId[x] ? byId[x].def.name : x; }).join('、') : '可先安装') + '</span></div>';
  }

  var hintTimer = null;
  function setHint(t) {
    if (el.hint) el.hint.textContent = t;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      var n = nextPiece();
      if (n && el.hint) el.hint.textContent = '下一步 · ' + n.def.name + (n.def.axis[1] ? '（自上方落下）' : '（沿轴线推入）');
    }, 2600);
  }
  function toast(t) {
    if (!el.toast) return;
    el.toast.textContent = t;
    el.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  }

  /* ================= 完成 ================= */
  function finish() {
    if (finished) return;
    finished = true;
    var sec = elapsed / 1000;
    var ideal = { dousan: 60, shizi: 150, chonggong: 300 }[P.preset] || 150;
    var score = Math.max(35, Math.round(100 - errors * 9 - Math.max(0, (sec - ideal) / ideal) * 22));
    try {
      var arr = JSON.parse(localStorage.getItem('cai_records') || '[]');
      arr.push({ ts: Date.now(), preset: P.preset, ms: Math.round(elapsed), errors: errors, score: score });
      localStorage.setItem('cai_records', JSON.stringify(arr.slice(-60)));
    } catch (e) { }
    if (el.done) {
      el.done.querySelector('[data-ms]').textContent = fmt(elapsed);
      el.done.querySelector('[data-err]').textContent = errors + ' 次';
      el.done.querySelector('[data-score]').textContent = score;
      el.done.classList.add('on');
    }
    setHint('整朵斗拱装配完成');
    click(780);
  }

  /* ================= 自动演示 ================= */
  var auto = false;
  function autoDemo() {
    if (auto) return;
    auto = true;
    if (!started) { started = true; startTime = performance.now(); }
    var i = 0;
    (function next() {
      if (i >= pieces.length) { auto = false; return; }
      var p = pieces[i++];
      p.state = 'done';
      p.s = 0;
      p.ghost.visible = false;
      p.guide.material.opacity = 0.3;
      p.group.position.copy(p.target).addScaledVector(p.axis, p.def.off);
      tweenTo(p.group.position, p.target, 460, function () {
        p.guide.material.opacity = 0;
        p.flash = performance.now();
        click(420 + Math.random() * 80);
        updateHUD();
        fitCamera(false);
        if (remaining() === 0) finish();
        setTimeout(next, 80);
      });
    })();
  }

  /* ================= 主循环 ================= */
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  var t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    var now = performance.now();
    stepTweens(now);

    if (started && !finished) { elapsed += clock.getDelta() * 1000; if (el.time) el.time.textContent = fmt(elapsed); }
    else clock.getDelta();

    orbit.theta += (orbit.tTheta - orbit.theta) * 0.08;
    orbit.phi += (orbit.tPhi - orbit.phi) * 0.08;
    orbit.radius += (orbit.tRadius - orbit.radius) * 0.08;
    applyCamera();

    // 悬停发光 + 落位脉冲
    pieces.forEach(function (p) {
      var want = p.state === 'done' ? 0 : (p.hover ? 1 : 0);
      p.glow += (want - p.glow) * 0.16;
      var flash = p.flash ? Math.max(0, 1 - (now - p.flash) / 420) : 0;
      p.group.traverse(function (o) {
        if (o.isMesh && o.material.emissive) {
          o.material.emissive.setRGB(
            0.50 * p.glow + 0.55 * flash,
            0.32 * p.glow + 0.36 * flash,
            0.10 * p.glow + 0.10 * flash
          );
        }
      });
      if (p.guide && p.guide.material.opacity > 0 && p.guide.material.opacity < 0.1) {
        p.guide.material.opacity = 0;
      }
    });

    dust.rotation.y += 0.00016;

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  /* ================= 预设与参数 ================= */
  function presetTo(state) {
    if (state === 'assembled') {
      pieces.forEach(function (p) {
        p.state = 'done'; p.s = 0;
        p.group.position.copy(p.target);
        p.ghost.visible = false;
        p.guide.material.opacity = 0;
      });
      fitCamera(false);
      started = true; finished = true;
      elapsed = { dousan: 48000, shizi: 132000, chonggong: 268000 }[P.preset] || 132000;
      errors = 1;
      setHint('整朵斗拱装配完成');
      updateHUD();
      if (el.time) el.time.textContent = fmt(elapsed);
    } else if (state === 'mid') {
      var k = Math.max(1, Math.floor(pieces.length * 0.55));
      pieces.forEach(function (p, i) {
        if (i < k) {
          p.state = 'done'; p.s = 0; p.group.position.copy(p.target);
          p.ghost.visible = false; p.guide.material.opacity = 0;
        }
      });
      var p = pieces[k];
      if (p) { p.s = p.def.off * 0.42; p.group.position.copy(p.target).addScaledVector(p.axis, p.s); p.guide.material.opacity = 0.4; }
      started = true; elapsed = 74000; errors = 2;
      updateHUD();
      if (el.time) el.time.textContent = fmt(elapsed);
    }
  }

  /* ================= 启动 ================= */
  rebuild(true);


  /* ---------- 采样级碰撞检测：射线奇偶判内外（探测期间临时双面材质） ---------- */
  function probeOverlaps() {
    var ray = new THREE.Raycaster();
    var dir = new THREE.Vector3(0.371, 0.557, 0.743).normalize();
    var touched = [];

    pieces.forEach(function (A) {
      A.group.position.copy(A.target);
      A.group.updateMatrixWorld(true);
      A.group.traverse(function (o) {
        if (o.isMesh && !o.userData.isProxy && touched.indexOf(o.material) < 0) {
          touched.push(o.material);
          o.material.userData.__side = o.material.side;
          o.material.side = THREE.DoubleSide;
        }
      });
    });

    function verts(obj) {
      var out = [];
      obj.traverse(function (o) {
        if (!o.isMesh || o.userData.isProxy) return;
        var pos = o.geometry.attributes.position;
        var step = Math.max(1, Math.floor(pos.count / 70));
        for (var i = 0; i < pos.count; i += step) {
          out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
        }
      });
      return out;
    }

    var rows = [];
    pieces.forEach(function (A, ai) {
      var pts = verts(A.group);
      pieces.forEach(function (B, bi) {
        if (ai === bi) return;
        var adjacent = A.def.deps.indexOf(B.def.id) >= 0 || B.def.deps.indexOf(A.def.id) >= 0;
        if (adjacent) return;
        var meshes = [];
        B.group.traverse(function (o) { if (o.isMesh && !o.userData.isProxy) meshes.push(o); });
        var n = 0;
        for (var i = 0; i < pts.length; i++) {
          ray.set(pts[i].clone(), dir);
          var hits = ray.intersectObjects(meshes, false);
          if (hits.length % 2 === 1) n++;
        }
        var pct = n / pts.length;
        if (pct > 0.06) rows.push(A.def.id + '>' + B.def.id + ':' + Math.round(pct * 100) + '%');
      });
    });

    touched.forEach(function (m) { m.side = m.userData.__side; });
    document.title = 'PROBE ' + (rows.length ? rows.join(' | ') : 'CLEAN');
  }

  /* ---------- 边-面穿刺检测：判定真实侵入 ---------- */
  function probePierce() {
    var ray = new THREE.Raycaster();
    var touched = [];
    pieces.forEach(function (A) {
      A.group.position.copy(A.target);
      A.group.updateMatrixWorld(true);
      A.group.traverse(function (o) {
        if (o.isMesh && !o.userData.isProxy && touched.indexOf(o.material) < 0) {
          touched.push(o.material);
          o.material.userData.__side = o.material.side;
          o.material.side = THREE.DoubleSide;
        }
      });
    });

    function edgesOf(obj) {
      var out = [];
      obj.traverse(function (o) {
        if (!o.isMesh || o.userData.isProxy) return;
        var pos = o.geometry.attributes.position;
        var idx = o.geometry.index;
        var n = idx ? idx.count : pos.count;
        var step = Math.max(3, Math.floor(n / 240)) * 3;
        for (var i = 0; i + 2 < n; i += step) {
          var i0 = idx ? idx.getX(i) : i;
          var i1 = idx ? idx.getX(i + 1) : i + 1;
          if (idx && idx.getX(i + 2) === undefined) break;
          var a = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
          var b = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
          out.push([a, b]);
        }
      });
      return out;
    }

    var rows = [];
    pieces.forEach(function (A, ai) {
      var es = edgesOf(A.group);
      pieces.forEach(function (B, bi) {
        if (ai === bi) return;
        var adjacent = A.def.deps.indexOf(B.def.id) >= 0 || B.def.deps.indexOf(A.def.id) >= 0;
        if (adjacent) return;
        var meshes = [];
        B.group.traverse(function (o) { if (o.isMesh && !o.userData.isProxy) meshes.push(o); });
        var hit = 0;
        for (var i = 0; i < es.length; i++) {
          var a = es[i][0], b = es[i][1];
          var d = b.clone().sub(a);
          var len = d.length();
          if (len < 0.05) continue;
          d.normalize();
          ray.set(a.clone().addScaledVector(d, 0.35), d);
          ray.far = len - 0.7;
          if (ray.far > 0.1 && ray.intersectObjects(meshes, false).length) hit++;
        }
        if (hit > 0) rows.push(A.def.id + '>' + B.def.id + ':' + hit + '/' + es.length);
      });
    });

    touched.forEach(function (m) { m.side = m.userData.__side; });
    document.title = 'PIERCE ' + (rows.length ? rows.join(' | ') : 'CLEAN');
  }

  /* ---------- 侵入检测：顶点沿法线内推 0.6 后是否落入另一件实体内（三向投票） ---------- */
  function probePenetrate() {
    var ray = new THREE.Raycaster();
    var dirs = [
      new THREE.Vector3(0.371, 0.557, 0.743).normalize(),
      new THREE.Vector3(-0.62, 0.31, 0.72).normalize(),
      new THREE.Vector3(0.18, -0.74, 0.65).normalize()
    ];
    var touched = [];
    pieces.forEach(function (A) {
      A.group.position.copy(A.target);
      A.group.updateMatrixWorld(true);
      A.group.traverse(function (o) {
        if (o.isMesh && !o.userData.isProxy && touched.indexOf(o.material) < 0) {
          touched.push(o.material);
          o.material.userData.__side = o.material.side;
          o.material.side = THREE.DoubleSide;
        }
      });
    });

    function innerPoints(obj) {
      var out = [];
      obj.traverse(function (o) {
        if (!o.isMesh || o.userData.isProxy) return;
        var pos = o.geometry.attributes.position;
        var nor = o.geometry.attributes.normal;
        if (!nor) return;
        var nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
        var step = Math.max(1, Math.floor(pos.count / 110));
        for (var i = 0; i < pos.count; i += step) {
          var v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          var n = new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
          out.push(v.addScaledVector(n, -1.2));
        }
      });
      return out;
    }

    function insideCount(p, meshes) {
      var votes = 0;
      for (var d = 0; d < dirs.length; d++) {
        ray.set(p.clone(), dirs[d]);
        ray.far = Infinity;
        if (ray.intersectObjects(meshes, false).length % 2 === 1) votes++;
      }
      return votes >= 2 ? 1 : 0;
    }

    var rows = [];
    pieces.forEach(function (A, ai) {
      var pts = innerPoints(A.group);
      pieces.forEach(function (B, bi) {
        if (ai === bi) return;
        var meshes = [];
        B.group.traverse(function (o) { if (o.isMesh && !o.userData.isProxy) meshes.push(o); });
        var n = 0, sample = [];
        for (var i = 0; i < pts.length; i++) {
          if (insideCount(pts[i], meshes)) { n++; if (sample.length < 3) sample.push(pts[i].toArray().map(function (v) { return Math.round(v); }).join(',')); }
        }
        if (n > 1) rows.push(A.def.id + '>' + B.def.id + ':' + n + '/' + pts.length + '[' + sample.join(' ') + ']');
      });
    });

    touched.forEach(function (m) { m.side = m.userData.__side; });
    var ang0 = byId['ang'] ? byId['ang'].group.children[0].geometry.attributes.position.count : -1;
    document.title = 'PEN ' + (rows.length ? rows.join(' | ') : 'CLEAN') + ' | angVerts=' + ang0 + ' notch=' + JSON.stringify(byId['ang'] ? byId['ang'].def.spec : '');
  }
  function checkOverlaps() {
    var rows = [];
    function boxOf(p) {
      var b = new THREE.Box3().setFromObject(p.group);
      b.translate(p.target.clone().sub(p.group.position));
      return b;
    }
    for (var i = 0; i < pieces.length; i++) {
      for (var j = i + 1; j < pieces.length; j++) {
        var A = pieces[i], B = pieces[j];
        var ba = boxOf(A), bb = boxOf(B);
        if (!ba.intersectsBox(bb)) continue;
        var it = ba.clone().intersect(bb);
        if (it.isEmpty()) continue;
        var sz = it.getSize(new THREE.Vector3());
        if (sz.x * sz.y * sz.z < 120) continue;
        rows.push(A.def.id + '/' + B.def.id + ':' +
          [sz.x, sz.y, sz.z].map(function (n) { return Math.round(n); }).join('x'));
      }
    }
    document.title = 'CHK ' + rows.join(' | ');
  }

  if (STATE !== 'start') presetTo(STATE);
  if (Q.get('check') === '1') {
    pieces.forEach(function (p) { p.state = 'done'; });
    try { checkOverlaps(); } catch (e) { document.title = 'CHK ERR ' + e.message; }
  }
  if (Q.get('probe') === '1') {
    pieces.forEach(function (p) { p.state = 'done'; });
    try { probeOverlaps(); } catch (e) { document.title = 'PROBE ERR ' + e.message; }
  }
  if (Q.get('pierce') === '1') {
    pieces.forEach(function (p) { p.state = 'done'; });
    try { probePierce(); } catch (e) { document.title = 'PIERCE ERR ' + e.message; }
  }
  if (Q.get('pen') === '1') {
    pieces.forEach(function (p) { p.state = 'done'; });
    try { probePenetrate(); } catch (e) { document.title = 'PEN ERR ' + e.message; }
  }
  if (Q.get('auto') === '1') {
    var okc = 0;
    pieces.forEach(function (p) { p.s = 0; tryPlace(p); okc += (p.state === 'done' ? 1 : 0); });
    document.title = 'AUTO done=' + okc + '/' + pieces.length + ' errors=' + errors + ' finished=' + finished;
  }
  if (Q.get('drag') === '1') {
    (function () {
      var i = 0, doneN = 0;
      var cv = renderer.domElement;
      function proj(v) {
        var q = v.clone().project(camera);
        var r = cv.getBoundingClientRect();
        return { x: (q.x * 0.5 + 0.5) * r.width + r.left, y: (-q.y * 0.5 + 0.5) * r.height + r.top };
      }
      function fire(t, x, y, b) {
        cv.dispatchEvent(new PointerEvent(t, {
          clientX: x, clientY: y, button: 0, buttons: b, pointerId: 1,
          bubbles: true, cancelable: true, isPrimary: true, pointerType: 'mouse'
        }));
      }
      function step() {
        if (i >= pieces.length) {
          document.title = 'DRAG done=' + doneN + '/' + pieces.length + ' errors=' + errors + ' finished=' + finished;
          return;
        }
        var p = pieces[i++];
        var a = proj(p.group.position), b = proj(p.target);
        fire('pointerdown', a.x, a.y, 1);
        var k = 0;
        (function move() {
          k++;
          var t = k / 14;
          fire('pointermove', a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1);
          if (k < 14) return setTimeout(move, 16);
          fire('pointerup', b.x, b.y, 0);
          setTimeout(function () {
            if (p.state === 'done') doneN++;
            step();
          }, 220);
        })();
      }
      setTimeout(step, 600);
    })();
  }
  if (Q.get('demo') === 'blocked') {
    // 演示用：先装好前两件，再故意点后置构件，让拦截提示留在画面上
    var seq = ['ludou', 'nidaogong'];
    seq.forEach(function (id) { var q = byId[id]; if (q) { q.s = 0; tryPlace(q); } });
    setTimeout(function () {
      var target = byId['sandou_z1'] || byId['jiaohudou'] || pieces[pieces.length - 1];
      if (target) { target.s = 0; tryPlace(target); }
      var t = document.getElementById('toast');
      if (t) { t.classList.add('show'); }
      var hb = document.getElementById('hint');
      if (hb) hb.textContent = '顺序不对：先装好「交互斗」';
      started = true;
    }, 400);
  }
  if (MODE === 'exam') {
    document.body.classList.add('exam');
    setHint('考核模式 · 无提示、无虚影，按正确顺序独立完成');
  }
  if (!HUD) document.body.classList.add('nohud');

  animate();

  var btnAuto = document.getElementById('btnAuto');
  if (btnAuto) btnAuto.addEventListener('click', function () {
    if (el.done) el.done.classList.remove('on');
    rebuild(true); autoDemo();
  });
  var btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', function () {
    if (el.done) el.done.classList.remove('on');
    rebuild(true);
    setHint('已重新拆开');
  });
  var btnAgain = document.getElementById('btnAgain');
  if (btnAgain) btnAgain.addEventListener('click', function () {
    if (el.done) el.done.classList.remove('on');
    rebuild(true);
  });

  // 铺作切换
  var tabs = document.querySelectorAll('[data-preset]');
  Array.prototype.forEach.call(tabs, function (t) {
    if (t.dataset.preset === P.preset) t.classList.add('on');
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      P.preset = t.dataset.preset;
      if (el.done) el.done.classList.remove('on');
      rebuild(true);
      setHint('已切换到「' + t.textContent.trim() + '」');
    });
  });

  // 参数
  function bindRange(id, key, fmtFn, after) {
    var r = document.getElementById(id);
    if (!r) return;
    var out = document.getElementById(id + 'Out');
    function upd() {
      var v = parseFloat(r.value);
      P[key] = v;
      if (out) out.textContent = fmtFn(v);
      if (el.done) el.done.classList.remove('on');
      rebuild(true);
      if (after) after(v);
    }
    r.addEventListener('input', upd);
    if (out) out.textContent = fmtFn(parseFloat(r.value));
  }
  bindRange('chu', 'chu', function (v) { return v + ' 分'; });
  bindRange('gs', 'gongScale', function (v) { return v.toFixed(2) + '×'; });
  bindRange('kou', 'kou', function (v) { return v + ' 分'; });

  var zc = document.getElementById('zucai');
  if (zc) zc.addEventListener('change', function () {
    P.zucai = zc.checked;
    if (el.done) el.done.classList.remove('on');
    rebuild(true);
    setHint(zc.checked ? '足材：拱高 21 分' : '单材：拱高 15 分');
  });


  // 测试钩子（仅供本地自动化调试，不参与业务逻辑）
  window.__CAI = {
    get pieces() { return pieces; },
    get byId() { return byId; },
    camera: camera, renderer: renderer, orbit: orbit,
    rebuild: rebuild, tryPlace: tryPlace,
    get errors() { return errors; },
    get dragging() { return drag ? drag.p.def.id : null; },
    get finished() { return finished; }
  };

  /* ================= 背景说明层 ================= */
  (function aboutPanel() {
    var box = document.getElementById('about');
    if (!box) return;
    var btnStart = document.getElementById('btnStart');
    var btnAbout = document.getElementById('btnAbout');
    var seen = false;
    try { seen = localStorage.getItem('cai_seen') === '1'; } catch (e) { }
    if (Q.get('intro') !== '0' && !seen) box.classList.add('on');
    function close() {
      box.classList.remove('on');
      try { localStorage.setItem('cai_seen', '1'); } catch (e) { }
    }
    if (btnStart) btnStart.addEventListener('click', close);
    if (btnAbout) btnAbout.addEventListener('click', function () { box.classList.add('on'); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  })();
  window.addEventListener('error', function (e) {
    var d = document.createElement('div');
    d.className = 'jserr';
    d.textContent = 'JS ERROR: ' + e.message;
    document.body.appendChild(d);
  });
})();



















































