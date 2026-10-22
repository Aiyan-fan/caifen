/* ==========================================================================
   材份 · 构件几何库
   单位：1 = 1「分」（宋《营造法式》材份制的最小模数单位）
   ========================================================================== */
(function (global) {
  'use strict';

  var K = {};

  /* ---------- 程序化木纹 ---------- */
  K.woodTexture = function (opts) {
    opts = opts || {};
    var base = opts.base || '#b98a52';
    var dark = opts.dark || '#5b3714';
    var seed = opts.seed || 7;
    var S = opts.size || 512;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, S, S);

    var rnd = (function (s) {
      return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    })(seed);

    // 木纹：沿 X 方向的细长流线
    for (var i = 0; i < 170; i++) {
      var y0 = rnd() * S;
      var amp = 2 + rnd() * 16;
      var w = 0.5 + rnd() * 2.6;
      x.beginPath();
      x.strokeStyle = dark;
      x.globalAlpha = 0.03 + rnd() * 0.10;
      x.lineWidth = w;
      var ph = rnd() * 6.28;
      var f = 1 + rnd() * 1.6;
      for (var px = 0; px <= S; px += 5) {
        var py = y0 + Math.sin((px / S) * 6.283 * f + ph) * amp
                    + Math.sin(px * 0.03 + ph * 2) * 2.0;
        if (px === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    // 木射线斑点
    for (var j = 0; j < 2600; j++) {
      x.globalAlpha = 0.015 + rnd() * 0.04;
      x.fillStyle = rnd() > 0.45 ? dark : '#fff3dd';
      var rw = 1 + rnd() * 2.4;
      x.fillRect(rnd() * S, rnd() * S, rw, rw * 0.6);
    }
    x.globalAlpha = 1;

    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  };

  /* ---------- 盒式投影 UV：让木纹有正确的尺度 ---------- */
  var UV_SCALE = 72;
  K.uvBox = function (g) {
    var pos = g.attributes.position, nor = g.attributes.normal;
    var uv = new Float32Array(pos.count * 2);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      var u, v;
      if (ay >= ax && ay >= az) { u = x; v = z; }
      else if (ax >= az) { u = z; v = y; }
      else { u = x; v = y; }
      uv[i * 2] = u / UV_SCALE;
      uv[i * 2 + 1] = v / UV_SCALE;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  };

  K.rescaleUV = function (g) {
    var uv = g.attributes.uv;
    if (!uv) return g;
    for (var i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) / UV_SCALE, uv.getY(i) / UV_SCALE);
    }
    uv.needsUpdate = true;
    return g;
  };
  /* ---------- 斗：下欹上平的方斗 ---------- */
  K.blockGeometry = function (wB, dB, wT, dT, h, flare) {
    flare = flare === undefined ? 0.45 : flare;
    var seg = 8, pos = [], idx = [], rings = [];
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var e = Math.pow(t, flare);
      var w = (wB + (wT - wB) * e) / 2;
      var d = (dB + (dT - dB) * e) / 2;
      var y = h * t;
      rings.push([[-w, y, -d], [w, y, -d], [w, y, d], [-w, y, d]]);
    }
    for (var r = 0; r < seg; r++) {
      var a = rings[r], b = rings[r + 1];
      for (var s = 0; s < 4; s++) {
        var s2 = (s + 1) % 4;
        var base = pos.length / 3;
        [a[s], a[s2], b[s2], b[s]].forEach(function (v) { pos.push(v[0], v[1], v[2]); });
        // 逆时针（外法线朝外）
        idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
      }
    }
    var top = rings[seg], tb = pos.length / 3;
    top.forEach(function (v) { pos.push(v[0], v[1], v[2]); });
    idx.push(tb, tb + 2, tb + 1, tb, tb + 3, tb + 2);
    var bot = rings[0], bb = pos.length / 3;
    bot.forEach(function (v) { pos.push(v[0], v[1], v[2]); });
    idx.push(bb, bb + 1, bb + 2, bb, bb + 2, bb + 3);

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    K.uvBox(g);
    return g;
  };

  /* ---------- 拱：两端卷杀 ---------- */
  K.gongGeometry = function (len, h, thick, cut, notch) {
    cut = cut === undefined ? Math.min(8, len * 0.14) : cut;
    var half = len / 2;
    var nw = notch ? notch.w : 0;
    var nd = notch ? notch.d : 0;
    var s = new THREE.Shape();
    s.moveTo(-half, h);
    // 顶面开槽（半榫：另一向的拱从这里穿过去）
    if (notch && notch.side === 'top') {
      s.lineTo(-nw / 2, h);
      s.lineTo(-nw / 2, h - nd);
      s.lineTo(nw / 2, h - nd);
      s.lineTo(nw / 2, h);
    }
    s.lineTo(half, h);
    s.quadraticCurveTo(half - 0.6, h * 0.18, half - cut, 0);
    // 底面开槽
    if (notch && notch.side === 'bottom') {
      s.lineTo(nw / 2, 0);
      s.lineTo(nw / 2, nd);
      s.lineTo(-nw / 2, nd);
      s.lineTo(-nw / 2, 0);
    }
    s.lineTo(-half + cut, 0);
    s.quadraticCurveTo(-half + 0.6, h * 0.18, -half, h);
    var g = new THREE.ExtrudeGeometry(s, {
      depth: thick, bevelEnabled: true, bevelThickness: 0.55,
      bevelSize: 0.55, bevelSegments: 2, curveSegments: 8
    });
    g.translate(0, 0, -thick / 2);
    g.computeVertexNormals();
    K.uvBox(g);
    return g;
  };

  /* ---------- 昂：斜出的构件，带昂尖 ----------
     先沿 X 造形（尾部厚、尖部收薄），再转到 Z 向，最后整体倾斜。 */
  K.angGeometry = function (len, h, thick, nose, notch) {
    var half = len / 2;
    var n = nose || len * 0.2;
    // notch: { w, d } —— 在昂底开一道口，让斗的斗口嵌进去（双向咬合）
    var nw = notch ? notch.w : 0;
    var nd = notch ? notch.d : 0;
    var s = new THREE.Shape();
    s.moveTo(-half, 0);
    if (nw > 0) {
      s.lineTo(-nw / 2, 0);
      s.lineTo(-nw / 2, nd);
      s.lineTo(nw / 2, nd);
      s.lineTo(nw / 2, 0);
    }
    s.lineTo(half - n, 0);
    s.lineTo(half, h * 0.5);
    s.lineTo(half - n * 0.18, h);
    s.lineTo(-half, h);
    s.lineTo(-half, 0);
    var g = new THREE.ExtrudeGeometry(s, {
      depth: thick, bevelEnabled: true, bevelThickness: 0.5,
      bevelSize: 0.5, bevelSegments: 2, curveSegments: 2
    });
    g.translate(0, 0, -thick / 2);
    g.rotateY(-Math.PI / 2);   // 长向转到 Z，昂尖朝 +Z
    g.translate(0, -h / 2, 0); // 以形心为原点
    g.computeVertexNormals();
    K.uvBox(g);
    return g;
  };

  K.ang = function (len, h, thick, nose, notch) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(K.angGeometry(len, h, thick, nose, notch), K.materials().arm));
    return g;
  };
  /* ---------- 开槽斗：顶面留一道槽，用来卡住昂 ---------- */
  K.douSlotted = function (w, d, h, slotW, slotDepth) {
    slotW = slotW || w * 0.7;
    slotDepth = slotDepth || h * 0.42;
    var g = new THREE.Group();
    var mat = K.materials().dou;
    var bodyH = h - slotDepth;

    var body = new THREE.Mesh(K.blockGeometry(w * 0.82, d * 0.82, w, d, bodyH, 0.45), mat);
    g.add(body);

    var side = (w - slotW) / 2;
    [-1, 1].forEach(function (s) {
      var b = new THREE.Mesh(K.blockGeometry(side * 0.96, d * 0.96, side, d, slotDepth, 0.8), mat);
      b.position.set(s * (slotW / 2 + side / 2), bodyH, 0);
      g.add(b);
    });
    return g;
  };
  /* ---------- 材质 ---------- */
  var MAT = null;
  K.materials = function () {
    if (MAT) return MAT;
    var m = {};

    m.dou = new THREE.MeshStandardMaterial({
      map: K.woodTexture({ base: '#8c5c2c', dark: '#3d2308', seed: 11 }),
      roughness: 0.78, metalness: 0.02, envMapIntensity: 0.16
    });
    m.gong = new THREE.MeshStandardMaterial({
      map: K.woodTexture({ base: '#9a6a33', dark: '#45280c', seed: 29 }),
      roughness: 0.82, metalness: 0.02, envMapIntensity: 0.16
    });
    m.arm = new THREE.MeshStandardMaterial({
      map: K.woodTexture({ base: '#82552b', dark: '#371f08', seed: 43 }),
      roughness: 0.84, metalness: 0.02, envMapIntensity: 0.16
    });
    // 装配虚影（蓝图感）
    m.ghost = new THREE.MeshBasicMaterial({
      color: 0x64b5ff, transparent: true, opacity: 0.075,
      depthWrite: false, side: THREE.DoubleSide
    });
    m.ghostLine = new THREE.LineBasicMaterial({
      color: 0x7cc4ff, transparent: true, opacity: 0.30
    });
    m.dust = new THREE.PointsMaterial({
      size: 0.95, color: 0xffd7a0, transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    MAT = m;
    return m;
  };

  /* ---------- 构件工厂 ---------- */
  K.ludou = function (H, W, slot) {
    H = H || 20; W = W || 32; slot = slot || 10.4;
    var g = new THREE.Group();
    var mat = K.materials().dou;
    var baseH = H * 0.5, topH = H - baseH;
    var base = new THREE.Mesh(K.blockGeometry(W * 0.76, W * 0.76, W, W, baseH, 0.42), mat);
    g.add(base);
    var corner = (W - slot) / 2;
    var off = slot / 2 + corner / 2;
    [[-off, -off], [off, -off], [off, off], [-off, off]].forEach(function (p) {
      var c = new THREE.Mesh(
        K.blockGeometry(corner * 0.94, corner * 0.94, corner, corner, topH, 0.85), mat);
      c.position.set(p[0], baseH, p[1]);
      g.add(c);
    });
    return g;
  };

  K.dou = function (w, d, h) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(
      K.blockGeometry(w * 0.82, d * 0.82, w, d, h, 0.45), K.materials().dou));
    return g;
  };

  K.gong = function (len, h, thick, cut, notch) {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(K.gongGeometry(len, h, thick, cut, notch), K.materials().gong));
    return g;
  };

  global.KIT = K;
})(window);










