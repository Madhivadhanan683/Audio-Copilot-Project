import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import DAWState from './components/DAWState';
import SettingsModal from './components/SettingsModal';
import AssetBrowser from './components/AssetBrowser';
import StemSeparator from './components/StemSeparator';
import AudioToMidi from './components/AudioToMidi';
import MixingAssistant from './components/MixingAssistant';
import PluginRecommender from './components/PluginRecommender';
import LyricsAssistant from './components/LyricsAssistant';
import './index.css';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'stems', 'midi'
  const [dawState, setDawState] = useState({
    connected: false,
    bpm: 120,
    key: 'C Major',
    tracks: []
  });

  const ws = useRef(null);

  useEffect(() => {
    const connectWebSocket = () => {
      ws.current = new WebSocket('ws://localhost:8000/ws/daw');

      ws.current.onopen = () => {
        console.log('Connected to DAW WS');
        setDawState(prev => ({ ...prev, connected: true }));
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATUS_UPDATE') {
            setDawState(prev => ({ ...prev, connected: data.payload.connected }));
          } else if (data.type === 'STATE_UPDATE') {
            setDawState(prev => ({ ...prev, ...data.payload }));
          }
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };

      ws.current.onclose = () => {
        setDawState(prev => ({ ...prev, connected: false }));
      };

      ws.current.onerror = (err) => {
        console.error("WS Error", err);
      };
    };

    connectWebSocket();
    return () => { if (ws.current) ws.current.close(); };
  }, []);

  return (
    <div className="app-container">
      <header>
        <h1>Audio Copilot</h1>
        <div className="header-actions flex items-center gap-4">
          {/* Tab Navigation */}
          <nav className="tab-nav flex gap-1 bg-daw-bg rounded-lg p-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`tab-btn px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'chat'
                ? 'bg-daw-accent text-black'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab('stems')}
              className={`tab-btn px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'stems'
                ? 'bg-daw-accent text-black'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              🎵 Stem Separator
            </button>
            <button
              onClick={() => setActiveTab('midi')}
              className={`tab-btn px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'midi'
                ? 'bg-daw-accent text-black'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              🎹 Audio to MIDI
            </button>
            <button
              onClick={() => setActiveTab('mixing')}
              className={`tab-btn px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mixing'
                ? 'bg-daw-accent text-black'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              🎚️ Mixing Assistant
            </button>
            <button
              onClick={() => setActiveTab('plugins')}
              className={`tab-btn px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'plugins'
                ? 'bg-daw-accent text-black'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              🧩 VST Recommender
            </button>
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`tab-btn px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'lyrics'
                ? 'bg-daw-accent text-black'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              🎤 Lyrics
            </button>
          </nav>
          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>⚙️ Settings</button>
        </div>
      </header>
      <main>
        <div className="left-panel">
          <DAWState state={dawState} />
          <AssetBrowser />
        </div>

        {/* Conditionally render based on active tab */}
        {activeTab === 'chat' && <ChatInterface />}
        {activeTab === 'stems' && <StemSeparator />}
        {activeTab === 'midi' && <AudioToMidi />}
        {activeTab === 'mixing' && <MixingAssistant />}
        {activeTab === 'plugins' && <PluginRecommender />}
        {activeTab === 'lyrics' && <LyricsAssistant />}

      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default App;
