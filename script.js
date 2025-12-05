// =========================
// Basic state & utilities
// =========================

const instrumentDefs = [
  {
    id: "violins1",
    display: "Violins I",
    emoji: "🎻",
    sample: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav"
  },
  {
    id: "violins2",
    display: "Violins II",
    emoji: "🎻",
    sample: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav"
  },
  {
    id: "cellos",
    display: "Cellos",
    emoji: "🎻",
    sample: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav"
  },
  {
    id: "trumpets",
    display: "Trumpets",
    emoji: "🎺",
    sample: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav"
  },
  {
    id: "timpani",
    display: "Timpani",
    emoji: "🥁",
    sample: "media/zoid_percussion_timpani_roll_A.wav"
  }
];

const LOCAL_STORAGE_KEY = "devPartyInstrumentRole_v1";

let myInstrument = null;
let harmonicInstruments = []; // filled when Harmonics event occurs
let cycleIndex = 0;

let muted = false;
let playingAudios = []; // {audio, baseVolume}
const TUNING_BASE_GAIN = 0.7; // 70% for non-timpani

// =========================
// DOM
// =========================

const musicToggleBtn = document.getElementById("musicToggle");
const musicTextEl = document.getElementById("musicText");
const appVisual = document.getElementById("appVisual");

const instrumentLabelEl = document.getElementById("instrumentLabel");
const instrumentMiniEl = document.getElementById("instrumentMini");
const instrumentEmojiEl = document.getElementById("instrumentEmoji");
const tuneButton = document.getElementById("tuneButton");
const tuneIcons = document.getElementById("tuneIcons");

const heroBox = document.getElementById("heroBox");
const heroGlow = document.getElementById("heroGlow");
const heroCaption = document.getElementById("heroCaption");
const heroDots = document.querySelectorAll(".hero-dot");
const heroCaptions = heroCaption
  ? heroCaption.querySelectorAll(".hero-caption-text")
  : [];

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = {
  invitation: document.getElementById("tab-invitation"),
  howto: document.getElementById("tab-howto"),
  board: document.getElementById("tab-board"),
  orchestra: document.getElementById("tab-orchestra")
};

// Orchestra game elements
const geoToggleBtn = document.getElementById("geoToggleBtn");
const radiusSlider = document.getElementById("radiusSlider");
const radiusValue = document.getElementById("radiusValue");
const coordSelfEl = document.getElementById("coordSelf");
const coordOthersEl = document.getElementById("coordOthers");
const harmonicsStatusEl = document.getElementById("harmonicsStatus");

let geoWatchId = null;
let selfCoords = null;
let testPlayers = [];
let geoIntervalId = null;

// =========================
// Instrument assignment
// =========================

function getRandomInstrument() {
  const idx = Math.floor(Math.random() * instrumentDefs.length);
  return instrumentDefs[idx];
}

function restoreOrAssignInstrument() {
  try {
    const savedId = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedId) {
      const found = instrumentDefs.find((i) => i.id === savedId);
      if (found) {
        return found;
      }
    }
  } catch (e) {
    // ignore
  }
  const chosen = getRandomInstrument();
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, chosen.id);
  } catch (e) {
    // ignore
  }
  return chosen;
}

function updateInstrumentUI() {
  if (!myInstrument) return;
  if (instrumentLabelEl) {
    instrumentLabelEl.textContent = myInstrument.display;
  }
  if (instrumentEmojiEl) {
    instrumentEmojiEl.textContent = myInstrument.emoji;
  }
  refreshTuneButtonIcons();
}

// =========================
// Mute handling (visual + audio)
// =========================

function applyMuteVisual() {
  if (!appVisual) return;
  if (muted) {
    appVisual.classList.add("muted-visual");
  } else {
    appVisual.classList.remove("muted-visual");
  }
}

function applyMuteToAudios() {
  playingAudios.forEach(({ audio, baseVolume }) => {
    if (!audio) return;
    audio.volume = muted ? 0 : baseVolume;
  });
}

function updateMusicPill() {
  if (!musicToggleBtn || !musicTextEl) return;
  if (muted) {
    musicToggleBtn.classList.add("music-muted");
    musicToggleBtn.classList.remove("music-on");
    musicTextEl.textContent = "Muted · tap to let it in";
  } else {
    musicToggleBtn.classList.remove("music-muted");
    musicToggleBtn.classList.add("music-on");
    musicTextEl.textContent = "Resonant";
  }
}

function toggleMute() {
  muted = !muted;
  applyMuteVisual();
  applyMuteToAudios();
  updateMusicPill();
}

// =========================
// Audio helpers
// =========================

function getInstrumentGain(instrumentId) {
  if (instrumentId === "timpani") {
    return 1.0; // full for timpani
  }
  return TUNING_BASE_GAIN; // 70% for others
}

