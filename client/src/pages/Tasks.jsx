import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CROP_RECIPES, getCurrentPhase } from '../data/cropData';
import { RefreshIcon } from '../components/Icons';

// ─── Task generation from regal/tray data ────────────────────────────────────

const TASK_META = {
  seed:     { label: 'Zasadi',                   icon: '🌱', typeColor: '#92400e', typeBg: '#fef3c7' },
  sprout:   { label: 'Provjeri Nicanje',          icon: '🔍', typeColor: '#0e7490', typeBg: '#ecfeff' },
  blackout: { label: 'Stavi pod Blackout',        icon: '🌑', typeColor: '#1f2937', typeBg: '#f3f4f6' },
  light:    { label: 'Premjesti pod Svjetlo',     icon: '☀️',  typeColor: '#b45309', typeBg: '#fefce8' },
  growing:  { label: 'Provjeri Rast',             icon: '🌿', typeColor: '#047857', typeBg: '#ecfdf5' },
  ready:    { label: 'Uberi Usjev',               icon: '✂️',  typeColor: '#15803d', typeBg: '#f0fdf4' },
};

function generateTasks() {
  const tasks = [];
  let regals;
  try {
    regals = JSON.parse(localStorage.getItem('zgreens_regals_v1'))
          || Array(4).fill(null).map(() => Array(16).fill(null));
  } catch { return []; }

  regals.forEach((regal, ri) => {
    if (!Array.isArray(regal)) return;
    regal.forEach((tray, si) => {
      if (!tray) return;
      const crop = CROP_RECIPES.find(c => c.key === tray.cropKey);
      if (!crop) return;

      const { phase, phaseIdx, daysElapsed } = getCurrentPhase(crop, tray.plantedDate);
      const shelf    = Math.floor(si / 4) + 1;
      const trayNum  = (si % 4) + 1;

      const push = (nextIdx, priority) => {
        if (nextIdx >= crop.phases.length) return;
        const next = crop.phases[nextIdx];
        const daysUntil = next.day - daysElapsed;
        const due = new Date();
        due.setHours(0, 0, 0, 0);
        due.setDate(due.getDate() + daysUntil);
        const meta = TASK_META[next.stage] || TASK_META.growing;
        tasks.push({
          id: `${ri}-${si}-${nextIdx}`,
          priority,          // 'next' | 'later'
          stage: next.stage,
          regal: ri + 1,
          shelf,
          trayNum,
          cropKey: tray.cropKey,
          cropName: crop.name,
          cropColor: crop.color,
          phaseLabel: next.label,
          action: meta.label,
          icon: meta.icon,
          typeColor: meta.typeColor,
          typeBg: meta.typeBg,
          daysUntil,
          due,
        });
      };

      push(phaseIdx + 1, 'next');
      push(phaseIdx + 2, 'later');
    });
  });

  return tasks.sort((a, b) => a.daysUntil - b.daysUntil || a.regal - b.regal);
}

// ─── Task Bubble ──────────────────────────────────────────────────────────────
//
// Green bubble  = priority 'next'  (immediate next step)
// Yellow bubble = priority 'later' (step after next)
// Inner style   = task type (blackout, light, harvest, etc.)

