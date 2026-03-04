import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import { apiCropToRecipe } from '../data/cropData';
import { fetchSeeds, addSeeds, setSeeds } from '../api/growRack';
import api from '../api/client';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import { Leaf } from 'lucide-react';

// ── Bag Card ──────────────────────────────────────────────────────────────────

function BagCard({ crop, amount, onAddClick }) {
  const [hover, setHover] = useState(false);
  const seedsPerTray = crop.seedsPerTray || 0;
  const maxStock  = Math.max(amount, seedsPerTray > 0 ? seedsPerTray * 20 : 100);
  const traysLeft = seedsPerTray > 0 ? Math.floor(amount / seedsPerTray) : null;
  const fillPct   = maxStock > 0 ? Math.min((amount / maxStock) * 100, 100) : 0;
  const lowStock  = seedsPerTray > 0 && amount > 0 && amount < seedsPerTray;
  const isEmpty   = amount === 0;

  return (
    <div
      onClick={onAddClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="card"
      style={{
        cursor: 'pointer',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transition: 'all 0.2s ease',
        display: 'flex', flexDirection: 'column',
        padding: 0, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--color-forest-dark)' }}>
            {crop.name}
          </h3>
          {crop.seedsPerTray > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {crop.seedsPerTray}g po plitici
            </p>
          )}
        </div>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: `${crop.color}15`, border: `1px solid ${crop.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Plus size={16} style={{ color: crop.color }} />
        </div>
      </div>

      {/* Large metric */}
      <div style={{ padding: '0 20px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '42px', fontWeight: '700', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', lineHeight: 1 }}>
            {Number(amount).toFixed(1)}
          </span>
          <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-muted)' }}>g</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          na zalihi
        </p>
      </div>

      {/* Fill bar */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ height: '6px', borderRadius: '99px', background: 'var(--color-border)' }}>
          <div style={{ height: '100%', borderRadius: '99px', background: 'var(--color-forest-mid)', width: `${fillPct}%`, transition: 'width 0.4s ease' }} />
        </div>
        {seedsPerTray > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: '10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
            / max ~20 plitica
          </p>
        )}
      </div>

      {/* Trays info */}
      <div style={{ padding: '0 20px' }}>
        {traysLeft !== null ? (
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--color-forest-mid)' }}>
            {traysLeft} mogućih plitica
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Sjeme po plitici nije postavljeno
          </p>
        )}
      </div>

      {/* Separator + seed per tray */}
      {seedsPerTray > 0 && (
        <div style={{ margin: '14px 20px 0', padding: '12px 0 16px', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-sec)' }}>
            Potrebno po plitici: <strong>{seedsPerTray}g</strong>
          </p>
        </div>
      )}

      {/* Low stock warning */}
      {(lowStock || isEmpty) && seedsPerTray > 0 && (
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(201,75,42,0.15)', background: 'rgba(201,75,42,0.06)' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--color-clay)' }}>
            {'\u26A0'} {isEmpty ? 'Nema sjemena na zalihi' : 'Nema dovoljno za jednu pliticu'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Add Seeds Form ────────────────────────────────────────────────────────────

function AddSeedsForm({ crop, currentAmount, onSave, onSet, onClose }) {
  const [grams, setGrams] = useState('');
  const [mode, setMode]   = useState('add');
  const preview = mode === 'add' ? currentAmount + (Number(grams) || 0) : (Number(grams) || 0);

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', marginBottom: '16px', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid var(--color-border)' }}>
        {[{ key: 'add', label: 'Dodaj' }, { key: 'set', label: 'Postavi' }].map(m => (
          <button key={m.key} type="button" onClick={() => setMode(m.key)}
            style={{
              flex: 1, padding: '8px 0', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
              background: mode === m.key ? 'var(--color-forest-mid)' : 'transparent',
              color: mode === m.key ? '#fff' : 'var(--color-text-sec)',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Summary box */}
      <div style={{ padding: '20px', borderRadius: '16px', background: `${crop.color}08`, border: `1px solid ${crop.color}18`, marginBottom: '20px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: 'var(--color-forest-mid)' }}>{crop.name}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
          <span style={{ fontSize: '42px', fontWeight: '700', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', lineHeight: 1 }}>
            {currentAmount}
          </span>
          <span style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>g</span>
        </div>
        {grams && Number(grams) > 0 && (
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: crop.color, fontWeight: '700' }}>
            {mode === 'add' ? `+ ${grams}g = ` : '\u2192 '}<strong>{preview}g</strong>
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="form-label">{mode === 'add' ? 'Grama za dodati *' : 'Postavi na (grama) *'}</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              autoFocus type="number" min={mode === 'add' ? '1' : '0'} step="1"
              value={grams} onChange={e => setGrams(e.target.value)}
              className="input" placeholder="npr. 200"
            />
            <span style={{ color: 'var(--color-text-sec)', fontSize: '13px', flexShrink: 0 }}>g</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[50, 100, 200, 500].map(v => (
              <button key={v} type="button" onClick={() => setGrams(String(v))}
                style={{
                  padding: '4px 12px', borderRadius: '28px', fontSize: '12px', fontWeight: '700',
                  border: `1.5px solid ${crop.color}44`,
                  background: Number(grams) === v ? crop.color : `${crop.color}10`,
                  color: Number(grams) === v ? '#fff' : crop.color,
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}>
                {v}g
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <X size={14} /> Odustani
          </button>
          <button
            onClick={() => {
              const val = Number(grams);
              if (mode === 'add' && val > 0) onSave(val);
              if (mode === 'set' && val >= 0 && grams !== '') onSet(val);
            }}
            disabled={mode === 'add' ? (!grams || Number(grams) <= 0) : grams === ''}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> {mode === 'add' ? 'Dodaj' : 'Postavi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Storage ──────────────────────────────────────────────────────────────

export default function Storage() {
  const [cropTypes, setCropTypes] = useState([]);
  const [amounts,   setAmounts]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | recipe

  useEffect(() => {
    Promise.all([
      api.get('/crops').catch(() => ({ data: [] })),
      fetchSeeds().catch(() => ({})),
    ]).then(([cropsRes, seedData]) => {
      setCropTypes(cropsRes.data);
      setAmounts(seedData);
    }).finally(() => setLoading(false));
  }, []);

  const handleAdd = async (crop, grams) => {
    try {
      await addSeeds(crop.name, grams);
      setAmounts(prev => ({ ...prev, [crop.name]: (prev[crop.name] ?? 0) + grams }));
      setModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSet = async (crop, grams) => {
    try {
      await setSeeds(crop.name, grams);
      setAmounts(prev => ({ ...prev, [crop.name]: grams }));
      setModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingScreen />;

  const recipes = cropTypes.map((c, i) => apiCropToRecipe(c, i));
  const totalGrams = Object.values(amounts).reduce((s, g) => s + (g || 0), 0);

  // Empty state A — no crops
  if (cropTypes.length === 0) {
    return (
      <PageWrapper>
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Skladište Sjemena</h2>
          <div className="page-subtitle">Zalihe sjemena</div>
        </div>
      </div>
        <div className="empty-state flex-1 gsap-reveal">
          <div style={{ width: 64, height: 64, borderRadius: 28, background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Leaf size={28} color="#4A7A5E" />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', margin: '0 0 8px' }}>
            Nema usjeva za praćenje
          </p>
          <p className="empty-state-text">Skladište prati sjeme za svaki usjev u vašoj knjižnici.</p>
          <Link to="/crops" className="btn-primary" style={{ marginTop: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Idi na Knjižnicu usjeva
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Skladište Sjemena</h2>
          <div className="page-subtitle">Ukupno: {Number(totalGrams).toFixed(1)}g na stanju</div>
        </div>
      </div>

      <div className="gsap-reveal" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '20px',
        flex: 1,
        alignContent: 'start',
      }}>
        {recipes.map(recipe => (
          <BagCard
            key={recipe.key}
            crop={recipe}
            amount={amounts[recipe.name] || 0}
            onAddClick={() => setModal(recipe)}
          />
        ))}
      </div>

      {modal && (
        <Modal title={`Dodaj Sjeme — ${modal.name}`} onClose={() => setModal(null)}>
          <AddSeedsForm
            crop={modal}
            currentAmount={amounts[modal.name] || 0}
            onSave={grams => handleAdd(modal, grams)}
            onSet={grams => handleSet(modal, grams)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </PageWrapper>
  );
}
