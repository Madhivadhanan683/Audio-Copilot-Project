import React, { useState, useCallback } from 'react';

const StemSeparator = () => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState(null);
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
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4'];
        const validExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];

        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

        if (validTypes.includes(f.type) || validExtensions.includes(ext)) {
            setFile(f);
            setError(null);
            setJobId(null);
            setStatus(null);
        } else {
            setError('Invalid file type. Please upload MP3, WAV, FLAC, OGG, or M4A.');
        }
    };

    const [isUploading, setIsUploading] = useState(false);

    const uploadFile = async () => {
        if (!file) return;

        console.log("Starting upload for:", file.name);
        setError(null);
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            console.log("Sending request to API...");
            const response = await fetch('http://127.0.0.1:8000/api/stems/upload', {
                method: 'POST',
                body: formData
            });

            console.log("Response status:", response.status);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Upload failed');
            }

            const data = await response.json();
            console.log("Upload successful, job_id:", data.job_id);
            setJobId(data.job_id);
            setStatus({ status: 'processing', progress: 0 });

            // Start polling for status
            pollStatus(data.job_id);

        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const pollStatus = async (id) => {
        const poll = async () => {
            try {
                const response = await fetch(`http://127.0.0.1:8000/api/stems/status/${id}`);
                const data = await response.json();
                setStatus(data);

                if (data.status === 'processing' || data.status === 'pending') {
                    setTimeout(poll, 1000); // Poll every second
                }
            } catch (err) {
                setError('Failed to check status');
            }
        };
        poll();
    };

    const downloadStem = (stem) => {
        window.open(`http://127.0.0.1:8000/api/stems/download/${jobId}/${stem}`, '_blank');
    };

    return (
        <div className="stem-separator p-6 bg-daw-panel rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-daw-text">🎵 Stem Separator</h2>
            <p className="text-gray-400 text-sm mb-6">
                Upload an audio file to separate it into Vocals, Drums, Bass, and Other.
            </p>

            {/* Upload Zone */}
            {!jobId && (
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
                        id="audio-upload"
                    />
                    <label htmlFor="audio-upload" className="cursor-pointer">
                        <div className="text-4xl mb-2">🎧</div>
                        <p className="text-gray-300">
                            {file ? file.name : 'Drop audio file here or click to browse'}
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                            Supports: MP3, WAV, FLAC, OGG, M4A
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

            {/* Upload Button */}
            {file && !jobId && (
                <button
                    onClick={uploadFile}
                    disabled={isUploading}
                    className="mt-4 w-full py-3 bg-daw-accent text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isUploading ? '⏳ Uploading...' : '🚀 Start Separation'}
                </button>
            )}

            {/* Processing Status */}
            {status && status.status === 'processing' && (
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300">Processing...</span>
                        <span className="text-daw-accent">{status.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
                        <div
                            className="h-full bg-daw-accent transition-all duration-300"
                            style={{ width: `${status.progress}%` }}
                        />
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                        This may take a few minutes depending on file length...
                    </p>
                </div>
            )}

            {/* Completed - Download Stems */}
            {status && status.status === 'completed' && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-green-400 mb-4">✅ Separation Complete!</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {['vocals', 'drums', 'bass', 'other'].map((stem) => (
                            <button
                                key={stem}
                                onClick={() => downloadStem(stem)}
                                className="p-4 bg-daw-bg border border-gray-600 rounded-lg hover:border-daw-accent transition-colors text-left"
                            >
                                <div className="text-2xl mb-1">
                                    {stem === 'vocals' ? '🎤' :
                                        stem === 'drums' ? '🥁' :
                                            stem === 'bass' ? '🎸' : '🎹'}
                                </div>
                                <div className="font-semibold text-daw-text capitalize">{stem}</div>
                                <div className="text-xs text-gray-400">Click to download</div>
                            </button>
                        ))}
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setFile(null);
                            setJobId(null);
                            setStatus(null);
                        }}
                        className="mt-4 w-full py-2 border border-gray-600 text-gray-300 rounded hover:bg-gray-800 transition-colors"
                    >
                        ↩️ Separate Another File
                    </button>
                </div>
            )}

            {/* Failed Status */}
            {status && status.status === 'failed' && (
                <div className="mt-6 p-4 bg-red-900 bg-opacity-50 rounded">
                    <h3 className="font-semibold text-red-300">❌ Separation Failed</h3>
                    <p className="text-red-200 text-sm mt-1">{status.error}</p>
                    <button
                        onClick={() => {
                            setFile(null);
                            setJobId(null);
                            setStatus(null);
                        }}
                        className="mt-3 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
};

export default StemSeparator;
