import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '../lib/api';

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusPill({ connected, relayConnected }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`status-pill ${connected ? 'status-online' : 'status-offline'}`}>
        <span className="status-dot" />
        <span>{connected ? 'WEB APP CONNECTED' : 'WEB APP OFFLINE'}</span>
      </div>
      <div className={`status-pill ${relayConnected ? 'status-relay' : 'status-offline'}`}>
        <span className="status-dot" />
        <span>{relayConnected ? 'FL STUDIO BRIDGE ACTIVE' : 'FL STUDIO DISCONNECTED'}</span>
      </div>
    </div>
  );
}

function DAWStatsPanel({ dawState }) {
  const stats = [
    { label: 'PROJECT',   value: dawState.project_name || 'Untitled',          icon: '🎛️', color: '#a78bfa' },
    { label: 'BPM',       value: dawState.bpm || 120,                           icon: '♩', color: '#34d399' },
    { label: 'TIME SIG',  value: dawState.time_signature || '4/4',              icon: '⏱', color: '#60a5fa' },
    { label: 'KEY',       value: dawState.key || '—',                           icon: '🎵', color: '#fbbf24' },
    { label: 'TRANSPORT', value: dawState.is_playing ? '▶ PLAYING' : '⏹ STOPPED', icon: '🚦', color: dawState.is_playing ? '#34d399' : '#f87171' },
    { label: 'CHANNEL',   value: dawState.selected_channel?.name || 'None',    icon: '🎚️', color: '#fb923c' },
  ];

  return (
    <div className="daw-stats-grid">
      {stats.map(s => (
        <div key={s.label} className="daw-stat-card">
          <span className="daw-stat-icon">{s.icon}</span>
          <div>
            <div className="daw-stat-label">{s.label}</div>
            <div className="daw-stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransportControls({ onTransport, onSetBpm, currentBpm, relayConnected }) {
  const [bpmInput, setBpmInput] = useState(currentBpm || 120);
  const [sending, setSending] = useState(null);

  useEffect(() => { setBpmInput(currentBpm); }, [currentBpm]);

  const handleTransport = async (action) => {
    setSending(action);
    await onTransport(action);
    setTimeout(() => setSending(null), 800);
  };

  const handleSetBpm = async () => {
    const val = parseFloat(bpmInput);
    if (isNaN(val) || val < 20 || val > 999) return;
    setSending('bpm');
    await onSetBpm(val);
    setTimeout(() => setSending(null), 800);
  };

  const disabled = !relayConnected;

  return (
    <div className="transport-panel">
      <h3 className="transport-title">🎛️ Transport Controls</h3>
      <p className="transport-subtitle">
        {disabled
          ? '⚠️ Start the FL Studio relay to enable transport control'
          : 'Control FL Studio directly from the web app'}
      </p>

      <div className="transport-btn-row">
        {[
          { action: 'play',   label: '▶ Play',   color: '#22c55e' },
          { action: 'stop',   label: '⏹ Stop',   color: '#ef4444' },
          { action: 'record', label: '⏺ Record', color: '#f97316' },
        ].map(({ action, label, color }) => (
          <button
            key={action}
            className="transport-btn"
            style={{ '--btn-color': color }}
            onClick={() => handleTransport(action)}
            disabled={disabled || sending === action}
          >
            {sending === action ? '...' : label}
          </button>
        ))}
      </div>

      <div className="bpm-row">
        <label className="bpm-label">Set BPM</label>
        <input
          type="number"
          min={20} max={999} step={0.1}
          value={bpmInput}
          onChange={e => setBpmInput(e.target.value)}
          className="bpm-input"
          disabled={disabled}
        />
        <button
          className="bpm-set-btn"
          onClick={handleSetBpm}
          disabled={disabled || sending === 'bpm'}
        >
          {sending === 'bpm' ? 'Sending…' : 'Set BPM →'}
        </button>
      </div>
    </div>
  );
}

function TrackList({ tracks }) {
  if (!tracks || tracks.length === 0) {
    return (
      <div className="track-list-empty">
        <span>🎚️</span>
        <p>No mixer tracks detected yet. Play something in FL Studio.</p>
      </div>
    );
  }
  return (
    <div className="track-list">
      <h3 className="track-list-title">🎚️ FL Studio Mixer Tracks ({tracks.length})</h3>
      <div className="track-grid">
        {tracks.map((t, i) => (
          <div key={i} className="track-chip">
            <span className="track-num">
              {typeof t === 'object' ? t.index : i + 1}
            </span>
            <span className="track-name">
              {typeof t === 'object' ? t.name : t}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupGuide() {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: '1. Install loopMIDI',
      icon: '🔁',
      content: (
        <>
          <p>Download and install <strong>loopMIDI</strong> — a free virtual MIDI port driver for Windows.</p>
          <a
            href="https://www.tobias-erichsen.de/software/loopmidi.html"
            target="_blank"
            rel="noreferrer"
            className="guide-link"
          >
            → Download loopMIDI ↗
          </a>
          <p className="guide-note">After installing, create a new port named exactly: <code>Audio Copilot Bridge</code></p>
        </>
      )
    },
    {
      title: '2. Install the FL Studio Script',
      icon: '📄',
      content: (
        <>
          <p>Copy the device script to FL Studio's hardware scripts folder:</p>
          <div className="code-block">
            <code>%USERPROFILE%\Documents\Image-Line\FL Studio\Settings\Hardware\</code>
          </div>
          <p>Copy this file there:</p>
          <div className="code-block">
            <code>device_AudioCopilot.py</code>
          </div>
          <p className="guide-note">
            The file is located in your project at:<br/>
            <code>backend\bridge\fl_studio\device_AudioCopilot.py</code>
          </p>
        </>
      )
    },
    {
      title: '3. Configure FL Studio MIDI Settings',
      icon: '🎹',
      content: (
        <>
          <p>In FL Studio, go to <strong>Options → MIDI Settings</strong>:</p>
          <ol className="guide-list">
            <li>Under <strong>Input</strong>, enable the <code>Audio Copilot Bridge</code> port</li>
            <li>Set its controller script to <strong>"Audio Copilot Bridge v2.0"</strong></li>
            <li>Under <strong>Output</strong>, also enable <code>Audio Copilot Bridge</code></li>
            <li>Click <strong>OK</strong> and restart FL Studio</li>
          </ol>
        </>
      )
    },
    {
      title: '4. Start the Relay Script',
      icon: '🔗',
      content: (
        <>
          <p>Open a terminal in your project root and run:</p>
          <div className="code-block">
            <code>cd backend</code><br/>
            <code>.\venv\Scripts\python.exe bridge\fl_relay.py</code>
          </div>
          <p className="guide-note">
            Keep this terminal open while using Audio Copilot.
            The relay connects FL Studio ↔ the backend WebSocket.
          </p>
        </>
      )
    },
    {
      title: '5. Verify Connection',
      icon: '✅',
      content: (
        <>
          <p>After starting the relay, you should see:</p>
          <ul className="guide-list">
            <li>The <strong>"FL STUDIO BRIDGE ACTIVE"</strong> pill turns green above</li>
            <li>Live BPM, time signature, and project name appear in the status panel</li>
            <li>Transport controls become enabled</li>
          </ul>
          <p className="guide-note">
            🎉 You're connected! Generated MIDI files and separated stems can now
            be sent directly to FL Studio.
          </p>
        </>
      )
    }
  ];

  return (
    <div className="setup-guide">
      <h3 className="guide-title">📋 Setup Guide — Bridge Installation</h3>

      <div className="guide-steps-nav">
        {steps.map((s, i) => (
          <button
            key={i}
            className={`guide-step-btn ${step === i ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? '✓' : i + 1}</span>
          </button>
        ))}
      </div>

      <div className="guide-step-content">
        <div className="guide-step-header">
          <span className="guide-step-icon">{steps[step].icon}</span>
          <h4>{steps[step].title}</h4>
        </div>
        <div className="guide-step-body">{steps[step].content}</div>
      </div>

      <div className="guide-nav-row">
        <button
          className="guide-nav-btn"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Previous
        </button>
        <span className="guide-progress">{step + 1} / {steps.length}</span>
        <button
          className="guide-nav-btn"
          onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
          disabled={step === steps.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function VSTPluginModal({ onClose }) {
  return (
    <div className="vst-modal-overlay" onClick={onClose}>
      <div className="vst-modal" onClick={e => e.stopPropagation()}>
        <button className="vst-modal-close" onClick={onClose}>✕</button>
        <div className="vst-modal-badge">PRODUCTION SUITE</div>
        <h2 className="vst-modal-title">DAW PLUGIN</h2>
        <p className="vst-modal-version">Version <strong>2.0</strong> · VST3</p>
        <p className="vst-modal-note">Phase 2 — JUCE C++ VST3 plugin (coming soon)</p>

        <div className="vst-platform-card">
          <div className="vst-platform-icon">⊞</div>
          <div>
            <div className="vst-platform-name">WINDOWS</div>
            <div className="vst-platform-sub">.exe · VST3 · Requires JUCE build</div>
          </div>
          <div className="vst-platform-status">🔨 In Development</div>
        </div>

        <div className="vst-info-box">
          <h4>What the VST3 Plugin will do:</h4>
          <ul>
            <li>🎛️ Embed the Audio Copilot web UI directly inside FL Studio</li>
            <li>♩ Read host BPM, time signature, and transport natively</li>
            <li>🎵 Drag generated MIDI directly onto the Piano Roll</li>
            <li>🎚️ Drag separated stems onto Mixer channels</li>
            <li>🌐 No relay script needed — fully self-contained</li>
          </ul>
        </div>

        <p className="vst-current-note">
          ✅ For now, use the <strong>MIDI Bridge</strong> (free, works now) via the Setup Guide below.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DAWPlugin({ dawState: propDawState }) {
  const [relayState, setRelayState] = useState({ relay_connected: false, frontend_count: 0 });
  const [localDawState, setLocalDawState] = useState(propDawState || {});
  const [showSetup, setShowSetup] = useState(false);
  const [showVSTModal, setShowVSTModal] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const wsConnected = propDawState?.connected ?? false;

  // Merge prop dawState updates into local
  useEffect(() => {
    if (propDawState) setLocalDawState(propDawState);
  }, [propDawState]);

  // Poll relay status every 3s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/plugin/relay-status'));
        if (res.ok) {
          const data = await res.json();
          setRelayState(data);
          if (data.daw_state) setLocalDawState(prev => ({ ...prev, ...data.daw_state }));
        }
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const showFeedback = useCallback((msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  const handleTransport = useCallback(async (action) => {
    try {
      const res = await fetch(apiUrl('/api/plugin/transport'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.sent) {
        showFeedback(`✅ Transport: ${action} sent to FL Studio`);
      } else {
        showFeedback('⚠️ Command queued — relay not connected', true);
      }
    } catch (e) {
      showFeedback(`❌ Error: ${e.message}`, true);
    }
  }, [showFeedback]);

  const handleSetBpm = useCallback(async (bpm) => {
    try {
      const res = await fetch(apiUrl('/api/plugin/set-bpm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpm }),
      });
      const data = await res.json();
      if (data.sent) {
        showFeedback(`✅ BPM set to ${bpm} in FL Studio`);
      } else {
        showFeedback('⚠️ BPM queued — relay not connected', true);
      }
    } catch (e) {
      showFeedback(`❌ Error: ${e.message}`, true);
    }
  }, [showFeedback]);

  return (
    <div className="dawplugin-root">
      {/* Header */}
      <div className="dawplugin-header">
        <div>
          <h2 className="dawplugin-title">🔌 DAW Plugin Bridge</h2>
          <p className="dawplugin-subtitle">
            Real-time connection between Audio Copilot and FL Studio
          </p>
        </div>
        <div className="dawplugin-header-btns">
          <button className="vst-download-btn" onClick={() => setShowVSTModal(true)}>
            ⚡ VST3 Plugin (Phase 2)
          </button>
          <button
            className={`setup-toggle-btn ${showSetup ? 'active' : ''}`}
            onClick={() => setShowSetup(v => !v)}
          >
            📋 {showSetup ? 'Hide' : 'Show'} Setup Guide
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`feedback-toast ${feedback.isError ? 'toast-error' : 'toast-success'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Status Row */}
      <StatusPill connected={wsConnected} relayConnected={relayState.relay_connected} />

      {/* DAW Stats */}
      {relayState.relay_connected ? (
        <DAWStatsPanel dawState={localDawState} />
      ) : (
        <div className="dawplugin-offline-banner">
          <span className="offline-icon">🔌</span>
          <div>
            <strong>FL Studio Not Connected</strong>
            <p>Follow the Setup Guide to connect FL Studio via the MIDI Bridge.</p>
          </div>
          <button className="setup-cta-btn" onClick={() => setShowSetup(true)}>
            View Setup Guide →
          </button>
        </div>
      )}

      {/* Transport & BPM Controls */}
      <TransportControls
        onTransport={handleTransport}
        onSetBpm={handleSetBpm}
        currentBpm={localDawState.bpm}
        relayConnected={relayState.relay_connected}
      />

      {/* Track List */}
      <TrackList tracks={localDawState.tracks} />

      {/* Setup Guide */}
      {showSetup && <SetupGuide />}

      {/* VST Modal */}
      {showVSTModal && <VSTPluginModal onClose={() => setShowVSTModal(false)} />}

      <style>{`
        .dawplugin-root {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
          font-family: 'Inter', sans-serif;
        }

        /* ── Header ─────────────────────────────── */
        .dawplugin-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .dawplugin-title {
          font-size: 1.6rem;
          font-weight: 800;
          color: #e2e8f0;
          margin: 0;
          letter-spacing: -0.03em;
        }
        .dawplugin-subtitle {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0.25rem 0 0;
        }
        .dawplugin-header-btns {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        /* ── Buttons ────────────────────────────── */
        .vst-download-btn {
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          border: none;
          padding: 0.5rem 1.1rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 0 20px rgba(124,58,237,0.35);
        }
        .vst-download-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        .setup-toggle-btn {
          background: rgba(255,255,255,0.05);
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0.5rem 1.1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .setup-toggle-btn.active, .setup-toggle-btn:hover {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.4);
          color: #a5b4fc;
        }

        /* ── Status Pills ───────────────────────── */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0.9rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: 1px solid transparent;
        }
        .status-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          display: block;
        }
        .status-online {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.3);
          color: #4ade80;
        }
        .status-online .status-dot {
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34,197,94,0.8);
          animation: pulse 1.5s ease-in-out infinite;
        }
        .status-relay {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.4);
          color: #818cf8;
        }
        .status-relay .status-dot {
          background: #6366f1;
          box-shadow: 0 0 8px rgba(99,102,241,0.8);
          animation: pulse 1.5s ease-in-out infinite;
        }
        .status-offline {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.2);
          color: #f87171;
        }
        .status-offline .status-dot { background: #ef4444; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ── DAW Stats Grid ─────────────────────── */
        .daw-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
        }
        .daw-stat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 0.9rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: border-color 0.2s;
        }
        .daw-stat-card:hover { border-color: rgba(255,255,255,0.18); }
        .daw-stat-icon { font-size: 1.4rem; }
        .daw-stat-label {
          font-size: 0.62rem;
          color: #475569;
          font-weight: 700;
          letter-spacing: 0.1em;
        }
        .daw-stat-value {
          font-size: 0.95rem;
          font-weight: 800;
          line-height: 1.2;
          margin-top: 0.15rem;
        }

        /* ── Offline Banner ─────────────────────── */
        .dawplugin-offline-banner {
          background: rgba(239,68,68,0.05);
          border: 1px dashed rgba(239,68,68,0.25);
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .offline-icon { font-size: 2rem; }
        .dawplugin-offline-banner strong { color: #fca5a5; font-size: 0.95rem; }
        .dawplugin-offline-banner p { color: #64748b; font-size: 0.8rem; margin: 0.2rem 0 0; }
        .setup-cta-btn {
          margin-left: auto;
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px;
          padding: 0.45rem 1rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .setup-cta-btn:hover {
          background: rgba(239,68,68,0.25);
        }

        /* ── Transport Controls ─────────────────── */
        .transport-panel {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
        }
        .transport-title {
          font-size: 1rem;
          font-weight: 800;
          color: #e2e8f0;
          margin: 0 0 0.25rem;
        }
        .transport-subtitle {
          color: #475569;
          font-size: 0.78rem;
          margin: 0 0 1rem;
        }
        .transport-btn-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .transport-btn {
          flex: 1;
          min-width: 100px;
          padding: 0.65rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--btn-color, #6366f1);
          background: color-mix(in srgb, var(--btn-color, #6366f1) 15%, transparent);
          color: var(--btn-color, #6366f1);
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.02em;
        }
        .transport-btn:hover:not(:disabled) {
          background: color-mix(in srgb, var(--btn-color, #6366f1) 30%, transparent);
          transform: translateY(-1px);
        }
        .transport-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .bpm-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .bpm-label {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          min-width: 60px;
        }
        .bpm-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: #e2e8f0;
          padding: 0.45rem 0.75rem;
          font-size: 0.9rem;
          font-weight: 700;
          width: 90px;
          outline: none;
          transition: border-color 0.2s;
        }
        .bpm-input:focus { border-color: #6366f1; }
        .bpm-input:disabled { opacity: 0.3; }
        .bpm-set-btn {
          background: rgba(99,102,241,0.18);
          border: 1px solid rgba(99,102,241,0.4);
          color: #a5b4fc;
          border-radius: 8px;
          padding: 0.45rem 1rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bpm-set-btn:hover:not(:disabled) {
          background: rgba(99,102,241,0.3);
        }
        .bpm-set-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ── Track List ─────────────────────────── */
        .track-list-empty {
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          color: #475569;
          font-size: 0.85rem;
        }
        .track-list-empty span { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
        .track-list-title {
          font-size: 0.9rem;
          font-weight: 800;
          color: #94a3b8;
          margin: 0 0 0.75rem;
          letter-spacing: 0.02em;
        }
        .track-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .track-chip {
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 8px;
          padding: 0.35rem 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: border-color 0.2s;
        }
        .track-chip:hover { border-color: rgba(99,102,241,0.5); }
        .track-num {
          font-size: 0.62rem;
          color: #4f46e5;
          font-weight: 800;
          background: rgba(99,102,241,0.2);
          border-radius: 4px;
          padding: 0.1rem 0.3rem;
        }
        .track-name {
          font-size: 0.78rem;
          color: #a5b4fc;
          font-weight: 600;
        }

        /* ── Feedback Toast ─────────────────────── */
        .feedback-toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          padding: 0.75rem 1.25rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 700;
          z-index: 1000;
          animation: slideUp 0.3s ease;
        }
        .toast-success {
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.4);
          color: #4ade80;
        }
        .toast-error {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.4);
          color: #f87171;
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* ── Setup Guide ────────────────────────── */
        .setup-guide {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 16px;
          padding: 1.5rem;
        }
        .guide-title {
          font-size: 1rem;
          font-weight: 800;
          color: #e2e8f0;
          margin: 0 0 1rem;
        }
        .guide-steps-nav {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1.25rem;
        }
        .guide-step-btn {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.1);
          background: transparent;
          color: #475569;
          font-size: 0.8rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .guide-step-btn.active {
          border-color: #6366f1;
          background: rgba(99,102,241,0.2);
          color: #a5b4fc;
        }
        .guide-step-btn.done {
          border-color: rgba(34,197,94,0.5);
          background: rgba(34,197,94,0.1);
          color: #4ade80;
        }
        .guide-step-content {
          min-height: 180px;
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }
        .guide-step-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .guide-step-icon { font-size: 1.5rem; }
        .guide-step-header h4 {
          margin: 0;
          color: #e2e8f0;
          font-size: 0.95rem;
        }
        .guide-step-body {
          color: #94a3b8;
          font-size: 0.83rem;
          line-height: 1.65;
        }
        .guide-step-body p { margin: 0 0 0.5rem; }
        .guide-step-body strong { color: #c7d2fe; }
        .guide-step-body code {
          background: rgba(0,0,0,0.4);
          color: #34d399;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-family: 'Fira Code', monospace;
        }
        .code-block {
          background: rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 0.6rem 0.9rem;
          margin: 0.5rem 0;
          color: #34d399;
          font-family: 'Fira Code', monospace;
          font-size: 0.78rem;
        }
        .guide-note {
          background: rgba(99,102,241,0.08);
          border-left: 3px solid #4f46e5;
          padding: 0.5rem 0.75rem;
          border-radius: 0 6px 6px 0;
          color: #94a3b8 !important;
          margin-top: 0.5rem;
          font-size: 0.78rem !important;
        }
        .guide-link {
          display: inline-block;
          color: #818cf8;
          text-decoration: none;
          font-weight: 700;
          margin: 0.4rem 0;
          transition: color 0.2s;
        }
        .guide-link:hover { color: #a5b4fc; text-decoration: underline; }
        .guide-list {
          padding-left: 1.25rem;
          color: #94a3b8;
          line-height: 1.8;
          font-size: 0.83rem;
        }
        .guide-nav-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          justify-content: space-between;
        }
        .guide-nav-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #94a3b8;
          padding: 0.45rem 1rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .guide-nav-btn:hover:not(:disabled) {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.4);
          color: #a5b4fc;
        }
        .guide-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .guide-progress {
          color: #475569;
          font-size: 0.78rem;
          font-weight: 700;
        }

        /* ── VST Modal ──────────────────────────── */
        .vst-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        .vst-modal {
          background: linear-gradient(145deg, #0f0f14, #1a1a24);
          border: 1px solid rgba(255,215,0,0.2);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          width: 480px;
          max-width: 95vw;
          position: relative;
          box-shadow: 0 0 80px rgba(255,215,0,0.08);
          text-align: center;
          animation: scaleIn 0.25s ease;
        }
        .vst-modal-close {
          position: absolute;
          top: 1rem; right: 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #64748b;
          width: 32px; height: 32px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
        }
        .vst-modal-close:hover { color: #e2e8f0; background: rgba(255,255,255,0.1); }
        .vst-modal-badge {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.2em;
          color: #d97706;
          margin-bottom: 0.5rem;
        }
        .vst-modal-title {
          font-size: 2.2rem;
          font-weight: 900;
          color: #fbbf24;
          letter-spacing: 0.12em;
          margin: 0.25rem 0;
          text-shadow: 0 0 30px rgba(251,191,36,0.3);
        }
        .vst-modal-version {
          color: #6b7280;
          font-size: 0.85rem;
          margin: 0 0 0.5rem;
        }
        .vst-modal-note {
          color: #f59e0b;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }
        .vst-platform-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
          text-align: left;
        }
        .vst-platform-icon { font-size: 1.75rem; }
        .vst-platform-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #e2e8f0;
          letter-spacing: 0.05em;
        }
        .vst-platform-sub {
          font-size: 0.72rem;
          color: #6b7280;
          margin-top: 0.1rem;
        }
        .vst-platform-status {
          margin-left: auto;
          font-size: 0.75rem;
          color: #f59e0b;
          font-weight: 700;
          white-space: nowrap;
        }
        .vst-info-box {
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          text-align: left;
          margin-bottom: 1.25rem;
        }
        .vst-info-box h4 {
          font-size: 0.78rem;
          font-weight: 800;
          color: #818cf8;
          letter-spacing: 0.05em;
          margin: 0 0 0.6rem;
        }
        .vst-info-box ul {
          margin: 0;
          padding-left: 0;
          list-style: none;
        }
        .vst-info-box li {
          font-size: 0.8rem;
          color: #94a3b8;
          line-height: 1.8;
        }
        .vst-current-note {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0;
        }
        .vst-current-note strong { color: #a5b4fc; }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
