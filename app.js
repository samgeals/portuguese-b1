// Portuguese A1 → B1 — plain JS, no build step.
// Data lives in data/*.json; personal progress lives in localStorage (export/import to move devices).

const STORE_KEY = "pt-b1-progress-v1";

const state = {
  plan: null,
  phrases: [],
  progress: { blocks: {}, milestones: {}, known: {}, srs: {}, steps: {}, timer: {}, log: [] },
  cardQueue: [],
  cardIndex: 0,
};

// ---------- storage ----------
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state.progress = { ...state.progress, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Could not read saved progress", e);
  }
}
function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
  } catch (e) {
    console.warn("Could not save progress", e);
  }
}

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "checked") node.checked = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(c ?? ""));
  return node;
};
const phraseId = (p) => p.pt;

// ---------- speech (browser text-to-speech, European Portuguese voice when available) ----------
let ptVoice = null;
let serverVoices = []; // Mac voices served by server.py (`say`), preferred because every browser can play them
let audio = null;
const VOICE_KEY = "pt-b1-voice";
const norm = (lang) => lang.replace("_", "-").toLowerCase();
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/.test(navigator.userAgent);
const VOICE_HELP = IS_IOS
  ? "iPhone: Settings → Accessibility → Spoken Content → Voices → Portuguese → Joana (Portugal), then reopen the app."
  : IS_ANDROID
    ? "Android: Settings → Accessibility → Text-to-speech → Speech Services by Google → Install voice data → Português (Portugal)."
    : "Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Portuguese (Portugal) → download Joana, then restart the browser.";
const ptVoices = () => speechSynthesis.getVoices().filter((v) => norm(v.lang).startsWith("pt"));
function pickVoice() {
  if (serverVoices.length) {
    let saved = null;
    try { saved = localStorage.getItem(VOICE_KEY); } catch {}
    const select = $("#voiceSelect");
    select.replaceChildren(...serverVoices.map((v) => el("option", { value: v.name }, `${v.name} (${v.lang})`)));
    select.value = serverVoices.some((v) => v.name === saved) ? saved : serverVoices[0].name;
    select.hidden = serverVoices.length < 2;
    $("#voiceNote").textContent = serverVoices[0].lang.toLowerCase() === "pt-pt" ? ""
      : "No European Portuguese voice on this Mac. Install Joana: System Settings → Accessibility → Spoken Content → System voice → Manage Voices.";
    return;
  }
  if (!("speechSynthesis" in window)) return;
  const voices = ptVoices();
  let saved = null;
  try { saved = localStorage.getItem(VOICE_KEY); } catch {}
  ptVoice = voices.find((v) => v.name === saved)
    || voices.find((v) => norm(v.lang) === "pt-pt" && /joana|catarina/i.test(v.name))
    || voices.find((v) => norm(v.lang) === "pt-pt")
    || voices[0] || null;

  const select = $("#voiceSelect");
  if (select) {
    select.replaceChildren(...voices.map((v) => el("option", { value: v.name }, `${v.name} (${v.lang})`)));
    select.hidden = voices.length < 2;
    if (ptVoice) select.value = ptVoice.name;
  }
  const note = $("#voiceNote");
  if (!note) return;
  if (!speechSynthesis.getVoices().length) note.textContent = "";
  else if (!ptVoice) note.textContent = `⚠️ No Portuguese voice installed, so audio is off. ${VOICE_HELP}`;
  else if (norm(ptVoice.lang) !== "pt-pt") note.textContent = `Using ${ptVoice.name} (${ptVoice.lang}), which isn't a European accent. ${VOICE_HELP}`;
  else note.textContent = "";
}
function cleanForSpeech(text) {
  return text.replace(/…/g, "").replace(/\s+\/\s+/g, ", ").replace(/\s+—\s+/g, ". ").trim();
}
async function initServerVoices() {
  try {
    const r = await fetch("say/voices");
    if (r.ok) serverVoices = await r.json();
  } catch {}
  if (serverVoices.length) pickVoice();
}
function speak(text) {
  markActive();
  if (serverVoices.length) {
    const name = $("#voiceSelect")?.value || serverVoices[0].name;
    const q = new URLSearchParams({ text: cleanForSpeech(text), voice: name, slow: $("#slowSpeech")?.checked ? "1" : "0" });
    audio?.pause();
    audio = new Audio(`say?${q}`);
    audio.play().catch((e) => console.warn("Audio failed", e));
    return;
  }
  if (!("speechSynthesis" in window)) return;
  if (!ptVoice) pickVoice();
  if (!ptVoice) { $("#voiceNote")?.scrollIntoView({ block: "center" }); return; } // never read Portuguese with an English voice
  // Chrome invalidates voice objects whenever the voice list reloads and then silently uses the
  // default (English) voice, so look the voice up fresh by name on every play.
  const voice = ptVoices().find((v) => v.name === ptVoice.name) || ptVoice;
  const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = $("#slowSpeech")?.checked ? 0.7 : 0.95;
  window.__utterance = u; // keep a reference so Chrome doesn't garbage-collect it mid-sentence
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(() => speechSynthesis.speak(u), 60);
  } else {
    speechSynthesis.speak(u);
  }
}
const playBtn = (text) => el("button", {
  class: "play", type: "button", title: `Play “${text}”`, "aria-label": `Play ${text}`,
  onclick: (e) => { e.stopPropagation(); speak(text); },
}, "🔊");
function initSpeech() {
  $("#voiceSelect").addEventListener("change", (e) => {
    try { localStorage.setItem(VOICE_KEY, e.target.value); } catch {}
    pickVoice();
    speak("Olá, bom dia!");
  });
  initServerVoices();
  if (!("speechSynthesis" in window)) return;
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  setTimeout(pickVoice, 500); // some browsers fill the voice list late and never fire voiceschanged
}

