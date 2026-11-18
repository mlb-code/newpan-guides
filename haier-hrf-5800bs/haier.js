/* Haier HRF-5800BS water-line guide (v2): shared page script for the Hebrew page and the English page.
   Visible strings come from GUIDE_TEXT in the page head; the direction comes from the html dir attribute.
   Player logic: VIDEO_URL / VIDEO_URL_VERTICAL / "how do you want to watch?" (same behaviour as the other NewPro guides).
   Chapters: an interactive split screen — one sticky picture per chapter, the step list switches it (scroll, click, keyboard). */
(function () {
  "use strict";
  var d = document, w = window, de = d.documentElement;
  var T = (typeof GUIDE_TEXT === "object" && GUIDE_TEXT) || {};
  var ASSET = typeof ASSET_BASE === "string" ? ASSET_BASE : "";
  var RM = !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(s) { return d.querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function isDesk() { return w.innerWidth >= 900; }

  /* ---------------- video ---------------- */
  var url = (typeof VIDEO_URL === "string" ? VIDEO_URL : "").trim();
  var urlV = (typeof VIDEO_URL_VERTICAL === "string" ? VIDEO_URL_VERTICAL : "").trim();
  var hero = $("#top"), player = $("#player"), playBtn = $("#play"), closeBtn = $("#close");
  var chooser = $("#chooser"), vo = $("#vo"), voClose = $("#voClose"), page = $("#page");
  var media = null, vmedia = null;
  var YT = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  if (!url) {
    urlV = "";
    playBtn.disabled = true;
    playBtn.setAttribute("aria-label", T.videoSoon);
    $("#play-meta").textContent = T.videoSoonShort;
    hero.classList.add("no-video");
  }
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
      if (!vertical) el.setAttribute("poster", typeof VIDEO_POSTER === "string" && VIDEO_POSTER ? VIDEO_POSTER : ASSET + "img/poster.jpg");
      el.setAttribute("aria-label", T.videoTitle + (vertical ? T.videoVertical : ""));
      el.setAttribute("data-src", src);
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
  function centerCinema() {
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
    if (media && media.getAttribute("data-src") !== url) { if (media.tagName === "VIDEO") media.pause(); media.parentNode.removeChild(media); media = null; }
    if (!media) { media = makeMedia(url, false); player.appendChild(media); }
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
  var locked = false, lockY = 0;
  function setInert(on) {
    [page, $("#dotsNav"), $("#siteFooter")].forEach(function (e) {
      if (!e) return;
      if ("inert" in e) e.inert = on;
      if (on) e.setAttribute("aria-hidden", "true"); else e.removeAttribute("aria-hidden");
    });
  }
  function lock() {
    if (locked) return;
    lockY = w.scrollY || w.pageYOffset;
    locked = true; w.__nlHold = true;
    var b = d.body.style;
    b.position = "fixed"; b.top = -lockY + "px"; b.left = "0"; b.right = "0"; b.width = "100%";
  }
  function unlock() {
    if (!locked) return;
    var b = d.body.style;
    b.position = b.top = b.left = b.right = b.width = "";
    locked = false;
    jump(lockY);
    w.__nlHold = false;
    spy();
  }
  function openVO() {
    hideChooser();
    if (vmedia && vmedia.getAttribute("data-src") !== urlV) {
      if (vmedia.tagName === "VIDEO") { vmedia.removeEventListener("error", onVErr); vmedia.pause(); }
      vmedia.parentNode.removeChild(vmedia); vmedia = null;
    }
    if (!vmedia) {
      vmedia = makeMedia(urlV, true);
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
    vertOK = false;
    var wasOpen = vo.classList.contains("open");
    if (vmedia) { vmedia.removeEventListener("error", onVErr); if (vmedia.parentNode) vmedia.parentNode.removeChild(vmedia); vmedia = null; }
    if (!wasOpen) return;
    vo.classList.remove("open"); vo.hidden = true; setInert(false); unlock();
    if (histOn === "vo") { histOn = isDesk() ? null : "cinema"; try { history.replaceState({ nlv: "cinema" }, ""); } catch (e) {} }
    play();
  }
  var fs = false;
  function fsEnter() { fs = true; }
  function fsExit() { fs = false; setTimeout(function () { if (!locked) centerCinema(); spy(); }, 350); }
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
  var watchBtn = $("#watch");
  if (watchBtn) watchBtn.addEventListener("click", function (e) { e.preventDefault(); if (isDesk()) onPlay(); else { player.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" }); setTimeout(onPlay, RM ? 0 : 450); } });

  /* in-page links: scroll without stacking #hash history entries */
  d.addEventListener("click", function (e) {
    var t = e.target, a2 = t && t.closest ? t.closest('a[href^="#"]') : null;
    if (!a2 || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = d.getElementById(a2.getAttribute("href").slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
  });

  /* ---------------- manual PDF + service phone (empty = not shown) ---------------- */
  var manual = (typeof MANUAL_URL === "string" ? MANUAL_URL : "").trim();
  var mb = $("#manual-btn");
  if (mb) { if (manual) { mb.href = manual; mb.hidden = false; } else mb.hidden = true; }
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

  /* ---------------- chapters: sticky picture + step list ----------------
     The active step decides the picture. It follows the scroll (the step nearest the "reading line"), a click/tap, or the keyboard
     (focus, ArrowUp/ArrowDown, Home/End). After a click the choice is pinned until the visitor scrolls on. */
  var chaps = $$("[data-chap]").map(function (sec) {
    var steps = $$(".step", sec), shots = {};
    $$(".shot", sec).forEach(function (im) { shots[im.getAttribute("data-shot")] = im; });
    return { sec: sec, steps: steps, btns: steps.map(function (s) { return s.querySelector(".step-btn"); }), shots: shots,
             stage: sec.querySelector(".stage-wrap"), cnt: sec.querySelector(".cnt"), on: -1, pin: null, pinY: 0 };
  });
  function setStep(c, i, why) {
    if (i < 0 || i >= c.steps.length) return;
    if (c.on === i) return;
    c.on = i;
    c.steps.forEach(function (s, j) {
      s.classList.toggle("is-on", j === i); s.classList.toggle("is-done", j < i);
      if (j === i) c.btns[j].setAttribute("aria-current", "true"); else c.btns[j].removeAttribute("aria-current");
    });
    var key = c.btns[i].getAttribute("data-shot");
    for (var k in c.shots) c.shots[k].classList.toggle("is-on", k === key);
    if (c.cnt) c.cnt.textContent = (T.stepOf || "{i}/{n}").replace("{i}", i + 1).replace("{n}", c.steps.length);
  }
  chaps.forEach(function (c) {
    c.btns.forEach(function (b, i) {
      b.addEventListener("click", function () { c.pin = i; c.pinY = w.scrollY || w.pageYOffset; setStep(c, i, "click"); });
      b.addEventListener("focus", function () { c.pin = i; c.pinY = w.scrollY || w.pageYOffset; setStep(c, i, "focus"); });
      b.addEventListener("keydown", function (e) {
        var j = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") j = Math.min(c.btns.length - 1, i + 1);
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = Math.max(0, i - 1);
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = c.btns.length - 1;
        if (j === null) return;
        e.preventDefault();
        try { c.btns[j].focus({ preventScroll: false }); } catch (e2) { c.btns[j].focus(); }
      });
    });
    c.on = -1; setStep(c, 0, "init");
  });
  /* the "reading line": just under the sticky picture on a phone, a fifth of the way down the picture on a desktop;
     the step whose middle is nearest to it is the active one */
  function readLine(c) {
    var r = c.stage.getBoundingClientRect();
    return isDesk() ? r.top + r.height * 0.2 : r.bottom + 64;
  }
  function spyChapter(c, sy, vh) {
    if (c.pin !== null) { if (Math.abs(sy - c.pinY) < 80) return; c.pin = null; }
    var line = readLine(c), on = 0, best = Infinity;
    c.steps.forEach(function (s, i) {
      var r = s.getBoundingClientRect(), dd = Math.abs((r.top + r.bottom) / 2 - line);
      if (dd < best) { best = dd; on = i; }
    });
    setStep(c, on, "scroll");
  }
  w.__nlLine = function (id) { for (var i = 0; i < chaps.length; i++) if (chaps[i].sec.id === id) return readLine(chaps[i]); return null; };   // for QA

  /* ---------------- progress dots: which chapter is on screen ---------------- */
  var dotItems = $$("#dotsNav li"), chapters = dotItems.map(function (li) { return $$(li.getAttribute("data-secs").split(",").map(function (s) { return "#" + s.trim(); }).join(",")); });
  var cur = -2, raf = 0;
  function spy() {
    raf = 0;
    if (locked) return;
    var sy = w.scrollY || w.pageYOffset, vh = w.innerHeight;
    chaps.forEach(function (c) { spyChapter(c, sy, vh); });
    var line = sy + Math.min(vh * 0.4, 320), on = -1;
    chapters.forEach(function (secs, i) {
      secs.forEach(function (s) { if (s.getBoundingClientRect().top + sy <= line) on = i; });
    });
    if (on === cur) return;
    cur = on;
    dotItems.forEach(function (li, i) {
      li.classList.toggle("on", i === on); li.classList.toggle("done", i < on);
      var a = li.querySelector("a"); if (i === on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  function req() { if (!raf) raf = requestAnimationFrame(spy); }
  w.addEventListener("scroll", req, { passive: true });
  w.addEventListener("resize", req);
  spy();
  w.addEventListener("load", spy);
})();
