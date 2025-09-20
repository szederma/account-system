// /stundenplan/schulplaner/app.js
import { auth, db, requireAuth, logout } from "./auth.js";
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   Demo-Stundenplan (änderbar)
   ========================= */
export const DATA = {
  className: "10b",
  schoolYear: "2025/26",
  days: ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"],
  periods: [
    { no:1, start:"07:40", end:"08:25" },
    { no:2, start:"08:30", end:"09:15" },
    { no:3, start:"09:35", end:"10:20" },
    { no:4, start:"10:25", end:"11:10" },
    { no:5, start:"11:25", end:"12:10" },
    { no:6, start:"12:15", end:"13:00" },
    { no:7, start:"13:05", end:"13:50" },
    { no:8, start:"13:50", end:"14:35" },
    { no:9, start:"14:45", end:"15:25" },
    { no:10, start:"15:25", end:"16:05" }
  ],
  // Du kannst diese Einträge anpassen. Leere Slots sind erlaubt.
  entries: {
    Montag:     [{subject:"Physik",room:"PhR1",teacher:"Höm"}, {subject:"Physik",room:"PhR1",teacher:"Höm"}, {subject:"Ungarisch",room:"R10b",teacher:"Gor"}, {subject:"Ungarisch",room:"R10b",teacher:"Gor"}, {subject:"UGeschichte",room:"R10b",teacher:"Kua"}, {subject:"UGeschichte",room:"R10b",teacher:"Kua"}, {}, {subject:"Kunst",room:"WR",teacher:"Zee"}, {subject:"Kunst",room:"WR",teacher:"Zee"}, {}],
    Dienstag:   [{subject:"DaF",room:"R10b",teacher:"Hed"}, {subject:"Mathe",room:"R10b",teacher:"Wam"}, {subject:"Geschichte",room:"R10b",teacher:"Kaz"}, {subject:"Physik",room:"PhR1",teacher:"Höm"}, {subject:"UChemie",room:"ChR",teacher:"Vaz"}, {subject:"UChemie",room:"ChR",teacher:"Vaz"}, {subject:"UBiologie",room:"BioR1",teacher:"Vaz"}, {subject:"UBiologie",room:"BioR1",teacher:"Vaz"}, {}, {}],
    Mittwoch:   [{subject:"Geschichte",room:"R10b",teacher:"Kaz"}, {subject:"Geschichte",room:"R10b",teacher:"Kaz"}, {subject:"Englisch",room:"R10b",teacher:"Eij"}, {subject:"Englisch",room:"R10b",teacher:"Eij"}, {subject:"Ungarisch",room:"R10b",teacher:"Gor"}, {subject:"Mathe",room:"R10b",teacher:"Wam"}, {subject:"Spanisch",room:"R9a",teacher:"Csb"}, {}, {}, {}],
    Donnerstag: [{subject:"Deutsch",room:"R10b",teacher:"Frt"}, {subject:"Deutsch",room:"R10b",teacher:"Frt"}, {subject:"Sport",room:"TH2",teacher:"Gog"}, {subject:"Sport",room:"TH2",teacher:"Gog"}, {subject:"Sozialkunde",room:"R10b",teacher:"Bau"}, {subject:"Sozialkunde",room:"R10b",teacher:"Bau"}, {subject:"Ungarisch",room:"R10b",teacher:"Gor"}, {subject:"Spanisch",room:"R9a",teacher:"Csb"}, {subject:"Religion",room:"R10b",teacher:"Pak"}, {subject:"Religion",room:"R10b",teacher:"Pak"}],
    Freitag:    [{subject:"Spanisch",room:"R9a",teacher:"Csb"}, {subject:"Spanisch",room:"R9a",teacher:"Csb"}, {subject:"Mathe",room:"R10b",teacher:"Wam"}, {subject:"Mathe",room:"R10b",teacher:"Wam"}, {subject:"Deutsch",room:"R10b",teacher:"Frt"}, {subject:"Deutsch",room:"R10b",teacher:"Frt"}, {subject:"Englisch",room:"R10b",teacher:"Eij"}, {subject:"KL",room:"R10b",teacher:"Kaz"}, {subject:"Erdkunde",room:"R10b",teacher:"Kaz"}, {subject:"Erdkunde",room:"R10b",teacher:"Kaz"}]
  }
};

/* =========================
   Helpers
   ========================= */
