import torch
import torchaudio
from asteroid.models import ConvTasNet
import numpy as np

# Load pretrained Conv-TasNet from Asteroid
model = ConvTasNet.from_pretrained('JorisCos/ConvTasNet')
model.eval()

# Example input: 1 batch, 4096 samples (mono)
chunk_size = 4096
example_input = torch.randn(1, chunk_size)

# Export to ONNX
onnx_path = 'backend/ai/conv_tasnet.onnx'
torch.onnx.export(
    model,
    example_input,
    onnx_path,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {1: 'samples'}, 'output': {1: 'samples'}},
    opset_version=16
)
print(f'Conv-TasNet model exported to {onnx_path}')
