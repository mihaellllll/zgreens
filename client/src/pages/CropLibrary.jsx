import { useEffect, useState, useRef } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import { apiCropToRecipe, buildPhases } from '../data/cropData';
import { PlusIcon, TrashIcon, XIcon, CheckIcon } from '../components/Icons';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import { Leaf, X, Lock } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

const PHASE_COLORS = {
  seed:     { bg: '#78350f', color: '#fff', border: '#92400e' },
  sprout:   { bg: '#65a30d', color: '#fff', border: '#4d7c0f' },
  blackout: { bg: '#111827', color: '#fff', border: '#374151' },
  light:    { bg: '#eab308', color: '#422006', border: '#ca8a04' },
  growing:  { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  ready:    { bg: '#16a34a', color: '#fff', border: '#15803d' },
};

// Fixed canonical order — user picks which phases to include, cannot reorder
const CANONICAL_PHASES = [
  { stage: 'seed',     label: 'Sjetva',     mandatory: true  },
  { stage: 'sprout',   label: 'Klijanje',   mandatory: false },
  { stage: 'blackout', label: 'Tamna faza', mandatory: false },
  { stage: 'light',    label: 'Svijetlo',   mandatory: false },
  { stage: 'growing',  label: 'Rast',       mandatory: false },
  { stage: 'ready',    label: 'Berba',      mandatory: true  },
];

// ─── Crop Card ────────────────────────────────────────────────────────────────

function CropCard({ recipe, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const monogram = recipe.name.slice(0, 2).toUpperCase();

  const stats = [
    { l: 'Sjeme/plitici',  v: recipe.seedsPerTray  > 0 ? `${recipe.seedsPerTray}g`                  : '—' },
    { l: 'Prinos/plitici', v: recipe.harvestWeight > 0 ? `~${recipe.harvestWeight}g`                 : '—' },
    { l: 'Cijena sjemena', v: recipe.seedCostG     > 0 ? `€${Number(recipe.seedCostG).toFixed(2)}/g` : '—' },
    { l: 'Dan berbe',      v: `Dan ${recipe.harvestDay}` },
  ];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="card"
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 0, overflow: 'hidden',
        boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transition: 'all 0.2s ease',
        height: '100%',
      }}
    >
      <div style={{ padding: '24px 24px 16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: `${recipe.color}18`, border: `1px solid ${recipe.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: '20px', fontWeight: '700', color: recipe.color }}>{monogram}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: '22px', fontWeight: '700',
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            color: 'var(--color-forest-dark)', letterSpacing: '-0.01em',
          }}>{recipe.name}</h3>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <span style={{
          display: 'inline-block', padding: '4px 10px', borderRadius: '99px',
          background: 'rgba(196, 145, 74, 0.15)', color: 'var(--color-gold)',
          fontSize: '11px', fontWeight: '700',
        }}>
          {recipe.harvestDay} dana rasta
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
        padding: '14px 24px', gap: '12px',
      }}>
        {stats.map(({ l, v }) => (
          <div key={l}>
            <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-text)' }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 24px', flex: 1 }}>
        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Faze rasta
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {recipe.phases.map((phase, i) => {
            const pc = PHASE_COLORS[phase.stage] || PHASE_COLORS.growing;
            const isLast = i === recipe.phases.length - 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: pc.bg, border: `1px solid ${pc.border}` }} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-sec)', marginTop: '4px', whiteSpace: 'nowrap' }}>{phase.label}</span>
                  <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Dan {phase.day}</span>
                </div>
                {!isLast && <div style={{ flex: 1, height: '1px', background: 'var(--color-border)', marginTop: '-20px', minWidth: '8px' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {recipe.notes ? (
        <div style={{ padding: '0 24px 16px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bilješke</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-sec)', fontStyle: 'italic', lineHeight: 1.5 }}>{recipe.notes}</p>
        </div>
      ) : null}

      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '8px' }}>
        <button onClick={() => onEdit(recipe._apiCrop)} className="btn-secondary" style={{ flex: 1, fontSize: '12px', padding: '8px 12px' }}>
          Uredi
        </button>
        <button onClick={() => onDelete(recipe._apiCrop.id)} className="btn-danger" style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Phase Panel ─────────────────────────────────────────────────────────────

function PhasePanel({ phaseState, setPhaseState, onClose }) {
  const toggle = stage => {
    setPhaseState(prev => ({
      ...prev,
      [stage]: prev[stage] === null ? '' : null,
    }));
  };

  const setDay = (stage, val) => {
    setPhaseState(prev => ({ ...prev, [stage]: val }));
  };

  const enabledPhases = CANONICAL_PHASES.filter(cp => phaseState[cp.stage] !== null);

  return (
    <div style={{ padding: '0 0 0 24px', minWidth: 0, width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
          Faze rasta
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '28px', height: '28px', borderRadius: '99px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#A8A89A', transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F0EDE8'; e.currentTarget.style.color = '#1A1A16'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A8A89A'; }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Mini timeline preview — enabled phases only */}
      {enabledPhases.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', padding: '10px 14px', borderRadius: '16px', background: 'var(--color-bg)' }}>
          {enabledPhases.map((cp, i) => {
            const pc = PHASE_COLORS[cp.stage] || PHASE_COLORS.growing;
            const isLast = i === enabledPhases.length - 1;
            const day = phaseState[cp.stage];
            return (
              <div key={cp.stage} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: pc.bg, border: `1.5px solid ${pc.border}` }} />
                  <span style={{ fontSize: '8px', color: 'var(--color-text-sec)', marginTop: '3px', whiteSpace: 'nowrap' }}>{cp.label}</span>
                  {day ? <span style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>d{day}</span> : null}
                </div>
                {!isLast && <div style={{ flex: 1, height: '1px', borderTop: '1.5px dashed var(--color-border)', marginTop: '-16px', minWidth: '6px' }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Phase rows — fixed canonical order */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {CANONICAL_PHASES.map(cp => {
          const enabled = phaseState[cp.stage] !== null;
          const pc = PHASE_COLORS[cp.stage] || PHASE_COLORS.growing;

          return (
            <div
              key={cp.stage}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '14px',
                background: enabled ? 'var(--color-bg)' : 'transparent',
                border: `1.5px solid ${enabled ? 'var(--color-border)' : 'transparent'}`,
                transition: 'all 0.2s ease',
                opacity: enabled ? 1 : 0.5,
              }}
            >
              {/* Lock icon for mandatory, toggle button for optional */}
              {cp.mandatory ? (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '99px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(45,80,64,0.1)',
                }}>
                  <Lock size={11} color="var(--color-forest-mid)" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(cp.stage)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '99px', flexShrink: 0,
                    background: enabled ? 'var(--color-forest-mid)' : 'var(--color-border)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {enabled
                    ? <CheckIcon size={12} color="#fff" />
                    : <PlusIcon size={12} color="#888" />
                  }
                </button>
              )}

              {/* Color dot */}
              <div style={{
                width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
                background: pc.bg, border: `1.5px solid ${pc.border}`,
              }} />

              {/* Label */}
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)', fontWeight: enabled ? '600' : '400' }}>
                {cp.label}
              </span>

              {/* Day input */}
              <input
                type="number"
                min="1"
                value={enabled ? (phaseState[cp.stage] ?? '') : ''}
                disabled={!enabled}
                onChange={e => setDay(cp.stage, e.target.value)}
                placeholder="dan"
                style={{
                  width: '52px', fontSize: '12px', padding: '6px 8px', flexShrink: 0,
                  border: `1.5px solid ${enabled ? 'var(--color-border)' : 'transparent'}`,
                  borderRadius: '10px',
                  background: enabled ? 'var(--color-surface)' : 'transparent',
                  color: enabled ? 'var(--color-text)' : 'transparent',
                  outline: 'none', textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              />
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: '14px', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
        Redoslijed je uvijek: Sjetva → Klijanje → Tamna faza → Svijetlo → Rast → Berba
      </p>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function initPhaseState(initial) {
  const defaults = { seed: '1', sprout: null, blackout: null, light: null, growing: null, ready: '7' };

  if (initial?.customPhases) {
    try {
      const parsed = JSON.parse(initial.customPhases);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = {};
        parsed.forEach(p => { map[p.stage] = String(p.day); });
        const result = {};
        CANONICAL_PHASES.forEach(cp => {
          if (map[cp.stage] !== undefined) {
            result[cp.stage] = map[cp.stage];
          } else if (cp.mandatory) {
            result[cp.stage] = cp.stage === 'seed' ? '1' : String(initial.growDays || 7);
          } else {
            result[cp.stage] = null;
          }
        });
        return result;
      }
    } catch {}
  }

  if (initial?.growDays) {
    const phases = buildPhases(initial.growDays);
    const map = {};
    phases.forEach(p => { map[p.stage] = String(p.day); });
    const result = {};
    CANONICAL_PHASES.forEach(cp => {
      result[cp.stage] = map[cp.stage] !== undefined
        ? map[cp.stage]
        : cp.mandatory
          ? (cp.stage === 'seed' ? '1' : String(initial.growDays))
          : null;
    });
    return result;
  }

  return { ...defaults };
}

// ─── Crop Form ────────────────────────────────────────────────────────────────

function CropForm({ initial, onSave, onClose, phasePanelOpen, setPhasePanelOpen }) {
  const [form, setForm] = useState({
    name:          initial?.name          || '',
    seedCostG:     initial?.seedCostG     || 0,
    seedsPerTray:  initial?.seedsPerTray  || 0,
    harvestWeight: initial?.harvestWeight || 0,
    notes:         initial?.notes         || '',
  });
  const [phaseState, setPhaseState] = useState(() => initPhaseState(initial));
  const [phaseError, setPhaseError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [loading,    setLoading]    = useState(false);
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 640);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const phasePanelRef = useRef(null);

  // GSAP: animate phase panel — width on desktop, height on mobile
  useGSAP(() => {
    if (!phasePanelRef.current) return;
    if (phasePanelOpen) {
      if (isMobile) {
        gsap.to(phasePanelRef.current, { height: 'auto', opacity: 1, width: '100%', duration: 0.35, ease: 'power3.out' });
      } else {
        gsap.to(phasePanelRef.current, { width: 290, height: 'auto', opacity: 1, duration: 0.42, ease: 'power3.out' });
      }
    } else {
      if (isMobile) {
        gsap.to(phasePanelRef.current, { height: 0, opacity: 0, duration: 0.28, ease: 'power3.in' });
      } else {
        gsap.to(phasePanelRef.current, { width: 0, opacity: 0, duration: 0.28, ease: 'power3.in' });
      }
    }
  }, { dependencies: [phasePanelOpen, isMobile] });

  const f = k => e => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    if (formErrors[k]) setFormErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const submit = async e => {
    e.preventDefault();

    // ── Field validation ──
    const errs = {};
    if (!form.name.trim()) errs.name = 'Naziv usjeva je obavezan.';
    if (!(Number(form.seedCostG) > 0))     errs.seedCostG     = 'Cijena sjemena mora biti veća od 0.';
    if (!(Number(form.seedsPerTray) > 0))  errs.seedsPerTray  = 'Sjeme po plitici mora biti veće od 0.';
    if (!(Number(form.harvestWeight) > 0)) errs.harvestWeight = 'Prinos po plitici mora biti veći od 0.';

    // ── Phase validation ──
    // Convert phaseState → sorted array of enabled phases with valid days
    const enabledPhases = CANONICAL_PHASES
      .filter(cp => phaseState[cp.stage] !== null && Number(phaseState[cp.stage]) > 0)
      .map(cp => ({ stage: cp.stage, label: cp.label, day: Number(phaseState[cp.stage]) }));

    const hasSeed  = enabledPhases.some(p => p.stage === 'seed');
    const hasReady = enabledPhases.some(p => p.stage === 'ready');

    if (!hasSeed || !hasReady) {
      setPhaseError('Faze rasta moraju sadržavati barem Sjetvu i Berbu s upisanim danom.');
      setPhasePanelOpen(true);
      errs.phases = true;
    } else {
      setPhaseError('');
    }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const growDays = enabledPhases.find(p => p.stage === 'ready')?.day || 7;

    setLoading(true);
    try {
      const payload = {
        name:          form.name,
        growDays,
        customPhases:  JSON.stringify(enabledPhases),
        seedCostG:     Number(form.seedCostG),
        seedsPerTray:  Number(form.seedsPerTray),
        harvestWeight: Number(form.harvestWeight),
        notes:         form.notes,
      };
      const res = initial?.id
        ? await api.patch(`/crops/${initial.id}`, payload)
        : await api.post('/crops', payload);
      onSave(res.data);
    } finally {
      setLoading(false);
    }
  };

  // Enabled stages for dots in trigger button
  const enabledCount = CANONICAL_PHASES.filter(cp => phaseState[cp.stage] !== null).length;

  return (
    <form onSubmit={submit}>
      {/* Flex wrapper: main form + slide-in phase panel */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 0, alignItems: 'flex-start' }}>

        {/* ── Left: main fields ── */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          {/* Name */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Naziv usjeva *</label>
            <input required value={form.name} onChange={f('name')} className="input" placeholder="npr. Suncokret"
              style={formErrors.name ? { borderColor: '#dc2626' } : {}} />
            {formErrors.name && <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{formErrors.name}</p>}
          </div>

          {/* Cost + seeds grid */}
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            <div>
              <label className="form-label">Cijena sjemena / g (€) *</label>
              <input type="number" min="0" step="0.01" value={form.seedCostG} onChange={f('seedCostG')} className="input"
                style={formErrors.seedCostG ? { borderColor: '#dc2626' } : {}} />
              {formErrors.seedCostG && <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{formErrors.seedCostG}</p>}
            </div>
            <div>
              <label className="form-label">Sjeme po plitici (g) *</label>
              <input type="number" min="0" step="0.1" value={form.seedsPerTray} onChange={f('seedsPerTray')} className="input" placeholder="npr. 20"
                style={formErrors.seedsPerTray ? { borderColor: '#dc2626' } : {}} />
              {formErrors.seedsPerTray && <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{formErrors.seedsPerTray}</p>}
            </div>
          </div>

          {/* Harvest weight */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Prinos po plitici (g) *</label>
            <input type="number" min="0" step="1" value={form.harvestWeight} onChange={f('harvestWeight')} className="input" placeholder="npr. 100"
              style={formErrors.harvestWeight ? { borderColor: '#dc2626' } : {}} />
            {formErrors.harvestWeight && <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{formErrors.harvestWeight}</p>}
          </div>

          {/* ── Faze rasta trigger button ── */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">
              Faze rasta *{' '}
              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '10px' }}>
                (obavezno: Sjetva + Berba)
              </span>
            </label>
            <div
              onClick={() => setPhasePanelOpen(p => !p)}
              style={{
                width: '100%', padding: '12px 18px',
                background: phasePanelOpen ? 'rgba(196,145,74,0.05)' : 'var(--color-surface)',
                border: `1.5px solid ${phasePanelOpen ? 'var(--color-gold)' : (formErrors.phases ? '#dc2626' : 'var(--color-border)')}`,
                borderRadius: 'var(--radius-btn)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Phase colour dots — all 6 in canonical order */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {CANONICAL_PHASES.map(cp => {
                    const pc = PHASE_COLORS[cp.stage];
                    const on = phaseState[cp.stage] !== null;
                    return (
                      <div key={cp.stage} style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: on ? pc.bg : 'var(--color-border)',
                        border: `1px solid ${on ? pc.border : 'transparent'}`,
                        transition: 'all 0.2s ease',
                      }} />
                    );
                  })}
                </div>
                <span style={{ fontSize: '14px', color: 'var(--color-text)', fontFamily: 'inherit' }}>
                  Faze rasta
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {enabledCount} {enabledCount === 1 ? 'faza' : enabledCount < 5 ? 'faze' : 'faza'}
                </span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-gold)', transition: 'transform 0.2s ease' }}>
                {isMobile
                  ? (phasePanelOpen ? '↑' : '↓')
                  : (phasePanelOpen ? '←' : '→')}
              </span>
            </div>
            {phaseError && (
              <p style={{ margin: '6px 0 0 4px', fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                {phaseError}
              </p>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '4px' }}>
            <label className="form-label">Bilješke</label>
            <textarea value={form.notes} onChange={f('notes')} className="input h-20 resize-none" placeholder="Savjeti za uzgoj..." />
          </div>
        </div>

        {/* ── Right (desktop) / Bottom (mobile): Phase panel (GSAP animated) ── */}
        <div
          ref={phasePanelRef}
          style={{
            width: isMobile ? '100%' : 0,
            height: isMobile ? 0 : 'auto',
            opacity: 0,
            overflow: 'hidden',
            flexShrink: 0,
            borderLeft: isMobile ? 'none' : '1px solid var(--color-border)',
            borderTop: isMobile ? '1px solid var(--color-border)' : 'none',
            maxWidth: '100%',
          }}
        >
          <PhasePanel
            phaseState={phaseState}
            setPhaseState={setPhaseState}
            onClose={() => setPhasePanelOpen(false)}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end" style={{ marginTop: '20px' }}>
        <button type="button" onClick={onClose} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <XIcon size={16} /> Odustani
        </button>
        <button type="submit" disabled={loading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckIcon size={16} color="#fff" /> {loading ? '...' : 'Spremi'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CropLibrary() {
  const [crops,          setCrops]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [modal,          setModal]          = useState(null); // null | 'add' | cropObj
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const [phasePanelOpen, setPhasePanelOpen] = useState(false);

  useEffect(() => {
    api.get('/crops')
      .then(r => setCrops(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openModal = crop => { setPhasePanelOpen(false); setModal(crop); };
  const closeModal = () => { setModal(null); setPhasePanelOpen(false); };

  const handleSave = crop => {
    setCrops(prev => {
      const idx = prev.findIndex(c => c.id === crop.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = crop; return next; }
      return [...prev, crop].sort((a, b) => a.name.localeCompare(b.name));
    });
    closeModal();
  };

  const handleDelete = async id => {
    try { await api.delete(`/crops/${id}`); setCrops(prev => prev.filter(c => c.id !== id)); } catch {}
    setConfirmDelete(null);
  };

  if (loading) return <LoadingScreen />;

  const recipes = crops.map((c, i) => apiCropToRecipe(c, i));
  const modalMaxWidth = phasePanelOpen ? 'min(840px, 96vw)' : 'min(520px, 96vw)';

  return (
    <PageWrapper>
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Knjižnica Usjeva</h2>
          <div className="page-subtitle">Recepti i faze</div>
        </div>
        <div className="page-header-right">
          <button onClick={() => openModal('add')} className="btn-primary" style={{ gap: '7px', fontSize: '13px', padding: '9px 16px' }}>
            <PlusIcon size={16} color="#fff" /> Usjev
          </button>
        </div>
      </div>

      {crops.length === 0 ? (
        <div className="empty-state flex-1 gsap-reveal">
          <div style={{ width: 64, height: 64, borderRadius: 28, background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Leaf size={28} color="#4A7A5E" />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', margin: '0 0 8px' }}>
            Vaša farma čeka prvi usjev
          </p>
          <p className="empty-state-text">Dodajte biljke koje uzgajate — svaka sa brojem dana rasta i gramima sjemena.</p>
          <button onClick={() => openModal('add')} className="btn-primary" style={{ marginTop: 8 }}>
            + Stvori prvi usjev
          </button>
        </div>
      ) : (
        <div className="gsap-reveal" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px', flex: 1, alignContent: 'start',
        }}>
          {recipes.map(recipe => (
            <CropCard
              key={recipe.key}
              recipe={recipe}
              onEdit={apiCrop => openModal(apiCrop)}
              onDelete={id => setConfirmDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <Modal title="Obriši Usjev" onClose={() => setConfirmDelete(null)}>
          <p style={{ fontSize: '15px', color: 'var(--color-text-sec)', marginBottom: '24px' }}>
            Jeste li sigurni da želite obrisati ovaj usjev?
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Ne</button>
            <button onClick={() => handleDelete(confirmDelete)} className="btn-danger">Da, obriši</button>
          </div>
        </Modal>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Dodaj usjev' : 'Uredi usjev'}
          onClose={closeModal}
          maxWidth={modalMaxWidth}
        >
          <CropForm
            initial={modal === 'add' ? null : modal}
            onSave={handleSave}
            onClose={closeModal}
            phasePanelOpen={phasePanelOpen}
            setPhasePanelOpen={setPhasePanelOpen}
          />
        </Modal>
      )}
    </PageWrapper>
  );
}
