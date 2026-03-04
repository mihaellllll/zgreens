import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { apiCropToRecipe, getCurrentPhase } from '../data/cropData';
import {
  fetchRegals, fetchRegalConfigs, createRegal, updateRegal, deleteRegal,
  plantTray, clearTray, bulkPlantTrays,
  fetchSeeds, fetchHarvests, createHarvest,
  deleteAllTrays, deleteAllHarvests, upsertTray, setSeeds,
} from '../api/growRack';
import api from '../api/client';
import { BackIcon, CheckIcon, XIcon, DownloadIcon, UploadIcon, ScissorsIcon, PencilIcon } from '../components/Icons';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import { useIsMobile } from '../hooks/useIsMobile';
import { Layers } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSlotArray(rc, trayData) {
  const total = rc.shelfCount * rc.traysPerShelf;
  return Array.from({ length: total }, (_, i) => trayData?.[i] ?? null);
}

function getCropRecipe(cropTypes, cropName) {
  const ct = cropTypes.find(c => c.name === cropName);
  return ct ? apiCropToRecipe(ct, ct.id) : null;
}

// ─── Plant SVG ────────────────────────────────────────────────────────────────

function TrayPlantSVG({ crop, stage, width = 200, height = 128 }) {
  const W = width, H = height;
  const BORDER = 8, SOIL_Y = H * 0.65, INNER_W = W - BORDER * 2;
  const PLANT_H = SOIL_Y - BORDER;

  const heightFrac = { seed:0, sprout:.13, blackout:0, light:.30, growing:.56, ready:.74 }[stage] ?? 0;
  const stemCount  = { seed:0, sprout:15, blackout:0, light:20, growing:25, ready:30 }[stage] ?? 0;
  const stemTopY   = SOIL_Y - heightFrac * PLANT_H;

  const stems = Array.from({ length: stemCount }, (_, i) => {
    const x  = BORDER + 4 + (INNER_W - 8) * (i / (stemCount - 1 || 1));
    const wav = Math.sin(i * 13.7 + 0.4) * 6;
    const hv  = 0.8 + Math.cos(i * 17.3 + 0.9) * 0.2;
    return { x, topX: x + wav, topY: stemTopY + (1 - hv) * PLANT_H * 0.15 };
  });

  const lrx = crop.leafShape === 'thin' ? 3 : crop.leafShape === 'round' ? 8 : 6;
  const lry = crop.leafShape === 'thin' ? 10 : crop.leafShape === 'round' ? 6 : 4;
  // Sanitize key for SVG ID (crop.key is already "crop-{id}")
  const svgKey = crop.key || 'default';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}>
      <defs>
        <linearGradient id={`trayBase-${svgKey}-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#111" />
        </linearGradient>
        <linearGradient id={`soil-${svgKey}-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b1a10" />
          <stop offset="100%" stopColor="#120a05" />
        </linearGradient>
        <linearGradient id={`leafGrad-${svgKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={crop.color} />
          <stop offset="100%" stopColor={crop.leafColor} />
        </linearGradient>
      </defs>

      <rect x="0" y={SOIL_Y - 5} width={W} height={H - SOIL_Y + 5} rx="4" fill={`url(#trayBase-${svgKey}-${stage})`} stroke="#333" strokeWidth="1" />
      <rect x="0" y={SOIL_Y - 5} width={W} height="4" fill="#444" opacity="0.5" />
      <rect x={BORDER} y={SOIL_Y} width={INNER_W} height={H - SOIL_Y - BORDER} rx="2" fill={`url(#soil-${svgKey}-${stage})`} />

      {stage === 'seed' && Array.from({ length: 15 }, (_, i) => (
        <circle key={i} cx={BORDER + 10 + (INNER_W - 20) * (i / 14)} cy={SOIL_Y - 2 + Math.sin(i * 3.7) * 2} r="2" fill="#8c6239" opacity="0.9" />
      ))}
      {stage === 'blackout' && (
        <g>
          <rect x="4" y={BORDER} width={W - 8} height={SOIL_Y - BORDER} rx="2" fill="#0a0a0a" />
          <text x={W/2} y={(BORDER+SOIL_Y)/2} textAnchor="middle" fontSize="12" fill="#555" fontWeight="bold">Tamna faza</text>
        </g>
      )}

      {stems.map((s, i) => (
        <g key={i} className="animate-sway" style={{ animationDelay: `${i * 0.2}s`, transformOrigin: `${s.x}px ${SOIL_Y}px` }}>
          <line x1={s.x} y1={SOIL_Y} x2={s.topX} y2={s.topY}
            stroke={crop.stemColor} strokeWidth={stage==='sprout'?1.5:2} strokeLinecap="round" opacity="0.9" />
          {stage === 'sprout' && <ellipse cx={s.topX} cy={s.topY} rx="3" ry="3" fill="#eab308" opacity="0.9" />}
          {(stage==='light'||stage==='growing'||stage==='ready') && <>
            <ellipse cx={s.topX} cy={s.topY} rx={lrx} ry={lry} fill={`url(#leafGrad-${svgKey})`} opacity="0.95"
              transform={`rotate(${Math.sin(i*13.7)*30},${s.topX},${s.topY})`} />
            {(stage==='growing'||stage==='ready') && <ellipse
              cx={s.topX-lrx} cy={s.topY+lry*0.5} rx={lrx*0.7} ry={lry*0.7} fill={`url(#leafGrad-${svgKey})`} opacity="0.8"
              transform={`rotate(${-30+Math.sin(i*17)*15},${s.topX-lrx},${s.topY+lry*0.5})`} />}
            {stage==='ready'&&i%2===0&&<ellipse
              cx={s.topX+lrx} cy={s.topY+lry*0.8} rx={lrx*0.6} ry={lry*0.6} fill={`url(#leafGrad-${svgKey})`} opacity="0.7"
              transform={`rotate(${35+Math.sin(i*23)*15},${s.topX+lrx},${s.topY+lry*0.8})`} />}
          </>}
        </g>
      ))}
    </svg>
  );
}

function EmptyTraySVG({ width = 200, height = 128 }) {
  const W = width, H = height;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}>
      <defs>
        <linearGradient id="emptyTrayBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
      <rect x="2" y={H * 0.65 - 5} width={W - 4} height={H - (H * 0.65) + 5} rx="4" fill="url(#emptyTrayBase)" stroke="#222" strokeWidth="1" />
      <rect x="2" y={H * 0.65 - 5} width={W - 4} height="4" fill="#333" opacity="0.5" />
      <text x={W/2} y={H * 0.8} textAnchor="middle" fontSize="14" fill="#333" fontWeight="bold" letterSpacing="0.2em">PRAZNO</text>
    </svg>
  );
}

// ─── Tray Slot Tile ───────────────────────────────────────────────────────────

