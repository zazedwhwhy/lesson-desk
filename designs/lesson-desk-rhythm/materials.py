"""Prepare genuine product views and the licensed score for the 152-bar cut."""
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import subprocess, wave

here=Path(__file__).resolve().parent
repo=here.parents[1]
work=here/'work'
plates=here/'plates'
plates.mkdir(exist_ok=True)
archive=here.parent/'lesson-desk-film/answer-first/work'
focus=here.parent/'lesson-desk-focus/work'
qa=repo/'test-results'
sources={k:archive/(k+'.png') for k in ['source-paper','source-key','library','setup','paper-2','blue-2','forest-2','forest-3','forest-4']}
sources.update({k:focus/(v+'.png') for k,v in [('chem-review','review'),('chem-show','show-2'),('chem-notes','show-3'),('edit-0','edit-0'),('edit-14','edit-14'),('confirmed','confirmed'),('ppt-before','ppt-before'),('ppt-after','ppt-after')]})
sources.update({k:qa/(v+'.png') for k,v in [
 ('proof','proofread-1920'),('history','auto-correct-history'),('prepare','preparation-ux/english-generation-1920'),
 ('counts','preparation-ux/english-restored'),('syntax','paper-长难句'),('structure-en','quality-structure-1920'),
 ('recall','quality-recall-1920'),('imitation','paper-好句仿写'),('transfer','paper-迁移练习'),
 ('partial','generation-partial'),('arrange','release-0.18.0/gui-smoke/arrange'),
 ('imported','release-0.18.0/gui-import/import'),('prompt-top','release-0.17.0/updated/prompts-top'),('prompt-editor','prompt-settings-1920')]})
sources.update({k: work/(k+'.png') for k in ['structure','language','notebook','notebook-show']})
for i in range(1,14):sources['edit-'+str(i)]=focus/('edit-'+str(i)+'.png')
for key,file in sources.items():
    im=Image.open(file).convert('RGB')
    # Extremely tall QA captures include a whole scrollable page. Show its working area.
    if im.height>im.width:im=im.crop((0,0,im.width,min(im.height,round(im.width*.81))))
    im.thumbnail((1920,1380),Image.Resampling.LANCZOS)
    im.save(plates/(key+'.jpg'),quality=92,subsampling=0,optimize=True)

def mix():
    rate=48000
    track=here.parent/'lesson-desk-film/assets/tobu-hope-full.mp3'
    raw=subprocess.check_output(['ffmpeg','-v','error','-ss','0.055','-i',str(track),'-t','285','-ar',str(rate),'-ac','2','-f','f32le','-'])
    audio=np.frombuffer(raw,'<f4').reshape(-1,2).copy()
    t=np.arange(len(audio))/rate
    env=np.interp(t,[0,.30,2.8,5.6,7.5,14.76,15,42,45,49,58,60,96,99,125,127.5,155,158,175,180,252,270,277.5,281.25,284.95],[.08,.21,.27,.40,.50,.50,.70,.66,.52,.47,.50,.63,.63,.67,.62,.72,.62,.43,.45,.70,.64,.7,.51,.40,0])
    audio*=env[:,None];rng=np.random.default_rng(128)
    def foley(at,kind,pan):
        length=.36 if kind=='paper' else .12
        n=int(length*rate);u=np.arange(n)/rate;noise=rng.standard_normal(n)
        if kind=='paper':
            n1=np.convolve(noise,[.25,.5,.25],'same')
            sig=(n1-np.roll(n1,4))*.075*np.sin(np.pi*u/length)**2
        else:sig=.085*(np.sin(2*np.pi*(650-180*u)*u)+noise*.42)*np.exp(-u*52)
        i=round(rate*at)
        audio[i:i+n]+=sig[:,None]*[1-pan,pan]
    for bar in [8,16,28,36,40,44,56,76,92,100,108,112,116,128,132,136,144,148]:
        foley(bar*1.875-.18,'paper',.65 if bar%3 else .35)
    for b in [10,17,33,73,88,104,142,166,207,228,253,277,289,331,361,382,407,433,481,520,550]:
        foley(b*60/128,'click',.5)
    # Optical release, 20-degree data points, lesson reveal, PowerPoint edit.
    for at in [15+2.3*60/128,22.5+7*60/128,52.5+8*60/128,63.75]:
        foley(at,'click',.53)
    foley(67.5+.15,'paper',.61)
    for s,e in [(0,7.5),(277.5,283.3)]:
        lo,hi=int(s*rate),int(e*rate);u=np.arange(hi-lo)/rate
        room=np.convolve(rng.normal(0,.08,len(u)),np.ones(80)/80,'same')+.009*np.sin(2*np.pi*69*u)
        audio[lo:hi]+=room[:,None]*np.minimum(1,np.minimum(u,np.maximum(0,len(u)/rate-u))*3)[:,None]
    with wave.open(str(work/'score.wav'),'wb') as f:
        f.setparams((2,2,rate,len(audio),'NONE',''));f.writeframes((np.clip(audio,-.98,.98)*32767).astype('<i2').tobytes())
if __name__=='__main__':mix()
