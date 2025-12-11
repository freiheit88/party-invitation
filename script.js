document.addEventListener("DOMContentLoaded", () => {
  /* --- Global State --- */
  let bgAudio = null;
  let isMuted = false;
  let currentVoiceAudio = null; 
  
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
  
  const activeAudios = new Set();

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
        if (isMuted) { clearInterval(fade); return; }
        v += 0.01;
        if (v >= 0.3) { v = 0.3; clearInterval(fade); }
        bgAudio.volume = v;
      }, 100);
    }).catch(e => console.log("BG play error:", e));
  };

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(50);
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
    
    if (toId === "scene-main") {
      setTimeout(() => {
        if(map) map.invalidateSize();
        initParallax(); 
        resetIdleTimer(); 
        initShakeDetection(); 
        
        // 메인 진입 시 배경 블러 처리 후 팝업
        document.getElementById("popupBackdrop").classList.add("visible");
        startIntroSlider(); 
      }, 100);
    }
  };

  /* --- Intro Slider Logic --- */
  const startIntroSlider = () => {
    const popup = document.getElementById("introSlider");
    const track = document.getElementById("sliderTrack");
    const dots = document.querySelectorAll(".dot");
    const closeBtn = document.getElementById("closeSlider");
    
    setTimeout(() => popup.classList.add("show"), 500);

    let slideIndex = 0;
    const totalSlides = 3;
    let sliderTimer = null;
    
    const nextSlide = () => {
      slideIndex = (slideIndex + 1) % totalSlides; 
      track.style.transform = `translateX(-${slideIndex * 33.33}%)`;
      dots.forEach((d, i) => d.classList.toggle("active", i === slideIndex));
      
      if (slideIndex === 0) closeBtn.classList.add("visible");
    };

    sliderTimer = setInterval(nextSlide, 4000); 

    closeBtn.addEventListener("click", () => {
      popup.classList.remove("show");
      document.getElementById("popupBackdrop").classList.remove("visible"); // 배경 블러 제거
      clearInterval(sliderTimer);
    });
  };

  /* --- Scene -1: Pre-intro --- */
  const btnTouch = document.getElementById("preintroTouchBtn");
  const btnRipple = document.getElementById("preintroRipple");
  const videoPre = document.getElementById("preintroVideo");
  const overlay = document.getElementById("preintroOverlay");
  
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
    btnRipple.classList.add("hidden"); 
    videoPre.classList.remove("dark-filter"); 
    videoPre.classList.add("video-bright");
    overlay.classList.add("preintro-overlay-clear");
    setTimeout(() => switchScene("scene-preintro", "scene-prelude"), 3000);
  });

  /* --- Scene 0: Prelude --- */
  const zones = document.querySelectorAll(".prelude-language-btn");
  const dimLayer = document.getElementById("preludeDimLayer");
  const statusText = document.getElementById("preludeStatus");
  let isInterrupting = false; 

  zones.forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (isInterrupting) return; 

      const lang = btn.dataset.lang;
      playSfx(sounds.timpani_sfx, 0.5);

      statusText.textContent = lang === "en" ? "Dressing in English..." : "Deutsche Sprache wird angelegt...";
      statusText.classList.add("show");

      if (currentVoiceAudio && !currentVoiceAudio.paused) {
        isInterrupting = true;
        currentVoiceAudio.pause(); 
        
        statusText.innerHTML = "Whoops!<br>Changing outfit!";
        statusText.classList.remove("status-talk");
        statusText.classList.add("status-panic"); 
        
        const intFile = lang === "en" ? sounds.int_en : sounds.int_de;
        const intAudio = playSfx(intFile, 1.0);
        
        setTimeout(() => {
           statusText.classList.remove("status-panic");
           statusText.classList.add("status-talk");
        }, 2000);

        if (intAudio) {
          intAudio.onended = () => { setTimeout(() => switchScene("scene-prelude", "scene-main"), 1000); initMain(); };
        } else {
          setTimeout(() => switchScene("scene-prelude", "scene-main"), 4000);
          initMain();
        }
        return;
      }

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
          statusText.textContent = "Welcome.";
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
  const tuneIconsContainer = document.getElementById("tuneIcons");
  
  const initMain = () => {
    myRole = roles[Math.floor(Math.random() * roles.length)];
    lblRole.textContent = myRole.name;
    ownedInstruments = [myRole.id]; 
    renderIcons();
    
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

  const renderIcons = () => {
    tuneIconsContainer.innerHTML = "";
    roles.forEach(role => {
      const isOwned = ownedInstruments.includes(role.id);
      const span = document.createElement("span");
      span.className = `slot-icon ${isOwned ? "owned" : ""}`;
      span.textContent = role.icon;
      tuneIconsContainer.appendChild(span);
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
      activeAudios.forEach(a => a.volume = 0); 
    } else {
      if (bgAudio) bgAudio.volume = 0.3;
      activeAudios.forEach(a => a.volume = 1.0);
    }
  });

  // Let A Ring
  const btnTune = document.getElementById("tuneButton");
  btnTune.addEventListener("click", () => {
    if (isMuted) return; 

    clickCount++;
    triggerHaptic(); 
    
    if (clickCount === 10 && !isMozart) {
      isMozart = true;
      
      lblRole.classList.add("shaking");
      
      setTimeout(() => {
        lblRole.classList.remove("shaking");
        lblRole.textContent = "";
        lblRole.classList.add("mozart");
        
        const target = "MOZART";
        let i = 0;
        const typer = setInterval(() => {
          lblRole.textContent += target.charAt(i);
          i++;
          if(i >= target.length) clearInterval(typer);
        }, 200); 
        
        // lblId 색상은 CSS에서 변경됨 (Gold)
        playSfx(sounds.timpani, 1.0); 
      }, 3000);
    }

    if (isMozart) {
      const keys = ["cellos", "trumpets", "violins2", "timpani"];
      const rKey = keys[Math.floor(Math.random() * keys.length)];
      playSfx(sounds[rKey]);
      
      if(!ownedInstruments.includes(rKey)) {
         ownedInstruments.push(rKey); 
         renderIcons();
      }
    } else {
      ownedInstruments.forEach(id => {
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

  // Tabs
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Orchestra 탭 예고 팝업
      if (btn.dataset.tab === "orchestra") {
        const toast = document.getElementById("orchestraToast");
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
      }

      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  /* --- Genius Interactions --- */
  const initParallax = () => {
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", (event) => {
        if (!heroImgWrapper) return;
        const tiltX = event.gamma; 
        const tiltY = event.beta;  
        const moveX = tiltX / 4;
        const moveY = tiltY / 4;
        heroImgWrapper.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }, true);
    }
  };

  let idleTimer;
  const breathingLayer = document.getElementById("breathingLayer");
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    if(breathingLayer) breathingLayer.classList.remove("active");
    idleTimer = setTimeout(() => {
      if(breathingLayer) breathingLayer.classList.add("active");
    }, 5000);
  };
  ['mousemove', 'touchstart', 'click', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer);
  });

  const initShakeDetection = () => {
    let lastX = 0, lastY = 0, lastZ = 0;
    window.addEventListener('devicemotion', (event) => {
      if (ownedInstruments.length < 2 || isMuted) return;
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const deltaX = Math.abs(acc.x - lastX);
      const deltaY = Math.abs(acc.y - lastY);
      const deltaZ = Math.abs(acc.z - lastZ);

      if (deltaX + deltaY + deltaZ > 30) { 
        triggerHaptic();
        ownedInstruments.forEach(id => playSfx(sounds[id]));
        screenGlow.classList.add("screen-glow-active");
        setTimeout(() => screenGlow.classList.remove("screen-glow-active"), 2000);
      }
      lastX = acc.x; lastY = acc.y; lastZ = acc.z;
    });
  };

  /* --- Orchestra Game --- */
  const btnOrch = document.getElementById("orchestraJoinBtn");
  const orchStatus = document.getElementById("harmonicsStatus");
  const gpsStatus = document.getElementById("gpsStatus");
  let map = null;
  let myMarker = null;
  let ghostMarkers = [];
  let ghosts = [];

  const generateGhosts = (centerLat, centerLng) => {
    const ghostRoles = ["cellos", "trumpets", "violins2", "timpani"];
    for(let i=0; i<20; i++) {
      const latOffset = (Math.random() - 0.5) * 0.001; 
      const lngOffset = (Math.random() - 0.5) * 0.001;
      const roleId = ghostRoles[Math.floor(Math.random() * ghostRoles.length)];
      ghosts.push({
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset,
        roleId: roleId,
        collected: false
      });
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  btnOrch.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported");
      return;
    }
    btnOrch.textContent = "Scanning...";
    navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      gpsStatus.textContent = `Active (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      btnOrch.style.display = "none";

      if (!map) {
        map = L.map('map').setView([lat, lng], 18);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        const myIcon = L.divIcon({
          className: 'custom-pin',
          html: '<div style="font-size:20px;">😊</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        myMarker = L.marker([lat, lng], {icon: myIcon}).addTo(map);

        generateGhosts(lat, lng);
        
        ghosts.forEach((g, idx) => {
          const roleIcon = roles.find(r => r.id === g.roleId).icon;
          const ghostIcon = L.divIcon({
            className: 'custom-pin',
            html: `<div style="font-size:15px; opacity:0.6;">👻</div>`,
            iconSize: [15, 15],
            iconAnchor: [7, 7]
          });
          const marker = L.marker([g.lat, g.lng], {icon: ghostIcon}).addTo(map);
          ghostMarkers[idx] = marker;
        });
      } else {
        myMarker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
      }

      let nearbyCount = 0;
      ghosts.forEach((g, idx) => {
        const dist = getDistance(lat, lng, g.lat, g.lng);
        
        if (dist < 5 && !g.collected) {
          g.collected = true;
          if(!ownedInstruments.includes(g.roleId)) {
             ownedInstruments.push(g.roleId); 
             renderIcons();
          }
          
          playSfx(sounds.timpani_sfx);
          triggerHaptic(); 
          
          const roleIcon = roles.find(r => r.id === g.roleId).icon;
          ghostMarkers[idx].setIcon(L.divIcon({
            className: 'custom-pin',
            html: `<div style="font-size:20px; text-shadow:0 0 10px yellow;">${roleIcon}</div>`, 
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          }));
        }
        if (g.collected) nearbyCount++;
      });
      orchStatus.textContent = `Ensemble: ${nearbyCount + 1} players`;
    }, (error) => {
      console.log("Geo error:", error);
      gpsStatus.textContent = "Error";
    }, {
      enableHighAccuracy: true,
      maximumAge: 0
    });
  });

});