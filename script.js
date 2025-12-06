// ===============================
// Global state & DOM references
// ===============================

let currentScene = "preintro";

const scenePreintro = document.getElementById("scene-preintro");
const scenePrelude = document.getElementById("scene-prelude");
const sceneMain = document.getElementById("scene-main");

// Pre-intro
const preintroOverlay = document.getElementById("preintroOverlay");
const preintroPopup = document.getElementById("preintroPopup");
const preintroTouchBtn = document.getElementById("preintroTouchBtn");
const preintroRipple = document.getElementById("preintroRipple");

let preintroHasStarted = false;
let preintroRippleShown = false;
let preintroIdleTimer = null;

// Prelude
const preludeVoiceStatus = document.getElementById("preludeVoiceStatus");
const preludeZoneLeft = document.querySelector(".prelude-zone-left");
const preludeZoneRight = document.querySelector(".prelude-zone-right");

let preludeAutoTimer = null;
let preludeTransitionStarted = false;

// Prelude voice / interrupt state
let preludeMaleAudio = null;
let preludeFemaleAudio = null;
let preludeInterruptAudio = null;
let preludeFadeInterval = null;
let preludeVoicesStarted = false;
let preludeInterruptFlowStarted = false;

// Main scene
const heroGlow = document.getElementById("heroGlow");
const heroCaptions = document.querySelectorAll(".hero-caption");
const heroDots = document.querySelectorAll(".hero-dot");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// Tune / instrument
const musicToggle = document.getElementById("musicToggle");
const musicLabel = document.getElementById("musicLabel");
const tuneButton = document.getElementById("tuneButton");
const tuneIcons = document.getElementById("tuneIcons");
const instrumentLabel = document.getElementById("instrumentLabel");
const ownedInstrumentsHint = document.getElementById("ownedInstrumentsHint");

// Orchestra
const orchestraJoinBtn = document.getElementById("orchestraJoinBtn");
const orchestraPopup = document.getElementById("orchestraPopup");
const orchestraPopupClose = document.getElementById("orchestraPopupClose");
const orchestraMode = document.getElementById("orchestraMode");
const myCoordsLabel = document.getElementById("myCoords");
const harmonicsStatus = document.getElementById("harmonicsStatus");

// ===============================
// Audio system
// ===============================

let activeAudios = new Set();
let muted = false;

// Background music
let bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
bgAudio.loop = true;
bgAudio.preload = "auto";
let bgStarted = false;
let bgBaseVolume = 0.3; // full background in early scenes

// Instruments & tuning
const instrumentRoles = [
  {
    id: "violins2",
    name: "Violins II",
    family: "strings",
    emoji: "🎻",
    sample: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
  },
  {
    id: "cellos",
    name: "Cellos",
    family: "strings",
    emoji: "🎻",
    sample: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
  },
  {
    id: "trumpets",
    name: "Trumpets",
    family: "brass",
    emoji: "🎺",
    sample: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",
  },
  {
    id: "timpani",
    name: "Timpani",
    family: "timpani",
    emoji: "🥁",
    sample: "media/zoid_percussion_timpani_roll_A.wav",
  },
];

let baseInstrument = null; // one of instrumentRoles
let ownedInstruments = []; // array of role objects
let ownedInstrumentIndex = 0;

// Geolocation / harmonics (prototype)
let geoWatchId = null;
let myPosition = null;
const dummyPeers = [
  {
    id: "p1",
    lat: 50.1105,
    lng: 8.6822,
    instrumentRole: "trumpets",
  },
  {
    id: "p2",
    lat: 50.1102,
    lng: 8.6824,
    instrumentRole: "cellos",
  },
];

// ===============================
// Utility: Audio registration
// ===============================

function registerAudio(audio, baseVolume = 1.0) {
  if (!audio) return;
  audio._baseVolume = baseVolume;
  activeAudios.add(audio);

  audio.addEventListener(
    "ended",
    () => {
      activeAudios.delete(audio);
    },
    { once: true }
  );

  applyMuteStateToAudio(audio);
}

function applyMuteStateToAudio(audio) {
  if (!audio) return;
  if (muted) {
    audio.volume = 0;
  } else {
    audio.volume = typeof audio._baseVolume === "number" ? audio._baseVolume : 1.0;
  }
}

