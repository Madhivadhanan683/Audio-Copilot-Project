import React, { useState, useEffect } from 'react';

const AICoProducers = ({ currentPersona, setCurrentPersona }) => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/personas')
      .then(res => res.json())
      .then(data => {
        setPersonas(data.personas || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load personas", err);
        setLoading(false);
      });
  }, []);

  const handleSelect = (persona) => {
    setCurrentPersona(persona);
  };

  if (loading) {
    return <div className="card p-6"><div className="loader"></div> Loading Co-Producers...</div>;
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">AI Co-Producers</h2>
        {currentPersona && (
          <div className="flex items-center gap-2 bg-indigo-900/40 px-4 py-2 rounded-full border border-indigo-500/30">
            <span className="text-sm text-gray-400">Current Session:</span>
            <img src={currentPersona.avatar} alt={currentPersona.name} className="w-6 h-6 rounded-full" />
            <span className="font-semibold text-indigo-300">{currentPersona.name}</span>
            <button 
              onClick={() => setCurrentPersona(null)} 
              className="ml-2 text-xs text-red-400 hover:text-red-300"
              title="End Session"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-300 mb-6">
        Select a digital twin to collaborate with. They will guide your session, assist in the chat, and influence generative tools according to their unique musical style.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map(persona => (
          <div 
            key={persona.id} 
            className={`flex flex-col bg-gray-800 rounded-xl overflow-hidden border transition-all duration-300 shadow-lg group ${currentPersona?.id === persona.id ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-500/20' : 'border-gray-700 hover:border-indigo-400'}`}
          >
            <div className="h-40 overflow-hidden relative border-b border-gray-700">
              <img 
                src={persona.avatar} 
                alt={persona.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  e.target.onerror = null; 
                  e.target.src = `https://ui-avatars.com/api/?name=${persona.name.replace(' ', '+')}&background=random`
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-80" />
              <div className="absolute bottom-3 left-4">
                <h3 className="text-xl font-bold text-white drop-shadow-md">{persona.name}</h3>
                <span className="text-xs font-semibold px-2 py-1 bg-indigo-600/80 rounded-full drop-shadow-md text-white mt-1 inline-block">
                  {persona.genre}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <p className="text-sm text-gray-300 mb-6 flex-1 italic leading-relaxed">
                "{persona.description}"
              </p>
              
              <button 
                onClick={() => handleSelect(persona)}
                disabled={currentPersona?.id === persona.id}
                className={`btn w-full py-2 ${currentPersona?.id === persona.id ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}`}
              >
                {currentPersona?.id === persona.id ? 'Active Session' : 'Start Collab Session'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AICoProducers;
