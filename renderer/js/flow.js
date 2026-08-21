const contentWindow = document.getElementById('contentWindow');

const runtime = {
  config: null,
  trialOrder: [],
  runTrials: [],
  startedAt: null,
  isRunning: false,
  instructionResolver: null,
  stimulusResolver: null,
  responseResolver: null,
  participantId: '',
  runNumber: 1,
  outputRoot: '',
  outBase: '',
  isFinishing: false,
  trialsScheduleBaseMs: null
};

const trialLog = [];

window.blockDesign = {
  question: 'Empezando nueva tarea...'
};

window.flowState = {
  currentStimulus: null,
  introInstruction: null,
  responseConfig: null,
  showFixationCross: true
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function msFromStart() {
  if (runtime.startedAt === null) return 0;
  return Date.now() - runtime.startedAt;
}

function sleepUntilOffset(targetOffsetMs) {
  if (!Number.isFinite(targetOffsetMs)) return Promise.resolve();
  const remaining = targetOffsetMs - msFromStart();
  return sleep(Math.max(0, remaining));
}

function scheduledOffsetMs(scheduledSec) {
  return Number.isFinite(scheduledSec) ? scheduledSec * 1000 + runtime.trialsScheduleBaseMs : null;
}

function scheduledDeadlineMs(scheduledSec) {
  const offsetMs = scheduledOffsetMs(scheduledSec);
  return Number.isFinite(offsetMs) ? runtime.startedAt + offsetMs : null;
}

function sanitizeFilePart(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const out = [headers.join(',')];
  for (const row of rows) {
    const line = headers
      .map((h) => {
        const raw = row[h] === undefined || row[h] === null ? '' : String(row[h]);
        return `"${raw.replace(/"/g, '""')}"`;
      })
      .join(',');
    out.push(line);
  }
  return out.join('\n');
}

function normalizeExpectedResponse(value) {
  return String(value || '').trim().toLowerCase() === 'yes' ? 'yes' : 'no';
}

function getResponseWindowSec(trial) {
  return Number(trial.response_window_sec || runtime.config.response.maxDurationSec || 3);
}

function getRunCsvPath() {
  const participantPart = sanitizeFilePart(runtime.participantId);
  const runPart = String(runtime.runNumber);
  return `${runtime.outBase}/Participant_${participantPart}_Run${runPart}.csv`;
}

function buildRunCsvContent() {
  const csv = toCsv(trialLog);
  const timestamp = new Date().toISOString();
  const totalDurationSec = (msFromStart() / 1000).toFixed(2);
  const summaryLines = `Timestamp,${timestamp}\nTotal Duration (s),${totalDurationSec}`;
  return csv ? `${csv}\n\n${summaryLines}` : summaryLines;
}

function setOuterFrameStimulusMode(isStimulusScreen) {
  if (!document.body) return;
  document.body.classList.toggle('stimulus-outer-black', Boolean(isStimulusScreen));
}

function selectRunTrials() {
  runtime.runTrials = runtime.trialOrder.filter((t) => Number(t.run) === Number(runtime.runNumber));
  if (!runtime.runTrials.length) {
    throw new Error(`No trials found for run ${runtime.runNumber}.`);
  }
}

function getParFilePath() {
  const optseqConfig = runtime.config.optseq || {};
  const folder = optseqConfig.folder || 'optseq';
  const pStr = String(runtime.participantId).trim().padStart(2, '0');
  return `${folder}/Participant ${pStr}/experion_${pStr}_${runtime.runNumber}.par`;
}

function parsePar(text) {
  const events = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const onsetSec = Number(parts[0]);
    const eventCode = Number(parts[1]);
    const duration = Number(parts[2]);
    if (!Number.isFinite(eventCode) || !Number.isFinite(duration)) continue;
    events.push({ onsetSec: Number.isFinite(onsetSec) ? onsetSec : null, eventCode, duration });
  }
  return events;
}

