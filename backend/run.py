import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Get the directory of this script
    base_dir = Path(__file__).parent.absolute()
    
    print(f"Starting Audio Copilot Backend from {base_dir}")
    print("Excluding 'uploads', 'separated_stems', and 'venv' from auto-reload.")
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_excludes=["uploads/*", "separated_stems/*", "venv/*"]
    )
