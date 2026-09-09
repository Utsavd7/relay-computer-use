"""Narrate the real screen recording with neural speech, natural pauses and matching captions.
Requires: pip install edge-tts; FFmpeg. Only the public script is sent to the speech service.
"""
from pathlib import Path
import asyncio, subprocess, json, argparse, textwrap
import edge_tts
folder=Path('work/demo'); folder.mkdir(parents=True,exist_ok=True)
chapters=[
(0.3,9.1,"Here's Relay. The idea is simple: let a model figure out a workflow once, then run it again without asking the model."),
(9.25,20.6,"Let's start with discovery. I'm asking a local model to find a member's savings balance. It reads the screen, chooses an allowed action, and checks what happens next."),
(20.75,34,"You can follow the steps here. Search for the member, open their account, then read the balance. Relay checks the member's identity and the final screen before it saves anything as a successful workflow."),
(34.15,45.5,"Here's what gets saved: a capability with inputs, outputs, and the exact steps to repeat. You can inspect it, export it, and test it before approving it."),
(45.65,57,"Now let's try a different member. Same capability, new input. The saved steps run against the actual interface. And here, you can see it used no model calls."),
(57.15,65.5,"What if the member doesn't exist? Relay returns a clear, known outcome. It doesn't crash, or pretend the task succeeded."),
(65.65,75.2,"Now the session has expired. Relay pauses and tells me where it stopped. I can take over this same session, with all the context still there."),
(75.35,84,"I'll restore the session and hand control back. Relay picks up from the interrupted step. The timeline keeps a record of that handoff."),
(84.15,93.7,"This also works with a second institution. The interface is slightly different, but an explicit override lets us reuse the same capability."),
(94,105,"And every run leaves evidence you can inspect. That's Relay: learn the workflow, keep the contract, and stay in control."),
]
voice='en-US-AndrewMultilingualNeural'
async def narrate():
 for i,(_,_,text) in enumerate(chapters):
  out=folder/f'neural-{i}.mp3'; saved=folder/f'neural-{i}.txt'
  if out.exists() and out.stat().st_size>1000 and saved.exists() and saved.read_text()==text: continue
  for attempt in range(3):
   try:
    await asyncio.wait_for(edge_tts.Communicate(text,voice,rate='-3%').save(str(out)),45)
    saved.write_text(text);break
   except Exception as error:
    if attempt==2:raise
    print(f'Retrying voice chapter {i+1}: {type(error).__name__}',flush=True)
    await asyncio.sleep(2)
  print(f'Voice chapter {i+1} ready',flush=True)
def duration(p):return float(json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-of','json',str(p)]))['format']['duration'])
def stamp(s):
 ms=round(s*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
asyncio.run(narrate())
args=argparse.ArgumentParser();args.add_argument('--audio-only',action='store_true');options=args.parse_args()
filters=[];streams=[];command=['ffmpeg','-y']
if not options.audio_only:
 if (folder/'capture.ffconcat').exists():command+=['-f','concat','-safe','0','-i',str(folder/'capture.ffconcat')]
 else:command+=['-i',str(folder/'source.webm')]
offset=0 if options.audio_only else 1
vtt=['WEBVTT',''];timings=[]
for i,(start,end,text) in enumerate(chapters):
 audio=folder/f'neural-{i}.mp3';command+=['-i',str(audio)];length=duration(audio)
 tempo=max(1,length/(end-start-.12))
 if tempo>1.18:raise ValueError(f'Chapter {i} is too long for natural delivery: {length}s. Shorten the script.')
 actual=length/tempo;timings.append({'chapter':i+1,'start':start,'duration':actual,'tempo':tempo})
 filters.append(f'[{i+offset}:a]atempo={tempo:.5f},afade=t=in:d=0.035,afade=t=out:st={max(0,actual-.07):.4f}:d=0.07,adelay={round(start*1000)}|{round(start*1000)},apad=whole_dur=105[a{i}]');streams.append(f'[a{i}]')
 # Sentence-length subtitles follow the spoken chapter without covering whole paragraphs.
 sentences=text.replace('? ', '?|').replace('. ', '.|').split('|');cursor=start;total=sum(len(s) for s in sentences)
 for sentence in sentences:
  finish=cursor+actual*len(sentence)/total
  vtt += [f'{stamp(cursor)} --> {stamp(finish)} line:82%','\n'.join(textwrap.wrap(sentence,70)),''];cursor=finish
filters.append(''.join(streams)+f'amix=inputs={len(chapters)}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=9[audio]')
command+=['-filter_complex',';'.join(filters)]
if not options.audio_only:command+=['-map','0:v']
command+=['-map','[audio]','-t','105']
if options.audio_only:command+=['-c:a','libmp3lame','-b:a','192k',str(folder/'narration.mp3')]
else:command+=['-c:v','libx264','-preset','medium','-crf','16','-r','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','public/demo.mp4']
subprocess.run(command,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
(folder/'narration-timing.json').write_text(json.dumps({'voice':voice,'chapters':timings},indent=2))
Path('public/demo.vtt').write_text('\n'.join(vtt))
print(json.dumps(timings,indent=2),flush=True)
