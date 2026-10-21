import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const ChatInterface = ({ currentPersona, dawState }) => {
    const defaultWelcome = "I'm your Audio Copilot. Ready to produce? Try asking for a 'sad violin melody'.";
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Update welcome message when persona changes
    useEffect(() => {
        if (currentPersona) {
            setMessages([
                { sender: 'ai', text: `Hi! I'm your digital twin of ${currentPersona.name}. Let's make some hit music! What are we working on?`, files: [] }
            ]);
        } else {
            setMessages([
                { sender: 'ai', text: defaultWelcome, files: [] }
            ]);
        }
    }, [currentPersona]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = { sender: 'user', text: input, files: [] };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const payload = { 
                message: userMsg.text,
                daw_state: dawState,
                context: messages.map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }))
            };
            if (currentPersona) {
                payload.persona_id = currentPersona.id;
            }

            const response = await fetch('http://127.0.0.1:8000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            // Data format: { text: "...", files: [{type: "midi", url: "...", name: "..."}] }
            setMessages(prev => [...prev, { sender: 'ai', text: data.text, files: data.files || [] }]);
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I couldn't connect to the backend. Is it running?", files: [] }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragStart = (e, fileUrl, fileName) => {
        e.dataTransfer.setData("text/plain", fileUrl);
        e.dataTransfer.setData("DownloadURL", `audio/midi:${fileName}:${window.location.protocol}//${window.location.hostname}:8000${fileUrl}`);
        // This 'DownloadURL' format is specific to Chrome/Chromium to allow drag-out downloads
    };

    return (
        <div className="chat-interface h-full flex flex-col bg-daw-bg">
            <div className="messages flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`bubble max-w-[80%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-daw-accent text-black' : 'bg-daw-panel text-daw-text'}`}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>

                        {msg.files && msg.files.length > 0 && (
                            <div className="file-attachments mt-2 space-y-2">
                                {msg.files.map((file, fIdx) => (
                                    <div
                                        key={fIdx}
                                        className="file-card p-3 bg-gray-700 rounded border border-gray-600 cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors flex items-center justify-between"
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, file.url, file.name || 'generated.mid')}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">🎹</span>
                                            <div>
                                                <div className="font-bold text-sm">{file.name}</div>
                                                <div className="text-xs text-gray-400 uppercase">{file.type}</div>
                                            </div>
                                        </div>
                                        <a href={`http://127.0.0.1:8000${file.url}`} download className="text-daw-accent hover:text-white">
                                            ⬇️
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                ))}
                {isLoading && (
                    <div className="message ai">
                        <div className="bubble bg-daw-panel text-daw-text p-3 rounded-lg animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-area p-4 border-t border-gray-700 bg-daw-panel flex gap-2">
                <input
                    type="text"
                    className="flex-1 bg-daw-bg text-white border border-gray-600 rounded p-2 focus:outline-none focus:border-daw-accent"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask for a melody, chord progression, or beat..."
                />
                <button
                    className="bg-daw-accent text-black font-bold py-2 px-6 rounded hover:opacity-90 disabled:opacity-50"
                    onClick={sendMessage}
                    disabled={isLoading}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatInterface;