// On a phone, wide tables stack into cards; each cell shows its column name from data-label.
function labelCells(root = document) {
  root.querySelectorAll("table.grid").forEach((table) => {
    const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
    if (!heads.length) return;
    table.classList.add("stack");
    table.querySelectorAll("tbody tr").forEach((tr) =>
      [...tr.children].forEach((td, i) => { if (heads[i] && !td.hasAttribute("colspan")) td.dataset.label = heads[i]; }));
  });
}

// ---------- tabs ----------
function showTab(name) {
  document.querySelector(`nav button[data-tab="${name}"]`)?.click();
}
function initTabs() {
  document.querySelectorAll("nav button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === btn.dataset.tab));
      btn.scrollIntoView({ block: "nearest", inline: "center" });
      // Start each tab just under the header; on a phone that keeps the flashcard buttons on screen.
      const nav = $("#tabs");
      if (window.scrollY > nav.offsetTop || matchMedia("(max-width: 640px)").matches) window.scrollTo({ top: nav.offsetTop });
    });
  });
}

// ---------- plan ----------
// A block can carry a day-by-day breakdown ("steps"): small tasks with their own checkboxes.
const openDays = new Set();
function renderSteps(b) {
  const key = (di, ti) => `${b.id}-${di}-${ti}`;
  const all = b.steps.days.flatMap((d, di) => d.tasks.map((_, ti) => key(di, ti)));
  const done = all.filter((k) => state.progress.steps[k]).length;
  const firstOpen = b.steps.days.findIndex((d, di) => d.tasks.some((_, ti) => !state.progress.steps[key(di, ti)]));
  const days = b.steps.days.map((d, di) => {
    const dayDone = d.tasks.filter((_, ti) => state.progress.steps[key(di, ti)]).length;
    const mins = d.tasks.reduce((s, t) => s + (t.min || 0), 0);
    const dayKey = `${b.id}-${di}`;
    const details = el("details", { class: `day${dayDone === d.tasks.length ? " done" : ""}` },
      el("summary", {},
        el("strong", {}, d.day), ` · ${d.focus} `,
        el("span", { class: "muted" }, `${dayDone}/${d.tasks.length} · ~${mins} min`)),
      el("ul", { class: "tasks" }, ...d.tasks.map((t, ti) => {
        const k = key(di, ti);
        return el("li", { class: state.progress.steps[k] ? "done" : "" },
          el("label", {},
            el("input", {
              type: "checkbox", checked: !!state.progress.steps[k],
              onchange: (e) => { state.progress.steps[k] = e.target.checked ? dateKey() : false; saveProgress(); renderPlan(); renderLog(); },
            }),
            " ", el("span", {}, t.text), t.min ? el("span", { class: "muted" }, ` (${t.min} min)`) : ""),
          t.open ? openLink(t.open) : "",
          t.say ? el("div", { class: "say" }, ...t.say.map((p) => el("span", { class: "sayItem" }, playBtn(p), p,
            translate(p) ? el("span", { class: "en" }, ` · ${translate(p)}`) : ""))) : "");
      })));
    if (openDays.has(dayKey) || (!openDays.size && di === firstOpen)) details.open = true;
    details.addEventListener("toggle", () => { details.open ? openDays.add(dayKey) : openDays.delete(dayKey); });
    return details;
  });
  return el("div", { class: "steps" },
    el("h4", {}, `${b.steps.title} `, el("span", { class: "muted" }, `· ${done} of ${all.length} steps done`)),
    el("div", { class: "progress" }, el("div", { style: `width:${Math.round((done / all.length) * 100)}%` })),
    ...days);
}

