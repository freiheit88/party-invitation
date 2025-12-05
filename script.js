// Global state
let currentScene = -1;
let bgAudio = null;
let bgTargetVolume = 0.05;
let bgMuted = false;
let bgFadeInterval = null;

// Audio file paths (must exist in /media, but failures are handled gracefully)
const BG_MUSIC_SRC = "media/Serenade For Strings Op.48_2nd movt.wav";
const TUNING_SAMPLES = [
  {
    src: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
    label: "Cellos · imaginative",
    role: "Cellos",
    icon: "🎻"
  },
  {
    src: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",
    label: "Trumpets · growing",
    role: "Trumpets",
    icon: "🎺"
  },
  {
    src: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
    label: "Violins · blooming",
    role: "Violins II",
    icon: "🎻"
  },
  {
    src: "media/zoid_percussion_timpani_roll_A.wav",
    label: "Timpani roll · A",
    role: "Timpani",
    icon: "🥁"
  }
];

const TIMPANI_FX_SRC = "media/TS_IFD_kick_timpani_heavy.wav";

// Voice sequence files (optional, handled gracefully if missing)
const VOICE_DE_SRC = "media/prelude_voice_de_male.wav";
const VOICE_EN_SRC = "media/prelude_voice_en_female.wav";

let preludeVoiceDe = null;
let preludeVoiceEn = null;

// Elements
const scenes = {
  "-1": document.getElementById("scene--1"),
  "0": document.getElementById("scene0"),
  "1": document.getElementById("scene1")
};

const preintroVideo = document.getElementById("preintroVideo");
const preintroOverlay = document.getElementById("preintroOverlay");
const preintroStartBtn = document.getElementById("preintroStartBtn");
const preintroPopup = document.getElementById("preintroPopup");

const preludeVideo = document.getElementById("preludeVideo");
const playVoicesBtn = document.getElementById("playVoicesBtn");
const voiceStatusEl = document.getElementById("voiceStatus");
const toMainBtn = document.getElementById("toMainBtn");

const muteToggleBtn = document.getElementById("muteToggle");
const muteLabelEl = document.getElementById("muteLabel");

const heroBox = document.getElementById("heroBox");
const heroGlowOverlay = document.getElementById("heroGlowOverlay");
const heroCaptions = document.querySelectorAll(".hero-caption");
const heroDots = document.querySelectorAll(".dot");

const instrumentNameEl = document.getElementById("instrumentName");
const instrumentIconEl = document.getElementById("instrumentIcon");
const tuneButton = document.getElementById("tuneButton");
const tuneSubLabel = document.getElementById("tuneSubLabel");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = {
  invitation: document.getElementById("tab-invitation"),
  howto: document.getElementById("tab-howto"),
  board: document.getElementById("tab-board"),
  orchestra: document.getElementById("tab-orchestra")
};

// Orchestra game elements
const joinGameBtn = document.getElementById("joinGameBtn");
const radiusSlider = document.getElementById("radiusSlider");
const radiusValue = document.getElementById("radiusValue");
const latValue = document.getElementById("latValue");
const lngValue = document.getElementById("lngValue");
const accValue = document.getElementById("accValue");
const playersList = document.getElementById("playersList");

let heroSlideIndex = 0;
let heroTimer = null;

let assignedInstrument = null;

// Orchestra game state
let geoWatchId = null;
let lastPosition = null;
let testPlayers = [];

// Utility: Safe audio loader
function createAudio(src, loop = false) {
  const audio = new Audio();
  audio.src = src;
  audio.loop = loop;
  audio.preload = "auto";
  audio.addEventListener("error", () => {
    console.warn("Audio failed to load:", src);
  });
  return audio;
}

// Background music
function ensureBgAudio() {
  if (!bgAudio) {
    bgAudio = createAudio(BG_MUSIC_SRC, true);
    bgAudio.volume = 0;
  }
}

function setBgTargetVolume(volume) {
  bgTargetVolume = Math.max(0, Math.min(1, volume));
  applyBgFade();
}

