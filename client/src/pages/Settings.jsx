import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, ExternalLink, Save, User } from 'lucide-react';
import api from '../api/client';
import PageWrapper from '../components/PageWrapper';

export default function Settings() {
  const [name, setName]             = useState('');
  const [groqKey, setGroqKey]       = useState('');
  const [clearKey, setClearKey]     = useState(false); // user clicked "Ukloni ključ"
  const [showKey, setShowKey]       = useState(false);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setName(data.name || '');
      setHasGroqKey(data.hasGroqKey);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError('Ime ne smije biti prazno.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = { name: name.trim() };
      if (groqKey.trim()) {
        payload.groqApiKey = groqKey.trim();   // new key entered
      } else if (clearKey) {
        payload.groqApiKey = '';               // explicit clear → backend saves null
      }
      const { data } = await api.patch('/auth/settings', payload);
      setHasGroqKey(data.hasGroqKey);
      setGroqKey('');
      setClearKey(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Greška pri spremanju.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#A8A89A', fontSize: '14px' }}>
          Učitavanje…
        </div>
      </PageWrapper>
    );
  }

  const keyPending = clearKey || groqKey.trim().length > 0;

  return (
    <PageWrapper>
      <div className="gsap-reveal page-header" style={{ marginBottom: '32px' }}>
        <div className="page-header-left">
          <h2 className="page-title">Postavke</h2>
          <p className="page-subtitle">Upravljaj računom i API ključevima</p>
        </div>
      </div>

      <div style={{ maxWidth: '520px' }}>
        {/* Account section */}
        <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #4A7A5E, #1A2E22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={18} color="#ffffff" strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1A1A16' }}>Račun</h3>
          </div>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#5C6B63', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Ime
          </label>
          <input
            className="input"
            style={{ marginBottom: 0 }}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tvoje ime"
          />
        </div>

        {/* Groq API key section */}
        <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              background: (hasGroqKey && !clearKey)
                ? 'linear-gradient(135deg, #4A7A5E, #2D5040)'
                : 'linear-gradient(135deg, #C0846A, #8B3A2A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(hasGroqKey && !clearKey)
                ? <CheckCircle2 size={18} color="#ffffff" strokeWidth={1.5} />
                : <AlertTriangle size={18} color="#ffffff" strokeWidth={1.5} />
              }
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1A1A16' }}>Groq API ključ</h3>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: (hasGroqKey && !clearKey) ? '#2D7A4F' : '#B55A3A' }}>
                {clearKey
                  ? 'Ključ će biti uklonjen pri spremanju'
                  : hasGroqKey
                    ? 'Ključ je postavljen — AI je aktivan'
                    : 'Ključ nije postavljen — AI neće raditi'
                }
              </p>
            </div>
          </div>

          {!clearKey ? (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#5C6B63', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                {hasGroqKey ? 'Zamijeni ključ (ostavi prazno da zadržiš trenutni)' : 'Unesi ključ'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  style={{ paddingRight: '48px', marginBottom: 0, fontFamily: showKey ? 'inherit' : 'monospace' }}
                  type={showKey ? 'text' : 'password'}
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder={hasGroqKey ? '••••••••••••••••••••' : 'gsk_...'}
                  autoComplete="off"
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  type="button"
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#8A9A8E', padding: '4px',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showKey ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              </div>

              {hasGroqKey && (
                <button
                  onClick={() => { setClearKey(true); setGroqKey(''); }}
                  type="button"
                  style={{
                    marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: '#B55A3A', fontWeight: '600', padding: 0,
                  }}
                >
                  Ukloni ključ
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setClearKey(false)}
              type="button"
              style={{
                background: 'none', border: '1px solid rgba(176,74,58,0.3)', cursor: 'pointer',
                borderRadius: '10px', fontSize: '12px', color: '#B55A3A', fontWeight: '600',
                padding: '8px 14px',
              }}
            >
              Odustani od uklanjanja
            </button>
          )}

          <div style={{ marginTop: '20px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(45,80,64,0.06)', border: '1px solid rgba(45,80,64,0.12)' }}>
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '13px', fontWeight: '700', color: '#2D5040',
                textDecoration: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              console.groq.com <ExternalLink size={12} strokeWidth={2} />
            </a>
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(176,74,58,0.08)', border: '1px solid rgba(176,74,58,0.2)',
            fontSize: '13px', color: '#B04A3A', fontWeight: '600',
          }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center', padding: '14px' }}
        >
          {saved
            ? <><CheckCircle2 size={16} strokeWidth={1.5} /> Spremljeno!</>
            : saving
              ? 'Sprema…'
              : <><Save size={16} strokeWidth={1.5} /> Spremi postavke</>
          }
        </button>
      </div>
    </PageWrapper>
  );
}
