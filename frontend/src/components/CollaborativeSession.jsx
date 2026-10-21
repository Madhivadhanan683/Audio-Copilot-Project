import React, { useState, useEffect, useRef } from 'react';

const CollaborativeSession = () => {
    const [sessionId, setSessionId] = useState('room-1');
    const [username, setUsername] = useState('Producer 1');
    const [wsConnected, setWsConnected] = useState(false);
    const [sharedState, setSharedState] = useState({
        bpm: 120,
        key: 'C Major',
        scale: 'Major',
        status: 'active'
    });
    
    // UI state
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [localBpm, setLocalBpm] = useState(120);
    const [localKey, setLocalKey] = useState('C Major');
    
    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    
    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const connectToSession = () => {
        if (ws.current) {
            ws.current.close();
        }

        const socketUrl = `ws://localhost:8000/ws/session/${sessionId}`;
        ws.current = new WebSocket(socketUrl);

        ws.current.onopen = () => {
             console.log(`Connected to session: ${sessionId} as ${username}`);
             setWsConnected(true);
             setMessages(prev => [...prev, { type: 'system', text: `${username} joined session: ${sessionId}`, id: Date.now() }]);
        };

        ws.current.onmessage = (event) => {
             try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'STATE_SYNC') {
                    setSharedState(data.payload);
                    setLocalBpm(data.payload.bpm);
                    setLocalKey(data.payload.key);
                } else if (data.type === 'USER_JOINED' || data.type === 'USER_LEFT') {
                    setMessages(prev => [...prev, { type: 'system', text: data.payload.message, id: Date.now() }]);
                } else if (data.type === 'CHAT_MESSAGE') {
                    setMessages(prev => [...prev, { type: 'user', text: data.payload.text, sender: data.payload.sender, id: Date.now() }]);
                }
             } catch (e) {
                 console.error("Error parsing WS message", e);
             }
        };

        ws.current.onclose = () => {
            console.log("Disconnected from session");
            setWsConnected(false);
            setMessages(prev => [...prev, { type: 'system', text: 'Disconnected from session.', id: Date.now() }]);
        };
        
        ws.current.onerror = (err) => {
            console.error("WS error:", err);
            setWsConnected(false);
        };
    };

    // Cleanup on unmount
    useEffect(() => {
         return () => {
             if (ws.current) {
                 ws.current.close();
             }
         };
    }, []);

    const updateSharedState = (e) => {
        e.preventDefault();
        if (ws.current && wsConnected) {
             const payload = {
                 bpm: Number(localBpm),
                 key: localKey
             };
             ws.current.send(JSON.stringify({ type: 'STATE_UPDATE', payload }));
             // Optimistically update our own state just in case
             setSharedState(prev => ({...prev, ...payload}));
        }
    };

    const sendChatMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !wsConnected || !ws.current) return;
        
        const payload = {
             text: chatInput,
             sender: username || 'Producer'
        };
        
        ws.current.send(JSON.stringify({ type: 'CHAT_MESSAGE', payload }));
        setChatInput('');
    };

    return (
        <div className="collaborative-session-container p-6 bg-gray-800 text-white rounded-lg shadow-xl max-w-4xl mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-6 text-center text-daw-accent">🤝 Collaborative Session</h2>
            
            {!wsConnected ? (
                <div className="join-screen flex flex-col items-center justify-center p-8 bg-gray-700 rounded-lg">
                     <p className="mb-4 text-gray-300">Enter your name and Room ID to start collaborating</p>
                     <div className="flex flex-col sm:flex-row gap-4 mb-4">
                         <input 
                              type="text" 
                              value={username} 
                              onChange={(e) => setUsername(e.target.value)} 
                              className="px-4 py-2 bg-gray-900 border border-gray-600 rounded text-lg focus:outline-none focus:border-daw-accent"
                              placeholder="Your Name"
                         />
                         <input 
                              type="text" 
                              value={sessionId} 
                              onChange={(e) => setSessionId(e.target.value)} 
                              className="px-4 py-2 bg-gray-900 border border-gray-600 rounded text-lg focus:outline-none focus:border-daw-accent"
                              placeholder="Room ID (e.g. room-1)"
                         />
                     </div>
                     <button 
                          onClick={connectToSession}
                          className="px-8 py-3 bg-daw-accent text-gray-900 font-bold rounded hover:bg-daw-accent-hover transition-colors shadow-lg text-lg"
                     >
                         Join Room
                     </button>
                </div>
            ) : (

                <div className="session-grid grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Shared State */}
                    <div className="shared-state-panel bg-gray-700 p-6 rounded-lg shadow">
                         <div className="flex justify-between items-center mb-6">
                              <h3 className="text-xl font-semibold">Shared Project State</h3>
                              <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs font-bold shadow-inner">
                                  LIVE in {sessionId}
                              </span>
                         </div>
                         
                         <form onSubmit={updateSharedState} className="flex flex-col gap-6">
                              <div className="control-group">
                                   <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Global Tempo (BPM)</label>
                                   <div className="flex items-center gap-4">
                                        <input 
                                             type="range" 
                                             min="60" max="200" 
                                             value={localBpm} 
                                             onChange={(e) => setLocalBpm(e.target.value)}
                                             className="w-full h-2 bg-gray-900 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <input 
                                             type="number" 
                                             value={localBpm}
                                             onChange={(e) => setLocalBpm(e.target.value)}
                                             className="w-20 bg-gray-900 border border-gray-600 rounded p-2 text-center text-xl font-mono focus:border-daw-accent focus:outline-none"
                                        />
                                   </div>
                              </div>
                              
                              <div className="control-group">
                                   <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Global Key</label>
                                   <select 
                                        value={localKey} 
                                        onChange={(e) => setLocalKey(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-3 focus:outline-none focus:border-daw-accent appearance-none text-lg"
                                   >
                                        <option value="C Major">C Major</option>
                                        <option value="A Minor">A Minor</option>
                                        <option value="D Minor">D Minor</option>
                                        <option value="G Major">G Major</option>
                                        <option value="F Minor">F Minor</option>
                                   </select>
                              </div>

                              <button 
                                   type="submit"
                                   className="mt-4 px-4 py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 transition-colors shadow"
                              >
                                   Sync State to Everyone
                              </button>
                         </form>
                    </div>

                    {/* Right Column: Shared Chat */}
                    <div className="chat-panel bg-gray-700 p-4 rounded-lg flex flex-col h-[400px]">
                         <h3 className="text-lg font-semibold mb-3 border-b border-gray-600 pb-2">Session Chat</h3>
                         
                         <div className="messages-container flex-1 overflow-y-auto mb-4 flex flex-col gap-2 p-2 bg-gray-900 rounded border border-gray-800 shadow-inner">
                              {messages.map((msg) => (
                                   <div key={msg.id} className={`p-2 rounded max-w-[90%] ${msg.type === 'system' ? 'mx-auto text-center text-xs text-gray-500 italic' : 'bg-gray-800 text-sm shadow-sm'}`}>
                                        {msg.type === 'user' && (
                                            <span className="block text-xs font-bold text-daw-accent mb-1">{msg.sender}</span>
                                        )}
                                        <span className={msg.type === 'system' ? '' : 'text-gray-200'}>{msg.text}</span>
                                   </div>
                              ))}
                              <div ref={messagesEndRef} />
                         </div>

                         <form onSubmit={sendChatMessage} className="flex gap-2 relative">
                              <input 
                                   type="text" 
                                   value={chatInput} 
                                   onChange={(e) => setChatInput(e.target.value)}
                                   placeholder="Drop a note..."
                                   className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm focus:outline-none focus:border-daw-accent"
                              />
                              <button 
                                   type="submit"
                                   className="px-4 py-2 bg-daw-accent text-gray-900 font-bold rounded hover:bg-daw-accent-hover transition-colors absolute right-1 top-1 bottom-1 flex items-center justify-center"
                              >
                                   Send
                              </button>
                         </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollaborativeSession;
