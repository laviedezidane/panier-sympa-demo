/* Logo en particules lumineuses : hero (#hl) et section signature (#sg).
   Rendu WebGL (points additifs, un seul appel de dessin), repli Canvas 2D si WebGL est absent.
   Physique à pas fixe (1/60 s) : même vitesse quelle que soit la cadence d'affichage.
   Les points viennent de logo-pts.js (millièmes de largeur), aucune image n'est chargée. */
(function () {
  'use strict';
  var data = window.LOGO_PTS;
  if (!data) return;
  var STILL = /[?&]still\b/.test(location.search);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP = 1 / 60;
  var COL = [[246, 241, 231], [167, 227, 172], [231, 92, 72]];                 // ivoire, menthe, braise (rouge de marque, rare)

  var VS = 'attribute vec2 p;attribute float s;attribute vec4 c;uniform vec2 r;uniform float k;varying vec4 v;' +
    'void main(){vec2 q=p/r*2.0-1.0;gl_Position=vec4(q.x,-q.y,0.0,1.0);gl_PointSize=s*k;v=c;}';
  var FS = 'precision mediump float;varying vec4 v;void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;' +
    'float g=pow(1.0-d,2.0);gl_FragColor=vec4(v.rgb*v.a*g,v.a*g);}';

  function shader(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }

  function sprite(rgb) {                                                          // repli 2D uniquement
    var s = 40, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.2, 'rgba(' + rgb + ',0.8)'); gr.addColorStop(0.55, 'rgba(' + rgb + ',0.15)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
  }

  function create(cv, host, mode) {
    var hero = mode === 'hero';
    var small = window.matchMedia && matchMedia('(max-width: 760px)').matches;
    var skip = small ? 3 : 1;                                                      // moins de particules sur téléphone
    var raw = data.p, hx0 = [], hy0 = [];
    for (var k = 0, n = 0; k + 1 < raw.length; k += 2, n++) {
      if (n % skip) continue;
      hx0.push(raw[k] / 1000 + (Math.random() - 0.5) * 0.0035);                    // léger bruit : pas de trame visible
      hy0.push(raw[k + 1] / 1000 + (Math.random() - 0.5) * 0.0035);
    }
    var N = hx0.length, DUST = small ? 60 : 160, MAXV = N * 3 + DUST;

    // ---- rendu
    var gl = null, prog = null, buf = null, loc = {}, ctx2 = null, SP = null;
    try {
      gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
      if (gl) {
        var vs = shader(gl, gl.VERTEX_SHADER, VS), fs = shader(gl, gl.FRAGMENT_SHADER, FS);
        prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) gl = null;
      }
    } catch (e) { gl = null; }
    if (gl) {
      gl.useProgram(prog); buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      loc.p = gl.getAttribLocation(prog, 'p'); loc.s = gl.getAttribLocation(prog, 's'); loc.c = gl.getAttribLocation(prog, 'c');
      loc.r = gl.getUniformLocation(prog, 'r'); loc.k = gl.getUniformLocation(prog, 'k');
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clearColor(0, 0, 0, 0);
    } else {
      ctx2 = cv.getContext('2d'); SP = [sprite('246,241,231'), sprite('167,227,172'), sprite('231,92,72')];
    }
    var VB = new Float32Array(MAXV * 7), count = 0;

    // ---- halo (élément CSS, ne passe pas par le canvas)
    var halo = document.createElement('div');
    halo.setAttribute('aria-hidden', 'true');
    halo.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;will-change:transform,opacity;' +
      'background:radial-gradient(circle,rgba(120,210,135,.34) 0%,rgba(46,125,50,.16) 42%,rgba(46,125,50,0) 70%)';
    host.insertBefore(halo, cv);

    // ---- état des particules (tableaux typés)
    var X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N), HX = new Float32Array(N), HY = new Float32Array(N),
      U = new Float32Array(N), D = new Float32Array(N), Z = new Float32Array(N), S = new Float32Array(N), A = new Float32Array(N), PH = new Float32Array(N), C = new Uint8Array(N);
    var dust = [];
    for (var i = 0; i < N; i++) {
      var r1 = Math.random(); D[i] = Math.random(); Z[i] = Math.random(); S[i] = 0.4 + Math.random() * 0.9; A[i] = 0.5 + Math.random() * 0.5; PH[i] = Math.random() * 6.283;
      C[i] = r1 < 0.04 ? 2 : ((hx0[i] + hy0[i] * 0.6) % 1 > 0.55 ? 1 : 0);
    }
    for (var j = 0; j < DUST; j++) dust.push({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, v: 4 + Math.random() * 10, a: 0.12 + Math.random() * 0.25 });

    var W = 0, H = 0, dpr = 1, scale = 1, cx = 0, cy = 0, portrait = false, placed = false;
    var st = 0, acc = 0, last = 0, raf = 0;
    var running = !reduce && !STILL, visible = hero, started = hero;
    var ptr = { x: -9999, y: -9999, on: false, idle: 99, nx: 0, ny: 0 }, tgt = { x: 0, y: 0 };
    var scrollP = 0, waves = [], gs = 1;

    function layout() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      portrait = W < 760 && H > W * 0.9;
      if (hero) {
        scale = portrait ? W * 0.42 : Math.min(W * 0.36, H * 0.68 / data.ar);
        cx = portrait ? W * 0.5 : W * 0.77; cy = portrait ? H * 0.185 : H * 0.4;
      } else {
        scale = portrait ? W * 0.56 : Math.min(W * 0.36, H * 0.66 / data.ar);
        cx = portrait ? W * 0.5 : W * 0.28; cy = portrait ? H * 0.3 : H * 0.5;
      }
      var ox = cx - scale / 2, oy = cy - scale * data.ar / 2;
      for (var i = 0; i < N; i++) {
        HX[i] = ox + hx0[i] * scale; HY[i] = oy + hy0[i] * scale; U[i] = hx0[i] * 0.7 + hy0[i] / data.ar * 0.3;
        if (!placed) {                                                             // départ éparpillé, l'arrivée se fait en spirale
          var a = Math.random() * 6.283, dd = Math.max(W, H) * (0.35 + Math.random() * 0.5);
          X[i] = cx + Math.cos(a) * dd; Y[i] = cy + Math.sin(a) * dd;
        }
      }
      placed = true;
      var hr = scale * 1.05; halo.style.width = halo.style.height = hr * 2 + 'px'; halo.dataset.r = hr;
    }
    function settle() { for (var i = 0; i < N; i++) { X[i] = HX[i]; Y[i] = HY[i]; VX[i] = VY[i] = 0; } st = 6; }

    // ---- physique, pas fixe
    function step(dt) {
      st += dt; var t = st;
      ptr.idle += dt;
      var ghost = !ptr.on || ptr.idle > 2.6, px = ptr.x, py = ptr.y;
      gs = 0;
      if (ghost && t > 2.6) {                                                      // point fantôme : le logo bouge même sans curseur (téléphone)
        var ph = t * 0.55; gs = 1;
        px = cx + scale * 0.62 * Math.sin(ph); py = cy + scale * data.ar * 0.42 * Math.sin(ph * 1.37 + 0.8);
      }
      var R = Math.max(90, scale * 0.34), R2 = R * R;
      var tx = ptr.on ? (ptr.x / W - 0.5) : Math.sin(t * 0.3) * 0.25, ty = ptr.on ? (ptr.y / H - 0.5) : Math.cos(t * 0.27) * 0.2;
      var kk = 1 - Math.exp(-dt * 3); ptr.nx += (tx - ptr.nx) * kk; ptr.ny += (ty - ptr.ny) * kk;
      for (var w = waves.length - 1; w >= 0; w--) { waves[w].r += 900 * dt; if (waves[w].r > Math.max(W, H)) waves.splice(w, 1); }
      var out = scrollP * scale * 1.3, pull = t < 2.4 ? 10 : 7, par = scale * 0.06, damp = Math.pow(0.0012, dt), spiral = t < 3 ? Math.max(0, 1 - t / 3) * 2.2 : 0;
      var nw = waves.length;
      for (var i = 0; i < N; i++) {
        if (t < D[i] * 1.1) continue;
        var hx = HX[i] + Math.sin(t * 0.9 + PH[i]) * 1.1 + ptr.nx * par * (Z[i] - 0.5) * 2;
        var hy = HY[i] + Math.cos(t * 0.8 + PH[i] * 1.3) * 1.1 + ptr.ny * par * (Z[i] - 0.5) * 2;
        if (scrollP > 0) { var ex = hx - cx, ey = hy - cy, el = Math.sqrt(ex * ex + ey * ey) || 1; hx += ex / el * out * (0.4 + D[i]); hy += ey / el * out * (0.4 + D[i]); }
        var x = X[i], y = Y[i], vx = VX[i], vy = VY[i];
        var ax = hx - x, ay = hy - y;
        vx += ax * pull * dt; vy += ay * pull * dt;
        if (spiral) { vx += -ay * spiral * dt * 3; vy += ax * spiral * dt * 3; }
        var dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          var d = Math.sqrt(d2), f = 1 - d / R; f = f * f * (gs ? 900 : 2100) * dt;
          vx += dx / d * f + (-dy / d) * f * 0.7; vy += dy / d * f + (dx / d) * f * 0.7;   // repousse et fait tourner
        }
        for (var q = 0; q < nw; q++) {
          var wv = waves[q], wx = x - wv.x, wy = y - wv.y, wd = Math.sqrt(wx * wx + wy * wy) || 1, band = Math.abs(wd - wv.r);
          if (band < 70) { var wf = (1 - band / 70) * 3400 * dt * (1 - wv.r / Math.max(W, H)); vx += wx / wd * wf; vy += wy / wd * wf; }
        }
        vx *= damp; vy *= damp; VX[i] = vx; VY[i] = vy; X[i] = x + vx * dt; Y[i] = y + vy * dt;
      }
    }

    // ---- remplissage du tampon puis dessin
    function put(x, y, s, c, a) { var o = count * 7; VB[o] = x; VB[o + 1] = y; VB[o + 2] = s; VB[o + 3] = COL[c][0] / 255; VB[o + 4] = COL[c][1] / 255; VB[o + 5] = COL[c][2] / 255; VB[o + 6] = a; count++; }
    function render() {
      var t = st; count = 0;
      var sweep = ((t * 0.32) % 2.4) - 0.7, fade = 1 - scrollP * 1.1;
      for (var j = 0; j < DUST; j++) {
        var q = dust[j]; q.y -= q.v * STEP / H; if (q.y < -0.02) { q.y = 1.02; q.x = Math.random(); }
        put(q.x * W - ptr.nx * 40 * q.z, q.y * H, 2.5 + q.z * 3, q.z > 0.7 ? 1 : 0, q.a * Math.max(0, fade));
      }
      if (fade > 0) {
        for (var i = 0; i < N; i++) {
          var vx = VX[i], vy = VY[i], spd = Math.sqrt(vx * vx + vy * vy);
          var g = Math.exp(-Math.pow((U[i] - sweep) / 0.07, 2));                    // bande lumineuse
          var al = Math.min(1, A[i] * (0.7 + 0.5 * g + Math.min(0.5, spd / 260)) * fade * 0.85);
          if (al <= 0.01) continue;
          var sz = 2.3 + S[i] * 1.5 + g * 2.4 + Math.min(3, spd / 80), c = (g > 0.5 && C[i] === 0) ? 1 : C[i];
          put(X[i], Y[i], sz, c, al);
          if (spd > 90) { put(X[i] - vx * 0.035, Y[i] - vy * 0.035, sz * 0.7, C[i], al * 0.45); put(X[i] - vx * 0.07, Y[i] - vy * 0.07, sz * 0.5, C[i], al * 0.22); }
        }
      }
      // halo : respire, éclat léger quand on touche le logo
      var breathe = 0.5 + 0.5 * Math.sin(t * 0.9), hr = parseFloat(halo.dataset.r) || 1;
      halo.style.opacity = (Math.max(0, 1 - scrollP) * (0.7 + 0.3 * breathe)).toFixed(3);
      halo.style.transform = 'translate(' + (cx - hr).toFixed(1) + 'px,' + (cy - hr).toFixed(1) + 'px) scale(' + (0.96 + 0.08 * breathe).toFixed(3) + ')';
      if (gl) {
        gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, VB.subarray(0, count * 7), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 28, 0);
        gl.enableVertexAttribArray(loc.s); gl.vertexAttribPointer(loc.s, 1, gl.FLOAT, false, 28, 8);
        gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 4, gl.FLOAT, false, 28, 12);
        gl.uniform2f(loc.r, W, H); gl.uniform1f(loc.k, dpr);
        gl.drawArrays(gl.POINTS, 0, count);
      } else {
        ctx2.setTransform(dpr, 0, 0, dpr, 0, 0); ctx2.clearRect(0, 0, W, H); ctx2.globalCompositeOperation = 'lighter';
        for (var m = 0; m < count; m += 1) {
          var o = m * 7, cc = VB[o + 3] > 0.9 && VB[o + 5] < 0.5 ? 2 : (VB[o + 3] < 0.7 ? 1 : 0), s2 = VB[o + 2] * 2.2;
          ctx2.globalAlpha = Math.min(1, VB[o + 6]); ctx2.drawImage(SP[cc], VB[o] - s2 / 2, VB[o + 1] - s2 / 2, s2, s2);
        }
        ctx2.globalAlpha = 1; ctx2.globalCompositeOperation = 'source-over';
      }
    }

    function active() { return running && visible; }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!active()) { last = now; return; }
      var real = Math.min(4, (now - last) / 1000 || STEP); last = now;
      acc += real; var n = 0;
      while (acc >= STEP && n < 240) { step(STEP); acc -= STEP; n++; }
      if (n === 240) acc = 0;
      render();
    }
    function still() { settle(); render(); }

    layout();
    if (!running) { still(); }
    else {
      render();                                                                    // première image : nuage éparpillé, pas de page vide
      last = performance.now(); raf = requestAnimationFrame(loop);
    }
    window.addEventListener('resize', function () { layout(); if (!running) still(); else render(); });
    host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; ptr.idle = 0; }, { passive: true });
    host.addEventListener('pointerleave', function () { ptr.on = false; ptr.x = ptr.y = -9999; });
    host.addEventListener('pointerdown', function (e) {
      if (!running || (e.target.closest && e.target.closest('a,button'))) return;
      var r = host.getBoundingClientRect(); waves.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0 });
    });
    if (hero) {
      window.addEventListener('scroll', function () { scrollP = Math.max(0, Math.min(1, window.scrollY / (H * 0.9))); visible = window.scrollY < H; }, { passive: true });
      var ctl = document.getElementById('vctl');                                   // bouton pause (accessibilité)
      if (ctl) {
        if (reduce) ctl.hidden = true;
        var label = function () { ctl.textContent = running ? 'Pause' : 'Lecture'; ctl.setAttribute('aria-label', running ? "Mettre l'animation en pause" : "Relancer l'animation"); };
        label();
        ctl.addEventListener('click', function () { running = !running; if (running) last = performance.now(); label(); });
      }
    } else if (running && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible && !started) { started = true; st = 0; } }, { threshold: 0.25 }).observe(host);
    } else { visible = true; started = true; }
  }

  var hl = document.getElementById('hl'), hero = document.getElementById('hero');
  if (hl && hero) create(hl, hero, 'hero');
  var sg = document.getElementById('sg'), sec = sg && sg.parentNode;
  if (sg && sec) create(sg, sec, 'section');
})();

