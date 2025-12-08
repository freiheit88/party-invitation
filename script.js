// Global audio and scene state
// ---------------------------------

const TEST_PRELUDE_ONLY = true;  // test mode: keep flow in prelude, do not enter main scene yet

let currentSceneId = "scene-preintro";

const scenes = {};

let bgAudio = null;
let bgAudioStarted = false;
let bgBaseVolume = 0.3;

let activeAudios = new Set();
let muted = false;

let heroCaptionIndex = 0;
let heroCaptionTimer = null;

// Instruments
const INSTRUMENT_ROLES = [
  {
    id: "violins2",
    label: "You are · Violins II",
    emoji: "🎻",
    family: "strings",
    sample: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
  },
  {
    id: "cellos",
    label: "You are · Cellos",
    emoji: "🎻",
    family: "strings",
    sample: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
  },
  {
    id: "trumpets",
    label: "You are · Trumpets",
    emoji: "🎺",
    family: "brass",
    sample: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",
  },
  {
    id: "timpani",
    label: "You are · Timpani",
    emoji: "🥁",
    family: "timpani",
    sample: "media/zoid_percussion_timpani_roll_A.wav",
  },
];

const HERO_CAPTIONS = [
  {
    text: `Alte Oper at night.  
Streetlights, passing trams, and the soft hum of conversations 
blur into one shared breathing of the square.`,
  },
  {
    text: `Saturday, 14 June 2025 · 19:30  
Start at Alte Oper, Frankfurt.  
The final location reveals itself only when you stand on the square.`,
  },
];

let assignedInstrument = null;
let harmonicsInstruments = [];
let currentLetARingIndex = 0;

// Prelude voices & interrupt
let preludeVoiceDe = null;
let preludeVoiceEn = null;
let preludeInterruptEn = null;
let preludeInterruptDe = null;

let preludeVoiceTimeoutDe = null;
let preludeVoiceTimeoutEn = null;
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
}

// Global mute application
function applyMuteState() {
  const globalVolume = muted ? 0 : 1;

  if (bgAudio) {
    bgAudio.volume = muted ? 0 : bgBaseVolume;
  }

  activeAudios.forEach((audio) => {
    try {
      audio.volume = muted ? 0 : audio._baseVolume ?? 1;
    } catch (e) {
      // ignore
    }
  });

  const musicToggle = document.getElementById("musicToggle");
  if (musicToggle) {
    if (muted) {
      document.body.classList.add("muted-world");
    } else {
      document.body.classList.remove("muted-world");
    }
  }
}

// Toggle mute
function toggleMute() {
  muted = !muted;
  updateMutePillVisual();
  applyMuteState();
  if (muted) {
    clearHeroGlow();
  }
}

// Update mute pill content (icon-only [🔊 | 🔇])
function updateMutePillVisual() {
  const toggle = document.getElementById("musicToggle");
  if (!toggle) return;

  // Nothing to change in markup, only class is handled via body.muted-world
  // The CSS handles visual emphasis using body.muted-world.
}

// Background audio setup
function ensureBackgroundAudio() {
  if (bgAudio) return;

  bgAudio = new Audio("media/Serenade For Strings Op.48_2nd movt.wav");
  bgAudio.loop = true;
  bgAudio.volume = muted ? 0 : bgBaseVolume;
  bgAudioStarted = false;
  registerAudio(bgAudio);
}

function startBackgroundAudio() {
  ensureBackgroundAudio();
  if (bgAudioStarted) return;

  bgAudio
    .play()
    .then(() => {
      bgAudioStarted = true;
      if (muted) {
        bgAudio.volume = 0;
      } else {
        bgAudio.volume = 0;
        const target = bgBaseVolume;
        const steps = 30;
        let currentStep = 0;
        const interval = setInterval(() => {
          currentStep++;
          const ratio = currentStep / steps;
          bgAudio.volume = target * ratio;
          if (currentStep >= steps) {
            clearInterval(interval);
          }
        }, 200);
      }
    })
    .catch(() => {
      // autoplay blocked, will try again on next user interaction
    });
}

// Scene helpers

function showScene(sceneId) {
  const allScenes = document.querySelectorAll(".scene");
  allScenes.forEach((scene) => {
    if (scene.id === sceneId) {
      scene.classList.add("scene-active");
    } else {
      scene.classList.remove("scene-active");
    }
  });

  currentSceneId = sceneId;
}