function applyBgFade() {
  ensureBgAudio();
  if (!bgAudio) return;

  if (bgFadeInterval) {
    clearInterval(bgFadeInterval);
  }

  const stepMs = 120;
  bgFadeInterval = setInterval(() => {
    if (!bgAudio) {
      clearInterval(bgFadeInterval);
      return;
    }
    const current = bgAudio.volume;
    const target = bgMuted ? 0 : bgTargetVolume;
    const diff = target - current;
    const step = 0.02;

    if (Math.abs(diff) <= step) {
      bgAudio.volume = target;
      clearInterval(bgFadeInterval);
      return;
    }
    bgAudio.volume = current + Math.sign(diff) * step;
  }, stepMs);
}

function startBgMusicIfNeeded() {
  ensureBgAudio();
  if (!bgAudio) return;
  if (bgAudio.paused) {
    bgAudio
      .play()
      .then(() => {
        setBgTargetVolume(0.05);
      })
      .catch((err) => {
        console.warn("Background music autoplay blocked:", err);
      });
  }
}

// Scene transitions
function setScene(target) {
  const targetKey = String(target);
  Object.keys(scenes).forEach((key) => {
    const el = scenes[key];
    if (!el) return;
    if (key === targetKey) {
      el.classList.add("scene--active");
    } else {
      el.classList.remove("scene--active");
    }
  });
  currentScene = target;
}

// Pre-intro interactions
function handlePreintroStart() {
  if (preintroPopup) {
    preintroPopup.style.opacity = "0";
    preintroPopup.style.transform = "translate(-50%, -60%)";
    setTimeout(() => {
      if (preintroPopup) preintroPopup.style.display = "none";
    }, 400);
  }

  // Play timpani FX (non-blocking)
  const timp = createAudio(TIMPANI_FX_SRC, false);
  timp.volume = 0.8;
  timp.play().catch(() => {});

  // Start background music fade-in
  startBgMusicIfNeeded();
  setBgTargetVolume(0.3);

  // After a short delay, move to scene 0
  setTimeout(() => setScene(0), 1200);
}

// Prelude voices
function initPreludeVoices() {
  preludeVoiceDe = createAudio(VOICE_DE_SRC, false);
  preludeVoiceEn = createAudio(VOICE_EN_SRC, false);
}

function playPreludeVoices() {
  if (!preludeVoiceDe || !preludeVoiceEn) {
    initPreludeVoices();
  }
  if (!preludeVoiceDe || !preludeVoiceEn) {
    if (voiceStatusEl) {
      voiceStatusEl.textContent = "Voices: audio files missing.";
    }
    return;
  }

  if (voiceStatusEl) {
    voiceStatusEl.textContent = "Voices: playing German…";
  }

  preludeVoiceDe.currentTime = 0;
  preludeVoiceEn.currentTime = 0;

  preludeVoiceDe
    .play()
    .then(() => {
      preludeVoiceDe.onended = () => {
        if (voiceStatusEl) {
          voiceStatusEl.textContent = "Voices: playing English…";
        }
        preludeVoiceEn
          .play()
          .then(() => {
            preludeVoiceEn.onended = () => {
              if (voiceStatusEl) {
                voiceStatusEl.textContent = "Voices: finished – the room is listening.";
              }
            };
          })
          .catch(() => {
            if (voiceStatusEl) {
              voiceStatusEl.textContent = "Voices: English file could not play.";
            }
          });
      };
    })
    .catch(() => {
      if (voiceStatusEl) {
        voiceStatusEl.textContent = "Voices: German file could not play.";
      }
    });
}

// Mute pill
function updateMuteUI() {
  if (!muteToggleBtn || !muteLabelEl) return;
  if (bgMuted) {
    muteToggleBtn.classList.add("pill-muted");
    muteLabelEl.textContent = "Muted · tap to let it in";
  } else {
    muteToggleBtn.classList.remove("pill-muted");
    muteLabelEl.textContent = "Resonant";
  }
}

function toggleMute() {
  bgMuted = !bgMuted;
  updateMuteUI();
  applyBgFade();
}

