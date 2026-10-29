/* Newpan guide assistant — chat widget for the Samsung RF65DB970E22EU guide page.
   Load with one line: <script src="assistant/assistant.js" defer></script>
   (assistant.css next to this file is loaded automatically).
   Language: Hebrew by default. On the English page: <script src="../assistant/assistant.js" data-lang="en" defer></script>
   (or <html lang="en">) — the widget's own strings switch to English and the chat is kept separately per language.
   The server answers in the language of the question; its own error / refusal messages are Hebrew, so the widget
   shows its English equivalents instead when the page is English. */
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

  /* --- language: data-lang on the script tag, else the page's <html lang> --- */
  var LANG = String((script && script.getAttribute("data-lang")) || d.documentElement.lang || "he").slice(0, 2).toLowerCase() === "en" ? "en" : "he";
  var TEXT = {
    he: {
      greeting: "היי! אני העוזר של מקרר Samsung RF65DB970E22EU 👋 אפשר לשאול אותי כל שאלה על חיבור קו המים, ההתקנה והשימוש במקרר — אני עונה לפי חוברת ההדרכה.",
      suggestions: ["כמה זמן לחכות לפני שמכניסים אוכל?", "מה עושים אחרי שמחברים את קו המים?", "איך מחליפים את מסנן המים?"],
      offline: "העוזר לא זמין כרגע. נסה שוב בעוד רגע.",
      fab: "שאל את ה-AI: העוזר הדיגיטלי של המקרר",
      fabLabel: "שאל את ה-<b>AI</b>",
      teaser: '<span class="nla-ai-tag">AI</span>יש שאלה על ההתקנה? שאל אותי<small>עוזר בינה מלאכותית, עונה מיד לפי חוברת ההדרכה</small>',
      teaserClose: "סגירת ההודעה",
      panel: "העוזר של המקרר",
      title: "העוזר של המקרר", subtitle: "בינה מלאכותית · עונה לפי חוברת ההדרכה",
      newChat: "שיחה חדשה", close: "סגירת העוזר",
      placeholder: "כתוב שאלה…", inputLabel: "השאלה שלך", send: "שליחה",
      note: "תשובות מבוססות על חוברת ההדרכה. במקרה של ספק — פנו לטכנאי מוסמך.",
      typing: "מקליד…", retry: "נסה שוב",
      // server messages are shown as they come (they are Hebrew)
      server: null
    },
    en: {
      greeting: "Hi! I'm the assistant for the Samsung RF65DB970E22EU refrigerator 👋 Ask me anything about connecting the water line, installing and using the refrigerator — I answer from the user manual.",
      suggestions: ["How long should I wait before putting food in?", "What do I do after connecting the water line?", "How do I replace the water filter?"],
      offline: "The assistant isn't available right now. Please try again in a moment.",
      fab: "Ask AI: the refrigerator's digital assistant",
      fabLabel: "Ask <b>AI</b>",
      teaser: '<span class="nla-ai-tag">AI</span>Have a question about the installation? Ask me<small>AI assistant, answers right away from the user manual</small>',
      teaserClose: "Close this message",
      panel: "Refrigerator assistant",
      title: "Refrigerator assistant", subtitle: "AI · answers from the user manual",
      newChat: "New chat", close: "Close the assistant",
      placeholder: "Type a question…", inputLabel: "Your question", send: "Send",
      note: "Answers are based on the user manual. If in doubt, contact a qualified technician.",
      typing: "Typing…", retry: "Try again",
      // the server's own messages are Hebrew: shown in English here, by their error code
      server: {
        refusal: "Sorry, I can't answer that here. You can ask me about installing and using the refrigerator; for anything else, please contact Newpan customer service.",
        bad_request: "The question is empty or too long (up to 500 characters).",
        rate_limit: "You've asked many questions in a short time. Please try again in a few minutes.",
        daily_cap: "The assistant is busy today. Please try again tomorrow, or contact Newpan customer service.",
        busy: "The assistant is busy right now. Please try again in a minute.",
        upstream: "Something went wrong. Please try again in a moment."
      }
    }
  };
  var T = TEXT[LANG];
  function serverMsg(code, fallback) {
    if (T.server && T.server[code]) return T.server[code];
    return LANG === "en" ? T.offline : (fallback || T.offline);
  }

  var STORE = "nla_chat_v1" + (LANG === "en" ? "_en" : ""), TEASER_KEY = "nla_teaser_closed", MAX_LEN = 500, HISTORY = 8;
  var GREETING = T.greeting;
  var SUGGESTIONS = T.suggestions;
  var MSG_OFFLINE = T.offline;

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
  var I_SPARK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 2.5c.3 4.9 2.6 7.2 7.5 7.5-4.9.3-7.2 2.6-7.5 7.5-.3-4.9-2.6-7.2-7.5-7.5 4.9-.3 7.2-2.6 7.5-7.5z"/><path d="M18.5 13.5c.2 2.6 1.4 3.8 4 4-2.6.2-3.8 1.4-4 4-.2-2.6-1.4-3.8-4-4 2.6-.2 3.8-1.4 4-4z"/><path d="M5.5 15.5c.15 1.9 1 2.75 2.9 2.9-1.9.15-2.75 1-2.9 2.9-.15-1.9-1-2.75-2.9-2.9 1.9-.15 2.75-1 2.9-2.9z" opacity=".85"/></svg>';
  var I_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var I_NEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  var I_SEND = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.4-7.5a1 1 0 0 0 0-1.8L3.4 3.6a.9.9 0 0 0-1.3 1l1.8 6.4 9 1-9 1-1.8 6.4a.9.9 0 0 0 1.3 1z"/></svg>';

  /* --- styles --- */
  var css = d.createElement("link");
  css.rel = "stylesheet"; css.href = BASE + "assistant.css?v=3";
  d.head.appendChild(css);

  /* --- DOM --- */
  var root = el("div", "nla-root"); root.setAttribute("dir", LANG === "en" ? "ltr" : "rtl"); root.setAttribute("lang", LANG);
  var fab = el("button", "nla-fab", '<span class="nla-spark" aria-hidden="true">' + I_SPARK + '</span><span class="nla-label" aria-hidden="true">' + T.fabLabel + '</span>');
  fab.type = "button";
  fab.setAttribute("aria-label", T.fab);
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "nla-panel");

  var teaser = el("div", "nla-teaser");
  teaser.hidden = true;
  var tBtn = el("button", "nla-teaser-btn", T.teaser);
  tBtn.type = "button";
  var tX = el("button", "nla-teaser-x", I_X); tX.type = "button"; tX.setAttribute("aria-label", T.teaserClose);
  teaser.appendChild(tBtn); teaser.appendChild(tX);

  var panel = el("div", "nla-panel"); panel.id = "nla-panel"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", T.panel);
  panel.innerHTML =
    '<div class="nla-head">' +
      '<span class="nla-avatar" aria-hidden="true">' + I_SPARK + '</span>' +
      '<div class="nla-title"><b>' + T.title + '</b><span>' + T.subtitle + '</span></div>' +
      '<button type="button" class="nla-hbtn nla-new" aria-label="' + T.newChat + '">' + I_NEW + '<span>' + T.newChat + '</span></button>' +
      '<button type="button" class="nla-hbtn nla-close" aria-label="' + T.close + '">' + I_X + '</button>' +
    '</div>' +
    '<div class="nla-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<form class="nla-form" novalidate>' +
      '<textarea class="nla-input" rows="1" maxlength="' + MAX_LEN + '" placeholder="' + T.placeholder + '" aria-label="' + T.inputLabel + '"></textarea>' +
      '<button type="submit" class="nla-send" aria-label="' + T.send + '" disabled>' + I_SEND + '</button>' +
    '</form>' +
    '<div class="nla-count" aria-live="polite" hidden></div>' +
    '<p class="nla-note">' + T.note + '</p>';

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
    var t = el("div", "nla-msg nla-bot nla-typing", '<i aria-hidden="true"><b></b><b></b><b></b></i><span>' + T.typing + '</span>');
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

  /* --- hide the launcher while a video plays or the vertical player is open, and while it would sit on the hero's
         CTA buttons / tap graphic (bottom-left of the hero on phones); lift it above the page's chapter bar +
         "to the video" pill (same bottom-left corner) once they slide in --- */
  var hero = null, vo = null, chapbar = null, toVideo = null, cta = null, tap = null, lastLift = null, raf = 0;
  var nudgeAt = Date.now() + 3000, nudged = !!history.length ||
    !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function videoActive() {
    return !!((hero && hero.classList.contains("is-playing")) || (vo && !vo.hidden && vo.classList.contains("open")) ||
      d.fullscreenElement || d.webkitFullscreenElement);
  }
  function heroBlocks(box) { // would this box (launcher / teaser) cover the hero's CTA buttons or the tap graphic right now?
    if (!cta && !tap) return false;
    var l = box.offsetLeft, t = box.offsetTop, r = l + box.offsetWidth, b = t + box.offsetHeight, M = 10;
    function hit(e) {
      if (!e) return false;
      var x = e.getBoundingClientRect();
      return x.width > 0 && x.left < r + M && x.right > l - M && x.top < b + M && x.bottom > t - M;
    }
    return hit(cta) || hit(tap);
  }
  function syncFab() {
    var lift = 0;
    if (chapbar && chapbar.classList.contains("on")) lift += chapbar.offsetHeight || 54;
    if (toVideo && !toVideo.hidden && toVideo.classList.contains("on") && toVideo.offsetHeight > 0) lift += toVideo.offsetHeight + 10;
    if (lift !== lastLift) { lastLift = lift; root.style.setProperty("--nla-lift", lift + "px"); setTimeout(syncFab, 450); } // re-check once it has moved
    var hide = videoActive() || heroBlocks(fab);
    fab.classList.toggle("is-hidden", hide || isOpen);
    teaser.classList.toggle("is-hidden", hide || (!teaser.hidden && heroBlocks(teaser)));
    if (!nudged && !hide && !isOpen && Date.now() >= nudgeAt) nudge();
  }
  function onScroll() { if (!raf) raf = w.requestAnimationFrame(function () { raf = 0; syncFab(); }); }
  /* one-time attention pulse: two rings, ~3 s after load or as soon as the launcher is first shown; then the class goes (no endless animation) */
  function nudge() {
    nudged = true;
    fab.classList.add("is-nudge");
    var off = function () { fab.classList.remove("is-nudge"); fab.removeEventListener("animationend", off); };
    fab.addEventListener("animationend", off);
    setTimeout(off, 3200);
  }
  function watch() {
    hero = d.querySelector(".hero"); vo = d.getElementById("vo"); chapbar = d.getElementById("chapbar"); toVideo = d.getElementById("toVideo");
    cta = hero && hero.querySelector(".cta"); tap = hero && hero.querySelector(".tap");
    if (w.MutationObserver) {
      var mo = new MutationObserver(syncFab);
      if (hero) mo.observe(hero, { attributes: true, attributeFilter: ["class"] });
      if (vo) mo.observe(vo, { attributes: true, attributeFilter: ["class", "hidden"] });
      if (chapbar) mo.observe(chapbar, { attributes: true, attributeFilter: ["class"] });
      if (toVideo) mo.observe(toVideo, { attributes: true, attributeFilter: ["class", "hidden"] });
    }
    w.addEventListener("resize", syncFab);
    w.addEventListener("scroll", onScroll, { passive: true });
    fab.addEventListener("transitionend", function (e) { if (e.propertyName === "bottom") syncFab(); });
    setTimeout(syncFab, 3050);
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
      var b = el("button", "nla-retry"); b.type = "button"; b.textContent = T.retry;
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
          fail(serverMsg(j && j.error, j && j.message), res.status >= 500);
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
        else if (ev.type === "refusal") { ensureBubble(); text = serverMsg("refusal", ev.message); bubble.innerHTML = md(text); finished = true; }
        else if (ev.type === "done") { finished = true; }
        else if (ev.type === "error") { finished = "error"; fail(serverMsg(ev.code, ev.message), true); }
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
