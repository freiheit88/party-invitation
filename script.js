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

// Prelude auto-transition
let preludeAutoTimer = null;
let preludeHasLeft = false;

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
  updateMusicPillVisual();
  applyMuteState();

  if (muted) {
    document.body.classList.add("muted-world");
    clearHeroGlow();
  } else {
    document.body.classList.remove("muted-world");
  }
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
function playNextOwnedInstrument() {
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
  // small timpani accent entering 0-scene
  playTimpani();
  preludeHasLeft = false;
  schedulePreludeVoices();

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

function leavePreludeToMain() {
  if (preludeHasLeft) return;
  preludeHasLeft = true;
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
  if (preludeVoiceStatus) preludeVoiceStatus.textContent = "Voices: waiting…";

  const maleDelay = 4000; // ms
  setTimeout(() => {
    playPreludeVoices();
  }, maleDelay);
}

function playPreludeVoices() {
  if (!preludeVoiceStatus) return;

  const male = new Audio("media/prelude_voice_de_male.wav");
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male);

  preludeVoiceStatus.textContent = "Voices: German voice playing…";
  duckBgDuring(5000);

  male.addEventListener("ended", () => {
    setTimeout(() => {
      const female = new Audio("media/prelude_voice_en_female.wav");
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female);
      preludeVoiceStatus.textContent = "Voices: English voice playing…";
      duckBgDuring(5000);

      female.addEventListener("ended", () => {
        preludeVoiceStatus.textContent = "Voices: finished – the room is listening.";
      });

      female.play().catch(() => {
        preludeVoiceStatus.textContent = "Voices: playback blocked.";
      });
    }, 500);
  });

  male.play().catch(() => {
    preludeVoiceStatus.textContent = "Voices: playback blocked.";
    // scene transition now handled by timeout or tap
  });
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
  // few fixed offsets in meters (rough)
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

function flashPreludeZone(zoneEl) {
  if (!zoneEl) return;
  zoneEl.classList.add("flash");
  setTimeout(() => {
    zoneEl.classList.remove("flash");
  }, 180);
}

// --------------------------
// Preintro interaction
// --------------------------

function handlePreintroTap() {
  // timpani accent
  playTimpani();

  // fade overlay
  if (preintroOverlay) {
    preintroOverlay.classList.add("preintro-overlay-clear");
  }
  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }

  startBackgroundMusicFromPreintro();

  // move to prelude after brightness fade
  setTimeout(() => {
    goToPrelude();
  }, 1800);
}

// --------------------------
// Music pill label update
// --------------------------

function updateMusicPillVisual() {
  if (!musicToggle || !musicLabel) return;
  if (muted) {
    musicToggle.classList.remove("music-on");
    musicToggle.classList.add("music-muted");
    musicLabel.textContent = "Muted · Tap to let it in";
  } else {
    musicToggle.classList.remove("music-muted");
    musicToggle.classList.add("music-on");
    musicLabel.textContent = "Music is alive";
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

  // Prelude left/right zones
  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => {
      flashPreludeZone(preludeZoneLeft);
      leavePreludeToMain();
    });
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => {
      flashPreludeZone(preludeZoneRight);
      leavePreludeToMain();
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
