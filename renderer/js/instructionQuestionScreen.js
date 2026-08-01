window.onload = function () {
  const textField = document.getElementById('instructionText');
  const question = window.parent && window.parent.blockDesign && window.parent.blockDesign.question
    ? window.parent.blockDesign.question
    : 'Empezando nueva tarea...';
  textField.textContent = question;
};

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 't') {
    if (window.parent && typeof window.parent.handleTriggerT === 'function') {
      window.parent.handleTriggerT();
    }
  }
});
