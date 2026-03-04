import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/client';

export default function Login() {
  const [mode, setMode]   = useState(null); // null = loading | login | register | forgot | reset | setup
  const [form, setForm]   = useState({ email: '', password: '', name: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const { login, user } = useAuth();
  const navigate  = useNavigate();

  // On mount: try auto-login first; fall back to setup or login UI
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
      return;
    }

    api.get('/auth/auto-login')
      .then(({ data }) => {
        login(data.token, data.user);
        navigate('/');
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setMode('setup');
        } else {
          setMode('login');
        }
      });
  }, []);

  const switchMode = m => { setMode(m); setError(''); setSuccessMsg(''); };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (mode === 'setup') {
        const { data } = await api.post('/auth/setup', { name: form.name });
        login(data.token, data.user);
        navigate('/');
      } else if (mode === 'login' || mode === 'register') {
        const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
        const { data } = await api.post(endpoint, form);
        login(data.token, data.user);
        navigate('/');
      } else if (mode === 'forgot') {
        await api.post('/auth/forgot-password', { email: form.email });
        setSuccessMsg('Provjerite email — poslali smo link za reset lozinke.');
      } else if (mode === 'reset') {
        if (form.newPassword !== form.confirmPassword) {
          setError('Lozinke se ne podudaraju.');
          setLoading(false);
          return;
        }
        await api.post('/auth/reset-password', { token: resetToken, newPassword: form.newPassword });
        setSuccessMsg('Lozinka uspješno promijenjena. Možete se prijaviti.');
        setMode('login');
        setResetToken('');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Nešto je pošlo po zlu');
    } finally {
      setLoading(false);
    }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const sharedInput = (type, value, onChange, placeholder) => (
    <input
      type={type}
      required
      value={value}
      onChange={onChange}
      className="input"
      placeholder={placeholder}
    />
  );

  if (user) return <Navigate to="/" replace />;

  // Full-screen loading while auto-login is in progress
  if (mode === null) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A2E22 0%, #2D5040 50%, #1A2E22 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#EAF0EC' }}>
          <div style={{
            width: '48px', height: '48px', border: '3px solid rgba(234,240,236,0.3)',
            borderTopColor: '#EAF0EC', borderRadius: '50%', margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ margin: 0, fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: '20px' }}>
            ZGreens
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1A2E22 0%, #2D5040 50%, #1A2E22 100%)',
      padding: '24px',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'fixed', top: '-100px', right: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74,122,94,0.3) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-80px', left: '-80px',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,145,74,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.15)',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px', lineHeight: 1 }}>🌿</span>
            <h1 style={{
              margin: 0,
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic',
              fontSize: '36px',
              fontWeight: '600',
              color: '#1A2E22',
              letterSpacing: '-0.02em',
            }}>ZGreens</h1>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#A8A89A', fontWeight: '500' }}>
            Upravljanje farmom mikrozelenja
          </p>
        </div>

        {/* Mode toggle — only for login/register */}
        {(mode === 'login' || mode === 'register') && (
          <div style={{
            display: 'flex',
            background: '#F5F3EF',
            borderRadius: '28px',
            padding: '4px',
            marginBottom: '28px',
            gap: '4px',
          }}>
            {[
              { key: 'login',    label: 'Prijava'      },
              { key: 'register', label: 'Registracija' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => switchMode(key)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '28px', fontSize: '13px',
                  fontWeight: '700', border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: mode === key ? '#ffffff' : 'transparent',
                  color: mode === key ? '#1A2E22' : '#A8A89A',
                  boxShadow: mode === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Setup heading */}
        {mode === 'setup' && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: '#1A2E22' }}>
              Dobro došli!
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#A8A89A' }}>
              Kako se zovete? To je sve što trebamo.
            </p>
          </div>
        )}

        {/* Forgot / Reset headings */}
        {(mode === 'forgot' || mode === 'reset') && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: '#1A2E22' }}>
              {mode === 'forgot' ? 'Zaboravili ste lozinku?' : 'Nova lozinka'}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#A8A89A' }}>
              {mode === 'forgot'
                ? 'Unesite email i poslat ćemo vam link za reset.'
                : 'Unesite i potvrdite novu lozinku.'}
            </p>
          </div>
        )}

        {/* Success banner */}
        {successMsg && (
          <div style={{
            padding: '12px 16px', borderRadius: '28px', marginBottom: '16px',
            background: 'rgba(45,80,64,0.08)', border: '1px solid rgba(45,80,64,0.2)',
            fontSize: '13px', color: '#1A5C38', fontWeight: '500',
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Setup: name only */}
          {mode === 'setup' && (
            <div>
              <label className="form-label">Tvoje ime</label>
              {sharedInput('text', form.name, f('name'), 'npr. Ivan')}
            </div>
          )}

          {/* Register: name */}
          {mode === 'register' && (
            <div>
              <label className="form-label">Ime</label>
              {sharedInput('text', form.name, f('name'), 'Vaše ime')}
            </div>
          )}

          {/* Login / Register / Forgot: email */}
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="form-label">Email</label>
              {sharedInput('email', form.email, f('email'), 'vas@email.hr')}
            </div>
          )}

          {/* Login / Register: password */}
          {(mode === 'login' || mode === 'register') && (
            <div>
              <label className="form-label">Lozinka</label>
              {sharedInput('password', form.password, f('password'), '••••••••')}
              {/* Forgot password link — only on login */}
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: '#A8A89A', marginTop: '6px',
                    padding: '0', textDecoration: 'underline',
                  }}
                >
                  Zaboravili ste lozinku?
                </button>
              )}
            </div>
          )}

          {/* Reset: new password + confirm */}
          {mode === 'reset' && (
            <>
              <div>
                <label className="form-label">Nova lozinka</label>
                {sharedInput('password', form.newPassword, f('newPassword'), '••••••••')}
              </div>
              <div>
                <label className="form-label">Potvrdi lozinku</label>
                {sharedInput('password', form.confirmPassword, f('confirmPassword'), '••••••••')}
              </div>
            </>
          )}

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: '28px',
              background: 'rgba(201,75,42,0.08)', border: '1px solid rgba(201,75,42,0.2)',
              fontSize: '13px', color: '#A8351A', fontWeight: '500',
            }} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? '#E5E0D5' : 'linear-gradient(135deg, #1A2E22, #2D5040)',
              color: loading ? '#A8A89A' : '#ffffff',
              borderRadius: '28px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px', fontWeight: '700',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(26,46,34,0.35)',
              transition: 'all 0.2s ease',
              marginTop: '4px',
            }}
          >
            {loading ? 'Učitavanje…'
              : mode === 'setup'    ? 'Počni koristiti'
              : mode === 'login'    ? 'Prijavi se'
              : mode === 'register' ? 'Stvori račun'
              : mode === 'forgot'   ? 'Pošalji link'
              : 'Promijeni lozinku'}
          </button>

          {/* Back to login — for forgot/reset */}
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: '#A8A89A', textDecoration: 'underline',
                marginTop: '4px',
              }}
            >
              Natrag na prijavu
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
