document.addEventListener("DOMContentLoaded", () => {
  /* --- Global State --- */
  let bgAudio = null;
  let isMuted = false;
  
  // Instrument Setup
  const roles = [
    { id: "cellos", name: "Cellos", icon: "🎻" },
    { id: "trumpets", name: "Trumpets", icon: "🎺" },
    { id: "violins2", name: "Violins II", icon: "🎻" },
    { id: "timpani", name: "Timpani", icon: "🥁" }
  ];
  
  // Audio Paths (Corrected from your list)
  const sounds = {
    cellos: "media/SI_Cac_fx_cellos_tuning_one_shot_imaginative.wav",
    trumpets: "media/SI_Cac_fx_trumpets_tuning_one_shot_growing.wav", // Using 'growing'
    violins2: "media/SI_Cac_fx_violins_tuning_one_shot_blooming.wav",
    timpani: "media/zoid_percussion_timpani_roll_A.wav",
    timpani_sfx: "media/TS_IFD_kick_timpani_heavy.wav",
    bg_music: "media/Serenade For Strings Op.48_2nd movt.wav",
    voice_de: "media/prelude_voice_de_male.mp3",
    voice_en: "media/prelude_voice_en_female.mp3"
  };

  let myRole = null;
  let clickCount = 0;
  let isMozart = false;

  /* --- Utils --- */
  const playSfx = (path, vol = 1.0) => {
    if (isMuted) return;
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
      // Fade in to 30%
      let v = 0;
      const fade = setInterval(() => {
        if (isMuted) { clearInterval(fade); return; }
        v += 0.01;
        if (v >= 0.3) { v = 0.3; clearInterval(fade); }
        bgAudio.volume = v;
      }, 100);
    }).catch(e => console.log("BG play error:", e));
  };

  /* --- Scene -1: Pre-intro --- */
  const btnTouch = document.getElementById("preintroTouchBtn");
  const btnRipple = document.getElementById("preintroRipple");
  const overlay = document.getElementById("preintroOverlay");
  const scenePre = document.getElementById("scene-preintro");
  
  btnTouch.addEventListener("click", () => {
    playSfx(sounds.timpani_sfx);
    playBgMusic();
    
    // Hide UI 1
    document.getElementById("preintroUi").style.display = "none";
    
    // Show UI 2 (Ripple)
    btnRipple.style.display = "block";
    setTimeout(() => btnRipple.classList.add("active"), 100);
  });

  btnRipple.addEventListener("click", () => {
    playSfx(sounds.timpani_sfx);
    btnRipple.classList.remove("active");
    
    // 3초 동안 서서히 밝아짐
    overlay.classList.add("preintro-overlay-clear"); // CSS transition 3s applied
    
    setTimeout(() => {
      scenePre.style.display = "none";
      document.getElementById("scene-prelude").style.display = "block";
    }, 3000);
  });

  /* --- Scene 0: Prelude --- */
  const zones = document.querySelectorAll(".prelude-language-btn");
  const dimLayer = document.getElementById("preludeDimLayer");
  
  zones.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const lang = btn.dataset.lang;
      
      // Interaction feedback
      playSfx(sounds.timpani_sfx, 0.5);
      
      // Dimming Logic (Rotated view: Top is Left, Bottom is Right)
      // EN is Top (Left visually), DE is Bottom (Right visually)
      if (lang === "en") {
        dimLayer.classList.add("dim-right"); // Dim the bottom (DE side)
      } else {
        dimLayer.classList.add("dim-left"); // Dim the top (EN side)
      }

      // Play Voice
      const voiceFile = lang === "en" ? sounds.voice_en : sounds.voice_de;
      const voiceAudio = playSfx(voiceFile, 1.0);
      
      // Duck BG music
      if (bgAudio) bgAudio.volume = 0.05;

      // Disable buttons
      zones.forEach(z => z.disabled = true);

      // Wait for end
      if (voiceAudio) {
        voiceAudio.onended = () => {
          if (bgAudio && !isMuted) bgAudio.volume = 0.3;
          setTimeout(goToMain, 2000); // 2s wait
        };
      } else {
        // Fallback if audio fails
        setTimeout(goToMain, 4000);
      }
    });
  });

  const goToMain = () => {
    document.getElementById("scene-prelude").style.display = "none";
    document.getElementById("scene-main").style.display = "block";
    initMain();
  };

  /* --- Scene 1: Main --- */
  const heroImgWrapper = document.getElementById("heroImageWrapper");
  const screenGlow = document.getElementById("screenGlow");
  const lblRole = document.getElementById("instrumentLabel");
  const lblId = document.getElementById("idLabel");
  
  const initMain = () => {
    // Random Instrument on Load
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
    
    // Mozart Egg
    if (clickCount === 10 && !isMozart) {
      isMozart = true;
      lblRole.textContent = "MOZART";
      lblRole.classList.add("mozart");
      // Hide "You are" label
      lblId.style.opacity = "0"; 
      playSfx(sounds.timpani, 1.0); // Big sound
    }

    // Play Sound
    let soundFile = sounds[myRole.id];
    if (isMozart) {
      // Random sound in Mozart mode
      const keys = ["cellos", "trumpets", "violins2", "timpani"];
      soundFile = sounds[keys[Math.floor(Math.random() * keys.length)]];
    }
    playSfx(soundFile);

    // Glow Effect (Border + Screen spread)
    heroImgWrapper.classList.add("glowing");
    screenGlow.classList.add("screen-glow-active");
    
    // Remove glow after 5s
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
    // Simulate finding people
    setTimeout(() => {
      document.getElementById("orchestraMode").textContent = "Connected";
      orchStatus.textContent = "Trio formed";
      
      // Add fake dots
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