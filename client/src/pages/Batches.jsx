import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { CROP_RECIPES, getCurrentPhase } from '../data/cropData';
import {
  fetchRegals, plantTray, clearTray, fetchSeeds,
  fetchHarvests, createHarvest, deleteAllTrays, deleteAllHarvests,
  upsertTray, setSeeds,
} from '../api/growRack';
import { BackIcon, CheckIcon, XIcon, DownloadIcon, UploadIcon, ScissorsIcon } from '../components/Icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const REGAL_LABELS = ['Regal 1', 'Regal 2', 'Regal 3', 'Regal 4'];
const SHELF_LABELS = ['Polica 1', 'Polica 2', 'Polica 3', 'Polica 4'];
const REGAL_COLORS = [
  { accent: '#16a34a', dark: '#052e16', border: '#15803d', gradient: 'linear-gradient(160deg,#0a2518,#071a10)' },
  { accent: '#2563eb', dark: '#172554', border: '#1d4ed8', gradient: 'linear-gradient(160deg,#0c1a3d,#091228)' },
  { accent: '#d97706', dark: '#451a03', border: '#b45309', gradient: 'linear-gradient(160deg,#2a1503,#1a0d02)' },
  { accent: '#9333ea', dark: '#2e1065', border: '#7e22ce', gradient: 'linear-gradient(160deg,#1a0a3d,#110728)' },
];
const FUNKY_FONT = "'Trebuchet MS', 'Comic Sans MS', 'Segoe UI', cursive";

function emptyRegals() {
  return Array(4).fill(null).map(() => Array(16).fill(null));
}

// ─── Plant SVG (front-view tray with growing plants) ─────────────────────────

function TrayPlantSVG({ crop, stage, width = 200, height = 128 }) {
  const W = width, H = height;
  const BORDER = 6, SOIL_Y = H * 0.63, INNER_W = W - BORDER * 2;
  const PLANT_H = SOIL_Y - BORDER;

  const heightFrac = { seed:0, sprout:.13, blackout:0, light:.30, growing:.56, ready:.74 }[stage] ?? 0;
  const stemCount  = { seed:0, sprout:8,   blackout:0, light:10,  growing:13,  ready:16  }[stage] ?? 0;
  const stemTopY   = SOIL_Y - heightFrac * PLANT_H;

  const stems = Array.from({ length: stemCount }, (_, i) => {
    const x  = BORDER + (INNER_W / (stemCount + 1)) * (i + 1);
    const wav = Math.sin(i * 1.7 + 0.4) * 4;
    const hv  = 0.86 + Math.cos(i * 2.3 + 0.9) * 0.14;
    return { x, topX: x + wav, topY: stemTopY + (1 - hv) * PLANT_H * 0.12 };
  });

  const lrx = crop.leafShape === 'thin' ? 2.5 : crop.leafShape === 'round' ? 7 : 5.5;
  const lry = crop.leafShape === 'thin' ? 8   : crop.leafShape === 'round' ? 5 : 3.5;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <rect x={BORDER/2} y={BORDER/2} width={W-BORDER} height={H-BORDER} rx="6"
        fill={`${crop.color}18`} stroke={crop.color} strokeWidth="1.8" />
      <rect x={BORDER} y={SOIL_Y} width={INNER_W} height={H-SOIL_Y-BORDER/2} rx="3" fill="#180901" />
      <rect x={BORDER} y={SOIL_Y} width={INNER_W} height="5" fill="#2d1205" />

      {stage === 'seed' && Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx={BORDER+(INNER_W/10)*(i+1)} cy={SOIL_Y-4} r="2.5" fill="#a07030" opacity=".75" />
      ))}
      {stage === 'blackout' && <>
        <rect x={BORDER} y={BORDER} width={INNER_W} height={SOIL_Y-BORDER} rx="4" fill="#111827" />
        <text x={W/2} y={(BORDER+SOIL_Y)/2+1} textAnchor="middle" fontSize="11" fill="#4b5563" fontFamily="system-ui" fontWeight="600">🌑 Blackout</text>
      </>}

      {stems.map((s, i) => (
        <g key={i}>
          <line x1={s.x} y1={SOIL_Y} x2={s.topX} y2={s.topY}
            stroke={crop.stemColor} strokeWidth={stage==='sprout'?1:1.6} strokeLinecap="round" opacity=".95" />
          {stage === 'sprout' && <ellipse cx={s.topX} cy={s.topY} rx="2.8" ry="2.8" fill="#c8a227" opacity=".85" />}
          {(stage==='light'||stage==='growing'||stage==='ready') && <>
            <ellipse cx={s.topX} cy={s.topY} rx={lrx} ry={lry} fill={crop.leafColor} opacity=".93"
              transform={`rotate(${Math.sin(i*1.5)*28},${s.topX},${s.topY})`} />
            {(stage==='growing'||stage==='ready') && <ellipse
              cx={s.topX-lrx*.9} cy={s.topY+lry*.6} rx={lrx*.65} ry={lry*.65} fill={crop.leafColor} opacity=".68"
              transform={`rotate(${-28+Math.sin(i)*12},${s.topX-lrx*.9},${s.topY+lry*.6})`} />}
            {stage==='ready'&&i%2===0&&<ellipse
              cx={s.topX+lrx*.8} cy={s.topY+lry*.8} rx={lrx*.5} ry={lry*.5} fill={crop.leafColor} opacity=".55"
              transform={`rotate(${32+Math.sin(i*2)*10},${s.topX+lrx*.8},${s.topY+lry*.8})`} />}
          </>}
        </g>
      ))}
      <rect x={BORDER} y={H-BORDER*1.5} width={INNER_W} height={BORDER*.8} rx="3" fill={`${crop.color}28`} />
    </svg>
  );
}