// English for a Portuguese phrase: the plan's glossary first, then the phrase list.
function translate(pt) {
  return state.plan.glossary?.[pt] || state.phrases.find((p) => p.pt === pt)?.en || "";
}

// A step can point at a tab of the app, e.g. { "tab": "cards", "topic": "Everyday" }.
const TAB_NAMES = { cards: "Flashcards", phrases: "Phrases", log: "Study log", situations: "Situations" };
function openLink(target) {
  const label = `Open ${TAB_NAMES[target.tab] || target.tab}${target.topic ? `: ${target.topic}` : ""} →`;
  return el("button", { type: "button", class: "openlink", onclick: () => {
    if (target.tab === "cards") {
      $("#cardTopic").value = target.topic || "";
      $("#cardLevel").value = target.level || "";
      buildQueue();
    } else if (target.tab === "phrases") {
      $("#topicFilter").value = target.topic || "";
      renderPhrases();
    }
    showTab(target.tab);
  } }, label);
}

function renderPlan() {
  const root = $("#plan");
  root.replaceChildren();

  for (const stage of state.plan.stages) {
    const done = stage.blocks.filter((b) => state.progress.blocks[b.id]).length;
    const pct = Math.round((done / stage.blocks.length) * 100);

    const blocks = stage.blocks.map((b) => {
      const isDone = !!state.progress.blocks[b.id];
      return el("div", { class: `block${isDone ? " done" : ""}` },
        el("input", {
          type: "checkbox", checked: isDone, "aria-label": `Mark ${b.name} done`,
          onchange: (e) => { state.progress.blocks[b.id] = e.target.checked; saveProgress(); renderPlan(); },
        }),
        el("div", {},
          el("strong", { class: "name" }, b.name), " ", el("span", { class: "muted" }, `· ${b.when}`),
          el("dl", {},
            el("dt", {}, "Grammar"), el("dd", {}, b.grammar),
            el("dt", {}, "Vocab"), el("dd", {}, b.vocab),
            el("dt", {}, "Real life"), el("dd", {}, b.task),
          ),
          b.steps ? renderSteps(b) : "",
        ),
      );
    });

    const milestones = stage.milestones.map((m, i) => {
      const key = `${stage.id}-${i}`;
      return el("label", {},
        el("input", {
          type: "checkbox", checked: !!state.progress.milestones[key],
          onchange: (e) => { state.progress.milestones[key] = e.target.checked; saveProgress(); },
        }), " ", m);
    });

    root.append(
      el("article", { class: "stage" },
        el("h2", {}, `${stage.id} · ${stage.name} `, el("span", { class: "muted" }, `(months ${stage.months})`)),
        el("p", { class: "muted" }, stage.summary),
        el("div", { class: "progress" }, el("div", { style: `width:${pct}%` })),
        el("p", { class: "muted" }, `${done} of ${stage.blocks.length} blocks done`),
        ...blocks,
        el("h3", {}, "Milestones"),
        el("div", { class: "milestones" }, ...milestones),
        el("h3", {}, "Listening"),
        el("ul", {}, ...(state.plan.resources[stage.id] || []).map((r) => el("li", {}, r))),
      ),
    );
  }

  root.append(
    el("article", { class: "stage" },
      el("h2", {}, "Pronunciation"),
      el("table", { class: "grid" },
        el("thead", {}, el("tr", {}, el("th", {}, "Sound"), el("th", {}, "What happens"), el("th", {}, "Examples"))),
        el("tbody", {}, ...state.plan.pronunciation.map((p) =>
          el("tr", {}, el("td", {}, p.sound), el("td", {}, p.what), el("td", {}, ...exampleCells(p.examples))))),
      ),
    ),
    el("article", { class: "stage" },
      el("h2", {}, "Weekly routine"),
      el("table", { class: "grid" },
        el("tbody", {}, ...state.plan.routine.map((r) =>
          el("tr", {}, el("td", {}, r.when), el("td", {}, r.what), el("td", {}, r.time)))),
      ),
    ),
  );
  labelCells(root);
}

