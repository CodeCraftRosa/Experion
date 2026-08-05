function done(actualDurationMs) {
  if (window.parent && typeof window.parent.handleStimulusDone === 'function') {
    window.parent.handleStimulusDone(actualDurationMs);
  }
}

window.onload = async function () {
  const root = document.getElementById('stimulusRoot');
  const flowState = window.parent && window.parent.flowState ? window.parent.flowState : null;
  if (!flowState || !flowState.currentStimulus) {
    done(0);
    return;
  }

  const s = flowState.currentStimulus;
  const startTs = performance.now();
  const remainingMsFromDeadline = () => (Number.isFinite(s.deadlineEpochMs)
    ? Math.max(0, s.deadlineEpochMs - Date.now())
    : s.timeoutMs);

  if (s.modality === 'video') {
    const video = document.createElement('video');
    video.className = 'media-video';
    video.src = s.src;
    video.autoplay = true;
    video.controls = false;
    video.muted = false;
    video.playsInline = true;
    root.appendChild(video);

    try {
      await video.play();
    } catch (_e) {
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done(performance.now() - startTs);
    };

    if (!s.enforceFullDuration) {
      video.addEventListener('ended', finish, { once: true });
    }
    setTimeout(finish, remainingMsFromDeadline());
    return;
  }

  const img = document.createElement('img');
  img.className = 'media-image';
  img.src = s.src;
  root.appendChild(img);

  setTimeout(() => {
    done(performance.now() - startTs);
  }, remainingMsFromDeadline());
};