function TraySlotTile({ tray, cropTypes, onClick, selected, highlighted }) {
  const [hover, setHover]           = useState(false);
  const [hlPulse, setHlPulse]       = useState(false);
  const crop      = tray ? getCropRecipe(cropTypes, tray.cropKey) : null;

  // Pulsing highlight effect: toggle outline every 600ms, 8 times
  useEffect(() => {
    if (!highlighted) { setHlPulse(false); return; }
    setHlPulse(true);
    let count = 0;
    const iv = setInterval(() => {
      setHlPulse(v => !v);
      if (++count >= 8) clearInterval(iv);
    }, 600);
    return () => clearInterval(iv);
  }, [highlighted]);
  const phaseInfo = crop ? getCurrentPhase(crop, tray.plantedDate) : null;
  const stage     = phaseInfo?.phase?.stage ?? 'seed';

  let countdown = null;
  if (phaseInfo) {
    const { daysUntilHarvest, isOverdue, isToday } = phaseInfo;
    countdown = isOverdue ? { text:`Kasno +${Math.abs(daysUntilHarvest)}d`, color:'#ef4444' }
              : isToday   ? { text:'Berba danas!', color:'#16a34a' }
              :              { text:`${daysUntilHarvest}d do berbe`, color:'#6b7280' };
  }

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: '28px', overflow: 'hidden', cursor: 'pointer',
        transform: hover ? 'translateY(-3px) scale(1.02)' : 'none',
        transition: 'transform .18s ease, box-shadow .18s ease, outline .1s ease',
        boxShadow: hlPulse
          ? '0 0 0 4px rgba(45,80,64,0.5), 0 0 24px rgba(45,80,64,0.6), 0 2px 8px rgba(0,0,0,.25)'
          : hover
          ? `0 8px 24px ${crop ? crop.color+'44' : 'rgba(0,0,0,.35)'}, 0 2px 6px rgba(0,0,0,.3)`
          : '0 2px 8px rgba(0,0,0,.25)',
        background: '#0f0704',
        outline: hlPulse ? '3px solid #4A7A5E' : selected ? '2.5px solid #C4914A' : 'none',
        outlineOffset: hlPulse ? '3px' : '2px',
      }}
    >
      {crop ? <TrayPlantSVG crop={crop} stage={stage} width={200} height={128} />
             : <EmptyTraySVG width={200} height={128} />}
      <div style={{
        padding: '7px 10px 8px',
        background: crop ? `linear-gradient(to right,${crop.color}22,${crop.color}11)` : '#1a0a02',
        borderTop: `1px solid ${crop ? crop.color+'30' : '#2d1205'}`,
        minHeight: '50px',
      }}>
        {crop ? <>
          <p style={{margin:0,fontWeight:700,fontSize:'14px',color:'#f3f4f6',lineHeight:1.2}}>{crop.name}</p>
          <p style={{margin:'2px 0 0',fontSize:'13px',color:crop.color,fontWeight:600}}>
            {phaseInfo?.phase?.label} — Dan {phaseInfo?.daysElapsed}
          </p>
          {countdown && (
            <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 700, color: countdown.color }}>
              {countdown.text}
            </p>
          )}
        </> : null}
      </div>
    </div>
  );
}

// ─── LED Grow Light ───────────────────────────────────────────────────────────

