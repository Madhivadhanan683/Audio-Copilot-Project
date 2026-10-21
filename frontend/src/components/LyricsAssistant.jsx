import React, { useState } from 'react';
import { apiUrl } from '../lib/api';

const LyricsAssistant = () => {
    // Generator State
    const [topic, setTopic] = useState('');
    const [mood, setMood] = useState('');
    const [genre, setGenre] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Editor State
    const [lyrics, setLyrics] = useState('');

    // Rhyme Finder State
    const [rhymeWord, setRhymeWord] = useState('');
    const [rhymes, setRhymes] = useState([]);
    const [isRhyming, setIsRhyming] = useState(false);

    const handleGenerate = async () => {
        if (!topic || !mood || !genre) return;

        setIsGenerating(true);
        try {
            const response = await fetch(apiUrl('/api/lyrics/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topic, mood, genre }),
            });

            if (response.ok) {
                const data = await response.json();
                // Append generated lyrics to current editor content
                setLyrics(prev => prev + (prev ? '\n\n' : '') + data.lyrics);
            }
        } catch (error) {
            console.error("Error generating lyrics:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFindRhymes = async (e) => {
        e.preventDefault();
        if (!rhymeWord) return;

        setIsRhyming(true);
        try {
            const response = await fetch(apiUrl(`/api/lyrics/rhyme/${encodeURIComponent(rhymeWord)}`));
            if (response.ok) {
                const data = await response.json();
                setRhymes(data.rhymes || []);
            }
        } catch (error) {
            console.error("Error finding rhymes:", error);
        } finally {
            setIsRhyming(false);
        }
    };

    return (
        <div className="lyrics-assistant h-full flex flex-col md:flex-row gap-6 p-6 bg-daw-panel rounded-lg overflow-y-auto">

            {/* Left Panel: Tools */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">

                {/* Generator */}
                <div className="bg-daw-bg p-5 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-bold text-daw-text mb-4">✨ Lyrics Generator</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Topic / Theme</label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g., Space Travel, Heartbreak"
                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-daw-accent focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Mood</label>
                            <input
                                type="text"
                                value={mood}
                                onChange={(e) => setMood(e.target.value)}
                                placeholder="e.g., Melancholic, Upbeat"
                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-daw-accent focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Genre</label>
                            <input
                                type="text"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                placeholder="e.g., Pop, EDM, Rock"
                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-daw-accent focus:outline-none"
                            />
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !topic || !mood || !genre}
                            className={`w-full py-2 rounded font-bold text-sm transition-opacity ${(isGenerating || !topic || !mood || !genre)
                                    ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400'
                                    : 'bg-daw-accent text-black hover:opacity-90'
                                }`}
                        >
                            {isGenerating ? 'Generating...' : 'Generate Ideas'}
                        </button>
                    </div>
                </div>

                {/* Rhyme Finder */}
                <div className="bg-daw-bg p-5 rounded-lg border border-gray-700 flex-grow">
                    <h3 className="text-lg font-bold text-daw-text mb-4">📖 Rhyme Finder</h3>

                    <form onSubmit={handleFindRhymes} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={rhymeWord}
                            onChange={(e) => setRhymeWord(e.target.value)}
                            placeholder="Word to rhyme..."
                            className="flex-grow min-w-0 bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-daw-accent focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isRhyming || !rhymeWord}
                            className="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600 flex-shrink-0"
                        >
                            🔍
                        </button>
                    </form>

                    <div className="flex flex-wrap gap-2">
                        {rhymes.map((word, i) => (
                            <span
                                key={i}
                                className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded border border-gray-600 hover:border-daw-accent cursor-pointer"
                                onClick={() => setLyrics(prev => prev + ' ' + word)}
                                title="Click to add to editor"
                            >
                                {word}
                            </span>
                        ))}
                        {rhymes.length === 0 && !isRhyming && (
                            <p className="text-gray-600 text-sm italic">Enter a word to find rhymes.</p>
                        )}
                        {isRhyming && (
                            <p className="text-gray-400 text-sm animate-pulse">Searching...</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Editor */}
            <div className="w-full md:w-2/3 bg-daw-bg p-6 rounded-lg border border-gray-700 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4">Lyrics Editor</h3>
                <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Start writing or generate lyrics..."
                    className="flex-grow w-full bg-gray-900 border border-gray-800 rounded p-4 text-gray-200 font-mono focus:border-daw-accent focus:outline-none resize-none leading-relaxed"
                    spellCheck="false"
                />
                <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                    <span>{lyrics.split(/\s+/).filter(w => w.length > 0).length} words</span>
                    <button
                        onClick={() => navigator.clipboard.writeText(lyrics)}
                        className="px-3 py-1 bg-gray-800 hover:bg-daw-accent hover:text-black text-daw-accent rounded transition-colors"
                    >
                        Copy to Clipboard
                    </button>
                </div>
            </div>

        </div>
    );
};

export default LyricsAssistant;
