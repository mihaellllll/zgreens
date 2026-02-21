import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { CROP_RECIPES } from '../data/cropData';
import { fetchSeeds, addSeeds } from '../api/growRack';
import { PlusIcon, XIcon, CheckIcon } from '../components/Icons';

// ─── Seed Bag SVG ─────────────────────────────────────────────────────────────
// Fills from bottom up based on fillPct (0 = empty, 1 = full / 1000g)

function SeedBagSVG({ crop, fillPct }) {
  const fp = Math.min(Math.max(fillPct, 0), 1);
  const id = `bag-${crop.key}`;

  // Bag body spans y=48 → y=168 (120px interior)
  const BAG_TOP = 48;
  const BAG_BOT = 168;
  const BAG_H   = BAG_BOT - BAG_TOP;
  const fillH   = fp * BAG_H;
  const waveY   = BAG_BOT - fillH;

  // Bag body path (wider at bottom, like a jute sack)
  const BODY = 'M26,48 L12,156 Q10,168 28,168 L92,168 Q110,168 108,156 L94,48 Q80,40 60,40 Q40,40 26,48 Z';
  // Neck
  const NECK = 'M38,20 L40,40 L80,40 L82,20 Q60,13 38,20 Z';

  return (
    <svg viewBox="0 0 120 185" width="140" height="215" style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={BODY} />
        </clipPath>
        <linearGradient id={`${id}-fabric`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={crop.bgLight} />
          <stop offset="40%"  stopColor="#fff" />
          <stop offset="100%" stopColor={crop.bgLight} />
        </linearGradient>
      </defs>

      {/* ── Bag body ── */}
      <path d={BODY} fill={`url(#${id}-fabric)`} stroke={crop.color} strokeWidth="2" />

      {/* Stitching lines on sides */}
      <path d="M22,60 L10,155" stroke={crop.color} strokeWidth="0.7" strokeDasharray="4 3" opacity="0.35" />
      <path d="M98,60 L110,155" stroke={crop.color} strokeWidth="0.7" strokeDasharray="4 3" opacity="0.35" />

      {/* ── Fill (clipped to bag body) ── */}
      {fp > 0 && (
        <>
          {/* Fill rectangle from waveY downward */}
          <rect
            x="10" y={waveY + 6}
            width="100" height={BAG_BOT - waveY + 10}
            fill={crop.color} opacity="0.28"
            clipPath={`url(#${id}-clip)`}
          />
          {/* Wave at top of fill — liquid effect */}
          <path
            d={`M10,${waveY} Q35,${waveY - 9} 60,${waveY} Q85,${waveY + 9} 110,${waveY} L110,175 L10,175 Z`}
            fill={crop.color} opacity="0.38"
            clipPath={`url(#${id}-clip)`}
          />
          {/* Seed dots in the fill */}
          {fp > 0.15 && Array.from({ length: 6 }, (_, i) => {
            const dotY = waveY + 15 + (i % 2) * 14;
            const dotX = 22 + i * 14;
            if (dotY > BAG_BOT - 10) return null;
            return (
              <circle key={i}
                cx={dotX} cy={dotY} r="3.5"
                fill={crop.color} opacity="0.5"
                clipPath={`url(#${id}-clip)`}
              />
            );
          })}
        </>
      )}

      {/* ── Empty bag interior (when empty) ── */}
      {fp === 0 && (
        <text x="60" y="115" textAnchor="middle" fontSize="11" fill={crop.color} opacity="0.45" fontFamily="system-ui" fontWeight="600">
          prazno
        </text>
      )}

      {/* ── Label band across the middle ── */}
      <rect x="18" y="90" width="84" height="36" rx="5"
        fill={crop.color} opacity={fp > 0.45 ? 0.18 : 0.10}
        stroke={crop.color} strokeWidth="0.8" strokeOpacity="0.4"
      />
      {/* Crop initial letter on label */}
      <text x="60" y="114" textAnchor="middle" fontSize="22" fontWeight="800"
        fill={crop.color} opacity="0.55" fontFamily="system-ui">
        {crop.name[0]}
      </text>

      {/* ── Neck ── */}
      <path d={NECK} fill={`url(#${id}-fabric)`} stroke={crop.color} strokeWidth="1.8" />

      {/* ── Knot / tie ── */}
      <ellipse cx="60" cy="17" rx="20" ry="9" fill={crop.color} opacity="0.75" />
      <ellipse cx="60" cy="14" rx="11" ry="5.5" fill={crop.color} />
      {/* Knot highlight */}
      <ellipse cx="57" cy="12" rx="4" ry="2" fill="#fff" opacity="0.25" />

      {/* ── Bottom seam ── */}
      <path d="M16,158 Q60,164 104,158" stroke={crop.color} strokeWidth="1" strokeDasharray="3 2" opacity="0.30" />
    </svg>
  );
}

// ─── Bag Card ─────────────────────────────────────────────────────────────────

function BagCard({ crop, amount, onAddClick }) {
  const MAX_DISPLAY = 1000; // grams for "full" visual
  const fillPct = amount / MAX_DISPLAY;
  const seedsPerTray = crop.seedsPerTray;
  const traysLeft = Math.floor(amount / seedsPerTray);
  const isLow  = amount > 0 && amount < seedsPerTray * 2;
  const isEmpty = amount === 0;

  return (
    <div style={{
      borderRadius: '20px',
      background: isEmpty ? '#111' : crop.bgLight,
      border: `2px solid ${isEmpty ? '#333' : crop.color + '44'}`,
      boxShadow: isEmpty ? 'none' : `0 6px 24px ${crop.color}18`,
      padding: '20px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer',
    }}
      onClick={onAddClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${crop.color}28`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isEmpty ? 'none' : `0 6px 24px ${crop.color}18`; }}
    >
      {/* Bag visual */}
      <SeedBagSVG crop={crop} fillPct={fillPct} />

      {/* Name */}
      <p style={{ margin: '10px 0 2px', fontWeight: 800, fontSize: '20px', color: isEmpty ? '#6b7280' : '#111827', textAlign: 'center' }}>
        {crop.name}
      </p>

      {/* Amount */}
      <div style={{
        marginTop: '12px', padding: '8px 18px', borderRadius: '99px',
        background: isEmpty ? '#1f1f1f' : `${crop.color}18`,
        border: `1.5px solid ${isEmpty ? '#374151' : crop.color + '44'}`,
      }}>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: isEmpty ? '#4b5563' : crop.color, textAlign: 'center' }}>
          {amount}g
        </p>
      </div>

      {/* Low stock indicator */}
      {isLow && (
        <div style={{ marginTop: '8px', width: '10px', height: '10px', borderRadius: '50%', background: '#d97706' }} title="Malo sjemena" />
      )}

      {/* Add button */}
      <button
        onClick={e => { e.stopPropagation(); onAddClick(); }}
        title="Dodaj sjeme"
        style={{
          marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '44px', height: '44px', borderRadius: '50%',
          background: crop.color, border: 'none', cursor: 'pointer',
        }}
      >
        <PlusIcon size={22} color="#fff" />
      </button>
    </div>
  );
}

// ─── Add Seeds Modal ──────────────────────────────────────────────────────────

function AddSeedsForm({ crop, currentAmount, onSave, onClose }) {
  const [grams, setGrams] = useState('');
  const preview = currentAmount + (Number(grams) || 0);

  return (
    <div>
      {/* Preview bag */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <SeedBagSVG crop={crop} fillPct={preview / 1000} />
          <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 700, color: crop.color }}>
            {preview}g
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Grama za dodati *
          </label>
          <div className="flex gap-2">
            <input
              autoFocus
              type="number"
              min="1"
              step="1"
              value={grams}
              onChange={e => setGrams(e.target.value)}
              className="input"
              placeholder="npr. 200"
            />
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>g</span>
          </div>
          {/* Quick buttons */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[50, 100, 200, 500].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setGrams(String(v))}
                style={{
                  padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: `1.5px solid ${crop.color}44`, background: Number(grams) === v ? crop.color : `${crop.color}12`,
                  color: Number(grams) === v ? '#fff' : crop.color, cursor: 'pointer',
                }}
              >
                {v}g
              </button>
            ))}
          </div>
        </div>

        <div style={{
          background: `${crop.color}0f`, borderRadius: '10px', padding: '10px 14px',
          border: `1px solid ${crop.color}22`,
        }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
            Trenutno: <strong>{currentAmount}g</strong>
            {grams && Number(grams) > 0 && (
              <> → Nakon dodavanja: <strong style={{ color: crop.color }}>{preview}g</strong></>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <button onClick={onClose} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <XIcon size={16} /> Odustani
        </button>
        <button onClick={() => { if (Number(grams) > 0) onSave(Number(grams)); }}
          disabled={!grams || Number(grams) <= 0}
          className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <PlusIcon size={16} color="#fff" /> Dodaj
        </button>
      </div>
    </div>
  );
}

// ─── Main Storage page ────────────────────────────────────────────────────────

export default function Storage() {
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // crop object | null

  useEffect(() => {
    fetchSeeds()
      .then(data => setAmounts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (crop, grams) => {
    await addSeeds(crop.key, grams);
    setAmounts(prev => ({ ...prev, [crop.key]: (prev[crop.key] ?? 0) + grams }));
    setModal(null);
  };

  const totalGrams = CROP_RECIPES.reduce((s, c) => s + (amounts[c.key] || 0), 0);

  const count = CROP_RECIPES.length;
  const minCol = count <= 3 ? 320 : count <= 5 ? 260 : 220;

  if (loading) return (
    <div className="p-10">
      <div className="page-header">
        <h2 className="page-title">Skladište Sjemena</h2>
      </div>
      <p className="text-gray-400 text-base">Učitavanje...</p>
    </div>
  );

  return (
    <div className="p-10 h-full flex flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-shrink-0">
        <h2 className="page-title">Skladište Sjemena</h2>
      </div>

      {/* Bag grid — fills available space */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        gap: '28px',
        flex: 1,
        alignContent: 'start',
      }}>
        {CROP_RECIPES.map(crop => (
          <BagCard
            key={crop.key}
            crop={crop}
            amount={amounts[crop.key] || 0}
            onAddClick={() => setModal(crop)}
          />
        ))}
      </div>

      {/* Add seeds modal */}
      {modal && (
        <Modal title={`Dodaj Sjeme — ${modal.name}`} onClose={() => setModal(null)}>
          <AddSeedsForm
            crop={modal}
            currentAmount={amounts[modal.key] || 0}
            onSave={grams => handleAdd(modal, grams)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
