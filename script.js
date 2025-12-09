// --------------------------
// DOMContentLoaded init (moved out of event listener)
// --------------------------

// Scene setup
showScene("scene-preintro");

// Preintro button
if (preintroTouchBtn) {
  preintroTouchBtn.addEventListener("click", handlePreintroTap);
}

// Preintro central ripple -> Prelude
if (preintroRipple) {
  preintroRipple.addEventListener("click", () => {
    leavePreintroToPrelude();
  });
}

// Prelude EN / DE zones -> interrupt TTS then Main
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
            pos.coords.latitude.toFixed(6) + ", " +
            pos.coords.longitude.toFixed(6);
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
