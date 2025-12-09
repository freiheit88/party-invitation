// --------------------------
// Global audio + state
// --------------------------

let bgAudio = null;
let bgTargetVolume = 0.05; // 5%
let bgFadeInterval = null;
let muted = false;

// Keep track of all currently playing Audio elements for mute handling
const activeAudios = new Set();

// Instrument + tuning samples
const instrumentRoles = [
  { id: "cellos", display: "Cellos", emoji: "🎻" },
  { id: "trumpets", display: "Trumpets", emoji: "🎺" },
  { id: "violins2", display: "Violins II", emoji: "🎻" },
  { id: "timpani", display: "Timpani", emoji: "🥁" }
];

// Map instrument -> sample file
const instrumentSampleMap = {
  cellos: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
  trumpets: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",
  violins2: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
  timpani: "media/zoid_percussion_timpani_roll_A.wav"
};

// Assigned instrument for this user
let assignedInstrument = null;
// Instruments this user can currently ring (harmonics expands this)
let ownedInstruments = [];
let ownedIndex = 0;

// Hero glow
const heroGlow = document.getElementById("heroGlow");

// DOM refs for main controls
const musicToggle = document.getElementById("musicToggle");
const musicLabel = document.getElementById("musicLabel");
const instrumentLabelEl = document.getElementById("instrumentLabel");
const tuneButton = document.getElementById("tuneButton");
const tuneIcons = document.getElementById("tuneIcons");
const ownedInstrumentsHint = document.getElementById("ownedInstrumentsHint");

// Scenes
const scenePreintro = document.getElementById("scene-preintro");
const scenePrelude = document.getElementById("scene-prelude");
const sceneMain = document.getElementById("scene-main");

// Preintro elements
const preintroOverlay = document.getElementById("preintroOverlay");
const preintroPopup = document.getElementById("preintroPopup");
const preintroTouchBtn = document.getElementById("preintroTouchBtn");
const preintroRipple = document.getElementById("preintroRipple");

// Prelude elements
const preludeVoiceStatus = document.getElementById("preludeVoiceStatus");
const preludeZoneLeft = document.querySelector(".prelude-zone-left");
const preludeZoneRight = document.querySelector(".prelude-zone-right");

// Orchestra tab
const orchestraJoinBtn = document.getElementById("orchestraJoinBtn");
const orchestraPopup = document.getElementById("orchestraPopup");
const orchestraPopupClose = document.getElementById("orchestraPopupClose");
const orchestraModeEl = document.getElementById("orchestraMode");
const myCoordsEl = document.getElementById("myCoords");
const harmonicsStatusEl = document.getElementById("harmonicsStatus");

// geolocation watch id
let geoWatchId = null;

// hero caption
const heroDots = document.getElementById("heroDots");
let heroCaptionIndex = 0;
let heroCaptionTimer = null;

// Preintro / Prelude timing state
let preintroHasTapped = false;
let preintroIdleTimer = null;

let preludeAutoTimer = null;
let preludeTransitionStarted = false;

// Prelude voices / interrupt state
let preludeMaleAudio = null;
let preludeFemaleAudio = null;
let preludeInterruptAudio = null;
let preludeFadeInterval = null;
let preludeInterruptFlowStarted = false;

// --------------------------
// Utility: audio registration
// --------------------------

function registerAudio(el) {
  if (!el) return;
  activeAudios.add(el);
  el.addEventListener("ended", () => {
    activeAudios.delete(el);
  });
}

function applyMuteState() {
  activeAudios.forEach((audio) => {
    audio.volume = muted ? 0 : audio._baseVolume ?? audio.volume;
  });

  if (bgAudio) {
    bgAudio.volume = muted ? 0 : bgTargetVolume;
  }
}

function toggleMute() {
  muted = !muted;

  if (muted) {
    document.body.classList.add("muted-world");
    clearHeroGlow();
  } else {
    document.body.classList.remove("muted-world");
  }

  updateMusicPillVisual();
  applyMuteState();
}

// --------------------------
// Background music
// --------------------------

function initBgAudio() {
  if (bgAudio) return;
  bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
  bgAudio.loop = true;
  bgAudio.volume = 0;
  registerAudio(bgAudio);
}

