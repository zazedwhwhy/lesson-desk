"""Cut the camera footage on the 128 BPM grid, preserving its native moving images."""
from pathlib import Path
import subprocess
from PIL import Image,ImageDraw,ImageFont
here=Path(__file__).resolve().parent;w=here/'work';live=here.parent/'lesson-desk-focus/work'
fps=60
def tc(frame):
    cs=round(frame/60*100)
    return f'0:00:{cs//100:02d}.{cs%100:02d}'
def lettering(name,events):
    styles="""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Title,SimSun,140,&H00F1F5F6,&H00FFFFFF,&H00413C33,&H00303C33,-1,0,0,0,100,100,6,0,1,1,1,7,110,60,340,1
Style: En,Georgia,40,&H00F1F5F6,&H00FFFFFF,&H00342E27,&H00303C33,0,-1,0,0,100,100,1,0,1,1,0,7,118,60,515,1
Style: Sub,Microsoft YaHei,43,&H00FAFAF7,&H00FFFFFF,&H002A302B,&H002A302B,0,0,0,0,100,100,1,0,1,1,0,2,80,80,66,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    for start,end,style,text in events:styles+=f'Dialogue: 0,{tc(start)},{tc(end)},{style},,0,0,0,,{{\\fad(110,90)}}{text}\n'
    (w/(name+'.ass')).write_text(styles,encoding='utf-8-sig')
def endcard():
    im=Image.open(live/'end-card.png').convert('RGB');g=ImageDraw.Draw(im)
    g.rectangle((1280,210,1860,825),fill=im.getpixel((1850,200)))
    for pts,color in [([(1348,620),(1458,568),(1570,480),(1682,361)],'#ab6040'), ([(1348,529),(1458,505),(1570,480),(1682,454)],'#365c60')]:
        g.line(pts,fill=color,width=5,joint='curve')
        x,y=pts[1];g.ellipse((x-7,y-7,x+7,y+7),fill=color)
    im.save(w/'closing.png')
def cut(i,sequence,text):
    name='shot-'+str(i).zfill(2);lettering(name,text)
    args=[];parts=[]
    for j,(key,ss,frames) in enumerate(sequence):
        if key=='closing':
            args+=['-loop','1','-framerate','60','-i',str(w/'closing.png')]
            transform='scale=1920:1080'
        else:
            args+=['-ss',str(ss),'-i',str(live/('live-'+key+'.mp4'))]
            transform='scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=saturation=.80:contrast=1.055:brightness=-.014,drawbox=x=0:y=0:w=iw:h=68:color=0x172325:t=fill,drawbox=x=0:y=ih-80:w=iw:h=80:color=0x172325:t=fill'
        parts.append(f'[{j}:v]{transform},setsar=1,fps=60,tpad=stop_mode=clone:stop_duration=.3,trim=end_frame={frames},setpts=N/(60*TB)[v{j}]'.replace('duration=.3','duration=0.3'))
    assert sum(x[2] for x in sequence)==450
    graph=';'.join(parts)+';'+''.join(f'[v{j}]' for j in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=0,ass={name}.ass,settb=1/60,setpts=N[v]'
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y',*args,'-filter_complex_threads','3','-filter_complex',graph,'-map','[v]','-an','-r','60','-frames:v','450','-c:v','libx264','-threads','4','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-video_track_timescale','60000','-movflags','+faststart',name+'.mp4'],cwd=w,check=True)
if __name__=='__main__':
    endcard()
    cut(0,[('teach',2.3,141),('hand',3,84),('pencil',7,56),('teach',9.0,169)],[(70,410,'Sub','“我们看的是哪个温度？”')])
    cut(1,[('hand',10,113),('lens',6.7,112),('lens',22.4,225)],[(231,443,'Title','对焦'),(242,442,'En','In Focus')])
    cut(35,[('pencil',12.7,169),('teach',12.4,56),('closing',0,225)],[(21,173,'Sub','“看这里。”')])
