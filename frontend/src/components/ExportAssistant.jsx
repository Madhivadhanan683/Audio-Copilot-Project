import React, { useState } from 'react';
import { apiUrl } from '../lib/api';

const ExportAssistant = () => {
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setResult(null);
        setError(null);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(apiUrl('/api/export/analyze'), {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Analysis failed');
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getPlatformColor = (status) => {
        if (status === 'pass') return 'border-green-500 bg-green-900/20';
        if (status === 'too_loud') return 'border-yellow-500 bg-yellow-900/20';
        return 'border-red-500 bg-red-900/20';
    };

    const getPlatformBadge = (status) => {
        if (status === 'pass') return { text: '✅ PASS', cls: 'text-green-400' };
        if (status === 'too_loud') return { text: '⚡ LOUD', cls: 'text-yellow-400' };
        return { text: '🔇 QUIET', cls: 'text-red-400' };
    };

    const getSeverityColor = (severity) => {
        if (severity === 'high') return 'border-l-red-500 bg-red-900/10';
        if (severity === 'medium') return 'border-l-yellow-500 bg-yellow-900/10';
        return 'border-l-blue-500 bg-blue-900/10';
    };

    return (
        <div className="export-assistant-container p-6 bg-gray-800 text-white rounded-lg shadow-xl max-w-4xl mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-2 text-center text-daw-accent">📤 Export / Rendering Assistant</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">
                Upload your final mix or master to check loudness, peaks, and platform compatibility before releasing.
            </p>

            {/* Upload Section */}
            <div className="upload-section bg-gray-700 p-6 rounded-lg flex flex-col md:flex-row items-end gap-4 mb-6">
                <div className="w-full md:w-3/4">
                    <label className="block text-sm font-semibold mb-2">Audio File</label>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                    />
                    {file && <p className="text-xs text-gray-400 mt-2">Selected: {file.name}</p>}
                </div>
                <button
                    onClick={handleAnalyze}
                    disabled={!file || isLoading}
                    className="w-full md:w-1/4 px-4 py-3 bg-daw-accent text-gray-900 font-bold rounded hover:bg-daw-accent-hover transition-colors disabled:opacity-50"
                >
                    {isLoading ? 'Analyzing...' : 'Analyze'}
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded text-red-200 text-center">
                    {error}
                </div>
            )}

            {/* Results Dashboard */}
            {result && (
                <div className="results-dashboard flex flex-col gap-6">

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="metric-card bg-gray-700 p-4 rounded-lg text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Loudness</div>
                            <div className="text-3xl font-mono font-bold text-blue-300">{result.metrics.lufs}</div>
                            <div className="text-xs text-gray-500">LUFS (est.)</div>
                        </div>
                        <div className="metric-card bg-gray-700 p-4 rounded-lg text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">True Peak</div>
                            <div className={`text-3xl font-mono font-bold ${result.metrics.true_peak_db > -1 ? 'text-red-400' : 'text-green-400'}`}>
                                {result.metrics.true_peak_db}
                            </div>
                            <div className="text-xs text-gray-500">dBFS</div>
                        </div>
                        <div className="metric-card bg-gray-700 p-4 rounded-lg text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Dynamic Range</div>
                            <div className="text-3xl font-mono font-bold text-purple-300">{result.metrics.dynamic_range_db}</div>
                            <div className="text-xs text-gray-500">dB</div>
                        </div>
                        <div className="metric-card bg-gray-700 p-4 rounded-lg text-center">
                            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Clipping</div>
                            <div className={`text-3xl font-mono font-bold ${result.metrics.clipping_samples > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {result.metrics.clipping_samples > 0 ? result.metrics.clipping_samples : 'None'}
                            </div>
                            <div className="text-xs text-gray-500">samples</div>
                        </div>
                    </div>

                    {/* Platform Compatibility */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Compatibility</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(result.platforms).map(([name, info]) => {
                                const badge = getPlatformBadge(info.status);
                                return (
                                    <div key={name} className={`p-4 rounded-lg border ${getPlatformColor(info.status)}`}>
                                        <div className="text-sm font-bold mb-1">{name}</div>
                                        <div className={`text-lg font-bold mb-1 ${badge.cls}`}>{badge.text}</div>
                                        <div className="text-xs text-gray-400">Target: {info.target_lufs} LUFS</div>
                                        <div className="text-xs text-gray-500 mt-1">{info.note}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Suggestions */}
                    {result.suggestions && result.suggestions.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Suggestions</h3>
                            <div className="flex flex-col gap-2">
                                {result.suggestions.map((s, i) => (
                                    <div key={i} className={`p-3 rounded border-l-4 ${getSeverityColor(s.severity)}`}>
                                        <span className="text-sm">{s.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* File Info Footer */}
                    <div className="text-xs text-gray-600 text-center pt-2 border-t border-gray-700">
                        Duration: {result.metrics.duration_seconds}s &nbsp;|&nbsp; Sample Rate: {result.metrics.sample_rate} Hz
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportAssistant;
