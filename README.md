# Experion 

This project is a symptoms recognition paradigm created for fMRI. 

## What does this paradigm contain?

The paradigm contains the code for 3 runs with 28 trials per run (The content in terms of videos/images naming is provided by an Excel file; the trial sequencing and all timing (stimulus, ITI) is always driven by the optseq .par files)
The following screens are shown for each run: 

- Instruction screens shown once at the beginning of each run, followed by a fixation cross before the first trial
- Screen 1 (stimulus): Image or video of a given symptom
- Screen 2 (post-stimulus fixation): static fixation cross shown for 1 second between the stimulus and response screens
- Screen 3 (response): Response of either Yes I saw this symptom ("Si lo viste") / No I did not see this symptom ("No lo viste")
- Screen 4 (ITI): gray screen with fixation cross
- All data is logged (including onset times and ReactionTimes) and saved in a CSV format for each run for each participant

## Source Files Used

- Trial names, length of stimuli, response etc: Originally given by the excel file EXPERION_fMRI_stimulus_order_simulation.xlsx, can however be configurated using the config.txt file
- Videos copied into: assets/video_creta/
- Images copied into: assets/written_creta/
- Per-participant/run timing: optseq/Participant <PP>/experion_<PP>_<run>.par (regenerated to include the extra 1-second post-stimulus fixation cross in each stimulus event's duration)

## Run Instructions

1. Install dependencies:

```bash
npm install
```

2. Start the paradigm:

```bash
npm start
```

3. In the start screen, set participant/run and click Start.

## Configuration

Edit config-file.txt to change behavior.

Main fields:

- participantId: Here you set the participant Id (can be numerical or with letters)
- runNumber: Setting the run number to 1,2, or 3.
- instructionScreenDurationSec: Setting the duration of the instruction screens 
- postInstructionsFixationSec: Setting the duration of the Fixaction cross before first trial
- postStimulusFixationSec: Setting the duration of the static fixation cross shown between the stimulus screen and the response screen (default 1 second). This duration is subtracted from each .par event's duration, since the .par files already include it.
- instructionScreens: This is the exact text displayed on each screen. Each line is one screen.
- media.imageDurationSec: The written (image) symptoms 
- response.maxDurationSec: The maximum amount of time for response - however the screen will disappear with a delay of .5 seconds after pressing a button. This is just the maximum time participants have to answer. 
- response.yesLabel, response.noLabel: THe naming of the response buttons 
- iti.showFixationCross: whether the ITI screen displays a fixation cross
- optseq.folder: trial order and ITI timing always come from the matching .par file in this folder. 

## Output

Data are saved under:

- <Desktop>/Experion Output/<participantId>/Participant_<participantId>_Run<runNumber>.csv

Each saved trial row includes:

- stimulus file shown
- symptom status
- expected response
- given response
- expected/given alignment (TRUE or FALSE)
- stimulus onset
- response onset
- reaction time on the response screen

## Rebuild Trial Order From Excel

If the Excel order changes, regenerate JSON:

```bash
python3 tools/extract_trial_order_from_excel.py \
  --xlsx /Users/rosa/Downloads/EXPERION_fMRI_stimulus_order_simulation.xlsx \
  --out data/trial_order_from_excel.json
```

