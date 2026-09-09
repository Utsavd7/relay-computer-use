"""Render the actual screen recording with local system speech and captions. No API."""
from pathlib import Path
import subprocess, json
folder=Path('work/demo');folder.mkdir(parents=True,exist_ok=True)
chapters=[
(0,10,'Relay turns a successful user interface workflow into a reusable capability. A model discovers the procedure. A deterministic engine runs it again.'),
(10,25,'Discovery uses a real local language model. It sees the current screen and chooses one permitted action at a time. The target is a live banking sandbox, with synthetic records.'),
(25,43,'The model searches for the member, opens the savings account, and reads the balance. The executor verifies the final screen and member identity. The successful procedure is then saved as a reusable capability.'),
(43,56,'The artifact has a clear contract: typed inputs, declared outputs, stable targets, and verified checkpoints. Review the steps, export runnable code, and validate replays before approving it.'),
(56,69,'Now replay the same capability for a different member. The engine follows the recorded rules and extracts the current balance from the live interface, with no model decisions.'),
(69,79,'A missing member returns a known business outcome. The caller receives useful information, rather than an automation crash or a misleading success.'),
(79,90,'An expired session pauses automation and requests intervention. The human receives the reason, current step, and control of the existing live session.'),
(90,100,'Restore the session, then return control. Automation resumes from the interrupted step and verifies the original checkpoint. The handoff is recorded.'),
(100,111,'The same capability also runs against a second institution. An explicit control name override handles the variation, while the workflow and result contract stay the same.'),
(111,120,'Every run produces redacted, inspectable evidence. Discover once. Replay with control. Explore the working product and its source repository.'),
]
for i,(start,end,text) in enumerate(chapters):
 p=folder/f'voice-{i}.txt';p.write_text(text)
 subprocess.run(['say','-v','Samantha','-r','165','-f',str(p),'-o',str(folder/f'voice-{i}.aiff')],check=True)
if not (folder/'source.webm').exists():
 print('Narration ready; run again after the screen recording completes.');raise SystemExit(0)
source_duration=float(json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-of','json',str(folder/'source.webm')]))['format']['duration'])
recorded_duration=json.loads((folder/'timing.json').read_text())['duration_ms']/1000
preroll=0  # Playwright starts at the first rendered frame; encoder shutdown adds a tail.
command=['ffmpeg','-y','-ss',str(preroll),'-i',str(folder/'source.webm')]
filters=[];streams=[]
for i,(start,end,_) in enumerate(chapters):
 audio=folder/f'voice-{i}.aiff';command+=['-i',str(audio)]
 duration=float(json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-of','json',str(audio)]))['format']['duration'])
 tempo=max(1,duration/(end-start-.3))
 filters.append(f'[{i+1}:a]atempo={tempo:.4f},adelay={start*1000}|{start*1000},apad=whole_dur=120[a{i}]');streams.append(f'[a{i}]')
filters.append(''.join(streams)+f'amix=inputs={len(chapters)}:normalize=0:duration=longest,alimiter=limit=0.95[audio]')
command+=['-filter_complex',';'.join(filters),'-map','0:v','-map','[audio]','-t','120','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','public/demo.mp4']
subprocess.run(command,check=True)
subprocess.run(['ffmpeg','-y','-ss','3','-i','public/demo.mp4','-frames:v','1','public/demo-poster.jpg'],check=True)
print('Rendered public/demo.mp4 (120 seconds).')
