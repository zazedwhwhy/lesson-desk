"""Master the six sequences at 1080p60. Source media and intermediates live in work/."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, wave, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent
w=root/'work'
def ff(args):
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y',*map(str,args)],cwd=w,check=True)
def encode(inputs,graph,name,duration):
    ff([*inputs,'-filter_complex_threads','3','-filter_complex',graph+',settb=1/60,setpts=N[video]','-map','[video]','-an','-r','60','-fps_mode','cfr','-frames:v',round(duration*60),'-c:v','libx264','-threads','4','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-video_track_timescale','60000','-movflags','+faststart',name+'.mp4'])
def src(name):return ['-i',name]
def still(name):return ['-loop','1','-framerate','60','-i',name+'.png']
def tc(t):
    c=round(100*t)
    return f'{c//360000}:{c//6000%60:02d}:{c//100%60:02d}.{c%100:02d}'
header="""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,39,&H00FFFFFF,&H00FFFFFF,&H31182020,&H80102020,0,0,0,0,100,100,1,0,3,10,0,2,64,64,65,1
Style: Head,Microsoft YaHei,77,&H00232D24,&H00000000,&H00000000,&H00000000,-1,0,0,0,100,100,3,0,1,0,0,7,76,70,70,1
Style: Small,Arial,25,&H00386289,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,0,0,7,76,70,42,1
Style: Film,SimSun,94,&H00FFFFFF,&H00FFFFFF,&H00202020,&H70202020,0,0,0,0,100,100,12,0,1,1,1,7,118,90,350,1
Style: FilmEN,Georgia,30,&H00FFFFFF,&H00FFFFFF,&H00202020,&H70202020,0,-1,0,0,100,100,2,0,1,0,1,7,126,90,488,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
def captions(name,items):
    lines=[header]
    for start,end,style,words in items:
        lines.append(f'Dialogue: 0,{tc(start)},{tc(end)},{style},,0,0,0,,{{\\fad(180,140)}}{words}\n')
    (w/(name+'.ass')).write_text(''.join(lines),encoding='utf-8-sig')
    return 'ass='+name+'.ass'
def camera(name,seek,d,length):
    return f'[{name}:v]trim=start={seek}:duration={d},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=60,tpad=stop_mode=clone:stop_duration=0.1,trim=duration={length},eq=saturation=0.82:contrast=1.045:brightness=-.012,drawbox=x=0:y=0:w=iw:h=62:color=0x141813:t=fill,drawbox=x=0:y=ih-62:w=iw:h=62:color=0x141813:t=fill'
def opening():
    cap=captions('opening',[(3.0,7.1,'Sub','“我们看的是哪个温度？”'),(8.6,11.8,'Film','对焦'),(8.8,11.8,'FilmEN','In Focus')])
    graph=camera(0,2,4.6,4.6)+'[a];'+camera(1,3,2.7,2.7)+'[b];'+camera(2,22.6,4.7,4.7)+'[c];[a][b][c]concat=n=3:v=1:a=0,'+cap
    encode(src('live-teach.mp4')+src('live-hand.mp4')+src('live-lens.mp4'),graph,'seq-0',12)
def optics():
    cap=captions('optics',[(4.1,9.3,'Small','LESSON DESK    /    IN FOCUS'),(4.15,9.3,'Head','讲题工作台'),(10,14.9,'Sub','把原卷上的第 12 题，带进课堂。'),(17.6,21.8,'Sub','沿着横轴，找到 20 ℃。')])
    encode(src('optical.mp4'),'[0:v]'+cap,'seq-1',29)
