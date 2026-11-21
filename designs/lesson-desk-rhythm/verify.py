"""Verify the delivery file against every shot and the final stereo mix."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
work = root / 'work'
movie = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'out/对焦-加长版-1080p60.mp4'


def run(*args):
    return subprocess.check_output(list(map(str, args)), cwd=root)


def frame(path, second):
    pixels = run('ffmpeg', '-v', 'error', '-threads', 2, '-ss', f'{second:.6f}', '-i', path,
                 '-frames:v', 1, '-vf', 'scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-')
    return np.frombuffer(pixels, 'uint8').reshape(180, 320, 3)


def envelope(path):
    data = run('ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', 1, '-ar', 8000, '-f', 'f32le', '-')
    samples = np.frombuffer(data, '<f4')
    windows = samples[:len(samples) // 800 * 800].reshape(-1, 800)
    return np.sqrt((windows ** 2).mean(axis=1))


info = json.loads(run('ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', movie))
video, = [s for s in info['streams'] if s['codec_type'] == 'video']
audio, = [s for s in info['streams'] if s['codec_type'] == 'audio']
assert (video['width'], video['height'], video['r_frame_rate'], int(video['nb_frames'])) == (1920, 1080, '60/1', 17100)
assert video['codec_name'] == 'h264' and (audio['codec_name'], audio['channels']) == ('aac', 2)
assert abs(float(video['duration']) - 285) < 1 / 60 and abs(float(audio['duration']) - 285) < .06
run('ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-threads', 4, '-i', movie, '-map', '0:v', '-map', '0:a', '-f', 'null', '-')

order = json.loads(run('node', '--input-type=module', '-e',
                       "import {cutOrder} from './shots.mjs'; console.log(JSON.stringify(cutOrder))"))
sheet = Image.new('RGB', (320 * 4, 202 * ((len(order) + 3) // 4)), '#18201e')
draw = ImageDraw.Draw(sheet)
errors = []
for i, shot in enumerate(order):
    local = 5.25 if shot != 3 else .45
    for t in [local, 2.1]:
        second = i * 7.5 + t
        actual = frame(movie, second)
        expected = frame(work / f'shot-{shot:02}.mp4', t)
        error = float(np.abs(actual.astype(float) - expected).mean())
        if error > 12:
            raise ValueError(f'Shot {shot} at {second}s differs by {error:.2f}')
        errors.append(error)
        if t == local:
            x, y = i % 4 * 320, i // 4 * 202
            sheet.paste(Image.fromarray(actual), (x, y))
            draw.text((x + 6, y + 181), f'{second:.2f}s', fill='white')
sheet.save(work / 'final-review.jpg')
reference, delivered = envelope(work / 'score.wav'), envelope(movie)
n = min(len(reference), len(delivered))
correlation = float(np.corrcoef(reference[:n], delivered[:n])[0, 1])
assert correlation > .96, f'Music mix drift: {correlation:.4f}'
report = {'seconds': float(video['duration']), 'frames': int(video['nb_frames']), 'fullDecode': True,
          'samples': len(errors), 'maxPixelError': round(max(errors), 3),
          'audioEnvelopeCorrelation': round(correlation, 5), 'audioSampleRate': audio['sample_rate']}
(work / 'final-technical.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(report)
