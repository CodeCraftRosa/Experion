window.onload = function () {
  const flowState = window.parent && window.parent.flowState ? window.parent.flowState : null;
  const showFixation = !flowState || flowState.showFixationCross !== false;
  const fixation = document.getElementById('fixation');
  fixation.textContent = showFixation ? '+' : '';
};
