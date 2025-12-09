// --------------------------
// Basic scene handling
// --------------------------

let currentSceneId = "scene-preintro";

function showScene(id) {
  const scenes = document.querySelectorAll(".scene");
  scenes.forEach((scene) => {
    if (scene.id === id) {
      scene.classList.add("scene-visible");
    } else {
      scene.classList.remove("scene-visible");
    }
  });
  currentSceneId = id;
}

// --------------------------
// Audio: global background + tuning + timpani
// --------------------------

let audioContext;
let bgAudio;
let bgSource;
let bgGain;
let tuningGain;
let sfxGain;
let muted = false;
const activeAudios = new Set();

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    bgGain = audioContext.createGain();
    tuningGain = audioContext.createGain();
    sfxGain = audioContext.createGain();

    bgGain.gain.value = 0.0;
    tuningGain.gain.value = 1.0;
    sfxGain.gain.value = 1.0;

    bgGain.connect(audioContext.destination);
    tuningGain.connect(audioContext.destination);
    sfxGain.connect(audioContext.destination);
  }
}

function registerAudio(el, type) {
  if (!el) return;
  activeAudios.add(el);
  applyMuteStateToElement(el, type);
}

function applyMuteStateToElement(el, type) {
  if (!el) return;
  if (type === "bg") {
    el.muted = muted;
    if (bgGain) {
      bgGain.gain.value = muted ? 0 : bgGain.gain.value;
    }
  } else {
    el.muted = muted;
  }
}

function applyMuteState() {
  activeAudios.forEach((el) => {
    if (!el) return;
    el.muted = muted;
  });
  if (bgGain) {
    bgGain.gain.value = muted ? 0 : bgGain.gain.value;
  }
}

function startBackgroundMusicFromPreintro() {
  ensureAudioContext();
  if (bgAudio) return;

  bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
  bgAudio.loop = true;
  const source = audioContext.createMediaElementSource(bgAudio);
  source.connect(bgGain);
  bgSource = source;

  registerAudio(bgAudio, "bg");

  bgAudio
    .play()
    .then(() => {
      let current = 0.0;
      const target = muted ? 0 : 0.3;
      const step = 0.01;
      const interval = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        bgGain.gain.value = muted ? 0 : current;
      }, 100);
    })
    .catch(() => {});
}

function duckBackgroundForTuning(durMs) {
  if (!bgGain) return;
  const original = 0.05;
  bgGain.gain.value = muted ? 0 : 0.0;
  setTimeout(() => {
    bgGain.gain.value = muted ? 0 : original;
  }, durMs);
}

function playTuningSample(src, isTimpani = false) {
  ensureAudioContext();
  const audio = new Audio(src);
  const srcNode = audioContext.createMediaElementSource(audio);
  srcNode.connect(isTimpani ? sfxGain : tuningGain);
  registerAudio(audio, isTimpani ? "sfx" : "tuning");

  const vol = isTimpani ? 1.0 : 0.7;
  if (isTimpani) {
    sfxGain.gain.value = muted ? 0 : vol;
  } else {
    tuningGain.gain.value = muted ? 0 : vol;
  }

  audio.play().catch(() => {});
  if (!isTimpani) {
    duckBackgroundForTuning((audio.duration || 2.5) * 1000);
  }
}

function playTimpani() {
  playTuningSample("media/TS_IFD_kick_timpani_heavy.wav", true);
}

// --------------------------
// Pre-intro interactions
// --------------------------

let preintroHasTapped = false;
let preintroIdleTimer = null;
let preintroOverlay;
let preintroPopup;
let preintroTouchBtn;
let preintroRipple;

function handlePreintroTap() {
  if (preintroHasTapped) return;
  preintroHasTapped = true;

  // physical timpani feedback on first touch
  playTimpani();

  // keep overlay dark for now, just hide the button UI
  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }

  if (preintroTouchBtn) {
    preintroTouchBtn.disabled = true;
  }

  startBackgroundMusicFromPreintro();

  // After a short pause, reveal the central halo and start 7s idle timer
  const rippleDelay = 900;
  setTimeout(() => {
    if (!preintroRipple) return;
    preintroRipple.classList.add("preintro-ripple-active");

    preintroIdleTimer = setTimeout(() => {
      leavePreintroToPrelude();
    }, 7000);
  }, rippleDelay);
}

function leavePreintroToPrelude() {
  if (preintroIdleTimer) {
    clearTimeout(preintroIdleTimer);
    preintroIdleTimer = null;
  }
  if (preintroRipple) {
    preintroRipple.classList.remove("preintro-ripple-active");
  }
  playTimpani();

  setTimeout(() => {
    goToPrelude();
  }, 400);
}

function goToPrelude() {
  showScene("scene-prelude");
  playTimpani();
  schedulePreludeVoices();
}

// --------------------------
// Prelude voices & language zones
// --------------------------