// Hero slider
function setHeroSlide(index) {
  heroSlideIndex = index;
  heroCaptions.forEach((cap) => {
    const idx = Number(cap.getAttribute("data-index") || "0");
    cap.classList.toggle("hero-caption-active", idx === index);
  });
  heroDots.forEach((dot) => {
    const idx = Number(dot.getAttribute("data-index") || "0");
    dot.classList.toggle("dot-active", idx === index);
  });
}

function startHeroAutoRotate() {
  if (heroTimer) {
    clearInterval(heroTimer);
  }
  heroTimer = setInterval(() => {
    const next = (heroSlideIndex + 1) % heroCaptions.length;
    setHeroSlide(next);
  }, 7000);
}

// Instrument assignment
const instrumentPool = TUNING_SAMPLES.map((s) => ({
  role: s.role,
  icon: s.icon
}));

function assignInstrument() {
  const key = "partyInstrumentRole_v2";
  const stored = window.localStorage.getItem(key);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      assignedInstrument = parsed;
    } catch {
      // ignore
    }
  }

  if (!assignedInstrument) {
    const pick = instrumentPool[Math.floor(Math.random() * instrumentPool.length)];
    assignedInstrument = pick;
    try {
      window.localStorage.setItem(key, JSON.stringify(pick));
    } catch {
      // ignore storage failure
    }
  }

  if (instrumentNameEl && instrumentIconEl && assignedInstrument) {
    instrumentNameEl.textContent = assignedInstrument.role;
    instrumentIconEl.textContent = assignedInstrument.icon;
  }
}

// Let A ring
function playRandomTuningSample() {
  const idx = Math.floor(Math.random() * TUNING_SAMPLES.length);
  const sampleMeta = TUNING_SAMPLES[idx];
  const audio = createAudio(sampleMeta.src, false);

  // Duck background
  const previousTarget = bgTargetVolume;
  setBgTargetVolume(0);

  // Hero glow
  if (heroBox) {
    heroBox.classList.add("hero-glow--active");
  }

  if (tuneSubLabel) {
    tuneSubLabel.textContent = sampleMeta.label;
  }

  audio.volume = bgMuted ? 0 : 0.7;

  audio
    .play()
    .then(() => {
      audio.onended = () => {
        // Restore background
        setBgTargetVolume(previousTarget);
        if (heroBox) {
          heroBox.classList.remove("hero-glow--active");
        }
        if (tuneSubLabel) {
          tuneSubLabel.textContent = "Tap once · short note";
        }
      };
    })
    .catch(() => {
      console.warn("Tuning sample failed to play:", sampleMeta.src);
      // Restore immediately
      setBgTargetVolume(previousTarget);
      if (heroBox) {
        heroBox.classList.remove("hero-glow--active");
      }
      if (tuneSubLabel) {
        tuneSubLabel.textContent = "Tap once · short note";
      }
    });
}

// Tabs
function setTab(tabKey) {
  tabButtons.forEach((btn) => {
    const key = btn.getAttribute("data-tab");
    btn.classList.toggle("tab-btn-active", key === tabKey);
  });

  Object.keys(tabPanels).forEach((key) => {
    const panel = tabPanels[key];
    if (!panel) return;
    panel.classList.toggle("tab-panel-active", key === tabKey);
  });
}

// Orchestra game logic
function updateRadiusLabel() {
  if (!radiusSlider || !radiusValue) return;
  radiusValue.textContent = `${Number(radiusSlider.value).toFixed(1)} m`;
}

