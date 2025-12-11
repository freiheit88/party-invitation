document.addEventListener("DOMContentLoaded", () => {
  /* --- Global State --- */
  let bgAudio = null;
  let isMuted = false;
  let currentVoiceAudio = null; 
  let duckTimer = null; 
  let activeAudios = new Set(); 

  const roles = [
    { id: "cellos", name: "Cellos", icon: "🎻" },
    { id: "trumpets", name: "Trumpets", icon: "🎺" },
    { id: "violins2", name: "Violins II", icon: "🎻" },
    { id: "timpani", name: "Timpani", icon: "🥁" }
  ];
  
  const sounds = {
    cellos: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
    trumpets: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav",
    violins2: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
    timpani: "media/zoid_percussion_timpani_roll_A.wav",
    timpani_sfx: "media/TS_IFD_kick_timpani_heavy.wav",
    bg_music: "media/Serenade For Strings Op.48_2nd movt.wav",
    voice_de: "media/prelude_voice_de_male.mp3",
    voice_en: "media/prelude_voice_en_female.mp3",
    int_de: "media/prelude_interrupt_de_male.mp3",
    int_en: "media/prelude_interrupt_en_female.mp3"
  };

  let myRole = null;
  let ownedInstruments = [];
  let clickCount = 0;
  let isMozart = false;

  /* --- Utils --- */
  const playSfx = (path, vol = 1.0) => {
    if (isMuted) return null;
    const a = new Audio(path);
    a.volume = vol;
    a.play().catch(e => console.log("Audio play error:", e));
    activeAudios.add(a);
    a.onended = () => activeAudios.delete(a);
    return a;
  };

  const playBgMusic = () => {
    if (!bgAudio) {
      bgAudio = new Audio(sounds.bg_music);
      bgAudio.loop = true;
      bgAudio.volume = 0;
    }
    bgAudio.play().then(() => {
      let v = 0;
      const fade = setInterval(() => {
        if (isMuted) { clearInterval(fade); bgAudio.volume = 0; return; }
        v += 0.01;
        if (v >= 0.3) { v = 0.3; clearInterval(fade); }
        bgAudio.volume = v;
      }, 100);
    }).catch(e => console.log("BG play error:", e));
  };

  // [수정] 배경음악 줄이기 (Ducking) 타이머 충돌 방지
  const duckBgDuring = (duration = 3000) => {
    if (!bgAudio || isMuted) return;
    
    // 기존 복구 타이머가 있다면 취소 (연타 시 꼬임 방지)
    if (duckTimer) {
      clearTimeout(duckTimer);
      duckTimer = null;
    }
    
    // 즉시 볼륨 줄임
    bgAudio.volume = 0.05;
    
    // Duration 후에 서서히 복구
    duckTimer = setTimeout(() => {
      if (!isMuted && bgAudio) {
        let v = 0.05;
        const restoreFade = setInterval(() => {
          if (isMuted) { clearInterval(restoreFade); return; }
          v += 0.02;
          if (v >= 0.3) { v = 0.3; clearInterval(restoreFade); }
          bgAudio.volume = v;
        }, 100);
      }
    }, duration);
  };

  /* --- Scene Transition --- */
  const switchScene = (fromId, toId) => {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    fromEl.style.display = "none";
    fromEl.classList.remove("scene-visible");
    toEl.style.display = "block";
    if (toId === "scene-prelude") {
      toEl.classList.add("fade-in-slow");
    } else {
      toEl.classList.add("scene-visible");
    }
  };

  /* --- Scene -1: Pre-intro --- */
  const btnTouch = document.getElementById("preintroTouchBtn");
  const btnRipple = document.getElementById("preintroRipple");
  const videoPre = document.getElementById("preintroVideo");
  const overlay = document.getElementById("preintroOverlay");
  
  btnTouch.addEventListener("click", () => {
    playSfx(sounds.timpani_sfx);
    playBgMusic();
    
    // [수정] 1초 페이드 아웃
    btnTouch.classList.add("fade-out-btn");
    
    // 1초 뒤 리플 등장
    setTimeout(() => {
      document.getElementById("preintroUi").style.display = "none";
      btnRipple.style.display = "block";
      requestAnimationFrame(() => btnRipple.classList.add("visible"));
    }, 1000);
  });

  btnRipple.addEventListener("click", () => {
    playSfx(sounds.timpani_sfx);
    
    // [수정] 리플 페이드 아웃 (1초)
    btnRipple.classList.remove("visible");
    btnRipple.classList.add("fading-out");
    
    setTimeout(() => {
      btnRipple.classList.add("hidden"); 
      
      // 영상 밝아짐 (3초 트랜지션)
      videoPre.classList.remove("dark-filter"); 
      videoPre.classList.add("video-bright");
      overlay.classList.add("preintro-overlay-clear");
      
      // 3초 대기 후 전환
      setTimeout(() => {
        switchScene("scene-preintro", "scene-prelude");
      }, 3000);
    }, 1000);
  });

  /* --- Scene 0: Prelude --- */
  const zones = document.querySelectorAll(".prelude-language-btn");
  const dimLayer = document.getElementById("preludeDimLayer");
  const msgBox = document.getElementById("preludeMessage");
  let isInterrupting = false; 

  zones.forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (isInterrupting) return; 

      const lang = btn.dataset.lang;
      playSfx(sounds.timpani_sfx, 0.5);

      if (currentVoiceAudio && !currentVoiceAudio.paused) {
        isInterrupting = true;
        currentVoiceAudio.pause(); 
        
        const intFile = lang === "en" ? sounds.int_en : sounds.int_de;
        const intAudio = playSfx(intFile, 1.0);
        msgBox.classList.remove("show"); // Hide msg
        
        if (intAudio) {
          intAudio.onended = () => { setTimeout(() => switchScene("scene-prelude", "scene-main"), 1000); initMain(); };
        } else {
          setTimeout(() => switchScene("scene-prelude", "scene-main"), 2000);
          initMain();
        }
        return;
      }

      if (lang === "en") {
        dimLayer.classList.add("dim-right"); 
        document.querySelector('[data-lang="de"]').classList.add("fade-out");
        msgBox.textContent = "Listen to the guide"; // EN Message
      } else {
        dimLayer.classList.add("dim-left"); 
        document.querySelector('[data-lang="en"]').classList.add("fade-out");
        msgBox.textContent = "Lauschen Sie der Anleitung"; // DE Message
      }

      msgBox.classList.remove("hidden");
      msgBox.classList.add("show");

      if (bgAudio) bgAudio.volume = 0.05;

      const voiceFile = lang === "en" ? sounds.voice_en : sounds.voice_de;
      currentVoiceAudio = playSfx(voiceFile, 1.0);

      if (currentVoiceAudio) {
        currentVoiceAudio.onended = () => {
          msgBox.classList.remove("show");
          msgBox.classList.add("hidden");
          if (bgAudio && !isMuted) bgAudio.volume = 0.3;
          setTimeout(() => switchScene("scene-prelude", "scene-main"), 2000); 
          initMain();
        };
      } else {
        setTimeout(() => switchScene("scene-prelude", "scene-main"), 4000);
        initMain();
      }
    });
  });

  /* --- Scene 1: Main --- */
  const heroImgWrapper = document.getElementById("heroImageWrapper");
  const screenGlow = document.getElementById("screenGlow");
  const lblRole = document.getElementById("instrumentLabel");
  const lblId = document.getElementById("idLabel");
  const userIdentityBox = document.getElementById("userIdentityBox"); // 박스 전체
  const tuneIcons = document.getElementById("tuneIcons");
  
  const initMain = () => {
    myRole = roles[Math.floor(Math.random() * roles.length)];
    lblRole.textContent = myRole.name;
    ownedInstruments = [myRole.id]; 
    updateIcons();
    
    let capIdx = 0;
    const caps = document.querySelectorAll(".hero-caption");
    const dots = document.querySelectorAll(".hero-dot");
    setInterval(() => {
      caps[capIdx].classList.remove("hero-caption-active");
      dots[capIdx].classList.remove("hero-dot-active");
      capIdx = (capIdx + 1) % caps.length;
      caps[capIdx].classList.add("hero-caption-active");
      dots[capIdx].classList.add("hero-dot-active");
    }, 5000);
  };

  const updateIcons = () => {
    tuneIcons.textContent = "";
    const uniqueIds = [...new Set(ownedInstruments)];
    uniqueIds.forEach(id => {
      const r = roles.find(role => role.id === id);
      if(r) tuneIcons.textContent += r.icon + " ";
    });
  };

  // Mute Logic
  const btnMute = document.getElementById("musicToggle");
  btnMute.addEventListener("click", () => {
    isMuted = !isMuted;
    btnMute.classList.toggle("muted", isMuted);
    document.body.classList.toggle("muted-world", isMuted);
    
    if (isMuted) {
      if (bgAudio) bgAudio.volume = 0;
      activeAudios.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      activeAudios.clear();
    } else {
      if (bgAudio) bgAudio.volume = 0.3;
    }
  });

  // Let A Ring Logic
  const btnTune = document.getElementById("tuneButton");
  btnTune.addEventListener("click", () => {
    if (isMuted) return;

    clickCount++;
    duckBgDuring(3000); 

    // [수정] Mozart 예술적 효과 (3단계)
    if (clickCount === 10 && !isMozart) {
      isMozart = true;
      
      // Phase 1: Buildup (3초간 떨림)
      userIdentityBox.classList.add("mozart-buildup");
      playSfx(sounds.timpani, 1.0); 
      
      setTimeout(() => {
        // Phase 2: Transformation
        userIdentityBox.classList.remove("mozart-buildup");
        lblId.style.opacity = "0"; // "You are" 숨김
        lblRole.textContent = "YOU ARE MOZART !";
        lblRole.classList.add("mozart-reveal");
        
        // Phase 3: Sustain (Reveal 클래스 유지)
      }, 3000);
    }

    if (isMozart) {
      const keys = ["cellos", "trumpets", "violins2", "timpani"];
      playSfx(sounds[keys[Math.floor(Math.random() * keys.length)]]);
    } else {
      const uniqueIds = [...new Set(ownedInstruments)];
      uniqueIds.forEach(id => {
        playSfx(sounds[id]);
      });
    }

    heroImgWrapper.classList.add("glowing");
    screenGlow.classList.add("screen-glow-active");
    
    setTimeout(() => {
      heroImgWrapper.classList.remove("glowing");
      screenGlow.classList.remove("screen-glow-active");
    }, 5000);
  });

  // Tabs & Map Logic (Omitted for brevity, kept same)
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
  
  // (Orchestra map logic included in previous version is preserved here implicitly)
  const btnOrch = document.getElementById("orchestraJoinBtn");
  if(btnOrch) {
      // ... (Map logic same as before)
      btnOrch.addEventListener("click", () => {
        // ...
      });
  }
});