export const DAYS_DE  = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
export const weekDE   = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

export const el       = (s)=>document.querySelector(s);
export const els      = (s)=>Array.from(document.querySelectorAll(s));
export const pad      = (n)=> String(n).padStart(2,"0");
export const parseHHMM= (s)=>{ const [h,m]=String(s||"").split(":").map(Number); return {h:h||0,m:m||0}; };
export const minutes  = (t)=> t.h*60+t.m;
export const toHHMM   = (min)=>{ const h=Math.floor(min/60), m=min%60; return `${pad(h)}:${pad(m)}`; };
export const isoDate  = (d)=> (d instanceof Date? d:new Date(d)).toISOString().slice(0,10);
export const atStartOfDay = (d)=>{ const x=new Date(d); x.setHours(0,0,0,0); return x; };
export const todayNameDE  = ()=> DAYS_DE[new Date().getDay()];
export const weekdayDE    = (d)=> DAYS_DE[new Date(d).getDay()];

/* =========================
   Firestore Store + Defaults
   ========================= */
function defaultDB(){
  return {
    tasks: [],         // {id,title,subject,deadline,estMin,progress,subtasks[],priority,notes,done}
    exams: [],         // {id,title,subject,dateISO,priority}
    events: [],        // {id,title,fromISO,toISO?,allDay}
    planned: { byDate: {} }, // { [isoDate]: [ {id,dateISO,start,end,subject,taskId} ] }
    studyWins: {       // Lernfenster je Wochentag
      Montag:[["16:00","19:00"]],
      Dienstag:[["16:00","19:00"]],
      Mittwoch:[["16:00","19:00"]],
      Donnerstag:[["16:00","19:00"]],
      Freitag:[["16:00","19:00"]],
      Samstag:[["10:00","12:00"],["16:00","18:00"]],
      Sonntag:[["10:00","12:00"],["16:00","18:00"]]
    },
    settings: { sessionLen: 30, maxSessions: 4 },
    homework: {},      // { [isoDate]: [ {id,subject,done,note} ] }
    updatedAt: serverTimestamp()
  };
}

export let DB = defaultDB(); // Vorbelegen, damit Seiten ohne db:ready nicht crashen
let saveTimer = null;

/* =========================
   Firestore Sync
   ========================= */
export async function initStore(){
  const user = await requireAuth(); // redirectet auf login.html, falls nicht eingeloggt
  const ref  = doc(db, "users", user.uid);

  onSnapshot(ref, async snap=>{
    if(snap.exists()){
      DB = { ...defaultDB(), ...snap.data() }; // Backfill für evtl. neue Felder
    } else {
      DB = defaultDB();
      await setDoc(ref, DB);
    }
    document.dispatchEvent(new Event("db:ready"));
  });
}

/* ===== sanitize + save (two-step) ===== */
function isPlainObject(v){ return Object.prototype.toString.call(v)==='[object Object]'; }
function sanitize(value){
  if (value === undefined) return null;             // Firestore forbids undefined
  if (Array.isArray(value)) return value.map(sanitize);
  if (isPlainObject(value)) {
    const out={};
    for (const [k,v] of Object.entries(value)) {
      const sv = sanitize(v);
      if (sv !== undefined) out[k]=sv;              // drop only true undefined
    }
    return out;
  }
  return value;
}

export function setDirty(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    const user = auth.currentUser; if(!user) return;
    const ref  = doc(db, "users", user.uid);
    try{
      // 1) write sanitized payload WITHOUT updatedAt
      const payload = sanitize({ ...DB });
      delete payload.updatedAt;
      await setDoc(ref, payload, { merge:true });

      // 2) set server timestamp in a separate call (do NOT sanitize this)
      await updateDoc(ref, { updatedAt: serverTimestamp() });
    }catch(e){
      console.error("Firestore save failed:", e);
      alert("Speichern fehlgeschlagen: " + (e?.message || e));
    }
  }, 200);
}

/* =========================
   UI: Header + Navigation
   ========================= */
