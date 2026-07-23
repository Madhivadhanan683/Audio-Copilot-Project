import urllib.request
import json

req = urllib.request.Request(
    'http://localhost:8000/api/samples/scan',
    data=json.dumps({"folder_path": r"d:\Projects\2025\AudioCopilotProject\test_samples"}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    with open('test_out.json', 'w') as f:
        json.dump(data, f, indent=2)
