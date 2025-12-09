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
  { id: "flutes", display: "Flutes", emoji: "🎶" },
  { id: "timpani", display: "Timpani", emoji: "🥁" },
  { id: "clarinets", display: "Clarinets", emoji: "🎵" },
];

const tuningSamples = {
  cellos: "media/A_432_cello_section.mp3",
  trumpets: "media/A_432_trumpet_section.mp3",
  flutes: "media/A_432_flute_section.mp3",
  timpani: "media/A_432_timpani_roll.mp3",
  clarinets: "media/A_432_clarinet_section.mp3",
};

const bgMusicSrc = "media/bg_invitation_loop.mp3";

// Local storage keys
const LS_INSTRUMENT = "seansPartyInstrument";

// Simple random helper
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --------------------------
// DOM references
// --------------------------

// Layout
const heroDots = document.getElementById("heroDots");
const heroCaptionEls = document.querySelectorAll(".hero-caption");
const heroGlowEl = document.getElementById("heroGlow");

// Tuning
const instrumentLabelEl = document.getElementById("instrumentLabel");
const instrumentEmojiEl = document.getElementById("instrumentEmoji");
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
const distanceListEl = document.getElementById("distanceList");
const ownedInstrumentsListEl = document.getElementById("ownedInstrumentsList");

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// Music pill
const musicPill = document.getElementById("musicPill");
const musicPillIcon = document.getElementById("musicPillIcon");
const musicPillLabel = document.getElementById("musicPillLabel");

// --------------------------
// Scene helpers
// --------------------------

function showScene(id) {
  const scenes = [scenePreintro, scenePrelude, sceneMain];
  for (const scene of scenes) {
    if (!scene) continue;
    scene.classList.toggle("scene-visible", scene.id === id);
  }
}

// --------------------------
// Audio helpers
// --------------------------

function registerAudio(audio) {
  activeAudios.add(audio);
  audio.addEventListener(
    "ended",
    () => {
      activeAudios.delete(audio);
    },
    { once: true }
  );
}

function applyMuteState() {
  for (const audio of activeAudios) {
    if (muted) {
      audio._prevVolume = audio._prevVolume ?? audio.volume;
      audio.volume = 0;
    } else if (typeof audio._prevVolume === "number") {
      audio.volume = audio._prevVolume;
    }
  }
  if (bgAudio) {
    bgAudio.muted = muted;
  }
}

// Fade background over ms
function fadeBgTo(target, ms = 600) {
  if (!bgAudio) return;
  if (bgFadeInterval) {
    clearInterval(bgFadeInterval);
    bgFadeInterval = null;
  }

  const steps = 20;
  const start = bgAudio.volume;
  let i = 0;
  const stepTime = ms / steps;

  bgFadeInterval = setInterval(() => {
    i++;
    const t = i / steps;
    const v = start + (target - start) * t;
    bgAudio.volume = muted ? 0 : Math.max(0, Math.min(1, v));

    if (i >= steps) {
      clearInterval(bgFadeInterval);
      bgFadeInterval = null;
    }
  }, stepTime);
}

// Background music start
function ensureBackgroundMusic() {
  if (bgAudio) return;
  bgAudio = new Audio(bgMusicSrc);
  bgAudio.loop = true;
  bgAudio.volume = muted ? 0 : bgTargetVolume;
  bgAudio.preload = "auto";
  registerAudio(bgAudio);
  bgAudio
    .play()
    .then(() => {})
    .catch(() => {});
}

function startBackgroundMusicFromPreintro() {
  ensureBackgroundMusic();
  if (bgAudio) {
    bgAudio.volume = 0;
    fadeBgTo(bgTargetVolume, 1500);
  }
}

// Duck background fully, then restore at base level after sample
function duckBgDuring(sampleDurationMs) {
  if (!bgAudio) return;
  fadeBgTo(0, 300);
  setTimeout(() => {
    fadeBgTo(bgTargetVolume, 400);
  }, sampleDurationMs + 300);
}

// Prelude voices: keep BGM low for entire speech sequence, then raise back
function duckBgForPreludeVoicesStart() {
  if (!bgAudio) return;
  fadeBgTo(0, 400);
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
  audio
    .play()
    .then(() => {})
    .catch(() => {});
}

// --------------------------
// Global mute toggle
// --------------------------

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

