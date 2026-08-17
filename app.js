/* Rio Training — shared training log.
   Data lives in one Supabase row that both people read and write.
   No framework, no build step: GitHub Pages serves these files as-is. */

(function () {
  "use strict";

  // ---------------------------------------------------------------- constants
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var DOW = ["S","M","T","W","T","F","S"];
  var SEED_SESSIONS = [
    "2026-03-02","2026-03-04","2026-03-09","2026-03-11",
    "2026-03-16","2026-03-18","2026-03-23","2026-03-25",
    "2026-04-01","2026-04-04",
    "2026-05-04","2026-05-11","2026-05-13","2026-05-15",
    "2026-05-18","2026-05-20","2026-05-23","2026-05-25",
    "2026-06-03","2026-06-08","2026-06-10","2026-06-13",
    "2026-06-15","2026-06-17"
  ];
  var SAVE_DEBOUNCE = 700;
  var RETRY_DELAYS = [400, 900, 2000];
  var REFRESH_MS = 15000;
  var FAIL_RETRY_MS = 15000;
  var CACHE_KEY = "rio-training-cache";
  var WHO_KEY = "rio-training-who";

  // ---------------------------------------------------------------- utilities
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }
  function longDate(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-GB",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function shortDate(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-GB",
      { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function ytId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  var ICONS = {
    left: "M15 18l-6-6 6-6", right: "M9 18l6-6-6-6", plus: "M12 5v14M5 12h14",
    pencil: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
    trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
    external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
    play: "M6 3l14 9-14 9z", x: "M18 6L6 18M6 6l12 12",
    search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    database: "M3 5c0 1.66 4 3 9 3s9-1.34 9-3-4-3-9-3-9 1.34-9 3zM3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3",
    calendar: "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18",
    dumbbell: "M4 8v8M8 5v14M16 5v14M20 8v8M8 12h8"
  };
  function icon(name, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[name] + '"/></svg>';
  }

  // ------------------------------------------------------------- data shaping
  function seedData() {
    var sessions = {};
    SEED_SESSIONS.forEach(function (d) { sessions[d] = { notes: "", by: "Rio", entries: [] }; });
    function ex(name, type, target) {
      return { id: uid(), name: name, type: type, target: target, url: "", notes: "" };
    }
    return {
      sessions: sessions,
      categories: [
        { id: uid(), name: "Gym", exercises: [
          ex("Goblet squat", "strength", "3 x 10"),
          ex("Romanian deadlift", "strength", "3 x 8"),
          ex("Dumbbell bench press", "strength", "3 x 10"),
          ex("Bent-over row", "strength", "3 x 10"),
          ex("Shoulder press", "strength", "3 x 10"),
          ex("Plank", "hold", "3 x 45s")
        ]},
        { id: uid(), name: "Stretches", exercises: [
          ex("Hamstring stretch", "hold", "30s each side"),
          ex("Hip flexor lunge", "hold", "30s each side"),
          ex("Thoracic rotation", "hold", "8 reps each side")
        ]},
        { id: uid(), name: "Foam rolling", exercises: [
          ex("Quads", "hold", "60s each leg"),
          ex("IT band", "hold", "45s each leg"),
          ex("Upper back", "hold", "60s")
        ]}
      ]
    };
  }
  function migrate(d) {
    if (!d || typeof d !== "object") return seedData();
    var out = { sessions: {}, categories: [] };
    Object.keys(d.sessions || {}).forEach(function (k) {
      var s = d.sessions[k] || {};
      out.sessions[k] = {
        notes: s.notes || "", by: s.by || "",
        entries: Array.isArray(s.entries) ? s.entries : []
      };
    });
    (d.categories || []).forEach(function (c) {
      out.categories.push({
        id: c.id || uid(), name: c.name || "Untitled",
        exercises: (c.exercises || []).map(function (e) {
          return {
            id: e.id || uid(), name: e.name || "",
            type: e.type === "strength" ? "strength" : "hold",
            target: e.target || "", url: e.url || "", notes: e.notes || ""
          };
        })
      });
    });
    if (!out.categories.length) out.categories = seedData().categories;
    return out;
  }
  function findExercise(data, id) {
    for (var i = 0; i < (data.categories || []).length; i++) {
      var c = data.categories[i];
      for (var j = 0; j < (c.exercises || []).length; j++) {
        if (c.exercises[j].id === id) return { ex: c.exercises[j], cat: c };
      }
    }
    return null;
  }
  function summarise(entry, ex) {
    var bits = [], hold = !ex || ex.type === "hold";
    if (entry.sets) bits.push(entry.sets + " x");
    if (entry.reps) bits.push(entry.reps + (hold ? "s" : ""));
    if (!hold && entry.weight) bits.push("@ " + entry.weight + "kg");
    return bits.join(" ");
  }
  function csvCell(v) {
    var s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(data) {
    var rows = [["Type","Date","Day","Category","Exercise","Kind","Sets",
                 "Reps or seconds","Weight (kg)","Target","Video link","Notes","Logged by"]];
    Object.keys(data.sessions || {}).sort().forEach(function (k) {
      var s = data.sessions[k] || {}, p = k.split("-").map(Number);
      var day = new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-GB", { weekday: "long" });
      rows.push(["Session", k, day, "", "", "", "", "", "", "", "", s.notes || "", s.by || ""]);
      (s.entries || []).forEach(function (en) {
        var f = findExercise(data, en.exerciseId);
        rows.push(["Logged exercise", k, day, f ? f.cat.name : "",
          f ? f.ex.name : en.name || "(deleted exercise)", f ? f.ex.type : "",
          en.sets || "", en.reps || "", en.weight || "", "", "", en.notes || "", s.by || ""]);
      });
    });
    (data.categories || []).forEach(function (c) {
      (c.exercises || []).forEach(function (e) {
        rows.push(["Exercise (database)", "", "", c.name, e.name, e.type,
          "", "", "", e.target || "", e.url || "", e.notes || "", ""]);
      });
    });
    return "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
  }
  function saveFile(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  // ------------------------------------------------------------------ backend
  var CFG = window.CONFIG || {};
  function configured() {
    return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON &&
      CFG.SUPABASE_URL.indexOf("PASTE_") === -1 &&
      CFG.SUPABASE_ANON.indexOf("PASTE_") === -1);
  }
  function room() {
    var m = String(location.hash || "").match(/room=([A-Za-z0-9_-]+)/);
    return m ? m[1] : (CFG.ROOM || "default");
  }
  function headers() {
    return { apikey: CFG.SUPABASE_ANON, Authorization: "Bearer " + CFG.SUPABASE_ANON };
  }
  function base() {
    return String(CFG.SUPABASE_URL).replace(/\/+$/, "") + "/rest/v1/" + (CFG.TABLE || "training");
  }
  async function remoteGet() {
    var url = base() + "?id=eq." + encodeURIComponent(room()) + "&select=doc,updated_at";
    var r = await fetch(url, { headers: headers() });
    if (!r.ok) throw new Error("read failed " + r.status + " " + (await r.text()).slice(0, 120));
    var rows = await r.json();
    return rows && rows.length ? rows[0] : null;
  }
  async function remotePut(doc) {
    var h = headers();
    h["Content-Type"] = "application/json";
    h.Prefer = "resolution=merge-duplicates,return=representation";
    var r = await fetch(base(), {
      method: "POST", headers: h,
      body: JSON.stringify([{ id: room(), doc: doc, updated_at: new Date().toISOString() }])
    });
    if (!r.ok) throw new Error("write failed " + r.status + " " + (await r.text()).slice(0, 120));
    var rows = await r.json();
    return rows && rows.length ? rows[0] : null;
  }

  // ------------------------------------------------------------------- state
  var S = {
    data: { sessions: {}, categories: [] },
    who: lsGet(WHO_KEY),
    tab: "log",
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    sel: null, picking: false,
    openCat: null, editing: null, video: null,
    addingCat: false, adding: false,
    form: { name: "", type: "strength", target: "", url: "", notes: "" },
    saveState: "idle", error: null, diag: "",
    note: null, staged: null, pasting: false,
    ready: false, offline: false
  };

  // Session keys (and "*categories*") changed here but not yet merged remotely.
  // On write we re-read, then re-apply only these — so the other person's edits
  // to other days survive instead of being clobbered by a whole-doc overwrite.
  var dirty = new Set();
  var savedAt = null;      // updated_at of the last doc we know about
  var pendingSave = false;
  var writing = false;
  var timer = null;
  // Bumped on every edit. A write that finishes on a stale epoch must not clear
  // the dirty set, or edits made while it was in flight would be thrown away.
  var editEpoch = 0;

  function markDirty(k) { dirty.add(k); }

  function mergeDocs(remote, local, dirtyKeys) {
    if (!remote) return local;
    var out = { sessions: {}, categories: [] };
    var keys = {};
    Object.keys(remote.sessions || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(local.sessions || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      if (dirtyKeys.has(k)) {
        // Locally touched — local wins, and a local deletion stays deleted.
        if (local.sessions[k]) out.sessions[k] = local.sessions[k];
      } else if (remote.sessions[k]) {
        out.sessions[k] = remote.sessions[k];
      } else if (local.sessions[k] && !remote.sessions) {
        out.sessions[k] = local.sessions[k];
      }
    });
    out.categories = dirtyKeys.has("*categories*")
      ? local.categories
      : (remote.categories && remote.categories.length ? remote.categories : local.categories);
    return out;
  }

  function cacheLocally() {
    lsSet(CACHE_KEY, JSON.stringify({ doc: S.data, at: Date.now() }));
  }

  // -------------------------------------------------------------- sync engine
  async function flush() {
    if (writing || !pendingSave) return;
    if (!configured()) return;
    writing = true;
    setStatus("saving");
    var ok = false, lastErr = "";
    for (var attempt = 0; attempt <= RETRY_DELAYS.length && !ok; attempt++) {
      if (attempt) { setStatus("retrying"); await sleep(RETRY_DELAYS[attempt - 1]); }
      var epoch = editEpoch;
      try {
        var current = await remoteGet();
        var merged = (current && current.updated_at !== savedAt)
          ? mergeDocs(migrate(current.doc), S.data, dirty)
          : S.data;
        var saved = await remotePut(merged);
        S.data = merged;
        savedAt = saved ? saved.updated_at : null;
        ok = true;
        if (editEpoch === epoch) { dirty.clear(); pendingSave = false; }
      } catch (e) {
        lastErr = e && e.message ? e.message : String(e);
      }
    }
    writing = false;
    cacheLocally();
    if (ok) {
      S.error = null; S.offline = false; S.diag = "";
      setStatus("saved");
      setTimeout(function () { if (S.saveState === "saved") setStatus("idle"); }, 1200);
      render();
      // Edits landed while that write was in flight — go round again.
      if (pendingSave) { clearTimeout(timer); timer = setTimeout(flush, SAVE_DEBOUNCE); }
    } else {
      S.offline = true;
      S.error = "Couldn't reach the shared log. Your changes are safe on this device and " +
                "will keep retrying — leave the page open if you can.";
      S.diag = lastErr;
      setStatus("failed");
      clearTimeout(timer);
      timer = setTimeout(flush, FAIL_RETRY_MS);
      render();
    }
  }
  function scheduleSave() {
    editEpoch++;
    pendingSave = true;
    cacheLocally();
    setStatus("saving");
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DEBOUNCE);
  }
  function setStatus(s) {
    S.saveState = s;
    var el = document.getElementById("status");
    if (!el) return;
    el.className = "status " + s + (s === "idle" ? " hidden" : "");
    el.textContent = s === "saving" ? "Saving…" : s === "saved" ? "Saved"
      : s === "retrying" ? "Retrying…" : s === "failed" ? "Not saved" : "";
  }

  async function initialLoad() {
    var cached = null;
    try {
      var c = lsGet(CACHE_KEY);
      if (c) cached = JSON.parse(c).doc;
    } catch (e) { cached = null; }

    if (!configured()) { S.ready = true; render(); return; }

    var row = null, err = "";
    for (var attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt) await sleep(RETRY_DELAYS[attempt - 1]);
      try { row = await remoteGet(); err = ""; break; }
      catch (e) { err = e && e.message ? e.message : String(e); }
    }
    if (err) {
      // Never seed over a log we simply failed to read.
      S.data = cached ? migrate(cached) : seedData();
      S.offline = true;
      S.error = "Can't reach the shared log right now" +
        (cached ? ", so this is the last copy saved on this device." :
                  ". Nothing has loaded yet, so this is starter data — don't rely on it.");
      S.diag = err;
      setStatus("failed");
      S.ready = true; render();
      clearTimeout(timer); timer = setTimeout(retryLoad, FAIL_RETRY_MS);
      return;
    }
    if (row) {
      S.data = migrate(row.doc);
      savedAt = row.updated_at;
    } else {
      S.data = cached ? migrate(cached) : seedData();
      dirty.add("*categories*");
      Object.keys(S.data.sessions).forEach(function (k) { dirty.add(k); });
      scheduleSave();
    }
    cacheLocally();
    S.ready = true;
    render();
  }
  async function retryLoad() {
    if (pendingSave) { flush(); return; }
    try {
      var row = await remoteGet();
      if (row) { S.data = migrate(row.doc); savedAt = row.updated_at; cacheLocally(); }
      S.offline = false; S.error = null; S.diag = "";
      setStatus("idle"); render();
    } catch (e) {
      clearTimeout(timer); timer = setTimeout(retryLoad, FAIL_RETRY_MS);
    }
  }

  // Pick up the other person's edits while this device has nothing unsaved.
  setInterval(async function () {
    if (!S.ready || !configured() || pendingSave || writing) return;
    if (document.visibilityState === "hidden") return;
    try {
      var row = await remoteGet();
      if (!row || row.updated_at === savedAt) return;
      savedAt = row.updated_at;
      S.data = migrate(row.doc);
      cacheLocally();
      if (S.offline) { S.offline = false; S.error = null; S.diag = ""; setStatus("idle"); }
      render();
    } catch (e) { /* the write path reports real trouble */ }
  }, REFRESH_MS);

  window.addEventListener("pagehide", function () { if (pendingSave) flush(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && pendingSave) flush();
  });

  // ------------------------------------------------------------------ actions
  function ensureSession(key) {
    if (!S.data.sessions[key]) {
      S.data.sessions[key] = { notes: "", by: S.who, entries: [] };
      markDirty(key); scheduleSave();
    }
  }

  // ------------------------------------------------------------------ renders
  function viewSetup() {
    return '<div class="center-screen"><div class="card setup">' +
      '<h1 style="margin:0 0 .5rem;font-size:1.125rem;font-weight:500">Almost there</h1>' +
      '<p class="muted" style="margin:0 0 .75rem">' +
      'This app needs its database details before it can save anything. Open ' +
      '<code>config.js</code> and fill in the two values from your Supabase project ' +
      '(Project Settings → API), then reload.</p>' +
      '<ol class="muted" style="line-height:1.6">' +
      '<li><code>SUPABASE_URL</code> — the Project URL</li>' +
      '<li><code>SUPABASE_ANON</code> — the anon / publishable key</li>' +
      '</ol>' +
      '<p class="fineprint" style="margin-top:.75rem">Run <code>schema.sql</code> once in the ' +
      'Supabase SQL editor first, so the table exists.</p>' +
      '</div></div>';
  }
  function viewWho() {
    return '<div class="center-screen"><div class="card" style="width:100%;max-width:20rem">' +
      '<h1 style="margin:0;font-size:1.125rem;font-weight:500">Who\'s logging?</h1>' +
      '<p class="muted" style="margin:.25rem 0 1.25rem">So entries show who added them. ' +
      'You can change this later.</p>' +
      '<div class="stack-sm">' +
      '<button class="btn primary" data-act="who" data-v="Rio">Rio</button>' +
      '<button class="btn outline" data-act="who" data-v="Trainer">Trainer</button>' +
      '</div></div></div>';
  }

  function viewLog() {
    var sessions = S.data.sessions || {};
    var todayKey = toKey(new Date());
    var start = new Date(S.year, S.month, 1).getDay();
    var count = new Date(S.year, S.month + 1, 0).getDate();
    var h = '<div class="card"><div class="cal-head">' +
      '<div class="cal-title">' + MONTHS[S.month] + ' <span>' + S.year + '</span></div>' +
      '<div class="cal-nav">' +
      '<button class="btn-sm" data-act="today">Today</button>' +
      '<button class="btn-icon" data-act="mon" data-v="-1" aria-label="Previous month">' + icon("left") + '</button>' +
      '<button class="btn-icon" data-act="mon" data-v="1" aria-label="Next month">' + icon("right") + '</button>' +
      '</div></div><div class="grid7">';
    DOW.forEach(function (d) { h += '<div class="dow">' + d + '</div>'; });
    h += '</div><div class="grid7">';
    for (var i = 0; i < start; i++) h += '<div></div>';
    for (var d = 1; d <= count; d++) {
      var key = toKey(new Date(S.year, S.month, d));
      var s = sessions[key];
      var cls = "day" + (s ? " has" : key === S.sel ? " sel" : key === todayKey ? " today" : "");
      h += '<button class="' + cls + '" data-act="day" data-v="' + key + '">' + d +
        (s && (s.entries || []).length ? '<span class="dot"></span>' : "") + '</button>';
    }
    var inMonth = Object.keys(sessions).filter(function (k) {
      var p = k.split("-").map(Number);
      return p[0] === S.year && p[1] === S.month + 1;
    }).length;
    var all = Object.keys(sessions).sort().reverse();
    h += '</div><p class="muted" style="margin:.75rem 0 0">' + inMonth + ' session' +
      (inMonth === 1 ? "" : "s") + ' this month · ' + all.length + ' total</p></div>';

    if (S.sel && sessions[S.sel]) h += viewSession(sessions[S.sel]);

    h += '<div style="margin-top:1rem"><p class="muted" style="margin:0 0 .5rem">All sessions</p>';
    all.forEach(function (key) {
      var s = sessions[key], n = (s.entries || []).length;
      var summary = (s.entries || []).map(function (en) {
        var f = findExercise(S.data, en.exerciseId);
        var nm = f ? f.ex.name : "?";
        var sm = summarise(en, f ? f.ex : null);
        return sm ? nm + " " + sm : nm;
      }).join(" · ");
      h += '<button class="list-btn" data-act="day" data-v="' + key + '">' +
        '<div class="between"><span style="font-size:.875rem;font-weight:500">' + shortDate(key) +
        '</span><span class="faint">' + (n ? n + " exercise" + (n === 1 ? "" : "s") : "no exercises") +
        '</span></div>' +
        (summary ? '<p class="muted truncate" style="margin:.15rem 0 0">' + esc(summary) + '</p>' : "") +
        (s.notes ? '<p class="faint" style="margin:.15rem 0 0">' + esc(s.notes) + '</p>' : "") +
        '</button>';
    });
    return h + "</div>";
  }

  function viewSession(session) {
    var h = '<div class="card" style="margin-top:1rem"><div class="between" style="align-items:flex-start">' +
      '<div><p class="muted" style="margin:0">Session</p>' +
      '<p style="margin:.1rem 0 0;font-size:.875rem;font-weight:500">' + longDate(S.sel) + '</p>' +
      (session.by ? '<p class="faint" style="margin:.1rem 0 0">Logged by ' + esc(session.by) + '</p>' : "") +
      '</div><button data-act="close" aria-label="Close" style="color:var(--faint)">' + icon("x") + '</button></div>';

    (session.entries || []).forEach(function (en) {
      var f = findExercise(S.data, en.exerciseId);
      var ex = f ? f.ex : null;
      var hold = !ex || ex.type === "hold";
      h += '<div class="entry"><div class="entry-head"><div style="min-width:0">' +
        '<p style="margin:0;font-size:.875rem;font-weight:500">' +
        esc(ex ? ex.name : "(deleted exercise)") + '</p>' +
        (f ? '<p class="faint" style="margin:0">' + esc(f.cat.name) + '</p>' : "") +
        '</div><button data-act="rm-entry" data-v="' + en.id + '" aria-label="Remove exercise" ' +
        'style="color:var(--faint)">' + icon("trash", 15) + '</button></div>' +
        '<div class="fields ' + (hold ? "n2" : "n3") + '">' +
        numField("Sets", en.id, "sets", en.sets) +
        numField(hold ? "Seconds" : "Reps", en.id, "reps", en.reps) +
        (hold ? "" : numField("Weight kg", en.id, "weight", en.weight)) +
        '</div><input class="note" data-in="entry" data-id="' + en.id + '" data-f="notes" ' +
        'value="' + esc(en.notes || "") + '" placeholder="Note (optional)"></div>';
    });

    if (S.picking) {
      h += '<div class="picker"><div class="picker-head">' +
        '<span style="color:var(--faint)">' + icon("search", 15) + '</span>' +
        '<input id="pick-q" placeholder="Search exercises" data-in="pickq" style="flex:1">' +
        '<button data-act="pick-cancel" aria-label="Cancel" style="color:var(--faint)">' + icon("x") + '</button>' +
        '</div><div class="picker-list" id="pick-list">' + pickList("") + '</div></div>';
    } else {
      h += '<button class="btn dashed" style="margin-top:.5rem" data-act="pick">' +
        icon("plus") + ' Add exercise</button>';
    }
    h += '<input class="big" style="margin-top:.75rem" data-in="snote" ' +
      'value="' + esc(session.notes || "") + '" placeholder="Session note (optional)">' +
      '<button class="btn danger-text" style="justify-content:flex-start;margin-top:.5rem" ' +
      'data-act="rm-session">' + icon("trash", 14) + ' Remove this session</button></div>';
    return h;
  }
  function numField(label, id, field, value) {
    return '<label class="num"><span>' + label + '</span>' +
      '<input class="num-in" inputmode="decimal" placeholder="–" data-in="entry" ' +
      'data-id="' + id + '" data-f="' + field + '" value="' + esc(value || "") + '"></label>';
  }
  function pickList(term) {
    term = (term || "").trim().toLowerCase();
    var h = "", any = false;
    (S.data.categories || []).forEach(function (c) {
      var hits = (c.exercises || []).filter(function (e) {
        return !term || e.name.toLowerCase().indexOf(term) !== -1;
      });
      if (!hits.length) return;
      any = true;
      h += '<div style="margin-bottom:.75rem"><p class="cap">' + esc(c.name) + '</p>';
      hits.forEach(function (e) {
        h += '<button class="pick" data-act="add-ex" data-v="' + e.id + '">' + esc(e.name) +
          (e.target ? ' <span class="faint">' + esc(e.target) + '</span>' : "") + '</button>';
      });
      h += '</div>';
    });
    return any ? h : '<p class="faint" style="padding:.5rem 0">Nothing matches. Add it in the Exercises tab first.</p>';
  }

  function viewExercises() {
    var cats = S.data.categories || [];
    var cat = cats.filter(function (c) { return c.id === S.openCat; })[0];
    if (!cat) {
      var total = cats.reduce(function (a, c) { return a + c.exercises.length; }, 0);
      var h = '<p class="muted">' + total + ' exercise' + (total === 1 ? "" : "s") +
        ' across ' + cats.length + ' categor' + (cats.length === 1 ? "y" : "ies") + '</p>';
      cats.forEach(function (c) {
        h += '<button class="card" style="width:100%;text-align:left;display:flex;' +
          'align-items:center;justify-content:space-between;margin-bottom:.75rem" ' +
          'data-act="open-cat" data-v="' + c.id + '"><span><span style="font-size:.875rem;' +
          'font-weight:500;display:block">' + esc(c.name) + '</span><span class="muted">' +
          c.exercises.length + ' exercise' + (c.exercises.length === 1 ? "" : "s") + '</span></span>' +
          '<span style="color:var(--faint)">' + icon("right", 18) + '</span></button>';
      });
      if (S.addingCat) {
        h += '<div class="card"><input class="big" id="cat-name" placeholder="Mobility">' +
          '<div class="row2" style="margin-top:.5rem">' +
          '<button class="btn primary" data-act="save-cat">Add category</button>' +
          '<button class="btn outline narrow" data-act="cancel-cat">Cancel</button></div></div>';
      } else {
        h += '<button class="btn dashed" data-act="new-cat">' + icon("plus") + ' New category</button>';
      }
      return h;
    }
    var h2 = '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">' +
      '<button class="btn-icon" data-act="back-cat" aria-label="Back">' + icon("left") + '</button>' +
      '<span style="font-size:1rem;font-weight:500">' + esc(cat.name) + '</span></div>';
    cat.exercises.forEach(function (e) {
      h2 += S.editing === e.id ? exerciseEditor(e) : exerciseCard(e);
    });
    if (S.adding) {
      h2 += '<div class="card"><input class="big" id="nx-name" placeholder="Exercise name" ' +
        'value="' + esc(S.form.name) + '">' +
        '<div class="seg" style="margin-top:.5rem">' +
        '<button class="' + (S.form.type === "strength" ? "on" : "") + '" data-act="nx-type" data-v="strength">Sets / reps / weight</button>' +
        '<button class="' + (S.form.type === "hold" ? "on" : "") + '" data-act="nx-type" data-v="hold">Sets / seconds</button>' +
        '</div>' +
        '<input class="big" style="margin-top:.5rem" id="nx-target" placeholder="Target, e.g. 3 x 10" value="' + esc(S.form.target) + '">' +
        '<input class="big" style="margin-top:.5rem" id="nx-url" placeholder="Video link (optional)" value="' + esc(S.form.url) + '">' +
        '<input class="big" style="margin-top:.5rem" id="nx-notes" placeholder="Notes (optional)" value="' + esc(S.form.notes) + '">' +
        '<div class="row2" style="margin-top:.5rem">' +
        '<button class="btn primary" data-act="save-ex">Add exercise</button>' +
        '<button class="btn outline narrow" data-act="cancel-ex">Cancel</button></div></div>';
    } else {
      h2 += '<button class="btn dashed" data-act="new-ex">' + icon("plus") + ' Add exercise</button>';
    }
    return h2 + '<button class="btn danger-text" style="margin-top:.75rem" data-act="rm-cat">Delete category</button>';
  }
  function exerciseCard(e) {
    var vid = ytId(e.url);
    return '<div class="card" style="margin-bottom:.75rem"><div class="entry-head">' +
      '<div style="min-width:0"><p style="margin:0;font-size:.875rem;font-weight:500">' + esc(e.name) + '</p>' +
      '<p class="faint" style="margin:.15rem 0 0">' +
      (e.type === "strength" ? "Sets / reps / weight" : "Sets / seconds") +
      (e.target ? " · " + esc(e.target) : "") + '</p>' +
      (e.notes ? '<p class="muted" style="margin:.25rem 0 0">' + esc(e.notes) + '</p>' : "") +
      (e.url ? '<div class="linkrow">' +
        (vid ? '<button data-act="vid" data-v="' + e.id + '">' + icon("play", 13) + " " +
          (S.video === e.id ? "Hide video" : "Watch here") + '</button>' : "") +
        '<a href="' + esc(e.url) + '" target="_blank" rel="noreferrer">' + icon("external", 13) + ' Open</a></div>' : "") +
      (vid && S.video === e.id ? '<div class="vid"><iframe src="https://www.youtube.com/embed/' +
        esc(vid) + '" title="' + esc(e.name) + '" allowfullscreen></iframe></div>' : "") +
      '</div><button data-act="edit-ex" data-v="' + e.id + '" aria-label="Edit" style="color:var(--faint)">' +
      icon("pencil", 15) + '</button></div></div>';
  }
  function exerciseEditor(e) {
    return '<div class="card" style="margin-bottom:.75rem">' +
      '<input class="big" id="ed-name" value="' + esc(e.name) + '" placeholder="Exercise name">' +
      '<div class="seg" style="margin-top:.5rem">' +
      '<button class="' + (e.type === "strength" ? "on" : "") + '" data-act="ed-type" data-v="strength">Sets / reps / weight</button>' +
      '<button class="' + (e.type === "hold" ? "on" : "") + '" data-act="ed-type" data-v="hold">Sets / seconds</button>' +
      '</div>' +
      '<input class="big" style="margin-top:.5rem" id="ed-target" value="' + esc(e.target) + '" placeholder="Target, e.g. 3 x 10">' +
      '<input class="big" style="margin-top:.5rem" id="ed-url" value="' + esc(e.url) + '" placeholder="Video link">' +
      '<input class="big" style="margin-top:.5rem" id="ed-notes" value="' + esc(e.notes) + '" placeholder="Notes">' +
      '<div class="between" style="margin-top:.75rem">' +
      '<button class="btn danger-text" style="width:auto" data-act="del-ex">' + icon("trash", 13) + ' Delete</button>' +
      '<span style="display:flex;gap:.5rem">' +
      '<button class="btn-sm" data-act="cancel-edit">Cancel</button>' +
      '<button class="btn-sm" style="background:var(--accent);color:var(--accent-text);border-color:var(--accent)" data-act="save-edit">Save</button>' +
      '</span></div></div>';
  }

  function viewExport() {
    var keys = Object.keys(S.data.sessions || {});
    var logged = keys.reduce(function (a, k) { return a + (S.data.sessions[k].entries || []).length; }, 0);
    var byTrainer = keys.filter(function (k) { return S.data.sessions[k].by === "Trainer"; }).length;
    var cats = S.data.categories || [];
    var exercises = cats.reduce(function (a, c) { return a + c.exercises.length; }, 0);
    var withVideo = cats.reduce(function (a, c) {
      return a + c.exercises.filter(function (e) { return (e.url || "").trim(); }).length; }, 0);

    var h = '<div class="card"><p class="muted" style="margin:0 0 .25rem">What\'s stored</p>' +
      stat("Sessions logged", keys.length) +
      stat("Exercises logged in sessions", logged) +
      stat("Sessions logged by trainer", byTrainer) +
      stat("Categories", cats.length) +
      stat("Exercises in database", exercises) +
      stat("Exercises with video", withVideo) + '</div>' +
      '<div class="stack-sm" style="margin-top:1rem">' +
      '<button class="btn primary" data-act="csv">' + icon("download") + ' Export everything as CSV</button>' +
      '<button class="btn outline" data-act="json">' + icon("download") + ' Download full backup</button></div>';

    h += '<div class="card" style="margin-top:1rem"><p style="margin:0;font-size:.875rem;font-weight:500">Restore from backup</p>' +
      '<p class="muted" style="margin:.15rem 0 0">Loads a backup file into the shared log. ' +
      'Use it to bring data across from the old app.</p>';
    if (S.staged) {
      var now = counts(S.data), inc = counts(S.staged.data);
      h += '<div class="confirm"><p style="margin:0;font-weight:500">This replaces everything in the shared log, for both of you.</p>' +
        '<p style="margin:.5rem 0 0">Now: ' + now.s + ' sessions, ' + now.e + ' logged exercises, ' + now.x + ' in database</p>' +
        '<p style="margin:0">After: ' + inc.s + ' sessions, ' + inc.e + ' logged exercises, ' + inc.x + ' in database</p>' +
        (S.staged.source ? '<p style="margin:.25rem 0 0;opacity:.8">From ' + esc(S.staged.source) + '</p>' : "") +
        '<div class="row2" style="margin-top:.75rem">' +
        '<button class="btn" style="background:var(--warn);color:var(--warn-bg)" data-act="do-restore">Replace everything</button>' +
        '<button class="btn outline narrow" data-act="cancel-restore">Cancel</button></div></div>';
    } else {
      h += '<div class="stack-sm" style="margin-top:.75rem">' +
        '<label class="btn outline" style="cursor:pointer">' + icon("upload") + ' Choose backup file' +
        '<input type="file" accept=".json,application/json" id="file-in" style="display:none"></label>';
      h += S.pasting
        ? '<textarea id="paste-in" rows="4" placeholder="Paste the contents of your backup file here" ' +
          'style="font-family:ui-monospace,Menlo,monospace;font-size:.75rem"></textarea>' +
          '<div class="row2"><button class="btn" style="background:var(--text);color:var(--bg)" data-act="load-paste">Load pasted data</button>' +
          '<button class="btn outline narrow" data-act="cancel-paste">Cancel</button></div>'
        : '<button class="muted" style="padding:.25rem" data-act="paste">Or paste backup text instead</button>';
      h += '</div>';
    }
    h += '</div>';
    if (S.note) h += '<p class="note-box" style="margin-top:1rem">' + esc(S.note) + '</p>';
    h += '<div class="fineprint" style="margin-top:1rem">' +
      '<p>The CSV has one row per session, one per exercise logged in a session with its sets, ' +
      'reps or seconds and weight, and one per exercise in the database with its target and video link.</p>' +
      '<p>The backup is an exact copy, and the only file that can be restored. Export one before ' +
      'any big change, and keep a recent one somewhere outside this app.</p></div>';
    return h;
  }
  function stat(label, value) {
    return '<div class="statrow"><span class="muted">' + label + '</span><b>' + value + '</b></div>';
  }
  function counts(d) {
    var k = Object.keys(d.sessions || {});
    return {
      s: k.length,
      e: k.reduce(function (a, x) { return a + ((d.sessions[x].entries || []).length); }, 0),
      x: (d.categories || []).reduce(function (a, c) { return a + (c.exercises || []).length; }, 0)
    };
  }

  function render() {
    var root = document.getElementById("root");
    if (!configured()) { root.innerHTML = viewSetup(); return; }
    if (!S.ready) {
      root.innerHTML = '<div class="center-screen"><p class="muted">Loading your log…</p></div>';
      return;
    }
    if (!S.who) { root.innerHTML = viewWho(); return; }

    var body = S.tab === "log" ? viewLog() : S.tab === "exercises" ? viewExercises() : viewExport();
    var banner = S.error
      ? '<div class="banner"><p style="margin:0">' + esc(S.error) + '</p>' +
        (S.diag ? '<p class="diag">' + esc(S.diag) + '</p>' : "") +
        '<div class="row"><button data-act="retry">Try again now</button>' +
        '<button data-act="go-export">Download a backup</button></div></div>'
      : "";

    root.innerHTML =
      '<div class="wrap"><header class="top"><h1>Rio Training</h1>' +
      '<button class="whobtn" data-act="swap-who">' + esc(S.who) + '</button></header>' +
      banner +
      '<div class="pad">' + body + '</div>' +
      '<p class="fineprint" style="padding:2rem 1rem 0">Everything here is shared — anyone with ' +
      'this link sees and edits the same data.</p></div>' +
      '<nav class="tabs"><div class="inner">' +
      tabBtn("log", "Log", "calendar") + tabBtn("exercises", "Exercises", "dumbbell") +
      tabBtn("export", "Export", "database") +
      '</div></nav><div id="status" class="status hidden"></div>';
    setStatus(S.saveState);
  }
  function tabBtn(id, label, ic) {
    return '<button class="' + (S.tab === id ? "on" : "") + '" data-act="tab" data-v="' + id + '">' +
      icon(ic, 20) + '<span>' + label + '</span></button>';
  }

  // ------------------------------------------------------------------- events
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act"), v = t.getAttribute("data-v");
    var cats = S.data.categories || [];
    var cat = cats.filter(function (c) { return c.id === S.openCat; })[0];

    switch (act) {
      case "who": S.who = v; lsSet(WHO_KEY, v); render(); return;
      case "swap-who": S.who = S.who === "Rio" ? "Trainer" : "Rio"; lsSet(WHO_KEY, S.who); render(); return;
      case "tab": S.tab = v; S.note = null; render(); return;
      case "go-export": S.tab = "export"; render(); return;
      case "retry": clearTimeout(timer); if (pendingSave) flush(); else retryLoad(); return;
      case "today": S.year = new Date().getFullYear(); S.month = new Date().getMonth(); render(); return;
      case "mon":
        S.month += Number(v);
        if (S.month < 0) { S.month = 11; S.year--; }
        if (S.month > 11) { S.month = 0; S.year++; }
        render(); return;
      case "day": S.sel = v; S.picking = false; ensureSession(v); render(); return;
      case "close": S.sel = null; render(); return;
      case "pick": S.picking = true; render(); document.getElementById("pick-q").focus(); return;
      case "pick-cancel": S.picking = false; render(); return;
      case "add-ex":
        S.data.sessions[S.sel].entries.push({ id: uid(), exerciseId: v, sets: "", reps: "", weight: "", notes: "" });
        markDirty(S.sel); scheduleSave(); S.picking = false; render(); return;
      case "rm-entry":
        S.data.sessions[S.sel].entries = S.data.sessions[S.sel].entries.filter(function (x) { return x.id !== v; });
        markDirty(S.sel); scheduleSave(); render(); return;
      case "rm-session":
        delete S.data.sessions[S.sel];
        markDirty(S.sel); scheduleSave(); S.sel = null; render(); return;
      case "open-cat": S.openCat = v; render(); return;
      case "back-cat": S.openCat = null; S.editing = null; S.video = null; render(); return;
      case "new-cat": S.addingCat = true; render(); return;
      case "cancel-cat": S.addingCat = false; render(); return;
      case "save-cat": {
        var nm = (document.getElementById("cat-name").value || "").trim();
        if (!nm) return;
        cats.push({ id: uid(), name: nm, exercises: [] });
        markDirty("*categories*"); scheduleSave(); S.addingCat = false; render(); return;
      }
      case "rm-cat":
        S.data.categories = cats.filter(function (c) { return c.id !== S.openCat; });
        markDirty("*categories*"); scheduleSave(); S.openCat = null; render(); return;
      case "vid": S.video = S.video === v ? null : v; render(); return;
      case "edit-ex": S.editing = v; render(); return;
      case "cancel-edit": S.editing = null; render(); return;
      case "ed-type": {
        var e1 = cat.exercises.filter(function (x) { return x.id === S.editing; })[0];
        if (e1) { e1.type = v; markDirty("*categories*"); scheduleSave(); render(); }
        return;
      }
      case "save-edit": {
        var e2 = cat.exercises.filter(function (x) { return x.id === S.editing; })[0];
        if (e2) {
          e2.name = (document.getElementById("ed-name").value || "").trim();
          e2.target = (document.getElementById("ed-target").value || "").trim();
          e2.url = (document.getElementById("ed-url").value || "").trim();
          e2.notes = (document.getElementById("ed-notes").value || "").trim();
          markDirty("*categories*"); scheduleSave();
        }
        S.editing = null; render(); return;
      }
      case "del-ex":
        cat.exercises = cat.exercises.filter(function (x) { return x.id !== S.editing; });
        markDirty("*categories*"); scheduleSave(); S.editing = null; render(); return;
      case "new-ex": S.adding = true; S.form = { name: "", type: "strength", target: "", url: "", notes: "" }; render(); return;
      case "cancel-ex": S.adding = false; render(); return;
      case "nx-type": S.form.type = v; captureForm(); render(); return;
      case "save-ex": {
        captureForm();
        if (!S.form.name.trim()) return;
        cat.exercises.push({
          id: uid(), name: S.form.name.trim(), type: S.form.type,
          target: S.form.target.trim(), url: S.form.url.trim(), notes: S.form.notes.trim()
        });
        markDirty("*categories*"); scheduleSave();
        S.adding = false; S.form = { name: "", type: "strength", target: "", url: "", notes: "" };
        render(); return;
      }
      case "csv":
        try {
          saveFile("rio-training-" + stamp() + ".csv", buildCsv(S.data), "text/csv;charset=utf-8;");
          S.note = "CSV downloaded. In Google Sheets, use File → Import to bring it in.";
        } catch (err) { S.note = "Download didn't start. Try again, or use a different browser."; }
        render(); return;
      case "json":
        try {
          saveFile("rio-training-backup-" + stamp() + ".json", JSON.stringify(S.data, null, 2), "application/json");
          S.note = "Backup downloaded. Keep it safe — it restores everything exactly.";
        } catch (err) { S.note = "Download didn't start. Try again, or use a different browser."; }
        render(); return;
      case "paste": S.pasting = true; render(); return;
      case "cancel-paste": S.pasting = false; render(); return;
      case "load-paste": stage(document.getElementById("paste-in").value, "pasted text"); return;
      case "cancel-restore": S.staged = null; render(); return;
      case "do-restore":
        S.data = S.staged.data;
        markDirty("*categories*");
        Object.keys(S.data.sessions).forEach(function (k) { markDirty(k); });
        scheduleSave();
        S.staged = null; S.pasting = false;
        S.note = "Restored. Everything below now reflects the backup.";
        render(); return;
    }
  });

  function captureForm() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : ""; };
    S.form.name = g("nx-name"); S.form.target = g("nx-target");
    S.form.url = g("nx-url"); S.form.notes = g("nx-notes");
  }

  // Typing updates the model and schedules a save, but never re-renders —
  // a re-render mid-keystroke would steal focus from the field.
  document.addEventListener("input", function (ev) {
    var el = ev.target, kind = el.getAttribute && el.getAttribute("data-in");
    if (!kind) return;
    if (kind === "pickq") {
      document.getElementById("pick-list").innerHTML = pickList(el.value);
      return;
    }
    if (kind === "snote") {
      S.data.sessions[S.sel].notes = el.value;
      markDirty(S.sel); scheduleSave(); return;
    }
    if (kind === "entry") {
      var f = el.getAttribute("data-f");
      if (f !== "notes") {
        var clean = el.value.replace(/[^0-9.]/g, "");
        if (clean !== el.value) el.value = clean;
      }
      var en = (S.data.sessions[S.sel].entries || []).filter(function (x) {
        return x.id === el.getAttribute("data-id"); })[0];
      if (en) { en[f] = el.value; markDirty(S.sel); scheduleSave(); }
    }
  });

  document.addEventListener("change", function (ev) {
    if (ev.target.id !== "file-in") return;
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { stage(String(reader.result), file.name); };
    reader.onerror = function () { S.note = "Couldn't read that file. Try again."; render(); };
    reader.readAsText(file);
  });

  function stage(text, source) {
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      S.note = "That file isn't valid backup data. Pick the .json file the app downloaded.";
      render(); return;
    }
    if (!parsed || typeof parsed !== "object" || (!parsed.sessions && !parsed.categories)) {
      S.note = "That file doesn't look like a Rio Training backup."; render(); return;
    }
    S.note = null;
    S.staged = { data: migrate(parsed), source: source };
    render();
  }

  render();
  initialLoad();
})();
