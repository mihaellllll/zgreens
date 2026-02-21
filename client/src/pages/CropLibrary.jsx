import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import { CROP_RECIPES } from '../data/cropData';
import { PencilIcon, TrashIcon, PlusIcon, XIcon, CheckIcon } from '../components/Icons';

// Default visual props for custom (API) crops that don't have a hardcoded recipe
const CUSTOM_COLORS = [
  { color: '#0891b2', bgLight: '#ecfeff', stemColor: '#67e8f9', leafColor: '#06b6d4', leafShape: 'oval' },
  { color: '#7c3aed', bgLight: '#f5f3ff', stemColor: '#c4b5fd', leafColor: '#8b5cf6', leafShape: 'oval' },
  { color: '#db2777', bgLight: '#fdf2f8', stemColor: '#f9a8d4', leafColor: '#ec4899', leafShape: 'round' },
  { color: '#ea580c', bgLight: '#fff7ed', stemColor: '#fdba74', leafColor: '#f97316', leafShape: 'thin' },
  { color: '#059669', bgLight: '#ecfdf5', stemColor: '#6ee7b7', leafColor: '#10b981', leafShape: 'oval' },
  { color: '#d97706', bgLight: '#fffbeb', stemColor: '#fcd34d', leafColor: '#f59e0b', leafShape: 'thin' },
];

function apiCropToRecipe(crop, idx) {
  const vis = CUSTOM_COLORS[idx % CUSTOM_COLORS.length];
  return {
    key: `api-${crop.id}`,
    name: crop.name,
    nameEn: crop.difficulty ? `${crop.difficulty} difficulty` : 'Custom',
    ...vis,
    seedsPerTray: 0,
    harvestWeight: 0,
    germinationDays: Math.round(crop.growDays * 0.3) || 3,
    blackoutDays: Math.round(crop.growDays * 0.2) || 0,
    lightDays: Math.round(crop.growDays * 0.5) || 5,
    harvestDay: crop.growDays,
    notes: crop.notes || '',
    seedCostG: crop.seedCostG,
    phases: buildPhases(crop.growDays),
    _apiCrop: crop,
  };
}

function buildPhases(growDays) {
  const phases = [{ day: 1, label: 'Sjetva', stage: 'seed' }];
  const blackout = Math.round(growDays * 0.3);
  const light = Math.round(growDays * 0.5);
  if (blackout > 1) phases.push({ day: blackout, label: 'Blackout', stage: 'blackout' });
  if (light > blackout) phases.push({ day: light, label: 'Svijetlo', stage: 'light' });
  const mid = Math.round((light + growDays) / 2);
  if (mid > light && mid < growDays) phases.push({ day: mid, label: 'Rast', stage: 'growing' });
  phases.push({ day: growDays, label: 'Berba', stage: 'ready' });
  return phases;
}

// Plant illustration SVG
function CropPlantSVG({ crop, width = 220, height = 150 }) {
  const W = width, H = height;
  const SOIL_Y = H * 0.70;
  const stemCount = 16;
  const stems = Array.from({ length: stemCount }, (_, i) => {
    const x = (W / (stemCount + 1)) * (i + 1);
    const wave = Math.sin(i * 1.5 + 0.4) * 7;
    const hVar = 0.80 + Math.abs(Math.sin(i * 2.1 + 0.7)) * 0.20;
    return { x, topX: x + wave, topY: SOIL_Y * (1 - hVar * 0.60) };
  });
  const lrx = crop.leafShape === 'thin' ? 2.5 : crop.leafShape === 'round' ? 8 : 6;
  const lry = crop.leafShape === 'thin' ? 9  : crop.leafShape === 'round' ? 6 : 4;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <rect x="0" y={SOIL_Y} width={W} height={H - SOIL_Y} fill="#1a0902" />
      <rect x="0" y={SOIL_Y} width={W} height="7" fill="#2d1205" />
      {stems.map((s, i) => (
        <g key={i}>
          <line x1={s.x} y1={SOIL_Y} x2={s.topX} y2={s.topY}
            stroke={crop.stemColor} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx={s.topX} cy={s.topY} rx={lrx} ry={lry}
            fill={crop.leafColor} opacity="0.92"
            transform={`rotate(${Math.sin(i * 1.5) * 30},${s.topX},${s.topY})`} />
          {i % 2 === 0 && (
            <ellipse cx={s.topX + lrx * 0.8} cy={s.topY + lry * 0.6}
              rx={lrx * 0.65} ry={lry * 0.65} fill={crop.leafColor} opacity="0.65"
              transform={`rotate(${25 + Math.sin(i) * 15},${s.topX + lrx * 0.8},${s.topY + lry * 0.6})`} />
          )}
        </g>
      ))}
    </svg>
  );
}

