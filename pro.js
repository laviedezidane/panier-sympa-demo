(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var qs = location.search;
  var STILL = /[?&]still\b/.test(qs);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Aperçu d'une section seule (captures d'écran) : ?only=rayons ----------
  var ov = /[?&]only=([a-z-]+)/.exec(qs);
  if (ov && document.getElementById(ov[1])) {
    var keep = document.getElementById(ov[1]);
    for (var anc = keep; anc && anc !== document.body; anc = anc.parentNode) {
      [].slice.call(anc.parentNode.children).forEach(function (n) {
        if (n !== anc && n.id !== 'header' && n.tagName !== 'SCRIPT') n.style.display = 'none';
      });
    }
  }

  // Le logo en particules du hero est géré par hero-logo.js (canvas, bouton pause compris).

  // ---------- En-tête : devient opaque après le hero ----------
  var header = $('#header');
  var onScroll = function () {
    header.classList.toggle('solid', window.scrollY > 40);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var prog = $('#progress');
    if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    pastHero = window.scrollY > window.innerHeight * 0.7; refreshCta();
  };
  var pastHero = false, hidden = 0;
  var cta = $('#cta-fixed');
  var refreshCta = function () { if (cta) cta.classList.toggle('on', pastHero && hidden === 0); };
  window.addEventListener('scroll', onScroll, { passive: true });
  if ('IntersectionObserver' in window) {
    ['appel', 'contact'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var was = false;
      new IntersectionObserver(function (e) {
        var now = e[0].isIntersecting; if (now !== was) { hidden += now ? 1 : -1; was = now; refreshCta(); }
      }, { threshold: 0.2 }).observe(el);
    });
  }

  // ---------- Statut d'ouverture réel (heure de Paris), horaires de la fiche Google ----------
  // dimanche 9h-22h, lundi à mercredi 8h-22h, jeudi à samedi 8h-23h
  var HOURS = { 0: [9, 22], 1: [8, 22], 2: [8, 22], 3: [8, 22], 4: [8, 23], 5: [8, 23], 6: [8, 23] };
  var parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  var o = {}; parts.forEach(function (x) { o[x.type] = x.value; });
  var dayMap = { 'dim.': 0, 'lun.': 1, 'mar.': 2, 'mer.': 3, 'jeu.': 4, 'ven.': 5, 'sam.': 6 };
  var hour = parseInt(o.hour, 10) % 24, day = dayMap[o.weekday];
  var today_h = HOURS[day], tomorrow_h = HOURS[(day + 1) % 7];
  var isOpen = hour >= today_h[0] && hour < today_h[1];
  $$('.status').forEach(function (st) {
    var span = st.querySelector('span');
    if (isOpen) { span.textContent = 'Ouvert maintenant, jusqu’à ' + today_h[1] + 'h'; }
    else {
      st.classList.add('closed');
      span.textContent = hour < today_h[0] ? 'Fermé pour le moment, ouvre à ' + today_h[0] + 'h' : 'Fermé pour le moment, ouvre demain à ' + tomorrow_h[0] + 'h';
    }
  });
  var today = $('#hours li[data-d="' + day + '"]'); if (today) today.classList.add('today');

  // ---------- Vidéos en boucle décoratives : pause hors écran et respect du mouvement réduit ----------
  $$('.loopvid').forEach(function (vd) {
    var lb = document.createElement('button'); lb.type = 'button'; lb.className = 'rc lv-ctl';
    lb.setAttribute('aria-controls', vd.id || ''); if (!vd.id) { vd.id = 'loop-video-' + Math.random().toString(36).slice(2, 8); lb.setAttribute('aria-controls', vd.id); }
    var userPaused = false, visible = true, motion = matchMedia('(prefers-reduced-motion: reduce)');
    function sync() {
      var playing = !vd.paused;
      lb.textContent = playing ? 'Pause' : 'Lecture';
      lb.setAttribute('aria-label', playing ? 'Mettre la vidéo en pause' : 'Relancer la vidéo');
    }
    function playIfAllowed() {
      if (userPaused || !visible) { vd.pause(); return; }
      if (motion.matches) return;
      var p = vd.play(); if (p && p.catch) p.catch(function () { sync(); });
    }
    lb.addEventListener('click', function () {
      if (!vd.paused) { userPaused = true; vd.pause(); }
      else { userPaused = false; var p = vd.play(); if (p && p.catch) p.catch(function () { sync(); }); }
      sync();
    });
    if (vd.parentNode) vd.parentNode.appendChild(lb);
    vd.addEventListener('play', sync); vd.addEventListener('pause', sync);
    if (motion.matches) { vd.removeAttribute('autoplay'); vd.pause(); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; playIfAllowed(); }, { threshold: 0.2 }).observe(vd);
    } else { playIfAllowed(); }
    var onMotionChange = function () { if (motion.matches) vd.pause(); else playIfAllowed(); };
    if (motion.addEventListener) motion.addEventListener('change', onMotionChange); else if (motion.addListener) motion.addListener(onMotionChange);
    sync();
  });
  // ---------- Vidéo motion : 16:9 sur ordinateur, 9:16 sur téléphone, lecture automatique sans son ----------
  var rv0 = $('#reel-v');
  if (rv0) {
    var rframe = $('#reel-frame'), rctl = $('#reel-ctl'), rplay = $('#reel-play'), rsnd = $('#reel-snd');
    var phone = matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
    var applySrc = function (v) {
      rv0.poster = v ? rv0.dataset.posterV : rv0.dataset.posterH;
      rv0.src = v ? rv0.dataset.srcV : rv0.dataset.srcH;
      rframe.classList.toggle('is-v', v);
    };
    applySrc(phone);
    rctl.hidden = false;
    var lab = function () {
      var playing = !rv0.paused;
      rplay.textContent = playing ? 'Pause' : 'Lecture';
      rplay.setAttribute('aria-label', playing ? 'Mettre la vidéo en pause' : 'Lancer la vidéo');
      rsnd.setAttribute('aria-pressed', String(!rv0.muted));
      rsnd.setAttribute('aria-label', rv0.muted ? 'Activer le son' : 'Couper le son');
      rsnd.textContent = rv0.muted ? 'Activer le son' : 'Couper le son';
    };
    var userPaused = false, motionPref = matchMedia('(prefers-reduced-motion: reduce)');
    var tryPlay = function () {
      var pr = rv0.play();
      if (pr && pr.catch) pr.catch(function () { rv0.controls = true; lab(); });
    };
    if (!motionPref.matches && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { if (!userPaused && !motionPref.matches) tryPlay(); } else rv0.pause();
      }, { threshold: 0.4 }).observe(rv0);
    } else if (!motionPref.matches) { tryPlay(); }
    var onMotionPrefChange = function () { if (motionPref.matches) rv0.pause(); else if (!userPaused) tryPlay(); };
    if (motionPref.addEventListener) motionPref.addEventListener('change', onMotionPrefChange); else if (motionPref.addListener) motionPref.addListener(onMotionPrefChange);
    rplay.addEventListener('click', function () { if (rv0.paused) { userPaused = false; tryPlay(); } else { userPaused = true; rv0.pause(); } lab(); });
    rsnd.addEventListener('click', function () { rv0.muted = !rv0.muted; if (!rv0.muted && rv0.paused) { userPaused = false; tryPlay(); } lab(); });
    rv0.addEventListener('play', lab); rv0.addEventListener('pause', lab);
    // changement d'orientation ou de taille : conserver la position et respecter une pause utilisateur pendant le rechargement
    var mq = matchMedia('(max-width: 760px) and (orientation: portrait)'), sourceVersion = 0;
    var onMq = function () {
      if (mq.matches !== rframe.classList.contains('is-v')) {
        var t = rv0.currentTime, was = !rv0.paused, version = ++sourceVersion;
        applySrc(mq.matches);
        rv0.addEventListener('loadedmetadata', function f() {
          rv0.removeEventListener('loadedmetadata', f);
          if (version !== sourceVersion) return;
          try { rv0.currentTime = Math.max(0, Math.min(t, (rv0.duration || t) - 0.1)); } catch (e) {}
          if (was && !userPaused && !motionPref.matches) tryPlay();
        });
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    lab();
  }
  // ---------- Carte Google : chargée après un clic seulement ----------
  var mapBtn = $('#map-load');
  if (mapBtn) mapBtn.addEventListener('click', function () {
    var box = $('#map-box'), f = document.createElement('iframe');
    f.src = 'https://www.google.com/maps?q=' + encodeURIComponent('100 Av. du Fer à Cheval, 74380 Bonne, France') + '&output=embed';
    f.title = 'Carte : Panier Sympa, 100 Av. du Fer à Cheval, 74380 Bonne';
    f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
    box.innerHTML = ''; box.appendChild(f); $('#map').classList.add('loaded');
  });

  // ---------- Titre : découpage en lettres ----------
  var brand = $('#brand'), chars = [];
  if (brand) {
    var txt = brand.getAttribute('aria-label') || brand.textContent;
    brand.textContent = '';
    txt.split(' ').forEach(function (word) {
      var w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      word.split('').forEach(function (c) { var s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); chars.push(s); });
      brand.appendChild(w);
    });
  }

  // ---------- Apparition douce des tuiles (jamais bloquante) ----------
  var rv = $$('.rv');
  if (rv.length) {
    var showAll = function () { rv.forEach(function (e) { e.classList.add('in'); }); };
    if (STILL || reduce || !('IntersectionObserver' in window)) { showAll(); }
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); setTimeout(function () { e.target.classList.add('done'); }, 1000); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      rv.forEach(function (e, i) { e.style.transitionDelay = (i % 2) * 90 + 'ms'; io.observe(e); });
      // filet de sécurité : tout ce qui est déjà à l'écran après 4 s est révélé
      setTimeout(function () { rv.forEach(function (e) { var r = e.getBoundingClientRect(); if (!e.classList.contains('in') && r.top < innerHeight) e.classList.add('in'); }); }, 4000);
    }
  }

  // ---------- Lenis : défilement fluide (si disponible, sans toucher au natif sur mobile) ----------
  var lenis = null;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!STILL && !reduce && fine && typeof Lenis !== 'undefined') {
    try { lenis = new Lenis({ lerp: 0.1, smoothWheel: true }); } catch (e) { lenis = null; }
    if (lenis) {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else { requestAnimationFrame(raf); }
      document.documentElement.style.scrollBehavior = 'auto';
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (ev) {
          var id = a.getAttribute('href').slice(1), t = id && document.getElementById(id);
          if (t) { ev.preventDefault(); lenis.scrollTo(t, { offset: id === 'hero' ? 0 : -70, duration: 1.2 }); }
        });
      });
    }
  }

  onScroll();
  if (typeof gsap === 'undefined' || STILL) return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  // ---------- Animations GSAP (gsap-core, gsap-timeline, gsap-scrolltrigger, gsap-performance) ----------
  var mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', fine: '(hover: hover) and (pointer: fine)' }, function (ctx) {
    if (!ctx.conditions.motion) return;
    var cleanups = [];

    // 1) Arrivée : un seul timeline. Les lettres montent une à une, puis le texte et les boutons.
    gsap.set(chars, { yPercent: 118, rotationX: -75, opacity: 0 });
    gsap.set('[data-in]', { autoAlpha: 0, y: 18 });
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to(chars, { yPercent: 0, rotationX: 0, opacity: 1, duration: 1, stagger: 0.05 }, 0.15)
      .to('[data-in]', { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 }, 0.7);
    // filet de sécurité : si quelque chose est resté caché (onglet en arrière-plan, animation bloquée), on le révèle sans GSAP
    setTimeout(function () {
      $$('[data-in]').concat(chars).forEach(function (e) {
        if (parseFloat(getComputedStyle(e).opacity) < 0.05) { e.style.opacity = 1; e.style.visibility = 'visible'; e.style.transform = 'none'; }
      });
    }, 5000);

    // 2) Lettres 3D : elles grossissent près du curseur puis reviennent en douceur.
    if (ctx.conditions.fine && chars.length) {
      var hero = $('#hero');
      var fs = parseFloat(getComputedStyle(brand).fontSize) || 160;
      var R = Math.max(150, fs * 0.9);
      var set = chars.map(function (el) {
        return {
          el: el,
          sx: gsap.quickTo(el, 'scaleX', { duration: 0.5, ease: 'power3.out' }), sy: gsap.quickTo(el, 'scaleY', { duration: 0.5, ease: 'power3.out' }),
          y: gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' }), z: gsap.quickTo(el, 'z', { duration: 0.5, ease: 'power3.out' }),
          rx: gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' }), ry: gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' })
        };
      });
      var move = function (e) {
        for (var i = 0; i < set.length; i++) {
          var r = set[i].el.getBoundingClientRect();
          var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          var k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R); k = k * k * (3 - 2 * k);
          set[i].sx(1 + 0.42 * k); set[i].sy(1 + 0.42 * k);
          set[i].y(-r.height * 0.05 * k); set[i].z(160 * k);
          set[i].rx(Math.max(-26, Math.min(26, (dy / R) * -20 * k))); set[i].ry(Math.max(-26, Math.min(26, (dx / R) * 20 * k)));
        }
      };
      var leave = function () { set.forEach(function (t) { t.sx(1); t.sy(1); t.y(0); t.z(0); t.rx(0); t.ry(0); }); };
      hero.addEventListener('pointermove', move); hero.addEventListener('pointerleave', leave);
      cleanups.push(function () { hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', leave); });

      // 3) Boutons magnétiques
      $$('.magnet').forEach(function (b) {
        var qx = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3.out' }), qy = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3.out' });
        b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * 0.22); qy((e.clientY - r.top - r.height / 2) * 0.22); });
        b.addEventListener('pointerleave', function () { qx(0); qy(0); });
      });

      // 4) Tuiles : inclinaison 3D douce (variables CSS, sans conflit avec l'apparition)
      $$('.tile').forEach(function (t) {
        t.addEventListener('pointermove', function (e) {
          var r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          t.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg'); t.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
        });
        t.addEventListener('pointerleave', function () { t.style.setProperty('--ry', '0deg'); t.style.setProperty('--rx', '0deg'); });
      });
    }

    if (typeof ScrollTrigger === 'undefined') return function () { cleanups.forEach(function (f) { f(); }); };

    // 5) Hero : le texte s'efface en douceur quand on descend (les particules se dispersent dans hero-logo.js).
    gsap.to('.hero-in', { yPercent: -8, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '#hero', start: '35% top', end: 'bottom top', scrub: 0.5 } });

    // 6) Visite pas à pas : la section s'épingle et les photos se succèdent.
    var walk = $('#visite'), shots = $$('.shot', walk), steps = $$('.step', walk), n = shots.length;
    var wpv = /[?&]walkp=([0-9.]+)/.exec(qs);
    if (walk && n > 1) {
      walk.classList.add('is-pinned'); walk.style.setProperty('--n', n - 1);
      var dots = document.createElement('div'); dots.className = 'walk-dots'; dots.setAttribute('aria-hidden', 'true');
      shots.forEach(function () { dots.appendChild(document.createElement('b')); });
      $('.walk-text', walk).appendChild(dots);
      var setDot = function (i) { $$('b', dots).forEach(function (b, k) { b.classList.toggle('on', k === i); }); };
      setDot(0);
      gsap.set(shots.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(steps.slice(1), { autoAlpha: 0, y: 16 });
      var tl = gsap.timeline({
        defaults: { ease: 'none' }, paused: !!wpv,
        scrollTrigger: wpv ? undefined : { trigger: walk, start: 'top top', end: 'bottom bottom', scrub: 0.6,
          onUpdate: function (s) { setDot(Math.min(n - 1, Math.round(s.progress * (n - 1) / ((n - 1) / (n - 1 + 0.5))))); } }
      });
      for (var i = 1; i < n; i++) {
        var t0 = i - 1;
        tl.to(steps[i - 1], { autoAlpha: 0, y: -16, duration: 0.25, ease: 'power2.in' }, t0 + 0.5)
          .to(shots[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'power2.inOut' }, t0 + 0.4)
          .fromTo($('img', shots[i]), { scale: 1.12 }, { scale: 1, duration: 0.9, ease: 'power2.out' }, t0 + 0.4)
          .to($('img', shots[i - 1]), { scale: 1.06, duration: 0.9 }, t0 + 0.4)
          .to(steps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, t0 + 0.72);
      }
      tl.to({}, { duration: 0.5 });
      if (wpv) { tl.progress(Math.min(1, +wpv[1])); setDot(Math.min(n - 1, Math.round(+wpv[1] * (n - 1)))); }
      cleanups.push(function () { walk.classList.remove('is-pinned'); gsap.set(shots.concat(steps), { clearProps: 'all' }); $('.walk-dots', walk) && $('.walk-dots', walk).remove(); });
    }
    ScrollTrigger.refresh();
    return function () { cleanups.forEach(function (f) { f(); }); };
  });
})();