// Hero caption cycle

function startHeroCaptionCycle() {
  const captionEl = document.getElementById("heroCaptionText");
  const dots = document.querySelectorAll(".hero-dot");

  if (!captionEl || dots.length === 0) return;

  if (heroCaptionTimer) {
    clearInterval(heroCaptionTimer);
  }

  let index = 0;
  captionEl.textContent = HERO_CAPTIONS[index].text;
  dots.forEach((d, i) => {
    d.classList.toggle("hero-dot-active", i === index);
  });

  heroCaptionTimer = setInterval(() => {
    index = (index + 1) % HERO_CAPTIONS.length;
    heroCaptionIndex = index;
    captionEl.textContent = HERO_CAPTIONS[index].text;
    dots.forEach((d, i) => {
      d.classList.toggle("hero-dot-active", i === index);
    });
  }, 7000);
}

// Let A ring and hero glow

function getAssignedInstrument() {
  const stored = localStorage.getItem("invitation.instrumentRole");
  if (stored) {
    const existing = INSTRUMENT_ROLES.find((r) => r.id === stored);
    if (existing) return existing;
  }
  const role = INSTRUMENT_ROLES[Math.floor(Math.random() * INSTRUMENT_ROLES.length)];
  try {
    localStorage.setItem("invitation.instrumentRole", role.id);
  } catch (e) {
    // ignore localStorage errors
  }
  return role;
}

function updateInstrumentUI() {
  const pill = document.getElementById("instrumentPill");
  const icon = document.getElementById("instrumentIcon");
  const label = document.getElementById("instrumentLabel");
  const letAEmoji = document.getElementById("letARingEmoji");
  if (!pill || !icon || !label || !letAEmoji || !assignedInstrument) return;

  label.textContent = assignedInstrument.label;
  icon.textContent = assignedInstrument.emoji;
  letAEmoji.textContent = assignedInstrument.emoji;
}

function clearHeroGlow() {
  const glow = document.getElementById("heroGlow");
  if (!glow) return;
  glow.classList.remove("hero-glow-active");
}

function playTuningSample() {
  const instrumentsToUse = [assignedInstrument, ...harmonicsInstruments];
  if (instrumentsToUse.length === 0) return;

  const instrument = instrumentsToUse[currentLetARingIndex % instrumentsToUse.length];
  currentLetARingIndex++;

  const audio = new Audio(instrument.sample);
  audio._baseVolume = instrument.family === "timpani" ? 1.0 : 0.7;
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);

  if (bgAudio && bgAudioStarted) {
    bgAudio.volume = 0;
  }

  const glow = document.getElementById("heroGlow");
  if (glow && !muted) {
    glow.classList.remove("hero-glow-active");
    void glow.offsetWidth;
    glow.classList.add("hero-glow-active");

    if (instrument.family === "strings") {
      glow.style.background =
        "radial-gradient(circle at 50% 80%, rgba(255,210,130,0.35), transparent 60%)";
    } else if (instrument.family === "brass") {
      glow.style.background =
        "radial-gradient(circle at 50% 80%, rgba(255,190,120,0.4), transparent 60%)";
    } else if (instrument.family === "timpani") {
      glow.style.background =
        "radial-gradient(circle at 50% 80%, rgba(255,140,140,0.4), transparent 60%)";
    }
  }

  audio.play().finally(() => {
    setTimeout(() => {
      if (bgAudio && bgAudioStarted && !muted) {
        bgAudio.volume = bgBaseVolume * 0.18;
      }
    }, 200);
  });
}

// Timpani SFX (door between scenes)

function playTimpani() {
  const audio = new Audio("media/TS_IFD_kick_timpani_heavy.wav");
  audio._baseVolume = 0.8;
  audio.volume = muted ? 0 : audio._baseVolume;
  registerAudio(audio);
  audio.play();
}

// Pre-intro logic

let preintroHasBeenTouched = false;
let preintroRippleTimer = null;