function createTestPlayers(origin) {
  testPlayers = [];
  if (!origin) return;

  for (let i = 0; i < 5; i++) {
    const dLat = ((Math.random() - 0.5) * 0.00005); // roughly ±5m
    const dLng = ((Math.random() - 0.5) * 0.00005);
    testPlayers.push({
      id: i + 1,
      lat: origin.latitude + dLat,
      lng: origin.longitude + dLng
    });
  }
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in m
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderPlayers(origin) {
  if (!playersList) return;
  playersList.innerHTML = "";
  if (!origin || testPlayers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Waiting for a first fixed point on the square…";
    playersList.appendChild(li);
    return;
  }

  const radius = Number(radiusSlider ? radiusSlider.value : 3);
  let anyHarmonics = false;

  testPlayers.forEach((p) => {
    const d = haversineDistanceMeters(origin.latitude, origin.longitude, p.lat, p.lng);
    const li = document.createElement("li");
    const rounded = d.toFixed(1);
    if (d <= radius) {
      li.textContent = `Player #${p.id} · ${rounded} m · Harmonics!`;
      li.style.color = "#fbd88f";
      anyHarmonics = true;
    } else {
      li.textContent = `Player #${p.id} · ${rounded} m`;
    }
    playersList.appendChild(li);
  });

  if (!anyHarmonics) {
    const li = document.createElement("li");
    li.textContent = "No Harmonics yet – try walking a few steps.";
    li.style.opacity = "0.7";
    playersList.appendChild(li);
  }
}

function handleGeoSuccess(position) {
  lastPosition = position.coords;

  if (latValue && lngValue && accValue) {
    latValue.textContent = position.coords.latitude.toFixed(6);
    lngValue.textContent = position.coords.longitude.toFixed(6);
    if (position.coords.accuracy != null) {
      accValue.textContent = `${position.coords.accuracy.toFixed(1)} m`;
    } else {
      accValue.textContent = "-";
    }
  }

  if (testPlayers.length === 0) {
    createTestPlayers(position.coords);
  } else {
    // Slightly drift test players
    testPlayers.forEach((p) => {
      p.lat += (Math.random() - 0.5) * 0.00001;
      p.lng += (Math.random() - 0.5) * 0.00001;
    });
  }

  renderPlayers(position.coords);
}

function handleGeoError(error) {
  console.warn("Geolocation error:", error);
  if (latValue) latValue.textContent = "error";
  if (lngValue) lngValue.textContent = "error";
  if (accValue) accValue.textContent = "-";
  if (playersList) {
    playersList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "Location unavailable – browser denied access or no signal.";
    playersList.appendChild(li);
  }
}

function startGeoTracking() {
  if (!("geolocation" in navigator)) {
    handleGeoError(new Error("Geolocation not supported"));
    return;
  }

  if (geoWatchId != null) {
    // already running
    return;
  }

  geoWatchId = navigator.geolocation.watchPosition(handleGeoSuccess, handleGeoError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 10000
  });
}

// Init everything
function init() {
  // Start at scene -1
  setScene(-1);

  // Events
  if (preintroOverlay) {
    preintroOverlay.addEventListener("click", handlePreintroStart);
  }
  if (preintroStartBtn) {
    preintroStartBtn.addEventListener("click", handlePreintroStart);
  }

  if (playVoicesBtn) {
    playVoicesBtn.addEventListener("click", () => {
      playPreludeVoices();
    });
  }

  if (toMainBtn) {
    toMainBtn.addEventListener("click", () => {
      // soft fade volumes between scenes
      setBgTargetVolume(0.05);
      setScene(1);
    });
  }

  if (muteToggleBtn) {
    muteToggleBtn.addEventListener("click", toggleMute);
  }

  if (tuneButton) {
    tuneButton.addEventListener("click", () => {
      playRandomTuningSample();
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-tab");
      if (key) {
        setTab(key);
      }
    });
  });

  heroDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = Number(dot.getAttribute("data-index") || "0");
      setHeroSlide(idx);
    });
  });

  if (radiusSlider) {
    radiusSlider.addEventListener("input", updateRadiusLabel);
    updateRadiusLabel();
  }

  if (joinGameBtn) {
    joinGameBtn.addEventListener("click", () => {
      startGeoTracking();
    });
  }

  // Assign instrument & start hero rotation
  assignInstrument();
  setHeroSlide(0);
  startHeroAutoRotate();

  // Init audio but do not force autoplay (browsers might block)
  ensureBgAudio();
  updateMuteUI();
}

document.addEventListener("DOMContentLoaded", init);