function buildParDrivenRunTrials(runTrials, parEvents) {
  const writtenQueue = runTrials.filter((t) => t.modality === 'written').slice();
  const videoQueue = runTrials.filter((t) => t.modality === 'video').slice();
  const ordered = [];
  const addSec = (base, add) => (base !== null ? base + add : null);
  let lastTrial = null;

  for (const event of parEvents) {
    if (event.eventCode === 1 || event.eventCode === 2) {
      const isVideo = event.eventCode === 2;
      const queue = isVideo ? videoQueue : writtenQueue;
      const trial = queue.shift();
      if (!trial) {
        throw new Error(
          `Par file has more ${isVideo ? 'videostim' : 'imagestim'} events than available ${isVideo ? 'video' : 'written'} trials for run ${runtime.runNumber}.`
        );
      }
      const responseWindowSec = getResponseWindowSec(trial);
      const postStimulusFixationSec = Number(runtime.config.postStimulusFixationSec || 0);
      const stimulusDurationSec = Math.max(0, event.duration - responseWindowSec - postStimulusFixationSec);
      const stimEndSec = addSec(event.onsetSec, stimulusDurationSec);
      const fixationEndSec = addSec(stimEndSec, postStimulusFixationSec);
      const responseEndSec = addSec(event.onsetSec, event.duration);
      lastTrial = {
        ...trial,
        stimulus_duration_sec: stimulusDurationSec,
        iti_sec: 0,
        _scheduledStimEndSec: stimEndSec,
        _scheduledFixationEndSec: fixationEndSec,
        _scheduledResponseEndSec: responseEndSec,
        _scheduledItiEndSec: null
      };
      ordered.push(lastTrial);
    } else if (lastTrial) {
      lastTrial.iti_sec = event.duration;
      lastTrial._scheduledItiEndSec = Number.isFinite(lastTrial._scheduledResponseEndSec)
        ? lastTrial._scheduledResponseEndSec + event.duration
        : null;
    }
  }

  if (writtenQueue.length || videoQueue.length) {
    throw new Error(
      `Par file for run ${runtime.runNumber} did not use all trials (leftover written=${writtenQueue.length}, video=${videoQueue.length}).`
    );
  }

  return ordered;
}

async function applyOptseqTiming() {
  const parPath = getParFilePath();
  const parText = await window.electronAPI.readText(parPath);
  const parEvents = parsePar(parText);
  runtime.runTrials = buildParDrivenRunTrials(runtime.runTrials, parEvents);
}

function resolveVideoFileName(stimulusFile) {
  const file = String(stimulusFile || '');
  if (file.toLowerCase().startsWith('creta_video_')) {
    return file.replace(/^creta_video_/i, 'creta_act_');
  }
  return file;
}

async function showStimulus(trial) {
  return new Promise((resolve) => {
    let onsetMs = 0;
    runtime.stimulusResolver = (mediaData) => resolve({ onsetMs, ...mediaData });
    setOuterFrameStimulusMode(true);
    const trialStimulusMs = Number(trial.stimulus_duration_sec || runtime.config.media.imageDurationSec || 5) * 1000;
    const deadlineMs = scheduledDeadlineMs(trial._scheduledStimEndSec);

    if (trial.modality === 'video') {
      const videoFile = resolveVideoFileName(trial.stimulus_file);
      window.flowState.currentStimulus = {
        modality: 'video',
        src: `../../${runtime.config.media.videoFolder}/${videoFile}`,
        timeoutMs: trialStimulusMs,
        deadlineEpochMs: deadlineMs,
        enforceFullDuration: true
      };
    } else {
      window.flowState.currentStimulus = {
        modality: 'written',
        src: `../../${runtime.config.media.imageFolder}/${trial.stimulus_file}`,
        timeoutMs: trialStimulusMs,
        deadlineEpochMs: deadlineMs
      };
    }

    onsetMs = msFromStart();
    contentWindow.src = '../html/stimulusScreen.html';
  });
}

