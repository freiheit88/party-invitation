// Global audio and scene state
// ---------------------------------

let currentSceneId = "scene-preintro";

const scenes = {};

let bgAudio = null;
let bgAudioStarted = false;
let bgBaseVolume = 0.3;

let activeAudios = new Set();
let muted = false;

let heroCaptionIndex = 0;
let heroCaptionTimer = null;

let preintroHasStarted = false;
let preintroRippleTimeout = null;

let preludeVoicesStarted = false;
let currentPreludeVoice = null;
let preludeInterruptAudio = null;
let preludeFadeInterval = null;
let preludeAutoTimer = null;
let preludeTransitionStarted = false;

let preludeVoiceStatus = null;

// Orchestra game
let geoWatchId = null;

// Utility: register any one-shot audio so mute works
function registerAudio(audio) {
  activeAudios.add(audio);
  audio.addEventListener("ended", () => {
    activeAudios.delete(audio);
  });
  if (muted) {
    audio.volume = 0;
  }
}

// Background music
function ensureBgAudio() {
  if (bgAudio) return;
  bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
  bgAudio.loop = true;
  bgAudio.volume = 0;
}

function startBackgroundMusic() {
  ensureBgAudio();
  if (bgAudioStarted) return;
  bgAudioStarted = true;
  bgAudio
    .play()
    .then(() => {
      fadeBgVolumeTo(bgBaseVolume, 6000);
    })
    .catch(() => {
      // autoplay blocked – we keep bgAudioStarted so later user interactions can resume
    });
}

function fadeBgVolumeTo(target, duration) {
  if (!bgAudio) return;
  const steps = 20;
  const stepDuration = duration / steps;
  const start = bgAudio.volume;
  const delta = target - start;
  let currentStep = 0;
  const id = setInterval(() => {
    currentStep += 1;
    const t = currentStep / steps;
    const v = start + delta * t;
    bgAudio.volume = muted ? 0 : Math.max(0, Math.min(1, v));
    if (currentStep >= steps) {
      clearInterval(id);
    }
  }, stepDuration);
}

// Duck bg audio for a moment (e.g. during voices)
function duckBgDuring(ms) {
  if (!bgAudio) return;
  const prev = bgAudio.volume;
  fadeBgVolumeTo(0.0, 300);
  setTimeout(() => {
    fadeBgVolumeTo(prev, 1200);
  }, ms);
}

// Global mute
function applyMuteState() {
  if (muted) {
    if (bgAudio) bgAudio.volume = 0;
    activeAudios.forEach((a) => {
      a.volume = 0;
    });
    document.body.classList.add("muted-world");
  } else {
    if (bgAudio) bgAudio.volume = bgBaseVolume;
    activeAudios.forEach((a) => {
      if (typeof a._baseVolume === "number") {
        a.volume = a._baseVolume;
      } else {
        a.volume = 1.0;
      }
    });
    document.body.classList.remove("muted-world");
  }
}

function toggleMute() {
  muted = !muted;
  const pill = document.getElementById("musicToggle");
  if (pill) {
    pill.classList.toggle("music-muted", muted);
    pill.classList.toggle("music-on", !muted);
  }
  applyMuteState();
}

// Scene helpers
function showScene(id) {
  const prev = document.getElementById(currentSceneId);
  const next = document.getElementById(id);
  if (prev && prev !== next) {
    prev.classList.remove("scene-active");
  }
  if (next) next.classList.add("scene-active");
  currentSceneId = id;
}

// Timpani SFX
function playTimpani() {
  const audio = new Audio("media/TS_IFD_kick_timpani_heavy.wav");
  audio._baseVolume = 0.8;
  registerAudio(audio);
  audio.play().catch(() => {});
}

// Pre-intro logic
// ---------------------------------

function handlePreintroTap() {
  if (preintroHasStarted) return;
  preintroHasStarted = true;

  const overlay = document.getElementById("preintroOverlay");
  const btn = document.getElementById("preintroTouchBtn");
  const ripple = document.getElementById("preintroRipple");

  if (overlay) {
    overlay.classList.add("preintro-overlay-light");
    overlay.classList.remove("scene-overlay-dark");
  }
  if (btn) {
    btn.style.opacity = "0";
    btn.style.pointerEvents = "none";
  }

  if (!bgAudioStarted) {
    startBackgroundMusic();
  }

  // After overlay brightened, show ripple and start idle fallback
  setTimeout(() => {
    if (ripple) {
      ripple.classList.add("preintro-ripple-visible");
      ripple.classList.remove("preintro-ripple-hidden");
    }
    preintroRippleTimeout = setTimeout(() => {
      leavePreintroToPrelude();
    }, 7000);
  }, 1200);
}

function leavePreintroToPrelude() {
  if (preintroRippleTimeout) {
    clearTimeout(preintroRippleTimeout);
    preintroRippleTimeout = null;
  }
  const ripple = document.getElementById("preintroRipple");
  if (ripple) {
    ripple.classList.add("preintro-ripple-hidden");
    ripple.classList.remove("preintro-ripple-visible");
  }
  playTimpani();
  goToPrelude();
}

