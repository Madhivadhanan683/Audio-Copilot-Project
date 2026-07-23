import React, { useState, useCallback } from 'react';

const ArrangementSuggester = () => {
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
            const response = await fetch('http://127.0.0.1:8000/api/arrangement/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Analysis failed');
            }

            setStatus('analyzing');
            await new Promise(r => setTimeout(r, 500));

            const data = await response.json();
            setAnalysis(data);
            setStatus('completed');

        } catch (err) {
            console.error("Arrangement Analysis Error:", err);
            setError(err.message);
            setStatus('failed');
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getEnergyColor = (level) => {
        switch (level) {
            case 'high': return { bg: '#ef4444', label: 'text-red-300' };    // Red
            case 'medium': return { bg: '#f59e0b', label: 'text-yellow-300' }; // Amber
            case 'low': return { bg: '#3b82f6', label: 'text-blue-300' };    // Blue
            default: return { bg: '#6b7280', label: 'text-gray-300' };
        }
    };

    const getSeverityStyle = (severity) => {
        switch (severity) {
            case 'high': return 'text-red-400 border-red-900 bg-red-900 bg-opacity-20';
            case 'medium': return 'text-yellow-400 border-yellow-900 bg-yellow-900 bg-opacity-20';
            case 'low': return 'text-blue-400 border-blue-900 bg-blue-900 bg-opacity-20';
            default: return 'text-green-400 border-green-900 bg-green-900 bg-opacity-20';
        }
    };

    const getSuggestionIcon = (type) => {
        switch (type) {
            case 'intro': return '🚪';
            case 'drop': return '💥';
            case 'dynamics': return '📊';
            case 'outro': return '🏁';
            case 'structure': return '🧱';
            default: return '💡';
        }
    };

    return (
        <div className="arrangement-suggester p-6 bg-daw-panel rounded-lg h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-daw-text">🏗️ Arrangement Suggester</h2>
            <p className="text-gray-400 text-sm mb-6">
                Upload your track to get AI-powered arrangement advice — section analysis, structural tips, and more.
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
                        id="arrangement-upload"
                    />
                    <label htmlFor="arrangement-upload" className="cursor-pointer">
                        <div className="text-4xl mb-3">🏗️</div>
                        <p className="text-gray-300 font-medium">
                            {file ? file.name : 'Drop audio file here to analyze arrangement'}
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
                    🔍 Analyze Arrangement
                </button>
            )}

            {(status === 'uploading' || status === 'analyzing') && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-daw-accent mb-4"></div>
                    <p className="text-gray-300 text-lg">
                        {status === 'uploading' ? 'Uploading...' : 'Analyzing Song Structure...'}
                    </p>
                </div>
            )}

            {/* Results */}
            {status === 'completed' && analysis && (
                <div className="results animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Arrangement Analysis</h3>
                        <button
                            onClick={() => { setFile(null); setStatus('idle'); setAnalysis(null); }}
                            className="text-xs text-white font-bold hover:underline"
                        >
                            Analyze Another
                        </button>
                    </div>

                    {/* Overview Metrics */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Duration</div>
                            <div className="text-lg font-mono text-daw-accent">
                                {formatTime(analysis.overview.duration)}
                            </div>
                        </div>
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Tempo</div>
                            <div className="text-lg font-mono text-blue-400">
                                {analysis.overview.tempo} <span className="text-xs">BPM</span>
                            </div>
                        </div>
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Sections</div>
                            <div className="text-lg font-mono text-purple-400">
                                {analysis.overview.total_sections}
                            </div>
                        </div>
                        <div className="bg-daw-bg p-3 rounded border border-gray-700 text-center">
                            <div className="text-gray-500 text-xs mb-1">Beats</div>
                            <div className="text-lg font-mono text-yellow-400">
                                {analysis.overview.total_beats}
                            </div>
                        </div>
                    </div>

                    {/* Section Timeline */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Song Structure Timeline</h4>
                        <div className="flex rounded-lg overflow-hidden h-14 border border-gray-700">
                            {analysis.sections.map((section, idx) => {
                                const widthPercent = (section.duration / analysis.overview.duration) * 100;
                                const colors = getEnergyColor(section.energy_level);
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            width: `${widthPercent}%`,
                                            backgroundColor: colors.bg,
                                            minWidth: '20px'
                                        }}
                                        className="relative group flex items-center justify-center border-r border-gray-900 border-opacity-40 transition-all hover:brightness-125 cursor-pointer"
                                        title={`${section.label} (${formatTime(section.start)} - ${formatTime(section.end)})`}
                                    >
                                        {widthPercent > 8 && (
                                            <span className="text-white text-xs font-bold drop-shadow-lg truncate px-1">
                                                {section.label.split(' / ')[0]}
                                            </span>
                                        )}
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-gray-700">
                                            <div className="font-bold">{section.label}</div>
                                            <div>{formatTime(section.start)} – {formatTime(section.end)}</div>
                                            <div>Energy: {section.energy_db} dB</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Legend */}
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></span> High Energy
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></span> Medium
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></span> Low Energy
                            </span>
                        </div>
                    </div>

                    {/* Section Details Table */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Section Details</h4>
                        <div className="bg-daw-bg rounded border border-gray-700 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 border-b border-gray-700">
                                        <th className="text-left px-4 py-2">#</th>
                                        <th className="text-left px-4 py-2">Label</th>
                                        <th className="text-left px-4 py-2">Time</th>
                                        <th className="text-left px-4 py-2">Duration</th>
                                        <th className="text-left px-4 py-2">Energy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysis.sections.map((section, idx) => {
                                        const colors = getEnergyColor(section.energy_level);
                                        return (
                                            <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                                                <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                                                <td className="px-4 py-2">
                                                    <span className="flex items-center gap-2">
                                                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colors.bg }}></span>
                                                        <span className="text-gray-200">{section.label}</span>
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 font-mono text-gray-400">
                                                    {formatTime(section.start)} – {formatTime(section.end)}
                                                </td>
                                                <td className="px-4 py-2 font-mono text-gray-400">{section.duration}s</td>
                                                <td className={`px-4 py-2 font-mono ${colors.label}`}>
                                                    {section.energy_db} dB
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Arrangement Suggestions */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Arrangement Suggestions</h4>
                        <div className="space-y-3">
                            {analysis.suggestions.map((suggestion, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded border-l-4 ${getSeverityStyle(suggestion.severity)}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-xl">{getSuggestionIcon(suggestion.type)}</span>
                                        <div>
                                            <p className="font-medium text-gray-200">{suggestion.text}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {analysis.suggestions.length === 0 && (
                                <div className="p-4 bg-green-900 bg-opacity-20 border border-green-800 rounded text-green-400 text-center">
                                    ✅ Your arrangement looks great! No major suggestions.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArrangementSuggester;