async function showIntroInstruction(text, timeoutMs = 10000) {
  return new Promise((resolve) => {
    runtime.instructionResolver = resolve;
    setOuterFrameStimulusMode(false);
    window.flowState.introInstruction = {
      text,
      timeoutMs
    };
    contentWindow.src = '../html/introInstructionScreen.html';
  });
}

async function showResponse(trial) {
  setOuterFrameStimulusMode(false);
  const responseWindowMs = getResponseWindowSec(trial) * 1000;
  const deadlineMs = scheduledDeadlineMs(trial._scheduledResponseEndSec);

  return new Promise((resolve) => {
    let onsetMs = 0;
    runtime.responseResolver = (responseData) => {
      resolve({
        onsetMs,
        response: responseData.response,
        rtMs: responseData.rtMs,
        screenDurationMs: responseData.screenDurationMs,
        maxMs: responseWindowMs
      });
    };
    window.flowState.responseConfig = {
      questionText: 'Viste este sintoma?',
      yesLabel: runtime.config.response.yesLabel,
      noLabel: runtime.config.response.noLabel,
      maxMs: responseWindowMs,
      deadlineEpochMs: deadlineMs,
      yesKeys: runtime.config.response.yesKeys || ['b'],
      noKeys: runtime.config.response.noKeys || ['y']
    };
    onsetMs = msFromStart();
    contentWindow.src = '../html/responseScreen.html';
  });
}

async function showGrayScreen(durationSec, scheduledEndOffsetMs, showCross) {
  setOuterFrameStimulusMode(false);
  window.flowState.showFixationCross = showCross;
  contentWindow.src = '../html/itiScreen.html';
  if (Number.isFinite(scheduledEndOffsetMs)) {
    await sleepUntilOffset(scheduledEndOffsetMs);
  } else {
    await sleep(Math.max(0, Number(durationSec) || 0) * 1000);
  }
}

async function showIti(trial, extraFromResponseSec = 0) {
  const itiSec = Number(trial.iti_sec || 0) + Math.max(0, Number(extraFromResponseSec) || 0);
  const showCross = runtime.config.iti.showFixationCross !== false;
  await showGrayScreen(itiSec, scheduledOffsetMs(trial._scheduledItiEndSec), showCross);
}

async function showFixationCross(durationSec, scheduledEndOffsetMs = null) {
  await showGrayScreen(durationSec, scheduledEndOffsetMs, true);
}

async function finishRun() {
  if (runtime.isFinishing) return;
  runtime.isFinishing = true;
  setOuterFrameStimulusMode(false);
  const csvPath = getRunCsvPath();

  await window.electronAPI.saveText(csvPath, buildRunCsvContent());

  contentWindow.src = '../html/endScreen.html';
  runtime.isRunning = false;
}

async function runExperimentFlow() {
  trialLog.length = 0;
  runtime.startedAt = Date.now();

  const introScreens = Array.isArray(runtime.config.instructionScreens)
    ? runtime.config.instructionScreens.filter((text) => typeof text === 'string' && text.trim().length > 0)
    : [];
  const introScreenDurationMs = Number(runtime.config.instructionScreenDurationSec || 10) * 1000;

  for (const screenText of introScreens) {
    await showIntroInstruction(screenText, introScreenDurationMs);
  }

  const postInstructionsFixationSec = Number(runtime.config.postInstructionsFixationSec || 0);
  if (postInstructionsFixationSec > 0) {
    await showFixationCross(postInstructionsFixationSec);
  }

  const postStimulusFixationSec = Number(runtime.config.postStimulusFixationSec || 0);
  runtime.trialsScheduleBaseMs = msFromStart();

  for (let i = 0; i < runtime.runTrials.length; i += 1) {
    const trial = runtime.runTrials[i];
    const stimulusData = await showStimulus(trial);
    if (postStimulusFixationSec > 0) {
      await showFixationCross(postStimulusFixationSec, scheduledOffsetMs(trial._scheduledFixationEndSec));
    }
    const responseData = await showResponse(trial);
    const expectedResponse = normalizeExpectedResponse(trial.expected_response);
    const givenResponse = responseData.response || '';
    const isAligned = givenResponse && givenResponse === expectedResponse;

    const maxResponseMs = Number(responseData.maxMs);
    const responseScreenDurationMs = Math.min(
      maxResponseMs,
      Math.max(0, Number(responseData.screenDurationMs || maxResponseMs))
    );
    const leftoverResponseSec = Math.max(0, (maxResponseMs - responseScreenDurationMs) / 1000);

    await showIti(trial, leftoverResponseSec);

    trialLog.push({
      stimulus_file: trial.stimulus_file,
      symptom_status: trial.symptom_status,
      expected_response: expectedResponse,
      given_response: givenResponse,
      expected_given_aligned: isAligned ? 'TRUE' : 'FALSE',
      stimulus_onset_ms: stimulusData.onsetMs.toFixed(2),
      stimulus_duration_ms: Number(stimulusData.actualDurationMs || 0).toFixed(2),
      response_onset_ms: responseData.onsetMs.toFixed(2),
      response_duration_ms: responseScreenDurationMs.toFixed(2),
      response_rt_ms: responseData.rtMs !== null && responseData.rtMs !== undefined ? Number(responseData.rtMs).toFixed(2) : ''
    });
  }

  await finishRun();
}