function updateMusicPillVisual() {
  if (!musicPillIcon || !musicPillLabel) return;

  if (muted || !bgAudio || bgAudio.paused) {
    musicPillIcon.textContent = "♪";
    musicPillLabel.textContent = "Music is sleeping";
  } else {
    musicPillIcon.textContent = "𝄞";
    musicPillLabel.textContent = "Music is quietly listening";
  }
}

function handleMusicPillClick() {
  if (!bgAudio) {
    ensureBackgroundMusic();
  }

  toggleMute();

  if (!muted && bgAudio && bgAudio.paused) {
    bgAudio
      .play()
      .then(() => {})
      .catch(() => {});
  }
}

// --------------------------
// Preintro interaction
// --------------------------

let preintroHasTapped = false;
let preintroIdleTimer = null;

function handlePreintroTap() {
  if (preintroHasTapped) return;
  preintroHasTapped = true;

  // First tap: timpani + music start, but do NOT brighten yet
  playTimpani();

  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }

  if (preintroTouchBtn) {
    preintroTouchBtn.disabled = true;
  }

  startBackgroundMusicFromPreintro();

  // After a short delay, show central ripple and start 7s idle timer
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

function leavePreintroToPrelude(fromTap = false) {
  if (preintroIdleTimer) {
    clearTimeout(preintroIdleTimer);
    preintroIdleTimer = null;
  }
  if (preintroRipple) {
    preintroRipple.classList.remove("preintro-ripple-active");
    preintroRipple.classList.add("preintro-ripple-leaving");
  }

  // Brighten only when actually leaving -1 for 0
  if (preintroOverlay) {
    preintroOverlay.classList.add("preintro-overlay-clear");
  }

  // Avoid duplicate timpani at the exact transition moment
  if (!fromTap) {
    playTimpani();
  }

  setTimeout(() => {
    goToPrelude();
  }, 400);
}

function leavePreludeToMain(fromTap = false) {
  if (preludeTransitionStarted) return;
  preludeTransitionStarted = true;

  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  if (!fromTap) {
    // Auto timeout, etc. — timpani accent only if not already played by tap
    playTimpani();
  }
  goToMain();
}

// --------------------------
// Prelude voices / interrupt state
// --------------------------

let preludeMaleAudio = null;
let preludeFemaleAudio = null;
let preludeInterruptAudio = null;
let preludeFadeInterval = null;
let preludeInterruptFlowStarted = false;
let preludeVoiceTimer = null;

// --------------------------
// Utility: audio registration
// --------------------------

// (registerAudio defined above)

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

  const maleDelay = 1000; // 1s after entering Prelude
  preludeVoiceTimer = setTimeout(() => {
    preludeVoiceTimer = null;
    playPreludeVoices();
  }, maleDelay);
}

function playPreludeVoices() {
  // Start full Prelude voice sequence with BGM gently ducked
  duckBgForPreludeVoicesStart();

  preludeMaleAudio = new Audio("media/prelude_voice_de_male.mp3");
  const male = preludeMaleAudio;
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male);

  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: German voice playing…";
  }

  male.addEventListener("ended", () => {
    preludeMaleAudio = null;
    setTimeout(() => {
      preludeFemaleAudio = new Audio("media/prelude_voice_en_female.mp3");
      const female = preludeFemaleAudio;
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female);

      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: English voice playing…";
      }

      female.addEventListener("ended", () => {
        preludeFemaleAudio = null;
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent =
            "Voices: finished – the room is listening.";
        }
        // Once both voices are done, restore BGM to its natural level
        fadeBgTo(bgTargetVolume, 700);
      });

      female.play().catch(() => {
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent = "Voices: playback blocked.";
        }
        // If playback fails, still restore the BGM
        fadeBgTo(bgTargetVolume, 700);
      });
    }, 500);
  });

  male.play().catch(() => {
    if (preludeVoiceStatus) {
      preludeVoiceStatus.textContent = "Voices: playback blocked.";
    }
    // If playback fails immediately, restore the BGM as well
    fadeBgTo(bgTargetVolume, 700);
  });
}

