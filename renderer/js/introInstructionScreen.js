window.onload = function () {
  const textField = document.getElementById('introInstructionText');
  const flowState = window.parent && window.parent.flowState ? window.parent.flowState : null;
  const introInstruction = flowState && flowState.introInstruction ? flowState.introInstruction : null;

  const text = introInstruction && introInstruction.text ? introInstruction.text : '';
  const timeoutMs = introInstruction && introInstruction.timeoutMs ? Number(introInstruction.timeoutMs) : 10000;

  textField.innerHTML = text;

  setTimeout(() => {
    if (window.parent && typeof window.parent.handleIntroInstructionDone === 'function') {
      window.parent.handleIntroInstructionDone();
    }
  }, timeoutMs);
};
