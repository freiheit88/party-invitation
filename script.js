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
  { id: "violins2", display: "Violins II", emoji: "🎻" },
  { id: "trumpets", display: "Trumpets", emoji: "🎺" },
  { id: "timpani", display: "Timpani", emoji: "🥁" }
];

const tuningSamples = {
  cellos: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
  violins2: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
  trumpets: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",
  timpani: "media/zoid_percussion_timpani_roll_A.wav"
};

// Owned instruments list for harmonics prototype
let ownedInstruments = [];

// Scene elements
const scenePreintro = document.getElementById("scene-preintro");
const scenePrelude = document.getElementById("scene-prelude");
const sceneMain = document.getElementById("scene-main");

// Preintro elements
const preintroOverlay = document.getElementById("preintroOverlay");
const preintroPopup = document.getElementById("preintroPopup");
const preintroTouchBtn = document.getElementById("preintroTouchBtn");

// Prelude elements
const preludeVoiceStatus = document.getElementById("preludeVoiceStatus");

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

// tune + instrument UI
const musicToggle = document.getElementById("musicToggle");
const musicLabel = document.getElementById("musicLabel");
const instrumentLabelEl = document.getElementById("instrumentLabel");
const tuneButton = document.getElementById("tuneButton");
const tuneEmojiEl = document.getElementById("tuneEmoji");
const ownedInstrumentsHint = document.getElementById("ownedInstrumentsHint");

// hero glow
const heroGlowLayer = document.getElementById("heroGlowLayer");

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

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

// --------------------------
// Scene helpers
// --------------------------

function showScene(id) {
  [scenePreintro, scenePrelude, sceneMain].forEach((scene) => {
    if (!scene) return;
    if (scene.id === id) {
      scene.classList.add("scene-visible");
    } else {
      scene.classList.remove("scene-visible");
    }
  });
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

// --------------------------
// Hero captions
// --------------------------

const heroCaptions = [
  "Alte Oper, late evening. Streetlights, footsteps, and the soft hum of traffic collecting around the square.",
  "Saturday, 14 June 2025 · 19:30 · Start at Alte Oper, Frankfurt. The final location reveals itself only when you stand on the square."
];

function updateHeroCaption() {
  const textEl = document.getElementById("heroCaptionText");
  if (!textEl) return;
  textEl.textContent = heroCaptions[heroCaptionIndex];

  if (!heroDots) return;
  const dots = heroDots.querySelectorAll(".dot");
  dots.forEach((dot, idx) => {
    if (idx === heroCaptionIndex) {
      dot.classList.add("dot-active");
    } else {
      dot.classList.remove("dot-active");
    }
  });
}

function startHeroCaptionRotation() {
  updateHeroCaption();
  if (heroCaptionTimer) clearInterval(heroCaptionTimer);
  heroCaptionTimer = setInterval(() => {
    heroCaptionIndex = (heroCaptionIndex + 1) % heroCaptions.length;
    updateHeroCaption();
  }, 7000);
}

// --------------------------
// Mute handling
// --------------------------

function applyMuteState() {
  if (muted) {
    document.body.classList.add("muted-world");
  } else {
    document.body.classList.remove("muted-world");
  }

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

  if (muted) clearHeroGlow();
}

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
// Background music
// --------------------------

function startBackgroundMusicFromPreintro() {
  if (bgAudio) return;

  bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
  bgAudio.loop = true;
  bgAudio.volume = 0;
  bgTargetVolume = 0.3;
  registerAudio(bgAudio);

  bgAudio.play().catch(() => {});

  if (bgFadeInterval) clearInterval(bgFadeInterval);
  bgFadeInterval = setInterval(() => {
    if (!bgAudio) return;
    const step = 0.01;
    if (bgAudio.volume < bgTargetVolume) {
      bgAudio.volume = Math.min(bgTargetVolume, bgAudio.volume + step);
    } else {
      clearInterval(bgFadeInterval);
      bgFadeInterval = null;
    }
  }, 200);
}

// When we are in main scene, keep bg at a subtle 5%
function setBackgroundMusicForMainScene() {
  if (!bgAudio) return;
  bgTargetVolume = 0.05;
  if (!muted) {
    bgAudio.volume = bgTargetVolume;
  }
}

// Ducking helper: temporarily lower bg during tuning
function duckBgDuring(durationMs) {
  if (!bgAudio) return;
  const original = bgTargetVolume;
  if (!muted) bgAudio.volume = 0;

  setTimeout(() => {
    bgTargetVolume = original;
    if (!muted) bgAudio.volume = bgTargetVolume;
  }, durationMs);
}

// --------------------------
// Tuning + hero glow
// --------------------------

function clearHeroGlow() {
  if (heroGlowLayer) {
    heroGlowLayer.className = "hero-glow-layer";
  }
}

function triggerHeroGlow(instrumentId) {
  if (!heroGlowLayer) return;
  heroGlowLayer.className = "hero-glow-layer";
  void heroGlowLayer.offsetWidth;

  let glowClass = "glow-strings";
  if (instrumentId === "trumpets") glowClass = "glow-brass";
  if (instrumentId === "timpani") glowClass = "glow-timpani";

  heroGlowLayer.classList.add(glowClass, "glow-active");
}

function playTimpani() {
  const audio = new Audio("media/TS_IFD_kick_timpani_heavy.wav");
  audio._baseVolume = 0.8;
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);
  audio.play().catch(() => {});
}