function handlePreintroTap() {
  if (preintroHasBeenTouched) return;
  preintroHasBeenTouched = true;

  const overlay = document.getElementById("preintroOverlay");
  const btn = document.getElementById("preintroTouchBtn");
  const ripple = document.getElementById("preintroRipple");

  startBackgroundAudio();

  if (overlay) {
    overlay.classList.remove("scene-overlay-dark");
    overlay.classList.add("scene-overlay-light");
  }

  if (btn) {
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0";
    btn.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    btn.style.transform = "scale(0.96)";
  }

  if (ripple) {
    preintroRippleTimer = setTimeout(() => {
      ripple.classList.add("preintro-ripple-visible");
    }, 1200);
  }
}

function handlePreintroRippleTap() {
  const ripple = document.getElementById("preintroRipple");
  if (ripple) {
    ripple.style.transition = "opacity 0.45s ease, transform 0.45s ease";
    ripple.style.opacity = "0";
    ripple.style.transform = "scale(1.1)";
    setTimeout(() => {
      ripple.style.display = "none";
    }, 500);
  }

  playTimpani();
  goToPrelude();
}

let preintroAutoTimer = null;

function schedulePreintroAutoTransition() {
  const ripple = document.getElementById("preintroRipple");
  if (!ripple) return;
  preintroAutoTimer = setTimeout(() => {
    if (ripple.classList.contains("preintro-ripple-visible")) {
      playTimpani();
      goToPrelude();
    }
  }, 7000);
}

// Prelude scene logic

function setupPreludeVoices() {
  preludeVoiceDe = new Audio("media/prelude_voice_de_male.mp3");
  preludeVoiceEn = new Audio("media/prelude_voice_en_female.mp3");
  preludeInterruptEn = new Audio("media/prelude_interrupt_en_male.mp3");
  preludeInterruptDe = new Audio("media/prelude_interrupt_de_male.mp3");

  [preludeVoiceDe, preludeVoiceEn, preludeInterruptEn, preludeInterruptDe].forEach((a) => {
    if (!a) return;
    a._baseVolume = 1.0;
    a.volume = muted ? 0 : a._baseVolume;
    registerAudio(a);
  });
}

function schedulePreludeVoices() {
  if (!preludeVoiceDe || !preludeVoiceEn) return;

  if (preludeVoiceTimeoutDe) clearTimeout(preludeVoiceTimeoutDe);
  if (preludeVoiceTimeoutEn) clearTimeout(preludeVoiceTimeoutEn);

  preludeVoiceTimeoutDe = setTimeout(() => {
    if (preludeTransitionStarted) return;
    currentPreludeVoice = preludeVoiceDe;
    preludeVoiceDe.currentTime = 0;
    preludeVoiceDe.volume = muted ? 0 : preludeVoiceDe._baseVolume;
    preludeVoiceDe.play().catch(() => {});

    preludeVoiceDe.onended = () => {
      if (preludeTransitionStarted) return;
      preludeVoiceTimeoutEn = setTimeout(() => {
        if (preludeTransitionStarted) return;
        currentPreludeVoice = preludeVoiceEn;
        preludeVoiceEn.currentTime = 0;
        preludeVoiceEn.volume = muted ? 0 : preludeVoiceEn._baseVolume;
        preludeVoiceEn.play().catch(() => {});
      }, 500);
    };
  }, 4000);
}

function fadeOutCurrentPreludeVoice(callback) {
  if (!currentPreludeVoice) {
    callback();
    return;
  }

  if (preludeFadeInterval) {
    clearInterval(preludeFadeInterval);
    preludeFadeInterval = null;
  }

  let steps = 10;
  let step = 0;
  const startVol = currentPreludeVoice.volume;

  preludeFadeInterval = setInterval(() => {
    step++;
    const ratio = step / steps;
    const newVol = startVol * (1 - ratio);
    currentPreludeVoice.volume = Math.max(newVol, 0);

    if (step >= steps) {
      clearInterval(preludeFadeInterval);
      preludeFadeInterval = null;
      try {
        currentPreludeVoice.pause();
      } catch (e) {}
      currentPreludeVoice.currentTime = 0;
      currentPreludeVoice = null;
      callback();
    }
  }, 100);
}

