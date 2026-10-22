/* 页面动效（原生实现，思路参考 React Bits：Spotlight / Tilt / Glare / Star Border / Particles）
   不引入 React 构建链，全部用 CSS + 少量 JS 实现。 */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 聚光 + 倾斜 + 反光 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.spot'), function (card) {
    if (!card.querySelector(':scope > .glare')) {
      var g = document.createElement('i');
      g.className = 'glare';
      card.appendChild(g);
    }
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100) + '%');
      card.style.setProperty('--my', (py * 100) + '%');
      card.style.setProperty('--gx', (px * 100) + '%');
      card.style.setProperty('--gy', (py * 100) + '%');
      if (!reduce) {
        var rx = (0.5 - py) * 5;
        var ry = (px - 0.5) * 6;
        card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-3px)';
      }
    });
    card.addEventListener('pointerleave', function () {
      card.style.transform = '';
    });
  });

  /* ---------- 进场 ---------- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal, .section h2, .section .head'));
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------- 导航 ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('solid', window.scrollY > 24);
      var bg = document.getElementById('bgPhoto');
      if (bg && !reduce) bg.style.setProperty('--py', Math.min(window.scrollY * 0.16, 120) + 'px');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 数字滚动 ---------- */
  function countUp(el) {
    var to = parseFloat(el.dataset.to || '0');
    var dec = parseInt(el.dataset.dec || '0', 10);
    var dur = 1200, t0 = performance.now();
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  var nums = Array.prototype.slice.call(document.querySelectorAll('[data-to]'));
  if (nums.length && 'IntersectionObserver' in window) {
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { countUp(en.target); io2.unobserve(en.target); }
      });
    }, { threshold: .35 });
    nums.forEach(function (n) { io2.observe(n); });
  } else {
    nums.forEach(countUp);
  }

  /* ---------- 条形图 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.track i'), function (bar, i) {
    var w = bar.dataset.w || '0';
    setTimeout(function () { bar.style.width = w + '%'; }, 140 + i * 70);
  });

  /* ---------- 磁吸按钮 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.btn'), function (b) {
    b.addEventListener('pointermove', function (e) {
      if (reduce) return;
      var r = b.getBoundingClientRect();
      var dx = (e.clientX - r.left - r.width / 2) / r.width;
      var dy = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.transform = 'translate(' + (dx * 4).toFixed(2) + 'px,' + (dy * 3).toFixed(2) + 'px)';
    });
    b.addEventListener('pointerleave', function () { b.style.transform = ''; });
  });

  /* ---------- 浮尘粒子 ---------- */
  var cv = document.getElementById('dust');
  if (cv && !reduce) {
    var ctx = cv.getContext('2d');
    var dots = [];
    function size() {
      cv.width = window.innerWidth * devicePixelRatio;
      cv.height = window.innerHeight * devicePixelRatio;
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
    }
    size();
    window.addEventListener('resize', size);
    for (var i = 0; i < 46; i++) {
      dots.push({
        x: Math.random(), y: Math.random(),
        r: 0.4 + Math.random() * 1.3,
        v: 0.00006 + Math.random() * 0.00016,
        a: 0.12 + Math.random() * 0.35,
        p: Math.random() * 6.28
      });
    }
    var t = 0;
    (function loop() {
      t += 1;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var k = 0; k < dots.length; k++) {
        var d = dots[k];
        d.y -= d.v;
        if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        var x = (d.x + Math.sin(t * 0.002 + d.p) * 0.006) * cv.width;
        var y = d.y * cv.height;
        ctx.beginPath();
        ctx.arc(x, y, d.r * devicePixelRatio, 0, 6.2832);
        ctx.fillStyle = 'rgba(243,208,154,' + (d.a * (0.6 + 0.4 * Math.sin(t * 0.01 + d.p))).toFixed(3) + ')';
        ctx.fill();
      }
      requestAnimationFrame(loop);
    })();
  }
})();
