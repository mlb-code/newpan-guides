/* Newpan guide assistant — chat widget for the Samsung RF65DB970E22EU guide page.
   Load with one line: <script src="assistant/assistant.js" defer></script>
   (assistant.css next to this file is loaded automatically). */
var ASSISTANT_API = "https://newpan-guide-assistant-production.up.railway.app";

(function () {
  "use strict";
  if (window.__nlaLoaded) return;
  window.__nlaLoaded = true;

  var d = document, w = window;
  var script = d.currentScript || (function () { var s = d.getElementsByTagName("script"); return s[s.length - 1]; })();
  var BASE = script && script.src ? script.src.replace(/[^\/]*(\?.*)?$/, "") : "assistant/";
  var API = ASSISTANT_API;
  // local testing only: ?nla_api=http://127.0.0.1:8787 (ignored on any non-local host)
  try {
    var qp = new URLSearchParams(location.search).get("nla_api");
    if (qp && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) API = qp;
  } catch (e) {}
  API = API.replace(/\/+$/, "");

  var STORE = "nla_chat_v1", TEASER_KEY = "nla_teaser_closed", MAX_LEN = 500, HISTORY = 8;
  var GREETING = "היי! אני העוזר של מקרר Samsung RF65DB970E22EU 👋 אפשר לשאול אותי כל שאלה על חיבור קו המים, ההתקנה והשימוש במקרר — אני עונה לפי חוברת ההדרכה.";
  var SUGGESTIONS = ["כמה זמן לחכות לפני שמכניסים אוכל?", "מה עושים אחרי שמחברים את קו המים?", "איך מחליפים את מסנן המים?"];
  var MSG_OFFLINE = "העוזר לא זמין כרגע. נסה שוב בעוד רגע.";

  function ss(op, k, v) {
    try {
      if (op === "get") return w.sessionStorage.getItem(k);
      if (op === "set") w.sessionStorage.setItem(k, v);
      if (op === "del") w.sessionStorage.removeItem(k);
    } catch (e) {}
    return null;
  }
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* --- tiny, safe Markdown: paragraphs, - / 1. lists, **bold**, source tag --- */
  function inline(s) {
    s = esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*\*/g, "");
    return s.replace(/\((?:חוברת|Manual)[^()]{0,60}\)/g, function (m) { return '<span class="nla-src">' + m + "</span>"; });
  }
  function md(text) {
    var lines = String(text).replace(/\r/g, "").split("\n"), out = [], list = null, para = [];
    function flushP() { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } }
    function flushL() { if (list) { out.push("<" + list.t + ">" + list.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + list.t + ">"); list = null; } }
    lines.forEach(function (ln) {
      var t = ln.trim(), m;
      if (!t) { flushP(); flushL(); return; }
      t = t.replace(/^#{1,6}\s+/, "");
      if ((m = t.match(/^[-*•]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); return; }
      if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); return; }
      flushL(); para.push(t);
    });
    flushP(); flushL();
    return out.join("");
  }

  /* --- icons --- */
  var I_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.6-4.4A8 8 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z"/><path d="M8 10.5h8M8 14h5"/></svg>';
  var I_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var I_NEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  var I_SEND = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.4-7.5a1 1 0 0 0 0-1.8L3.4 3.6a.9.9 0 0 0-1.3 1l1.8 6.4 9 1-9 1-1.8 6.4a.9.9 0 0 0 1.3 1z"/></svg>';
  var I_DROP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5s-6.5 7-6.5 11.6a6.5 6.5 0 0 0 13 0C18.5 9.5 12 2.5 12 2.5z"/></svg>';

  /* --- styles --- */
  var css = d.createElement("link");
  css.rel = "stylesheet"; css.href = BASE + "assistant.css?v=1";
  d.head.appendChild(css);

  /* --- DOM --- */
  var root = el("div", "nla-root"); root.setAttribute("dir", "rtl"); root.setAttribute("lang", "he");
  var fab = el("button", "nla-fab", I_CHAT + '<span class="nla-dot" aria-hidden="true"></span>');
  fab.type = "button";
  fab.setAttribute("aria-label", "שאלה על המקרר? פתח את העוזר הדיגיטלי");
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "nla-panel");

  var teaser = el("div", "nla-teaser");
  teaser.hidden = true;
  var tBtn = el("button", "nla-teaser-btn", "יש שאלה על ההתקנה? שאלו אותי<small>עונה מיד, לפי חוברת ההדרכה</small>");
  tBtn.type = "button";
  var tX = el("button", "nla-teaser-x", I_X); tX.type = "button"; tX.setAttribute("aria-label", "סגירת ההודעה");
  teaser.appendChild(tBtn); teaser.appendChild(tX);

  var panel = el("div", "nla-panel"); panel.id = "nla-panel"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "העוזר של המקרר");
  panel.innerHTML =
    '<div class="nla-head">' +
      '<span class="nla-avatar" aria-hidden="true">' + I_DROP + '</span>' +
      '<div class="nla-title"><b>העוזר של המקרר</b><span>עונה לפי חוברת ההדרכה</span></div>' +
      '<button type="button" class="nla-hbtn nla-new" aria-label="שיחה חדשה">' + I_NEW + '<span>שיחה חדשה</span></button>' +
      '<button type="button" class="nla-hbtn nla-close" aria-label="סגירת העוזר">' + I_X + '</button>' +
    '</div>' +
    '<div class="nla-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<form class="nla-form" novalidate>' +
      '<textarea class="nla-input" rows="1" maxlength="' + MAX_LEN + '" placeholder="כתוב שאלה…" aria-label="השאלה שלך"></textarea>' +
      '<button type="submit" class="nla-send" aria-label="שליחה" disabled>' + I_SEND + '</button>' +
    '</form>' +
    '<div class="nla-count" aria-live="polite" hidden></div>' +
    '<p class="nla-note">תשובות מבוססות על חוברת ההדרכה. במקרה של ספק — פנו לטכנאי מוסמך.</p>';

  root.appendChild(teaser); root.appendChild(fab); root.appendChild(panel);

  var log = panel.querySelector(".nla-log"), form = panel.querySelector(".nla-form"), input = panel.querySelector(".nla-input"),
      send = panel.querySelector(".nla-send"), count = panel.querySelector(".nla-count"),
      btnNew = panel.querySelector(".nla-new"), btnClose = panel.querySelector(".nla-close");

  /* --- state --- */
  var history = [], busy = false, ctrl = null, greeted = false, isOpen = false, chipsEl = null;
  try { var saved = JSON.parse(ss("get", STORE) || "[]"); if (Array.isArray(saved)) history = saved.filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"; }); } catch (e) {}
  function save() { ss("set", STORE, JSON.stringify(history.slice(-30))); }

  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function addMsg(role, text) {
    var m = el("div", "nla-msg " + (role === "user" ? "nla-user" : "nla-bot"));
    if (role === "user") m.textContent = text; else m.innerHTML = md(text);
    log.appendChild(m); scrollDown(); return m;
  }
  function typing() {
    var t = el("div", "nla-msg nla-bot nla-typing", '<i aria-hidden="true"><b></b><b></b><b></b></i><span>מקליד…</span>');
    log.appendChild(t); scrollDown(); return t;
  }
  function showChips() {
    if (chipsEl) chipsEl.remove();
    chipsEl = el("div", "nla-chips");
    SUGGESTIONS.forEach(function (q, i) {
      var c = el("button", "nla-chip"); c.type = "button"; c.textContent = q; c.style.animationDelay = (0.08 * i) + "s";
      c.addEventListener("click", function () { ask(q); });
      chipsEl.appendChild(c);
    });
    log.appendChild(chipsEl); scrollDown();
  }
  function hideChips() { if (chipsEl) { chipsEl.remove(); chipsEl = null; } }

  function greet(animate) {
    greeted = true;
    if (!animate) { addMsg("assistant", GREETING); showChips(); return; }
    var t = typing();
    setTimeout(function () {
      t.remove();
      var m = addMsg("assistant", ""), i = 0, step = Math.max(2, Math.round(GREETING.length / 40));
      (function tick() {
        i = Math.min(GREETING.length, i + step);
        m.innerHTML = md(GREETING.slice(0, i)); scrollDown();
        if (i < GREETING.length) setTimeout(tick, 18); else showChips();
      })();
    }, 650);
  }
  function renderAll() {
    log.innerHTML = ""; chipsEl = null;
    greet(false);
    if (history.length) hideChips();
    history.forEach(function (m) { addMsg(m.role, m.content); });
  }

  /* --- open / close --- */
  var desk = w.matchMedia ? w.matchMedia("(min-width: 720px) and (min-height: 520px)") : { matches: true };
  var prevOverflow = "";
  function fitViewport() {
    if (!isOpen || desk.matches || !w.visualViewport) { panel.style.removeProperty("--nla-vh"); panel.style.removeProperty("--nla-top"); return; }
    panel.style.setProperty("--nla-vh", w.visualViewport.height + "px");
    panel.style.setProperty("--nla-top", w.visualViewport.offsetTop + "px");
  }
  function open() {
    if (isOpen) return;
    isOpen = true; dismissTeaser();
    panel.hidden = false; fab.classList.add("is-hidden"); fab.setAttribute("aria-expanded", "true");
    if (!desk.matches) { prevOverflow = d.documentElement.style.overflow; d.documentElement.style.overflow = "hidden"; panel.setAttribute("aria-modal", "true"); }
    else panel.removeAttribute("aria-modal");
    fitViewport();
    if (!greeted) { if (history.length) renderAll(); else greet(true); }
    scrollDown();
    setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, desk.matches ? 50 : 350);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; panel.hidden = true; fab.setAttribute("aria-expanded", "false");
    d.documentElement.style.overflow = prevOverflow;
    syncFab();
    try { fab.focus({ preventScroll: true }); } catch (e) {}
  }
  fab.addEventListener("click", open);
  tBtn.addEventListener("click", open);
  btnClose.addEventListener("click", close);
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) { e.stopPropagation(); close(); }
    if (e.key === "Tab" && isOpen && !desk.matches) { // keep focus inside the full-screen sheet
      var f = [].slice.call(panel.querySelectorAll("button:not([disabled]), textarea")).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }, true);
  if (w.visualViewport) { w.visualViewport.addEventListener("resize", fitViewport); w.visualViewport.addEventListener("scroll", fitViewport); }
  if (desk.addEventListener) desk.addEventListener("change", function () { if (isOpen) { close(); open(); } });

  /* --- teaser: once per visit --- */
  function dismissTeaser() { teaser.hidden = true; ss("set", TEASER_KEY, "1"); }
  tX.addEventListener("click", function (e) { e.stopPropagation(); dismissTeaser(); });
  if (!ss("get", TEASER_KEY) && !history.length) {
    setTimeout(function () { if (!isOpen && !ss("get", TEASER_KEY)) { teaser.hidden = false; syncFab(); } }, 4000);
  }

  /* --- hide the launcher while a video plays or the vertical player is open --- */
  var hero = null, vo = null;
  function videoActive() {
    return !!((hero && hero.classList.contains("is-playing")) || (vo && !vo.hidden && vo.classList.contains("open")) ||
      d.fullscreenElement || d.webkitFullscreenElement);
  }
  function syncFab() {
    var hide = videoActive();
    fab.classList.toggle("is-hidden", hide || isOpen);
    teaser.classList.toggle("is-hidden", hide);
  }
  function watch() {
    hero = d.querySelector(".hero"); vo = d.getElementById("vo");
    if (w.MutationObserver) {
      var mo = new MutationObserver(syncFab);
      if (hero) mo.observe(hero, { attributes: true, attributeFilter: ["class"] });
      if (vo) mo.observe(vo, { attributes: true, attributeFilter: ["class", "hidden"] });
    }
    d.addEventListener("fullscreenchange", syncFab); d.addEventListener("webkitfullscreenchange", syncFab);
    syncFab();
  }

  /* --- composer --- */
  function autosize() {
    input.style.height = "auto"; input.style.height = Math.min(120, input.scrollHeight + 3) + "px";
    var n = input.value.length;
    send.disabled = busy || !input.value.trim();
    count.hidden = n < MAX_LEN - 100; count.textContent = n + "/" + MAX_LEN;
  }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled) ask(input.value); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); if (!send.disabled) ask(input.value); });
  btnNew.addEventListener("click", function () {
    if (ctrl) { try { ctrl.abort(); } catch (e) {} }
    history = []; save(); busy = false; log.innerHTML = ""; chipsEl = null; greet(true);
    input.value = ""; autosize(); try { input.focus({ preventScroll: true }); } catch (e) {}
  });

  function showError(message, retryQ) {
    var m = el("div", "nla-msg nla-err"); m.setAttribute("role", "alert");
    m.appendChild(d.createTextNode(message));
    if (retryQ) {
      var b = el("button", "nla-retry"); b.type = "button"; b.textContent = "נסה שוב";
      b.addEventListener("click", function () { m.remove(); history = history.slice(0, -1); save(); var last = log.querySelectorAll(".nla-user"); if (last.length) last[last.length - 1].remove(); ask(retryQ); });
      m.appendChild(d.createElement("br")); m.appendChild(b);
    }
    log.appendChild(m); scrollDown();
  }

  function ask(raw) {
    var q = String(raw || "").trim().slice(0, MAX_LEN);
    if (!q || busy) return;
    hideChips();
    busy = true; input.value = ""; autosize();
    addMsg("user", q);
    history.push({ role: "user", content: q }); save();
    var t = typing(), bubble = null, text = "", finished = false;
    ctrl = w.AbortController ? new AbortController() : null;
    var myCtrl = ctrl;

    function done() { busy = false; ctrl = null; autosize(); if (bubble) bubble.removeAttribute("aria-busy"); }
    function fail(msg, canRetry) {
      if (t.parentNode) t.remove();
      if (bubble && !text) bubble.remove();
      if (text) { history.push({ role: "assistant", content: text }); save(); }
      showError(msg, canRetry && !text ? q : null);
      done();
    }

    fetch(API + "/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-HISTORY) }),
      signal: myCtrl ? myCtrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          fail(j && j.message ? j.message : MSG_OFFLINE, res.status >= 500);
        });
      }
      if (!res.body || !res.body.getReader) {
        return res.text().then(function (all) { handleChunk(all + "\n\n"); finish(); });
      }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { if (buf) handleChunk(buf + "\n\n"); finish(); return; }
          buf += dec.decode(r.value, { stream: true });
          var cut = buf.lastIndexOf("\n\n");
          if (cut >= 0) { handleChunk(buf.slice(0, cut + 2)); buf = buf.slice(cut + 2); }
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      if (e && e.name === "AbortError") { if (t.parentNode) t.remove(); return; }
      fail(MSG_OFFLINE, true);
    });

    // follow the stream, but never scroll the start of the answer out of view
    function follow() { log.scrollTop = Math.min(log.scrollHeight - log.clientHeight, Math.max(0, bubble.offsetTop - 64)); }
    function ensureBubble() {
      if (!bubble) { if (t.parentNode) t.remove(); bubble = addMsg("assistant", ""); bubble.setAttribute("aria-busy", "true"); }
    }
    function handleChunk(chunk) {
      chunk.split("\n\n").forEach(function (block) {
        var line = block.split("\n").filter(function (l) { return l.indexOf("data:") === 0; }).map(function (l) { return l.slice(5).trim(); }).join("");
        if (!line) return;
        var ev; try { ev = JSON.parse(line); } catch (e) { return; }
        if (ev.type === "delta") { ensureBubble(); text += ev.text; bubble.innerHTML = md(text); follow(); }
        else if (ev.type === "refusal") { ensureBubble(); text = ev.message; bubble.innerHTML = md(text); finished = true; }
        else if (ev.type === "done") { finished = true; }
        else if (ev.type === "error") { finished = "error"; fail(ev.message || MSG_OFFLINE, true); }
      });
    }
    function finish() {
      if (finished === "error") return;
      if (!text) { fail(MSG_OFFLINE, true); return; }
      if (t.parentNode) t.remove();
      history.push({ role: "assistant", content: text }); save();
      done();
    }
  }

  /* --- mount --- */
  function mount() {
    d.body.appendChild(root);
    watch();
    autosize();
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", mount); else mount();
})();
