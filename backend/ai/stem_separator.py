import onnxruntime as ort
import numpy as np

# Load ONNX Conv-TasNet model
MODEL_PATH = 'conv_tasnet.onnx'  # Place your ONNX model here
session = ort.InferenceSession(MODEL_PATH)

# Model expects input shape: (batch, samples)
def separate_stems(audio_chunk):
    # Preprocess: ensure shape (1, chunk_size)
    input_data = np.expand_dims(audio_chunk, axis=0).astype(np.float32)
    # Run inference
    outputs = session.run(None, {'input': input_data})
    # Output: [vocals, drums, bass, other] (shape: 1, chunk_size, 4)
    stems = outputs[0][0]  # shape: (chunk_size, 4)
    return stems

# Example usage:
# chunk = np.random.randn(4096).astype(np.float32)
# stems = separate_stems(chunk)
# vocals = stems[:, 0]
# drums = stems[:, 1]
# bass = stems[:, 2]
# other = stems[:, 3]
