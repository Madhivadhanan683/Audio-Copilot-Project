import React, { useState } from 'react';
import { apiUrl } from '../lib/api';

const PresetGenerator = () => {
    const [synth, setSynth] = useState('vital');
    const [style, setStyle] = useState('pad');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastGenerated, setLastGenerated] = useState(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setLastGenerated(null);

        try {
            const response = await fetch(apiUrl('/api/presets/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ synth, style }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to generate preset');
            }

            const presetData = await response.json();
            
            // Format the JSON with 2 spaces for readability, as Vital does
            const jsonString = JSON.stringify(presetData, null, 2);
            
            // Create a Blob from the JSON string
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Create a download link and trigger it
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Format filename: e.g. "Audio_Copilot_Bass_Preset.vital"
            const filename = `Audio_Copilot_${style.charAt(0).toUpperCase() + style.slice(1)}_Preset.vital`;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setLastGenerated(filename);
            
        } catch (err) {
            console.error("Preset generation error:", err);
            setError(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="preset-generator-container p-6 bg-gray-800 text-white rounded-lg shadow-xl max-w-2xl mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-6 text-center text-daw-accent">Synth Preset Generator</h2>
            <p className="text-gray-400 text-center mb-8">
                Instantly generate unique synth patches mapped with macros, ready to drag and drop into your favorite synthesizer.
            </p>

            <div className="settings-controls flex flex-col md:flex-row gap-6 mb-8 justify-center">
                <div className="control-group flex flex-col w-full md:w-1/3">
                    <label className="text-sm font-semibold mb-2 text-gray-300">Target Synthesizer</label>
                    <div className="relative">
                        <select 
                            value={synth} 
                            onChange={(e) => setSynth(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white appearance-none focus:outline-none focus:border-daw-accent transition-colors"
                        >
                            <option value="vital">Matt Tytel Vital (.vital)</option>
                            <option value="serum" disabled>Xfer Serum (.fxp) - Coming Soon</option>
                            <option value="massive" disabled>NI Massive (.nmsv) - Coming Soon</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>

                <div className="control-group flex flex-col w-full md:w-1/3">
                    <label className="text-sm font-semibold mb-2 text-gray-300">Preset Style</label>
                    <div className="relative">
                        <select 
                            value={style} 
                            onChange={(e) => setStyle(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white appearance-none focus:outline-none focus:border-daw-accent transition-colors"
                        >
                            <option value="bass">Heavy Bass</option>
                            <option value="pad">Ethereal Pad</option>
                            <option value="lead">Cutting Lead</option>
                            <option value="pluck">Tight Pluck</option>
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="action-section flex flex-col items-center">
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="px-8 py-4 bg-daw-accent text-gray-900 font-bold text-lg rounded-full hover:bg-daw-accent-hover hover:scale-105 transform transition-all shadow-lg disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin text-xl">⚙️</span> Generating...
                        </>
                    ) : (
                        '✨ Generate & Download Preset'
                    )}
                </button>

                {error && (
                    <div className="mt-6 p-4 bg-red-900/50 border border-red-500 rounded text-red-200 w-full text-center">
                        {error}
                    </div>
                )}

                {lastGenerated && !isLoading && !error && (
                    <div className="mt-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 w-full text-center flex flex-col items-center">
                        <div className="text-2xl mb-2">🎉</div>
                        <p className="font-semibold text-lg">Success!</p>
                        <p className="text-sm mt-1 text-green-400/80">
                            Generated <strong>{lastGenerated}</strong>. <br/>
                            Check your downloads folder and drag it into Vital!
                        </p>
                    </div>
                )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-700">
                 <h3 className="text-sm font-semibold text-gray-400 mb-3 text-center">How it works</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
                    <div className="bg-gray-900/50 p-3 rounded">
                        <strong className="block text-gray-300 mb-1">1. AI Templating</strong>
                        Selects base waveshapes, filters, and envelope characteristics typical for the chosen style.
                    </div>
                    <div className="bg-gray-900/50 p-3 rounded">
                        <strong className="block text-gray-300 mb-1">2. Parameter Randomization</strong>
                        Subtly randomizes macros, detune, LFO rates, and fx mixes for unique character.
                    </div>
                    <div className="bg-gray-900/50 p-3 rounded">
                        <strong className="block text-gray-300 mb-1">3. Native Format Export</strong>
                        Packages everything immediately into the synth's native file extension.
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default PresetGenerator;
