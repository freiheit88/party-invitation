// --------------------------
// Preintro interaction
// --------------------------

function handlePreintroTap() {
  if (preintroHasTapped) return;
  preintroHasTapped = true;

  // no timpani here – just fade and music start

  // fade overlay
  if (preintroOverlay) {
    preintroOverlay.classList.add("preintro-overlay-clear");
  }
  if (preintroPopup) {
    preintroPopup.classList.add("preintro-popup-hidden");
  }

  if (preintroTouchBtn) {
    preintroTouchBtn.disabled = true;
  }

  startBackgroundMusicFromPreintro();

  // Immediately increase video brightness by 30%
  const preintroVideo = document.getElementById("preintroVideo");
  if (preintroVideo) {
    preintroVideo.style.filter = "brightness(1.3)";
  }

  // After brightness fade, show central ripple (requires second tap to continue)
  const rippleDelay = 1300;
  setTimeout(() => {
    if (preintroRipple) {
      preintroRipple.classList.add("preintro-ripple-active");
    }
  }, rippleDelay);
}

// ... (other code remains unchanged) ...

document.addEventListener("DOMContentLoaded", () => {
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

  // ... (remaining initialization code unchanged) ...
});