export function nav(active){
  const items = [
    ["index.html",      "Heute"],
    ["morgen.html",     "Morgen"],
    ["woche.html",      "Woche"],
    ["aufgaben.html",   "Aufgaben"],
    ["pruefungen.html", "Prüfungen & Ereignisse"],
    ["kalender.html",   "Kalender"],
    ["fenster.html",    "Lernfenster"]
  ];
  const wrap = document.createElement("div"); wrap.className="nav";
  items.forEach(([href,label])=>{
    const a=document.createElement("a");
    a.href=href;
    a.innerHTML=`<span class="tab ${active===href?'active':''}">${label}</span>`;
    wrap.appendChild(a);
  });
  return wrap;
}

export function header(active){
  const h = document.createElement("header");
  h.className="appbar";
  h.innerHTML = `
    <div>
      <div class="title">Schulplaner <span class="subtitle">— Firebase Sync · Stundenplan · Aufgaben · Prüfungen · Kalender</span></div>
      <div class="subtitle" id="todayStr"></div>
    </div>
    <div class="chips">
      <span class="pill">Jetzt: <span id="nowStatus">–</span></span>
      <span class="pill" id="clock">--:--</span>
      <button class="btn btn-sm btn-ghost" id="logoutBtn">Abmelden</button>
    </div>`;
  h.appendChild(nav(active));
  return h;
}

export function mountCommon(active){
  const app=document.querySelector(".app");
  app.prepend(header(active));
  const d=new Date();
  const t=d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  const tEl=document.querySelector('#todayStr'); if(tEl) tEl.textContent=t;
  const lb=document.querySelector('#logoutBtn'); if(lb) lb.onclick=()=> logout().then(()=> location.href="login.html");

  // Start live status/clock/highlight
  tickGlobalStatus();
  setInterval(tickGlobalStatus, 1000);
}

/* =========================
   Stundenplan Rendering
   ========================= */
export function buildPeriods(){ return (DATA.periods||[]).map(p=>({ ...p, startObj:parseHHMM(p.start), endObj:parseHHMM(p.end) })); }
export function getEntry(day, idx){ const arr = (DATA.entries && DATA.entries[day])? DATA.entries[day] : []; return (idx>=0 && idx<arr.length) ? arr[idx] : null; }

