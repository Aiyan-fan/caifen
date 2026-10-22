/* ==========================================================================
   铺作定义 · 参数化生成
   params: { preset, chu, gongScale, kou, zucai }
   ========================================================================== */
(function (global) {
  'use strict';

  var PRESETS = [
    { id: 'dousan', name: '一斗三升', sub: 'DOU · SAN SHENG', level: '入门',
      desc: '最基础的一朵：一栌斗、一泥道拱、三只小斗。所有斗拱的起点。' },
    { id: 'shizi', name: '十字科', sub: 'CROSS · BRACKET', level: '基础',
      desc: '栌斗开十字口，纵横两向的拱交叠，荷载在此转向，并开始向外出跳。' },
    { id: 'chonggong', name: '重拱', sub: 'DOUBLE · TIER', level: '进阶',
      desc: '在十字科上叠瓜子拱、慢拱、令拱，把受力面一层层拉宽。' }
  ];

  var INFO = {
    ludou: {
      name: '栌斗', qing: '坐斗 / 大斗',
      role: '整朵斗拱之基。坐在柱头或普拍枋上，四面开十字口，承托纵横两向的拱，把上部荷载向下归拢到柱身。',
      tip: '开口朝上的十字槽，是整朵斗拱的定位基准。'
    },
    nidaogong: {
      name: '泥道拱', qing: '正心瓜拱',
      role: '沿墙面方向（X 向）的第一层横拱，两端卷杀。它把栌斗两肩连成一条横向的“扁担”，是正心缝上的第一道横向构件。',
      tip: '两端要落散斗，所以先装拱、再装斗。'
    },
    huagong: {
      name: '华拱', qing: '翘',
      role: '垂直于墙面（Z 向）外跳出跳的拱，是斗拱“挑檐”的关键：每出一跳，屋檐就向外多探出一段，把出檐重量层层传回柱心。',
      tip: '它是这朵斗拱里唯一向外出跳的构件，从正前方推入。'
    },
    sandou: {
      name: '散斗', qing: '三才升',
      role: '置于拱端的承托斗。它把拱端的集中力摊开成面，同时给上层拱一个准确的落位高度——斗拱之所以能“叠”起来，靠的就是这些斗。',
      tip: '三只斗必须共面，缺一只，上层拱就会倾侧。'
    },
    qixindou: {
      name: '齐心斗', qing: '槽升子',
      role: '位于拱心正中的小斗，与两端散斗三点共面，保证上层构件受力均衡、不倾侧。',
      tip: '它在正中心，是“齐心”二字的由来。'
    },
    jiaohudou: {
      name: '交互斗', qing: '十八斗',
      role: '正心缝上承托上层横拱的斗，比散斗略大。它把华拱、瓜子拱与正心缝三层构件连接在同一条竖轴上。',
      tip: '它坐在华拱正中，上面要压瓜子拱。'
    },
    guazigong: {
      name: '瓜子拱', qing: '瓜拱',
      role: '第二层横拱，比泥道拱长。它坐在正心交互斗上向两侧挑出，承托慢拱，是“重拱”体系的第一级扩展。',
      tip: '比泥道拱长，推入时要越过两侧散斗。'
    },
    mangong: {
      name: '慢拱', qing: '万拱',
      role: '第三层横拱，最长的一道。它坐在瓜子拱两端的散斗上，把受力面进一步拉宽，是重拱体系的最外一圈横构件。',
      tip: '最长、最重，最后装。'
    },
    ang: {
      name: '下昂', qing: '昂',
      role: '斗拱里唯一斜着伸出的构件。昂尾压在梁下、昂尖向外挑出，用杠杆的方式把屋檐挑得更远，同时压低屋檐高度——它决定了屋檐的坡度与气势。',
      tip: '斜着推进去，昂背要压住跳头斗。'
    },
    linggong: {
      name: '令拱', qing: '厢拱',
      role: '位于跳头（华拱外端）的横拱，承托撩檐枋。它把出跳端的集中荷载横向摊开，是“出跳”与“屋面”之间的转换件。',
      tip: '装在跳头散斗之上，方向与泥道拱相同。'
    }
  };

  function build(p) {
    p = p || {};
    var preset = p.preset || 'shizi';
    var chu = Math.max(22, Math.min(38, p.chu || 30));
    var gs = p.gongScale || 1;
    var kou = p.kou || 10;
    var gh = p.zucai ? 21 : 15;
    var th = 10;
    var douH = 10;
    var baseH = 20;

    var L_md = Math.round(62 * gs);
    var L_hg = Math.round(2 * (chu + 6));
    var L_gz = Math.round(92 * gs);
    var L_mg = Math.round(102 * gs);
    var L_lg = Math.round(72 * gs);

    var ySlot = kou + 0.3;                  // 两向拱同高，在栌斗十字口内交叠
    var yMdTop = ySlot + gh;
    var yHg = ySlot;
    var yHgTop = ySlot + gh;
    var yGz = yHgTop + douH;
    var yGzTop = yGz + gh;
    var yMg = yGzTop + douH;
    var zHead = Math.round(L_hg / 2 - 11);

    var list = [];
    function add(o) { list.push(o); return o; }

    add({
      id: 'ludou', type: 'ludou', mat: 'dou', label: '栌斗',
      build: function () { return KIT.ludou(baseH, 32, th + 3.2); },
      pos: [0, 0, 0], axis: [0, 1, 0], off: 92, deps: [], h: baseH,
      spec: '长广各 32 分 · 高 20 分 · 十字口'
    });

    add({
      id: 'nidaogong', type: 'nidaogong', mat: 'gong', label: '泥道拱',
      build: function () { return KIT.gong(L_md, gh, th, 7, { side: 'top', w: 13.5, d: gh / 2 + 0.9 }); },
      pos: [0, ySlot, 0], axis: [1, 0, 0], off: Math.round(L_md * 0.64), deps: ['ludou'], h: gh,
      spec: '长 ' + L_md + ' 分 · 广 ' + gh + ' 分 · 厚 ' + th
    });

    var xEnd = Math.round(L_md / 2 - 12);
    [-1, 1].forEach(function (s, i) {
      add({
        id: 'sandou_x' + i, type: 'sandou', mat: 'arm', label: '散斗 · ' + (i ? '右' : '左'),
        build: function () { return KIT.dou(16, 14, douH); },
        pos: [s * xEnd, yMdTop, 0], axis: [0, 1, 0], off: 56, deps: ['nidaogong'], h: douH,
        spec: '长 16 分 · 广 14 分 · 高 10 分'
      });
    });

    if (preset === 'dousan') {
      add({
        id: 'qixindou', type: 'qixindou', mat: 'arm', label: '齐心斗',
        build: function () { return KIT.dou(16, 16, douH); },
        pos: [0, yMdTop, 0], axis: [0, 1, 0], off: 64, deps: ['nidaogong'], h: douH,
        spec: '长广各 16 分 · 高 10 分'
      });
      return finalize(list, p);
    }

    add({
      id: 'huagong', type: 'huagong', mat: 'gong', label: '华拱',
      build: function () { return KIT.gong(L_hg, gh, th, 7, { side: 'bottom', w: 13.5, d: gh / 2 - 0.9 }); },
      pos: [0, yHg, 0], axis: [0, 0, 1], off: Math.round(L_hg * 0.62), deps: ['nidaogong'], h: gh,
      rot: [0, Math.PI / 2, 0],
      spec: '长 ' + L_hg + ' 分 · 广 ' + gh + ' 分 · 厚 ' + th
    });

    [-1, 1].forEach(function (s, i) {
      add({
        id: 'sandou_z' + i, type: 'sandou', mat: 'arm', label: '散斗 · 跳头' + (i ? '内' : '外'),
        build: function () { return s > 0 ? KIT.douSlotted(16, 14, douH, 12, 4.5) : KIT.dou(16, 14, douH); },
        pos: [0, yHgTop, s * zHead], axis: [0, 1, 0], off: 68, deps: ['huagong'], h: douH,
        spec: '长 16 分 · 广 14 分 · 高 10 分'
      });
    });

    add({
      id: 'jiaohudou', type: 'jiaohudou', mat: 'arm', label: '交互斗',
      build: function () { return KIT.dou(18, 18, douH); },
      pos: [0, yHgTop, 0], axis: [0, 1, 0], off: 72, deps: ['huagong'], h: douH,
      spec: '长广各 18 分 · 高 10 分'
    });

    /* ---- 下昂：压在跳头斗上，斜着挑出屋檐 ---- */
    add({
      id: 'ang', type: 'ang', mat: 'arm', label: '下昂',
      build: function () { return KIT.ang(70, 15, 11, 18, { w: 22, d: 5.8 }); },
      pos: [0, yHgTop + douH + 0.4, zHead], axis: [0, 0, 1], off: 104,
      deps: ['sandou_z1'], h: 15,
      rot: [0.30, 0, 0],
      spec: '长 70 分 · 广 15 分 · 厚 11 分 · 斜下 17°'
    });
    if (preset === 'shizi') return finalize(list, p);

    add({
      id: 'guazigong', type: 'guazigong', mat: 'gong', label: '瓜子拱',
      build: function () { return KIT.gong(L_gz, gh, th, 8); },
      pos: [0, yGz, 0], axis: [1, 0, 0], off: Math.round(L_gz * 0.70), deps: ['jiaohudou'], h: gh,
      spec: '长 ' + L_gz + ' 分 · 广 ' + gh + ' 分 · 厚 ' + th
    });

    var xGz = Math.round(L_gz / 2 - 13);
    [-1, 1].forEach(function (s, i) {
      add({
        id: 'sandou_g' + i, type: 'sandou', mat: 'arm', label: '散斗 · 瓜子拱' + (i ? '右' : '左'),
        build: function () { return KIT.dou(16, 14, douH); },
        pos: [s * xGz, yGzTop, 0], axis: [0, 1, 0], off: 60, deps: ['guazigong'], h: douH,
        spec: '长 16 分 · 广 14 分 · 高 10 分'
      });
    });

    add({
      id: 'linggong', type: 'linggong', mat: 'gong', label: '令拱',
      build: function () { return KIT.gong(L_lg, gh, th, 8); },
      pos: [0, yHgTop + douH, zHead], axis: [1, 0, 0], off: Math.round(L_lg * 0.68), deps: ['sandou_z1'], h: gh,
      spec: '长 ' + L_lg + ' 分 · 广 ' + gh + ' 分 · 厚 ' + th
    });

    return finalize(list, p);
  }

  function finalize(list, p) {
    list.forEach(function (it, i) {
      var info = INFO[it.type];
      it.name = it.label || info.name;
      it.qing = info.qing;
      it.role = info.role;
      it.tip = info.tip;
      it.index = i;
      // 装配间隙：斗与拱、昂与斗之间留 0.4 分，避免贴合面被判定为侵入
      if (it.type === 'sandou' || it.type === 'jiaohudou' || it.type === 'qixindou') it.pos[1] += 0.4;
      // 竖向拆开距离收一点，避免构件飞出取景框
      if (it.axis && it.axis[1]) it.off = 20 + i * 5;
    });
    var preset = PRESETS.filter(function (x) { return x.id === (p.preset || 'shizi'); })[0];
    return { pieces: list, preset: preset, params: p };
  }

  global.GRADES = { PRESETS: PRESETS, INFO: INFO, build: build };
})(window);
































