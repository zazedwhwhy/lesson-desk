"""Decode the deliverable, check each editorial shot, and compare its audio to the mix."""
import json, subprocess
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree
import numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parent
work=root/'work'
movie=root/'out/对焦-OpenMotion-1080p60.mp4'
def run(*cmd):return subprocess.check_output([str(c) for c in cmd])
def frame(path,t):
    data=run('ffmpeg','-v','error','-ss',t,'-i',path,'-frames:v',1,'-vf','scale=384:216','-f','rawvideo','-pix_fmt','rgb24','-')
    return np.frombuffer(data,'uint8').reshape(216,384,3)
info=json.loads(run('ffprobe','-v','error','-show_format','-show_streams','-of','json',movie))
v=next(s for s in info['streams'] if s['codec_type']=='video')
a=next(s for s in info['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1920,1080,'60/1',5760)
assert abs(float(v['duration'])-96)<1/60 and abs(float(a['duration'])-96)<.06
assert a['channels']==2
def slide_text(name):
    with ZipFile(work/name) as deck:
        slide=ElementTree.fromstring(deck.read('ppt/slides/slide3.xml'))
        return ''.join(n.text or '' for n in slide.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'))
for deck in ['focus.pptx','focus-edited.pptx']:
    assert '先找 20 ℃，再比纵坐标。' in slide_text(deck)
assert '先比较同一温度下的两个点' not in slide_text('focus.pptx')
assert '先比较同一温度下的两个点' in slide_text('focus-edited.pptx')
subprocess.run(['ffmpeg','-nostdin','-hide_banner','-v','error','-xerror','-i',str(movie),'-map','0:v','-map','0:a','-f','null','-'],check=True)
times=[1,5.50,9.75,13,19,25,32,38.5,42.75,48,51.6,55,60.7,65.3,70,75,80,83,85.6,89,93,95.8]
cuts=[0,12,41,57,81,87,96]
sheet=Image.new('RGB',(384*4,240*((len(times)+3)//4)),'#18201e')
draw=ImageDraw.Draw(sheet);errors=[]
for i,t in enumerate(times):
    s=next(i for i in range(6) if cuts[i]<=t<cuts[i+1])
    output=frame(movie,t)
    original=frame(work/f'seq-{s}.mp4',round(t-cuts[s],4))
    diff=float(abs(output.astype(float)-original).mean());errors.append(diff)
    if diff>14:raise ValueError(f'{t}s 镜头对照偏差 {diff:.2f}')
    x=i%4*384;y=i//4*240
    sheet.paste(Image.fromarray(output),(x,y));draw.text((x+6,y+218),f'{t:.2f} s',fill='white')
sheet.save(work/'final-review.jpg')
def audio(path):return np.frombuffer(run('ffmpeg','-v','error','-i',path,'-vn','-ac','1','-ar','8000','-f','f32le','-'),'<f4')
ref=audio(work/'score.wav');mix=audio(movie)
def envelope(values):
    count=len(values)//800
    return np.sqrt((values[:count*800].reshape(count,800)**2).mean(axis=1))
ref,mix=envelope(ref),envelope(mix)
n=min(len(mix),len(ref));corr=float(np.corrcoef(ref[:n],mix[:n])[0,1])
if corr<.96:raise ValueError(f'音轨包络不同步 {corr}')
report={'duration':info['format']['duration'],'video':v['codec_name'],'width':v['width'],'height':v['height'],'fps':v['r_frame_rate'],'frames':v['nb_frames'],'audio':a['codec_name'],'sampleRate':a['sample_rate'],'channels':a['channels'],'fullDecode':True,'sampleTimes':times,'maximumMeanPixelError':round(max(errors),3),'audioEnvelopeCorrelation':round(corr,5)}
(work/'final-technical.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(report)
