document.addEventListener("DOMContentLoaded", () => {
  /* --- Global State --- */
  let bgAudio = null;
  let isMuted = false;
  let currentVoiceAudio = null; 
  
  // Instrument Setup
  const roles = [
    { id: "cellos", name: "Cellos", icon: "🎻" },
    { id: "trumpets", name: "Trumpets", icon: "🎺" },
    { id: "violins2", name: "Violins II", icon: "🎻" },
    { id: "timpani", name: "Timpani", icon: "🥁" }
  ];
  
  // Audio Paths
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
  let clickCount = 0;
  let isMozart = false;

  /* --- Utils --- */
  const playSfx = (path, vol = 1.0) => {
    if (isMuted) return null;
    const a = new Audio(path);
    a.volume = vol;
    a.play().catch(e => console.log("Audio play error:", e));
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
        if (isMuted) { clearInterval(fade); return; }
        v += 0.01;
        if (v >= 0.3) { v = 0.3; clearInterval(fade); }
        bgAudio.volume = v;
      }, 100);
    }).catch(e => console.log("BG play error:", e));
  };

  /* --- Scene Transition Logic --- */
  // 이 함수가 핵심입니다. 기존 CSS 클래스 의존도를 낮추고 직접 스타일을 제어합니다.
  const switchScene = (fromId, toId) => {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);

    // 1. 현재 씬 숨기기
    fromEl.style.display = "none";
    fromEl.classList.remove("scene-visible");

    // 2. 다음 씬 보이기
    toEl.style.display = "block";
    
    // 3. Prelude인 경우 5초 페이드인 효과 적용
    if (toId === "scene-prelude") {
      toEl.classList.add("fade-in-slow"); // CSS 애니메이션 적용
    } else {
      toEl.classList.add("scene-visible");
    }
  };

  /* --- Scene -1: Pre-intro --- */
  const btnTouch = document.getElementById("preintroTouchBtn");
  const btnRipple = document.getElementById("preintroRipple");
  const videoPre = document.getElementById("preintroVideo");
  
  btnTouch.addEventListener("click", () => {
    playSfx(sounds.timpani_sfx);
    playBgMusic();
    
    document.getElementById("preintroUi").style.display = "none";
    
    btnRipple.style.display = "block";
    setTimeout(() => btnRipple.classList.add("active"), 100);
  });

  btnRipple.addEventListener("click", () => {
    playSfx(sounds.timpani_sfx);
    btnRipple.classList.remove("active");
    
    // 비디오 필터를 제거해서 밝게 만듦 (3초 트랜지션)
    videoPre.classList.remove("dark-filter"); 
    videoPre.classList.add("video-bright");
    
    // 3초 뒤 씬 전환 (Pre-intro -> Prelude)
    setTimeout(() => {
      switchScene("scene-preintro", "scene-prelude");
    }, 3000);
  });

  /* --- Scene 0: Prelude --- */
  const zones = document.querySelectorAll(".prelude-language-btn");
  const dimLayer = document.getElementById("preludeDimLayer");
  let isInterrupting = false; 

  zones.forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (isInterrupting) return; 

      const lang = btn.dataset.lang;
      playSfx(sounds.timpani_sfx, 0.5);

      // Interrupt Logic
      if (currentVoiceAudio && !currentVoiceAudio.paused) {
        isInterrupting = true;
        currentVoiceAudio.pause(); 
        
        const intFile = lang === "en" ? sounds.int_en : sounds.int_de;
        const intAudio = playSfx(intFile, 1.0);
        
        if (intAudio) {
          intAudio.onended = () => { setTimeout(() => switchScene("scene-prelude", "scene-main"), 1000); initMain(); };
        } else {
          setTimeout(() => switchScene("scene-prelude", "scene-main"), 2000);
          initMain();
        }
        return;
      }

      // Normal Play Logic
      if (lang === "en") {
        dimLayer.classList.add("dim-right"); 
        document.querySelector('[data-lang="de"]').classList.add("fade-out");
      } else {
        dimLayer.classList.add("dim-left"); 
        document.querySelector('[data-lang="en"]').classList.add("fade-out");
      }

      if (bgAudio) bgAudio.volume = 0.05;

      const voiceFile = lang === "en" ? sounds.voice_en : sounds.voice_de;
      currentVoiceAudio = playSfx(voiceFile, 1.0);

      if (currentVoiceAudio) {
        currentVoiceAudio.onended = () => {
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
  
  const initMain = () => {
    // Random Instrument
    myRole = roles[Math.floor(Math.random() * roles.length)];
    lblRole.textContent = myRole.name;
    
    // Captions slider
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

  // Mute
  const btnMute = document.getElementById("musicToggle");
  btnMute.addEventListener("click", () => {
    isMuted = !isMuted;
    btnMute.classList.toggle("muted", isMuted);
    document.body.classList.toggle("muted-world", isMuted);
    
    if (bgAudio) bgAudio.volume = isMuted ? 0 : 0.3;
  });

  // Let A Ring
  const btnTune = document.getElementById("tuneButton");
  btnTune.addEventListener("click", () => {
    clickCount++;
    
    if (clickCount === 10 && !isMozart) {
      isMozart = true;
      lblRole.textContent = "MOZART";
      lblRole.classList.add("mozart");
      lblId.style.opacity = "0"; 
      playSfx(sounds.timpani, 1.0); 
    }

    let soundFile = sounds[myRole.id];
    if (isMozart) {
      const keys = ["cellos", "trumpets", "violins2", "timpani"];
      soundFile = sounds[keys[Math.floor(Math.random() * keys.length)]];
    }
    playSfx(soundFile);

    heroImgWrapper.classList.add("glowing");
    screenGlow.classList.add("screen-glow-active");
    
    setTimeout(() => {
      heroImgWrapper.classList.remove("glowing");
      screenGlow.classList.remove("screen-glow-active");
    }, 5000);
  });

  // Tabs
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

  // Orchestra Game (Mock)
  const btnOrch = document.getElementById("orchestraJoinBtn");
  const orchStatus = document.getElementById("harmonicsStatus");
  const radar = document.querySelector(".radar-circle");
  
  btnOrch.addEventListener("click", () => {
    btnOrch.textContent = "Searching...";
    setTimeout(() => {
      document.getElementById("orchestraMode").textContent = "Connected";
      orchStatus.textContent = "Trio formed";
      
      for(let i=0; i<3; i++) {
        const dot = document.createElement("div");
        dot.className = "radar-dot ghost";
        dot.style.top = (20 + Math.random()*60) + "%";
        dot.style.left = (20 + Math.random()*60) + "%";
        radar.appendChild(dot);
      }
    }, 2000);
  });

});