function handlePreludeZoneTap(language) {
  if (preludeTransitionStarted) return;
  preludeTransitionStarted = true;

  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
    preludeAutoTimer = null;
  }

  const afterFade = () => {
    let interruptAudio =
      language === "en" ? preludeInterruptEn : preludeInterruptDe;

    if (!interruptAudio) {
      playTimpani();
      goToMain();
      return;
    }

    currentPreludeVoice = interruptAudio;
    interruptAudio.currentTime = 0;
    interruptAudio.volume = muted ? 0 : interruptAudio._baseVolume;
    interruptAudio.play().catch(() => {
      playTimpani();
      goToMain();
    });

    interruptAudio.onended = () => {
      playTimpani();
      goToMain();
    };
  };

  fadeOutCurrentPreludeVoice(afterFade);
}

function schedulePreludeAutoTransition() {
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

// Scene transitions

function goToPreintro() {
  showScene("scene-preintro");
}

function goToPrelude() {
  showScene("scene-prelude");
  playTimpani();

  setupPreludeVoices();
  schedulePreludeVoices();
  schedulePreludeAutoTransition();
}

// Main scene entry
function goToMain() {
  if (TEST_PRELUDE_ONLY) {
    console.log("TEST MODE: goToMain() suppressed (staying in Prelude).");
    return;
  }
  showScene("scene-main");
  startHeroCaptionCycle();
}

// DOMContentLoaded setup
document.addEventListener("DOMContentLoaded", () => {
  scenes.preintro = document.getElementById("scene-preintro");
  scenes.prelude = document.getElementById("scene-prelude");
  scenes.main = document.getElementById("scene-main");

  assignedInstrument = getAssignedInstrument();
  updateInstrumentUI();

  ensureBackgroundAudio();
  applyMuteState();
  updateMutePillVisual();

  goToPreintro();

  const preintroBtn = document.getElementById("preintroTouchBtn");
  const preintroRipple = document.getElementById("preintroRipple");

  if (preintroBtn) {
    preintroBtn.addEventListener("click", () => {
      handlePreintroTap();
      schedulePreintroAutoTransition();
    });
  }

  if (preintroRipple) {
    preintroRipple.addEventListener("click", handlePreintroRippleTap);
  }

  const zoneLeft = document.getElementById("preludeZoneLeft");
  const zoneRight = document.getElementById("preludeZoneRight");

  if (zoneLeft) {
    zoneLeft.addEventListener("click", () => handlePreludeZoneTap("en"));
  }
  if (zoneRight) {
    zoneRight.addEventListener("click", () => handlePreludeZoneTap("de"));
  }

  const musicToggle = document.getElementById("musicToggle");
  if (musicToggle) {
    musicToggle.addEventListener("click", toggleMute);
  }

  const letABtn = document.getElementById("letARingBtn");
  if (letABtn) {
    letABtn.addEventListener("click", () => {
      if (!bgAudioStarted && !muted) {
        startBackgroundAudio();
      }
      playTuningSample();
    });
  }

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("tab-btn-active"));
      btn.classList.add("tab-btn-active");

      tabPanels.forEach((panel) => {
        panel.classList.toggle(
          "tab-panel-active",
          panel.id === `tab-${tabId}`,
        );
      });
    });
  });

  const orchestraBtn = document.getElementById("orchestraStartBtn");
  const orchestraStatus = document.getElementById("orchestraStatus");
  const orchestraPopup = document.getElementById("orchestraPopup");
  const orchestraPopupClose = document.getElementById("orchestraPopupClose");

  if (orchestraBtn && orchestraStatus && orchestraPopup) {
    orchestraBtn.addEventListener("click", () => {
      orchestraPopup.classList.remove("hidden");
      orchestraStatus.textContent =
        "Waiting for browser location permission…";

      if ("geolocation" in navigator) {
        geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            orchestraStatus.textContent = `You: ${latitude.toFixed(
              5,
            )}, ${longitude.toFixed(5)} · accuracy ≈ ${Math.round(accuracy)} m`;
          },
          (err) => {
            orchestraStatus.textContent =
              "Location error or permission denied.";
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
          },
        );
      } else {
        orchestraStatus.textContent = "Geolocation not supported in this browser.";
      }
    });
  }

  if (orchestraPopupClose && orchestraPopup) {
    orchestraPopupClose.addEventListener("click", () => {
      orchestraPopup.classList.add("hidden");
    });
  }
});
