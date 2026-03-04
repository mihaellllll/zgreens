import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Sparkles, CheckCircle2, X, Settings, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import PageWrapper from '../components/PageWrapper';

const STORAGE_KEY = 'zgreens_ai_messages';

const GREETING = {
  role: 'assistant',
  text: 'Zdravo! Ja sam tvoj ZGreens AI asistent. Vidim podatke tvoje farme u stvarnom vremenu — aktivne plitice, zalihe sjemena, berbe i prodaju. Što te zanima?',
};

function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [GREETING];
}

const QUICK_ACTIONS = [
  'Najprofitabilniji usjevi?',
  'Zalihe sjemena?',
  'Berbe uskoro?',
  'Što posijati?',
];

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#A8A89A',
            animation: 'dot-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', padding: '3px 0' }}>
      {!isUser && (
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #4A7A5E, #1A2E22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: '10px', marginTop: '2px',
          boxShadow: '0 2px 6px rgba(42,80,64,0.3)',
        }}>
          <Sparkles size={13} color="#ffffff" />
        </div>
      )}
      <div style={{
        maxWidth: '78%', padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'linear-gradient(135deg, #2D5040, #1A2E22)' : '#ffffff',
        color: isUser ? '#ffffff' : '#1A1A16',
        fontSize: '13px', lineHeight: '1.5',
        ...(isUser ? { whiteSpace: 'pre-wrap' } : {}),
        boxShadow: isUser
          ? '0 4px 12px rgba(42,80,64,0.2)'
          : '0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)',
        border: isUser ? 'none' : '1px solid #E5E0D5',
        fontWeight: '500',
      }}>
        {isUser ? message.text : (
          <div className="ai-markdown">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        )}
        {message.actionsExecuted && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            marginTop: '8px', padding: '4px 10px', borderRadius: '99px',
            background: 'rgba(74,122,94,0.15)', border: '1px solid rgba(74,122,94,0.3)',
            fontSize: '11px', fontWeight: '700', color: '#2D5040',
          }}>
            <CheckCircle2 size={11} /> Farma ažurirana
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared typing indicator row ───────────────────────────────────────────────

function LoadingBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '3px 0' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'linear-gradient(135deg, #4A7A5E, #1A2E22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginRight: '10px', marginTop: '2px',
      }}>
        <Sparkles size={13} color="#ffffff" />
      </div>
      <div style={{
        padding: '10px 14px', background: '#ffffff', border: '1px solid #E5E0D5',
        borderRadius: '16px 16px 16px 4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)',
      }}>
        <TypingDots />
      </div>
    </div>
  );
}

// ── Main AIHelper ─────────────────────────────────────────────────────────────

