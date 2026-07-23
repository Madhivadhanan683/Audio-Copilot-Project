import sounddevice as sd
import numpy as np
from collections import deque

# Parameters
SAMPLE_RATE = 44100
CHUNK_SIZE = 4096  # samples per chunk
OVERLAP = CHUNK_SIZE // 2
CHANNELS = 2  # stereo
BUFFER_SIZE = CHUNK_SIZE * 8

class CircularBuffer:
    def __init__(self, size):
        self.buffer = deque(maxlen=size)
    def write(self, data):
        self.buffer.extend(data)
    def read_chunk(self):
        if len(self.buffer) >= CHUNK_SIZE:
            chunk = [self.buffer.popleft() for _ in range(CHUNK_SIZE)]
            return np.array(chunk)
        return None


# Import stem separator
from stem_separator import separate_stems

cbuffer = CircularBuffer(BUFFER_SIZE)

def audio_callback(indata, frames, time, status):
    if status:
        print(status)
    # Mono mix for model input
    mono = np.mean(indata, axis=1)
    cbuffer.write(mono)

# Overlap-add buffer for output stems
output_buffers = [np.zeros(CHUNK_SIZE + OVERLAP) for _ in range(4)]  # 4 stems
overlap_idx = 0

input_stream = sd.InputStream(
    samplerate=SAMPLE_RATE,
    channels=CHANNELS,
    callback=audio_callback
)
input_stream.start()

print('Audio streaming started. Press Ctrl+C to stop.')
try:
    while True:
        chunk = cbuffer.read_chunk()
        if chunk is not None:
            # Run stem separation
            stems = separate_stems(chunk)
            # Overlap-add reconstruction
            for i in range(4):
                output_buffers[i][overlap_idx:overlap_idx+CHUNK_SIZE] += stems[:, i]
            overlap_idx += OVERLAP
            if overlap_idx + CHUNK_SIZE > len(output_buffers[0]):
                # Output stems (for now, just print shape)
                for i, name in enumerate(['Vocals', 'Drums', 'Bass', 'Other']):
                    print(f'{name} stem shape:', output_buffers[i].shape)
                # Reset buffers
                output_buffers = [np.zeros(CHUNK_SIZE + OVERLAP) for _ in range(4)]
                overlap_idx = 0
except KeyboardInterrupt:
    input_stream.stop()
    print('Audio streaming stopped.')