function getCurrentInstrumentCycleList() {
  // myInstrument always first; then harmonics in order of acquisition
  const list = [];
  if (myInstrument) list.push(myInstrument);
  harmonicInstruments.forEach((i) => list.push(i));
  return list.length ? list : (myInstrument ? [myInstrument] : []);
}

function refreshTuneButtonIcons() {
  if (!tuneIcons) return;
  const list = getCurrentInstrumentCycleList();
  tuneIcons.innerHTML = "";
  list.forEach((inst, idx) => {
    const span = document.createElement("span");
    span.textContent = inst.emoji;
    // subtle smaller size for harmonics vs main
    if (idx > 0) {
      span.style.opacity = "0.75";
      span.style.fontSize = "14px";
    }
    tuneIcons.appendChild(span);
  });
}

function playTuningSample() {
  const list = getCurrentInstrumentCycleList();
  if (!list.length) return;

  // which instrument for this press?
  const inst = list[cycleIndex % list.length];
  cycleIndex++;

  const src = inst.sample;
  const baseVol = getInstrumentGain(inst.id);
  const actualVol = muted ? 0 : baseVol;

  if (!src) return;
  const audio = new Audio(src);
  audio.volume = actualVol;

  const entry = { audio, baseVolume: baseVol };
  playingAudios.push(entry);

  audio.addEventListener("ended", () => {
    const idx = playingAudios.indexOf(entry);
    if (idx !== -1) {
      playingAudios.splice(idx, 1);
    }
  });

  audio.play().catch((err) => {
    console.warn("Playback failed:", err);
  });

  triggerTuneButtonRipple();
  triggerHeroGlowForInstrument(inst);
}

// =========================
// Let A ring visuals
// =========================

function triggerTuneButtonRipple() {
  if (!tuneButton) return;
  tuneButton.classList.remove("ringing");
  // force reflow
  void tuneButton.offsetWidth;
  tuneButton.classList.add("ringing");
}

function triggerHeroGlowForInstrument(inst) {
  if (!heroGlow || !inst) return;

  // switch glow palette by instrument family
  let gradient = "";
  if (inst.id === "timpani") {
    gradient =
      "radial-gradient(circle at 40% 10%, rgba(255, 120, 120, 0.25), transparent 60%)," +
      "radial-gradient(circle at 80% 80%, rgba(200, 80, 80, 0.25), transparent 65%)";
  } else if (inst.id === "trumpets") {
    gradient =
      "radial-gradient(circle at 40% 10%, rgba(255, 200, 130, 0.35), transparent 60%)," +
      "radial-gradient(circle at 80% 80%, rgba(255, 160, 80, 0.25), transparent 65%)";
  } else {
    // strings etc.
    gradient =
      "radial-gradient(circle at 30% 10%, rgba(245, 230, 184, 0.3), transparent 60%)," +
      "radial-gradient(circle at 80% 80%, rgba(210, 170, 120, 0.22), transparent 65%)";
  }

  heroGlow.style.backgroundImage = gradient;

  heroGlow.classList.remove("active");
  void heroGlow.offsetWidth;
  heroGlow.classList.add("active");
}

// =========================
// Hero caption rotation
// =========================

let heroIndex = 0;
let heroTimer = null;

function setHeroCaption(idx) {
  heroIndex = idx;
  if (!heroCaptions.length) return;
  heroCaptions.forEach((cap, i) => {
    if (i === idx) {
      cap.classList.remove("hidden");
    } else {
      cap.classList.add("hidden");
    }
  });
  heroDots.forEach((dot, i) => {
    if (i === idx) dot.classList.add("active");
    else dot.classList.remove("active");
  });
}

function startHeroAutoRotation() {
  if (!heroCaptions.length) return;
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroCaptions.length;
    setHeroCaption(heroIndex);
  }, 7000);
}

// =========================
// Tabs
// =========================

function initTabs() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabKey = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.keys(tabPanels).forEach((key) => {
        const panel = tabPanels[key];
        if (!panel) return;
        if (key === tabKey) panel.classList.add("active");
        else panel.classList.remove("active");
      });
    });
  });
}

// =========================
// Orchestra game (dev rig)
// =========================

