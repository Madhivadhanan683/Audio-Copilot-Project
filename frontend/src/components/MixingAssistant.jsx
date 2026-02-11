import React, { useState, useCallback } from 'react';

const MixingAssistant = () => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle', 'uploading', 'analyzing', 'completed', 'failed'
    const [analysis, setAnalysis] = useState(null);
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

    const validateAndSetFile = (f) => {
        const validExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

        if (validExtensions.includes(ext)) {
            setFile(f);
            setError(null);
            setStatus('idle');
            setAnalysis(null);
        } else {
            setError('Invalid file type. Please upload MP3, WAV, FLAC, OGG, or M4A.');
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        setStatus('uploading');
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://127.0.0.1:8000/api/mixing/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Analysis failed');
            }

            setStatus('analyzing');
            // Simulate a short delay for UX if analysis is too fast
            await new Promise(r => setTimeout(r, 500));

            const data = await response.json();
            setAnalysis(data);
            setStatus('completed');

        } catch (err) {
            console.error("Analysis Error:", err);
            setError(err.message);
            setStatus('failed');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'text-red-400 border-red-900 bg-red-900 bg-opacity-20';
            case 'medium': return 'text-yellow-400 border-yellow-900 bg-yellow-900 bg-opacity-20';
            case 'low': return 'text-blue-400 border-blue-900 bg-blue-900 bg-opacity-20';
            default: return 'text-green-400 border-green-900 bg-green-900 bg-opacity-20';
        }
    };

    return (
        <div className="mixing-assistant p-6 bg-daw-panel rounded-lg h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-daw-text">🎚️ Mixing Assistant</h2>
            <p className="text-gray-400 text-sm mb-6">
                Upload your track to get AI-powered mixing suggestions (Levels, EQ, Balance).
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
                        accept=".mp3,.wav,.flac,.ogg,.m4a"
                        onChange={(e) => validateAndSetFile(e.target.files[0])}
                        className="hidden"
                        id="mixing-upload"
                    />
                    <label htmlFor="mixing-upload" className="cursor-pointer">
                        <div className="text-4xl mb-3">🎧</div>
                        <p className="text-gray-300 font-medium">
                            {file ? file.name : 'Drop audio file here to analyze'}
                        </p>
                    </label>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-900 text-red-100 rounded border border-red-700">
                    ⚠️ {error}
                </div>
            )}

            {file && status === 'idle' && (
                <button
                    onClick={handleAnalyze}
                    className="w-full py-3 bg-daw-accent text-black font-bold rounded hover:opacity-90 transition-opacity"
                >
                    🔍 Analyze Track
                </button>
            )}

            {(status === 'uploading' || status === 'analyzing') && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-daw-accent mb-4"></div>
                    <p className="text-gray-300 text-lg">
                        {status === 'uploading' ? 'Uploading...' : 'Analyzing Audio Spectrum...'}
                    </p>
                </div>
            )}

            {/* Results Dashboard */}
            {status === 'completed' && analysis && (
                <div className="results animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Analysis Results</h3>
                        <button
                            onClick={() => { setFile(null); setStatus('idle'); setAnalysis(null); }}
                            className="text-xs text-white font-bold hover:underline"
                        >
                            Analyze Another
                        </button>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-daw-bg p-4 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Loudness (RMS)</div>
                            <div className="text-2xl font-mono text-daw-accent">
                                {analysis.metrics.rms_db.toFixed(1)} <span className="text-sm">dB</span>
                            </div>
                        </div>
                        <div className="bg-daw-bg p-4 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Brightness</div>
                            <div className="text-2xl font-mono text-blue-400">
                                {Math.round(analysis.metrics.spectral_centroid)} <span className="text-sm">Hz</span>
                            </div>
                        </div>
                        <div className="bg-daw-bg p-4 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Bass Energy</div>
                            <div className="text-2xl font-mono text-purple-400">
                                {(analysis.metrics.bass_ratio * 100).toFixed(1)} <span className="text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Suggestions List */}
                    <div className="space-y-3">
                        {analysis.suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded border-l-4 ${getSeverityColor(suggestion.severity)}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-xl">
                                        {suggestion.type === 'volume' && '🔊'}
                                        {suggestion.type === 'eq' && '🎚️'}
                                        {suggestion.type === 'compression' && '📉'}
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-200">{suggestion.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {analysis.suggestions.length === 0 && (
                            <div className="p-4 bg-green-900 bg-opacity-20 border border-green-800 rounded text-green-400 text-center">
                                ✅ No major issues detected. Great mix!
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MixingAssistant;
