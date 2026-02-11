import React, { useState, useCallback } from 'react';

const PluginRecommender = () => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle', 'uploading', 'analyzing', 'completed', 'failed'
    const [results, setResults] = useState(null);
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
            setResults(null);
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
            const response = await fetch('http://127.0.0.1:8000/api/plugins/recommend', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Analysis failed');
            }

            setStatus('analyzing');
            // Simulate a short delay for UX
            await new Promise(r => setTimeout(r, 800));

            const data = await response.json();
            setResults(data);
            setStatus('completed');

        } catch (err) {
            console.error("Plugin Recommender Error:", err);
            setError(err.message);
            setStatus('failed');
        }
    };

    const getPluginTagColor = (tag) => {
        if (['free', 'vintage'].includes(tag)) return 'bg-green-900 text-green-300 border-green-700';
        if (['paid'].includes(tag)) return 'bg-purple-900 text-purple-300 border-purple-700';
        return 'bg-gray-700 text-gray-300 border-gray-600';
    };

    return (
        <div className="plugin-recommender p-6 bg-daw-panel rounded-lg h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-daw-text">🎹 VST Plugin Recommender</h2>
            <p className="text-gray-400 text-sm mb-6">
                Upload your audio to get AI-powered plugin recommendations tailored to your sound's needs.
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
                        id="plugin-upload"
                    />
                    <label htmlFor="plugin-upload" className="cursor-pointer">
                        <div className="text-4xl mb-3">🧩</div>
                        <p className="text-gray-300 font-medium">
                            {file ? file.name : 'Drop audio file here to identify needs'}
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
                    🔍 Find Perfect Plugins
                </button>
            )}

            {(status === 'uploading' || status === 'analyzing') && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-daw-accent mb-4"></div>
                    <p className="text-gray-300 text-lg">
                        {status === 'uploading' ? 'Uploading...' : 'Scanning audio profile...'}
                    </p>
                </div>
            )}

            {/* Results */}
            {status === 'completed' && results && (
                <div className="results animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Recommended Plugins</h3>
                        <button
                            onClick={() => { setFile(null); setStatus('idle'); setResults(null); }}
                            className="text-xs text-white font-bold hover:underline"
                        >
                            Start Over
                        </button>
                    </div>

                    {/* Analysis Summary */}
                    <div className="mb-8 p-4 bg-daw-bg rounded border border-gray-700">
                        <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Audio Profile Detected</h4>
                        <div className="flex flex-wrap gap-2">
                            {results.analysis.suggestions.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-600">
                                    {s.text}
                                </span>
                            ))}
                            {results.analysis.suggestions.length === 0 && (
                                <span className="text-gray-500 italic text-sm">Balanced audio profile detected.</span>
                            )}
                        </div>
                    </div>

                    {/* Plugin Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.recommendations.map((plugin, index) => (
                            <div key={index} className="bg-daw-bg p-5 rounded-lg border border-gray-700 hover:border-daw-accent transition-colors group flex flex-col h-full">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded border ${plugin.price === 'Free' ? 'bg-green-900 border-green-700 text-green-300' : 'bg-blue-900 border-blue-700 text-blue-300'}`}>
                                        {plugin.price}
                                    </span>
                                    <span className="text-gray-500 text-xs">{plugin.type}</span>
                                </div>

                                <h4 className="text-lg font-bold text-white mb-2 group-hover:text-daw-accent transition-colors">
                                    {plugin.name}
                                </h4>

                                <p className="text-gray-400 text-sm mb-4 flex-grow">
                                    {plugin.description}
                                </p>

                                <div className="flex flex-wrap gap-1 mb-4">
                                    {plugin.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>

                                <a
                                    href={plugin.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-2 text-center bg-gray-700 hover:bg-daw-accent hover:text-black text-gray-200 rounded transition-all text-sm font-semibold"
                                >
                                    View Plugin ↗
                                </a>
                            </div>
                        ))}
                    </div>

                    {results.recommendations.length === 0 && (
                        <div className="bg-gray-800 p-8 rounded text-center text-gray-400">
                            No specific recommendations for this audio profile. It might be already well-balanced!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PluginRecommender;
