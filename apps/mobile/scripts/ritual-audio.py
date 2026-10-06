"""Generate original sub-1.5s ritual sounds (MP3/OGG, -14 LUFS); requires an existing ffmpeg CLI."""
import math
from pathlib import Path
import random
import struct
import subprocess
import tempfile
import wave

# DESIGN-GAP: No recordings were supplied; deterministic synthesis avoids third-party sound rights.
rng = random.Random(7)
output = Path(__file__).resolve().parents[1] / 'assets/audio'
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='tianji-ritual-audio-') as directory:
    for key, duration in [('shuffle', .65), ('flip', .2), ('coin', .45), ('palace', .16), ('complete', .85)]:
        samples = []
        rate = 44100
        for index in range(int(duration * rate)):
            time = index / rate
            envelope = min(1, time / .008) * max(0, 1 - time / duration) ** 2
            if key == 'shuffle':
                value = (rng.random() * 2 - 1) * .5 * (.35 + .65 * math.sin(time * 42) ** 2)
            elif key == 'flip':
                value = (rng.random() * 2 - 1) * .3 + math.sin(2 * math.pi * (650 - 1400 * time) * time) * .4
            elif key == 'coin':
                value = sum(math.sin(2 * math.pi * frequency * time) * math.exp(-time * decay) for frequency, decay in [(1800, 12), (2820, 15), (4350, 20)]) / 3
            elif key == 'palace':
                value = math.sin(2 * math.pi * 660 * time) * .7 + math.sin(2 * math.pi * 990 * time) * .2
            else:
                value = sum(math.sin(2 * math.pi * frequency * time) for frequency in [523.25, 659.25, 783.99]) / 3
            samples.append(max(-32767, min(32767, int(value * envelope * 23000))))
        source = Path(directory) / f'{key}.wav'
        with wave.open(str(source), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(rate)
            audio.writeframes(struct.pack('<' + 'h' * len(samples), *samples))
        for extension in ['mp3', 'ogg']:
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7', str(output / f'{key}.{extension}')], check=True)
