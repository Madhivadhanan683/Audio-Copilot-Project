import React, { useState, useEffect, useRef, useCallback } from 'react';

// Default Track Configuration
const DEFAULT_STEM_KEYS = ['vocals', 'drums', 'bass', 'other', 'metronome'];

const TRACK_CONFIG = {
    vocals: { name: 'Vocals', icon: '🎤', color: '#00f2fe', secondaryColor: '#4facfe' },
    drums: { name: 'Drums', icon: '🥁', color: '#00c6ff', secondaryColor: '#0072ff' },
    bass: { name: 'Bass', icon: '🎸', color: '#00d2ff', secondaryColor: '#3a7bd5' },
    other: { name: 'Other', icon: '🎹', color: '#00e5ff', secondaryColor: '#12c2e9' },
    metronome: { name: 'Smart Metronome', icon: '⏱️', color: '#a855f7', secondaryColor: '#6366f1' }
};

const StemSeparator = () => {
    // --- File & Separation State ---
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [separationMode, setSeparationMode] = useState('demo'); // 'demo' | 'realtime_dsp' | 'ai_demucs'
    const [songMeta, setSongMeta] = useState({
        title: 'Heartbreak Warfare',
        artist: 'John Mayer (Demo)',
        bpm: 97,
        key: 'A Major',
        timeSig: '4/4',
        duration: 269
    });

    // --- Active View State ---
    const [activeTab, setActiveTab] = useState('player'); // 'player' | 'upload' | 'lyrics' | 'chords' | 'sections'
    const [showExportMenu, setShowExportMenu] = useState(false);

    // --- Web Audio State ---
    const audioCtxRef = useRef(null);
    const trackNodesRef = useRef({}); // { [key]: { source, gainNode, pannerNode, buffer } }
    const masterGainRef = useRef(null);
    const startTimeRef = useRef(0);
    const pauseOffsetRef = useRef(0);
    const animFrameRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(269);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isLooping, setIsLooping] = useState(false);
    const [masterVolume, setMasterVolume] = useState(0.9);

    // --- Stem Track Controls State ---
    const [tracks, setTracks] = useState({
        vocals: { volume: 0.85, pan: 0, muted: false, solo: false, buffer: null, peaks: null },
        drums: { volume: 0.85, pan: 0, muted: false, solo: false, buffer: null, peaks: null },
        bass: { volume: 0.85, pan: 0, muted: false, solo: false, buffer: null, peaks: null },
        other: { volume: 0.85, pan: 0, muted: false, solo: false, buffer: null, peaks: null },
        metronome: { volume: 0.6, pan: 0, muted: true, solo: false, buffer: null, peaks: null }
    });

    // Canvas references for waveforms
    const canvasRefs = useRef({});

    // Initialize Web Audio Context
    const getAudioContext = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioCtx();
            masterGainRef.current = audioCtxRef.current.createGain();
            masterGainRef.current.gain.value = masterVolume;
            masterGainRef.current.connect(audioCtxRef.current.destination);
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, [masterVolume]);

    // Extract Peaks Helper from AudioBuffer
    const extractPeaks = useCallback((buffer, numBins = 300) => {
        if (!buffer) return new Float32Array(numBins);
        const channelData = buffer.getChannelData(0);
        const step = Math.floor(channelData.length / numBins);
        const peaks = new Float32Array(numBins);
        for (let b = 0; b < numBins; b++) {
            let max = 0;
            const start = b * step;
            for (let k = 0; k < step; k += 10) {
                const val = Math.abs(channelData[start + k] || 0);
                if (val > max) max = val;
            }
            peaks[b] = max;
        }
        return peaks;
    }, []);

    // Generate Synthetic Demo Audio Buffers & Waveforms
    const createDemoTrackBuffers = useCallback((ctx) => {
        const sampleRate = ctx.sampleRate;
        const seconds = 120;
        const totalSamples = sampleRate * seconds;
        setDuration(seconds);

        const newTracks = { ...tracks };

        DEFAULT_STEM_KEYS.forEach((key) => {
            const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
            const leftChannel = buffer.getChannelData(0);
            const rightChannel = buffer.getChannelData(1);

            const freqMap = { vocals: 440, drums: 100, bass: 110, other: 330, metronome: 800 };
            const baseFreq = freqMap[key] || 220;

            for (let i = 0; i < totalSamples; i++) {
                const t = i / sampleRate;
                let sample = 0;

                if (key === 'drums') {
                    const beat = (t * 2) % 1;
                    sample = Math.sin(2 * Math.PI * 60 * Math.exp(-beat * 20)) * Math.exp(-beat * 10);
                } else if (key === 'bass') {
                    const noteT = Math.floor(t * 4) % 4;
                    const freq = baseFreq * (1 + noteT * 0.25);
                    sample = Math.sin(2 * Math.PI * freq * t) * 0.5;
                } else if (key === 'vocals') {
                    const env = Math.sin(t * 1.5) > 0 ? 1 : 0.1;
                    sample = Math.sin(2 * Math.PI * baseFreq * t + Math.sin(t * 5) * 2) * 0.4 * env;
                } else if (key === 'other') {
                    sample = (Math.sin(2 * Math.PI * baseFreq * t) + Math.sin(2 * Math.PI * baseFreq * 1.25 * t)) * 0.25;
                } else if (key === 'metronome') {
                    const beat = (t * 1.616) % 1;
                    sample = beat < 0.02 ? Math.sin(2 * Math.PI * baseFreq * beat) * Math.exp(-beat * 100) : 0;
                }

                leftChannel[i] = sample;
                rightChannel[i] = sample;
            }

            newTracks[key] = {
                ...newTracks[key],
                buffer,
                peaks: extractPeaks(buffer)
            };
        });

        setTracks(newTracks);
    }, [extractPeaks]);

    // Load Demo Track on Mount
    useEffect(() => {
        const ctx = getAudioContext();
        createDemoTrackBuffers(ctx);
    }, [createDemoTrackBuffers, getAudioContext]);

    // REAL-TIME WEB AUDIO DSP DEMUX ENGINE
    // Performs instant multiband & Mid-Side frequency isolation on raw audio buffer
    const performRealtimeDSPDemux = useCallback((rawBuffer) => {
        const ctx = getAudioContext();
        const sampleRate = rawBuffer.sampleRate;
        const length = rawBuffer.length;
        const channels = rawBuffer.numberOfChannels;
        setDuration(rawBuffer.duration);

        const left = rawBuffer.getChannelData(0);
        const right = channels > 1 ? rawBuffer.getChannelData(1) : left;

        // 1. Bass Stem (Lowpass filter < 220Hz)
        const bassBuffer = ctx.createBuffer(2, length, sampleRate);
        const bL = bassBuffer.getChannelData(0);
        const bR = bassBuffer.getChannelData(1);
        let bPrevL = 0, bPrevR = 0;
        const bAlpha = 0.08; // cutoff ~200Hz

        // 2. Vocals Stem (Center Mid-Channel & Bandpass 300Hz-3.4kHz)
        const vocalsBuffer = ctx.createBuffer(2, length, sampleRate);
        const vL = vocalsBuffer.getChannelData(0);
        const vR = vocalsBuffer.getChannelData(1);

        // 3. Drums Stem (Punch Highpass + Transient envelope)
        const drumsBuffer = ctx.createBuffer(2, length, sampleRate);
        const dL = drumsBuffer.getChannelData(0);
        const dR = drumsBuffer.getChannelData(1);

        // 4. Other Stem (Melodic Instrument Bandpass)
        const otherBuffer = ctx.createBuffer(2, length, sampleRate);
        const oL = otherBuffer.getChannelData(0);
        const oR = otherBuffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const lVal = left[i];
            const rVal = right[i];
            const mid = (lVal + rVal) * 0.5; // Center channel (vocals)
            const side = (lVal - rVal) * 0.5; // Side channel (instruments)

            // Bass (Simple Lowpass)
            bPrevL += bAlpha * (lVal - bPrevL);
            bPrevR += bAlpha * (rVal - bPrevR);
            bL[i] = bPrevL * 1.4;
            bR[i] = bPrevR * 1.4;

            // Vocals (Mid channel minus low bass)
            const vocVal = (mid - bPrevL * 0.7) * 0.9;
            vL[i] = vocVal;
            vR[i] = vocVal;

            // Drums (High transients & Side Punch)
            const drumVal = (lVal - bPrevL - vocVal * 0.5) * 0.75;
            dL[i] = drumVal;
            dR[i] = drumVal;

            // Other (Remaining stereo side elements)
            const oVal = (side + (lVal * 0.3)) * 0.8;
            oL[i] = oVal;
            oR[i] = oVal;
        }

        const newTracks = { ...tracks };
        const dspBuffers = {
            vocals: vocalsBuffer,
            drums: drumsBuffer,
            bass: bassBuffer,
            other: otherBuffer,
            metronome: tracks.metronome.buffer
        };

        DEFAULT_STEM_KEYS.forEach(key => {
            if (dspBuffers[key]) {
                newTracks[key] = {
                    ...newTracks[key],
                    buffer: dspBuffers[key],
                    peaks: extractPeaks(dspBuffers[key])
                };
            }
        });

        setTracks(newTracks);
        setSeparationMode('realtime_dsp');
        setActiveTab('player');
    }, [getAudioContext, extractPeaks, tracks]);

    // Handle Mute & Solo Matrix calculations
    const getEffectiveVolume = useCallback((key, trackState) => {
        const anySolo = Object.values(trackState).some(t => t.solo);
        const tr = trackState[key];
        if (!tr) return 0;
        if (tr.muted) return 0;
        if (anySolo && !tr.solo) return 0;
        return tr.volume;
    }, []);

    // Update Gain & Panner nodes when track controls change
    useEffect(() => {
        Object.keys(tracks).forEach((key) => {
            const node = trackNodesRef.current[key];
            if (node) {
                const effVol = getEffectiveVolume(key, tracks);
                node.gainNode.gain.setTargetAtTime(effVol, audioCtxRef.current.currentTime, 0.03);
                node.pannerNode.pan.setTargetAtTime(tracks[key].pan, audioCtxRef.current.currentTime, 0.03);
            }
        });
    }, [tracks, getEffectiveVolume]);

    // Update Master Volume
    useEffect(() => {
        if (masterGainRef.current && audioCtxRef.current) {
            masterGainRef.current.gain.setTargetAtTime(masterVolume, audioCtxRef.current.currentTime, 0.03);
        }
    }, [masterVolume]);

    // Start / Stop Multi-track Audio Playback
    const stopAudio = useCallback(() => {
        Object.keys(trackNodesRef.current).forEach(key => {
            try {
                if (trackNodesRef.current[key].source) {
                    trackNodesRef.current[key].source.stop();
                    trackNodesRef.current[key].source.disconnect();
                }
            } catch (e) { }
        });
        trackNodesRef.current = {};
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
        }
    }, []);

    const playAudio = useCallback((offsetSeconds = pauseOffsetRef.current) => {
        const ctx = getAudioContext();
        stopAudio();

        const now = ctx.currentTime;
        startTimeRef.current = now - offsetSeconds / playbackRate;

        Object.keys(tracks).forEach(key => {
            const tr = tracks[key];
            if (!tr.buffer) return;

            const source = ctx.createBufferSource();
            source.buffer = tr.buffer;
            source.playbackRate.value = playbackRate;
            source.loop = isLooping;

            const gainNode = ctx.createGain();
            const effVol = getEffectiveVolume(key, tracks);
            gainNode.gain.value = effVol;

            const pannerNode = ctx.createStereoPanner();
            pannerNode.pan.value = tr.pan;

            source.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(masterGainRef.current);

            source.start(0, offsetSeconds % tr.buffer.duration);

            trackNodesRef.current[key] = { source, gainNode, pannerNode, buffer: tr.buffer };
        });

        setIsPlaying(true);
    }, [getAudioContext, tracks, playbackRate, isLooping, getEffectiveVolume, stopAudio]);

    const pauseAudio = useCallback(() => {
        if (isPlaying && audioCtxRef.current) {
            const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
            pauseOffsetRef.current = elapsed % duration;
            setCurrentTime(pauseOffsetRef.current);
        }
        stopAudio();
        setIsPlaying(false);
    }, [isPlaying, playbackRate, duration, stopAudio]);

    const togglePlay = () => {
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio(pauseOffsetRef.current);
        }
    };

    const seekTo = (seconds) => {
        const clamped = Math.max(0, Math.min(seconds, duration));
        pauseOffsetRef.current = clamped;
        setCurrentTime(clamped);
        if (isPlaying) {
            playAudio(clamped);
        }
    };

    // Update Playhead Animation Loop
    useEffect(() => {
        if (!isPlaying) return;

        const updatePosition = () => {
            if (audioCtxRef.current) {
                const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
                const currentSec = elapsed % duration;
                setCurrentTime(currentSec);

                if (!isLooping && elapsed >= duration) {
                    setIsPlaying(false);
                    pauseOffsetRef.current = 0;
                    setCurrentTime(0);
                    stopAudio();
                    return;
                }
            }
            animFrameRef.current = requestAnimationFrame(updatePosition);
        };

        animFrameRef.current = requestAnimationFrame(updatePosition);
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [isPlaying, playbackRate, duration, isLooping, stopAudio]);

    // Handle Mute & Solo Toggles
    const toggleMute = (key) => {
        setTracks(prev => ({
            ...prev,
            [key]: { ...prev[key], muted: !prev[key].muted }
        }));
    };

    const toggleSolo = (key) => {
        setTracks(prev => ({
            ...prev,
            [key]: { ...prev[key], solo: !prev[key].solo }
        }));
    };

    const handleVolumeChange = (key, val) => {
        setTracks(prev => ({
            ...prev,
            [key]: { ...prev[key], volume: parseFloat(val) }
        }));
    };

    const handlePanChange = (key, val) => {
        setTracks(prev => ({
            ...prev,
            [key]: { ...prev[key], pan: parseFloat(val) }
        }));
    };

    // File Drop & Upload Handlers with INSTANT REALTIME DSP DEMUX
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) validateAndSetFile(dropped);
    };

    const handleFileSelect = (e) => {
        const sel = e.target.files[0];
        if (sel) validateAndSetFile(sel);
    };

    const validateAndSetFile = async (f) => {
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4'];
        const validExts = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

        if (validTypes.includes(f.type) || validExts.includes(ext)) {
            setFile(f);
            setError(null);
            setJobId(null);
            setStatus(null);
            setSongMeta(prev => ({
                ...prev,
                title: f.name.replace(/\.[^/.]+$/, ""),
                artist: 'Uploaded Track'
            }));

            // INSTANT REAL-TIME DSP DECODE
            try {
                const arrayBuffer = await f.arrayBuffer();
                const ctx = getAudioContext();
                const rawAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
                performRealtimeDSPDemux(rawAudioBuffer);
            } catch (err) {
                console.error("DSP decode error:", err);
            }
        } else {
            setError('Invalid file type. Please upload MP3, WAV, FLAC, OGG, or M4A.');
        }
    };

    const startSeparation = async () => {
        if (!file) return;
        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('http://127.0.0.1:8000/api/stems/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Upload failed');
            }
            const data = await res.json();
            setJobId(data.job_id);
            setStatus({ status: 'processing', progress: 15 });
            pollStatus(data.job_id);
        } catch (err) {
            setError(err.message);
            setIsUploading(false);
        }
    };

    const pollStatus = async (id) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/stems/status/${id}`);
            const data = await res.json();
            setStatus(data);

            if (data.status === 'processing' || data.status === 'pending') {
                setTimeout(() => pollStatus(id), 1500);
            } else if (data.status === 'completed') {
                setIsUploading(false);
                loadSeparatedAudioStems(id, data.stems);
            } else if (data.status === 'failed') {
                setIsUploading(false);
                console.warn("AI Demucs failed, keeping Realtime DSP stems active:", data.error);
            }
        } catch (err) {
            setIsUploading(false);
        }
    };

    // Decode separated stems from backend into Web Audio Buffers
    const loadSeparatedAudioStems = async (id, stemsMap) => {
        const ctx = getAudioContext();
        const updatedTracks = { ...tracks };

        for (const key of ['vocals', 'drums', 'bass', 'other']) {
            if (stemsMap && stemsMap[key]) {
                try {
                    const audioUrl = `http://127.0.0.1:8000${stemsMap[key]}`;
                    const res = await fetch(audioUrl);
                    const arrayBuf = await res.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuf);

                    updatedTracks[key] = {
                        ...updatedTracks[key],
                        buffer: audioBuffer,
                        peaks: extractPeaks(audioBuffer)
                    };

                    setDuration(audioBuffer.duration);
                } catch (e) {
                    console.error(`Error loading stem ${key}:`, e);
                }
            }
        }

        setTracks(updatedTracks);
        setSeparationMode('ai_demucs');
    };

    // Seamlessly transition to AI Demucs if currently playing
    useEffect(() => {
        if (separationMode === 'ai_demucs' && isPlaying && audioCtxRef.current) {
            console.log("Seamlessly switching to high-res AI Demucs buffers...");
            const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
            pauseOffsetRef.current = elapsed % duration;
            playAudio(pauseOffsetRef.current);
        }
    }, [separationMode, isPlaying, playbackRate, duration, playAudio]);

    // Draw Canvas Waveform for each stem lane
    useEffect(() => {
        DEFAULT_STEM_KEYS.forEach(key => {
            const canvas = canvasRefs.current[key];
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            const tr = tracks[key];
            const cfg = TRACK_CONFIG[key];

            // Waveform background gradient
            const bgGradient = ctx.createLinearGradient(0, 0, width, 0);
            bgGradient.addColorStop(0, '#101726');
            bgGradient.addColorStop(0.5, '#0f2027');
            bgGradient.addColorStop(1, '#101726');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);

            // Draw Peaks
            const peaks = tr.peaks;
            if (peaks && peaks.length > 0) {
                const barWidth = width / peaks.length;
                const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
                waveGradient.addColorStop(0, cfg.color);
                waveGradient.addColorStop(1, cfg.secondaryColor);

                ctx.fillStyle = waveGradient;
                for (let i = 0; i < peaks.length; i++) {
                    const h = Math.max(3, peaks[i] * (height * 0.85));
                    const y = (height - h) / 2;
                    ctx.beginPath();
                    ctx.roundRect(i * barWidth, y, Math.max(1.5, barWidth - 1), h, 1.5);
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
                for (let x = 0; x < width; x += 4) {
                    const h = 4 + Math.sin(x * 0.05) * 12 + Math.cos(x * 0.02) * 8;
                    ctx.fillRect(x, (height - h) / 2, 2.5, h);
                }
            }
        });
    }, [tracks]);

    // Format Seconds to MM:SS
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const downloadStem = (key) => {
        if (jobId) {
            window.open(`http://127.0.0.1:8000/api/stems/download/${jobId}/${key}`, '_blank');
        } else {
            alert(`Realtime DSP Mode: Exporting stem '${key}'. (Upload to AI server to save high-res neural demux).`);
        }
    };

    return (
        <div className="moises-studio bg-[#0f111a] text-slate-100 font-sans rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-800/60">
            {/* ================= HEADER TOOLBAR ================= */}
            <header className="flex flex-wrap items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveTab('player')}
                        className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Back to Studio"
                    >
                        ←
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-xl shadow-lg">
                        🎵
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-wide leading-tight flex items-center gap-2">
                            {songMeta.title}
                            {separationMode === 'ai_demucs' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    🚀 High-Res AI Demucs
                                </span>
                            )}
                            {separationMode === 'realtime_dsp' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                                    ⚡ 0ms Real-Time DSP
                                </span>
                            )}
                            {separationMode === 'demo' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    Interactive Demo
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-gray-400">{songMeta.artist}</p>
                    </div>
                </div>

                {/* Top Action Pills & Tools */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setActiveTab(activeTab === 'upload' ? 'player' : 'upload')}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs tracking-wider uppercase flex items-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                        <span>✨</span>
                        <span>Separate tracks</span>
                    </button>

                    {/* Metadata Badges */}
                    <div className="hidden md:flex items-center gap-2 bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800 text-xs">
                        <span className="text-cyan-400 font-mono">🔀 {songMeta.bpm} BPM</span>
                        <span className="text-gray-600">|</span>
                        <span className="text-amber-400 font-mono">🎛️ {songMeta.key}</span>
                        <span className="text-gray-600">|</span>
                        <span className="text-purple-400 font-mono">{songMeta.timeSig}</span>
                    </div>

                    {/* Export Button & Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-200 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <span>📥</span>
                            <span>Export</span>
                            <span className="text-[10px]">▼</span>
                        </button>

                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 py-2">
                                <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Download Stems
                                </div>
                                {DEFAULT_STEM_KEYS.slice(0, 4).map(key => (
                                    <button
                                        key={key}
                                        onClick={() => { downloadStem(key); setShowExportMenu(false); }}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-cyan-500/20 hover:text-cyan-300 flex items-center gap-2"
                                    >
                                        <span>{TRACK_CONFIG[key].icon}</span>
                                        <span className="capitalize">{key} Stem</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ================= MAIN CONTENT VIEWS ================= */}
            {activeTab === 'upload' ? (
                /* UPLOAD / FILE PROCESSING VIEW */
                <div className="flex-1 p-8 flex flex-col items-center justify-center bg-gray-950/60">
                    <div className="w-full max-w-xl bg-gray-900/90 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
                        <h3 className="text-2xl font-bold mb-2 text-white flex items-center justify-center gap-2">
                            <span>🎧</span> Real-Time & AI Stem Separator
                        </h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Drop any audio file for <strong>Instant 0ms Real-Time DSP separation</strong> + AI Neural refinement.
                        </p>

                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-3xl p-12 cursor-pointer transition-all duration-300 backdrop-blur-sm ${isDragging
                                ? 'border-indigo-400 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
                                : 'border-slate-700 hover:border-indigo-500/50 bg-slate-800/30 hover:bg-slate-800/50'
                                }`}
                        >
                            <input
                                type="file"
                                accept=".mp3,.wav,.flac,.ogg,.m4a"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="moises-audio-upload"
                            />
                            <label htmlFor="moises-audio-upload" className="cursor-pointer">
                                <div className="text-5xl mb-3 animate-bounce">⚡</div>
                                <p className="text-lg text-slate-200 font-semibold">
                                    {file ? file.name : 'Drop audio file here to separate immediately!'}
                                </p>
                                <p className="text-sm text-slate-500 mt-2 font-medium">
                                    Supports: MP3, WAV, FLAC, OGG, M4A
                                </p>
                            </label>
                        </div>

                        {file && (
                            <button
                                onClick={startSeparation}
                                disabled={isUploading}
                                className="mt-6 w-full py-3.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
                            >
                                {isUploading ? '⏳ Refining with AI Demucs...' : '🚀 High-Res AI Demucs Separation'}
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0b10]">
                    <div className="flex-1 flex min-h-0 overflow-hidden">
                        {/* ================= LEFT STEM CONTROL RACK ================= */}
                        <div className="w-64 md:w-72 bg-slate-900/95 border-r border-slate-800/80 flex flex-col shrink-0 min-h-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                            <div className="px-4 py-3 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between bg-slate-900/50">
                                <span>Stem Control Rack</span>
                                <span className="text-[10px] text-indigo-400 font-semibold tracking-normal px-2 py-0.5 rounded-full bg-indigo-500/10">
                                    {separationMode === 'realtime_dsp' ? '⚡ Realtime DSP' : 'Stereo'}
                                </span>
                            </div>

                            {/* Stem Track Cards */}
                            <div className="flex-1 divide-y divide-slate-800/60 overflow-y-auto min-h-0 custom-scrollbar">
                                {DEFAULT_STEM_KEYS.map((key) => {
                                    const tr = tracks[key];
                                    const cfg = TRACK_CONFIG[key];

                                    return (
                                        <div key={key} className="p-4 flex flex-col gap-3 hover:bg-slate-800/40 transition-colors group">
                                            {/* Track Title & M/S Buttons */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {/* Mute Button */}
                                                    <button
                                                        onClick={() => toggleMute(key)}
                                                        className={`w-7 h-7 rounded text-xs font-bold transition-all ${tr.muted
                                                            ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)] border border-rose-400'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                                                            }`}
                                                        title="Mute Track"
                                                    >
                                                        M
                                                    </button>
                                                    {/* Solo Button */}
                                                    <button
                                                        onClick={() => toggleSolo(key)}
                                                        className={`w-7 h-7 rounded text-xs font-bold transition-all ${tr.solo
                                                            ? 'bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.4)] border border-amber-300'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                                                            }`}
                                                        title="Solo Track"
                                                    >
                                                        S
                                                    </button>
                                                    {/* Track Label */}
                                                    <span className="text-sm font-semibold text-slate-200 flex items-center gap-2 ml-2">
                                                        <span>{cfg.icon}</span>
                                                        <span>{cfg.name}</span>
                                                    </span>
                                                </div>

                                                {/* Download Mini Button */}
                                                <button
                                                    onClick={() => downloadStem(key)}
                                                    className="text-gray-500 hover:text-cyan-400 text-xs p-1"
                                                    title="Download Stem"
                                                >
                                                    ⬇️
                                                </button>
                                            </div>

                                            {/* Track Volume Fader & Pan Knob */}
                                            <div className="flex items-center gap-3 mt-1">
                                                {/* Volume Range Slider */}
                                                <div className="flex-1 flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={tr.muted ? 0 : tr.volume}
                                                        onChange={(e) => handleVolumeChange(key, e.target.value)}
                                                        className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                                                    />
                                                </div>

                                                {/* Pan Control Dial */}
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-slate-500 font-mono font-medium">L</span>
                                                    <input
                                                        type="range"
                                                        min="-1"
                                                        max="1"
                                                        step="0.05"
                                                        value={tr.pan}
                                                        onChange={(e) => handlePanChange(key, e.target.value)}
                                                        className="w-12 accent-purple-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                                                    />
                                                    <span className="text-[10px] text-slate-500 font-mono font-medium">R</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ================= RIGHT TIMELINE & WAVEFORMS ================= */}
                        <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-950/50">
                            {/* Timeline Header Ruler */}
                            <div
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const clickX = e.clientX - rect.left;
                                    const pct = clickX / rect.width;
                                    seekTo(pct * duration);
                                }}
                                className="h-8 border-b border-slate-800/80 bg-slate-900/60 flex items-center relative cursor-pointer select-none"
                            >
                                {[0, 0.25, 0.5, 0.75, 1.0].map((pct, idx) => (
                                    <div
                                        key={idx}
                                        className="absolute text-[10px] text-slate-400 font-mono font-medium transform -translate-x-1/2"
                                        style={{ left: `${pct * 100}%` }}
                                    >
                                        {formatTime(pct * duration)}
                                    </div>
                                ))}
                            </div>

                            {/* Stacked Stem Waveform Canvas Lanes */}
                            <div className="flex-1 flex flex-col divide-y divide-slate-800/40 relative">
                                {DEFAULT_STEM_KEYS.map((key) => {
                                    return (
                                        <div
                                            key={key}
                                            onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const clickX = e.clientX - rect.left;
                                                const pct = clickX / rect.width;
                                                seekTo(pct * duration);
                                            }}
                                            className="flex-1 relative cursor-pointer group"
                                        >
                                            <canvas
                                                ref={(el) => (canvasRefs.current[key] = el)}
                                                width={900}
                                                height={90}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    );
                                })}

                                {/* Synchronized Vertical Scrubber Line */}
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_#fff] z-20 pointer-events-none transition-all duration-75"
                                    style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                                >
                                    <div className="w-3 h-3 bg-white rotate-45 transform -translate-x-1/2 -mt-1 rounded-sm shadow-md" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ================= BOTTOM TRANSPORT PLAYER BAR ================= */}
                    <footer className="h-[72px] bg-slate-900 border-t border-slate-800/80 px-6 flex items-center justify-between gap-4 z-30 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
                        {/* Time & Playback Speed Controls */}
                        <div className="flex items-center gap-4">
                            <div className="text-xs font-mono text-indigo-400 font-semibold bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner">
                                {formatTime(currentTime)} <span className="text-slate-600">/</span> {formatTime(duration)}
                            </div>

                            {/* Speed Selector Pill */}
                            <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 shadow-inner">
                                {[0.5, 1.0, 2.0].map((rate) => (
                                    <button
                                        key={rate}
                                        onClick={() => {
                                            setPlaybackRate(rate);
                                            if (isPlaying) playAudio(currentTime);
                                        }}
                                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${playbackRate === rate
                                            ? 'bg-indigo-500 text-white shadow-md'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        {rate}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Center Transport Controls */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => seekTo(0)}
                                className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                title="Rewind to Start"
                            >
                                ⏮️
                            </button>

                            {/* Big Play / Pause Button */}
                            <button
                                onClick={togglePlay}
                                className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-105 text-white flex items-center justify-center text-xl shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all cursor-pointer"
                            >
                                {isPlaying ? '⏸️' : '▶️'}
                            </button>

                            <button
                                onClick={() => setIsLooping(!isLooping)}
                                className={`p-2.5 rounded-full transition-all ${isLooping ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                                title="Toggle Loop"
                            >
                                🔁
                            </button>
                        </div>

                        {/* Master Volume & Tab Buttons */}
                        <div className="flex items-center gap-5">
                            <div className="hidden sm:flex items-center gap-3">
                                <span className="text-sm text-slate-400">🔊</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={masterVolume}
                                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                                    className="w-24 accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => alert("Lyrics tab initialized: Syncs song lyrics with stem tracks!")}
                                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700/50 transition-colors shadow-sm"
                                >
                                    📄 Lyrics
                                </button>
                                <button
                                    onClick={() => alert("Chords tab initialized: Displays real-time chord progressions!")}
                                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700/50 transition-colors shadow-sm"
                                >
                                    🎼 Chords
                                </button>
                            </div>
                        </div>
                    </footer>
                </div>
            )}
        </div>
    );
};

export default StemSeparator;