def software():
    # The changing text and confirmation are successive captures of the product's own editor.
    states=[('review',5.6),('edit-0',2.1)]+[('edit-'+str(i),.15) for i in range(1,14)]+[('edit-14',3.15),('confirmed',3.2)]
    assert abs(sum(d for _,d in states)-16)<1e-6
    inputs=[]
    parts=[]
    for i,(name,d) in enumerate(states):
        inputs+=['-t',str(d)]+still(name)
        crop='crop=1328:747:155:97,scale=1920:1080,' if name=='review' else ''
        if name.startswith('edit-') and name!='edit-0':
            crop='crop=1376:774:544:190,scale=1920:1080,'
        parts.append(f'[{i}:v]{crop}format=yuv420p,setsar=1,trim=duration={d},setpts=PTS-STARTPTS[v{i}]')
    cap=captions('software',[(.25,4.95,'Sub','核对原卷第 1 页，题号和配图一一对应。'),(5.8,7.55,'Sub','这一步，老师来改。'),(12.95,15.85,'Sub','另存修订版，确认这次上课用的讲法。')])
    graph=';'.join(parts)+';'+''.join('[v%d]'%i for i in range(len(states)))+f'concat=n={len(states)}:v=1:a=0,'+cap
    encode(inputs,graph,'seq-2',16)
def projection():
    cap=captions('projection',[(.8,4,'Sub','先找横轴的 20 ℃。'),(5.3,8.2,'Sub','再比两个点的纵坐标。'),(9.15,13.0,'Sub','同一温度下，B 的溶解度更大。'),(15.2,20.35,'Sub','开始放映。第 12 题的原图也在这里。')])
    encode(src('projection.mp4'),'[0:v]trim=duration=24,'+cap,'seq-3',24)
def powerpoint():
    cap=captions('powerpoint',[(.15,2.8,'Sub','导出到 PowerPoint，讲义仍能逐字修改。'),(3.17,5.8,'Sub','把“比较”改成“先比较”。')])
    # Use the actual exported before/after frames. Match geometry on the edit.
    frames=[]
    for name in ['ppt-before','ppt-after']:
        im=Image.open(w/(name+'.png')).convert('RGB')
        slide=im.crop((38,205,1428,987)).resize((1920,1080),Image.Resampling.LANCZOS)
        slide.save(w/(name+'-detail.png'))
    encode(['-t','3']+still('ppt-before-detail')+['-t','3']+still('ppt-after-detail'),'[0:v][1:v]concat=n=2:v=1:a=0,'+cap,'seq-4',6)
def closing():
    W,H=1920,1080
    im=Image.new('RGB',(W,H),'#f5f4ed');d=ImageDraw.Draw(im)
    def font(f,s):return ImageFont.truetype('C:/Windows/Fonts/'+f,s)
    def line(xy,s,f,size,c):d.text(xy,s,font=font(f,size),fill=c,stroke_width=0)
    ink='#233029'; brass='#995b38'
    # A reticle, with the two curves at the same coordinates as the question.
    d.line((1270,153,1270,848),fill='#c8c9bd',width=2)
    for r in [170,183,199]:
        d.ellipse((1535-r,482-r,1535+r,482+r),outline=brass if r==183 else '#85918a',width=3)
    d.line([(1375,558),(1461,536),(1547,491),(1632,431),(1690,374)],fill=brass,width=5)
    d.line([(1364,532),(1461,510),(1547,491),(1640,469),(1706,455)],fill='#3c6061',width=5)
    d.line((1461,441,1461,594),fill='#8b8c79',width=2)
    d.ellipse((1452,501,1470,519),fill='#f5f4ed',outline=ink,width=3)
    line((146,183),'LESSON DESK     /     IN FOCUS','arial.ttf',28,brass)
    line((134,285),'讲题工作台','msyhbd.ttc',126,ink)
    line((147,513),'英语   /   语文   /   化学','msyh.ttc',43,ink)
    d.line((148,676,1130,676),fill='#bdc2b7',width=2)
    line((146,728),'打开教学示例','msyhbd.ttc',51,ink)
    line((150,820),'github.com/zazedwhwhy/lesson-desk','arial.ttf',33,'#56645b')
    line((150,968),'Music   Tobu — Hope  ·  CC BY 3.0','arial.ttf',24,'#59675e')
    im.save(w/'end-card.png')
    cap=captions('closing',[(.35,3.6,'Sub','“看这里。”')])
    graph=camera(0,12.8,4.2,4.2)+'[a];[1:v]fps=60,setsar=1,trim=duration=4.8,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,'+cap
    encode(src('live-pencil.mp4')+['-t','4.8']+still('end-card'),graph,'seq-5',9)