// Pronunciation examples look like: telefone → "tlfon", pequeno → "pkenu" — add a play button per Portuguese word.
function exampleCells(examples) {
  return examples.split(",").map((part, i) => {
    const word = part.split("→")[0].trim();
    return el("span", { class: "example" }, i ? ", " : "", word ? playBtn(word) : "", " ", part.trim());
  });
}

// ---------- phrases ----------
function topics() {
  return [...new Set(state.phrases.map((p) => p.topic))];
}
function initPhraseFilters() {
  for (const sel of ["#topicFilter", "#cardTopic"]) {
    for (const t of topics()) $(sel).append(el("option", {}, t));
  }
  ["#topicFilter", "#levelFilter", "#hideKnown"].forEach((s) => $(s).addEventListener("change", renderPhrases));
}
function renderPhrases() {
  const topic = $("#topicFilter").value;
  const level = $("#levelFilter").value;
  const hideKnown = $("#hideKnown").checked;
  const rows = state.phrases
    .filter((p) => (!topic || p.topic === topic) && (!level || p.level === level))
    .filter((p) => !(hideKnown && state.progress.known[phraseId(p)]))
    .map((p) =>
      el("tr", {},
        el("td", {}, playBtn(p.pt), " ", el("strong", {}, p.pt)),
        el("td", {}, p.en),
        el("td", {}, el("span", { class: "pill" }, p.topic)),
        el("td", {}, p.level),
        el("td", {}, el("input", {
          type: "checkbox", checked: !!state.progress.known[phraseId(p)], "aria-label": "Known",
          onchange: (e) => { state.progress.known[phraseId(p)] = e.target.checked; saveProgress(); renderPhrases(); },
        })),
      ));
  $("#phraseRows").replaceChildren(...rows);
  labelCells($("#phrases"));
}

// ---------- flashcards (spaced repetition, Leitner boxes) ----------
// Each phrase sits in a box 0–5. "Got it" moves it up a box and schedules it further out;
// "Again" drops it to box 0 and shows it again this session. Box 5 = mastered (marked known).
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const MASTERED_BOX = 5;
const NEW_PER_SESSION = 10;
const DAY = 864e5;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const srsOf = (p) => state.progress.srs[phraseId(p)];

