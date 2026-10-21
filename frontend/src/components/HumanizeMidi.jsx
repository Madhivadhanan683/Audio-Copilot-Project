import React, { useState, useCallback } from 'react';
import { apiUrl } from '../lib/api';

const HumanizeMidi = () => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle', 'uploading', 'processing', 'completed', 'failed'
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Humanization parameters
    const [timing, setTiming] = useState(0.5);
    const [velocity, setVelocity] = useState(0.5);
    const [swing, setSwing] = useState(0.5);

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

    const validateAndSetFile = (f) => {
        const validExtensions = ['.mid', '.midi'];
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

        if (validExtensions.includes(ext)) {
            setFile(f);
            setError(null);
            setStatus('idle');
            setResult(null);
        } else {
            setError('Invalid file type. Please upload a MIDI file (.mid or .midi).');
        }
    };

    const handleHumanize = async () => {
        if (!file) return;

        setStatus('uploading');
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const params = new URLSearchParams({
                timing: timing.toString(),
                velocity: velocity.toString(),
                swing: swing.toString(),
            });

            const response = await fetch(apiUrl(`/api/humanize/process?${params}`), {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Humanization failed');
            }

            setStatus('processing');
            await new Promise(r => setTimeout(r, 400));

            const data = await response.json();
            setResult(data);
            setStatus('completed');

        } catch (err) {
            console.error("Humanize Error:", err);
            setError(err.message);
            setStatus('failed');
        }
    };

    const getIntensityLabel = (val) => {
        if (val <= 0.15) return 'Off';
        if (val <= 0.35) return 'Subtle';
        if (val <= 0.65) return 'Medium';
        if (val <= 0.85) return 'Strong';
        return 'Extreme';
    };

    const getIntensityColor = (val) => {
        if (val <= 0.15) return '#6b7280';
        if (val <= 0.35) return '#3b82f6';
        if (val <= 0.65) return '#a855f7';
        if (val <= 0.85) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="humanize-midi p-6 bg-daw-panel rounded-lg h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-daw-text">🎭 Humanize MIDI</h2>
            <p className="text-gray-400 text-sm mb-6">
                Upload a MIDI file and add human-like imperfections — timing jitter, velocity variation, and groove swing.
            </p>

            {/* Upload Area */}
            {status !== 'completed' && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                        border-2 border-dashed rounded-lg p-10 text-center cursor-pointer mb-6
                        transition-all duration-200
                        ${isDragging
                            ? 'border-daw-accent bg-daw-accent bg-opacity-10'
                            : 'border-gray-600 hover:border-gray-500'
                        }
                    `}
                >
                    <input
                        type="file"
                        accept=".mid,.midi"
                        onChange={(e) => validateAndSetFile(e.target.files[0])}
                        className="hidden"
                        id="humanize-upload"
                    />
                    <label htmlFor="humanize-upload" className="cursor-pointer">
                        <div className="text-4xl mb-3">🎹</div>
                        <p className="text-gray-300 font-medium">
                            {file ? file.name : 'Drop a MIDI file here to humanize'}
                        </p>
                    </label>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-900 text-red-100 rounded border border-red-700">
                    ⚠️ {error}
                </div>
            )}

            {/* Parameter Sliders */}
            {file && status !== 'completed' && (
                <div className="space-y-5 mb-6 bg-daw-bg p-5 rounded-lg border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Humanization Settings</h3>

                    {/* Timing Jitter */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm text-gray-300 font-medium">⏱️ Timing Jitter</label>
                            <span className="text-xs font-bold px-2 py-0.5 rounded"
                                style={{ color: getIntensityColor(timing), border: `1px solid ${getIntensityColor(timing)}` }}>
                                {getIntensityLabel(timing)}
                            </span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={timing}
                            onChange={(e) => setTiming(parseFloat(e.target.value))}
                            className="w-full slider"
                            style={{ accentColor: getIntensityColor(timing) }}
                        />
                        <p className="text-xs text-gray-500 mt-1">Randomly shifts note timing for a natural feel.</p>
                    </div>

                    {/* Velocity Variation */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm text-gray-300 font-medium">🔊 Velocity Variation</label>
                            <span className="text-xs font-bold px-2 py-0.5 rounded"
                                style={{ color: getIntensityColor(velocity), border: `1px solid ${getIntensityColor(velocity)}` }}>
                                {getIntensityLabel(velocity)}
                            </span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={velocity}
                            onChange={(e) => setVelocity(parseFloat(e.target.value))}
                            className="w-full slider"
                            style={{ accentColor: getIntensityColor(velocity) }}
                        />
                        <p className="text-xs text-gray-500 mt-1">Varies how hard each note is played.</p>
                    </div>

                    {/* Micro-Swing */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm text-gray-300 font-medium">🎶 Micro-Swing</label>
                            <span className="text-xs font-bold px-2 py-0.5 rounded"
                                style={{ color: getIntensityColor(swing), border: `1px solid ${getIntensityColor(swing)}` }}>
                                {getIntensityLabel(swing)}
                            </span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={swing}
                            onChange={(e) => setSwing(parseFloat(e.target.value))}
                            className="w-full slider"
                            style={{ accentColor: getIntensityColor(swing) }}
                        />
                        <p className="text-xs text-gray-500 mt-1">Pushes alternate notes slightly late for groove.</p>
                    </div>
                </div>
            )}

            {file && status === 'idle' && (
                <button
                    onClick={handleHumanize}
                    className="w-full py-3 bg-daw-accent text-black font-bold rounded hover:opacity-90 transition-opacity"
                >
                    🎭 Humanize MIDI
                </button>
            )}

            {(status === 'uploading' || status === 'processing') && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-daw-accent mb-4"></div>
                    <p className="text-gray-300 text-lg">
                        {status === 'uploading' ? 'Uploading...' : 'Applying Humanization...'}
                    </p>
                </div>
            )}

            {/* Results */}
            {status === 'completed' && result && (
                <div className="results animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">✅ Humanization Complete</h3>
                        <button
                            onClick={() => { setFile(null); setStatus('idle'); setResult(null); }}
                            className="text-xs text-white font-bold hover:underline"
                        >
                            Humanize Another
                        </button>
                    </div>

                    {/* Settings Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Timing Jitter</div>
                            <div className="text-lg font-mono" style={{ color: getIntensityColor(timing) }}>
                                {getIntensityLabel(timing)}
                            </div>
                        </div>
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Velocity</div>
                            <div className="text-lg font-mono" style={{ color: getIntensityColor(velocity) }}>
                                {getIntensityLabel(velocity)}
                            </div>
                        </div>
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Micro-Swing</div>
                            <div className="text-lg font-mono" style={{ color: getIntensityColor(swing) }}>
                                {getIntensityLabel(swing)}
                            </div>
                        </div>
                    </div>

                    {/* Download */}
                    <div className="bg-daw-bg p-5 rounded-lg border border-gray-700 text-center">
                        <div className="text-3xl mb-3">🎵</div>
                        <p className="text-gray-300 font-medium mb-3">{result.filename}</p>
                        <a
                            href={apiUrl(result.url)}
                            download={result.filename}
                            className="inline-block px-6 py-3 bg-daw-accent text-black font-bold rounded hover:opacity-90 transition-opacity"
                        >
                            ⬇️ Download Humanized MIDI
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HumanizeMidi;