def sound():
    rate=48000
    t=np.arange(96*rate)/rate
    rng=np.random.default_rng(436)
    noise=rng.normal(size=len(t))
    fan=np.convolve(noise,np.ones(80)/80,'same')*.10+.014*np.sin(2*np.pi*72*t)+.004*np.sin(2*np.pi*144*t)
    fan*=np.interp(t,[0,.6,7,9,12,16,83,87,92,96],[.23,.68,.57,.94,.85,.10,.10,.68,.48,0])
    mix=np.stack((fan,fan*.94),axis=1)
    def effect(at,seconds,freq,amount,decay,pan,swish=False):
        n=int(seconds*rate);u=np.arange(n)/rate;noise=rng.normal(size=n)
        if swish:
            note=np.convolve(noise,np.ones(14)/14,'same')*np.sin(np.pi*u/seconds)**1.5
        else:
            note=(np.sin(2*np.pi*freq*u)+.43*np.sin(2*np.pi*(freq*2.52)*u)+noise*.35)*np.exp(-decay*u)
        pos=round(at*rate);mix[pos:pos+n]+=amount*note[:,None]*[1-pan,pan]
    for a in [(3.85,.28,390,.23,28,.57),(6.22,.18,710,.11,43,.37),(12.34,.28,438,.32,29,.5),(16.16,.24,623,.23,32,.43),(19.74,.23,545,.2,32,.57),(25.76,.28,310,.26,27,.61),(37.70,.22,810,.23,36,.48),(54.01,.16,555,.15,37,.64),(60.12,.20,421,.22,39,.43),(64.06,.20,583,.23,37,.54),(68.39,.26,716,.27,35,.62),(90.18,.16,470,.17,42,.41)]:effect(*a)
    for start,length,amount,pan in [(4.6,.55,.20,.35),(7.4,1.0,.13,.6),(15.2,1.1,.22,.46),(23.0,1.6,.22,.58),(32,1.5,.19,.57),(57.8,1.8,.24,.41),(62.3,1.7,.26,.48),(66.1,1.8,.25,.57),(88.7,.33,.18,.41)]:effect(start,length,0,amount,0,pan,True)
    srcfile=root.parent/'lesson-desk-film/assets/tobu-hope-full.mp3'
    raw=subprocess.check_output(['ffmpeg','-v','error','-ss','49.8','-i',str(srcfile),'-t','79','-f','f32le','-ar',str(rate),'-ac','2','-'])
    song=np.frombuffer(raw,'<f4').reshape(-1,2)
    pos=10*rate;clock=t[pos:pos+len(song)]
    gain=np.interp(clock,[10,12.36,16,29,35,37.4,38.1,40.5,49,56.8,58.4,65,69,78,83,86.8,89],[0,.53,.62,.59,.43,.16,.18,.46,.47,.48,.55,.53,.62,.56,.46,.15,0])
    mix[pos:pos+len(song)]+=song*gain[:,None]
    with wave.open(str(w/'score.wav'),'wb') as out:
        out.setparams((2,2,rate,len(t),'NONE',''))
        out.writeframes((np.clip(mix,-.98,.98)*32767).astype('<i2').tobytes())
if __name__=='__main__':
    stages=[opening,optics,software,projection,powerpoint,closing,sound]
    requested=[s for s in stages if not sys.argv[1:] or s.__name__ in sys.argv[1:]]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for _ in pool.map(lambda f:f(),requested):pass