function EmptyTraySVG({ width = 200, height = 128 }) {
  const W = width, H = height;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <rect x="4" y="4" width={W-8} height={H-8} rx="7" fill="#1c0f05" stroke="#7c3f1e" strokeWidth="1.5" strokeDasharray="5 3" />
      {Array.from({length:8},(_,i)=>(
        <circle key={i} cx={20+i*(W-40)/7} cy={H*.53} r="4" fill="#2d1205" opacity=".55" />
      ))}
      <text x={W/2} y={H*.50} textAnchor="middle" fontSize="22" fontFamily="system-ui" opacity=".35">🪴</text>
    </svg>
  );
}

// ─── Tray Slot ─────────────────────────────────────────────────────────────────

function TraySlot({ tray, onClick }) {
  const [hover, setHover] = useState(false);
  const crop      = tray ? CROP_RECIPES.find(c => c.key === tray.cropKey) : null;
  const phaseInfo = crop  ? getCurrentPhase(crop, tray.plantedDate) : null;
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
        borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
        transform: hover ? 'translateY(-3px) scale(1.02)' : 'none',
        transition: 'transform .18s ease, box-shadow .18s ease',
        boxShadow: hover
          ? `0 8px 24px ${crop ? crop.color+'44' : 'rgba(0,0,0,.35)'}, 0 2px 6px rgba(0,0,0,.3)`
          : '0 2px 8px rgba(0,0,0,.25)',
        background: '#0f0704',
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
        </> : <p style={{margin:0,fontSize:'14px',color:'#5a3520',textAlign:'center',lineHeight:1.6,paddingTop:'6px',fontFamily:FUNKY_FONT,fontWeight:600}}>Prazno</p>}
      </div>
    </div>
  );
}

// ─── LED Grow Light ────────────────────────────────────────────────────────────

