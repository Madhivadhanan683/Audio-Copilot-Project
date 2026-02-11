import React from 'react';

const DAWState = ({ state }) => {
    const { connected, bpm, key, tracks } = state;

    return (
        <div className="daw-state p-4 bg-daw-panel rounded-lg mb-4 border border-gray-700">
            <div className="header flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-daw-text">DAW Status</h2>
                <div className="connection-status flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                    <span className="text-xs text-gray-400">{connected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="stat-box bg-daw-bg p-3 rounded border border-gray-600">
                    <span className="text-xs text-gray-400 block">BPM</span>
                    <span className="text-xl font-mono text-daw-accent">{bpm}</span>
                </div>
                <div className="stat-box bg-daw-bg p-3 rounded border border-gray-600">
                    <span className="text-xs text-gray-400 block">Key</span>
                    <span className="text-xl font-mono text-daw-secondary">{key}</span>
                </div>
            </div>

            <div className="tracks-list">
                <h3 className="text-xs uppercase text-gray-500 mb-2 font-bold tracking-wider">Active Tracks ({tracks.length})</h3>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                    {tracks.length === 0 ? (
                        <p className="text-sm text-gray-600 italic">No tracks detected.</p>
                    ) : (
                        tracks.map((track, i) => (
                            <div key={i} className="track-item flex items-center justify-between bg-daw-bg p-2 rounded border border-gray-700 hover:border-daw-accent transition-colors">
                                <span className="text-sm text-gray-300">{track}</span>
                                <div className="h-1 w-12 bg-gray-700 rounded overflow-hidden">
                                    <div className="h-full bg-daw-accent opacity-50 w-[60%] animate-pulse"></div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default DAWState;