function buildQueue() {
  const topic = $("#cardTopic").value;
  const level = $("#cardLevel").value;
  const pool = state.phrases
    .filter((p) => (!topic || p.topic === topic) && (!level || p.level === level))
    .filter((p) => !state.progress.known[phraseId(p)]);
  const shuffle = (a) => a.sort(() => Math.random() - 0.5);
  const due = shuffle(pool.filter((p) => srsOf(p) && srsOf(p).due <= Date.now()));
  const fresh = shuffle(pool.filter((p) => !srsOf(p))).slice(0, NEW_PER_SESSION);
  state.cardQueue = [...due, ...fresh];
  state.cardIndex = 0;
  showCard();
}
function showCard() {
  const reverse = $("#cardReverse").checked;
  const card = state.cardQueue[state.cardIndex];
  $("#cardBack").classList.add("hidden");
  if (!card) {
    const next = state.phrases.map(srsOf).filter((r) => r && r.box < MASTERED_BOX).map((r) => r.due).sort((a, b) => a - b)[0];
    $("#cardFront").textContent = "All done for now 🎉";
    $("#cardBack").textContent = next ? `Next review: ${new Date(next).toLocaleDateString()}` : "";
    $("#cardBack").classList.toggle("hidden", !next);
    $("#cardLevelTag").textContent = "";
  } else {
    $("#cardFront").textContent = reverse ? card.en : card.pt;
    $("#cardBack").textContent = reverse ? card.pt : card.en;
    if (!reverse && $("#autoSpeak").checked) speak(card.pt);
    const r = srsOf(card);
    $("#cardLevelTag").textContent = `${card.topic} · ${card.level} · ${r ? `box ${r.box}` : "new"}`;
  }
  const records = Object.values(state.progress.srs);
  const learning = records.filter((r) => r.box > 0 && r.box < MASTERED_BOX).length;
  const known = Object.values(state.progress.known).filter(Boolean).length;
  $("#cardStats").textContent =
    `${Math.max(state.cardQueue.length - state.cardIndex, 0)} cards left this session · ${learning} learning · ${known} known of ${state.phrases.length}`;
}
function grade(gotIt) {
  const card = state.cardQueue[state.cardIndex];
  if (!card) return;
  const id = phraseId(card);
  const r = state.progress.srs[id] || { box: 0, due: 0 };
  if (gotIt) {
    r.box = Math.min(r.box + 1, MASTERED_BOX);
    r.due = today() + INTERVAL_DAYS[r.box] * DAY;
    if (r.box === MASTERED_BOX) state.progress.known[id] = true;
  } else {
    r.box = 0;
    r.due = Date.now();
    state.cardQueue.push(card);
  }
  state.progress.srs[id] = r;
  saveProgress();
  state.cardIndex++;
  showCard();
  renderPhrases();
}
function initCards() {
  const flip = () => {
    const card = state.cardQueue[state.cardIndex];
    if (!card) return;
    const back = $("#cardBack");
    back.classList.toggle("hidden");
    if ($("#cardReverse").checked && !back.classList.contains("hidden") && $("#autoSpeak").checked) speak(card.pt);
  };
  const sayCard = () => { const c = state.cardQueue[state.cardIndex]; if (c) speak(c.pt); };
  $("#cardSpeak").addEventListener("click", (e) => { e.stopPropagation(); sayCard(); });
  $("#flip").addEventListener("click", flip);
  $("#card").addEventListener("click", flip);
  $("#again").addEventListener("click", () => grade(false));
  $("#gotIt").addEventListener("click", () => grade(true));
  $("#cardTopic").addEventListener("change", buildQueue);
  $("#cardLevel").addEventListener("change", buildQueue);
  $("#cardReverse").addEventListener("change", showCard);
  document.addEventListener("keydown", (e) => {
    if (!$("#cards").classList.contains("active") || e.target.matches("input, select, textarea")) return;
    if (e.key === " ") { e.preventDefault(); flip(); }
    else if (e.key === "1") grade(false);
    else if (e.key === "2") grade(true);
    else if (e.key.toLowerCase() === "p") sayCard();
  });
  buildQueue();
}

