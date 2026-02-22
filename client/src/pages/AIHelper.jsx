import { useState, useRef, useEffect } from 'react';
import api from '../api/client';

const QUICK_ACTIONS = [
  'Koji usjevi su trenutno najprofitabilniji?',
  'Koliko sjemena mi je ostalo i treba li mi naručiti?',
  'Koje plitice su skoro za berbu?',
  'Što bi trebao posijati sljedeći tjedan?',
];

export default function AIHelper() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Zdravo! Ja sam tvoj ZGreens AI asistent. Vidim podatke tvoje farme u stvarnom vremenu — aktivne plitice, zalihe sjemena, berbe i prodaju. Što te zanima?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const next = [...messages, { role: 'user', text: msg }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chat', {
        message: msg,
        history: messages.slice(1), // skip the greeting
      });
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Nepoznata greška.';
      setMessages(prev => [...prev, { role: 'assistant', text: `Greška: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 h-full flex flex-col">
      <div className="page-header">
        <div>
          <h2 className="page-title">AI Asistent</h2>
          <p className="text-gray-500 text-sm mt-1">Analiza podataka farme u stvarnom vremenu</p>
        </div>
      </div>

      {/* Quick action chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUICK_ACTIONS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="flex gap-3">
        <input
          className="input flex-1"
          placeholder="Pitaj nešto o svojoj farmi…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          className="btn-primary px-5"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          Pošalji
        </button>
      </div>
    </div>
  );
}