function playTuning(instrumentId) {
  const src = tuningSamples[instrumentId];
  if (!src) return;

  const audio = new Audio(src);
  const isTimp = instrumentId === "timpani";
  const baseVol = isTimp ? 1.0 : 0.7;
  audio._baseVolume = baseVol;
  audio.volume = muted ? 0 : baseVol;
  registerAudio(audio);

  duckBgDuring(4000);
  triggerHeroGlow(instrumentId);

  audio.addEventListener("ended", () => {
    if (!muted && bgAudio) {
      bgAudio.volume = bgTargetVolume;
    }
    clearHeroGlow();
  });

  audio.play().catch(() => {});
}

// --------------------------
// Instrument + owned set
// --------------------------

let assignedInstrumentRole = getAssignedInstrument();
ownedInstruments = [assignedInstrumentRole.id];

function updateInstrumentUI() {
  if (instrumentLabelEl) {
    instrumentLabelEl.textContent = assignedInstrumentRole.display;
  }
  if (tuneEmojiEl) {
    tuneEmojiEl.textContent = assignedInstrumentRole.emoji;
  }
  updateOwnedInstrumentsHint();
}

function playNextOwnedInstrument() {
  if (!ownedInstruments.length) return;
  const nextId = ownedInstruments[0];
  playTuning(nextId);
}

// --------------------------
// Tabs
// --------------------------

function setupTabs() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (!tab) return;

      tabButtons.forEach((b) => b.classList.remove("tab-btn-active"));
      btn.classList.add("tab-btn-active");

      tabPanels.forEach((panel) => {
        if (panel.getAttribute("data-tab-panel") === tab) {
          panel.classList.add("tab-panel-active");
        } else {
          panel.classList.remove("tab-panel-active");
        }
      });

      if (tab === "invitation") {
        setBackgroundMusicForMainScene();
      }
    });
  });
}

// --------------------------
// Prelude voices (scene 0)
// --------------------------

let preludeVoicesStarted = false;

function schedulePreludeVoices() {
  if (preludeVoicesStarted) return;
  preludeVoicesStarted = true;
  if (preludeVoiceStatus) preludeVoiceStatus.textContent = "Voices: waiting…";

  const maleDelay = 4000;
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
        setTimeout(() => {
          goToMain();
        }, 1200);
      });

      female.play().catch(() => {
        preludeVoiceStatus.textContent = "Voices: (could not play English line)";
      });
    }, 500);
  });

  male.play().catch(() => {
    preludeVoiceStatus.textContent = "Voices: (could not play German line)";
  });
}

// --------------------------
// Orchestra game (local test rig)
// --------------------------

let myPosition = null;
let ghostPlayers = [];

