"""Score the 150-second film from the licensed Hope master and two original foley gestures."""
from pathlib import Path
import subprocess
import wave
import numpy as np

root = Path(__file__).resolve().parent
work = root / "work"
rate = 48000
raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(root.parent / "assets/tobu-hope-full.mp3"),
                               "-f", "f32le", "-ar", str(rate), "-ac", "2", "-"])
source = np.frombuffer(raw, dtype="<f4").reshape(-1, 2)
count = 150 * rate
clock = np.arange(count, dtype=np.float64) / rate
mix = np.zeros((count, 2), np.float32)

def put(source_start, film_start, length, fade_in, fade_out):
    n = round(length * rate)
    sample = source[round(source_start*rate):round(source_start*rate)+n]
    curve = np.ones(n, np.float32)
    if fade_in:
        k = round(fade_in*rate)
        curve[:k] *= np.linspace(0, 1, k)
    if fade_out:
        k = round(fade_out*rate)
        curve[-k:] *= np.linspace(1, 0, k)
    pos = round(film_start*rate)
    mix[pos:pos+n] += sample * curve[:,None]

# The main downbeat at 97.5 in the source lands on the first classroom layout at 57.
put(159.0, 0, 10.2, 1.4, 1.7)
put(49.0, 8.5, 129.5, 1.7, 1.5)
put(274.0, 136.5, 13.5, 1.5, 6.5)
level = np.interp(clock, [0,2,10,55,57,73.4,74.5,80,81.8,136,143,150],
                  [.15,.26,.36,.34,.43,.43,.18,.18,.40,.39,.38,.34])
mix *= level[:,None]
rng = np.random.default_rng(1808)
for time, duration, gain in [(8.05,.18,.045),(41.7,.34,.036),(65.05,.14,.028),(83.73,.16,.040),(95.02,.15,.025)]:
    n = round(duration*rate)
    noise = rng.normal(size=n)
    filtered = np.convolve(noise, np.ones(5)/5, mode="same") - np.convolve(noise,np.ones(32)/32,mode="same")
    gesture = filtered*np.sin(np.linspace(0,np.pi,n))**2 * gain
    i = round(time*rate)
    mix[i:i+n] += gesture[:,None]*[.83,1]
with wave.open(str(work/"score.wav"),"wb") as output:
    output.setparams((2,2,rate,count,"NONE",""))
    output.writeframes((np.clip(mix,-.99,.99)*32767).astype("<i2").tobytes())
