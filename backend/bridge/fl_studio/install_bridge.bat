@echo off
setlocal

echo =====================================================
echo   Audio Copilot FL Studio Bridge — Installer
echo =====================================================
echo.

REM ── Resolve the FL Studio hardware scripts directory ──────────────────────
set "FL_SCRIPTS=%USERPROFILE%\Documents\Image-Line\FL Studio\Settings\Hardware"
set "SRC=%~dp0device_AudioCopilot.py"

echo Source  : %SRC%
echo Target  : %FL_SCRIPTS%
echo.

REM ── Check that FL Studio scripts folder exists ─────────────────────────────
if not exist "%FL_SCRIPTS%" (
    echo [!] FL Studio hardware scripts folder not found:
    echo     %FL_SCRIPTS%
    echo.
    echo     Please ensure FL Studio is installed and has been run at least once.
    echo     Create the folder manually if needed, then re-run this installer.
    pause
    exit /b 1
)

REM ── Copy the script ────────────────────────────────────────────────────────
echo Copying device script...
copy /Y "%SRC%" "%FL_SCRIPTS%\device_AudioCopilot.py"

if %errorlevel% equ 0 (
    echo.
    echo [OK] device_AudioCopilot.py installed successfully!
    echo.
    echo ── NEXT STEPS ──────────────────────────────────────────────────────────
    echo  1. Install loopMIDI:  https://www.tobias-erichsen.de/software/loopmidi.html
    echo  2. In loopMIDI, create a virtual port named exactly: "Audio Copilot Bridge"
    echo  3. Open FL Studio → Options → MIDI Settings
    echo  4. Under INPUT:  Enable "Audio Copilot Bridge" port
    echo               Set Script to "Audio Copilot Bridge v2.0"
    echo  5. Under OUTPUT: Also enable "Audio Copilot Bridge" port
    echo  6. Click OK and RESTART FL Studio
    echo  7. Run the relay: cd backend ^& .\venv\Scripts\python.exe bridge\fl_relay.py
    echo ────────────────────────────────────────────────────────────────────────
) else (
    echo.
    echo [ERROR] Copy failed. Try running this script as Administrator.
)

echo.
pause
