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

// Hero glow element
const heroGlow = document.getElementById("heroGlow");

// Main control elements
const musicToggle = document.getElementById("musicToggle");
const instrumentLabelEl = document.getElementById("instrumentLabel");
const tuneButton = document.getElementById("tuneButton");
const tuneIcons = document.getElementById("tuneIcons");
const ownedInstrumentsHint = document.getElementById("ownedInstrumentsHint");

// Scene elements
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

// Orchestra tab elements
const orchestraJoinBtn = document.getElementById("orchestraJoinBtn");
const orchestraPopup = document.getElementById("orchestraPopup");
const orchestraPopupClose = document.getElementById("orchestraPopupClose");
const orchestraModeEl = document.getElementById("orchestraMode");
const myCoordsEl = document.getElementById("myCoords");
const harmonicsStatusEl = document.getElementById("harmonicsStatus");

// Geolocation watch ID
let geoWatchId = null;

// Hero caption rotation
const heroDots = document.getElementById("heroDots");
let heroCaptionIndex = 0;
let heroCaptionTimer = null;

// Preintro / Prelude timing state
let preintroHasTapped = false;
let preintroIdleTimer = null;
let preludeAutoTimer = null;
let preludeTransitionStarted = false;

// --------------------------
// Utility: audio registration & mute control
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
  bgAudio.play().then(() => {
    bgTargetVolume = 0.05;
    fadeBgTo(bgTargetVolume, 6000); // Fade in to 5% volume over 6s
  }).catch(() => {
    // Autoplay blocked – user can enable sound manually later
  });
}

// Duck background fully, then restore at base level after a sample plays
function duckBgDuring(sampleDurationMs) {
  if (!bgAudio) return;
  fadeBgTo(0, 300);
  setTimeout(() => {
    fadeBgTo(bgTargetVolume, 400);
  }, sampleDurationMs + 300);
}

// --------------------------
// Timpani (used in scenes -1 and 0)
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
// Hero glow effects
// --------------------------

function applyHeroGlow(instrumentId) {
  if (!heroGlow) return;
  heroGlow.className = "hero-glow-layer"; // reset classes
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
// Instrument assignment & display
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
  ownedInstrumentsHint.textContent = labels.length
    ? "You currently carry: " + labels.join(" · ")
    : "";
}

// Round-robin through owned instruments on each "Let A ring"
function playNextOwnedInstrument() {
  if (!ownedInstruments.length) return;
  const instrumentId = ownedInstruments[ownedIndex];
  ownedIndex = (ownedIndex + 1) % ownedInstruments.length;
  const src = instrumentSampleMap[instrumentId];
  if (!src) return;
  playTuningSample(src, instrumentId);
}

// When harmonics are triggered (meeting other players), gain more instruments
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

// Update the emoji icons on the "Let A ring" button to reflect all instruments acquired
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
// Tuning sample playback (A note sound)
// --------------------------

function playTuningSample(src, instrumentId) {
  const audio = new Audio(src);
  audio._baseVolume = 0.7;
  // special case: timpani tuning sample a bit louder
  if (instrumentId === "timpani") {
    audio._baseVolume = 1.0;
  }
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);

  // small ring animation on button press
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
      s.classList.add("scene-visible");    // mark as visible/active
    } else {
      s.classList.remove("scene-visible"); // hide other scenes
    }
  });
}

function goToPrelude() {
  showScene("scene-prelude");
  // timpani accent entering Prelude scene
  playTimpani();
  schedulePreludeVoices();
  preludeTransitionStarted = false;
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
  }
  // Start 30s auto-transition timer in case of no interaction
  preludeAutoTimer = setTimeout(() => {
    preludeAutoTimer = null;
    fadeOutCurrentPreludeVoice(() => {
      leavePreludeToMain();
    });
  }, 30000);
}

function goToMain() {
  showScene("scene-main");
}

function leavePreintroToPrelude() {
  if (preintroIdleTimer) {
    clearTimeout(preintroIdleTimer);
    preintroIdleTimer = null;
  }
  if (preintroRipple) {
    preintroRipple.classList.remove("preintro-ripple-active");
    preintroRipple.classList.add("preintro-ripple-leaving");
  }
  // timpani accent for the door opening between scene -1 and 0
  playTimpani();
  // Slight delay before actually switching scenes for effect
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
  // timpani accent when leaving prelude to main
  playTimpani();
  goToMain();
}

// --------------------------
// Prelude voices (scene 0 narration)
// --------------------------

let preludeVoicesStarted = false;
let preludeCurrentVoice = null;
let preludeFadeInterval = null;
let preludeInterruptAudio = null;

function schedulePreludeVoices() {
  if (preludeVoicesStarted) return;
  preludeVoicesStarted = true;
  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: waiting…";
  }
  const maleDelay = 4000; // start male voice after 4s
  setTimeout(() => {
    playPreludeVoicesSequence();
  }, maleDelay);
}

function playPreludeVoicesSequence() {
  // German male voice first
  const male = new Audio("media/prelude_voice_de_male.mp3");
  preludeCurrentVoice = male;
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male);
  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: German voice playing…";
  }
  duckBgDuring(5000);

  male.addEventListener("ended", () => {
    preludeCurrentVoice = null;
    setTimeout(() => {
      // English female voice second (after a brief pause)
      const female = new Audio("media/prelude_voice_en_female.mp3");
      preludeCurrentVoice = female;
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female);
      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: English voice playing…";
      }
      duckBgDuring(5000);
      female.addEventListener("ended", () => {
        preludeCurrentVoice = null;
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent = "Voices: finished – the room is listening.";
        }
      });
      female.play().catch(() => {
        preludeCurrentVoice = null;
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent = "Voices: playback blocked.";
        }
      });
    }, 500);
  });

  male.play().catch(() => {
    preludeCurrentVoice = null;
    if (preludeVoiceStatus) {
      preludeVoiceStatus.textContent = "Voices: playback blocked.";
    }
  });
}