export function renderTimetableForDay(tableId, dayName){
  const head = document.querySelector(`#${tableId} thead`);
  const body = document.querySelector(`#${tableId} tbody`);
  if(!head || !body) return;
  head.innerHTML=''; body.innerHTML='';

  const trh = document.createElement("tr");
  trh.innerHTML = `<th>Stunde</th><th>${dayName}</th>`;
  head.appendChild(trh);

  const periods = buildPeriods();
  for (const p of periods){
    const entry = getEntry(dayName, p.no-1);
    const cell  = entry && entry.subject
      ? `<div class="subject">${entry.subject}</div><div class="details">${entry.room||""}${(entry.room&&entry.teacher)?" · ":""}${entry.teacher||""}</div>`
      : '<span class="empty">– frei –</span>';
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <th class="period"><strong>${p.no}.</strong> <span class="muted">${p.start}–${p.end}</span></th>
      <td class="cell" data-day="${dayName}" data-period="${p.no}">${cell}</td>`;
    body.appendChild(tr);
  }
}

/* ===== live status helpers ===== */
function pad2(n){ return String(n).padStart(2,'0'); }
function parseP(s){ const [h,m]=String(s).split(':').map(Number); return {h:h||0, m:m||0}; }
function mins(t){ return t.h*60+t.m; }
function inRange(now,s,e){ const n=mins(now), a=mins(s), b=mins(e); return n>=a && n<b; }

function buildTimeline(dayName){
  const periods = (DATA.periods||[]).map(p=>({no:p.no, s:parseP(p.start), e:parseP(p.end), start:p.start, end:p.end}));
  const segs=[];
  for(let i=0;i<periods.length;i++){
    const entry = getEntry(dayName,i), ok=entry && entry.subject && entry.subject.trim()!=='';
    if(ok) segs.push({type:'class', start:periods[i].s, end:periods[i].e, p:periods[i], entry});
  }
  for(let j=0;j<periods.length-1;j++){
    const cur=periods[j], nxt=periods[j+1], gap=mins(nxt.s)-mins(cur.e);
    if(gap>0) segs.push({type:'break', start:cur.e, end:nxt.s, minutes:gap});
  }
  segs.sort((a,b)=> mins(a.start)-mins(b.start));
  return segs;
}
function findCurrent(dayName){
  const now={h:new Date().getHours(), m:new Date().getMinutes()};
  return buildTimeline(dayName).find(seg=> inRange(now, seg.start, seg.end)) || null;
}
function findNext(dayName){
  const now={h:new Date().getHours(), m:new Date().getMinutes()};
  return buildTimeline(dayName).find(seg=> mins(seg.start)>mins(now)) || null;
}
function findNextClass(dayName){
  const now={h:new Date().getHours(), m:new Date().getMinutes()};
  return buildTimeline(dayName).find(seg=> seg.type==='class' && mins(seg.start)>mins(now)) || null;
}

function highlightCurrentCellIfPresent(dayName){
  const now={h:new Date().getHours(), m:new Date().getMinutes()};
  const p = (DATA.periods||[]).find(per=> inRange(now, parseP(per.start), parseP(per.end)));
  document.querySelectorAll('.cell.current').forEach(c=> c.classList.remove('current'));
  if(p){
    const sel = `.cell[data-day="${dayName}"][data-period="${p.no}"]`;
    const cell = document.querySelector(sel);
    if(cell) cell.classList.add('current');
  }
}

function updateHeaderStatus(){
  const now = new Date();
  const clock = document.querySelector('#clock');
  if(clock) clock.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const dayName = DAYS_DE[now.getDay()];
  const pill = document.querySelector('#nowStatus');
  if(!pill) return;

  if(!(DATA.days||[]).includes(dayName)){ pill.textContent='Frei'; return; }
  const cur = findCurrent(dayName);
  if(!cur){ pill.textContent='Frei'; return; }
  pill.textContent = cur.type==='class' ? (cur.entry?.subject || 'Unterricht') : 'Pause';
}

// Updates “Aktuell / Nächstes” if those elements exist on the page
function updateNowCard(){
  const nowBox = document.querySelector('#now');
  const upBox  = document.querySelector('#upnext');
  if(!nowBox && !upBox) return;

  const dayName = DAYS_DE[new Date().getDay()];
  const cur  = findCurrent(dayName);
  const next = findNext(dayName);
  const nextClass = findNextClass(dayName);

  const swap = (node, html)=>{
    if(!node) return;
    if(node.__lastHTML===html) return;
    node.classList.add('hide');
    setTimeout(()=>{ node.innerHTML=html; node.__lastHTML=html; node.classList.remove('hide'); }, 150);
  };

  if(!((DATA.days||[]).includes(dayName))){
    swap(nowBox, `<div class="muted">Heute kein Unterricht.</div>`);
    swap(upBox, ``);
    return;
  }

  if(!cur){
    const label = next ? (next.type==='class' ? (next.entry?.subject || 'Unterricht') : 'Pause') : '';
    const leftMins  = next ? Math.max(0, mins(parseP(next.start)) - mins({h:new Date().getHours(), m:new Date().getMinutes()})) : 0;
    swap(nowBox, `<div class="subject">Derzeit keine Stunde</div><div class="meta"><span class="pill">Tag: ${dayName}</span></div>`);
    if(next){
      let extra = '';
      if(next.type==='break' && nextClass){
        const minutes2 = Math.max(0, mins(parseP(nextClass.start)) - mins({h:new Date().getHours(), m:new Date().getMinutes()}));
        extra = `<br/><span class="muted">Danach: <strong>${nextClass.entry?.subject || 'Unterricht'}</strong> in ${minutes2} Minuten</span>`;
      }
      swap(upBox, `Als Nächstes: <strong>${label}</strong> in ${leftMins} Minuten${extra}`);
    }else{
      swap(upBox, ``);
    }
    return;
  }

  if(cur.type==='class'){
    const e=cur.entry||{}, room=e.room||'', teacher=e.teacher||'';
    swap(nowBox, `
      <div class="subject">${e.subject||'—'}</div>
      <div class="meta">
        <span class="pill">Zeit: ${cur.p.start}–${cur.p.end}</span>
        ${room? `<span class="pill">Raum: ${room}</span>`:''}
        ${teacher? `<span class="pill">Lehrkraft: ${teacher}</span>`:''}
      </div>`);
  }else{
    const end = cur.end;
    const left = Math.max(0, mins(end)-mins({h:new Date().getHours(), m:new Date().getMinutes()}));
    swap(nowBox, `
      <div class="subject">Pause</div>
      <div class="meta">
        <span class="pill">Ende: ${pad2(end.h)}:${pad2(end.m)}</span>
        <span class="pill">noch ${left} Minuten</span>
      </div>`);
  }

  if(next){
    const label = next.type==='class' ? (next.entry?.subject || 'Unterricht') : 'Pause';
    const left = Math.max(0, mins(parseP(next.start)) - mins({h:new Date().getHours(), m:new Date().getMinutes()}));
    let extra='';
    if(next.type==='break' && nextClass){
      const minutes2 = Math.max(0, mins(parseP(nextClass.start)) - mins({h:new Date().getHours(), m:new Date().getMinutes()}));
      extra = `<br/><span class="muted">Danach: <strong>${nextClass.entry?.subject || 'Unterricht'}</strong> in ${minutes2} Minuten</span>`;
    }
    swap(upBox, `Als Nächstes: <strong>${label}</strong> in ${left} Minuten${extra}`);
  }else{
    swap(upBox, ``);
  }
}

function tickGlobalStatus(){
  updateHeaderStatus();
  updateNowCard();
  const dayName = DAYS_DE[new Date().getDay()];
  highlightCurrentCellIfPresent(dayName);
}

/* =========================
   Lernplan: Sessions & Generator
   ========================= */
export function taskProgress(t){
  if(!t.subtasks || t.subtasks.length===0) return t.progress||0;
  const d = t.subtasks.filter(s=>s.done).length;
  return Math.round((d/t.subtasks.length)*100);
}

export function sessionsForDay(date){
  const dayDE = DAYS_DE[new Date(date).getDay()];
  const wins  = (DB.studyWins?.[dayDE]||[]).map(w=>({ start:parseHHMM(w[0]), end:parseHHMM(w[1]) }));
  const blocks=[];
  wins.forEach(w=>{
    let cur = minutes(w.start), end = minutes(w.end);
    while (cur + (DB.settings?.sessionLen||30) <= end && blocks.length < (DB.settings?.maxSessions||4)){
      const sMin = cur, eMin = cur + (DB.settings?.sessionLen||30);
      blocks.push({ start: toHHMM(sMin), end: toHHMM(eMin) });
      cur = eMin;
    }
  });
  return blocks.map(b=>({ dateISO:new Date(date).toISOString(), start:b.start, end:b.end }));
}

export function planForDate(date){
  const d = atStartOfDay(date);
  const blocks = sessionsForDay(d);
  if(blocks.length===0) return [];
  // Kandidaten: unerledigte Aufgaben mit Restzeit, sortiert nach Deadline (ASC) und Priorität (DESC)
  const cands = [...(DB.tasks||[])]
    .filter(t=>!t.done && (t.estMin||0)>0)
    .map(t=>({ ...t, remaining: (t.estMin||0) * (1 - (taskProgress(t)/100)) }))
    .sort((a,b)=> (new Date(a.deadline)-new Date(b.deadline)) || ((b.priority||2)-(a.priority||2)));

  const sessions=[];
  blocks.forEach(b=>{
    const t = cands.find(x=>x.remaining>0 && (!x.deadline || new Date(x.deadline) >= d));
    if(t){
      t.remaining = Math.max(0, t.remaining - (DB.settings?.sessionLen||30));
      sessions.push({
        id: crypto.randomUUID(),
        dateISO: d.toISOString(),
        start: b.start,
        end:   b.end,
        subject: t.subject || "(Lernen)",
        taskId: t.id
      });
    }
  });
  return sessions;
}

export const getPlanFor = (date)=> (DB.planned?.byDate?.[isoDate(date)] || []);
export const setPlanFor = (date, arr)=>{ if(!DB.planned) DB.planned={byDate:{}}; if(!DB.planned.byDate) DB.planned.byDate={}; DB.planned.byDate[isoDate(date)] = arr; setDirty(); };

/* =========================
   Hausaufgaben-Autoliste
   ========================= */
export function ensureHomeworkFor(date){
  const key = isoDate(date);
  const dayName = weekdayDE(date);
  DB.homework = DB.homework || {};
  DB.homework[key] = DB.homework[key] || [];

  if(DB.homework[key].length===0){
    const subs = (DATA.entries?.[dayName]||[]).map(e=>e?.subject).filter(Boolean);
    const uniq = [...new Set(subs)];
    DB.homework[key] = uniq.map(s=>({ id:crypto.randomUUID(), subject:s, done:false, note:"" }));
    setDirty();
  }
}