function TaskBubble({ task }) {
  const isNext  = task.priority === 'next';
  const [hover, setHover] = useState(false);
  const navigate = useNavigate();

  const borderColor = isNext  ? '#16a34a' : '#d97706';
  const bgColor     = isNext  ? '#f0fdf4' : '#fffbeb';
  const accentColor = isNext  ? '#16a34a' : '#d97706';

  const today = new Date(); today.setHours(0,0,0,0);
  const isOverdue = task.daysUntil < 0;
  const isToday   = task.daysUntil === 0;

  const slot = (task.shelf - 1) * 4 + (task.trayNum - 1);

  const dueLabel = isOverdue ? `Kasno ${Math.abs(task.daysUntil)}d`
                 : isToday   ? 'Danas'
                 : task.daysUntil === 1 ? 'Sutra'
                 : `Za ${task.daysUntil} dana`;

  const dueLabelColor = isOverdue ? '#ef4444' : isToday ? '#16a34a' : '#6b7280';

  const handleClick = () => {
    navigate(`/batches?regal=${task.regal}&slot=${slot}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleClick()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: '16px',
        border: `2px solid ${isOverdue ? '#ef4444' : borderColor}`,
        background: isOverdue ? '#fef2f2' : bgColor,
        boxShadow: hover
          ? `0 12px 32px ${isOverdue ? 'rgba(239,68,68,.2)' : isNext ? 'rgba(22,163,74,.18)' : 'rgba(217,119,6,.15)'}, 0 4px 12px rgba(0,0,0,.08)`
          : '0 2px 8px rgba(0,0,0,.06)',
        transform: hover ? 'translateY(-4px)' : 'none',
        transition: 'transform .18s ease, box-shadow .18s ease',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Top accent bar — shows priority color */}
      <div style={{
        height: '5px',
        background: isOverdue ? '#ef4444' : accentColor,
      }} />

      {/* Inner content */}
      <div style={{ padding: '16px 18px 18px' }}>
        {/* Location row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[`R${task.regal}`, `P${task.shelf}`, `T${task.trayNum}`].map(l => (
              <span key={l} style={{
                fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '8px',
                background: `${task.cropColor}22`, color: task.cropColor,
                border: `1px solid ${task.cropColor}33`,
              }}>{l}</span>
            ))}
          </div>
          {/* Priority badge */}
          <span style={{
            fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '99px',
            background: isOverdue ? '#fca5a5' : isNext ? '#bbf7d0' : '#fde68a',
            color: isOverdue ? '#b91c1c' : isNext ? '#14532d' : '#78350f',
          }}>
            {isOverdue ? '!' : isNext ? '→' : '…'}
          </span>
        </div>

        {/* Crop name */}
        <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>
          {task.cropName}
        </p>

        {/* Task type icon + label */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 14px', borderRadius: '12px',
          background: task.typeBg,
          border: `1px solid ${task.typeColor}22`,
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>{task.icon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: task.typeColor }}>{task.action}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: task.typeColor, opacity: 0.7 }}>
              Dan {task.phaseLabel !== task.action ? task.phaseLabel : '—'}
            </p>
          </div>
        </div>

        {/* Due date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: dueLabelColor, fontWeight: 700 }}>
            {dueLabel}
          </span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            {task.due.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks legend ─────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', marginBottom:'32px' }}>
      {[
        { color:'#16a34a', bg:'#f0fdf4', border:'#16a34a', label:'Sljedeći korak (zeleno)' },
        { color:'#d97706', bg:'#fffbeb', border:'#d97706', label:'Korak nakon sljedećeg (žuto)' },
        { color:'#ef4444', bg:'#fef2f2', border:'#ef4444', label:'Kasno!' },
      ].map(({ color, bg, border, label }) => (
        <div key={label} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{
            width:'40px', height:'24px', borderRadius:'8px',
            background:bg, border:`2px solid ${border}`,
          }} />
          <span style={{ fontSize:'15px', color:'#6b7280' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Tasks page ──────────────────────────────────────────────────────────

function groupByDate(tasks) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate()+7);

  const overdue   = tasks.filter(t => t.daysUntil < 0);
  const todayT    = tasks.filter(t => t.daysUntil === 0);
  const tomorrowT = tasks.filter(t => t.daysUntil === 1);
  const thisWeek  = tasks.filter(t => t.daysUntil >= 2 && t.daysUntil <= 7);
  const later     = tasks.filter(t => t.daysUntil > 7);

  return { overdue, todayT, tomorrowT, thisWeek, later };
}

function Section({ title, emoji, tasks, emptyMsg, accent }) {
  if (tasks.length === 0) return null;
  const minCol = tasks.length <= 2 ? 360 : tasks.length <= 4 ? 320 : tasks.length <= 8 ? 300 : 280;
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' }}>
        <span style={{ fontSize:'22px' }}>{emoji}</span>
        <h3 style={{
          margin: 0, fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em',
          color: accent || '#374151',
        }}>{title}</h3>
        <div style={{
          padding:'4px 12px', borderRadius:'99px', fontSize:'13px', fontWeight:700,
          background: accent ? accent+'18' : '#f3f4f6',
          color: accent || '#374151',
        }}>{tasks.length}</div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        gap: '18px',
      }}>
        {tasks.map(t => <TaskBubble key={t.id} task={t} />)}
      </div>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);

  // Regenerate tasks on mount and on storage events
  const refresh = () => setTasks(generateTasks());
  useEffect(() => {
    refresh();
    // Re-read if user switches tabs (storage may have changed)
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const { overdue, todayT, tomorrowT, thisWeek, later } = groupByDate(tasks);
  const totalActive = tasks.filter(t => t.priority === 'next').length;

  if (tasks.length === 0) {
    return (
      <div className="p-10">
        <div className="page-header">
          <h2 className="page-title">Zadaci</h2>
        </div>
        <div className="empty-state">
          <p style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>📋</p>
          <p className="empty-state-text">Nema aktivnih plitice</p>
          <Link to="/batches" className="btn-primary">Plitice →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h2 className="page-title">Zadaci</h2>
        </div>
        <button onClick={refresh} title="Osvježi" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'40px', height:'40px', borderRadius:'12px', background:'#f3f4f6', border:'1px solid #e5e7eb', cursor:'pointer' }}>
          <RefreshIcon size={18} color="#6b7280" />
        </button>
      </div>

      <Section title="Kasno" emoji="🚨" tasks={overdue} accent="#ef4444" />
      <Section title="Danas" emoji="📍" tasks={todayT} accent="#16a34a" />
      <Section title="Sutra" emoji="📅" tasks={tomorrowT} accent="#0e7490" />
      <Section title="Ovaj Tjedan" emoji="📆" tasks={thisWeek} accent="#7c3aed" />
      <Section title="Kasnije" emoji="🗓" tasks={later} />
    </div>
  );
}
