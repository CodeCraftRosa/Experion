window.onload = function () {
  const startButton = document.getElementById('startExperimentButton');
  startButton.onclick = () => {
    if (window.parent && typeof window.parent.handleInitScreenClick === 'function') {
      window.parent.handleInitScreenClick();
    }
  };
};
