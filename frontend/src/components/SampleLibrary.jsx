import React, { useState, useRef } from 'react';
import { apiUrl } from '../lib/api';

const SampleLibrary = () => {
    const [folderPath, setFolderPath] = useState('');
    const [samples, setSamples] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    
    // For audio playback
    const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
    const audioRef = useRef(null);

    const handleScan = async () => {
        if (!folderPath) {
            setError("Please enter a folder path.");
            return;
        }

        setIsLoading(true);
        setError('');
        setSamples([]);

        try {
            const response = await fetch(apiUrl('/api/samples/scan'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ folder_path: folderPath }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to scan directory');
            }

            const data = await response.json();
            setSamples(data.samples || []);
            
            if (data.samples && data.samples.length === 0) {
                 setError("No supported audio files found in this directory.");
            }
        } catch (err) {
            console.error("Scan error:", err);
            setError(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlay = (sample) => {
        if (currentlyPlaying?.id === sample.id) {
            // Toggle play/pause if it's the same sample
            if (audioRef.current) {
                if (audioRef.current.paused) {
                    audioRef.current.play();
                } else {
                    audioRef.current.pause();
                }
            }
        } else {
            // Play new sample
            setCurrentlyPlaying(sample);
            // We use setTimeout to allow the audio element src to update before calling play()
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.play().catch(e => console.error("Playback error", e));
                }
            }, 50);
        }
    };

    // Filter samples based on selected category
    const filteredSamples = samples.filter(sample => 
        filterCategory === 'All' || sample.category === filterCategory
    );

    // Get unique categories for the filter dropdown
    const categories = ['All', ...new Set(samples.map(s => s.category).filter(Boolean))];

    return (
        <div className="sample-library-container p-6 bg-gray-800 text-white rounded-lg shadow-xl max-w-5xl mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-6 text-center text-daw-accent">Sample Library Auto-Tagging</h2>

            {/* Hidden audio element for playback */}
            <audio 
                ref={audioRef} 
                src={currentlyPlaying ? apiUrl(`/api/samples/audio?path=${encodeURIComponent(currentlyPlaying.path)}`) : ''}
                onEnded={() => setCurrentlyPlaying(null)}
            />

            <div className="controls-section bg-gray-700 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-end mb-6">
                <div className="w-full md:w-3/4">
                    <label className="block text-sm font-semibold mb-2">Local Folder Path</label>
                    <input
                        type="text"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        placeholder="e.g., C:\Users\Name\Music\Samples or /Users/Name/Music/Samples"
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-daw-accent"
                    />
                </div>
                <button
                    onClick={handleScan}
                    disabled={isLoading}
                    className="w-full md:w-1/4 px-4 py-2 bg-daw-accent text-gray-900 font-bold rounded hover:bg-daw-accent-hover transition-colors disabled:opacity-50"
                >
                    {isLoading ? 'Scanning...' : 'Scan Folder'}
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded text-red-200">
                    {error}
                </div>
            )}

            {samples.length > 0 && (
                <div className="results-section bg-gray-700 p-4 rounded-lg flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Found {samples.length} Samples</h3>
                        
                        <div className="flex items-center gap-2">
                            <label className="text-sm">Filter Category:</label>
                            <select 
                                value={filterCategory} 
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="bg-gray-900 border border-gray-600 rounded p-1 text-sm focus:outline-none focus:border-daw-accent"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 bg-gray-900 rounded border border-gray-600">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-800 sticky top-0 shadow">
                                <tr>
                                    <th className="p-3 w-12">Play</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3 w-24">Category</th>
                                    <th className="p-3 w-20">BPM</th>
                                    <th className="p-3 w-20">Key</th>
                                    <th className="p-3 w-24">Size (MB)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSamples.map((sample, index) => (
                                    <tr 
                                        key={sample.id} 
                                        className={`border-b border-gray-800/50 hover:bg-gray-800 transition-colors ${
                                            currentlyPlaying?.id === sample.id ? 'bg-gray-800 border-l-2 border-l-daw-accent' : ''
                                        }`}
                                    >
                                        <td className="p-3">
                                            <button 
                                                onClick={() => handlePlay(sample)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-daw-accent hover:text-gray-900 transition-colors"
                                                title="Preview audio"
                                            >
                                                {currentlyPlaying?.id === sample.id && audioRef.current && !audioRef.current.paused ? '⏸' : '▶'}
                                            </button>
                                        </td>
                                        <td className="p-3 font-medium truncate max-w-[200px]" title={sample.filename}>
                                            {sample.name}
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 border border-gray-600">
                                                {sample.category}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-400">
                                            {sample.bpm ? <span className="text-blue-300 font-mono">{sample.bpm}</span> : '-'}
                                        </td>
                                        <td className="p-3 text-gray-400">
                                            {sample.key ? <span className="text-purple-300 font-mono">{sample.key}</span> : '-'}
                                        </td>
                                        <td className="p-3 text-gray-500">
                                            {sample.size_mb}
                                        </td>
                                    </tr>
                                ))}
                                {filteredSamples.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-500">
                                            No samples match the selected category.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SampleLibrary;
