let completed = false;
let rtStart = 0;
let screenStart = 0;
let maxMs = 3000;
let yesKeys = ['y'];
let noKeys = ['b'];
let holdAfterResponseMs = 500;
let yesBtn = null;
let noBtn = null;
let timeoutId = null;

function finish(response, responseKey) {
  if (completed) return;
  completed = true;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  const rtMs = response ? (performance.now() - rtStart) : null;
  const screenDurationMs = performance.now() - screenStart;
  if (window.parent && typeof window.parent.handleResponseDone === 'function') {
    window.parent.handleResponseDone({ response, responseKey, rtMs, screenDurationMs });
  }
}

function markSelection(buttonEl) {
  if (!buttonEl) return;
  buttonEl.classList.add('selected');
  buttonEl.classList.add('pop');
}

function respond(value, key, buttonEl) {
  if (completed) return;
  markSelection(buttonEl);
  const elapsedMs = performance.now() - screenStart;
  const remainingMs = Math.max(0, maxMs - elapsedMs);
  const feedbackMs = Math.min(holdAfterResponseMs, remainingMs);
  setTimeout(() => finish(value, key), feedbackMs);
}

window.onload = function () {
  const flowState = window.parent && window.parent.flowState ? window.parent.flowState : null;
  const cfg = flowState && flowState.responseConfig ? flowState.responseConfig : null;

  const yesLabel = cfg && cfg.yesLabel ? cfg.yesLabel : 'Si lo viste';
  const noLabel = cfg && cfg.noLabel ? cfg.noLabel : 'No lo viste';
  const questionText = cfg && cfg.questionText ? cfg.questionText : 'Viste este sintoma?';
  maxMs = cfg && cfg.maxMs ? cfg.maxMs : 3000;
  // the .par schedule instead of pushing the following ITI later.
  if (cfg && Number.isFinite(cfg.deadlineEpochMs)) {
    maxMs = Math.max(0, cfg.deadlineEpochMs - Date.now());
  }
  holdAfterResponseMs = cfg && cfg.feedbackHoldMs ? cfg.feedbackHoldMs : 500;
  yesKeys = cfg && Array.isArray(cfg.yesKeys) ? cfg.yesKeys : ['y'];
  noKeys = cfg && Array.isArray(cfg.noKeys) ? cfg.noKeys : ['b'];

  document.getElementById('responseTitle').textContent = questionText;
  yesBtn = document.getElementById('yesBtn');
  noBtn = document.getElementById('noBtn');
  yesBtn.textContent = yesLabel;
  noBtn.textContent = noLabel;

  screenStart = performance.now();
  rtStart = performance.now();

  yesBtn.onclick = () => respond('yes', 'mouse_yes', yesBtn);
  noBtn.onclick = () => respond('no', 'mouse_no', noBtn);

  timeoutId = setTimeout(() => finish(null, null), maxMs);
};

document.addEventListener('keydown', (event) => {
  const key = event.key;
  const keyLower = String(key).toLowerCase();
  if (yesKeys.includes(key) || yesKeys.includes(keyLower)) {
    respond('yes', keyLower, yesBtn);
  } else if (noKeys.includes(key) || noKeys.includes(keyLower)) {
    respond('no', keyLower, noBtn);
  }
});