function applyMuteState() {
  if (muted) {
    document.body.classList.add("muted-world");
    if (musicToggle) {
      musicToggle.classList.add("music-off");
      musicToggle.classList.remove("music-on");
    }
  } else {
    document.body.classList.remove("muted-world");
    if (musicToggle) {
      musicToggle.classList.remove("music-off");
      musicToggle.classList.add("music-on");
    }
  }

  // bg audio
  if (bgAudio) {
    if (muted) {
      bgAudio.volume = 0;
    } else {
      bgAudio.volume = bgBaseVolume;
    }
  }

  // all active audios
  activeAudios.forEach((a) => applyMuteStateToAudio(a));

  // hero glow should vanish when muted
  if (muted) {
    stopHeroGlow();
  }
}

function setBgBaseVolume(v) {
  bgBaseVolume = v;
  if (!muted && bgAudio) {
    bgAudio.volume = bgBaseVolume;
  }
}

// duck background during tuning or voices (simple version)
function duckBgDuring(ms) {
  if (!bgAudio) return;
  const prev = bgBaseVolume;
  setBgBaseVolume(0);
  setTimeout(() => {
    setBgBaseVolume(prev);
  }, ms);
}

function startBackgroundMusicFromPreintro() {
  if (bgStarted) return;
  bgStarted = true;

  try {
    bgAudio.currentTime = 0;
  } catch (e) {
    // ignore
  }

  // start from 0, fade up to 0.3 over ~6s
  bgBaseVolume = 0.0;
  applyMuteState();

  bgAudio
    .play()
    .then(() => {
      registerAudio(bgAudio, bgBaseVolume);
      const steps = 30;
      let i = 0;
      const fadeInterval = setInterval(() => {
        i++;
        const t = i / steps;
        const target = 0.3 * t;
        bgBaseVolume = target;
        if (!muted) {
          bgAudio.volume = bgBaseVolume;
        }
        if (i >= steps) {
          clearInterval(fadeInterval);
        }
      }, 200);
    })
    .catch(() => {
      // autoplay might fail – leave silently
    });
}

// Timpani one-shot for “door” moments
function playTimpani() {
  const a = new Audio("media/TS_IFD_kick_timpani_heavy.wav");
  registerAudio(a, 0.8);
  a.play().catch(() => {
    // ignore
  });
}

// ===============================
// Hero glow (Let A ring)
// ===============================

let heroGlowTimeout = null;

function startHeroGlow(color) {
  if (!heroGlow) return;

  heroGlow.style.background = `radial-gradient(circle at 50% 40%, ${color} 0%, transparent 70%)`;
  heroGlow.style.opacity = "1";

  if (heroGlowTimeout) {
    clearTimeout(heroGlowTimeout);
  }
  heroGlowTimeout = setTimeout(() => {
    stopHeroGlow();
  }, 10000);
}

function stopHeroGlow() {
  if (!heroGlow) return;
  heroGlow.style.opacity = "0";
  if (heroGlowTimeout) {
    clearTimeout(heroGlowTimeout);
    heroGlowTimeout = null;
  }
}

// ===============================
// Scene transitions
// ===============================

function showScene(id) {
  currentScene = id;
  [scenePreintro, scenePrelude, sceneMain].forEach((el) => {
    if (!el) return;
    el.classList.remove("scene-visible");
  });

  switch (id) {
    case "preintro":
      scenePreintro && scenePreintro.classList.add("scene-visible");
      break;
    case "prelude":
      scenePrelude && scenePrelude.classList.add("scene-visible");
      break;
    case "main":
      sceneMain && sceneMain.classList.add("scene-visible");
      break;
  }
}

function leavePreintroToPrelude() {
  if (preintroIdleTimer) {
    clearTimeout(preintroIdleTimer);
    preintroIdleTimer = null;
  }
  if (preintroRipple) {
    preintroRipple.classList.add("preintro-ripple-leaving");
  }
  // timpani accent for door between -1 and 0
  playTimpani();
  setTimeout(() => {
    goToPrelude();
  }, 400);
}

function goToPrelude() {
  showScene("prelude");
  preludeTransitionStarted = false;
  preludeInterruptFlowStarted = false;

  // schedule voices
  schedulePreludeVoices();

  // auto timeout after 30s
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
  }
  preludeAutoTimer = setTimeout(handlePreludeAutoTimeout, 30000);
}