// Stage → color mapping for phase timeline
const PHASE_COLORS = {
  seed:     { bg: '#78350f', color: '#fff', border: '#92400e' },     // brown
  sprout:   { bg: '#78350f', color: '#fff', border: '#92400e' },     // brown
  blackout: { bg: '#111827', color: '#fff', border: '#374151' },     // black
  light:    { bg: '#eab308', color: '#422006', border: '#ca8a04' },  // yellow
  growing:  { bg: '#dcfce7', color: '#15803d', border: '#86efac' },  // light green
  ready:    { bg: '#16a34a', color: '#fff', border: '#15803d' },     // green
};

// 3D tilt card — used for ALL crops (recipes + custom)
function CropCard({ recipe, onEdit, onDelete }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });
  const isCustom = !!recipe._apiCrop;

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width  - 0.5;
    const ny = (e.clientY - r.top)  / r.height - 0.5;
    setTilt({ x: ny * -12, y: nx * 12, active: true });
  };
  const onLeave = () => setTilt({ x: 0, y: 0, active: false });

  const stats = isCustom ? [
    { l: 'Dani rasta', v: `${recipe.harvestDay}d` },
    { l: 'Težina', v: recipe._apiCrop.difficulty || '—' },
    { l: 'Cijena sjemena', v: recipe.seedCostG > 0 ? `$${Number(recipe.seedCostG).toFixed(2)}` : '—' },
    { l: 'Klijanje', v: `${recipe.germinationDays}d` },
  ] : [
    { l: 'Sjeme', v: `${recipe.seedsPerTray}g` },
    { l: 'Berba', v: `Dan ${recipe.harvestDay}${recipe.harvestDayMax ? `–${recipe.harvestDayMax}` : ''}` },
    { l: 'Klijanje', v: `${recipe.germinationDays}d` },
    { l: 'Blackout', v: recipe.blackoutDays ? `${recipe.blackoutDays}d` : '—' },
  ];

  return (
    <div style={{ perspective: '900px', height: '100%' }}>
      <div
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          height: '100%',
          display: 'flex', flexDirection: 'column',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.active ? 1.03 : 1})`,
          transition: tilt.active ? 'transform 0.08s linear' : 'transform 0.55s cubic-bezier(.23,1,.32,1)',
          transformStyle: 'preserve-3d',
          borderRadius: '18px',
          overflow: 'hidden',
          background: recipe.bgLight,
          border: `1.5px solid ${recipe.color}44`,
          boxShadow: `0 8px 32px ${recipe.color}22, 0 2px 8px rgba(0,0,0,0.10)`,
          cursor: 'default',
        }}
      >
        {/* Header: gradient + plant */}
        <div style={{
          height: '180px', minHeight: '180px',
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(145deg, ${recipe.color}28, ${recipe.color}60)`,
        }}>
          <div style={{
            position: 'absolute', top: '-30px', right: '-30px',
            width: '120px', height: '120px', borderRadius: '50%',
            background: recipe.color, opacity: 0.12,
          }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <CropPlantSVG crop={recipe} width={280} height={160} />
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
            padding: '16px 20px',
          }}>
            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '22px', lineHeight: 1.2, margin: 0 }}>
              {recipe.name}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: '4px 0 0' }}>
              {recipe.nameEn}
            </p>
          </div>
        </div>

        {/* Body: stats + timeline + actions */}
        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            {stats.map(({ l, v }) => (
              <div key={l} style={{
                background: `${recipe.color}0f`, borderRadius: '10px',
                padding: '12px 14px', border: `1px solid ${recipe.color}20`,
              }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{l}</p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{v}</p>
              </div>
            ))}
          </div>

          {recipe.notes && (
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '14px', fontStyle: 'italic' }}>
              {recipe.notes}
            </p>
          )}

          {/* Growth timeline with distinct stage colors */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {recipe.phases.map((phase, i) => {
                const pc = PHASE_COLORS[phase.stage] || PHASE_COLORS.growing;
                return (
                  <div key={i} style={{ textAlign: 'center', minWidth: '42px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700,
                      background: pc.bg, color: pc.color,
                      border: `2px solid ${pc.border}`,
                    }}>
                      {phase.day}
                    </div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px', lineHeight: 1.2, fontWeight: 600 }}>
                      {phase.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit / Delete */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px', paddingTop: '14px', borderTop: `1px solid ${recipe.color}22` }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit?.(isCustom ? recipe._apiCrop : recipe); }}
              title="Uredi"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', background: `${recipe.color}12`, border: `1px solid ${recipe.color}30`, cursor: 'pointer' }}>
              <PencilIcon size={16} color={recipe.color} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete?.(isCustom ? recipe._apiCrop.id : recipe.key); }}
              title="Obriši"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a530', cursor: 'pointer' }}>
              <TrashIcon size={16} color="#ef4444" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Adaptive grid: computes column min-width based on item count + container width
function useAdaptiveGrid(itemCount, containerRef) {
  const [minCol, setMinCol] = useState(280);
  const compute = useCallback(() => {
    if (!containerRef.current || itemCount === 0) return;
    const w = containerRef.current.offsetWidth;
    if (itemCount <= 2) { setMinCol(Math.min(w / 2 - 20, 420)); return; }
    if (itemCount <= 4) { setMinCol(Math.min(w / 2 - 20, 380)); return; }
    if (itemCount <= 6) { setMinCol(Math.min(w / 3 - 20, 320)); return; }
    if (itemCount <= 9) { setMinCol(Math.min(w / 3 - 20, 280)); return; }
    setMinCol(Math.min(w / 4 - 20, 260));
  }, [itemCount, containerRef]);

  useEffect(() => {
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [compute]);

  return minCol;
}

// Add/Edit form
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function CropForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || { name: '', growDays: 10, difficulty: 'easy', seedCostG: 0, notes: '' }
  );
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = initial?.id
        ? await api.patch(`/crops/${initial.id}`, form)
        : await api.post('/crops', form);
      onSave(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-base font-medium text-gray-700 mb-1.5">Naziv usjeva *</label>
        <input required value={form.name} onChange={f('name')} className="input" placeholder="npr. Suncokret" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-base font-medium text-gray-700 mb-1.5">Dani rasta *</label>
          <input required type="number" min="1" value={form.growDays} onChange={f('growDays')} className="input" />
        </div>
        <div>
          <label className="block text-base font-medium text-gray-700 mb-1.5">Cijena sjemena / plitici ($)</label>
          <input type="number" min="0" step="0.01" value={form.seedCostG} onChange={f('seedCostG')} className="input" />
        </div>
      </div>
      <div>
        <label className="block text-base font-medium text-gray-700 mb-1.5">Težina</label>
        <select value={form.difficulty} onChange={f('difficulty')} className="input">
          {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-base font-medium text-gray-700 mb-1.5">Bilješke</label>
        <textarea value={form.notes} onChange={f('notes')} className="input h-20 resize-none" placeholder="Savjeti za uzgoj…" />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <XIcon size={16} /> Odustani
        </button>
        <button type="submit" disabled={loading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckIcon size={16} color="#fff" /> {loading ? '…' : 'Spremi'}
        </button>
      </div>
    </form>
  );
}

const HIDDEN_KEY = 'zgreens_hidden_recipes';
function getHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY)) || []; }
  catch { return []; }
}
function setHidden(arr) { localStorage.setItem(HIDDEN_KEY, JSON.stringify(arr)); }

// Main page
export default function CropLibrary() {
  const [apiCrops, setApiCrops]             = useState([]);
  const [modal, setModal]                   = useState(null);      // 'add' | crop object | null
  const [confirmDelete, setConfirmDelete]   = useState(null);      // key or id to confirm
  const [hiddenKeys, setHiddenKeys]         = useState(() => getHidden());
  const gridRef = useRef(null);

  useEffect(() => {
    api.get('/crops').then(r => setApiCrops(r.data)).catch(() => {});
  }, []);

  const handleSave = crop => {
    setApiCrops(prev => {
      const idx = prev.findIndex(c => c.id === crop.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = crop; return next; }
      return [...prev, crop].sort((a, b) => a.name.localeCompare(b.name));
    });
    setModal(null);
  };

  const handleDelete = async id => {
    try {
      const isApiCrop = apiCrops.some(c => c.id === id);
      if (isApiCrop) {
        await api.delete(`/crops/${id}`);
        setApiCrops(prev => prev.filter(c => c.id !== id));
      } else {
        setHiddenKeys(prev => {
          const next = [...prev, id];
          setHidden(next);
          return next;
        });
      }
    } catch {
      // FK constraint or network error — still close modal
    }
    setConfirmDelete(null);
  };

  const handleEdit = recipe => {
    if (recipe._apiCrop) {
      setModal(recipe._apiCrop);
    } else {
      setModal({ name: recipe.name, growDays: recipe.harvestDay, difficulty: 'easy', seedCostG: recipe.seedCostG || 0, notes: recipe.notes || '' });
    }
  };

  const customCrops = apiCrops.filter(
    c => !CROP_RECIPES.some(r => r.name.toLowerCase() === c.name.toLowerCase())
  );
  const customRecipes = customCrops.map((c, i) => apiCropToRecipe(c, i));
  const allRecipes = [...CROP_RECIPES.filter(r => !hiddenKeys.includes(r.key)), ...customRecipes];
  const minCol = useAdaptiveGrid(allRecipes.length, gridRef);

  return (
    <div className="p-10 h-full flex flex-col">
      <div className="page-header flex items-center justify-between flex-shrink-0">
        <h2 className="page-title">Knjižnica Usjeva</h2>
        <button onClick={() => setModal('add')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusIcon size={18} color="#fff" /> Usjev
        </button>
      </div>

      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(minCol)}px, 1fr))`,
          gap: '24px',
          flex: 1,
          alignContent: 'start',
        }}
      >
        {allRecipes.map(recipe => (
          <CropCard
            key={recipe.key}
            recipe={recipe}
            onEdit={() => handleEdit(recipe)}
            onDelete={id => setConfirmDelete(id)}
          />
        ))}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <Modal title="Obriši Recept" onClose={() => setConfirmDelete(null)}>
          <p style={{ fontSize: '16px', color: '#374151', marginBottom: '24px' }}>
            Obrisati ovaj recept?
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <XIcon size={16} /> Ne
            </button>
            <button onClick={() => handleDelete(confirmDelete)}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <TrashIcon size={16} color="#fff" /> Da
            </button>
          </div>
        </Modal>
      )}

      {modal && modal !== 'add' && !confirmDelete && (
        <Modal title={`Uredi ${modal.name}`} onClose={() => setModal(null)}>
          <CropForm initial={modal} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal === 'add' && (
        <Modal title="Dodaj Usjev" onClose={() => setModal(null)}>
          <CropForm initial={null} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
