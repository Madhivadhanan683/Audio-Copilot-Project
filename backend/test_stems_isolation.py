import asyncio
import os
import sys
from ai.stem_service import StemService

async def test_separation():
    service = StemService()
    
    # Use one of the already uploaded files if possible
    uploads_dir = os.path.join(os.getcwd(), "uploads")
    files = [f for f in os.listdir(uploads_dir) if f.endswith(".mp3")]
    
    if not files:
        print("No files found in uploads directory. Please upload a file via the UI first.")
        return
    
    input_file = os.path.join(uploads_dir, files[0])
    print(f"Testing separation for: {input_file}")
    
    job_id = service.create_job(files[0])
    print(f"Created job: {job_id}")
    
    await service.separate_stems(job_id, input_file)
    
    status = service.get_job_status(job_id)
    print("Final Status:", status)
    
    if status["status"] == "completed":
        print("SUCCESS! Stems are at:", status["stems"])
    else:
        print("FAILED!")
        print("Error:", status.get("error"))

if __name__ == "__main__":
    asyncio.run(test_separation())