function leavePreludeToMain() {
  if (preludeTransitionStarted) return;
  preludeTransitionStarted = true;

  // clear any auto timer
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  playTimpani();
  setTimeout(() => {
    goToMain();
  }, 400);
}

function goToMain() {
  showScene("main");
  // in the main scene, keep background music very subtle
  setBgBaseVolume(0.05);
}

// ===============================
// Pre-intro logic
// ===============================

function handlePreintroTap() {
  if (preintroHasStarted) return;
  preintroHasStarted = true;

  // fade overlay brightness
  if (preintroOverlay) {
    preintroOverlay.classList.remove("scene-overlay-dark");
  }

  // hide popup
  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }

  // start background music fade in
  startBackgroundMusicFromPreintro();

  // after overlay brightening, show ripple and start 7s timer
  setTimeout(() => {
    if (!preintroRipple) return;
    preintroRipple.classList.add("preintro-ripple-active");
    preintroRippleShown = true;

    preintroIdleTimer = setTimeout(() => {
      leavePreintroToPrelude();
    }, 7000);
  }, 1200);
}

// ===============================
// Prelude voices (new audio files)
// ===============================

function schedulePreludeVoices() {
  if (preludeVoicesStarted) return;
  preludeVoicesStarted = true;
  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: waiting…";
  }

  const maleDelay = 4000;
  setTimeout(() => {
    playPreludeVoices();
  }, maleDelay);
}

