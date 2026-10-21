import React, { useState, useEffect } from 'react';

const SettingsModal = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('local');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/settings');
            const data = await response.json();
            if (data.provider) setModel(data.provider === 'mock' ? 'local' : data.provider);
        } catch (error) {
            console.error('Failed to load settings:', error);
            setMessage('⚠️ Could not connect to backend.');
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setMessage('');

        try {
            const backendProvider = model === 'local' ? 'mock' : model;
            const response = await fetch('http://127.0.0.1:8000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: backendProvider,
                    api_key: model === 'openai' ? apiKey : null
                })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage('✅ Settings saved successfully!');
                setTimeout(() => {
                    onClose();
                    setMessage('');
                }, 1500);
            } else {
                const errorMsg = typeof data.detail === 'string'
                    ? data.detail
                    : JSON.stringify(data.detail) || 'Unknown error';
                setMessage(`❌ Error: ${errorMsg}`);
            }
        } catch (error) {
            setMessage(`❌ Failed to save settings: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="modal-content bg-daw-panel p-8 rounded-lg w-[450px] border border-gray-600 shadow-2xl">
                <h2 className="text-2xl font-bold mb-6 text-daw-text">Settings</h2>

                <div className="form-group mb-4">
                    <label className="block mb-2 font-semibold">AI Model Provider</label>
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full p-2 bg-daw-bg border border-gray-600 rounded text-white focus:border-daw-accent focus:outline-none"
                    >
                        <option value="local">Local Music Producer Engine (Default - Offline/Free)</option>
                        <option value="openai">OpenAI GPT-4o (Requires API Key)</option>
                    </select>
                </div>

                {model === 'openai' && (
                    <div className="form-group mb-6 animate-fadeIn">
                        <label className="block mb-2 font-semibold">OpenAI API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full p-2 bg-daw-bg border border-gray-600 rounded text-white focus:border-daw-accent focus:outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Key is stored in memory only for this session.</p>
                    </div>
                )}

                {message && (
                    <div className={`settings-message p-3 rounded mb-4 text-center font-medium ${message.includes('Error') || message.includes('Failed') ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'}`}>
                        {message}
                    </div>
                )}

                <div className="modal-actions flex justify-end gap-3 mt-8">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 rounded bg-daw-accent text-black font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