// ---------- study log (mostly automatic) ----------
// Time comes from three places:
//  1. a timer that runs while you're actively using Flashcards or Phrases (pauses after 90 s without input
//     or when the tab is hidden),
//  2. the minutes of each week-plan step you tick (except in-app steps, which the timer already counts),
//  3. anything you add by hand for study away from the app (tutor, podcasts…).
const TICK_S = 15;
const IDLE_MS = 90 * 1000;
const TIMED_TABS = { cards: "Flashcards", phrases: "Phrases" };
let lastActive = 0;
const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const markActive = () => { lastActive = Date.now(); };

function initTimer() {
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => document.addEventListener(ev, markActive, { passive: true }));
  setInterval(() => {
    const tab = document.querySelector(".tab.active")?.id;
    if (document.hidden || !TIMED_TABS[tab] || Date.now() - lastActive > IDLE_MS) return;
    const day = (state.progress.timer[dateKey()] ||= {});
    day[TIMED_TABS[tab]] = (day[TIMED_TABS[tab]] || 0) + TICK_S;
    saveProgress();
    if (tab === "log") renderLog();
  }, TICK_S * 1000);
}

function stepEntries() {
  const out = [];
  for (const stage of state.plan.stages) for (const b of stage.blocks) {
    if (!b.steps) continue;
    b.steps.days.forEach((d, di) => d.tasks.forEach((t, ti) => {
      const when = state.progress.steps[`${b.id}-${di}-${ti}`];
      if (typeof when === "string" && t.min && !t.inApp) out.push({ date: when, type: "Week plan", minutes: t.min });
    }));
  }
  return out;
}
function allEntries() {
  const timer = Object.entries(state.progress.timer).flatMap(([date, types]) =>
    Object.entries(types).map(([type, secs]) => ({ date, type, minutes: secs / 60 })));
  const manual = state.progress.log.map((e) => ({ ...e, type: "Other" }));
  return [...timer, ...stepEntries(), ...manual];
}