function playPreludeVoices() {
  preludeMaleAudio = new Audio("media/prelude_de.mp3");
  const male = preludeMaleAudio;
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male, male._baseVolume);

  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: German voice playing…";
  }

  duckBgDuring(5000);

  male.addEventListener("ended", () => {
    preludeMaleAudio = null;
    setTimeout(() => {
      preludeFemaleAudio = new Audio("media/prelude_en.mp3");
      const female = preludeFemaleAudio;
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female, female._baseVolume);

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

function getCurrentPreludeAudio() {
  if (preludeMaleAudio && !preludeMaleAudio.paused) return preludeMaleAudio;
  if (preludeFemaleAudio && !preludeFemaleAudio.paused) return preludeFemaleAudio;
  return null;
}

// fade out current prelude voice over ~1s, then call onDone
function fadeOutCurrentPreludeVoice(onDone) {
  if (preludeFadeInterval) {
    clearInterval(preludeFadeInterval);
    preludeFadeInterval = null;
  }

  const current = getCurrentPreludeAudio();
  if (!current) {
    if (typeof onDone === "function") onDone();
    return;
  }

  const steps = 10;
  let i = 0;
  const startVol =
    typeof current._baseVolume === "number" ? current._baseVolume : current.volume;

  preludeFadeInterval = setInterval(() => {
    i++;
    const t = i / steps;
    let v = startVol * (1 - t);
    if (v < startVol * 0.2 && i < steps) {
      v = startVol * 0.2;
    }
    if (i >= steps) {
      v = 0;
    }
    current.volume = muted ? 0 : Math.max(0, v);

    if (i >= steps) {
      clearInterval(preludeFadeInterval);
      preludeFadeInterval = null;
      current.pause();
      try {
        current.currentTime = 0;
      } catch (e) {
        // ignore
      }
      activeAudios.delete(current);
      if (current === preludeMaleAudio) preludeMaleAudio = null;
      if (current === preludeFemaleAudio) preludeFemaleAudio = null;

      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: softly interrupted.";
      }

      if (typeof onDone === "function") onDone();
    }
  }, 100);
}

// Interrupt: fade current voice then play EN/DE interrupt TTS
function fadeOutPreludeVoiceAndThenInterrupt(targetLang) {
  // cancel idle auto-transition
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  function startInterruptTts() {
    let src;
    if (targetLang === "en") {
      src = "media/interrupt_en.mp3";
    } else {
      src = "media/interrupt_de.mp3";
    }

    preludeInterruptAudio = new Audio(src);
    const a = preludeInterruptAudio;
    a._baseVolume = 0.9;
    a.volume = muted ? 0 : a._baseVolume;
    registerAudio(a, a._baseVolume);

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

  fadeOutCurrentPreludeVoice(startInterruptTts);
}

// Auto timeout handler for Prelude (30s)
function handlePreludeAutoTimeout() {
  preludeAutoTimer = null;
  if (preludeTransitionStarted || preludeInterruptFlowStarted) {
    return;
  }

  const current = getCurrentPreludeAudio();
  if (!current) {
    // no voice playing -> straight to main (with timpani inside leavePreludeToMain)
    leavePreludeToMain();
    return;
  }

  // fade out current voice, then transition
  fadeOutCurrentPreludeVoice(() => {
    leavePreludeToMain();
  });
}

function handlePreludeLanguageClick(lang) {
  if (preludeInterruptFlowStarted) return;
  preludeInterruptFlowStarted = true;
  fadeOutPreludeVoiceAndThenInterrupt(lang);
}

// ===============================
// Tabs & hero captions
// ===============================

let heroCaptionIndex = 0;
let heroCaptionInterval = null;

function showHeroCaption(idx) {
  heroCaptionIndex = idx;
  heroCaptions.forEach((c) =>
    c.classList.remove("hero-caption-active")
  );
  heroDots.forEach((d) =>
    d.classList.remove("hero-dot-active")
  );

  const activeCaption = Array.from(heroCaptions).find(
    (c) => Number(c.dataset.index) === idx
  );
  const activeDot = Array.from(heroDots).find(
    (d) => Number(d.dataset.index) === idx
  );

  if (activeCaption) activeCaption.classList.add("hero-caption-active");
  if (activeDot) activeDot.classList.add("hero-dot-active");
}

function startHeroCaptionRotation() {
  if (heroCaptionInterval) {
    clearInterval(heroCaptionInterval);
  }
  heroCaptionInterval = setInterval(() => {
    const nextIdx = (heroCaptionIndex + 1) % heroCaptions.length;
    showHeroCaption(nextIdx);
  }, 7000);
}

// ===============================
// Instrument assignment & Let A ring
// ===============================

function loadBaseInstrument() {
  const storedId = window.localStorage.getItem("invitationInstrumentId");
  if (storedId) {
    const role = instrumentRoles.find((r) => r.id === storedId);
    if (role) {
      baseInstrument = role;
    }
  }

  if (!baseInstrument) {
    const idx = Math.floor(Math.random() * instrumentRoles.length);
    baseInstrument = instrumentRoles[idx];
    try {
      window.localStorage.setItem("invitationInstrumentId", baseInstrument.id);
    } catch (e) {
      // ignore storage errors
    }
  }

  ownedInstruments = [baseInstrument];
  ownedInstrumentIndex = 0;

  if (instrumentLabel) {
    instrumentLabel.textContent = baseInstrument.name;
  }
  updateOwnedInstrumentsHint();
  updateTuneIcons();
}

function updateOwnedInstrumentsHint() {
  if (!ownedInstrumentsHint) return;
  if (!ownedInstruments || ownedInstruments.length <= 1) {
    ownedInstrumentsHint.textContent = "";
    return;
  }
  const names = ownedInstruments.map((r) => r.name).join(", ");
  ownedInstrumentsHint.textContent = "You currently carry: " + names;
}

function updateTuneIcons() {
  if (!tuneIcons) return;
  tuneIcons.innerHTML = "";
  ownedInstruments.forEach((role) => {
    const span = document.createElement("span");
    span.textContent = role.emoji;
    tuneIcons.appendChild(span);
  });
}

let tuningIsPlaying = false;

function addOwnedInstrumentById(id) {
  const role = instrumentRoles.find((r) => r.id === id);
  if (!role) return;
  if (ownedInstruments.some((r) => r.id === id)) return;
  ownedInstruments.push(role);
  updateOwnedInstrumentsHint();
  updateTuneIcons();
}

// Let A ring: cycle through owned instruments
function handleTuneButtonClick() {
  if (tuningIsPlaying) return;
  if (!ownedInstruments || ownedInstruments.length === 0) {
    return;
  }
  const role = ownedInstruments[ownedInstrumentIndex];
  ownedInstrumentIndex = (ownedInstrumentIndex + 1) % ownedInstruments.length;
  playTuningForRole(role);
}

function playTuningForRole(role) {
  tuningIsPlaying = true;

  const audio = new Audio(role.sample);
  let vol = role.family === "timpani" ? 1.0 : 0.7;
  audio._baseVolume = vol;
  audio.volume = muted ? 0 : vol;
  registerAudio(audio, vol);

  // hero glow color by family
  let glowColor = "rgba(251, 216, 143, 0.65)";
  if (role.family === "brass") {
    glowColor = "rgba(255, 180, 90, 0.75)";
  } else if (role.family === "timpani") {
    glowColor = "rgba(255, 90, 90, 0.65)";
  }
  startHeroGlow(glowColor);

  // duck background completely while tuning plays
  const previousBg = bgBaseVolume;
  setBgBaseVolume(0);

  audio.addEventListener("ended", () => {
    tuningIsPlaying = false;
    stopHeroGlow();
    setBgBaseVolume(previousBg);
  });

  audio.play().catch(() => {
    tuningIsPlaying = false;
    stopHeroGlow();
    setBgBaseVolume(previousBg);
  });
}

// ===============================
// Mute button
// ===============================

function toggleMute() {
  muted = !muted;
  applyMuteState();
}

// ===============================
// Orchestra Game (prototype)
// ===============================

function startOrchestraLocationTracking() {
  if (!navigator.geolocation) {
    if (harmonicsStatus) {
      harmonicsStatus.textContent = "Geolocation not supported.";
    }
    return;
  }

  if (geoWatchId !== null) {
    return;
  }

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      myPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      if (myCoordsLabel) {
        myCoordsLabel.textContent =
          myPosition.lat.toFixed(5) + ", " + myPosition.lng.toFixed(5);
      }

      // simple harmonics logic
      const rangeMeters = 5;
      const closePeers = dummyPeers.filter((p) => {
        const d = distanceMeters(myPosition.lat, myPosition.lng, p.lat, p.lng);
        return d <= rangeMeters;
      });

      if (closePeers.length === 0) {
        if (harmonicsStatus) {
          harmonicsStatus.textContent = "none yet";
        }
        if (orchestraMode) {
          orchestraMode.textContent = "Solo";
        }
        return;
      }

      if (harmonicsStatus) {
        harmonicsStatus.textContent =
          "Harmonics with " + closePeers.length + " nearby player(s).";
      }
      if (orchestraMode) {
        orchestraMode.textContent = "Ensemble";
      }

      // grant extra instruments from peers
      closePeers.forEach((p) => addOwnedInstrumentById(p.instrumentRole));
    },
    (err) => {
      if (harmonicsStatus) {
        harmonicsStatus.textContent = "Location permission denied.";
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000,
    }
  );
}

// simple distance approximation
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===============================
// DOMContentLoaded – wiring
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  // Start at preintro
  showScene("preintro");

  // Preintro button
  if (preintroTouchBtn) {
    preintroTouchBtn.addEventListener("click", handlePreintroTap);
  }

  // Preintro ripple (second tap)
  if (preintroRipple) {
    preintroRipple.addEventListener("click", () => {
      leavePreintroToPrelude();
    });
  }

  // Prelude zones
  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => {
      handlePreludeLanguageClick("en");
    });
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => {
      handlePreludeLanguageClick("de");
    });
  }

  // Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tabPanels.forEach((panel) => {
        if (panel.id === "tab-" + tab) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }
      });
    });
  });

  // Hero captions
  if (heroCaptions.length > 0) {
    showHeroCaption(0);
    startHeroCaptionRotation();
  }

  // Mute button
  if (musicToggle) {
    musicToggle.addEventListener("click", toggleMute);
  }
  applyMuteState();

  // Instrument & Let A ring
  loadBaseInstrument();
  if (tuneButton) {
    tuneButton.addEventListener("click", handleTuneButtonClick);
  }

  // Orchestra game
  if (orchestraJoinBtn) {
    orchestraJoinBtn.addEventListener("click", () => {
      if (orchestraPopup) {
        orchestraPopup.classList.remove("hidden");
      }
    });
  }

  if (orchestraPopupClose) {
    orchestraPopupClose.addEventListener("click", () => {
      if (orchestraPopup) {
        orchestraPopup.classList.add("hidden");
      }
      startOrchestraLocationTracking();
    });
  }
});
