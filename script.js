// ------- Utilities
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// Scenes
const scenePreintro = $("#scene-preintro");
const scenePrelude  = $("#scene-prelude");
const sceneMain     = $("#scene-main");

// Preintro
const preintroVideo   = $("#preintroVideo");
const preintroOverlay = $("#preintroOverlay");
const preintroBtn     = $("#preintroTouchBtn");
const preintroRipple  = $("#preintroRipple");

// Prelude
const preludeVideo = $("#preludeVideo");
const preludeTag   = $("#preludeTag");
const prelEnZone   = $("#preludeEn");
const prelDeZone   = $("#preludeDe");

// Main
const muteBtn   = $("#muteBtn");
const muteIcon  = $("#muteIcon");
const tabBtns   = $$(".tab-btn");
const tabInv    = $("#tab-invitation");
const tabGame   = $("#tab-game");
const heroGlow  = $("#heroGlow");
const tuneBtn   = $("#tuneBtn");
const tuneIcons = $("#tuneIcons");
const instrumentLabelEl = $("#instrumentLabel");

// Global audio
let bgAudio, timpaniAudio;
let muted = false;
let bgTargetVolume = 0.05;
let bgFadeTimer = null;
const activeAudios = new Set();

function ensureBg(){
  if (!bgAudio){
    bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
    bgAudio.loop = true; bgAudio.volume = 0;
  }
  return bgAudio;
}
function ensureTimp(){
  if (!timpaniAudio){
    timpaniAudio = new Audio("media/TS_IFD_kick_timpani_heavy.wav");
    timpaniAudio.volume = muted ? 0 : 0.8;
  }
  return timpaniAudio;
}

function fadeAudioVol(audio, target, ms){
  if (!audio) return;
  const start = audio.volume;
  const delta = target - start;
  const t0 = performance.now();
  if (bgFadeTimer) cancelAnimationFrame(bgFadeTimer);
  (function step(t){
    const k = Math.min(1, (t - t0) / ms);
    audio.volume = Math.max(0, Math.min(1, start + delta * k));
    if (k < 1) bgFadeTimer = requestAnimationFrame(step);
  })(t0);
}

function playTimpani(){
  const t = ensureTimp();
  t.currentTime = 0;
  t.volume = muted ? 0 : 0.8;
  t.play().catch(()=>{});
}

function startBackgroundMusicFromPreintro(){
  const bg = ensureBg();
  bg.volume = muted ? 0 : 0;
  bg.play().catch(()=>{});
  // fade 0 -> 0.3 over ~6s initially
  fadeAudioVol(bg, muted ? 0 : 0.3, 6000);
}

// Mute
function applyMuteState(){
  document.body.classList.toggle("muted-world", muted);
  muteBtn.classList.toggle("muted", muted);
  muteIcon.textContent = muted ? "🔇" : "🔊";
  if (bgAudio) bgAudio.volume = muted ? 0 : bgTargetVolume;
  if (timpaniAudio) timpaniAudio.volume = muted ? 0 : 0.8;
  // voiceCtx handled below if present
  try{ if (voiceGain) voiceGain.gain.value = muted ? 0 : 1; }catch(e){}
}
function toggleMute(){
  muted = !muted;
  applyMuteState();
}

// Tabs
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const name = btn.dataset.tab;
    $("#tab-invitation").classList.toggle("active", name==="invitation");
    $("#tab-game").classList.toggle("active", name==="game");
  });
});

// Scene flow
function goToPrelude(){
  scenePreintro.classList.remove("scene-active");
  scenePrelude.classList.add("scene-active");
  sceneMain.classList.remove("scene-active");
  startPrelude();
}
function goToMain(){
  scenePreintro.classList.remove("scene-active");
  scenePrelude.classList.remove("scene-active");
  sceneMain.classList.add("scene-active");
}

// -------- Preintro interactions
let preintroTransitioning = false;

preintroBtn.addEventListener("click", () => {
  // First tap: timpani (per -1 rule), start bg music, DO NOT brighten yet
  playTimpani();
  startBackgroundMusicFromPreintro();
  preintroBtn.style.display = "none";
  // reveal halo
  preintroRipple.classList.add("preintro-ripple-active");
});

preintroRipple.addEventListener("click", () => {
  if (preintroTransitioning) return;
  preintroTransitioning = true;
  // Timpani again for second tap
  playTimpani();
  // Brighten overlay gradually for 5s, then go to Prelude
  if (preintroOverlay) preintroOverlay.classList.add("preintro-overlay-clear");
  setTimeout(() => { goToPrelude(); }, 5200);
});

// Auto video play (muted background for aesthetic)
preintroVideo?.play().catch(()=>{});

// -------- Prelude logic
let voiceCtx, voiceGain;
function ensureVoiceCtx(){
  if (!voiceCtx){
    voiceCtx = new (window.AudioContext || window.webkitAudioContext)();
    voiceGain = voiceCtx.createGain();
    voiceGain.gain.value = muted ? 0 : 1;
    voiceGain.connect(voiceCtx.destination);
  }
}
function playVoiceWithPan(url, pan){
  ensureVoiceCtx();
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  activeAudios.add(audio);
  const src = voiceCtx.createMediaElementSource(audio);
  const panner = voiceCtx.createStereoPanner ? voiceCtx.createStereoPanner() : null;
  if (panner){ panner.pan.value = pan; src.connect(panner).connect(voiceGain); }
  else{ src.connect(voiceGain); }
  audio.onended = () => activeAudios.delete(audio);
  audio.play().catch(()=>{});
  return audio;
}

// Keep bg gentle during voices
function fadeBgTo(vol, ms){ if (bgAudio) fadeAudioVol(bgAudio, muted?0:vol, ms); bgTargetVolume = vol; }

