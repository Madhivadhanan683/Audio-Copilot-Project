/**
 * SendToDAW — Reusable component to push any server-side file path
 * to FL Studio via the Audio Copilot DAW bridge.
 *
 * Usage:
 *   <SendToDAW filePath="/absolute/server/path/to/file.mid" target="piano_roll" label="Send MIDI to FL" />
 *   <SendToDAW filePath="/absolute/server/path/to/stem.wav" target="mixer" label="Send to Mixer" />
 *
 * target options: "mixer" | "piano_roll" | "playlist"
 */

import React, { useState, useCallback } from 'react';

const API = 'http://localhost:8000';

const TARGET_ICONS = {
  mixer:      '🎚️',
  piano_roll: '🎹',
  playlist:   '🎛️',
};

export default function SendToDAW({
  filePath,
  target = 'mixer',
  label = 'Send to FL Studio',
  variant = 'primary',   // 'primary' | 'compact' | 'ghost'
  disabled = false,
}) {
  const [state, setState] = useState('idle');  // 'idle' | 'sending' | 'sent' | 'queued' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = useCallback(async () => {
    if (!filePath || state === 'sending') return;
    setState('sending');
    setErrorMsg('');

    try {
      const res = await fetch(`${API}/api/plugin/send-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, target }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.sent) {
        setState('sent');
      } else {
        setState('queued');
      }
    } catch (e) {
      setState('error');
      setErrorMsg(e.message);
    }

    // Reset after 3 seconds
    setTimeout(() => setState('idle'), 3000);
  }, [filePath, target, state]);

  const icon = TARGET_ICONS[target] || '🔌';

  let btnLabel = label;
  let btnClass = `send-daw-btn send-daw-${variant}`;

  if (state === 'sending') { btnLabel = '⏳ Sending…'; btnClass += ' send-daw-loading'; }
  else if (state === 'sent')   { btnLabel = '✅ Sent!';   btnClass += ' send-daw-sent'; }
  else if (state === 'queued') { btnLabel = '⏸ Queued — relay offline'; btnClass += ' send-daw-queued'; }
  else if (state === 'error')  { btnLabel = `❌ ${errorMsg || 'Error'}`; btnClass += ' send-daw-error'; }

  return (
    <>
      <button
        className={btnClass}
        onClick={handleSend}
        disabled={disabled || !filePath || state === 'sending'}
        title={filePath ? `Send to FL Studio (${target})` : 'No file available'}
      >
        {state === 'idle' ? icon : ''} {btnLabel}
      </button>

      <style>{`
        .send-daw-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          font-size: 0.78rem;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
        }

        /* Primary */
        .send-daw-primary {
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          padding: 0.5rem 1rem;
          box-shadow: 0 0 16px rgba(124,58,237,0.3);
        }
        .send-daw-primary:hover:not(:disabled) {
          opacity: 0.88;
          transform: translateY(-1px);
          box-shadow: 0 0 24px rgba(124,58,237,0.5);
        }

        /* Compact */
        .send-daw-compact {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.35);
          color: #a5b4fc;
          padding: 0.35rem 0.75rem;
        }
        .send-daw-compact:hover:not(:disabled) {
          background: rgba(99,102,241,0.28);
          border-color: rgba(99,102,241,0.6);
        }

        /* Ghost */
        .send-daw-ghost {
          background: transparent;
          border-color: rgba(99,102,241,0.3);
          color: #818cf8;
          padding: 0.35rem 0.75rem;
        }
        .send-daw-ghost:hover:not(:disabled) {
          background: rgba(99,102,241,0.1);
        }

        /* States */
        .send-daw-sent {
          background: rgba(34,197,94,0.15) !important;
          border-color: rgba(34,197,94,0.4) !important;
          color: #4ade80 !important;
        }
        .send-daw-queued {
          background: rgba(251,191,36,0.1) !important;
          border-color: rgba(251,191,36,0.3) !important;
          color: #fbbf24 !important;
        }
        .send-daw-error {
          background: rgba(239,68,68,0.12) !important;
          border-color: rgba(239,68,68,0.35) !important;
          color: #f87171 !important;
        }
        .send-daw-loading {
          opacity: 0.7;
        }

        .send-daw-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          transform: none !important;
        }
      `}</style>
    </>
  );
}