let preludeMaleAudio;
let preludeFemaleAudio;
let preludeInterrupted = false;
let preludeFadeInterval = null;
let preludeAutoTimer = null;
let preludeLanguageChoice = null;

let preludeZoneLeft;
let preludeZoneRight;
let preludeVoiceStatus;

function schedulePreludeVoices() {
  preludeInterrupted = false;

  if (preludeMaleAudio) {
    preludeMaleAudio.pause();
    preludeMaleAudio = null;
  }
  if (preludeFemaleAudio) {
    preludeFemaleAudio.pause();
    preludeFemaleAudio = null;
  }

  const male = new Audio("media/prelude_voice_de_male.wav");
  const female = new Audio("media/prelude_voice_en_female.wav");

  preludeMaleAudio = male;
  preludeFemaleAudio = female;

  registerAudio(male, "voice");
  registerAudio(female, "voice");

  setTimeout(() => {
    if (preludeInterrupted) return;
    male.play().catch(() => {});
  }, 4000);

  male.onended = () => {
    if (preludeInterrupted) return;
    setTimeout(() => {
      if (preludeInterrupted) return;
      female.play().catch(() => {});
    }, 500);
  };

  female.onended = () => {};
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
      src = "media/prelude_interrupt_en.wav";
    } else {
      src = "media/prelude_interrupt_de.wav";
    }

    const interruptAudio = new Audio(src);
    registerAudio(interruptAudio, "voice");

    interruptAudio.play().catch(() => {});
    interruptAudio.onended = () => {
      playTimpani();
      goToMain();
    };
  }

  if (!current) {
    startInterruptTts();
    return;
  }

  preludeInterrupted = true;
  let vol = 1.0;
  current.volume = vol;

  preludeFadeInterval = setInterval(() => {
    vol -= 0.1;
    if (vol <= 0.0) {
      vol = 0.0;
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

function handlePreludeLanguageClick(targetLang) {
  preludeLanguageChoice = targetLang;
  fadeOutPreludeVoiceAndThenInterrupt(targetLang);
}

function goToMain() {
  showScene("scene-main");
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }
  if (preludeMaleAudio) {
    preludeMaleAudio.pause();
  }
  if (preludeFemaleAudio) {
    preludeFemaleAudio.pause();
  }
}

// --------------------------
// Hero caption slider
// --------------------------

const heroCaptions = [
  {
    text:
      "Alte Oper at night: traffic circling like a soft canon, footsteps as percussion, a quiet square waiting for its cue.",
  },
  {
    text:
      "Saturday, 14 June 2025 · 19:30 · Start at Alte Oper, Frankfurt. The final location reveals itself only when you stand on the square.",
  },
];

let heroCaptionIndex = 0;
let heroCaptionTimer = null;

function startHeroCaptionSlider() {
  const textEl = document.getElementById("heroCaptionText");
  const dotsEl = document.getElementById("heroCaptionDots");
  if (!textEl || !dotsEl) return;

  function render() {
    const current = heroCaptions[heroCaptionIndex];
    textEl.textContent = current.text;
    dotsEl.textContent = heroCaptions
      .map((_, i) => (i === heroCaptionIndex ? "●" : "○"))
      .join(" ");
  }

  render();

  if (heroCaptionTimer) clearInterval(heroCaptionTimer);
  heroCaptionTimer = setInterval(() => {
    heroCaptionIndex = (heroCaptionIndex + 1) % heroCaptions.length;
    render();
  }, 7000);
}

// --------------------------
// Instrument assignment & Let A ring
// --------------------------

const INSTRUMENTS = [
  { role: "Violins II", emoji: "🎻", sample: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav" },
  { role: "Cellos", emoji: "🎻", sample: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav" },
  { role: "Trumpets", emoji: "🎺", sample: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav" },
  { role: "Timpani", emoji: "🥁", sample: "media/zoid_percussion_timpani_roll_A.wav" },
];

let userInstrument = null;

function loadOrAssignInstrument() {
  const stored = window.localStorage.getItem("invitationInstrument");
  if (stored) {
    try {
      userInstrument = JSON.parse(stored);
    } catch {
      userInstrument = null;
    }
  }
  if (!userInstrument) {
    const chosen = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];
    userInstrument = chosen;
    window.localStorage.setItem("invitationInstrument", JSON.stringify(chosen));
  }

  const roleEl = document.getElementById("instrumentRole");
  const emojiEl = document.getElementById("aButtonEmoji");
  if (roleEl && userInstrument) {
    roleEl.textContent = userInstrument.role;
  }
  if (emojiEl && userInstrument) {
    emojiEl.textContent = userInstrument.emoji;
  }
}

// Glow logic

let heroGlowLayer;
let heroGlowTimeout = null;

function triggerHeroGlowForInstrument(instr) {
  if (!heroGlowLayer) return;
  heroGlowLayer.classList.remove("hero-glow-visible");
  void heroGlowLayer.offsetWidth;

  if (instr.role === "Timpani") {
    heroGlowLayer.style.background =
      "radial-gradient(circle at center, rgba(230, 120, 120, 0.5), transparent 68%)";
  } else if (instr.role === "Trumpets") {
    heroGlowLayer.style.background =
      "radial-gradient(circle at center, rgba(255, 180, 90, 0.5), transparent 68%)";
  } else {
    heroGlowLayer.style.background =
      "radial-gradient(circle at center, rgba(250, 210, 140, 0.5), transparent 68%)";
  }

  heroGlowLayer.classList.add("hero-glow-visible");

  if (heroGlowTimeout) clearTimeout(heroGlowTimeout);
  heroGlowTimeout = setTimeout(() => {
    heroGlowLayer.classList.remove("hero-glow-visible");
  }, 11000);
}

function handleLetARing() {
  if (!userInstrument) return;
  triggerHeroGlowForInstrument(userInstrument);
  const isTimpani = userInstrument.role === "Timpani";
  playTuningSample(userInstrument.sample, isTimpani);
}

// --------------------------
// Mute toggle
// --------------------------

let musicToggleBtn;
let musicLabelEl;

function updateMusicToggleVisual() {
  if (!musicToggleBtn) return;
  if (muted) {
    musicToggleBtn.classList.remove("music-pill-unmuted");
    musicToggleBtn.classList.add("music-pill-muted");
    document.body.classList.add("muted-world");
  } else {
    musicToggleBtn.classList.remove("music-pill-muted");
    musicToggleBtn.classList.add("music-pill-unmuted");
    document.body.classList.remove("muted-world");
  }
}

function toggleMute() {
  muted = !muted;
  applyMuteState();
  updateMusicToggleVisual();
}

// --------------------------
// Tabs
// --------------------------

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  function showTab(name) {
    buttons.forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === name;
      btn.classList.toggle("tab-button-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const id = panel.id;
      const belongs =
        (name === "invitation" && id === "tab-panel-invitation") ||
        (name === "how" && id === "tab-panel-how") ||
        (name === "board" && id === "tab-panel-board") ||
        (name === "orchestra" && id === "tab-panel-orchestra");
      panel.classList.toggle("tab-panel-active", belongs);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-tab");
      if (!name) return;
      showTab(name);
    });
  });

  showTab("invitation");
}

// --------------------------
// Orchestra Game (prototype)
// --------------------------

let locationEnableBtn;
let locationReadout;
let watchId = null;

function startLocationWatch() {
  if (!navigator.geolocation) {
    if (locationReadout) {
      locationReadout.textContent = "Geolocation is not available in this browser.";
    }
    return;
  }

  if (locationReadout) {
    locationReadout.textContent =
      "Listening for your position… this stays only on your device.";
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (locationReadout) {
        locationReadout.textContent = `You: ${latitude.toFixed(
          5
        )}, ${longitude.toFixed(5)} (±${accuracy.toFixed(1)} m)`;
      }
    },
    (err) => {
      if (locationReadout) {
        locationReadout.textContent = `Location error: ${err.message}`;
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    }
  );
}

function handleLocationEnable() {
  startLocationWatch();
}

// --------------------------
// Init
// --------------------------

document.addEventListener("DOMContentLoaded", () => {
  preintroOverlay = document.getElementById("preintroOverlay");
  preintroPopup = document.getElementById("preintroPopup");
  preintroTouchBtn = document.getElementById("preintroTouchBtn");
  preintroRipple = document.getElementById("preintroRipple");

  if (preintroTouchBtn) {
    preintroTouchBtn.addEventListener("click", handlePreintroTap);
  }
  if (preintroRipple) {
    preintroRipple.addEventListener("click", () => {
      if (preintroIdleTimer) {
        clearTimeout(preintroIdleTimer);
        preintroIdleTimer = null;
      }
      leavePreintroToPrelude();
    });
  }

  heroGlowLayer = document.getElementById("heroGlowLayer");
  musicToggleBtn = document.getElementById("musicToggle");
  musicLabelEl = document.getElementById("musicLabel");
  preludeZoneLeft = document.getElementById("preludeZoneLeft");
  preludeZoneRight = document.getElementById("preludeZoneRight");
  preludeVoiceStatus = document.getElementById("preludeVoiceStatus");
  locationEnableBtn = document.getElementById("locationEnableBtn");
  locationReadout = document.getElementById("locationReadout");

  if (musicToggleBtn) {
    musicToggleBtn.addEventListener("click", toggleMute);
    updateMusicToggleVisual();
  }

  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => handlePreludeLanguageClick("en"));
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => handlePreludeLanguageClick("de"));
  }

  if (locationEnableBtn) {
    locationEnableBtn.addEventListener("click", handleLocationEnable);
  }

  loadOrAssignInstrument();
  setupTabs();
  startHeroCaptionSlider();

  showScene("scene-preintro");
});