// Prelude logic
// ---------------------------------

function goToPrelude() {
  // Explicitly switch from pre-intro to prelude to avoid any scene mismatch
  const preintro = document.getElementById("scene-preintro");
  const prelude = document.getElementById("scene-prelude");
  if (preintro) preintro.classList.remove("scene-active");
  if (prelude) prelude.classList.add("scene-active");
  currentSceneId = "scene-prelude";

  if (!preludeVoicesStarted) {
    preludeVoicesStarted = true;
    setTimeout(() => {
      playPreludeVoices();
    }, 4000);
  }

  preludeTransitionStarted = false;
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
  }
  preludeAutoTimer = setTimeout(() => {
    if (preludeTransitionStarted) return;
    preludeTransitionStarted = true;
    fadeOutCurrentPreludeVoice(() => {
      playTimpani();
      goToMain();
    });
  }, 30000);
}

function playPreludeVoices() {
  // German, then English
  const male = new Audio("media/prelude_voice_de_male.mp3");
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male);
  currentPreludeVoice = male;

  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: German voice playing…";
  }
  duckBgDuring(5000);

  male.addEventListener("ended", () => {
    currentPreludeVoice = null;
    setTimeout(() => {
      const female = new Audio("media/prelude_voice_en_female.mp3");
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female);
      currentPreludeVoice = female;

      if (preludeVoiceStatus) {
        preludeVoiceStatus.textContent = "Voices: English voice playing…";
      }
      duckBgDuring(5000);

      female.addEventListener("ended", () => {
        currentPreludeVoice = null;
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent =
            "Voices: finished – the room is listening.";
        }
      });

      female.play().catch(() => {
        currentPreludeVoice = null;
        if (preludeVoiceStatus) {
          preludeVoiceStatus.textContent = "Voices: playback blocked.";
        }
      });
    }, 500);
  });

  male.play().catch(() => {
    currentPreludeVoice = null;
    if (preludeVoiceStatus) {
      preludeVoiceStatus.textContent = "Voices: playback blocked.";
    }
  });
}

function fadeOutCurrentPreludeVoice(onDone) {
  const voice = currentPreludeVoice;
  if (!voice || voice.paused || voice.ended) {
    currentPreludeVoice = null;
    if (typeof onDone === "function") onDone();
    return;
  }

  if (preludeFadeInterval) {
    clearInterval(preludeFadeInterval);
    preludeFadeInterval = null;
  }

  const duration = 1000;
  const steps = 10;
  const interval = duration / steps;
  let step = 0;
  const startVolume = voice.volume;

  preludeFadeInterval = setInterval(() => {
    step += 1;
    const t = step / steps;
    const v = Math.max(0, startVolume * (1 - t));
    voice.volume = muted ? 0 : v;

    if (step >= steps) {
      clearInterval(preludeFadeInterval);
      preludeFadeInterval = null;
      try {
        voice.pause();
      } catch (e) {}
      try {
        voice.currentTime = 0;
      } catch (e) {}
      activeAudios.delete(voice);
      currentPreludeVoice = null;
      if (typeof onDone === "function") onDone();
    }
  }, interval);
}

function playPreludeInterrupt(language) {
  let src = "";
  if (language === "en") {
    src = "media/prelude_interrupt_en_female.mp3";
  } else {
    src = "media/prelude_interrupt_de_male.mp3";
  }

  if (!src) {
    playTimpani();
    goToMain();
    return;
  }

  const interrupt = new Audio(src);
  interrupt._baseVolume = 0.8;
  interrupt.volume = muted ? 0 : interrupt._baseVolume;
  registerAudio(interrupt);
  preludeInterruptAudio = interrupt;

  if (preludeVoiceStatus) {
    preludeVoiceStatus.textContent = "Voices: interrupt line playing…";
  }

  interrupt.addEventListener("ended", () => {
    preludeInterruptAudio = null;
    playTimpani();
    goToMain();
  });

  interrupt.play().catch(() => {
    preludeInterruptAudio = null;
    playTimpani();
    goToMain();
  });
}

function handlePreludeLanguageTap(language) {
  if (preludeTransitionStarted) return;
  preludeTransitionStarted = true;

  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  fadeOutCurrentPreludeVoice(() => {
    playPreludeInterrupt(language);
  });
}

// Main scene logic
// ---------------------------------

const instrumentRoles = [
  { name: "Violins II", emoji: "🎻", sample: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav" },
  { name: "Cellos", emoji: "🎻", sample: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav" },
  { name: "Trumpets", emoji: "🎺", sample: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav" },
  { name: "Timpani", emoji: "🥁", sample: "media/zoid_percussion_timpani_roll_A.wav" }
];

let userInstrument = null;

function assignInstrument() {
  const stored = window.localStorage.getItem("orchestraInstrument");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.name && parsed.sample) {
        userInstrument = parsed;
        return;
      }
    } catch (e) {}
  }
  const choice = instrumentRoles[Math.floor(Math.random() * instrumentRoles.length)];
  userInstrument = choice;
  window.localStorage.setItem("orchestraInstrument", JSON.stringify(choice));
}