function renderLog() {
  const entries = allEntries();
  const sum = (list) => list.reduce((s, e) => s + e.minutes, 0);
  const totalH = sum(entries) / 60;
  const weekStart = dateKey(new Date(Date.now() - 6 * 864e5));
  const weekH = sum(entries.filter((e) => e.date >= weekStart)) / 60;
  const todayMin = sum(entries.filter((e) => e.date === dateKey()));
  const targets = state.plan.hoursTargets;
  const next = Object.entries(targets).find(([, h]) => totalH < h) || ["B1", targets.B1];

  $("#hoursSummary").replaceChildren(
    el("div", { class: "hours" },
      el("div", {}, el("strong", {}, `${Math.round(todayMin)} min`), "today"),
      el("div", {}, el("strong", {}, `${weekH.toFixed(1)} h`), "in the last 7 days (aim for 5–6)"),
      el("div", {}, el("strong", {}, `${totalH.toFixed(1)} h`), `in total · ${Math.min(100, Math.round((totalH / next[1]) * 100))}% of the way to ${next[0]} (${next[1]} h)`),
    ),
  );

  const cols = ["Flashcards", "Phrases", "Week plan", "Other"];
  const byDate = {};
  for (const e of entries) ((byDate[e.date] ||= {})[e.type] = (byDate[e.date][e.type] || 0) + e.minutes);
  const fmt = (m) => (m ? `${Math.round(m)}` : "–");
  const rows = Object.keys(byDate).sort().reverse().map((date) =>
    el("tr", {}, el("td", {}, date), ...cols.map((c) => el("td", {}, fmt(byDate[date][c]))),
      el("td", {}, el("strong", {}, fmt(Object.values(byDate[date]).reduce((a, b) => a + b, 0))))));
  $("#logRows").replaceChildren(...(rows.length ? rows
    : [el("tr", {}, el("td", { colspan: "6", class: "muted" }, "Nothing yet. Time starts counting as soon as you study in Flashcards or Phrases, or tick a step on the Plan tab."))]));

  labelCells($("#log"));
  $("#manualRows").replaceChildren(...[...state.progress.log]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => el("li", {}, `${e.date} · ${e.type} · ${e.minutes} min `,
      el("button", { class: "linkish", onclick: () => { state.progress.log = state.progress.log.filter((x) => x !== e); saveProgress(); renderLog(); } }, "remove"))));
}
function initLog() {
  $("#logDate").value = dateKey();
  document.querySelector('nav button[data-tab="log"]').addEventListener("click", renderLog);
  $("#logForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const minutes = parseInt($("#logMinutes").value, 10);
    if (!minutes) return;
    state.progress.log.push({ date: $("#logDate").value, minutes, type: $("#logType").value });
    saveProgress();
    $("#logMinutes").value = "";
    renderLog();
  });
  $("#exportBtn").addEventListener("click", async () => {
    const json = JSON.stringify(state.progress, null, 2);
    const name = `portuguese-progress-${dateKey()}.json`;
    const file = new File([json], name, { type: "application/json" });
    if ((IS_IOS || IS_ANDROID) && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Portuguese progress" }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    const a = el("a", { href: URL.createObjectURL(file), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#importFile").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      state.progress = { ...state.progress, ...JSON.parse(await file.text()) };
      saveProgress();
      renderAll();
      alert("Progress imported.");
    } catch (e) {
      console.error("Import failed", e);
      alert("That file couldn't be read. Choose a portuguese-progress….json file made with Export progress.");
    }
    ev.target.value = "";
  });
  renderLog();
}

// ---------- situations ----------
function renderSituations() {
  $("#situations").replaceChildren(
    el("p", { class: "muted" }, "Each situation gets easier in steps; English is the safety net until the last stage."),
    el("table", { class: "grid" },
      el("thead", {}, el("tr", {}, el("th", {}, "Situation"), el("th", {}, "A1"), el("th", {}, "A2"), el("th", {}, "B1"))),
      el("tbody", {}, ...state.plan.situations.map((s) =>
        el("tr", {}, el("td", {}, el("strong", {}, s.name)), el("td", {}, s.A1), el("td", {}, s.A2), el("td", {}, s.B1)))),
    ),
  );
  labelCells($("#situations"));
}

// ---------- boot ----------
function renderAll() {
  renderPlan();
  renderPhrases();
  renderLog();
  renderSituations();
  buildQueue();
}

async function boot() {
  const [plan, phrases] = await Promise.all([
    fetch("data/plan.json").then((r) => r.json()),
    fetch("data/phrases.json").then((r) => r.json()),
  ]);
  state.plan = plan;
  state.phrases = phrases;
  $("#title").textContent = plan.title;
  $("#goal").textContent = plan.goal;

  loadProgress();
  initSpeech();
  initTabs();
  initPhraseFilters();
  renderPlan();
  renderPhrases();
  renderSituations();
  initCards();
  initLog();
  initTimer();
}

// Offline support and installable app, on the hosted (https) copy only, so local edits on the Mac show up straight away.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Offline mode unavailable", e)));
}
// Ask the browser not to clear saved progress when space runs low.
navigator.storage?.persist?.().catch(() => {});

boot().catch((e) => {
  document.body.prepend(el("p", { style: "color:#b91c1c;padding:1rem" },
    "Couldn't load data. Serve the folder over HTTP (see README) rather than opening index.html directly."));
  console.error(e);
});