function fadeBgTo(target, durationMs) {
  if (!bgAudio) return;
  if (bgFadeInterval) clearInterval(bgFadeInterval);

  const steps = Math.max(1, Math.floor(durationMs / 100));
  const start = bgAudio.volume;
  const delta = target - start;
  let i = 0;

  bgFadeInterval = setInterval(() => {
    i++;
    const t = i / steps;
    const v = start + delta * t;
    bgAudio.volume = muted ? 0 : v;
    if (i >= steps) {
      clearInterval(bgFadeInterval);
      bgFadeInterval = null;
      bgAudio.volume = muted ? 0 : target;
    }
  }, 100);
}

function startBackgroundMusicFromPreintro() {
  initBgAudio();
  if (!bgAudio) return;
  bgAudio
    .play()
    .then(() => {
      bgTargetVolume = 0.05;
      fadeBgTo(bgTargetVolume, 6000); // 0 -> 5% over 6s
    })
    .catch(() => {
      // autoplay blocked – do nothing, user may toggle later
    });
}

// Duck background fully, then restore at base level after sample
function duckBgDuring(sampleDurationMs) {
  if (!bgAudio) return;
  fadeBgTo(0, 300);
  setTimeout(() => {
    fadeBgTo(bgTargetVolume, 400);
  }, sampleDurationMs + 300);
}

// --------------------------
// Timpani (used in -1 and 0)
// --------------------------

function playTimpani() {
  const src = "media/TS_IFD_kick_timpani_heavy.wav";
  const audio = new Audio(src);
  audio._baseVolume = 0.8;
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);
  audio.play().catch(() => {});
}

// --------------------------
// Hero glow
// --------------------------

function applyHeroGlow(instrumentId) {
  if (!heroGlow) return;
  heroGlow.className = "hero-glow-layer";

  if (instrumentId === "violins2" || instrumentId === "cellos") {
    heroGlow.classList.add("glow-strings");
  } else if (instrumentId === "trumpets") {
    heroGlow.classList.add("glow-brass");
  } else if (instrumentId === "timpani") {
    heroGlow.classList.add("glow-timpani");
  }
  heroGlow.classList.add("glow-active");
}

function clearHeroGlow() {
  if (!heroGlow) return;
  heroGlow.classList.remove("glow-active", "glow-strings", "glow-brass", "glow-timpani");
}

// --------------------------
// Instrument assignment
// --------------------------

function getAssignedInstrument() {
  const key = "partyInstrumentRole_v2";
  const saved = window.localStorage ? localStorage.getItem(key) : null;
  if (saved) {
    const found = instrumentRoles.find((r) => r.id === saved);
    if (found) return found;
  }
  const idx = Math.floor(Math.random() * instrumentRoles.length);
  const chosen = instrumentRoles[idx];
  if (window.localStorage) localStorage.setItem(key, chosen.id);
  return chosen;
}

function updateOwnedInstrumentsHint() {
  if (!ownedInstrumentsHint) return;
  const labels = ownedInstruments.map((id) => {
    const role = instrumentRoles.find((r) => r.id === id);
    return role ? `${role.display}` : id;
  });
  if (!labels.length) {
    ownedInstrumentsHint.textContent = "";
  } else {
    ownedInstrumentsHint.textContent = "You currently carry: " + labels.join(" · ");
  }
}

// Round-robin through owned instruments
let tunePressCount=0; let mozartUnlocked=false;
function playNextOwnedInstrument() {
  tunePressCount++;
  if (!mozartUnlocked && tunePressCount>=10){ mozartUnlocked=true; triggerMozartUnlock(); }

  if (!ownedInstruments.length) return;
  const instrumentId = ownedInstruments[ownedIndex];
  ownedIndex = (ownedIndex + 1) % ownedInstruments.length;
  const src = instrumentSampleMap[instrumentId];
  if (!src) return;
  playTuningSample(src, instrumentId);
}

// When harmonics happen, we gain more instruments
function grantHarmonics(newInstrumentIds) {
  let added = [];
  newInstrumentIds.forEach((id) => {
    if (!ownedInstruments.includes(id)) {
      ownedInstruments.push(id);
      added.push(id);
    }
  });
  if (added.length && harmonicsStatusEl) {
    const names = added
      .map((id) => instrumentRoles.find((r) => r.id === id))
      .filter(Boolean)
      .map((r) => r.display)
      .join(" · ");
    harmonicsStatusEl.textContent = "Harmonics with: " + names;
  }
  updateOwnedInstrumentsHint();
  updateTuneIcons();
}

// update emoji icons on let A ring button
function updateTuneIcons() {
  if (!tuneIcons) return;
  tuneIcons.textContent = "";
  ownedInstruments.forEach((id) => {
    const role = instrumentRoles.find((r) => r.id === id);
    if (role && role.emoji) {
      tuneIcons.textContent += role.emoji + " ";
    }
  });
}