window.handleInitScreenClick = function () {
  if (runtime.isRunning) return;
  setOuterFrameStimulusMode(false);
  contentWindow.src = '../html/instructionQuestionScreen.html';
};

window.handleTriggerT = function () {
  if (runtime.isRunning) return;
  runtime.isRunning = true;
  runExperimentFlow().catch(async (err) => {
    if (trialLog.length && runtime.outBase) {
      try {
        await window.electronAPI.saveText(getRunCsvPath(), buildRunCsvContent());
      } catch (_saveErr) {
      }
    }
    runtime.isRunning = false;
    alert(`Error while running paradigm: ${err.message}`);
    contentWindow.src = '../html/initializationButtonScreen.html';
  });
};

window.handleStimulusDone = function (actualDurationMs) {
  if (!runtime.stimulusResolver) return;
  const resolve = runtime.stimulusResolver;
  runtime.stimulusResolver = null;
  resolve({ actualDurationMs });
};

window.handleIntroInstructionDone = function () {
  if (!runtime.instructionResolver) return;
  const resolve = runtime.instructionResolver;
  runtime.instructionResolver = null;
  resolve();
};

window.handleResponseDone = function ({ response, rtMs, screenDurationMs }) {
  if (!runtime.responseResolver) return;
  const resolve = runtime.responseResolver;
  runtime.responseResolver = null;
  resolve({ response, rtMs, screenDurationMs });
};

window.goToInitScreen = function () {
  setOuterFrameStimulusMode(false);
  contentWindow.src = '../html/initializationButtonScreen.html';
};

window.addEventListener('beforeunload', () => {
  if (!runtime.isRunning || !trialLog.length || !runtime.outBase) return;
  const csvPath = getRunCsvPath();
  window.electronAPI.ensureDirSync(runtime.outBase);
  window.electronAPI.saveTextSync(csvPath, buildRunCsvContent());
});

async function init() {
  setOuterFrameStimulusMode(false);
  runtime.config = await window.electronAPI.readJson('config-file.txt');
  const order = await window.electronAPI.readJson(runtime.config.trialOrderFile);
  runtime.trialOrder = order.trials;

  runtime.participantId = runtime.config.participantId;
  runtime.runNumber = Number(runtime.config.runNumber || 1);

  runtime.outputRoot = await window.electronAPI.getOutputBaseDir();
  const participantFolder = sanitizeFilePart(runtime.participantId);
  runtime.outBase = `${runtime.outputRoot}/${participantFolder}`;
  await window.electronAPI.ensureDir(runtime.outBase);

  selectRunTrials();
  await applyOptseqTiming();
  contentWindow.src = '../html/initializationButtonScreen.html';
}

init().catch((err) => {
  alert(`Failed to initialize paradigm: ${err.message}`);
});