function initGhostPlayers() {
  ghostPlayers = [
    { id: "ghost1", latOffset: 0.00002, lonOffset: 0.00002, instrumentRole: "violins2" },
    { id: "ghost2", latOffset: -0.00003, lonOffset: 0.00001, instrumentRole: "trumpets" },
    { id: "ghost3", latOffset: 0.00005, lonOffset: -0.00002, instrumentRole: "cellos" }
  ];
}

function toRad(x) {
  return (x * Math.PI) / 180;
}

function distanceInMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const aa =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function updateHarmonics() {
  if (!myPosition) {
    if (harmonicsStatusEl) {
      harmonicsStatusEl.textContent = "Waiting for the first player.";
    }
    return;
  }

  const myRangeM = 5;
  const me = { lat: myPosition.lat, lon: myPosition.lon };
  const nearby = [];

  ghostPlayers.forEach((ghost) => {
    const gpos = {
      lat: myPosition.lat + ghost.latOffset,
      lon: myPosition.lon + ghost.lonOffset
    };
    const dist = distanceInMeters(me, gpos);
    if (dist <= myRangeM) {
      nearby.push({ ghost, dist });
    }
  });

  if (!nearby.length) {
    ownedInstruments = [assignedInstrumentRole.id];
    updateOwnedInstrumentsHint();
    if (harmonicsStatusEl) {
      harmonicsStatusEl.textContent = "No harmonics yet. You are tuning solo.";
    }
    return;
  }

  const newOwned = new Set([assignedInstrumentRole.id]);
  nearby.forEach(({ ghost }) => {
    if (ghost.instrumentRole) newOwned.add(ghost.instrumentRole);
  });
  ownedInstruments = Array.from(newOwned);
  updateOwnedInstrumentsHint();

  if (harmonicsStatusEl) {
    harmonicsStatusEl.textContent = `Harmonics with ${nearby.length} nearby player(s).`;
  }
}

// --------------------------
// Geolocation handling
// --------------------------

function startOrchestraGame() {
  if (!navigator.geolocation) {
    if (orchestraModeEl) {
      orchestraModeEl.textContent = "Location not available on this device.";
    }
    return;
  }

  if (orchestraModeEl) orchestraModeEl.textContent = "Listening to the square";
  if (harmonicsStatusEl) harmonicsStatusEl.textContent = "Waiting for other players…";

  initGhostPlayers();

  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      myPosition = { lat: latitude, lon: longitude };
      if (myCoordsEl) {
        myCoordsEl.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }
      updateHarmonics();
    },
    () => {
      if (orchestraModeEl) {
        orchestraModeEl.textContent = "Location permission denied.";
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 8000
    }
  );
}

function stopOrchestraGame() {
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
  myPosition = null;
  ownedInstruments = [assignedInstrumentRole.id];
  updateOwnedInstrumentsHint();
  if (orchestraModeEl) orchestraModeEl.textContent = "Idle";
  if (myCoordsEl) myCoordsEl.textContent = "—";
  if (harmonicsStatusEl) harmonicsStatusEl.textContent = "Waiting for the first player.";
}

// --------------------------
// Scene transitions
// --------------------------

function goToPrelude() {
  showScene("scene-prelude");
  // small timpani accent entering 0-scene
  playTimpani();
  schedulePreludeVoices();
}

function goToMain() {
  showScene("scene-main");
}

// --------------------------
// Pre-intro interaction
// --------------------------

function handlePreintroTap() {
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
// DOMContentLoaded init
// --------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Scene setup
  showScene("scene-preintro");

  // Preintro button
  if (preintroTouchBtn) {
    preintroTouchBtn.addEventListener("click", handlePreintroTap);
  }

  // Instrument assignment
  updateInstrumentUI();

  // Tune button
  if (tuneButton) {
    tuneButton.addEventListener("click", () => {
      playNextOwnedInstrument();
    });
  }

  // Mute toggle
  if (musicToggle) {
    musicToggle.addEventListener("click", toggleMute);
  }
  updateMusicPillVisual();

  // Tabs
  setupTabs();
  startHeroCaptionRotation();

  // Orchestra join button (simple popup-less version here)
  if (orchestraJoinBtn) {
    orchestraJoinBtn.addEventListener("click", () => {
      startOrchestraGame();
    });
  }
});