function updateInstrumentUI() {
  const nameEl = document.getElementById("instrumentName");
  const emojiEl = document.getElementById("instrumentEmoji");
  if (!userInstrument) return;
  if (nameEl) nameEl.textContent = userInstrument.name;
  if (emojiEl) emojiEl.textContent = userInstrument.emoji;
}

function playLetARing() {
  if (!userInstrument) return;
  const audio = new Audio(userInstrument.sample);
  if (userInstrument.name === "Timpani") {
    audio._baseVolume = 1.0;
  } else {
    audio._baseVolume = 0.7;
  }
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);

  if (bgAudio) {
    const prev = bgAudio.volume;
    bgAudio.volume = muted ? 0 : 0.0;
    audio.addEventListener("ended", () => {
      fadeBgVolumeTo(prev, 1500);
    });
  }

  const glow = document.getElementById("heroGlowLayer");
  if (glow) {
    glow.classList.add("hero-glow-active");
    audio.addEventListener("ended", () => {
      glow.classList.remove("hero-glow-active");
    });
  }

  audio.play().catch(() => {});
}

// Hero captions
const heroCaptions = [
  "Alte Oper at night: tram bells, taxis, and footsteps weaving around a quiet, waiting facade.",
  "Saturday, 14 June 2025 · 19:30 · Start at Alte Oper, Frankfurt. The final location reveals itself only when you stand on the square."
];

function startHeroCaptionCycle() {
  const textEl = document.getElementById("heroCaptionText");
  const dots = Array.from(document.querySelectorAll(".hero-dot"));
  function render() {
    if (!textEl) return;
    textEl.textContent = heroCaptions[heroCaptionIndex];
    dots.forEach((d, i) => {
      d.classList.toggle("hero-dot-active", i === heroCaptionIndex);
    });
  }
  render();
  if (heroCaptionTimer) clearInterval(heroCaptionTimer);
  heroCaptionTimer = setInterval(() => {
    heroCaptionIndex = (heroCaptionIndex + 1) % heroCaptions.length;
    render();
  }, 7000);
}

// Tabs
function setupTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = {
    invitation: document.getElementById("tab-invitation"),
    how: document.getElementById("tab-how"),
    board: document.getElementById("tab-board"),
    game: document.getElementById("tab-game")
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      buttons.forEach((b) => b.classList.toggle("tab-btn-active", b === btn));
      Object.keys(panels).forEach((key) => {
        if (panels[key]) {
          panels[key].classList.toggle("tab-panel-active", key === tab);
        }
      });
    });
  });
}

// Orchestra Game
function startOrchestraGame() {
  const status = document.getElementById("gameStatus");
  if (!navigator.geolocation) {
    if (status) status.textContent = "Location is not available in this browser.";
    return;
  }
  if (status) status.textContent = "Asking the browser for your location…";
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (status) {
        status.textContent = `You: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }
    },
    (err) => {
      if (status) status.textContent = "Location error or permission denied.";
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000
    }
  );
}

// Main scene entry
function goToMain() {
  showScene("scene-main");
  startHeroCaptionCycle();
}

// DOMContentLoaded setup
document.addEventListener("DOMContentLoaded", () => {
  scenes.preintro = document.getElementById("scene-preintro");
  scenes.prelude = document.getElementById("scene-prelude");
  scenes.main = document.getElementById("scene-main");

  preludeVoiceStatus = document.getElementById("preludeVoiceStatus");

  const preintroBtn = document.getElementById("preintroTouchBtn");
  const preintroRipple = document.getElementById("preintroRipple");

  if (preintroBtn) {
    preintroBtn.addEventListener("click", handlePreintroTap);
  }
  if (preintroRipple) {
    preintroRipple.addEventListener("click", () => {
      leavePreintroToPrelude();
    });
  }

  const musicToggle = document.getElementById("musicToggle");
  if (musicToggle) {
    musicToggle.addEventListener("click", toggleMute);
    musicToggle.classList.add("music-on");
  }

  const preludeZoneLeft = document.getElementById("preludeZoneLeft");
  const preludeZoneRight = document.getElementById("preludeZoneRight");

  if (preludeZoneLeft) {
    preludeZoneLeft.addEventListener("click", () => {
      handlePreludeLanguageTap("en");
    });
  }
  if (preludeZoneRight) {
    preludeZoneRight.addEventListener("click", () => {
      handlePreludeLanguageTap("de");
    });
  }

  assignInstrument();
  updateInstrumentUI();

  const letABtn = document.getElementById("letARingBtn");
  if (letABtn) {
    letABtn.addEventListener("click", playLetARing);
  }

  setupTabs();

  const startGameBtn = document.getElementById("startGameBtn");
  if (startGameBtn) {
    startGameBtn.addEventListener("click", startOrchestraGame);
  }
});
