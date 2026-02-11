import React from 'react';

const AssetBrowser = () => {
    const assets = [
        { id: 1, name: 'Kick_01.wav', type: 'audio' },
        { id: 2, name: 'Snare_04.wav', type: 'audio' },
        { id: 3, name: 'Bass_Loop_124bpm.wav', type: 'audio' },
    ];

    return (
        <div className="asset-browser">
            <h3>Generated Assets</h3>
            <div className="asset-list">
                {assets.map(asset => (
                    <div key={asset.id} className="asset-item" draggable>
                        <span className="icon">🎵</span>
                        <span className="name">{asset.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AssetBrowser;