let preludeAutoTimer;
function startPrelude(){
  // Video play
  preludeVideo?.play().catch(()=>{});
  // voices: after ~4s start DE (pan +0.6), then EN (pan -0.6)
  setTimeout(()=>{
    fadeBgTo(0.01, 800);
    const de = playVoiceWithPan("media/prelude_voice_de_male.mp3", +0.6);
    de.onended = () => {
      setTimeout(()=>{
        const en = playVoiceWithPan("media/prelude_voice_en_female.mp3", -0.6);
        en.onended = () => {
          fadeBgTo(0.05, 1200);
        };
      }, 500);
    };
  }, 4000);

  clearTimeout(preludeAutoTimer);
  preludeAutoTimer = setTimeout(()=>{ goToMain(); }, 60000); // 60s idle -> main
}

// EN/DE tap feedback (timpani on any touch in scene 0)
prelEnZone.addEventListener("click", ()=>{ playTimpani(); });
prelDeZone.addEventListener("click", ()=>{ playTimpani(); });

// -------- Main Invitation
// Instruments
const instrumentRoles = [
  { id:"violins2", name:"Violins II", emoji:"🎻", sample:"media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav", family:"strings" },
  { id:"cellos",   name:"Cellos",     emoji:"🎻", sample:"media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav", family:"strings" },
  { id:"trumpets", name:"Trumpets",   emoji:"🎺", sample:"media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",   family:"brass"   },
  { id:"timpani",  name:"Timpani",    emoji:"🥁", sample:"media/zoid_percussion_timpani_roll_A.wav",               family:"timpani" }
];

let ownedInstruments = JSON.parse(localStorage.getItem("ownedInstruments")||"null");
if (!ownedInstruments || !Array.isArray(ownedInstruments) || ownedInstruments.length===0){
  const first = instrumentRoles[Math.floor(Math.random()*instrumentRoles.length)].id;
  ownedInstruments = [first];
  localStorage.setItem("ownedInstruments", JSON.stringify(ownedInstruments));
}

let ownedIndex = 0;
let tunePressCount = 0;
let mozartUnlocked = false;

function updateInstrumentLabel(){
  const id = ownedInstruments[0];
  const role = instrumentRoles.find(r=>r.id===id);
  instrumentLabelEl.textContent = role ? `YOU ARE ${role.name.toUpperCase()}` : "YOU ARE —";
}
function updateTuneIcons(){
  tuneIcons.innerHTML = "";
  ownedInstruments.forEach(id => {
    const info = instrumentRoles.find(r=>r.id===id);
    if (info){ const s=document.createElement("span"); s.textContent=info.emoji; tuneIcons.appendChild(s); }
  });
}
updateInstrumentLabel();
updateTuneIcons();

function duckBgWhile(ms){
  const prev = bgTargetVolume;
  fadeBgTo(0, 300);
  setTimeout(()=> fadeBgTo(prev, 800), ms+80);
}

function playTuningSample(id){
  const info = instrumentRoles.find(r=>r.id===id);
  if (!info) return;
  const a = new Audio(info.sample);
  const vol = info.id==="timpani" ? 1.0 : 0.7;
  a.volume = muted ? 0 : vol;
  // glow
  heroGlow.style.opacity = info.family==="strings" ? .55 : (info.family==="brass" ? .45 : .35);
  duckBgWhile( (a.duration||2.5)*1000 );
  a.onended = ()=>{ heroGlow.style.opacity = 0; };
  a.play().catch(()=>{});
}

function triggerMozartUnlock(){
  const pill = document.querySelector(".instrument-pill");
  if (pill){
    pill.classList.add("mozart-charging");
    setTimeout(()=>{
      instrumentLabelEl.textContent = "YOU ARE MOZART !";
      instrumentLabelEl.classList.add("mozart-reveal");
      setTimeout(()=>{
        pill.classList.remove("mozart-charging");
        pill.classList.add("mozart-glory");
        setTimeout(()=>{ pill.classList.remove("mozart-glory"); }, 2000);
      }, 1000); // wipe duration
    }, 3000);   // pre-charge duration
  }
}

tuneBtn.addEventListener("click", ()=>{
  tunePressCount++;
  if (!mozartUnlocked && tunePressCount>=10){
    mozartUnlocked = true;
    triggerMozartUnlock();
  }
  let roleId;
  if (mozartUnlocked){
    roleId = instrumentRoles[Math.floor(Math.random()*instrumentRoles.length)].id;
    // accumulate emoji
    const info = instrumentRoles.find(r=>r.id===roleId);
    if (info){ const s=document.createElement("span"); s.textContent=info.emoji; tuneIcons.appendChild(s); }
  }else{
    // cycle own
    roleId = ownedInstruments[ownedIndex % ownedInstruments.length];
    ownedIndex++;
  }
  playTuningSample(roleId);
});

// Geo demo
const geoBtn = $("#geoBtn");
const geoLog = $("#geoLog");
let geoWatchId = null;
geoBtn?.addEventListener("click", ()=>{
  if (!navigator.geolocation){ geoLog.textContent = "Geolocation not supported."; return; }
  geoLog.textContent = "Starting…";
  geoWatchId = navigator.geolocation.watchPosition(
    pos => {
      const {latitude, longitude} = pos.coords;
      geoLog.textContent = `You: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    },
    err => { geoLog.textContent = `Error: ${err.message}`; },
    { enableHighAccuracy:true, maximumAge: 1000, timeout: 8000 }
  );
});

// Mute
muteBtn.addEventListener("click", toggleMute);

// Start initial scene
document.addEventListener("DOMContentLoaded", ()=>{
  scenePreintro.classList.add("scene-active");
  applyMuteState();
});
