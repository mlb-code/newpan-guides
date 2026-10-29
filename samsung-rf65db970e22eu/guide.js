/* Samsung RF65DB970E22EU water-line guide: shared page script for the Hebrew page and the English page.
   All visible strings come from GUIDE_TEXT in the page head; the direction comes from the html dir attribute. */
(function () {
  "use strict";
  var d = document, w = window, de = d.documentElement;
  /* page settings (defined in the page head): VIDEO_URL, VIDEO_URL_VERTICAL, MANUAL_URL, SERVICE_PHONE, ASSET_BASE, GUIDE_TEXT */
  var T = (typeof GUIDE_TEXT === "object" && GUIDE_TEXT) || {};
  var ASSET = typeof ASSET_BASE === "string" ? ASSET_BASE : "";
  /* the water line runs down the inline-start edge on mobile: right in Hebrew (RTL), left in English (LTR) */
  var RTL = getComputedStyle(de).direction === "rtl", DIR = RTL ? -1 : 1;
  var RM = !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(s) { return d.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(d.querySelectorAll(s)); }

  /* ---------------- video: VIDEO_URL (+ VIDEO_URL_VERTICAL) drive the players ---------------- */
  var url = (typeof VIDEO_URL === "string" ? VIDEO_URL : "").trim();
  var urlV = (typeof VIDEO_URL_VERTICAL === "string" ? VIDEO_URL_VERTICAL : "").trim();
  var hero = $("#top"), player = $("#player"), playBtn = $("#play"), closeBtn = $("#close"), toVideo = $("#toVideo");
  var chooser = $("#chooser"), vo = $("#vo"), voClose = $("#voClose");
  var media = null, vmedia = null;
  var YT = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  function isDesk() { return w.innerWidth >= 960; }
  if (!url) {
    urlV = "";
    playBtn.disabled = true;
    playBtn.setAttribute("aria-label", T.videoSoon);
    $("#play-meta").textContent = T.videoSoonShort;
    $("#player-note").textContent = T.videoSoonNote;
    hero.classList.add("no-video");
    toVideo.hidden = true;
  }
  /* one video per page (the Hebrew page plays the Hebrew video, the English page the English one) */
  function srcH() { return url; }
  function srcV() { return urlV; }
  // is the vertical file really there? (missing / 404 = no question, play horizontal directly)
  var vertOK = urlV ? null : false;
  if (urlV) {
    if (YT.test(urlV)) vertOK = true;
    else if (w.fetch) {
      fetch(urlV, { method: "HEAD", cache: "no-cache" }).then(function (r) {
        vertOK = r.ok && !/text\/html/i.test(r.headers.get("content-type") || "");
      }).catch(function () { vertOK = false; });
    } else vertOK = false;
  }

  function makeMedia(src, vertical) {
    var yt = src.match(YT), el;
    if (yt) {
      el = d.createElement("iframe");
      el.src = "https://www.youtube-nocookie.com/embed/" + yt[1] + "?rel=0&modestbranding=1&playsinline=1&autoplay=1";
      el.title = T.videoTitle;
      el.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      el.setAttribute("allowfullscreen", "");
      el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    } else {
      el = d.createElement("video");
      el.src = src;
      el.controls = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.setAttribute("preload", vertical ? "auto" : "metadata");
      if (!vertical) el.setAttribute("poster", ASSET + "img/poster.jpg");
      el.setAttribute("aria-label", T.videoTitle + (vertical ? T.videoVertical : ""));
      el.setAttribute("data-src", src);
      // iOS Safari native fullscreen (webkitEnterFullscreen) does not fire fullscreenchange
      el.addEventListener("webkitbeginfullscreen", fsEnter);
      el.addEventListener("webkitendfullscreen", fsExit);
    }
    return el;
  }
  function playEl(el) { if (el && el.tagName === "VIDEO") { var p = el.play(); if (p && p.catch) p.catch(function () {}); } }
  function jump(y) {
    var prev = de.style.scrollBehavior;
    de.style.scrollBehavior = "auto";
    w.scrollTo(0, Math.max(0, Math.round(y)));
    de.style.scrollBehavior = prev;
  }

  /* Back button (Android) closes the video instead of leaving the page */
  var histOn = null;
  function pushH(k) { if (histOn) return; try { history.pushState({ nlv: k }, ""); histOn = k; } catch (e) {} }
  function popH() {
    var k = histOn; histOn = null;
    if (k && history.state && history.state.nlv) { try { history.back(); } catch (e) {} }
  }
  w.addEventListener("popstate", function () {
    var k = histOn; if (!k) return; histOn = null;
    if (k === "vo") closeVO(true); else stop(true);
  });

  /* scroll anchor: survives rotation / fullscreen reflow (the page gets taller or shorter with the width) */
  var anchor = null;
  function saveAnchor(y) {
    y = y == null ? (w.scrollY || w.pageYOffset) : y;
    var best = null, off = 0, base = y - (w.scrollY || w.pageYOffset);
    $$("#top, main .sec, .part-head, .step, #done, .site-footer").forEach(function (e) {
      var t = e.getBoundingClientRect().top + (w.scrollY || w.pageYOffset) + base;
      if (t <= y + 1) { best = e; off = y - t; }
    });
    anchor = { y: y, w: w.innerWidth, el: best, k: best ? off / (best.offsetHeight || 1) : 0 };
  }
  function restoreAnchor() {
    if (!anchor) return;
    var a2 = anchor; anchor = null;
    if (a2.w === w.innerWidth || !a2.el) { jump(a2.y); return; }
    jump(a2.el.getBoundingClientRect().top + w.scrollY + a2.k * a2.el.offsetHeight);
  }

  /* ---- horizontal: inline "cinema" in the hero ---- */
  function centerCinema() {
    // phone in landscape: keep the whole 16:9 frame (and its controls) on screen
    if (!media || locked || fs || isDesk() || !hero.classList.contains("is-playing")) return;
    var y0 = w.scrollY, hh = hero.offsetHeight;
    if (y0 > hh * 0.8) return;
    var r = media.getBoundingClientRect();
    var y = Math.max(0, Math.min(y0 + r.top + r.height / 2 - w.innerHeight / 2, hero.offsetTop + hh - w.innerHeight));
    if (Math.abs(y - y0) > 2) jump(y);
  }
  function play() {
    if (!url) return;
    hideChooser();
    var want = srcH();
    if (media && media.getAttribute("data-src") !== want) { if (media.tagName === "VIDEO") media.pause(); media.parentNode.removeChild(media); media = null; }
    if (!media) { media = makeMedia(want, false); player.appendChild(media); }
    hero.classList.add("is-playing");
    closeBtn.hidden = false;
    if (!isDesk()) pushH("cinema");
    playEl(media);
    requestAnimationFrame(centerCinema);
  }
  function stop(fromPop) {
    if (media && media.tagName === "VIDEO") media.pause();
    if (media && media.tagName === "IFRAME") { media.parentNode.removeChild(media); media = null; }
    hero.classList.remove("is-playing");
    closeBtn.hidden = true;
    if (!fromPop) popH();
    try { playBtn.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---- the chooser: asked on every Play, nothing pre-selected, nothing remembered ---- */
  function showChooser() {
    chooser.hidden = false;
    hero.classList.add("is-choosing");
    try { $("#chV").focus({ preventScroll: true }); } catch (e) {}
  }
  function hideChooser() {
    if (chooser.hidden) return;
    chooser.hidden = true;
    hero.classList.remove("is-choosing");
  }
  function onPlay() {
    if (!url) return;
    if (urlV && vertOK !== false) showChooser(); else play();
  }

  /* ---- vertical: full-screen overlay, page scroll locked and given back exactly ---- */
  var locked = false, lockY = 0, hidOthers = [$("#page"), $("#chapbar"), toVideo];
  function setInert(on) {
    hidOthers.forEach(function (e) {
      if (!e) return;
      if ("inert" in e) e.inert = on;
      if (on) e.setAttribute("aria-hidden", "true"); else e.removeAttribute("aria-hidden");
    });
  }
  function lock() {
    if (locked) return;
    lockY = w.scrollY || w.pageYOffset;
    saveAnchor(lockY);
    locked = true; w.__nlHold = true;
    var b = d.body.style;
    b.position = "fixed"; b.top = -lockY + "px"; b.left = "0"; b.right = "0"; b.width = "100%";
  }
  function unlock() {
    if (!locked) return;
    var b = d.body.style;
    b.position = b.top = b.left = b.right = b.width = "";
    locked = false;
    restoreAnchor();
    w.__nlHold = false;
    if (G) { disp = -1; tick(); }
  }
  function openVO() {
    hideChooser();
    var wantV = srcV();
    if (vmedia && vmedia.getAttribute("data-src") !== wantV) {
      if (vmedia.tagName === "VIDEO") { vmedia.removeEventListener("error", onVErr); vmedia.pause(); }
      vmedia.parentNode.removeChild(vmedia); vmedia = null;
    }
    if (!vmedia) {
      vmedia = makeMedia(wantV, true);
      if (vmedia.tagName === "VIDEO") vmedia.addEventListener("error", onVErr);
      vo.appendChild(vmedia);
    }
    lock();
    vo.hidden = false;
    void vo.offsetWidth;
    vo.classList.add("open");
    setInert(true);
    pushH("vo");
    playEl(vmedia);
    try { voClose.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeVO(fromPop) {
    if (!vo.classList.contains("open")) return;
    if (vmedia && vmedia.tagName === "VIDEO") vmedia.pause();
    if (vmedia && vmedia.tagName === "IFRAME") { vmedia.parentNode.removeChild(vmedia); vmedia = null; }
    var fsEl = d.fullscreenElement || d.webkitFullscreenElement;
    if (fsEl && vmedia && fsEl === vmedia) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} }
    vo.classList.remove("open");
    vo.hidden = true;
    setInert(false);
    unlock();
    if (!fromPop) popH();
    try { playBtn.focus({ preventScroll: true }); } catch (e) {}
  }
  function onVErr() {
    // the vertical file is missing or broken: from now on play horizontal only
    vertOK = false;
    var wasOpen = vo.classList.contains("open");
    if (vmedia) { vmedia.removeEventListener("error", onVErr); if (vmedia.parentNode) vmedia.parentNode.removeChild(vmedia); vmedia = null; }
    if (!wasOpen) return;
    vo.classList.remove("open"); vo.hidden = true; setInert(false); unlock();
    if (histOn === "vo") { histOn = isDesk() ? null : "cinema"; try { history.replaceState({ nlv: "cinema" }, ""); } catch (e) {} }
    play();
  }

  /* ---- fullscreen (standard + iOS): no layout work while it is up, then rebuild + give the scroll back ---- */
  var fs = false, fsPending = false;
  function fsEnter() { if (fs) return; fs = true; if (!locked) saveAnchor(); }
  function fsExit() {
    if (!fs) return;
    fs = false;
    setTimeout(function () {
      if (fs) return;
      vh = w.innerHeight;
      if (fsPending || page.clientWidth !== lastW || page.offsetHeight !== lastH) { fsPending = false; build(); }
      if (!locked) { restoreAnchor(); centerCinema(); }
      if (G) { disp = -1; tick(); }
    }, 350);
  }
  d.addEventListener("fullscreenchange", function () { if (d.fullscreenElement) fsEnter(); else fsExit(); });
  d.addEventListener("webkitfullscreenchange", function () { if (d.webkitFullscreenElement) fsEnter(); else fsExit(); });

  playBtn.addEventListener("click", onPlay);
  closeBtn.addEventListener("click", function () { stop(); });
  $("#chV").addEventListener("click", function () { if (vertOK === false) play(); else openVO(); });
  $("#chH").addEventListener("click", play);
  $("#chX").addEventListener("click", function () { hideChooser(); try { playBtn.focus({ preventScroll: true }); } catch (e) {} });
  voClose.addEventListener("click", function () { closeVO(); });
  d.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" && e.key !== "Esc") return;
    if (vo.classList.contains("open")) { e.preventDefault(); closeVO(); }
    else if (!chooser.hidden) { e.preventDefault(); hideChooser(); try { playBtn.focus({ preventScroll: true }); } catch (e2) {} }
  });
  toVideo.addEventListener("click", function () { setTimeout(function () { try { playBtn.focus({ preventScroll: true }); } catch (e) {} }, 700); });

  /* in-page links (chapter bar, "to the video", hero buttons): scroll there without stacking #hash history entries,
     so Back is never a dead button (history.scrollRestoration is manual) */
  d.addEventListener("click", function (e) {
    var t = e.target, a2 = t && t.closest ? t.closest('a[href^="#"]') : null;
    if (!a2 || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = d.getElementById(a2.getAttribute("href").slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
  });

  /* ---------------- manual PDF + service phone ---------------- */
  var manual = (typeof MANUAL_URL === "string" ? MANUAL_URL : "").trim();
  var mb = $("#manual-btn");
  if (manual && mb) {
    mb.href = manual; mb.removeAttribute("aria-disabled");
    mb.setAttribute("target", "_blank"); mb.setAttribute("rel", "noopener");
    mb.textContent = T.manualDownload;
  }
  var phone = (typeof SERVICE_PHONE === "string" ? SERVICE_PHONE : "").trim();
  var ph = $("#phone");
  if (phone && ph) {
    var pr = $("#phoneRow"); if (pr) pr.hidden = false;
    var a = d.createElement("a");
    a.href = "tel:" + phone.replace(/[^\d+*#]/g, "");
    a.textContent = phone; a.className = "ltr";
    ph.parentNode.replaceChild(a, ph);
  }

  /* ---------------- reveal on enter ---------------- */
  var rv = $$(".rv");
  if (!RM && "IntersectionObserver" in w) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    rv.forEach(function (e) { io.observe(e); });
  } else rv.forEach(function (e) { e.classList.add("in"); });

  /* ---------------- kit cards: dots for the horizontal scroller ---------------- */
  var track = $("#kitTrack"), dotsWrap = $("#kitDots"), cards = $$("#kitTrack .part-card"), dots = [];
  cards.forEach(function (c, i) {
    var b = d.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", T.kitItem + " " + (i + 1));
    b.addEventListener("click", function () { c.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "nearest", inline: "start" }); });
    dotsWrap.appendChild(b); dots.push(b);
  });
  function kitDot() {
    var step = cards.length > 1 ? Math.abs(cards[1].offsetLeft - cards[0].offsetLeft) : 1;
    var i = Math.max(0, Math.min(cards.length - 1, Math.round(Math.abs(track.scrollLeft) / (step || 1))));
    dots.forEach(function (b, j) { b.setAttribute("aria-current", j === i ? "true" : "false"); });
  }
  track.addEventListener("scroll", function () { requestAnimationFrame(kitDot); }, { passive: true });
  kitDot();

  /* ---------------- the water line ---------------- */
  var NS = "http://www.w3.org/2000/svg";
  var page = $("#page"), line = $("#line"), tube = $("#tube"), water = $("#water");
  var wclip = $("#wclip"), winner = $("#winner"), headEl = $("#head"), tap = $("#tap"), done = $("#done");
  var p2img = $("#p2img"), p2 = $(".p2");
  var chapbar = $("#chapbar"), cbDot = $("#cbDot"), cbPill = $("#cbPill"), cbTrack = $("#cbTrack");
  var cbLinks = $$(".cb-links a");
  var G = null, disp = -1, raf = 0, vh = w.innerHeight, lastW = 0, lastH = 0;

  function mk(tag, at, parent) {
    var e = d.createElementNS(NS, tag);
    for (var k in at) e.setAttribute(k, at[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function pathD(p) {
    var s = "M" + f(p[0].x) + " " + f(p[0].y);
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i], k = (b.y - a.y) * 0.5;
      s += "C" + f(a.x) + " " + f(a.y + k) + " " + f(b.x) + " " + f(b.y - k) + " " + f(b.x) + " " + f(b.y);
    }
    return s;
  }

  function build() {
    var W = page.clientWidth, H = page.offsetHeight;
    var desk = w.innerWidth >= 960;
    var pr = page.getBoundingClientRect();
    function R(e) {
      var r = e.getBoundingClientRect();
      return { t: r.top - pr.top, b: r.bottom - pr.top, cx: (r.left + r.right) / 2 - pr.left, cy: (r.top + r.bottom) / 2 - pr.top, h: r.height };
    }
    var laneW = parseFloat(getComputedStyle(de).getPropertyValue("--lane")) || 44;
    var X = desk ? W / 2 : (RTL ? W - laneW / 2 : laneW / 2);
    var o = R($("#tapOut"));
    var pts = [{ x: o.cx, y: o.cy }], stations = [], rings = [], valve = null, glassY = 0;

    $$("[data-wp]").forEach(function (e) {
      var r = R(e), t = e.getAttribute("data-wp");
      if (t === "ring") { pts.push({ x: X, y: r.cy }); rings.push(r.cy); }
      else if (t === "num") {
        pts.push({ x: X, y: r.t - 36 }); pts.push({ x: r.cx, y: r.cy }); pts.push({ x: X, y: r.b + 36 });
        var s = e.parentNode, sr = R(s);
        stations.push({ el: s, y: r.cy, top: sr.t, bottom: sr.b });
      } else if (t === "valve") {
        valve = { y0: r.cy - 30, y1: r.cy + 30 };
        pts.push({ x: X, y: r.t }); pts.push({ x: X, y: valve.y0, cut: 1 }); pts.push({ x: X, y: valve.y1, cut: 2 }); pts.push({ x: X, y: r.b });
      } else if (t === "glass") {
        var gi = R($("#glassIn"));
        glassY = gi.cy;
        pts.push({ x: X, y: R(done).t + 4 }); pts.push({ x: gi.cx, y: r.t - 8 }); pts.push({ x: gi.cx, y: gi.cy, end: 1 });
      }
    });

    // keep the line strictly downward, then add a little slack on long straight runs
    var clean = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var q = pts[i], last = clean[clean.length - 1];
      if (q.y <= last.y + 8) { if (q.cut || q.end) { q.y = last.y + 8; } else continue; }
      if (!last.cut || last.cut === 2) {
        var dy = q.y - last.y;
        if (dy > 260 && Math.abs(q.x - X) < 1 && Math.abs(last.x - X) < 1 && last.cut !== 1) {
          var amp = desk ? 16 : 5, n = Math.floor(dy / 300);
          for (var j = 1; j <= n; j++) clean.push({ x: X + (j % 2 ? amp : -amp), y: last.y + dy * j / (n + 1) });
        }
      }
      clean.push(q);
    }
    pts = clean;
    var cutA = 0, cutB = 0;
    pts.forEach(function (p, i) { if (p.cut === 1) cutA = i; if (p.cut === 2) cutB = i; });
    var A = valve ? pts.slice(0, cutA + 1) : pts, B = valve ? pts.slice(cutB) : [];
    var dA = pathD(A), dB = B.length > 1 ? pathD(B) : "";

    // draw: empty tube (white before the valve, blue after) + the water copy
    var sw = desk ? 1.3 : 1;
    [tube, water].forEach(function (s) {
      while (s.firstChild) s.removeChild(s.firstChild);
      s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", "0 0 " + W + " " + H);
    });
    var cap = { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
    function st(o2) { var r = {}; for (var k in cap) r[k] = cap[k]; for (var k2 in o2) r[k2] = o2[k2]; return r; }
    mk("path", st({ d: dA, stroke: "#C5CEDD", "stroke-width": 14 * sw }), tube);
    mk("path", st({ d: dA, stroke: "#FFFFFF", "stroke-width": 10 * sw }), tube);
    if (dB) {
      mk("path", st({ d: dB, stroke: "#8EA6E4", "stroke-width": 14 * sw }), tube);
      mk("path", st({ d: dB, stroke: "#D7E2FB", "stroke-width": 10 * sw }), tube);
    }
    [dA, dB].forEach(function (dd) {
      if (!dd) return;
      mk("path", st({ d: dd, stroke: "#2E7CF6", "stroke-width": 6.5 * sw }), water);
      mk("path", st({ d: dd, stroke: "#A6CAFF", "stroke-width": 1.6 * sw, "stroke-opacity": ".9" }), water);
    });
    rings.forEach(function (y) {
      mk("circle", { cx: X, cy: y, r: 9 * sw, fill: "#fff", stroke: "#B6C1D6", "stroke-width": 2 }, tube);
      mk("circle", { cx: X, cy: y, r: 9 * sw, fill: "#2E7CF6", stroke: "#fff", "stroke-width": 2.5 }, water);
    });
    if (valve) {
      [[tube, "#FFFFFF", "#8F96A2"], [water, "#BFDBFF", "#7E8796"]].forEach(function (v) {
        var g = mk("g", {}, v[0]), x = X, y0 = valve.y0, y1 = valve.y1, ww = 11 * sw;
        mk("rect", { x: x - ww, y: y0 - 2, width: ww * 2, height: y1 - y0 + 4, rx: ww * .8, fill: v[2], stroke: "#5F6673", "stroke-width": 1 }, g);
        mk("rect", { x: x - ww - 1, y: y0 + 6, width: ww * 2 + 2, height: 3, rx: 1.5, fill: "#6E7583" }, g);
        mk("rect", { x: x - ww - 1, y: y1 - 9, width: ww * 2 + 2, height: 3, rx: 1.5, fill: "#6E7583" }, g);
        // the arrow points downstream = toward the refrigerator
        mk("path", { d: "M" + x + " " + (y0 + 15) + "V" + (y1 - 15) + "M" + (x - 5) + " " + (y1 - 21) + "L" + x + " " + (y1 - 15) + "L" + (x + 5) + " " + (y1 - 21), fill: "none", stroke: v[1], "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      });
    }

    // y -> x lookup for the bright "head" at the water front
    var probe = mk("path", { d: dA + (dB ? " " + dB : "") }, tube);
    probe.setAttribute("stroke", "none");
    var L = probe.getTotalLength(), ys = [], xs = [], step = 4;
    for (var s2 = 0; s2 <= L; s2 += step) { var pt = probe.getPointAtLength(s2); if (!ys.length || pt.y > ys[ys.length - 1]) { ys.push(pt.y); xs.push(pt.x); } }
    tube.removeChild(probe);

    // chapter sections
    var secs = ["prep", "kit", "part1", "part2", "part3", "help"].map(function (id) { return R(d.getElementById(id)).t; });
    secs.push(H);

    line.style.height = H + "px";
    G = {
      W: W, H: H, y0: pts[0].y, yEnd: pts[pts.length - 1].y, ys: ys, xs: xs, stations: stations, glassY: glassY,
      heroH: hero.offsetHeight, secs: secs, desk: desk, trackW: cbTrack.clientWidth,
      p2top: p2 ? R(p2).t : 0, p2h: p2 ? p2.offsetHeight : 0
    };
    lastW = W; lastH = H;
    disp = -1;
    tick();
  }

  function xAt(y) {
    var ys = G.ys, lo = 0, hi = ys.length - 1;
    if (y <= ys[0]) return G.xs[0];
    if (y >= ys[hi]) return G.xs[hi];
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (ys[m] < y) lo = m; else hi = m; }
    var t = (y - ys[lo]) / (ys[hi] - ys[lo] || 1);
    return G.xs[lo] + (G.xs[hi] - G.xs[lo]) * t;
  }

  var state = { on: -1, sec: -2, bar: null, tap: null, full: null, head: null };
  function setOnce(key, val, fn) { if (state[key] !== val) { state[key] = val; fn(val); } }

  function tick() {
    raf = 0;
    if (!G || locked) return;
    var sy = w.scrollY || w.pageYOffset, front = sy + vh * 0.56;
    var target = RM ? G.yEnd : Math.max(G.y0, Math.min(G.yEnd, front));
    if (disp < 0 || RM) disp = target;
    else { disp += (target - disp) * 0.17; if (Math.abs(target - disp) < 0.5) disp = target; }

    // water reveal: only transforms
    wclip.style.transform = "translate3d(0," + f(disp - G.H) + "px,0)";
    winner.style.transform = "translate3d(0," + f(G.H - disp) + "px,0)";
    var moving = disp > G.y0 + 2 && disp < G.yEnd - 2 && !RM;
    if (moving) headEl.style.transform = "translate3d(" + f(xAt(disp)) + "px," + f(disp) + "px,0)";
    setOnce("head", moving, function (v) { headEl.classList.toggle("on", v); });
    setOnce("tap", disp > G.y0 + 1, function (v) { tap.classList.toggle("open", v); });
    setOnce("full", disp >= G.glassY - 6, function (v) { done.classList.toggle("full", v); });

    // stations: numerals fill as the water reaches them; the current step runs its micro-animation
    var on = -1;
    G.stations.forEach(function (s, i) {
      var filled = disp >= s.y - 2;
      if (s.filled !== filled) { s.filled = filled; s.el.classList.toggle("is-filled", filled); }
      if (s.y <= front && s.bottom > sy + vh * 0.1) on = i;
    });
    setOnce("on", on, function (v) { G.stations.forEach(function (s, i) { s.el.classList.toggle("is-on", i === v); }); });

    // chapter bar + floating video button
    setOnce("bar", sy > G.heroH * 0.55, function (v) { chapbar.classList.toggle("on", v); toVideo.classList.toggle("on", v); });
    var secs = G.secs, si = -1;
    for (var k = 0; k < secs.length - 1; k++) if (secs[k] <= front) si = k;
    var p = si < 0 ? 0 : Math.max(0, Math.min(1, (front - secs[si]) / (secs[si + 1] - secs[si] || 1)));
    var prog = si < 0 ? 0 : (si + p) / (secs.length - 1);
    cbDot.style.transform = "translate3d(" + f(DIR * prog * G.trackW) + "px,0,0)";
    setOnce("sec", si, function (v) {
      cbPill.classList.toggle("on", v >= 0);
      if (v >= 0) cbPill.style.transform = "translate3d(" + (DIR * 100 * v) + "%,0,0)";
      cbLinks.forEach(function (l, i) { if (i === v) l.setAttribute("aria-current", "true"); else l.removeAttribute("aria-current"); });
    });

    // gentle parallax: hero fridge, and the fridge back behind part 2
    if (!RM) {
      if (sy < G.heroH && !G.desk) hero.style.setProperty("--py", f(sy * 0.22) + "px");
      if (p2img && sy + vh > G.p2top - 200 && sy < G.p2top + G.p2h + 200) p2img.style.transform = "translate3d(0," + f((sy + vh / 2 - G.p2top) * 0.16) + "px,0)";
    }
    if (disp !== target) raf = requestAnimationFrame(tick);
  }
  function req() { if (!raf) raf = requestAnimationFrame(tick); }
  w.addEventListener("scroll", req, { passive: true });

  var rT = 0;
  function rebuildSoon() {
    clearTimeout(rT);
    rT = setTimeout(function () {
      if (fs) { fsPending = true; return; }
      vh = w.innerHeight;
      var wide = page.clientWidth !== lastW;
      build();
      if (wide) centerCinema();
    }, 120);
  }
  function onResize() {
    vh = w.innerHeight;
    if (page.clientWidth !== lastW) rebuildSoon(); else req();
  }
  w.addEventListener("resize", onResize);
  // iOS reports the new size late after a rotation: check again once it has settled
  w.addEventListener("orientationchange", function () { setTimeout(rebuildSoon, 350); });
  if (w.visualViewport) w.visualViewport.addEventListener("resize", onResize);
  if ("ResizeObserver" in w) new ResizeObserver(function () { if (page.offsetHeight !== lastH || page.clientWidth !== lastW) rebuildSoon(); }).observe(page);
  build();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(rebuildSoon);
  w.addEventListener("load", rebuildSoon);
})();