// --------------------------
// Tuning sample playback
// --------------------------

function playTuningSample(src, instrumentId) {
  const audio = new Audio(src);
  audio._baseVolume = 0.7;
  // special case: timpani tuning louder
  if (instrumentId === "timpani") {
    audio._baseVolume = 1.0;
  }
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);

  // ring animation on button
  if (tuneButton) {
    tuneButton.classList.add("ringing");
    setTimeout(() => {
      tuneButton.classList.remove("ringing");
    }, 250);
  }

  applyHeroGlow(instrumentId);
  duckBgDuring(3000);

  audio.addEventListener("ended", () => {
    clearHeroGlow();
  });

  audio.play().catch(() => {
    clearHeroGlow();
  });
}

// --------------------------
// Scene switching
// --------------------------

function showScene(sceneId) {
  [scenePreintro, scenePrelude, sceneMain].forEach((s) => {
    if (!s) return;
    if (s.id === sceneId) {
      s.classList.add("scene-visible");
    } else {
      s.classList.remove("scene-visible");
    }
  });
}

function goToPrelude() {
  showScene("scene-prelude");
  schedulePreludeVoices();

  preludeTransitionStarted = false;
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
  }
  preludeAutoTimer = setTimeout(() => {
    leavePreludeToMain();
  }, 30000);
}

function goToMain() {
  showScene("scene-main");
}

function leavePreintroToPrelude(){
  if (preintroTransitioning) return;
  preintroTransitioning = true;
  // play timpani once here
  playTimpani();
  // brighten overlay to clear (transition is 5s in CSS)
  if (preintroOverlay){
    preintroOverlay.classList.add("preintro-overlay-clear");
  }
  if (preintroRipple){
    preintroRipple.classList.add("preintro-ripple-leaving");
  }
  // wait ~5.2s then go to prelude
  setTimeout(() => {
    goToPrelude();
  }, 5200);
}
  if (preintroRipple) {
    preintroRipple.classList.remove("preintro-ripple-active");
    preintroRipple.classList.add("preintro-ripple-leaving");
  }
  // timpani accent for door between -1 and 0
  playTimpani();
  setTimeout(() => {
    goToPrelude();
  }, 400);
}

function leavePreludeToMain() {
  if (preludeTransitionStarted) return;
  preludeTransitionStarted = true;

  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  playTimpani();
  goToMain();
}

// --------------------------
// Prelude voices (scene 0)
// --------------------------

let preludeVoicesStarted = false;

function schedulePreludeVoices() {
  if (preludeVoicesStarted) return;
  preludeVoicesStarted = true;
  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: waiting…";
  }

  const maleDelay = 4000; // ms
  setTimeout(() => {
    playPreludeVoices();
  }, maleDelay);
}

function playPreludeVoices() {
  preludeMaleAudio = playVoiceWithPan("media/prelude_voice_de_male.mp3", +0.6);
  const male = preludeMaleAudio;
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male);

  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: German voice playing…";
  }
  duckBgDuring(5000);

  male.addEventListener("ended", () => {
    preludeMaleAudio = null;
    setTimeout(() => {
      preludeFemaleAudio = playVoiceWithPan("media/prelude_voice_en_female.mp3", -0.6);
      const female = preludeFemaleAudio;
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female);

      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: English voice playing…";
      }
      duckBgDuring(5000);

      female.addEventListener("ended", () => {
        preludeFemaleAudio = null;
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent =
            "Voices: finished – the room is listening.";
        }
        // no automatic goToMain(); transition is handled by taps / timeout / interrupt
      });

      female.play().catch(() => {
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent = "Voices: playback blocked.";
        }
      });
    }, 500);
  });

  male.play().catch(() => {
    if (preludeVoiceStatus) {
      preludeVoiceStatus.textContent = "Voices: playback blocked.";
    }
  });
}