export default function AIHelper({ fullPage = false }) {
  const [isOpen, setIsOpen]         = useState(false);
  const [messages, setMessages]     = useState(loadMessages);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [noKeyBanner, setNoKeyBanner] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const navigate  = useNavigate();

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    const shouldScroll = fullPage || isOpen;
    if (shouldScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, loading, isOpen, fullPage]);

  // Auto-focus input on full-page mount
  useEffect(() => {
    if (fullPage) setTimeout(() => inputRef.current?.focus(), 200);
  }, [fullPage]);

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
        history: next.slice(1),
      });
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply, actionsExecuted: data.actionsExecuted }]);
    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error || err.message || 'Nepoznata greška.';
      if (status === 503 && errMsg.includes('ključ')) {
        setNoKeyBanner(true);
        setMessages(prev => prev.slice(0, -1)); // remove the user message we added
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: `Greška: ${errMsg}` }]);
      }
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([GREETING]);

  // ── Input bar (shared between page and widget) ──
  const InputBar = (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {QUICK_ACTIONS.map(q => (
          <button
            key={q} onClick={() => send(q)} disabled={loading}
            style={{
              padding: '6px 13px', borderRadius: '99px', fontSize: '12px', fontWeight: '600',
              background: '#ffffff', color: '#2D5040', border: '1px solid #E5E0D5',
              cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#EAF0EC'; e.currentTarget.style.borderColor = 'rgba(45,80,64,0.3)'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#E5E0D5'; }}
          >
            {q}
          </button>
        ))}
      </div>
      <div style={{
        display: 'flex', gap: '8px', background: '#ffffff',
        borderRadius: '24px', padding: '6px 6px 6px 16px',
        border: '1.5px solid #E5E0D5',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <input
          ref={inputRef}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: '14px',
            color: '#1A1A16', background: 'transparent', fontFamily: 'inherit',
          }}
          placeholder="Pitaj nešto o farmi…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: (!loading && input.trim()) ? '#1A2E22' : '#E5E0D5',
            border: 'none', cursor: (!loading && input.trim()) ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s ease',
          }}
        >
          <Send size={15} color={(!loading && input.trim()) ? '#ffffff' : '#A8A89A'} />
        </button>
      </div>
    </div>
  );

  // ── No-key banner ────────────────────────────────────────────────────────────
  const NoKeyBanner = noKeyBanner && (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '12px', padding: '14px 18px', borderRadius: '14px', marginBottom: '12px',
      background: 'rgba(176,74,58,0.08)', border: '1px solid rgba(176,74,58,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <AlertTriangle size={18} color="#B04A3A" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '13px', color: '#B04A3A', fontWeight: '600', lineHeight: '1.4' }}>
          Groq API ključ nije postavljen. AI asistent neće raditi dok ga ne dodaš u Postavkama.
        </p>
      </div>
      <button
        onClick={() => navigate('/settings')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
          padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(176,74,58,0.3)',
          background: 'rgba(176,74,58,0.1)', color: '#B04A3A',
          fontSize: '12px', fontWeight: '700', cursor: 'pointer',
        }}
      >
        <Settings size={13} strokeWidth={1.5} /> Postavke
      </button>
    </div>
  );

  // ── FULL PAGE MODE ────────────────────────────────────────────────────────────
  if (fullPage) {
    return (
      <PageWrapper>
        {/* Header */}
        <div className="gsap-reveal page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #4A7A5E, #1A2E22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(42,80,64,0.25)',
            }}>
              <Sparkles size={22} color="#ffffff" />
            </div>
            <div>
              <h2 className="page-title" style={{ margin: 0 }}>AI Asistent</h2>
              <p className="page-subtitle" style={{ margin: 0 }}>ZGreens Farm OS · AI Asistent</p>
            </div>
          </div>
          {messages.length > 1 && (
            <button onClick={clearChat} className="btn-secondary" style={{ gap: '6px', fontSize: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} /> Novi razgovor
            </button>
          )}
        </div>

        {NoKeyBanner}

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
          gap: '4px', padding: '4px 2px 16px',
          scrollbarWidth: 'thin', scrollbarColor: '#E5E0D5 transparent',
        }}>
          {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
          {loading && <LoadingBubble />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {InputBar}
      </PageWrapper>
    );
  }

  // ── FLOATING WIDGET MODE ──────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex"
        style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 50,
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #4A7A5E, #1A2E22)',
          color: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(42,80,64,0.4)',
          alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(42,80,64,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(42,80,64,0.4)'; }}
      >
        <Sparkles size={18} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: '68px', right: '20px', zIndex: 50,
      width: 'min(360px, calc(100vw - 32px))', height: '560px', maxHeight: 'calc(100vh - 48px)',
      background: '#F7F5F0', borderRadius: '24px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.2)', border: '1px solid #E5E0D5',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', background: '#ffffff', borderBottom: '1px solid #E5E0D5',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={16} color="#4A7A5E" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1A1A16' }}>AI Asistent</h3>
            <p style={{ margin: 0, fontSize: '11px', color: '#6B6B60' }}>ZGreens Farm OS</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {messages.length > 1 && (
            <button onClick={clearChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A89A', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={() => setIsOpen(false)} style={{ background: '#F0EDE8', border: 'none', cursor: 'pointer', color: '#6B6B60', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* No-key banner in widget */}
      {noKeyBanner && (
        <div style={{
          margin: '10px 12px 0', padding: '10px 14px', borderRadius: '12px',
          background: 'rgba(176,74,58,0.08)', border: '1px solid rgba(176,74,58,0.2)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertTriangle size={15} color="#B04A3A" strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '12px', color: '#B04A3A', fontWeight: '600', flex: 1, lineHeight: '1.4' }}>
            Groq ključ nije postavljen.{' '}
            <button
              onClick={() => navigate('/settings')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#B04A3A', fontWeight: '800', textDecoration: 'underline', fontSize: 'inherit' }}
            >
              Idi na Postavke →
            </button>
          </p>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {loading && <LoadingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', padding: '0 16px 12px', scrollbarWidth: 'none' }}>
        {QUICK_ACTIONS.map(q => (
          <button
            key={q} onClick={() => send(q)} disabled={loading}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '600',
              background: '#ffffff', color: '#2D5040', border: '1px solid #E5E0D5',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '12px', background: '#ffffff', borderTop: '1px solid #E5E0D5' }}>
        <div style={{
          display: 'flex', gap: '8px', background: '#F7F5F0',
          borderRadius: '24px', padding: '6px 6px 6px 14px', border: '1px solid #E5E0D5',
        }}>
          <input
            ref={inputRef}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', color: '#1A1A16', background: 'transparent', fontFamily: 'inherit' }}
            placeholder="Pitaj nešto o farmi…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: (!loading && input.trim()) ? '#1A2E22' : '#E5E0D5',
              border: 'none', cursor: (!loading && input.trim()) ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={14} color={(!loading && input.trim()) ? '#ffffff' : '#A8A89A'} />
          </button>
        </div>
      </div>
    </div>
  );
}
