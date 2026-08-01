#!/usr/bin/env python3
"""Extract CRETA trial order from the simulation Excel file into JSON.

Usage:
  python3 tools/extract_trial_order_from_excel.py \
      --xlsx /absolute/path/EXPERION_fMRI_stimulus_order_simulation.xlsx \
      --out data/trial_order_from_excel.json
"""

import argparse
import json
import zipfile
import xml.etree.ElementTree as ET

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def col_to_idx(col):
    n = 0
    for ch in col:
        if ch.isalpha():
            n = n * 26 + ord(ch.upper()) - 64
    return n - 1


def extract_trials(xlsx_path):
    with zipfile.ZipFile(xlsx_path) as zf:
        shared = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            sroot = ET.fromstring(zf.read('xl/sharedStrings.xml'))
            for si in sroot.findall('.//a:si', NS):
                txt = ''.join((t.text or '') for t in si.findall('.//a:t', NS))
                shared.append(txt)

        root = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in root.findall('.//a:sheetData/a:row', NS):
            vals = {}
            for c in row.findall('a:c', NS):
                ref = c.attrib.get('r', 'A1')
                col = ''.join(ch for ch in ref if ch.isalpha())
                idx = col_to_idx(col)
                t = c.attrib.get('t')
                v = c.find('a:v', NS)
                if v is None or v.text is None:
                    continue
                raw = v.text
                vals[idx] = shared[int(raw)] if t == 's' else raw
            if vals:
                rows.append(vals)

    trials = []
    for r in rows[3:]:
        trial_number = int(r.get(0, '0')) if str(r.get(0, '')).isdigit() else 0
        stimulus_file = r.get(1, '')
        if trial_number <= 0 or not stimulus_file:
            continue

        trials.append({
            'trial_number': trial_number,
            'stimulus_file': stimulus_file,
            'modality': r.get(2, ''),
            'symptom_code': r.get(3, ''),
            'base_symptom': r.get(4, ''),
            'symptom_status': r.get(5, ''),
            'expected_response': r.get(6, ''),
            'repetition_number': int(r.get(7, '0')) if str(r.get(7, '')).isdigit() else r.get(7, ''),
            'iti_sec': float(r.get(8, '0') or 0),
            'stimulus_duration_sec': float(r.get(9, '0') or 0),
            'response_window_sec': float(r.get(10, '0') or 0),
            'trial_total_sec': float(r.get(11, '0') or 0),
            'run': int(r.get(12, '0')) if str(r.get(12, '')).isdigit() else 1,
        })

    return trials


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--xlsx', required=True, help='Path to simulation xlsx file')
    parser.add_argument('--out', required=True, help='Output JSON path')
    args = parser.parse_args()

    trials = extract_trials(args.xlsx)
    payload = {'source_excel': args.xlsx, 'trials': trials}
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)

    print(f'Wrote {len(trials)} trials to {args.out}')


if __name__ == '__main__':
    main()