function fadeOutPreludeVoiceAndThenInterrupt(targetLang) {
  if (preludeFadeInterval) {
    clearInterval(preludeFadeInterval);
    preludeFadeInterval = null;
  }

  const current =
    (preludeMaleAudio && !preludeMaleAudio.paused) ? preludeMaleAudio :
    (preludeFemaleAudio && !preludeFemaleAudio.paused) ? preludeFemaleAudio :
    null;

  function startInterruptTts() {
    let src;
    if (targetLang === "en") {
      src = "media/prelude_interrupt_en_female.mp3";
    } else {
      src = "media/prelude_interrupt_de_male.mp3";
    }

    preludeInterruptAudio = new Audio(src);
    const a = preludeInterruptAudio;
    a._baseVolume = 0.9;
    a.volume = muted ? 0 : a._baseVolume;
    registerAudio(a);

    if (preludeVoiceStatus) {
      preludeVoiceStatus.textContent =
        targetLang === "en"
          ? "Voices: switching gently to English…"
          : "Voices: switching gently to German…";
    }

    a.addEventListener("ended", () => {
      preludeInterruptAudio = null;
      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: handover finished.";
      }
      // interrupt line finished -> timpani + goToMain
      leavePreludeToMain();
    });

    a.play().catch(() => {
      // if interrupt TTS fails, still transition
      leavePreludeToMain();
    });
  }

  if (!current) {
    startInterruptTts();
    return;
  }

  const steps = 10;
  let i = 0;
  const startVol = current.volume;
  preludeFadeInterval = setInterval(() => {
    i++;
    const t = i / steps;
    const v = startVol * (1 - t);
    current.volume = muted ? 0 : Math.max(0, v);

    if (i >= steps) {
      clearInterval(preludeFadeInterval);
      preludeFadeInterval = null;
      current.pause();
      try {
        current.currentTime = 0;
      } catch (_) {}
      activeAudios.delete(current);
      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: softly interrupted.";
      }
      startInterruptTts();
    }
  }, 100);
}

function handlePreludeLanguageClick(lang) {
  if (preludeInterruptFlowStarted) return;
  preludeInterruptFlowStarted = true;

  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  fadeOutPreludeVoiceAndThenInterrupt(lang);
}

// --------------------------
// Hero caption rotation
// --------------------------

function initHeroCaptionSlider() {
  const captions = document.querySelectorAll(".hero-caption");
  if (!captions.length || !heroDots) return;

  function setCaption(index) {
    heroCaptionIndex = index;
    captions.forEach((el, i) => {
      el.classList.toggle("hero-caption-active", i === index);
    });
    const dots = heroDots.querySelectorAll(".hero-dot");
    dots.forEach((el, i) => {
      el.classList.toggle("hero-dot-active", i === index);
    });
  }

  function nextCaption() {
    const count = captions.length;
    if (!count) return;
    const next = (heroCaptionIndex + 1) % count;
    setCaption(next);
  }

  setCaption(0);
  heroCaptionTimer = setInterval(nextCaption, 7000);
}

// --------------------------
// Tabs
// --------------------------

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = {
    invitation: document.getElementById("tab-invitation"),
    howto: document.getElementById("tab-howto"),
    board: document.getElementById("tab-board"),
    orchestra: document.getElementById("tab-orchestra")
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.keys(tabPanels).forEach((k) => {
        const panel = tabPanels[k];
        if (!panel) return;
        panel.classList.toggle("active", k === key);
      });
    });
  });
}

// --------------------------
// Orchestra game (local test rig)
// --------------------------

let myPosition = null;
let ghostPlayers = []; // synthetic players

function initGhostPlayers() {
  ghostPlayers = [
    { id: "ghost1", latOffset: 0.00002, lonOffset: 0.00002, instrument: "trumpets" },
    { id: "ghost2", latOffset: -0.00001, lonOffset: 0.00003, instrument: "violins2" },
    { id: "ghost3", latOffset: 0.00003, lonOffset: -0.00002, instrument: "timpani" }
  ];
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function updateOrchestraDistances() {
  if (!myPosition || !ghostPlayers.length) return;

  const { latitude, longitude } = myPosition;
  const within = [];

  ghostPlayers.forEach((p) => {
    const lat2 = latitude + p.latOffset;
    const lon2 = longitude + p.lonOffset;
    const dist = haversineDistance(latitude, longitude, lat2, lon2);
    if (dist < 5) {
      within.push({ id: p.id, dist, instrument: p.instrument });
    }
  });

  if (!within.length) {
    orchestraModeEl.textContent = "Solo";
    harmonicsStatusEl.textContent = "none yet";
    return;
  }

  let mode = "Solo";
  if (within.length === 1) mode = "Duet";
  else if (within.length === 2) mode = "Trio";
  else mode = "Orchestra";

  orchestraModeEl.textContent = mode;
  const inst = within.map((w) => w.instrument);
  grantHarmonics(inst);
}

// --------------------------
// Preintro interaction
// --------------------------

let preintroTransitioning = false;
function safePlayTimpaniOnce(){ if (preintroTransitioning) return; playTimpani(); }

function handlePreintroTap() {
  if (preintroHasTapped) return;
  preintroHasTapped = true;

  // timpani on every tap in scene -1 (but prevent duplicates on scene leave)
  safePlayTimpaniOnce();

  // fade overlay
  if (preintroOverlay) {
    preintroOverlay.classList.add("preintro-overlay-clear");
  }
  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }

  if (preintroTouchBtn) {
    preintroTouchBtn.disabled = true;
  }

  startBackgroundMusicFromPreintro();

  // After brightness fade, show central ripple and start 7s idle timer
  const rippleDelay = 1300;
  setTimeout(() => {
    if (preintroRipple) {
      preintroRipple.classList.add("preintro-ripple-active");
    }

    preintroIdleTimer = setTimeout(() => {
      leavePreintroToPrelude();
    }, 7000);
  }, rippleDelay);
}

