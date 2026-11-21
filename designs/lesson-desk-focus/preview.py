"""Assemble the 12.75-second design test. The first two shots are real photo references."""
from pathlib import Path
import subprocess
import wave
import numpy as np

root = Path(__file__).resolve().parent
work = root / 'work'
rate = 48000
duration = 12.75
clock = np.arange(round(rate * duration)) / rate
random = np.random.default_rng(120)
noise = random.standard_normal(len(clock))
fan = np.convolve(noise, np.ones(80) / 80, mode='same') * .055
fan += .01 * np.sin(2*np.pi*71*clock) + .004*np.sin(2*np.pi*142*clock)
fan *= np.interp(clock, [0,.45,2.97,3.25,5.25,7,12.75], [0,.65,.65,1.5,1.5,.23,0])
mix = np.repeat(fan[:,None],2,axis=1)
def tap(at,frequency,volume,pan):
    n=round(.12*rate)
    t=np.arange(n)/rate
    hit=(np.sin(2*np.pi*frequency*t)*.48 + random.standard_normal(n)*.21)*np.exp(-t*78)*volume
    start=round(at*rate)
    mix[start:start+n]+=hit[:,None]*[1-pan,pan]
for at,f,v,p in [(2.96,310,.36,.6),(5.56,660,.28,.45),(6.15,680,.13,.47),(6.43,710,.11,.52),(7.96,480,.19,.65),(12.16,850,.32,.58)]:
    tap(at,f,v,p)
song=root.parent/'lesson-desk-film'/'assets'/'tobu-hope-full.mp3'
raw=subprocess.check_output(['ffmpeg','-v','error','-ss','51.2','-i',str(song),'-t','7.75','-ar',str(rate),'-ac','2','-f','f32le','-'])
music=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
pos=5*rate
music=music[:len(mix)-pos]
gain=np.interp(clock[pos:pos+len(music)],[5,5.55,7.4,11.8,12.75],[0,.21,.33,.31,0])
mix[pos:pos+len(music)]+=music*gain[:,None]
with wave.open(str(work/'study.wav'),'wb') as f:
    f.setparams((2,2,rate,len(clock),'NONE',''))
    f.writeframes((np.clip(mix,-.98,.98)*32767).astype('<i2').tobytes())

def run(args):
    subprocess.run(['ffmpeg','-v','error','-y',*args],check=True)

def photographic(name, crop, frames, step, x, y):
    vf=(crop+",scale=2400:-2,zoompan=z='1+on*"+step+"':x='"+x+"':y='"+y+
        "':d="+str(frames)+":s=960x540:fps=24,eq=saturation=.86,format=yuv420p")
    run(['-i',str(root/(name+'.jpg')),'-vf',vf,'-frames:v',str(frames),'-c:v','libx264','-crf','17',str(work/(name+'.mp4'))])
photographic('classroom','crop=1600:900:0:0',72,'.0007','iw/2-iw/zoom/2','ih/2-ih/zoom/2')
photographic('projector','crop=1120:630:425:260',54,'.002','(iw-iw/zoom)*.64','(ih-ih/zoom)*.62')
(work/'join.txt').write_text("file 'classroom.mp4'\nfile 'projector.mp4'\nfile 'mechanics.mp4'\n",encoding='ascii')
run(['-f','concat','-safe','1','-i',str(work/'join.txt'),'-i',str(work/'study.wav'),'-map','0:v','-map','1:a',
     '-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',
     '-metadata','title=对焦 · 摄影与建模动态分镜',
     '-metadata','comment=Photography: Yeji Yoo and Alex Litvin / Unsplash. Music: Tobu - Hope, https://soundcloud.com/7obu/tobu-hope-original-mix ; CC BY 3.0 https://creativecommons.org/licenses/by/3.0/ ; excerpt, gain adjustment and fade.',
     str(root/'对焦-动态分镜.mp4')])