function fadeOutPreludeVoiceAndThenInterrupt(targetLang) {
  if (preludeFadeInterval) {
    clearInterval(preludeFadeInterval);
    preludeFadeInterval = null;
  }

  const current =
    (preludeMaleAudio && !preludeMaleAudio.paused)
      ? preludeMaleAudio
      : (preludeFemaleAudio && !preludeFemaleAudio.paused)
        ? preludeFemaleAudio
        : null;

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

    // Keep BGM low for the interrupt line as well
    fadeBgTo(0, 400);

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
      // Interrupt line finished -> transition to main (timpani was already played on tap)
      fadeBgTo(bgTargetVolume, 700);
      leavePreludeToMain(true);
    });

    a.play().catch(() => {
      // If interrupt TTS fails, still transition but avoid duplicate timpani
      leavePreludeToMain(true);
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

  if (preludeVoiceTimer) {
    clearTimeout(preludeVoiceTimer);
    preludeVoiceTimer = null;
  }

  fadeOutPreludeVoiceAndThenInterrupt(lang);
}

// --------------------------
// Hero caption rotation
// --------------------------

function initHeroCaptionSlider() {
  const captions = document.querySelectorAll(".hero-caption");
  if (!captions.length || !heroDots) return;

  heroDots.innerHTML = "";
  captions.forEach((_c, idx) => {
    const dot = document.createElement("span");
    dot.className = "hero-dot" + (idx === 0 ? " hero-dot-active" : "");
    heroDots.appendChild(dot);
  });

  let current = 0;
  const dots = heroDots.querySelectorAll(".hero-dot");

  function setCaption(idx) {
    captions.forEach((el, i) => {
      el.classList.toggle("hero-caption-visible", i === idx);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("hero-dot-active", i === idx);
    });
  }

  setCaption(current);

  setInterval(() => {
    current = (current + 1) % captions.length;
    setCaption(current);
  }, 5000);
}

// --------------------------
// Hero glow
// --------------------------

let heroGlowTimeout = null;

function triggerHeroGlow() {
  if (!heroGlowEl) return;
  heroGlowEl.classList.add("hero-glow-active");
  if (heroGlowTimeout) clearTimeout(heroGlowTimeout);
  heroGlowTimeout = setTimeout(() => {
    heroGlowEl.classList.remove("hero-glow-active");
  }, 1400);
}

function clearHeroGlow() {
  if (!heroGlowEl) return;
  heroGlowEl.classList.remove("hero-glow-active");
}

// --------------------------
// Instrument assignment
// --------------------------

let assignedInstrument = null;
let ownedInstruments = [];
let ownedIndex = 0;

function getAssignedInstrument() {
  const storedId = localStorage.getItem(LS_INSTRUMENT);
  if (storedId) {
    const match = instrumentRoles.find((r) => r.id === storedId);
    if (match) return match;
  }
  const chosen = pickRandom(instrumentRoles);
  localStorage.setItem(LS_INSTRUMENT, chosen.id);
  return chosen;
}

function updateInstrumentUI() {
  if (!assignedInstrument) return;
  if (instrumentLabelEl) instrumentLabelEl.textContent = assignedInstrument.display;
  if (instrumentEmojiEl) instrumentEmojiEl.textContent = assignedInstrument.emoji;
}

function playInstrumentSample(roleId) {
  const src = tuningSamples[roleId];
  if (!src) return;

  const audio = new Audio(src);
  audio._baseVolume = 0.9;
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);

  duckBgDuring(3500);

  triggerHeroGlow();

  audio
    .play()
    .then(() => {})
    .catch(() => {});
}

// --------------------------
// Tabs logic
// --------------------------

function setActiveTab(tabId) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("active", isActive);
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.id === "tab-" + tabId;
    panel.classList.toggle("active", isActive);
  });
}

// --------------------------
// Orchestra game (very light mock)
// --------------------------

let orchestraJoined = false;
let orchestraMode = "idle";
let myPosition = null;
let geoWatchId = null;

const otherPlayers = [
  { id: "A", label: "Violin corner", coords: { lat: 50.112, lon: 8.675 } },
  { id: "B", label: "Horn section", coords: { lat: 50.113, lon: 8.676 } },
  { id: "C", label: "Back row", coords: { lat: 50.1115, lon: 8.6745 } },
];

function updateOrchestraMode() {
  if (!orchestraModeEl) return;
  if (!orchestraJoined) {
    orchestraModeEl.textContent = "Not joined yet – tap the button to start.";
    return;
  }
  orchestraModeEl.textContent = `Live · listening for harmonics (${orchestraMode})`;
}

function haversineDistanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function updateOrchestraDistances() {
  if (!myPosition || !distanceListEl) return;
  distanceListEl.innerHTML = "";

  const origin = { lat: myPosition.latitude, lon: myPosition.longitude };

  const items = otherPlayers.map((p) => {
    const dKm = haversineDistanceKm(origin, p.coords);
    return { ...p, distanceMeters: dKm * 1000 };
  });

  items.sort((a, b) => a.distanceMeters - b.distanceMeters);

  for (const item of items) {
    const li = document.createElement("div");
    li.className = "distance-item";
    const dist = item.distanceMeters.toFixed(1);
    li.innerHTML = `<span>${item.label}</span><span>${dist} m</span>`;
    distanceListEl.appendChild(li);
  }

  // Simple “harmonics unlocked” logic: closer average -> more instruments
  const avgDist =
    items.reduce((sum, i) => sum + i.distanceMeters, 0) /
    Math.max(1, items.length);

  const maxExtra = 3;
  const closeness = Math.max(0, 1 - avgDist / 30); // 0..1 when <=30m
  const extraCount = Math.round(closeness * maxExtra);

  const baseInstrument = assignedInstrument ? assignedInstrument.id : null;
  const extraInstruments = instrumentRoles
    .map((r) => r.id)
    .filter((id) => id !== baseInstrument);

  const unlocked = [baseInstrument, ...extraInstruments.slice(0, extraCount)].filter(Boolean);
  ownedInstruments = unlocked;

  if (ownedInstrumentsListEl) {
    ownedInstrumentsListEl.innerHTML = "";
    for (const id of unlocked) {
      const role = instrumentRoles.find((r) => r.id === id);
      if (!role) continue;
      const li = document.createElement("li");
      li.textContent = `${role.display} ${role.emoji}`;
      ownedInstrumentsListEl.appendChild(li);
    }
  }

  if (ownedInstrumentsHint) {
    if (unlocked.length > 1) {
      ownedInstrumentsHint.textContent =
        "Harmonics unlocked: try letting each of these ring in A tonight.";
    } else {
      ownedInstrumentsHint.textContent =
        "Each harmonic your friends unlock will add another instrument to your pocket orchestra.";
    }
  }
}

function joinOrchestraGame() {
  if (orchestraJoined) return;
  orchestraJoined = true;
  orchestraMode = "warming up";
  updateOrchestraMode();

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

      orchestraMode = "listening";
      updateOrchestraMode();
    },
    (err) => {
      if (myCoordsEl) myCoordsEl.textContent = "Location error: " + err.message;
      orchestraMode = "error";
      updateOrchestraMode();
    },
    { enableHighAccuracy: false, maximumAge: 2000, timeout: 8000 }
  );
}

// --------------------------
// Tuning button
// --------------------------

function handleTuneButtonClick() {
  if (!assignedInstrument) return;
  playInstrumentSample(assignedInstrument.id);
}

// --------------------------
// Mute pill logic
// --------------------------

document.addEventListener("click", (ev) => {
  if (ev.target === musicPill || musicPill?.contains(ev.target)) {
    handleMusicPillClick();
  }
});

// --------------------------
// Prelude language click wiring
// --------------------------

function initPreludeZones() {
  // Handled in DOMContentLoaded
}

// --------------------------
// Tabs wiring
// --------------------------

function initTabs() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      if (!tabId) return;
      setActiveTab(tabId);
    });
  });
}

// --------------------------
// DOMContentLoaded
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
      // Second tap: timpani + brighten + transition
      playTimpani();
      leavePreintroToPrelude(true);
    });
  }

  // Prelude EN / DE zones -> interrupt TTS then Main
  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => {
      playTimpani();
      handlePreludeLanguageClick("en");
    });
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => {
      playTimpani();
      handlePreludeLanguageClick("de");
    });
  }

  // Instrument assignment
  assignedInstrument = getAssignedInstrument();
  ownedInstruments = [assignedInstrument.id];
  ownedIndex = 0;

  if (instrumentLabelEl) {
    instrumentLabelEl.textContent = assignedInstrument.display;
  }
  if (instrumentEmojiEl) {
    instrumentEmojiEl.textContent = assignedInstrument.emoji;
  }

  // Hero caption slider
  initHeroCaptionSlider();

  // Tune button
  if (tuneButton) {
    tuneButton.addEventListener("click", handleTuneButtonClick);
  }

  // Tabs
  initTabs();

  // Orchestra game
  if (orchestraJoinBtn) {
    orchestraJoinBtn.addEventListener("click", () => {
      joinOrchestraGame();
      if (orchestraPopup) {
        orchestraPopup.classList.remove("hidden");
      }
    });
  }
  if (orchestraPopupClose) {
    orchestraPopupClose.addEventListener("click", () => {
      orchestraPopup.classList.add("hidden");
    });
  }
});