/**
 * Fade out any currently playing Prelude voice over ~1s,
 * then invoke the provided callback.
 */
function fadeOutCurrentPreludeVoice(callback) {
  if (preludeFadeInterval) {
    clearInterval(preludeFadeInterval);
    preludeFadeInterval = null;
  }
  const voice = preludeCurrentVoice;
  if (!voice) {
    if (typeof callback === "function") callback();
    return;
  }
  let steps = 10;
  const intervalMs = 100;
  let currentStep = 0;
  const startVolume = voice._baseVolume ?? voice.volume ?? 1;
  preludeFadeInterval = setInterval(() => {
    currentStep += 1;
    const progress = currentStep / steps;
    const newBase = startVolume * Math.max(0, 1 - progress);
    voice._baseVolume = newBase;
    voice.volume = muted ? 0 : newBase;
    if (currentStep >= steps) {
      clearInterval(preludeFadeInterval);
      preludeFadeInterval = null;
      voice.pause();
      preludeCurrentVoice = null;
      if (typeof callback === "function") callback();
    }
  }, intervalMs);
}

/**
 * Play a short "interrupt" voice in Prelude (based on selected language),
 * then transition to the main scene.
 */
function playPreludeInterrupt(lang) {
  const src =
    lang === "en"
      ? "media/prelude_interrupt_en_female.mp3"
      : "media/prelude_interrupt_de_male.mp3";
  const interrupt = new Audio(src);
  preludeInterruptAudio = interrupt;
  interrupt._baseVolume = 0.9;
  interrupt.volume = muted ? 0 : interrupt._baseVolume;
  registerAudio(interrupt);
  interrupt.addEventListener("ended", () => {
    preludeInterruptAudio = null;
    leavePreludeToMain();
  });
  interrupt.play().catch(() => {
    preludeInterruptAudio = null;
    leavePreludeToMain();
  });
}

// --------------------------
// Hero caption rotation slider
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
// Tab functionality
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
// Orchestra game (local test rig for location-based harmonics)
// --------------------------

let myPosition = null;
let ghostPlayers = []; // synthetic nearby players for testing

function initGhostPlayers() {
  // Some fixed coordinate offsets (in degrees ~ meters)
  ghostPlayers = [
    { id: "ghost1", latOffset: 0.00002, lonOffset: 0.00002, instrument: "trumpets" },
    { id: "ghost2", latOffset: -0.00001, lonOffset: 0.00003, instrument: "violins2" },
    { id: "ghost3", latOffset: 0.00003, lonOffset: -0.00002, instrument: "timpani" }
  ];
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
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
// DOMContentLoaded – Initialize app
// --------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Start at Scene -1 (Preintro)
  showScene("scene-preintro");

  // Preintro: button tap
  if (preintroTouchBtn) {
    preintroTouchBtn.addEventListener("click", handlePreintroTap);
  }
  // Preintro: central ripple -> go to Prelude
  if (preintroRipple) {
    preintroRipple.addEventListener("click", () => {
      leavePreintroToPrelude();
    });
  }

  // Prelude: EN / DE zone clicks -> fade voice & interrupt then go to main
  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => {
      fadeOutCurrentPreludeVoice(() => {
        playPreludeInterrupt("en");
      });
    });
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => {
      fadeOutCurrentPreludeVoice(() => {
        playPreludeInterrupt("de");
      });
    });
  }

  // Assign a random instrument to the user and set it
  assignedInstrument = getAssignedInstrument();
  ownedInstruments = [assignedInstrument.id];
  ownedIndex = 0;
  if (instrumentLabelEl) {
    instrumentLabelEl.textContent = assignedInstrument.display;
  }
  updateOwnedInstrumentsHint();
  updateTuneIcons();
  updateMusicPillVisual();

  // Music toggle button
  if (musicToggle) {
    musicToggle.addEventListener("click", toggleMute);
  }
  // "Let A ring" button
  if (tuneButton) {
    tuneButton.addEventListener("click", () => {
      playNextOwnedInstrument();
    });
  }

  // Initialize tab switching and hero caption slider
  initTabs();
  initHeroCaptionSlider();

  // Initialize the Orchestra game test rig
  initGhostPlayers();
  if (orchestraJoinBtn) {
    orchestraJoinBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported.");
        return;
      }
      orchestraPopup.classList.remove("hidden");
      // Start watching position (simulate join)
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          myPosition = { latitude, longitude };
          myCoordsEl.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          updateOrchestraDistances();
        },
        () => {
          myCoordsEl.textContent = "Permission denied";
        },
        { enableHighAccuracy: false, maximumAge: 1000, timeout: 10000 }
      );
    });
  }
  if (orchestraPopupClose) {
    orchestraPopupClose.addEventListener("click", () => {
      orchestraPopup.classList.add("hidden");
    });
  }
});

// --------------------------
// Preintro interaction handler
// --------------------------

function handlePreintroTap() {
  if (preintroHasTapped) return;
  preintroHasTapped = true;
  // Play timpani accent on first touch (once)
  playTimpani();
  // Fade out the dark overlay and hide the popup
  if (preintroOverlay) {
    preintroOverlay.classList.add("preintro-overlay-clear");
  }
  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }
  if (preintroTouchBtn) {
    preintroTouchBtn.disabled = true;
  }
  // Start background music (serenade)
  startBackgroundMusicFromPreintro();
  // After overlay fade, show ripple and start idle timer for auto transition
  const rippleDelay = 1300; // matches CSS transition duration
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
// Music pill label update (on mute toggle)
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
