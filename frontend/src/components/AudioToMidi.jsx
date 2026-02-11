import React, { useState, useCallback } from 'react';

const AudioToMidi = () => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState(null); // 'idle', 'uploading', 'processing', 'completed', 'failed'
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            validateAndSetFile(droppedFile);
        }
    }, []);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    };

    const validateAndSetFile = (f) => {
        const validExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

        if (validExtensions.includes(ext)) {
            setFile(f);
            setError(null);
            setStatus('idle');
            setResult(null);
        } else {
            setError('Invalid file type. Please upload MP3, WAV, FLAC, OGG, or M4A.');
        }
    };

    const handleConvert = async () => {
        if (!file) return;

        console.log("Starting conversion for:", file.name);
        setError(null);
        setStatus('uploading');

        const formData = new FormData();
        formData.append('file', file);

        try {
            console.log("Sending request to API...");
            const response = await fetch('http://127.0.0.1:8000/api/midi/audio-to-midi', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Conversion failed');
            }

            const data = await response.json();
            console.log("Conversion successful:", data);
            setResult(data);
            setStatus('completed');

        } catch (err) {
            console.error("Conversion error:", err);
            setError(err.message);
            setStatus('failed');
        }
    };

    return (
        <div className="audio-to-midi p-6 bg-daw-panel rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-daw-text">🎹 Audio to MIDI</h2>
            <p className="text-gray-400 text-sm mb-6">
                Upload a melody (humming, whistling, or instrument) to convert it to MIDI.
            </p>

            {/* Upload Zone */}
            {status !== 'completed' && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        transition-all duration-200
                        ${isDragging
                            ? 'border-daw-accent bg-daw-accent bg-opacity-10'
                            : 'border-gray-600 hover:border-gray-500'
                        }
                    `}
                >
                    <input
                        type="file"
                        accept=".mp3,.wav,.flac,.ogg,.m4a"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="midi-upload"
                    />
                    <label htmlFor="midi-upload" className="cursor-pointer">
                        <div className="text-4xl mb-2">🎤</div>
                        <p className="text-gray-300">
                            {file ? file.name : 'Drop audio file here or click to browse'}
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                            Best results with monophonic melodies (one note at a time).
                        </p>
                    </label>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-red-900 text-red-100 rounded">
                    ❌ {error}
                </div>
            )}

            {/* Convert Button */}
            {file && status === 'idle' && (
                <button
                    onClick={handleConvert}
                    className="mt-4 w-full py-3 bg-daw-accent text-black font-bold rounded hover:opacity-90 transition-opacity"
                >
                    ✨ Convert to MIDI
                </button>
            )}

            {/* Processing State */}
            {(status === 'uploading' || status === 'processing') && (
                <div className="mt-6 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-daw-accent mb-2"></div>
                    <p className="text-gray-300">Processing audio...</p>
                    <p className="text-xs text-gray-500">Running AI pitch detection</p>
                </div>
            )}

            {/* Result */}
            {status === 'completed' && result && (
                <div className="mt-6 text-center">
                    <h3 className="text-lg font-semibold text-green-400 mb-4">✅ Conversion Complete!</h3>

                    <div className="p-6 bg-daw-bg rounded-lg border border-gray-600">
                        <div className="text-5xl mb-4">🎹</div>
                        <p className="text-daw-text font-medium mb-4">{result.filename}</p>

                        <a
                            href={`http://127.0.0.1:8000${result.url}`}
                            download
                            className="inline-block px-6 py-3 bg-daw-accent text-black font-bold rounded hover:bg-opacity-90 transition-all"
                        >
                            Download MIDI File
                        </a>
                    </div>

                    <button
                        onClick={() => {
                            setFile(null);
                            setStatus('idle');
                            setResult(null);
                        }}
                        className="mt-6 text-gray-400 hover:text-white underline text-sm"
                    >
                        Convert another file
                    </button>
                </div>
            )}
        </div>
    );
};

export default AudioToMidi;
