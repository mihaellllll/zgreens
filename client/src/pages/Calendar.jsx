import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import { useIsMobile } from '../hooks/useIsMobile';
import Modal from '../components/Modal';
import TaskCard from '../components/TaskCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_HR   = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
const MONTHS_HR = ['Siječanj','Veljača','Ožujak','Travanj','Svibanj','Lipanj',
                   'Srpanj','Kolovoz','Rujan','Listopad','Studeni','Prosinac'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function EventChip({ event }) {
  if (!event.task) return null;

  return (
    <div style={{ marginBottom: '8px' }}>
      <TaskCard 
        task={event.task} 
        compact 
        // Only allow toggle for real tasks (not virtual projections)
        onToggle={event.task.isVirtual ? null : undefined} 
      />
    </div>
  );
}

// ── Weekly view ───────────────────────────────────────────────────────────────

function WeeklyView({ events, weekStart }) {
  const isMobile = useIsMobile();
  const todayStr = toDateStr(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDay = {};
  events.forEach(e => {
    if (!byDay[e.dateStr]) byDay[e.dateStr] = [];
    byDay[e.dateStr].push(e);
  });

  // Mobile: vertical list showing all 7 days stacked
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {days.map((d, i) => {
          const ds    = toDateStr(d);
          const evts  = byDay[ds] || [];
          const today = ds === todayStr;
          return (
            <div key={i} style={{
              borderRadius: '20px', padding: '10px 16px',
              background: today ? '#F4F9F6' : '#ffffff',
              border: `1px solid ${today ? 'rgba(45, 80, 64, 0.25)' : '#E5E0D5'}`,
              boxShadow: today ? '0 4px 16px rgba(45, 80, 64, 0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: evts.length ? '8px' : 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                  background: today ? '#1A2E22' : '#F0EDE8',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '7px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: today ? 'rgba(255,255,255,0.7)' : '#A8A89A', lineHeight: 1 }}>{DAYS_HR[i]}</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', color: today ? '#fff' : '#1A1A16', lineHeight: 1 }}>{d.getDate()}</div>
                </div>
                {evts.length === 0 && (
                  <span style={{ fontSize: '13px', color: '#D5D0C5', fontStyle: 'italic' }}>Slobodan dan</span>
                )}
              </div>
              {evts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {evts.map((e, j) => <EventChip key={j} event={e} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop: 7-column grid
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '16px', minHeight: '384px', height: '100%' }}>
      {days.map((d, i) => {
        const ds    = toDateStr(d);
        const evts  = byDay[ds] || [];
        const today = ds === todayStr;
        return (
          <div key={i} style={{
            borderRadius: '24px', padding: '12px 10px',
            background: today ? '#F4F9F6' : '#ffffff',
            border: `1px solid ${today ? 'rgba(45, 80, 64, 0.25)' : '#E5E0D5'}`,
            boxShadow: today ? '0 8px 24px rgba(45, 80, 64, 0.08)' : '0 4px 12px rgba(0,0,0,0.02)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: `1px solid ${today ? 'rgba(45, 80, 64, 0.15)' : '#F0EDE8'}`, paddingBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: today ? '#2D5040' : '#A8A89A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {DAYS_HR[i]}
              </div>
              <div style={{
                fontSize: '22px', fontWeight: '800',
                fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic',
                color: today ? '#1A2E22' : '#1A1A16',
                marginTop: '3px', lineHeight: 1
              }}>{d.getDate()}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {evts.map((e, j) => <EventChip key={j} event={e} />)}
              {evts.length === 0 && (
                <div style={{ textAlign: 'center', color: '#D5D0C5', fontSize: '13px', fontStyle: 'italic', marginTop: '16px' }}>
                  Slobodan dan
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly view ──────────────────────────────────────────────────────────────

function MonthlyView({ events, year, month }) {
  const todayStr  = toDateStr(new Date());
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const startDow  = firstDay.getDay();
  const startOffset = startDow === 0 ? 6 : startDow - 1;

  const byDay = {};
  events.forEach(e => {
    if (!byDay[e.dateStr]) byDay[e.dateStr] = [];
    byDay[e.dateStr].push(e);
  });

  const cells = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
        {DAYS_HR.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '11px', color: '#A8A89A',
            fontWeight: '700', padding: '4px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds    = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const evts  = byDay[ds] || [];
          const isToday = ds === todayStr;
          return (
            <div key={i} style={{
              minHeight: '76px', borderRadius: '28px', padding: '8px',
              background: isToday ? '#EAF0EC' : '#ffffff',
              border: `1px solid ${isToday ? '#2D5040' : '#E5E0D5'}`,
            }}>
              <div style={{
                fontSize: '13px', fontWeight: isToday ? '800' : '600',
                color: isToday ? '#1A2E22' : '#1A1A16', marginBottom: '4px',
              }}>{d}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {evts.slice(0, 3).map((e, j) => (
                  <div key={j} style={{
                    height: '5px', borderRadius: '99px',
                    background: e.isTask ? `repeating-linear-gradient(90deg, ${e.cropColor}, ${e.cropColor} 3px, transparent 3px, transparent 5px)` : e.cropColor,
                    opacity: e.isHarvest ? 1 : 0.55,
                  }} title={`${e.cropName} — ${e.phaseLabel}`} />
                ))}
                {evts.length > 3 && (
                  <div style={{ fontSize: '10px', color: '#A8A89A', fontWeight: '600', marginTop: '1px' }}>+{evts.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Yearly view ───────────────────────────────────────────────────────────────

function YearlyView({ events, year }) {
  const today = new Date();
  const byMonth = {};
  events.forEach(e => {
    if (e.date.getFullYear() !== year) return;
    const m = e.date.getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(e);
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {MONTHS_HR.map((name, m) => {
        const monthEvents = byMonth[m] || [];
        const harvests    = monthEvents.filter(e => e.isHarvest).length;
        const isCurrent   = today.getFullYear() === year && today.getMonth() === m;
        const crops       = [...new Map(monthEvents.map(e => [e.cropKey, e])).values()];

        return (
          <div key={m} style={{
            background: '#ffffff',
            border: `${isCurrent ? '2px' : '1px'} solid ${isCurrent ? '#2D5040' : '#E5E0D5'}`,
            borderRadius: '28px', padding: '16px',
            boxShadow: isCurrent ? '0 4px 16px rgba(42,80,64,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: isCurrent ? '#1A2E22' : '#1A1A16', marginBottom: '10px' }}>{name}</div>
            {monthEvents.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#A8A89A' }}>Nema aktivnosti</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {crops.slice(0, 6).map(e => (
                    <div key={e.cropKey} style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: e.cropColor,
                    }} title={e.cropName} />
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: '#6B6B60' }}>{monthEvents.length} događaja</div>
                {harvests > 0 && (
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#2D5040', marginTop: '4px' }}>
                    ✂ {harvests} {harvests === 1 ? 'berba' : 'berbi'}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────────

export default function Calendar() {
  const [view,      setView]    = useState('weekly');
  const [tasks,     setTasks]   = useState([]);
  const [loading,   setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [monthDate, setMonthDate] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [yearView, setYearView] = useState(() => new Date().getFullYear());

  useEffect(() => {
    api.get('/tasks')
      .then(res => setTasks(res.data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  const events = useMemo(() => {
    const TASK_COLORS = { watering: '#1D4E8A', harvest: '#C94B2A', manual: '#C4914A', custom: '#C4914A' };
    return tasks.map(t => {
      const d = new Date(t.dueDate);
      return {
        date:       d,
        dateStr:    toDateStr(d),
        cropKey:    t.batch?.cropType?.name || t.type || 'task',
        cropName:   t.batch?.cropType?.name || 'Zadatak',
        cropColor:  TASK_COLORS[t.type] || '#6B7280',
        phaseLabel: t.title,
        isHarvest:  t.type === 'harvest',
        isTask:     true,
        task:       t,
      };
    }).sort((a, b) => a.date - b.date);
  }, [tasks]);

  function navPrev() {
    if (view === 'weekly')       { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
    else if (view === 'monthly') setMonthDate(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
    else                         setYearView(y => y - 1);
  }

  function navNext() {
    if (view === 'weekly')       { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }
    else if (view === 'monthly') setMonthDate(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
    else                         setYearView(y => y + 1);
  }

  function navToday() {
    const n = new Date();
    setWeekStart(getWeekStart(n));
    setMonthDate({ year: n.getFullYear(), month: n.getMonth() });
    setYearView(n.getFullYear());
  }

  const endOfWeek = new Date(weekStart.getTime() + 6 * 86400000);
  const periodLabel =
    view === 'weekly'
      ? `${weekStart.getDate()} ${MONTHS_HR[weekStart.getMonth()]} — ${endOfWeek.getDate()} ${MONTHS_HR[endOfWeek.getMonth()]} ${weekStart.getFullYear()}`
      : view === 'monthly'
      ? `${MONTHS_HR[monthDate.month]} ${monthDate.year}`
      : `${yearView}`;

  if (loading) return <LoadingScreen />;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="gsap-reveal page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Kalendar</h2>
          <p className="page-subtitle">Pregled faza uzgoja i berbi</p>
        </div>

        {/* View toggle */}
        <div className="segmented-control">
          {[
            { key: 'weekly',  label: 'Tjedno'   },
            { key: 'monthly', label: 'Mjesečno' },
            { key: 'yearly',  label: 'Godišnje' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`segmented-btn ${view === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="gsap-reveal" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={navPrev} className="btn-icon">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A16', minWidth: '220px', textAlign: 'center' }}>
          {periodLabel}
        </span>
        <button onClick={navNext} className="btn-icon">
          <ChevronRight size={16} />
        </button>
        <button onClick={navToday} style={{
          padding: '6px 14px', borderRadius: '28px', fontSize: '12px', fontWeight: '700',
          background: '#EAF0EC', color: '#2D5040', border: '1px solid rgba(42,80,64,0.15)',
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}>
          Danas
        </button>
      </div>

      {/* Calendar body */}
      <div className="gsap-reveal" style={{ flex: 1, overflow: 'auto' }}>
        {view === 'weekly'  && <WeeklyView  events={events} weekStart={weekStart} />}
        {view === 'monthly' && <MonthlyView events={events} year={monthDate.year} month={monthDate.month} />}
        {view === 'yearly'  && <YearlyView  events={events} year={yearView} />}
      </div>
    </PageWrapper>
  );
}