function GrowLight({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', paddingLeft:'2px' }}>
      <span style={{ fontSize:'12px', color:'#4b5563', fontWeight:600, minWidth:'58px' }}>{label}</span>
      <div style={{ flex:1, position:'relative', height:'8px' }}>
        <div style={{ position:'absolute', inset:0, borderRadius: '28px', background:'#1c1c1c', border:'1px solid #333' }} />
        <div style={{
          position:'absolute', inset:0, borderRadius: '28px',
          background:'linear-gradient(to right,transparent 5%,rgba(180,230,255,.6) 25%,rgba(255,255,210,.9) 50%,rgba(180,230,255,.6) 75%,transparent 95%)',
          boxShadow:'0 0 14px 5px rgba(190,230,255,.18)',
        }} />
        {Array.from({length:12},(_,i)=>(
          <div key={i} style={{
            position:'absolute', top:'50%', transform:'translateY(-50%)',
            left:`${(i+.5)*(100/12)}%`, width:'5px', height:'5px', borderRadius:'50%',
            background:i%3===0?'rgba(180,220,255,.95)':'rgba(255,255,200,.95)',
            boxShadow:`0 0 5px 2px ${i%3===0?'rgba(150,200,255,.6)':'rgba(255,255,150,.5)'}`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Planting Form ────────────────────────────────────────────────────────────

function PlantingForm({ cropTypes, seedMap, onPlant, onClose }) {
  const [cropName, setCropName] = useState('');
  const [dayIdx,   setDayIdx]   = useState(0);
  const [notes,    setNotes]    = useState('');

  const ct     = cropTypes.find(c => c.name === cropName);
  const crop   = ct ? apiCropToRecipe(ct, ct.id) : null;
  const req = ct?.seedsPerTray || 0;
  const avail = seedMap?.[cropName] || 0;
  const lack = req > 0 && avail < req;

  const submit = e => {
    e.preventDefault();
    if (!ct || !crop || lack) return;
    const phase = crop.phases[dayIdx];
    if (!phase) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const planted = new Date(today);
    planted.setDate(planted.getDate() - (phase.day - 1));
    const localDate = [
      planted.getFullYear(),
      String(planted.getMonth() + 1).padStart(2, '0'),
      String(planted.getDate()).padStart(2, '0'),
    ].join('-');
    onPlant({ cropKey: ct.name, plantedDate: localDate, notes });
  };

  if (cropTypes.length === 0) {
    return (
      <div className="space-y-4">
        <p style={{ color: 'var(--color-text-sec)', fontSize: '14px' }}>
          Nema usjeva u knjižnici. Prvo dodajte usjev.
        </p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
          <Link to="/crops" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Knjižnica Usjeva
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Crop selection */}
      <div>
        <label className="form-label">Vrsta usjeva *</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          {cropTypes.map(c => {
            const r  = apiCropToRecipe(c, c.id);
            const cReq = c.seedsPerTray || 0;
            const cAvail = seedMap?.[c.name] || 0;
            const cLack = cReq > 0 && cAvail < cReq;
            
            return (
              <button key={c.id} type="button" onClick={() => { setCropName(c.name); setDayIdx(0); }}
                style={{
                  padding:'10px 12px', borderRadius: '28px', cursor:'pointer', textAlign:'left',
                  border:`2px solid ${cropName===c.name ? r.color : '#e5e7eb'}`,
                  background: cropName===c.name ? `${r.color}15` : '#fff',
                  transition:'border-color .15s, background .15s',
                  opacity: cLack ? 0.6 : 1,
                }}>
                <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:cropName===c.name?r.color:'#374151' }}>{c.name}</p>
                {cReq > 0 && (
                  <p style={{ margin:'2px 0 0', fontSize:'11px', color: cLack ? '#ef4444' : '#9ca3af', fontWeight: cLack ? 600 : 400 }}>
                    {cLack ? `Nedovoljno sjemena (${cAvail}g / ${cReq}g)` : `Trebate ${cReq}g sjemena`}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase / day selection */}
      {crop && (
        <div>
          <label className="form-label">Koji dan rasta je danas? *</label>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {crop.phases.map((p, i) => {
              const sel = dayIdx === i;
              return (
                <button key={i} type="button" onClick={() => setDayIdx(i)}
                  style={{
                    display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px',
                    borderRadius:'9px', cursor:'pointer', textAlign:'left',
                    border:`1.5px solid ${sel ? crop.color : '#e5e7eb'}`,
                    background: sel ? `${crop.color}12` : '#fff',
                    transition:'border-color .12s, background .12s',
                  }}>
                  <div style={{
                    width:'32px', height:'32px', borderRadius:'50%', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'13px', fontWeight:800,
                    background: sel ? crop.color : '#f3f4f6',
                    color: sel ? '#fff' : '#6b7280',
                  }}>{p.day}</div>
                  <div>
                    <p style={{ margin:0, fontWeight:600, fontSize:'13px', color:sel?crop.color:'#374151' }}>
                      Dan {p.day} — {p.label}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#9ca3af' }}>
                      Zasađeno: {(() => { const d=new Date(); d.setDate(d.getDate()-(p.day-1)); return d.toLocaleDateString('hr-HR'); })()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="form-label">Bilješke (opcionalno)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input h-16 resize-none" placeholder="Npr. posebna sorta…" />
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onClose} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <XIcon size={16} /> Odustani
        </button>
        <button type="submit" disabled={!ct || lack} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'6px', opacity: (!ct || lack) ? 0.5 : 1 }}>
          <CheckIcon size={16} color="#fff" /> Zasadi
        </button>
      </div>
    </form>
  );
}

// ─── Bulk Plant Form ─────────────────────────────────────────────────────────

function BulkPlantForm({ cropTypes, seedMap, selectedCount, onPlant, onClose }) {
  const [cropName,  setCropName]  = useState('');
  const [dayIdx,    setDayIdx]    = useState(0);
  const [notes,     setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ct   = cropTypes.find(c => c.name === cropName);
  const crop = ct ? apiCropToRecipe(ct, ct.id) : null;
  const reqPerTray = ct?.seedsPerTray || 0;
  const totalReq   = reqPerTray * selectedCount;
  const avail      = seedMap?.[cropName] || 0;
  const lack       = totalReq > 0 && avail < totalReq;

  const submit = async e => {
    e.preventDefault();
    if (!ct || !crop || lack || submitting) return;
    const phase = crop.phases[dayIdx];
    if (!phase) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const planted = new Date(today);
    planted.setDate(planted.getDate() - (phase.day - 1));
    const localDate = [
      planted.getFullYear(),
      String(planted.getMonth() + 1).padStart(2, '0'),
      String(planted.getDate()).padStart(2, '0'),
    ].join('-');
    setSubmitting(true);
    try {
      await onPlant({ cropKey: ct.name, plantedDate: localDate, notes, seedsPerTray: reqPerTray });
    } finally {
      setSubmitting(false);
    }
  };

  if (cropTypes.length === 0) {
    return (
      <div className="space-y-4">
        <p style={{ color: 'var(--color-text-sec)', fontSize: '14px' }}>
          Nema usjeva u knjižnici. Prvo dodajte usjev.
        </p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
          <Link to="/crops" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Knjižnica Usjeva
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--color-forest-subtle)', fontSize: '13px', fontWeight: 600, color: 'var(--color-forest-mid)' }}>
        Odabrano plitica: <strong>{selectedCount}</strong>
      </div>

      {/* Crop selection */}
      <div>
        <label className="form-label">Vrsta usjeva *</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {cropTypes.map(c => {
            const r = apiCropToRecipe(c, c.id);
            const cReq   = (c.seedsPerTray || 0) * selectedCount;
            const cAvail = seedMap?.[c.name] || 0;
            const cLack  = cReq > 0 && cAvail < cReq;

            return (
              <button key={c.id} type="button" onClick={() => { setCropName(c.name); setDayIdx(0); }}
                style={{
                  padding: '10px 12px', borderRadius: '28px', cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${cropName === c.name ? r.color : '#e5e7eb'}`,
                  background: cropName === c.name ? `${r.color}15` : '#fff',
                  transition: 'border-color .15s, background .15s',
                  opacity: cLack ? 0.6 : 1,
                }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: cropName === c.name ? r.color : '#374151' }}>{c.name}</p>
                {(c.seedsPerTray || 0) > 0 && (
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: cLack ? '#ef4444' : '#9ca3af', fontWeight: cLack ? 600 : 400 }}>
                    {cLack ? `Nedovoljno (${cAvail}g / ${cReq}g za ${selectedCount} plitica)` : `Ukupno ${cReq}g za ${selectedCount} plitica`}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase / day selection */}
      {crop && (
        <div>
          <label className="form-label">Koji dan rasta je danas? *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {crop.phases.map((p, i) => {
              const sel = dayIdx === i;
              return (
                <button key={i} type="button" onClick={() => setDayIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                    borderRadius: '9px', cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${sel ? crop.color : '#e5e7eb'}`,
                    background: sel ? `${crop.color}12` : '#fff',
                    transition: 'border-color .12s, background .12s',
                  }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 800,
                    background: sel ? crop.color : '#f3f4f6',
                    color: sel ? '#fff' : '#6b7280',
                  }}>{p.day}</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: sel ? crop.color : '#374151' }}>
                      Dan {p.day} — {p.label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                      Zasađeno: {(() => { const d = new Date(); d.setDate(d.getDate() - (p.day - 1)); return d.toLocaleDateString('hr-HR'); })()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Seed summary */}
      {ct && totalReq > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: '12px', background: lack ? 'rgba(239,68,68,0.06)' : 'rgba(22,163,74,0.06)', border: `1px solid ${lack ? 'rgba(239,68,68,0.25)' : 'rgba(22,163,74,0.25)'}`, fontSize: '13px', color: lack ? '#ef4444' : '#16a34a', fontWeight: 500 }}>
          {lack
            ? `Nedovoljno sjemena: imate ${avail}g, trebate ${totalReq}g (${reqPerTray}g × ${selectedCount})`
            : `Odbit ce se ${totalReq}g sjemena (${reqPerTray}g × ${selectedCount} plitica)`}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="form-label">Biljeske (opcionalno)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input h-16 resize-none" placeholder="Npr. posebna sorta..." />
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onClose} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <XIcon size={16} /> Odustani
        </button>
        <button type="submit" disabled={!ct || lack || submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: (!ct || lack || submitting) ? 0.5 : 1 }}>
          <CheckIcon size={16} color="#fff" /> {submitting ? 'Sadim...' : `Zasadi ${selectedCount} plitica`}
        </button>
      </div>
    </form>
  );
}

// ─── Tray Detail Modal ─────────────────────────────────────────────────────────

const STAGE_DESC = {
  seed:'Klijanje — sjeme u tlu', sprout:'Nicanje — klice izlaze',
  blackout:'Tamna faza — bez svjetla', light:'Pod Svjetlom — rani rast',
  growing:'Rast — razvoj listova', ready:'Spremo za berbu!',
};

function TrayDetail({ tray, regalName, shelf, trayNum, cropTypes, onClear, onHarvest, onClose }) {
  const [harvesting,  setHarvesting]  = useState(false);
  const [yieldG,      setYieldG]      = useState('');
  const [confirmFail, setConfirmFail] = useState(false);

  const crop      = getCropRecipe(cropTypes, tray.cropKey);
  const phaseInfo = crop ? getCurrentPhase(crop, tray.plantedDate) : null;
  if (!crop || !phaseInfo) return null;
  const { phase, phaseIdx, daysElapsed, daysUntilHarvest, isOverdue, isToday } = phaseInfo;

  return (
    <div className="space-y-5">
      {/* Location badge */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {[regalName, `Polica ${shelf}`, `Plitice ${trayNum}`].map(l => (
          <span key={l} style={{ padding:'3px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700, background:`${crop.color}18`, color:crop.color, border:`1px solid ${crop.color}33` }}>{l}</span>
        ))}
      </div>

      {/* Visual */}
      <div style={{ borderRadius: '28px', overflow:'hidden', border:`2px solid ${crop.color}33`, background:`${crop.color}0a` }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0', background:`${crop.color}15` }}>
          <TrayPlantSVG crop={crop} stage={phase.stage} width={220} height={140} />
        </div>
        <div style={{ padding:'12px 16px', background:`linear-gradient(to right,${crop.color}18,${crop.color}08)` }}>
          <p style={{ margin:0, fontWeight:800, fontSize:'17px', color:'#111827' }}>{crop.name}</p>
          <p style={{ margin:'2px 0 0', fontSize:'12px', color:crop.color, fontWeight:600 }}>{crop.nameEn}</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
        {[
          { l:'Dan rasta',  v:`Dan ${daysElapsed}` },
          { l:'Berba',      v:`Dan ${crop.harvestDay}` },
          { l:'Preostalo',  v: isOverdue?`Kasno +${Math.abs(daysUntilHarvest)}d`:isToday?'Danas!':`${daysUntilHarvest} dana`,
            c: isOverdue?'#ef4444':isToday?'#16a34a':'#374151' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:`${crop.color}10`, borderRadius: '28px', padding:'10px 12px', textAlign:'center', border:`1px solid ${crop.color}25` }}>
            <p style={{ margin:0, fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em' }}>{l}</p>
            <p style={{ margin:'4px 0 0', fontSize:'15px', fontWeight:800, color:c||'#111827' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Current phase */}
      <div style={{ padding:'12px 15px', borderRadius: '28px', background:`${crop.color}12`, border:`1.5px solid ${crop.color}30` }}>
        <p style={{ margin:0, fontSize:'11px', color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>Trenutna faza</p>
        <p style={{ margin:'4px 0 0', fontSize:'14px', fontWeight:700, color:crop.color }}>{phase.label}</p>
        <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#6b7280' }}>{STAGE_DESC[phase.stage]}</p>
      </div>

      {/* Timeline */}
      <div>
        <p style={{ margin:'0 0 8px', fontSize:'12px', color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>Uzgoj po danima</p>
        <div style={{ display:'flex', gap:'4px', alignItems:'flex-start' }}>
          {crop.phases.map((p, i) => {
            const isPast = daysElapsed > p.day, isCur = i === phaseIdx;
            return (
              <div key={i} style={{ flex:1, textAlign:'center' }}>
                <div style={{ height:'4px', borderRadius:'2px', marginBottom:'6px', background:isPast?crop.color:isCur?crop.color:'#e5e7eb', opacity:isPast?.5:1 }} />
                <div style={{ width:'30px', height:'30px', borderRadius:'50%', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:800, background:isCur?crop.color:isPast?`${crop.color}33`:'#f3f4f6', color:isCur?'#fff':isPast?crop.color:'#9ca3af', border:isCur?`2px solid ${crop.color}`:'2px solid transparent', boxShadow:isCur?`0 0 10px ${crop.color}55`:'none' }}>{p.day}</div>
                <p style={{ fontSize:'10px', color:isCur?crop.color:'#9ca3af', marginTop:'3px', lineHeight:1.2, fontWeight:isCur?700:400 }}>{p.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {tray.notes && <p style={{ margin:0, fontSize:'12px', color:'#6b7280', fontStyle:'italic' }}>Bilješka: {tray.notes}</p>}

      {/* Actions */}
      {harvesting ? (
        <div style={{ padding:'14px', borderRadius: '28px', background:'#f0fdf4', border:'1.5px solid #bbf7d0' }}>
          {crop.harvestWeight > 0 && (
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#6b7280' }}>
              Očekivano: ~{crop.harvestWeight}g
            </div>
          )}
          <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'10px' }}>
            <input autoFocus type="number" min="0" step="1" placeholder={crop.harvestWeight ? String(crop.harvestWeight) : 'g'} value={yieldG} onChange={e => setYieldG(e.target.value)} className="input" style={{ flex:1 }} />
            <span style={{ fontSize:'14px', color:'#6b7280' }}>g</span>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => onHarvest(Number(yieldG) || 0)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius: '28px', fontWeight:700, fontSize:'14px', background:'#16a34a', color:'#fff', border:'none', cursor:'pointer' }}>
              <CheckIcon size={16} color="#fff" /> Berba
            </button>
            <button onClick={() => setHarvesting(false)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'42px', height:'42px', borderRadius: '28px', background:'#fff', border:'1.5px solid #e5e7eb', cursor:'pointer' }}>
              <XIcon size={16} color="#6b7280" />
            </button>
          </div>
        </div>
      ) : confirmFail ? (
        <div style={{ padding:'14px', borderRadius: '28px', background:'#fef2f2', border:'1.5px solid #fca5a5' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onClear} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius: '28px', fontWeight:700, fontSize:'14px', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer' }}>
              <XIcon size={16} color="#fff" /> Propalo
            </button>
            <button onClick={() => setConfirmFail(false)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'42px', height:'42px', borderRadius: '28px', background:'#fff', border:'1.5px solid #e5e7eb', cursor:'pointer' }}>
              <BackIcon size={16} color="#6b7280" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 pt-2">
          <button onClick={() => setHarvesting(true)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius: '28px', fontWeight:700, fontSize:'14px', background:'#16a34a', color:'#fff', border:'none', cursor:'pointer' }}>
            <ScissorsIcon size={16} color="#fff" /> Berba
          </button>
          <button onClick={() => setConfirmFail(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px 16px', borderRadius: '28px', fontWeight:700, fontSize:'14px', background:'#fff', color:'#ef4444', border:'1.5px solid #fca5a5', cursor:'pointer' }}>
            <XIcon size={16} color="#ef4444" />
          </button>
          <button onClick={onClose} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'42px', height:'42px', borderRadius: '28px', background:'#f3f4f6', border:'1px solid #e5e7eb', cursor:'pointer' }}>
            <XIcon size={16} color="#6b7280" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Regal Card (overview) ────────────────────────────────────────────────────

function RegalCard({ rc, trayMap, cropTypes, onClick, actions }) {
  const [hover, setHover] = useState(false);
  const total    = rc.shelfCount * rc.traysPerShelf;
  const trayData = trayMap[rc.id] || {};
  const occupied = Object.keys(trayData).length;
  const trays    = buildSlotArray(rc, trayData);

  const cropNames = [...new Set(trays.filter(Boolean).map(t => t.cropKey))];
  const cropPhaseGroups = cropNames.map(name => {
    const c = getCropRecipe(cropTypes, name);
    if (!c) return null;
    const cropTrays = trays.filter(t => t?.cropKey === name);
    const phaseGroups = {};
    cropTrays.forEach(t => {
      const info = getCurrentPhase(c, t.plantedDate);
      const label = info.phase?.label || 'Sjetva';
      phaseGroups[label] = (phaseGroups[label] || 0) + 1;
    });
    return { crop: c, phaseGroups, totalTrays: cropTrays.length };
  }).filter(Boolean);

  const overdueCount = trays.reduce((count, t) => {
    if (!t) return count;
    const c = getCropRecipe(cropTypes, t.cropKey);
    return c && getCurrentPhase(c, t.plantedDate).isOverdue ? count + 1 : count;
  }, 0);

  let nextHarvestDays = null;
  let nextHarvestName = null;
  trays.forEach(t => {
    if (!t) return;
    const c = getCropRecipe(cropTypes, t.cropKey);
    if (!c) return;
    const info = getCurrentPhase(c, t.plantedDate);
    if (!info.isOverdue && info.daysUntilHarvest >= 0) {
      if (nextHarvestDays === null || info.daysUntilHarvest < nextHarvestDays) {
        nextHarvestDays = info.daysUntilHarvest;
        nextHarvestName = c.name;
      }
    }
  });

  const fillPct = total > 0 ? (occupied / total) * 100 : 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="card"
      style={{ cursor: 'pointer', transform: (occupied > 0 && hover) ? 'translateY(-4px)' : undefined, boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
    >
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '26px', fontWeight: '700', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', lineHeight: 1 }}>
              {rc.name}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {rc.shelfCount} Polica × {rc.traysPerShelf} Plitice
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '6px 14px', borderRadius: '99px', background: 'var(--color-forest-subtle)', fontSize: '14px', fontWeight: '700', color: 'var(--color-forest-mid)' }}>
              {occupied} / {total}
            </span>
            {actions}
          </div>
        </div>
      </div>

      {/* Fill bar */}
      <div style={{ padding: '18px 24px 14px' }}>
        <div style={{ height: '8px', borderRadius: '99px', background: 'var(--color-border)' }}>
          <div style={{ height: '100%', borderRadius: '99px', background: 'var(--color-forest-mid)', width: `${fillPct}%`, transition: 'width 0.4s ease' }} />
        </div>
      </div>


      {nextHarvestDays !== null && (
        <div style={{ padding: '0 24px 12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-sec)' }}>
            Sljedeća berba: <strong style={{ color: 'var(--color-forest-mid)' }}>
              {nextHarvestDays === 0 ? 'Danas!' : nextHarvestDays === 1 ? 'Sutra' : `za ${nextHarvestDays} dana`}
            </strong>
            {nextHarvestName && <span style={{ color: 'var(--color-text-muted)' }}> — {nextHarvestName}</span>}
          </div>
        </div>
      )}

      {overdueCount > 0 && (
        <div style={{ padding: '10px 24px', background: 'rgba(201,75,42,0.08)', borderTop: '1px solid rgba(201,75,42,0.2)' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: 'var(--color-clay)' }}>
            {'\u26A0'} {overdueCount} {overdueCount === 1 ? 'kasna berba' : 'kasne berbe'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Add Regal Form ───────────────────────────────────────────────────────────

function AddRegalForm({ onSave, onClose }) {
  const [name,          setName]          = useState('');
  const [shelfCount,    setShelfCount]    = useState(4);
  const [traysPerShelf, setTraysPerShelf] = useState(4);
  const [loading,       setLoading]       = useState(false);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const rc = await createRegal(name.trim(), shelfCount, traysPerShelf);
      onSave(rc);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="form-label">Naziv Regala *</label>
        <input required value={name} onChange={e => setName(e.target.value)} className="input" placeholder="npr. Regal A" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Broj Polica</label>
          <input type="number" min="1" max="8" value={shelfCount} onChange={e => setShelfCount(Number(e.target.value))} className="input" />
        </div>
        <div>
          <label className="form-label">Plitice po Polici</label>
          <input type="number" min="1" max="8" value={traysPerShelf} onChange={e => setTraysPerShelf(Number(e.target.value))} className="input" />
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '...' : 'Stvori Regal'}
        </button>
      </div>
    </form>
  );
}

// ─── Edit Regal Form ─────────────────────────────────────────────────────────

function EditRegalForm({ regal, hasPlantedTrays, onSave, onClose }) {
  const [name,          setName]          = useState(regal.name);
  const [shelfCount,    setShelfCount]    = useState(regal.shelfCount);
  const [traysPerShelf, setTraysPerShelf] = useState(regal.traysPerShelf);
  const [loading,       setLoading]       = useState(false);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await updateRegal(regal.id, { name: name.trim(), shelfCount, traysPerShelf });
      onSave(updated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {hasPlantedTrays && (
        <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(202,138,4,0.08)', border: '1px solid rgba(202,138,4,0.25)', color: '#92400e', fontSize: '13px', fontWeight: 500 }}>
          Ovaj regal ima posađene plitice. Promjena konfiguracije ne briše postojeće podatke.
        </div>
      )}
      <div>
        <label className="form-label">Ime regala *</label>
        <input required value={name} onChange={e => setName(e.target.value)} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Broj polica</label>
          <input type="number" min="1" max="10" value={shelfCount} onChange={e => setShelfCount(Number(e.target.value))} className="input" />
        </div>
        <div>
          <label className="form-label">Plitica po polici</label>
          <input type="number" min="1" max="8" value={traysPerShelf} onChange={e => setTraysPerShelf(Number(e.target.value))} className="input" />
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '...' : 'Spremi'}
        </button>
      </div>
    </form>
  );
}

// ─── Shelf View (inside a regal) ──────────────────────────────────────────────

function ShelfView({ rc, trayData, cropTypes, seedMap, onPlant, onClearSlot, onHarvest, onBulkPlant, onBack, openSlot, onOpenSlotConsumed, highlightSlot, onHighlightConsumed }) {
  const [plantingSlot,  setPlantingSlot]  = useState(null);
  const [viewingSlot,   setViewingSlot]   = useState(null);
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [showBulkPlant, setShowBulkPlant] = useState(false);
  const isMobile = useIsMobile();

  // Auto-clear highlight after animation completes (~5s)
  useEffect(() => {
    if (highlightSlot == null) return;
    const t = setTimeout(() => onHighlightConsumed?.(), 5000);
    return () => clearTimeout(t);
  }, [highlightSlot]);

  const trays = buildSlotArray(rc, trayData);

  // Open tray from URL (task click → batches?regal=&slot=)
  useEffect(() => {
    if (openSlot != null && openSlot >= 0 && openSlot < trays.length && trays[openSlot]) {
      setViewingSlot(openSlot);
      onOpenSlotConsumed?.();
    }
  }, [openSlot, trays.length]);

  const handlePlant = async (slotIdx, data) => {
    await onPlant(rc.id, slotIdx, data);
    setPlantingSlot(null);
  };

  const handleClearSlot = async slotIdx => {
    await onClearSlot(rc.id, slotIdx);
    setViewingSlot(null);
  };

  const handleHarvest = async (slotIdx, tray, yieldG) => {
    const payload = {
      cropKey:  tray.cropKey,
      cropName: tray.cropKey,
      yieldG,
      date:  new Date().toISOString().slice(0, 10),
      regal: rc.id,
      shelf: Math.floor(slotIdx / rc.traysPerShelf) + 1,
      tray:  (slotIdx % rc.traysPerShelf) + 1,
    };
    await onHarvest(rc.id, slotIdx, payload);
    setViewingSlot(null);
  };

  const handleBulkPlantSubmit = async (plantData) => {
    await onBulkPlant(rc.id, Array.from(selectedSlots), plantData);
    setSelectedSlots(new Set());
    setShowBulkPlant(false);
  };

  const toggleSlotSelection = (slotIdx) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotIdx)) next.delete(slotIdx);
      else next.add(slotIdx);
      return next;
    });
  };

  const viewingTray = viewingSlot !== null ? trays[viewingSlot] : null;
  const viewingCropName = viewingTray ? viewingTray.cropKey : '';

  return (
    <>
      {/* Back + title */}
      <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom: selectedSlots.size > 0 ? '12px' : '20px' }}>
        <button onClick={onBack} title="Natrag" className="btn-icon">
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--color-text)', letterSpacing: '-0.02em' }}>{rc.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {rc.shelfCount} polica × {rc.traysPerShelf} plitice
          </p>
        </div>
      </div>

      {/* Selection bar */}
      {selectedSlots.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
          padding: '10px 16px', borderRadius: '28px',
          background: 'rgba(196,145,74,0.1)', border: '1.5px solid rgba(196,145,74,0.4)',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setSelectedSlots(new Set())}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <XIcon size={13} /> Odustani
          </button>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: 'var(--color-gold)' }}>
            Odabrano: {selectedSlots.size} {selectedSlots.size === 1 ? 'plitice' : 'plitica'}
          </span>
          <button
            onClick={() => setShowBulkPlant(true)}
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <CheckIcon size={13} color="#fff" /> Zasadi sve
          </button>
        </div>
      )}

      {/* Rack */}
      <div style={{ maxWidth:'960px', margin:'0 auto' }}>
        <div style={{
          position:'relative',
          background:'linear-gradient(180deg,#1a1a1a,#111)',
          borderRadius: '28px', padding: isMobile ? '12px 14px 16px' : '20px 28px 24px',
          border:'2px solid #2a2a2a',
          boxShadow:'0 20px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04)',
        }}>
          {/* Posts */}
          {['left:10px','right:10px'].map((p,i) => (
            <div key={i} style={{
              position:'absolute', top:'16px', bottom:'16px', width:'12px', borderRadius: '28px',
              background:'linear-gradient(to right,#3a3a3a,#555,#3a3a3a)',
              [p.split(':')[0]]:p.split(':')[1],
            }} />
          ))}

          <div style={{ position:'relative', zIndex:1 }}>
            {Array.from({ length: rc.shelfCount }, (_, si) => {
              const start = si * rc.traysPerShelf;
              const cols  = isMobile ? Math.min(rc.traysPerShelf, 2) : rc.traysPerShelf;
              return (
                <div key={si} style={{ marginBottom: si < rc.shelfCount - 1 ? '4px' : 0 }}>
                  <GrowLight label={`Polica ${si + 1}`} />
                  <div style={{ display:'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: isMobile ? '8px' : '12px', padding:'4px 6px 8px' }}>
                    {trays.slice(start, start + rc.traysPerShelf).map((tray, i) => {
                      const slotIdx = start + i;
                      const isSelected = selectedSlots.has(slotIdx);
                      return (
                        <TraySlotTile key={slotIdx} tray={tray} cropTypes={cropTypes}
                          selected={isSelected}
                          highlighted={slotIdx === highlightSlot}
                          onClick={() => {
                            if (tray) {
                              // Occupied: always open detail (clear selection mode)
                              setViewingSlot(slotIdx);
                            } else if (selectedSlots.size > 0) {
                              // Selection mode active: toggle this empty slot
                              toggleSlotSelection(slotIdx);
                            } else {
                              // Normal: open single planting form
                              setPlantingSlot(slotIdx);
                            }
                          }}
                          onLongPress={!tray ? () => toggleSlotSelection(slotIdx) : undefined}
                        />
                      );
                    })}
                  </div>
                  {si < rc.shelfCount - 1 && <div style={{ height:'10px', margin:'4px 4px 12px', borderRadius: '28px', background:'linear-gradient(to bottom,#555,#3a3a3a,#2a2a2a)', boxShadow:'0 4px 10px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.08)' }} />}
                </div>
              );
            })}
          </div>

          <div style={{ height:'14px', marginTop:'8px', borderRadius: '28px', background:'linear-gradient(to bottom,#444,#2a2a2a)', boxShadow:'0 6px 16px rgba(0,0,0,.8)' }} />
        </div>
      </div>

      {/* Planting modal */}
      {plantingSlot !== null && (
        <Modal title="Zasadi Pliticu" onClose={() => setPlantingSlot(null)}>
          <PlantingForm
            cropTypes={cropTypes}
            seedMap={seedMap}
            onPlant={d => handlePlant(plantingSlot, d)}
            onClose={() => setPlantingSlot(null)}
          />
        </Modal>
      )}

      {/* Detail modal */}
      {viewingSlot !== null && viewingTray && (
        <Modal title={`${viewingCropName} — Detalji`} onClose={() => setViewingSlot(null)}>
          <TrayDetail
            tray={viewingTray}
            regalName={rc.name}
            shelf={Math.floor(viewingSlot / rc.traysPerShelf) + 1}
            trayNum={(viewingSlot % rc.traysPerShelf) + 1}
            cropTypes={cropTypes}
            onClear={() => handleClearSlot(viewingSlot)}
            onHarvest={yieldG => handleHarvest(viewingSlot, viewingTray, yieldG)}
            onClose={() => setViewingSlot(null)}
          />
        </Modal>
      )}

      {/* Bulk plant modal */}
      {showBulkPlant && (
        <Modal title="Masovna sjetva" onClose={() => { setShowBulkPlant(false); setSelectedSlots(new Set()); }}>
          <BulkPlantForm
            cropTypes={cropTypes}
            seedMap={seedMap}
            selectedCount={selectedSlots.size}
            onPlant={handleBulkPlantSubmit}
            onClose={() => { setShowBulkPlant(false); setSelectedSlots(new Set()); }}
          />
        </Modal>
      )}
    </>
  );
}

// ─── Main Batches page ────────────────────────────────────────────────────────

export default function Batches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [regalConfigs,    setRegalConfigs]   = useState([]);
  const [trayMap,         setTrayMap]        = useState({});
  const [cropTypes,       setCropTypes]      = useState([]);
  const [seedMap,         setSeedMap]        = useState({});
  const [loading,         setLoading]        = useState(true);
  const [error,           setError]          = useState(null);
  const [selectedRegalId, setSelectedRegalId] = useState(null); // null = overview
  const [openSlotFromUrl, setOpenSlotFromUrl] = useState(null);
  const [highlightSlot,   setHighlightSlot]   = useState(null);
  const [showAddRegal,    setShowAddRegal]   = useState(false);
  const [editingRegal,    setEditingRegal]   = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [importFile,      setImportFile]     = useState(null);
  const isMobile = useIsMobile();

  const urlRegal     = searchParams.get('regal');
  const urlSlot      = searchParams.get('slot');
  const urlHighlight = searchParams.get('highlight');

  useEffect(() => {
    Promise.all([
      fetchRegalConfigs().catch(() => []),
      fetchRegals().catch(() => ({})),
      api.get('/crops').catch(() => ({ data: [] })),
      fetchSeeds().catch(() => ({})),
    ]).then(([rcs, trays, cropsRes, seedsRes]) => {
      setRegalConfigs(rcs);
      setTrayMap(trays);
      setCropTypes(cropsRes.data);
      setSeedMap(seedsRes);
    }).finally(() => setLoading(false));
  }, []);

  // URL param: open regal + slot
  useEffect(() => {
    if (!loading && urlRegal && urlSlot != null && openSlotFromUrl === null) {
      const regalId = parseInt(urlRegal, 10);
      const slotNum = parseInt(urlSlot,  10);
      const rc = regalConfigs.find(r => r.id === regalId);
      if (rc && slotNum >= 0 && slotNum < rc.shelfCount * rc.traysPerShelf) {
        setSelectedRegalId(regalId);
        setOpenSlotFromUrl(slotNum);
        setSearchParams({}, { replace: true });
      }
    }
  }, [loading, urlRegal, urlSlot, openSlotFromUrl, regalConfigs, setSearchParams]);

  // URL param: open regal + highlight slot (from task click)
  useEffect(() => {
    if (!loading && urlRegal && urlHighlight != null) {
      const regalId = parseInt(urlRegal, 10);
      const slotNum = parseInt(urlHighlight, 10);
      const rc = regalConfigs.find(r => r.id === regalId);
      if (rc && slotNum >= 0 && slotNum < rc.shelfCount * rc.traysPerShelf) {
        setSelectedRegalId(regalId);
        setHighlightSlot(slotNum);
        setSearchParams({}, { replace: true });
      }
    }
  }, [loading, urlRegal, urlHighlight, regalConfigs, setSearchParams]);

  // ── Refresh from server (called after every mutation) ──

  const refreshData = async () => {
    const [trays, seeds] = await Promise.all([
      fetchRegals().catch(() => ({})),
      fetchSeeds().catch(() => ({})),
    ]);
    setTrayMap(trays);
    setSeedMap(seeds);
  };

  // ── Handlers ──

  const handlePlant = async (regalId, slotIdx, data) => {
    const ct = cropTypes.find(c => c.name === data.cropKey);
    const seedsToDeduct = ct?.seedsPerTray ?? 0;
    try {
      await plantTray(regalId, slotIdx, data.cropKey, data.plantedDate, data.notes, seedsToDeduct);
      await refreshData();
    } catch {
      setError('Greška pri komunikaciji s poslužiteljem. Pokušajte ponovo.');
    }
  };

  const handleClearSlot = async (regalId, slotIdx) => {
    try {
      await clearTray(regalId, slotIdx);
      await refreshData();
    } catch {
      setError('Greška pri komunikaciji s poslužiteljem. Pokušajte ponovo.');
    }
  };

  const handleHarvest = async (regalId, slotIdx, payload) => {
    try {
      await createHarvest(payload);
      await clearTray(regalId, slotIdx);
      await refreshData();
    } catch {
      setError('Greška pri komunikaciji s poslužiteljem. Pokušajte ponovo.');
    }
  };

  const handleBulkPlant = async (regalId, slots, data) => {
    try {
      await Promise.all(
        slots.map(slotIdx => plantTray(regalId, slotIdx, data.cropKey, data.plantedDate, data.notes, data.seedsPerTray))
      );
      await refreshData();
    } catch {
      setError('Greška pri masovnoj sadnji. Pokušajte ponovo.');
    }
  };

  const handleDeleteRegal = async id => {
    try {
      await deleteRegal(id);
      setRegalConfigs(prev => prev.filter(r => r.id !== id));
      setTrayMap(prev => { const next = { ...prev }; delete next[id]; return next; });
      if (selectedRegalId === id) setSelectedRegalId(null);
    } catch {
      setError('Greška pri brisanju regala.');
    }
    setPendingDeleteId(null);
  };

  // ── Export / Import ──

  const exportData = async () => {
    try {
      const [exportTrays, seeds, harvests] = await Promise.all([
        fetchRegals(), fetchSeeds(), fetchHarvests(),
      ]);
      const data = { regalConfigs, trayMap: exportTrays, seeds, harvests, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `zgreens-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const importData = file => {
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        await Promise.all([deleteAllTrays(), deleteAllHarvests()]);

        const trayPromises = [];
        if (data.trayMap) {
          Object.entries(data.trayMap).forEach(([regalId, slots]) => {
            Object.entries(slots).forEach(([slot, tray]) => {
              if (tray) trayPromises.push(upsertTray(Number(regalId), Number(slot), tray));
            });
          });
        } else if (data.regals) {
          // Legacy backup format (old Array(4)[Array(16)])
          data.regals.forEach((regal, ri) => {
            if (!Array.isArray(regal)) return;
            regal.forEach((slot, si) => {
              if (slot) trayPromises.push(upsertTray(ri, si, slot));
            });
          });
        }

        const seedPromises = data.seeds
          ? Object.entries(data.seeds).map(([cropKey, grams]) => setSeeds(cropKey, grams))
          : [];

        const harvestPromises = Array.isArray(data.harvests)
          ? data.harvests.map(h => createHarvest(h))
          : [];

        await Promise.all([...trayPromises, ...seedPromises, ...harvestPromises]);

        const [newRegals, newSeeds] = await Promise.all([fetchRegals(), fetchSeeds()]);
        setTrayMap(newRegals);
        setSeedMap(newSeeds);
      } catch {
        setError('Neispravan backup file.');
      }
    };
    reader.readAsText(file);
  };

  if (loading) return <LoadingScreen />;

  const selectedRc = regalConfigs.find(r => r.id === selectedRegalId);

  const errorBanner = error && (
    <div style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 'var(--radius-card)', background: 'rgba(201,75,42,0.08)', border: '1px solid rgba(201,75,42,0.3)', color: 'var(--color-clay)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{error}</span>
      <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-clay)', fontWeight: 800 }}>✕</button>
    </div>
  );

  // ── Shelf view for selected regal ──
  if (selectedRc) {
    return (
      <PageWrapper>
        {errorBanner}
        <ShelfView
          rc={selectedRc}
          trayData={trayMap[selectedRc.id] || {}}
          cropTypes={cropTypes}
          seedMap={seedMap}
          onPlant={handlePlant}
          onClearSlot={handleClearSlot}
          onHarvest={handleHarvest}
          onBulkPlant={handleBulkPlant}
          onBack={() => { setSelectedRegalId(null); setOpenSlotFromUrl(null); }}
          openSlot={openSlotFromUrl}
          onOpenSlotConsumed={() => setOpenSlotFromUrl(null)}
          highlightSlot={highlightSlot}
          onHighlightConsumed={() => setHighlightSlot(null)}
        />
      </PageWrapper>
    );
  }

  // ── Regal overview ──
  const totalOccupied = Object.values(trayMap).reduce(
    (sum, slots) => sum + Object.keys(slots || {}).length, 0
  );

  return (
    <PageWrapper>
      {errorBanner}

      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Plitice</h2>
          <div className="page-subtitle">
            {totalOccupied} plitice u uzgoju
          </div>
        </div>
        <div className="page-header-right">
          <button onClick={exportData} title="Backup" className="btn-icon">
            <Download size={16} strokeWidth={1.5} />
          </button>
          <label title="Uvezi" className="btn-icon" style={{ cursor: 'pointer' }}>
            <Upload size={16} strokeWidth={1.5} />
            <input type="file" accept=".json" onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setShowAddRegal(true)} className="btn-primary" style={{ gap: '6px', fontSize: '13px', padding: '9px 16px' }}>
            <Plus size={16} strokeWidth={1.5} /> Regal
          </button>
        </div>
      </div>

      {regalConfigs.length === 0 ? (
        /* Empty state — no regals */
        <div className="gsap-reveal empty-state flex-1">
          <div style={{ width: 64, height: 64, borderRadius: 28, background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Layers size={28} color="#4A7A5E" />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', margin: '0 0 8px' }}>
            Vaš uzgojni prostor čeka
          </p>
          <p className="empty-state-text">Stvorite prvi regal da biste počeli pratiti uzgoj vaših microgreens.</p>
          <button onClick={() => setShowAddRegal(true)} className="btn-primary" style={{ marginTop: 8 }}>
            + Dodaj prvi regal
          </button>
        </div>
      ) : cropTypes.length === 0 ? (
        /* Has regals but no crops */
        <>
          <div className="gsap-reveal" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '16px' : '24px', marginBottom: '24px' }}>
            {regalConfigs.map(rc => (
              <RegalCard
                key={rc.id}
                rc={rc} trayMap={trayMap} cropTypes={cropTypes} onClick={() => setSelectedRegalId(rc.id)}
                actions={
                  <button
                    onClick={e => { e.stopPropagation(); setEditingRegal(rc); }}
                    className="btn-icon"
                    style={{ padding: '4px 8px', borderRadius: '28px', background: 'rgba(255,255,255,0.6)', border: '1px solid #e5e7eb' }}
                    title="Uredi regal"
                  ><PencilIcon size={14} color="#6b7280" /></button>
                }
              />
            ))}
          </div>
          <div className="gsap-reveal empty-state" style={{ flex: 'none', padding: '32px 24px' }}>
            <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-forest-dark)', margin: '0 0 8px' }}>
              Nema usjeva za sadnju
            </p>
            <p className="empty-state-text">Dodajte usjeve u knjižnicu da biste mogli zasaditi plitice.</p>
            <Link to="/crops" className="btn-primary" style={{ marginTop: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Knjižnica Usjeva
            </Link>
          </div>
        </>
      ) : (
        <div className="gsap-reveal" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '16px' : '24px', flex: 1, alignContent: 'start' }}>
          {regalConfigs.map(rc => {
            const regalOccupied = Object.keys(trayMap[rc.id] || {}).length > 0;
            return (
              <RegalCard
                key={rc.id}
                rc={rc} trayMap={trayMap} cropTypes={cropTypes} onClick={() => setSelectedRegalId(rc.id)}
                actions={
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingRegal(rc); }}
                      className="btn-icon"
                      style={{ padding: '4px 8px', borderRadius: '28px', background: 'rgba(255,255,255,0.6)', border: '1px solid #e5e7eb' }}
                      title="Uredi regal"
                    ><PencilIcon size={14} color="#6b7280" /></button>
                    {!regalOccupied && (
                      pendingDeleteId === rc.id ? (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteRegal(rc.id); }}
                            style={{ padding: '4px 10px', borderRadius: '28px', background: '#ef4444', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >Obriši</button>
                          <button
                            onClick={e => { e.stopPropagation(); setPendingDeleteId(null); }}
                            style={{ padding: '4px 8px', borderRadius: '28px', background: '#f3f4f6', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                          >Ne</button>
                        </>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setPendingDeleteId(rc.id); }}
                          style={{ padding: '4px 8px', borderRadius: '28px', background: 'rgba(255,255,255,0.6)', border: '1px solid #e5e7eb', fontSize: '11px', color: '#6b7280', cursor: 'pointer' }}
                        >✕</button>
                      )
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Add regal modal */}
      {showAddRegal && (
        <Modal title="Dodaj Regal" onClose={() => setShowAddRegal(false)}>
          <AddRegalForm
            onSave={rc => { setRegalConfigs(prev => [...prev, rc]); setShowAddRegal(false); }}
            onClose={() => setShowAddRegal(false)}
          />
        </Modal>
      )}

      {/* Edit regal modal */}
      {editingRegal && (
        <Modal title="Uredi regal" onClose={() => setEditingRegal(null)}>
          <EditRegalForm
            regal={editingRegal}
            hasPlantedTrays={Object.keys(trayMap[editingRegal.id] || {}).length > 0}
            onSave={async updated => {
              setRegalConfigs(prev => prev.map(r => r.id === updated.id ? updated : r));
              setEditingRegal(null);
            }}
            onClose={() => setEditingRegal(null)}
          />
        </Modal>
      )}

      {/* Import confirm modal */}
      {importFile && (
        <Modal title="Uvezi Podatke" onClose={() => setImportFile(null)}>
          <p style={{ color: 'var(--color-text-sec)', marginBottom: '24px' }}>
            Ovo će zamijeniti sve vaše trenutne podatke. Jeste li sigurni?
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setImportFile(null)} className="btn-secondary">Odustani</button>
            <button onClick={() => { importData(importFile); setImportFile(null); }} className="btn-danger">
              Da, uvezi
            </button>
          </div>
        </Modal>
      )}
    </PageWrapper>
  );
}
