import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import DAWState from './components/DAWState';
import DAWPlugin from './components/DAWPlugin';
import SettingsModal from './components/SettingsModal';
import AssetBrowser from './components/AssetBrowser';
import StemSeparator from './components/StemSeparator';
import AudioToMidi from './components/AudioToMidi';
import MixingAssistant from './components/MixingAssistant';
import PluginRecommender from './components/PluginRecommender';
import LyricsAssistant from './components/LyricsAssistant';
import VoiceMemo from './components/VoiceMemo';
import ArrangementSuggester from './components/ArrangementSuggester';
import HumanizeMidi from './components/HumanizeMidi';
import SampleLibrary from './components/SampleLibrary';
import PresetGenerator from './components/PresetGenerator';
import CollaborativeSession from './components/CollaborativeSession';
import ExportAssistant from './components/ExportAssistant';
import AICoProducers from './components/AICoProducers';
import './index.css';

const NAV_ITEMS = [
  { key: 'chat', icon: '💬', label: 'Chat' },
  { key: 'personas', icon: '👤', label: 'AI Co-Producers' },
  { key: 'dawplugin', icon: '🔌', label: 'DAW Plugin' },
  { key: 'stems', icon: '🎵', label: 'Stem Separator' },
  { key: 'midi', icon: '🎹', label: 'Audio to MIDI' },
  { key: 'mixing', icon: '🎚️', label: 'Mixing Assistant' },
  { key: 'plugins', icon: '🧩', label: 'VST Recommender' },
  { key: 'lyrics', icon: '🎤', label: 'Lyrics' },
  { key: 'voice', icon: '🎙️', label: 'Voice Memos' },
  { key: 'arrangement', icon: '🏗️', label: 'Arrangement' },
  { key: 'humanize', icon: '🎭', label: 'Humanize MIDI' },
  { key: 'samples', icon: '🗂️', label: 'Sample Library' },
  { key: 'presets', icon: '🎹', label: 'Preset Generator' },
  { key: 'collab', icon: '🤝', label: 'Collab Mode' },
  { key: 'export', icon: '📤', label: 'Export Assistant' },
];

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('personas');
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPersona, setCurrentPersona] = useState(null);
  const menuRef = useRef(null);
  const [showAssets, setShowAssets] = useState(false);
  const [dawState, setDawState] = useState({
    connected: false,
    bpm: 120,
    key: 'C Major',
    tracks: []
  });

  const ws = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const activeItem = NAV_ITEMS.find(item => item.key === activeTab) || NAV_ITEMS[0];

  const handleTabSelect = (key) => {
    setActiveTab(key);
    setMenuOpen(false);
  };

  return (
    <div className="app-container">
      <header>
        <div className="flex items-center gap-4">
          <h1>Audio Copilot</h1>
          {currentPersona && (
            <div className="hidden md:flex items-center gap-2 bg-indigo-900/40 px-3 py-1 rounded-full border border-indigo-500/30">
              <img src={currentPersona.avatar} alt="Avatar" className="w-5 h-5 rounded-full" />
              <span className="text-sm text-indigo-300">with {currentPersona.name}</span>
            </div>
          )}
        </div>
        <div className="header-actions flex items-center gap-3">
          {/* Hamburger Menu */}
          <div className="hamburger-menu" ref={menuRef}>
            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Navigation menu"
            >
              <span className="hamburger-icon">
                <span className={`bar ${menuOpen ? 'open' : ''}`}></span>
                <span className={`bar ${menuOpen ? 'open' : ''}`}></span>
                <span className={`bar ${menuOpen ? 'open' : ''}`}></span>
              </span>
              <span className="active-tab-label">{activeItem.icon} {activeItem.label}</span>
            </button>

            {menuOpen && (
              <div className="hamburger-dropdown">
                {NAV_ITEMS.map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleTabSelect(item.key)}
                    className={`hamburger-item ${activeTab === item.key ? 'active' : ''}`}
                  >
                    <span className="item-icon">{item.icon}</span>
                    <span className="item-label">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compact DAW Status */}
          <div className="hidden lg:flex items-center gap-4 bg-gray-900/60 px-4 py-1.5 rounded-full border border-gray-700/50">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${dawState.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
              <span className="text-[10px] font-bold tracking-wider text-gray-400">{dawState.connected ? 'DAW ONLINE' : 'DAW OFFLINE'}</span>
            </div>
            <div className="w-px h-4 bg-gray-700"></div>
            <div className="flex items-center gap-3 text-xs text-gray-300">
              <span><strong className="text-cyan-400">{dawState.bpm}</strong> BPM</span>
              <span><strong className="text-purple-400">{dawState.key}</strong></span>
            </div>
          </div>

          <button 
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showAssets ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            onClick={() => setShowAssets(!showAssets)}
          >
            🗂️ Assets
          </button>

          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>⚙️ Settings</button>
        </div>
      </header>
      <main>
        {showAssets && (
          <div className="left-panel">
            <AssetBrowser />
          </div>
        )}

        {/* Conditionally render based on active tab */}
        {activeTab === 'chat' && <ChatInterface currentPersona={currentPersona} dawState={dawState} />}
        {activeTab === 'personas' && <AICoProducers currentPersona={currentPersona} setCurrentPersona={(p) => { setCurrentPersona(p); setActiveTab('chat'); }} />}
        {activeTab === 'dawplugin' && <DAWPlugin dawState={dawState} />}
        {activeTab === 'stems' && <StemSeparator />}
        {activeTab === 'midi' && <AudioToMidi />}
        {activeTab === 'mixing' && <MixingAssistant />}
        {activeTab === 'plugins' && <PluginRecommender />}
        {activeTab === 'lyrics' && <LyricsAssistant />}
        {activeTab === 'voice' && <VoiceMemo />}
        {activeTab === 'arrangement' && <ArrangementSuggester />}
        {activeTab === 'humanize' && <HumanizeMidi />}
        {activeTab === 'samples' && <SampleLibrary />}
        {activeTab === 'presets' && <PresetGenerator />}
        {activeTab === 'collab' && <CollaborativeSession />}
        {activeTab === 'export' && <ExportAssistant />}

      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default App;