// --------------------------
// Music pill label update
// --------------------------

function updateMusicPillVisual() {
  if (!musicToggle) return;
  musicToggle.classList.remove("music-on", "music-muted");
  if (muted) {
    musicToggle.classList.add("music-muted");
  } else {
    musicToggle.classList.add("music-on");
  }
}

// --------------------------
// DOMContentLoaded init
// --------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Scene setup
  showScene("scene-preintro");

  // Preintro button
  if (preintroTouchBtn) {
    preintroTouchBtn.addEventListener("click", handlePreintroTap);
  }

  // Preintro central ripple -> Prelude
  if (preintroRipple) {
    preintroRipple.addEventListener("click", () => {
      leavePreintroToPrelude();
    });
  }

  // Prelude EN / DE zones -> interrupt TTS then Main
  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => {
      playTimpani(); handlePreludeLanguageClick("en");
    });
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => {
      playTimpani(); handlePreludeLanguageClick("de");
    });
  }

  // Instrument assignment
  assignedInstrument = getAssignedInstrument();
  ownedInstruments = [assignedInstrument.id];
  ownedIndex = 0;

  if (instrumentLabelEl) {
    instrumentLabelEl.textContent = assignedInstrument.display;
  }
  updateOwnedInstrumentsHint();
  updateTuneIcons();
  updateMusicPillVisual();

  // Music toggle
  if (musicToggle) {
    musicToggle.addEventListener("click", toggleMute);
  }

  // Let A ring
  if (tuneButton) {
    tuneButton.addEventListener("click", () => {
      playNextOwnedInstrument();
    });
  }

  // Tabs + hero caption
  initTabs();
  initHeroCaptionSlider();

  // Orchestra game
  initGhostPlayers();
  if (orchestraJoinBtn) {
    orchestraJoinBtn.addEventListener("click", () => {
      if (orchestraPopup) orchestraPopup.classList.remove("hidden");
      if (!navigator.geolocation) {
        if (myCoordsEl) myCoordsEl.textContent = "Geolocation not supported";
        return;
      }
      if (geoWatchId !== null) return;

      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          myPosition = pos.coords;
          if (myCoordsEl) {
            myCoordsEl.textContent =
              pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6);
          }
          updateOrchestraDistances();
        },
        (err) => {
          if (myCoordsEl) myCoordsEl.textContent = "Error: " + err.message;
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
      );
    });
  }
  if (orchestraPopupClose) {
    orchestraPopupClose.addEventListener("click", () => {
      orchestraPopup.classList.add("hidden");
    });
  }
});



/** Stereo panned voice playback for prelude */
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
  if (panner){
    panner.pan.value = pan;
    src.connect(panner).connect(voiceGain);
  }else{
    src.connect(voiceGain);
  }
  audio.onended = ()=>{ activeAudios.delete(audio); };
  audio.play().catch(()=>{});
  return audio;
}


function triggerMozartUnlock(){
  const pill = document.querySelector(".instrument-pill");
  if (pill){
    pill.classList.add("mozart-charging");
    setTimeout(()=>{
      const nameEl = document.getElementById("instrumentLabel");
      if (nameEl){
        nameEl.textContent = "YOU ARE MOZART !";
        nameEl.classList.add("mozart-reveal");
        setTimeout(()=>{
          pill.classList.remove("mozart-charging");
          pill.classList.add("mozart-glory");
          setTimeout(()=>{ pill.classList.remove("mozart-glory"); }, 2000);
        }, 1000);
      }
    }, 3000);
  }
}
function addMozartEmoji(emoji){
  const ic = document.getElementById("tuneIcons");
  if (!ic) return;
  const span = document.createElement("span");
  span.textContent = emoji;
  ic.appendChild(span);
}