function GrowLight({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', paddingLeft:'2px' }}>
      <span style={{ fontSize:'12px', color:'#4b5563', fontWeight:600, minWidth:'58px' }}>{label}</span>
      <div style={{ flex:1, position:'relative', height:'8px' }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'4px', background:'#1c1c1c', border:'1px solid #333' }} />
        <div style={{
          position:'absolute', inset:0, borderRadius:'4px',
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

function PlantingForm({ seedAmounts, onPlant, onClose }) {
  const [cropKey, setCropKey] = useState('');
  const [dayIdx,  setDayIdx]  = useState(0);
  const [notes,   setNotes]   = useState('');

  const crop  = CROP_RECIPES.find(c => c.key === cropKey);
  const phase = crop?.phases[dayIdx];
  const stock = seedAmounts?.[cropKey] ?? 0;
  const needed = crop?.seedsPerTray || 0;
  const hasEnough = stock >= needed;

  const submit = e => {
    e.preventDefault();
    if (!crop || !phase) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const planted = new Date(today);
    planted.setDate(planted.getDate() - (phase.day - 1));
    const localDate = [
      planted.getFullYear(),
      String(planted.getMonth() + 1).padStart(2, '0'),
      String(planted.getDate()).padStart(2, '0'),
    ].join('-');
    onPlant({ cropKey: crop.key, plantedDate: localDate, notes });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Crop selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Vrsta usjeva *</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          {CROP_RECIPES.map(r => {
            const s = seedAmounts?.[r.key] ?? 0;
            const ok = s >= r.seedsPerTray;
            return (
              <button key={r.key} type="button" onClick={() => { setCropKey(r.key); setDayIdx(0); }}
                style={{
                  padding:'10px 12px', borderRadius:'10px', cursor:'pointer', textAlign:'left',
                  border:`2px solid ${cropKey===r.key ? r.color : '#e5e7eb'}`,
                  background: cropKey===r.key ? `${r.color}15` : '#fff',
                  transition:'border-color .15s, background .15s',
                  position:'relative',
                }}>
                <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:cropKey===r.key?r.color:'#374151' }}>{r.name}</p>
                <p style={{ margin:'2px 0 0', fontSize:'12px', color: ok ? '#9ca3af' : '#ef4444' }}>
                  {ok ? `${s}g na stanju` : `⚠ samo ${s}g (treba ${r.seedsPerTray}g)`}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seed stock warning */}
      {crop && !hasEnough && (
        <div style={{ padding:'10px 14px', borderRadius:'10px', background:'#fef3c7', border:'1px solid #d97706' }}>
          <p style={{ margin:0, fontSize:'12px', color:'#92400e', fontWeight:600 }}>
            ⚠ Nedovoljno sjemena! Trebate {needed}g, imate {stock}g. Dodajte sjeme u Skladište.
          </p>
        </div>
      )}

      {/* Phase / day selection */}
      {crop && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Koji dan rasta je danas? *</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Bilješke (opcionalno)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input h-16 resize-none" placeholder="Npr. posebna sorta…" />
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onClose} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <XIcon size={16} /> Odustani
        </button>
        <button type="submit" disabled={!cropKey || !hasEnough} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <CheckIcon size={16} color="#fff" /> Zasadi
        </button>
      </div>
    </form>
  );
}

// ─── Tray Detail Modal ────────────────────────────────────────────────────────

const STAGE_DESC = {
  seed:'Klijanje — sjeme u tlu', sprout:'Nicanje — klice izlaze',
  blackout:'Blackout — bez svjetla', light:'Pod Svjetlom — rani rast',
  growing:'Rast — razvoj listova', ready:'Spremo za berbu!',
};

function TrayDetail({ tray, regal, shelf, trayNum, onClear, onHarvest, onClose }) {
  const [harvesting,   setHarvesting]   = useState(false);
  const [yieldG,       setYieldG]       = useState('');
  const [confirmFail,  setConfirmFail]  = useState(false);

  const crop      = CROP_RECIPES.find(c => c.key === tray.cropKey);
  const phaseInfo = crop ? getCurrentPhase(crop, tray.plantedDate) : null;
  if (!crop || !phaseInfo) return null;
  const { phase, phaseIdx, daysElapsed, daysUntilHarvest, isOverdue, isToday } = phaseInfo;

  const handleHarvestSubmit = () => {
    onHarvest(Number(yieldG) || 0);
  };

  return (
    <div className="space-y-5">
      {/* Location badge */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {[`Regal ${regal}`, `Polica ${shelf}`, `Plitice ${trayNum}`].map(l => (
          <span key={l} style={{
            padding:'3px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:700,
            background:`${crop.color}18`, color:crop.color, border:`1px solid ${crop.color}33`,
          }}>{l}</span>
        ))}
      </div>

      {/* Visual */}
      <div style={{ borderRadius:'12px', overflow:'hidden', border:`2px solid ${crop.color}33`, background:`${crop.color}0a` }}>
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
          { l:'Preostalo',  v: isOverdue?`Kasno +${Math.abs(daysUntilHarvest)}d` : isToday?'Danas!' : `${daysUntilHarvest} dana`,
            c: isOverdue?'#ef4444' : isToday?'#16a34a' : '#374151' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:`${crop.color}10`, borderRadius:'10px', padding:'10px 12px', textAlign:'center', border:`1px solid ${crop.color}25` }}>
            <p style={{ margin:0, fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em' }}>{l}</p>
            <p style={{ margin:'4px 0 0', fontSize:'15px', fontWeight:800, color:c||'#111827' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Current phase */}
      <div style={{ padding:'12px 15px', borderRadius:'10px', background:`${crop.color}12`, border:`1.5px solid ${crop.color}30` }}>
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
                <div style={{
                  width:'30px', height:'30px', borderRadius:'50%', margin:'0 auto',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:800,
                  background:isCur?crop.color:isPast?`${crop.color}33`:'#f3f4f6',
                  color:isCur?'#fff':isPast?crop.color:'#9ca3af',
                  border:isCur?`2px solid ${crop.color}`:'2px solid transparent',
                  boxShadow:isCur?`0 0 10px ${crop.color}55`:'none',
                }}>{p.day}</div>
                <p style={{ fontSize:'10px', color:isCur?crop.color:'#9ca3af', marginTop:'3px', lineHeight:1.2, fontWeight:isCur?700:400 }}>{p.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {tray.notes && <p style={{ margin:0, fontSize:'12px', color:'#6b7280', fontStyle:'italic' }}>Bilješka: {tray.notes}</p>}

      {/* Actions */}
      {harvesting ? (
        <div style={{ padding:'14px', borderRadius:'12px', background:'#f0fdf4', border:'1.5px solid #bbf7d0' }}>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'10px' }}>
            <input autoFocus type="number" min="0" step="1" placeholder="g" value={yieldG} onChange={e => setYieldG(e.target.value)} className="input" style={{ flex:1 }} />
            <span style={{ fontSize:'14px', color:'#6b7280' }}>g</span>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleHarvestSubmit} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'10px', fontWeight:700, fontSize:'14px', background:'#16a34a', color:'#fff', border:'none', cursor:'pointer' }}>
              <CheckIcon size={16} color="#fff" /> Berba
            </button>
            <button onClick={() => setHarvesting(false)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'42px', height:'42px', borderRadius:'10px', background:'#fff', border:'1.5px solid #e5e7eb', cursor:'pointer' }}>
              <XIcon size={16} color="#6b7280" />
            </button>
          </div>
        </div>
      ) : confirmFail ? (
        <div style={{ padding:'14px', borderRadius:'12px', background:'#fef2f2', border:'1.5px solid #fca5a5' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onClear} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'10px', fontWeight:700, fontSize:'14px', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer' }}>
              <XIcon size={16} color="#fff" /> Propalo
            </button>
            <button onClick={() => setConfirmFail(false)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'42px', height:'42px', borderRadius:'10px', background:'#fff', border:'1.5px solid #e5e7eb', cursor:'pointer' }}>
              <BackIcon size={16} color="#6b7280" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 pt-2">
          <button onClick={() => setHarvesting(true)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'10px', fontWeight:700, fontSize:'14px', background:'#16a34a', color:'#fff', border:'none', cursor:'pointer' }}>
            <ScissorsIcon size={16} color="#fff" /> Berba
          </button>
          <button onClick={() => setConfirmFail(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px 16px', borderRadius:'10px', fontWeight:700, fontSize:'14px', background:'#fff', color:'#ef4444', border:'1.5px solid #fca5a5', cursor:'pointer' }}>
            <XIcon size={16} color="#ef4444" />
          </button>
          <button onClick={onClose} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'42px', height:'42px', borderRadius:'10px', background:'#f3f4f6', border:'1px solid #e5e7eb', cursor:'pointer' }}>
            <XIcon size={16} color="#6b7280" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Regal Overview Card ───────────────────────────────────────────────────────

function RegalCard({ regals, regalIdx, onClick }) {
  const [hover, setHover] = useState(false);
  const trays    = regals[regalIdx] || Array(16).fill(null);
  const occupied = trays.filter(Boolean).length;
  const cropKeys = [...new Set(trays.filter(Boolean).map(t => t.cropKey))];
  const crops    = cropKeys.map(k => CROP_RECIPES.find(c => c.key === k)).filter(Boolean);

  const hasOverdue = trays.some(t => {
    if (!t) return false;
    const c = CROP_RECIPES.find(r => r.key === t.cropKey);
    if (!c) return false;
    return getCurrentPhase(c, t.plantedDate).isOverdue;
  });

  const rc = REGAL_COLORS[regalIdx] || REGAL_COLORS[0];

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        borderRadius:'20px', cursor:'pointer', overflow:'hidden',
        background: rc.gradient,
        border: hasOverdue ? '2px solid #ef444460' : hover ? `2px solid ${rc.accent}` : `2px solid ${rc.accent}40`,
        boxShadow: hover ? `0 16px 48px ${rc.accent}30` : `0 4px 20px ${rc.accent}15`,
        transform: hover ? 'translateY(-5px) scale(1.02)' : 'none',
        transition:'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding:'24px 26px 18px', borderBottom:`1px solid ${rc.accent}30` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ margin:0, fontWeight:800, fontSize:'24px', color: rc.accent }}>{REGAL_LABELS[regalIdx]}</h3>
          {hasOverdue && <span style={{ fontSize:'13px', fontWeight:700, color:'#ef4444', background:'#450a0a', padding:'5px 12px', borderRadius:'99px' }}>KASNO</span>}
        </div>
        <p style={{ margin:'6px 0 0', fontSize:'18px', color:'#9ca3af', fontWeight: 600 }}>
          {occupied}/16
        </p>
      </div>

      {/* Mini tray grid */}
      <div style={{ padding:'18px 20px', flex: 1 }}>
        {[0,1,2,3].map(shelf => (
          <div key={shelf} style={{ display:'flex', gap:'6px', marginBottom: shelf<3?'6px':0 }}>
            {[0,1,2,3].map(col => {
              const t = trays[shelf*4+col];
              const c = t ? CROP_RECIPES.find(r => r.key === t.cropKey) : null;
              const overdue = t && c && getCurrentPhase(c, t.plantedDate).isOverdue;
              return (
                <div key={col} style={{
                  flex:1, height:'36px', borderRadius:'7px',
                  background: c ? c.color+'55' : `${rc.accent}12`,
                  border: overdue ? '1.5px solid #ef4444' : c ? `1.5px solid ${c.color}` : `1px solid ${rc.accent}25`,
                  transition:'background .2s',
                }} />
              );
            })}
          </div>
        ))}
      </div>

      {/* Crop tags */}
      <div style={{ padding:'0 22px 14px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {crops.length === 0
          ? <span style={{ fontSize:'16px', color: rc.accent, opacity: 0.6, fontFamily: FUNKY_FONT, fontWeight: 600 }}>Prazno</span>
          : crops.map(c => (
            <span key={c.key} style={{
              fontSize:'13px', fontWeight:700, padding:'4px 10px', borderRadius:'99px',
              background:`${c.color}22`, color:c.color, border:`1px solid ${c.color}44`,
            }}>{c.name}</span>
          ))}
      </div>

      {/* Bottom bar */}
      <div style={{ padding:'14px 22px', borderTop:`1px solid ${rc.accent}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:'18px', color: rc.accent, fontWeight: 700 }}>→</span>
      </div>
    </div>
  );
}

// ─── Shelf View (inside a regal) ──────────────────────────────────────────────

function ShelfView({ regals, regalIdx, seedAmounts, onPlant, onClearSlot, onHarvest, onBack, openSlot, onOpenSlotConsumed }) {
  const [plantingSlot, setPlantingSlot] = useState(null);
  const [viewingSlot,  setViewingSlot]  = useState(null);

  const trays = regals[regalIdx] || Array(16).fill(null);

  // Open tray from URL (task click → batches?regal=&slot=)
  useEffect(() => {
    if (openSlot != null && openSlot >= 0 && openSlot < 16 && trays[openSlot]) {
      setViewingSlot(openSlot);
      onOpenSlotConsumed?.();
    }
  }, [openSlot, trays]);

  const handlePlant = async (slotIdx, data) => {
    await onPlant(regalIdx, slotIdx, data);
    setPlantingSlot(null);
  };

  const handleClearSlot = async (slotIdx) => {
    await onClearSlot(regalIdx, slotIdx);
    setViewingSlot(null);
  };

  const handleHarvest = async (slotIdx, tray, yieldG) => {
    const crop = CROP_RECIPES.find(c => c.key === tray.cropKey);
    const payload = {
      cropKey:  tray.cropKey,
      cropName: crop?.name ?? tray.cropKey,
      yieldG,
      date:  new Date().toISOString().slice(0, 10),
      regal: regalIdx + 1,
      shelf: Math.floor(slotIdx / 4) + 1,
      tray:  (slotIdx % 4) + 1,
    };
    await onHarvest(regalIdx, slotIdx, payload);
    setViewingSlot(null);
  };

  const viewingTray   = viewingSlot !== null ? trays[viewingSlot] : null;
  const viewingCrop   = viewingTray ? CROP_RECIPES.find(c => c.key === viewingTray.cropKey) : null;

  return (
    <>
      {/* Back + title */}
      <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'20px' }}>
        <button onClick={onBack} title="Natrag" style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:'40px', height:'40px', borderRadius:'12px',
          background:'#1f2937', border:'1px solid #374151', cursor:'pointer',
        }}><BackIcon size={20} color="#d1d5db" /></button>
        <div>
          <h2 className="page-title">{REGAL_LABELS[regalIdx]}</h2>
        </div>
      </div>

      {/* Rack */}
      <div style={{ maxWidth:'960px', margin:'0 auto' }}>
        <div style={{
          position:'relative',
          background:'linear-gradient(180deg,#1a1a1a,#111)',
          borderRadius:'20px', padding:'20px 28px 24px',
          border:'2px solid #2a2a2a',
          boxShadow:'0 20px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04)',
        }}>
          {/* Posts */}
          {['left:10px','right:10px'].map((p,i) => (
            <div key={i} style={{
              position:'absolute', top:'16px', bottom:'16px', width:'12px', borderRadius:'6px',
              background:'linear-gradient(to right,#3a3a3a,#555,#3a3a3a)',
              [p.split(':')[0]]:p.split(':')[1],
            }} />
          ))}

          <div style={{ position:'relative', zIndex:1 }}>
            {SHELF_LABELS.map((label, si) => {
              const start = si * 4;
              return (
                <div key={si} style={{ marginBottom:si<3?'4px':0 }}>
                  <GrowLight label={label} />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', padding:'4px 6px 8px' }}>
                    {trays.slice(start, start+4).map((tray, i) => (
                      <TraySlot key={start+i} tray={tray}
                        onClick={() => tray ? setViewingSlot(start+i) : setPlantingSlot(start+i)} />
                    ))}
                  </div>
                  {si < 3 && <div style={{
                    height:'10px', margin:'4px 4px 12px', borderRadius:'4px',
                    background:'linear-gradient(to bottom,#555,#3a3a3a,#2a2a2a)',
                    boxShadow:'0 4px 10px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.08)',
                  }} />}
                </div>
              );
            })}
          </div>

          <div style={{ height:'14px', marginTop:'8px', borderRadius:'6px', background:'linear-gradient(to bottom,#444,#2a2a2a)', boxShadow:'0 6px 16px rgba(0,0,0,.8)' }} />
        </div>
      </div>

      {/* Planting modal */}
      {plantingSlot !== null && (
        <Modal title="Zasadi Pliticu" onClose={() => setPlantingSlot(null)}>
          <PlantingForm
            seedAmounts={seedAmounts}
            onPlant={d => handlePlant(plantingSlot, d)}
            onClose={() => setPlantingSlot(null)}
          />
        </Modal>
      )}

      {/* Detail modal */}
      {viewingSlot !== null && viewingTray && (
        <Modal title={`${viewingCrop?.name ?? ''} — Detalji`} onClose={() => setViewingSlot(null)}>
          <TrayDetail
            tray={viewingTray}
            regal={regalIdx+1}
            shelf={Math.floor(viewingSlot/4)+1}
            trayNum={(viewingSlot%4)+1}
            onClear={() => handleClearSlot(viewingSlot)}
            onHarvest={yieldG => handleHarvest(viewingSlot, viewingTray, yieldG)}
            onClose={() => setViewingSlot(null)}
          />
        </Modal>
      )}
    </>
  );
}

// ─── Main Batches page ────────────────────────────────────────────────────────

export default function Batches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [regals,       setRegals]       = useState(emptyRegals);
  const [seedAmounts,  setSeedAmounts]  = useState({});
  const [loading,      setLoading]      = useState(true);
  const [selectedRegal, setSelected]   = useState(null); // null = overview
  const [openSlotFromUrl, setOpenSlotFromUrl] = useState(null);

  // Read ?regal=&slot= from URL (from task click)
  const urlRegal = searchParams.get('regal');
  const urlSlot  = searchParams.get('slot');

  useEffect(() => {
    Promise.all([fetchRegals(), fetchSeeds()])
      .then(([r, s]) => { setRegals(r); setSeedAmounts(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && urlRegal && urlSlot != null && openSlotFromUrl === null) {
      const regalNum = parseInt(urlRegal, 10);
      const slotNum  = parseInt(urlSlot,  10);
      if (regalNum >= 1 && regalNum <= 4 && slotNum >= 0 && slotNum < 16) {
        setSelected(regalNum - 1);
        setOpenSlotFromUrl(slotNum);
        setSearchParams({}, { replace: true });
      }
    }
  }, [loading, urlRegal, urlSlot, openSlotFromUrl, setSearchParams]);

  // ── API handlers ──

  const handlePlant = async (regalIdx, slotIdx, data) => {
    const crop = CROP_RECIPES.find(c => c.key === data.cropKey);
    try {
      const result = await plantTray(regalIdx, slotIdx, data.cropKey, data.plantedDate, data.notes, crop?.seedsPerTray ?? 0);
      setRegals(prev => {
        const next = prev.map(r => [...r]);
        next[regalIdx][slotIdx] = { cropKey: result.tray.cropKey, plantedDate: result.tray.plantedDate, notes: result.tray.notes };
        return next;
      });
      setSeedAmounts(prev => ({ ...prev, [data.cropKey]: result.seedGrams }));
    } catch {}
  };

  const handleClearSlot = async (regalIdx, slotIdx) => {
    try {
      await clearTray(regalIdx, slotIdx);
      setRegals(prev => {
        const next = prev.map(r => [...r]);
        next[regalIdx][slotIdx] = null;
        return next;
      });
    } catch {}
  };

  const handleHarvest = async (regalIdx, slotIdx, payload) => {
    try {
      await createHarvest(payload);
      await handleClearSlot(regalIdx, slotIdx);
    } catch {}
  };

  // ── Export / Import ──

  const exportData = async () => {
    try {
      const [exportRegals, seeds, harvests] = await Promise.all([
        fetchRegals(), fetchSeeds(), fetchHarvests(),
      ]);
      const data = { regals: exportRegals, seeds, harvests, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `zgreens-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const importData = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);

        // Wipe existing data
        await Promise.all([deleteAllTrays(), deleteAllHarvests()]);

        // Import trays
        const trayPromises = [];
        if (data.regals) {
          data.regals.forEach((regal, ri) => {
            if (!Array.isArray(regal)) return;
            regal.forEach((slot, si) => {
              if (!slot) return;
              trayPromises.push(upsertTray(ri, si, slot));
            });
          });
        }

        // Import seeds
        const seedPromises = data.seeds
          ? Object.entries(data.seeds).map(([cropKey, grams]) => setSeeds(cropKey, grams))
          : [];

        // Import harvests
        const harvestPromises = Array.isArray(data.harvests)
          ? data.harvests.map(h => createHarvest(h))
          : [];

        await Promise.all([...trayPromises, ...seedPromises, ...harvestPromises]);

        // Refresh state
        const [newRegals, newSeeds] = await Promise.all([fetchRegals(), fetchSeeds()]);
        setRegals(newRegals);
        setSeedAmounts(newSeeds);
      } catch {
        alert('Neispravan backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading) return (
    <div className="p-10">
      <div className="page-header">
        <h2 className="page-title">Plitice</h2>
      </div>
      <p className="text-gray-400 text-base">Učitavanje...</p>
    </div>
  );

  const totalOccupied = regals.reduce((s, r) => s + r.filter(Boolean).length, 0);

  // ── Regal overview ──
  if (selectedRegal === null) {
    return (
      <div className="p-10 h-full flex flex-col">
        <div className="page-header flex items-center justify-between flex-shrink-0">
          <h2 className="page-title">Plitice</h2>
          <div className="flex gap-2 items-center">
            <button onClick={exportData} title="Backup" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'40px', height:'40px', borderRadius:'12px', background:'#f3f4f6', border:'1px solid #e5e7eb', cursor:'pointer' }}>
              <DownloadIcon size={18} color="#6b7280" />
            </button>
            <label title="Uvezi" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'40px', height:'40px', borderRadius:'12px', background:'#f3f4f6', border:'1px solid #e5e7eb', cursor:'pointer' }}>
              <UploadIcon size={18} color="#6b7280" />
              <input type="file" accept=".json" onChange={importData} style={{ display:'none' }} />
            </label>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'32px', flex: 1, alignContent: 'start' }}>
          {[0,1,2,3].map(i => (
            <RegalCard key={i} regals={regals} regalIdx={i} onClick={() => setSelected(i)} />
          ))}
        </div>
      </div>
    );
  }

  // ── Shelf view for selected regal ──
  return (
    <div className="p-10">
      <ShelfView
        regals={regals}
        regalIdx={selectedRegal}
        seedAmounts={seedAmounts}
        onPlant={handlePlant}
        onClearSlot={handleClearSlot}
        onHarvest={handleHarvest}
        onBack={() => { setSelected(null); setOpenSlotFromUrl(null); }}
        openSlot={openSlotFromUrl}
        onOpenSlotConsumed={() => setOpenSlotFromUrl(null)}
      />
    </div>
  );
}
