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

// [최종] 모차르트 모드 상태 및 카운터
let tuneCount = 0;
let mozartMode = false;
let mozartEffectInterval = null;
let preintroTransitionStarted = false; // Scene 전환 중복 방지 플래그
let timpaniLastPlayedTime = 0; // Timpani 중복 재생 방지용

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
const preintroRipple = document.getElementById("preintroRipple");

// Prelude elements
const preludeZoneLeft = document.getElementById("preludeZoneLeft");
const preludeZoneRight = document.getElementById("preludeZoneRight");

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

// Preintro / Prelude timing state
let preintroHasTapped = false;
let preintroIdleTimer = null; 

let preludeAutoTimer = null; 
// let preludeTransitionStarted = false; // 상단에 이미 정의됨

// Prelude voices / interrupt state
let preludeMaleAudio = null;
let preludeFemaleAudio = null;
let preludeInterruptAudio = null;
let preludeFadeInterval = null;
let preludeInterruptFlowStarted = false;

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
  bgAudio
    .play()
    .then(() => {
      bgTargetVolume = 0.3; 
      // [수정] BG 음악 페이드인 시간을 5초로 조정
      fadeBgTo(bgTargetVolume, 5000); 
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
    // [수정] 오디오 덕킹 시간을 7초로 늘려 안정화
    fadeBgTo(bgTargetVolume, 7000); 
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

// [추가] 터치 시 Timpani 재생을 처리하는 범용 함수
function handleTimpaniTouch() {
  const now = Date.now();
  if (now - timpaniLastPlayedTime < 200) return; 
  
  playTimpani();
  timpaniLastPlayedTime = now;
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

// [수정] 모차르트 모드 활성화 및 UI 효과
function activateMozartMode() {
  if (mozartMode) return;
  mozartMode = true;
  
  const instrumentNameEl = document.getElementById("instrumentLabel");

  // 1. 초기 3초 효과 (텍스트는 그대로 유지)
  if (instrumentNameEl) {
    instrumentNameEl.classList.add("mozart-effect-stage1");
  }

  // 2. 3초 후 텍스트 변경 애니메이션 시작
  setTimeout(() => {
    if (instrumentNameEl) {
      instrumentNameEl.textContent = ""; // 텍스트 초기화
      instrumentNameEl.classList.add("mozart-effect-stage2"); // 텍스트 전환 효과 CSS
      
      const targetText = "YOU ARE MOZART !";
      let charIndex = 0;
      
      // 글자 한 자씩 스르륵 나타나는 효과 구현 (1초에 걸쳐)
      mozartEffectInterval = setInterval(() => {
        if (charIndex < targetText.length) {
          instrumentNameEl.textContent += targetText.charAt(charIndex);
          charIndex++;
        } else {
          clearInterval(mozartEffectInterval);
          // 3. 텍스트 변경 후 2초 효과 유지
          setTimeout(() => {
            instrumentNameEl.classList.remove("mozart-effect-stage1", "mozart-effect-stage2");
          }, 2000); 
        }
      }, 100); // 1초에 걸쳐 바뀌도록 100ms 간격 설정
    }
    
  }, 3000); // 3초 대기

  // [추가] 모차르트 모드 시 모든 악기 이모티콘 추가 (시각적 과시)
  ownedInstruments = instrumentRoles.map(r => r.id);
  updateOwnedInstrumentsHint();
  updateTuneIcons();
}

// Round-robin through owned instruments
function playNextOwnedInstrument() {
  // [추가] 튜닝 횟수 카운트
  tuneCount++;
  if (!mozartMode && tuneCount >= 10) {
    activateMozartMode();
  }
  
  // [수정] 모차르트 모드 활성화 시, 전체 악기 배열을 사용 (랜덤)
  const availableInstruments = mozartMode 
    ? instrumentRoles.map(r => r.id) 
    : ownedInstruments;

  if (!availableInstruments.length) return;
  
  // [수정] 모차르트 모드에서는 랜덤하게 악기 선택
  const instrumentId = mozartMode
    ? availableInstruments[Math.floor(Math.random() * availableInstruments.length)]
    : availableInstruments[ownedIndex];
    
  if (!mozartMode) {
    ownedIndex = (ownedIndex + 1) % availableInstruments.length;
  }

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
  // 모차르트 모드에서는 모든 악기를 보여줍니다.
  const instrumentsToShow = mozartMode ? instrumentRoles : ownedInstruments.map(id => instrumentRoles.find(r => r.id === id)).filter(Boolean);
  
  instrumentsToShow.forEach((roleOrId) => {
    const role = (typeof roleOrId === 'string') ? instrumentRoles.find(r => r.id === roleOrId) : roleOrId;
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
  // special case: timpani tuning louder
  if (instrumentId === "timpani") {
    audio._baseVolume = 1.0;
  }
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
  schedulePreludeVoices();

  preludeTransitionStarted = false;
  
  // [최종] 자동 전환 타이머 60초로 변경
  if (preludeAutoTimer) {
    clearTimeout(preludeAutoTimer);
  }
  const autoTimeout = 60000; // 60초 설정
  preludeAutoTimer = setTimeout(() => {
    leavePreludeToMain();
  }, autoTimeout);
}

function goToMain() {
  // 메인 씬 진입 시 BG 음악 볼륨을 0.05로 재조정
  bgTargetVolume = 0.05; 
  fadeBgTo(bgTargetVolume, 2000); 

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
  
  // Scene 전환 시 Timpani 중복 재생 방지
  // playTimpani(); // 제거

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

  // 자동 전환이든 수동 전환이든 팀파니 SFX를 재생합니다.
  handleTimpaniTouch();
  
  goToMain();
}

// --------------------------
// Prelude voices (scene 0)
// --------------------------

let preludeVoicesStarted = false;

function schedulePreludeVoices() {
  if (preludeVoicesStarted) return;
  preludeVoicesStarted = true;

  // [최종] 4초 뒤에 음성 출력 시작
  const maleDelay = 4000; 
  setTimeout(() => {
    playPreludeVoices();
  }, maleDelay);
}

function playPreludeVoices() {
  // [최종] 파일 경로를 MP3로 변경
  preludeMaleAudio = new Audio("media/prelude_voice_de_male.mp3");
  const male = preludeMaleAudio;
  male._baseVolume = 0.8;
  male.volume = muted ? 0 : male._baseVolume;
  registerAudio(male);
  // [Web Audio API 전환 시 패닝 노드 필요: male.pan.value = 0.6 (오른쪽 80%)]

  duckBgDuring(7000); 

  male.addEventListener("ended", () => {
    preludeMaleAudio = null;
    setTimeout(() => {
      // [최종] 파일 경로를 MP3로 변경
      preludeFemaleAudio = new Audio("media/prelude_voice_en_female.mp3");
      const female = preludeFemaleAudio;
      female._baseVolume = 0.8;
      female.volume = muted ? 0 : female._baseVolume;
      registerAudio(female);
      // [Web Audio API 전환 시 패닝 노드 필요: female.pan.value = -0.6 (왼쪽 80%)]

      duckBgDuring(7000); 

      female.addEventListener("ended", () => {
        preludeFemaleAudio = null;
        // 60초 타이머에 의존
      });

      female.play().catch(() => {});
    }, 500);
  });

  male.play().catch(() => {});
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

  // [최종] 인터럽트 오디오 파일도 MP3로 변경
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

    a.addEventListener("ended", () => {
      preludeInterruptAudio = null;
      handleTimpaniTouch(); 
      leavePreludeToMain();
    });

    a.play().catch(() => {
      handleTimpaniTouch();
      leavePreludeToMain();
    });
  }

  if (!current) {
    startInterruptTts();
    return;
  }

  // 음성 재생 중이라면 페이드 아웃 로직
  // ... (기존 페이드 아웃 로직 유지)
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
  
  // 즉시 Scene 1로 전환 (leavePreludeToMain 내부에서 Timpani 재생)
  leavePreludeToMain();
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

// --------------------------
// Preintro interaction
// --------------------------

function handlePreintroTap() {
  if (preintroHasTapped) return;
  preintroHasTapped = true;

  // 1. Timpani SFX 재생
  handleTimpaniTouch(); 
  
  // 2. BG 음악 페이드인 시작 (5초)
  startBackgroundMusicFromPreintro();

  // 3. 버튼 사라짐
  if (preintroTouchBtn) {
    preintroTouchBtn.disabled = true;
  }

  // 4. [수정] 오버레이는 유지 (화면 어두운 상태 유지)
  // 5. 원형 리플 활성화 (클릭 대기 상태)
  const rippleDelay = 500; 

  setTimeout(() => {
    if (preintroRipple) {
      preintroRipple.classList.add("preintro-ripple-active");
    }
  }, rippleDelay);
}


// --------------------------
// Music pill label update
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

  // Scene -1의 두 번째 단계: Ripple 클릭 핸들러
  if (preintroRipple) {
      preintroRipple.addEventListener("click", () => {
          // [수정] 플래그를 사용하여 중복 호출 방지 및 안정화
          if (preintroRipple.classList.contains("preintro-ripple-active") && !preintroTransitionStarted) {
              preintroTransitionStarted = true; 
              
              // 1. Timpani SFX 재생
              handleTimpaniTouch(); 

              // 2. [핵심 수정] 5초간 서서히 밝아지는 효과 시작
              if (preintroOverlay) {
                  // CSS transition을 5초로 오버라이드하여 서서히 밝아지게 함
                  preintroOverlay.style.transition = 'background 5.0s ease';
                  preintroOverlay.classList.add("preintro-overlay-clear");
              }
              
              // 3. 리플 비활성화 및 전환 효과
              preintroRipple.classList.remove("preintro-ripple-active");
              preintroRipple.classList.add("preintro-ripple-leaving");

              // 4. 5초 후 Scene 0으로 전환
              const fadeInDuration = 5000; 
              setTimeout(() => {
                  leavePreintroToPrelude();
              }, fadeInDuration);
          }
      });
  }

  // [추가] Timpani 터치음 로직 (배경 클릭)
  if (scenePreintro) {
      scenePreintro.addEventListener("click", (e) => {
          // CTA 버튼이나 Ripple 버튼을 제외한 곳을 터치하면 Timpani 재생
          if (!e.target.closest('.preintro-btn') && !e.target.closest('.preintro-ripple')) {
              handleTimpaniTouch();
          }
      });
  }

  // Prelude EN / DE zones -> Scene 1 전환 로직
  if (preludeZoneLeft) {
      preludeZoneLeft.addEventListener("click", () => {
          handleTimpaniTouch(); 
          handlePreludeLanguageClick("en");
      });
  }
  if (preludeZoneRight) {
      preludeZoneRight.addEventListener("click", () => {
          handleTimpaniTouch(); 
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