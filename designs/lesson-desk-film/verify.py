"""Verify the actual delivery, without modifying product code."""
import json, subprocess, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
video=root/'讲题工作台-宣传片-1080p60.mp4'
def run(args):
    p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace')
    if p.returncode: raise RuntimeError(p.stderr)
    return p
probe=json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]).stdout)
v=next(x for x in probe['streams'] if x['codec_type']=='video')
a=next(x for x in probe['streams'] if x['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate'],v['pix_fmt'])==(1920,1080,'60/1','yuv420p')
assert v['codec_name']=='h264' and int(v['nb_frames'])==9000
assert a['codec_name']=='aac' and a['channels']==2 and a['sample_rate']=='48000'
assert abs(float(v['duration'])-150)<.02 and abs(float(a['duration'])-150)<.04
decoded=run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'])
assert not decoded.stderr.strip(), decoded.stderr
subtitles=(root/'讲题工作台.srt').read_text(encoding='utf-8')
assert subtitles.count('-->')==29
result={'file':video.name,'seconds':150,'width':1920,'height':1080,'fps':60,'frames':9000,'video':'H.264 / yuv420p','audio':'AAC / stereo / 48000 Hz','full_decode':'passed','subtitle_cues':29,'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'visual_review':'15 scene midpoints and all 14 boundaries at ±0.15s; corrected clipping and overlapping transitions','music':'Tobu - Hope; CC BY 3.0; source and credits in music-research.md'}
(root/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
