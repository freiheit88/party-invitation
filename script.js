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
  let activeAudios = new Set(); // 현재 재생 중인 오디오 추적

  /* --- Utils --- */
  
  const playSfx = (path, vol = 1.0) => {
    // Mute 상태면 아예 재생하지 않음
    if (isMuted) return null;
    
    const a = new Audio(path);
    a.volume = vol;
    a.play().catch(e => console.log("Audio play error:", e));
    
    // 활성 오디오 목록에 추가 (나중에 Mute 누르면 끄기 위해)
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

  /* --- Scene Transition Logic --- */
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

  // Mute Logic (Updated to kill all sound immediately)
  const btnMute = document.getElementById("musicToggle");
  btnMute.addEventListener("click", () => {
    isMuted = !isMuted;
    btnMute.classList.toggle("muted", isMuted);
    document.body.classList.toggle("muted-world", isMuted);
    
    if (isMuted) {
      if (bgAudio) bgAudio.volume = 0;
      // 재생 중인 모든 효과음 즉시 정지
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
    
    if (clickCount === 10 && !isMozart) {
      isMozart = true;
      // "You are" 라벨 흐리게 처리
      lblId.style.opacity = "0"; 
      playSfx(sounds.timpani, 1.0); 
      
      // 3초 대기 후 텍스트 변경
      setTimeout(() => {
        lblRole.textContent = "MOZART";
        lblRole.classList.add("mozart");
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

  // --- Orchestra Game (Real GPS) ---
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
          ownedInstruments.push(g.roleId); 
          
          playSfx(sounds.timpani_sfx); 
          ghostMarkers[idx].setIcon(L.divIcon({
            className: 'custom-pin',
            html: `<div style="font-size:20px;">🎻</div>`, 
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          }));
          
          updateIcons();
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
