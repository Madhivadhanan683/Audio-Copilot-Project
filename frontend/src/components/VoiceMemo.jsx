
import React, { useState, useRef } from 'react';
import { apiUrl } from '../lib/api';

const VoiceMemo = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [transcription, setTranscription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setUploadFile(null); // Clear upload if new recording exists
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop all tracks to release microphone
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
            setAudioBlob(null); // Clear recording if file uploaded
        }
    };

    const handleTranscribe = async () => {
        if (!audioBlob && !uploadFile) return;

        setIsLoading(true);
        const formData = new FormData();

        if (uploadFile) {
            formData.append('file', uploadFile);
        } else {
            // Create a file from the blob
            const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });
            formData.append('file', file);
        }

        try {
            const response = await fetch(apiUrl('/api/transcription/transcribe'), {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Transcription failed');
            }

            const data = await response.json();
            setTranscription(data.text);
        } catch (error) {
            console.error("Transcription error:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveNote = async () => {
        if (!transcription) return;

        try {
            const response = await fetch(apiUrl('/api/transcription/save'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: transcription }),
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }

            alert("Note saved successfully!");
        } catch (error) {
            console.error("Save error:", error);
            alert("Failed to save note.");
        }
    };

    return (
        <div className="voice-memo-container p-6 bg-gray-800 text-white rounded-lg shadow-xl max-w-2xl mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-6 text-center text-daw-accent">Voice Memos & Transcription</h2>

            <div className="controls flex flex-col gap-6">

                {/* Recording Section */}
                <div className="recording-section bg-gray-700 p-4 rounded-lg flex flex-col items-center gap-4">
                    <h3 className="text-lg font-semibold">Record Audio</h3>
                    <div className="flex gap-4">
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full font-bold transition-colors flex items-center gap-2"
                            >
                                🔴 Start Recording
                            </button>
                        ) : (
                            <button
                                onClick={stopRecording}
                                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-full font-bold transition-colors animate-pulse"
                            >
                                ⏹ Stop Recording
                            </button>
                        )}
                    </div>
                    {audioBlob && (
                        <div className="audio-preview mt-2 w-full">
                            <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
                        </div>
                    )}
                </div>

                {/* Upload Section */}
                <div className="upload-section bg-gray-700 p-4 rounded-lg flex flex-col items-center gap-4">
                    <h3 className="text-lg font-semibold">Or Upload File</h3>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="file-input w-full max-w-xs text-sm text-gray-300"
                    />
                    {uploadFile && <p className="text-sm text-green-400">Selected: {uploadFile.name}</p>}
                </div>

                {/* Action Section */}
                <div className="action-section flex justify-center">
                    <button
                        onClick={handleTranscribe}
                        disabled={(!audioBlob && !uploadFile) || isLoading}
                        className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${(!audioBlob && !uploadFile) || isLoading
                                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                : 'bg-daw-accent text-gray-900 hover:bg-daw-accent-hover'
                            }`}
                    >
                        {isLoading ? 'Transcribing...' : '✨ Transcribe'}
                    </button>
                </div>

                {/* Result Section */}
                {transcription && (
                    <div className="result-section bg-gray-700 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Transcription</h3>
                        <textarea
                            value={transcription}
                            onChange={(e) => setTranscription(e.target.value)}
                            className="w-full h-40 bg-gray-900 p-3 rounded border border-gray-600 focus:border-daw-accent focus:outline-none resize-none"
                        />
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleSaveNote}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                            >
                                💾 Save to Notes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceMemo;