function formatCoords(coords) {
  if (!coords) return "–";
  const { latitude, longitude } = coords;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function generateTestPlayersAroundSelf(center, count = 20) {
  if (!center) return [];
  const result = [];
  for (let i = 0; i < count; i++) {
    // random offset within ~10 m
    const maxMeters = 10;
    const dx = (Math.random() * 2 - 1) * maxMeters;
    const dy = (Math.random() * 2 - 1) * maxMeters;
    // rough conversion: ~111,111 m per degree lat, lon scaled by cos(lat)
    const latOffset = dx / 111111;
    const lonOffset =
      dy / (111111 * Math.cos((center.latitude * Math.PI) / 180 || 1));
    result.push({
      latitude: center.latitude + latOffset,
      longitude: center.longitude + lonOffset
    });
  }
  return result;
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000; // earth radius
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return R * d;
}

function updateGameStatus() {
  if (coordSelfEl) {
    coordSelfEl.textContent = formatCoords(selfCoords);
  }
  if (coordOthersEl) {
    if (!testPlayers || !testPlayers.length) {
      coordOthersEl.textContent = "–";
    } else {
      coordOthersEl.textContent = `${testPlayers.length} simulated players`;
    }
  }
}

function checkHarmonics() {
  if (!selfCoords || !testPlayers.length) return;
  const radius = parseFloat(radiusSlider.value || "5");
  let minDist = Infinity;
  let closestIndex = -1;

  testPlayers.forEach((p, idx) => {
    const d = distanceMeters(selfCoords, p);
    if (d < radius && d < minDist) {
      minDist = d;
      closestIndex = idx;
    }
  });

  if (closestIndex === -1) {
    if (harmonicsStatusEl) {
      harmonicsStatusEl.textContent = "Waiting · no match yet";
    }
    return;
  }

  // For now: whenever we get inside radius, attach a random new instrument
  // (different from myInstrument and not already added)
  const candidates = instrumentDefs.filter((inst) => {
    if (!myInstrument) return true;
    if (inst.id === myInstrument.id) return false;
    const already = harmonicInstruments.some((h) => h.id === inst.id);
    return !already;
  });

  if (!candidates.length) {
    if (harmonicsStatusEl) {
      harmonicsStatusEl.textContent = "Harmonics full · all sections attached";
    }
    return;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  harmonicInstruments.push(chosen);
  refreshTuneButtonIcons();

  if (harmonicsStatusEl) {
    harmonicsStatusEl.textContent = `Harmonics · attached: ${chosen.display}`;
  }
}

function startGeoGame() {
  if (!navigator.geolocation) {
    if (harmonicsStatusEl) {
      harmonicsStatusEl.textContent = "Geolocation not supported in this browser.";
    }
    return;
  }

  if (geoWatchId !== null) return; // already running

  // Friendly UI text
  if (geoToggleBtn) {
    geoToggleBtn.textContent = "Listening to the square";
  }

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      selfCoords = pos.coords;
      // refresh simulated players around self
      testPlayers = generateTestPlayersAroundSelf(selfCoords, 20);
      updateGameStatus();
      checkHarmonics();
    },
    (err) => {
      console.warn("Geolocation error:", err);
      if (harmonicsStatusEl) {
        harmonicsStatusEl.textContent = "Location denied · this stays imaginary for now.";
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000
    }
  );

  // Additionally poll every 3s to re-check distances & UI
  geoIntervalId = window.setInterval(() => {
    updateGameStatus();
    checkHarmonics();
  }, 3000);
}

function stopGeoGame() {
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
  if (geoIntervalId !== null) {
    window.clearInterval(geoIntervalId);
    geoIntervalId = null;
  }
  if (geoToggleBtn) {
    geoToggleBtn.textContent = "Join the square quietly";
  }
}

// =========================
// Init
// =========================

function init() {
  // Instrument
  myInstrument = restoreOrAssignInstrument();
  updateInstrumentUI();

  // Hero rotation
  setHeroCaption(0);
  startHeroAutoRotation();

  // Tabs
  initTabs();

  // Mute pill
  if (musicToggleBtn) {
    musicToggleBtn.addEventListener("click", toggleMute);
  }
  updateMusicPill();
  applyMuteVisual();

  // Let A ring
  if (tuneButton) {
    tuneButton.addEventListener("click", playTuningSample);
  }

  // Hero dots click (optional)
  heroDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = parseInt(dot.getAttribute("data-hero-index") || "0", 10);
      setHeroCaption(idx);
      if (heroTimer) {
        clearInterval(heroTimer);
        startHeroAutoRotation();
      }
    });
  });

  // Orchestra game
  if (radiusSlider && radiusValue) {
    radiusValue.textContent = `${parseFloat(radiusSlider.value).toFixed(1)} m`;
    radiusSlider.addEventListener("input", () => {
      radiusValue.textContent = `${parseFloat(radiusSlider.value).toFixed(1)} m`;
      checkHarmonics();
    });
  }

  if (geoToggleBtn) {
    geoToggleBtn.addEventListener("click", () => {
      if (geoWatchId === null) {
        startGeoGame();
      } else {
        stopGeoGame();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);