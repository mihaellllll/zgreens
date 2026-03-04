import { useState, useEffect } from 'react';
import { RefreshCw, ClipboardList, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import Modal from '../components/Modal';
import TaskCard from '../components/TaskCard';

// ── Add Task Form ─────────────────────────────────────────────────────────────

function AddTaskForm({ onSave, onClose }) {
  const [title, setTitle]   = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/tasks', {
        title: title.trim(),
        dueDate,
        type: 'manual',
      });
      onSave(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="form-label">Naziv zadatka *</label>
        <input
          required autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input"
          placeholder="npr. Nazovi restoran Dubravkin Put"
        />
      </div>
      <div>
        <label className="form-label">Datum dospijeća</label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="input"
        />
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading || !title.trim()} className="btn-primary">
          {loading ? 'Spremanje…' : 'Dodaj Zadatak'}
        </button>
      </div>
    </form>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, tasks, accent, isMobile, onToggle, onDelete }) {
  if (tasks.length === 0) return null;
  const minCol = isMobile ? 260 : tasks.length <= 2 ? 340 : tasks.length <= 4 ? 300 : 280;
  return (
    <div className="gsap-reveal" style={{ marginBottom: '36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: accent || '#6B6B60' }}>{title}</h3>
        <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', background: accent ? `${accent}14` : '#F0EDE8', color: accent || '#6B6B60' }}>{tasks.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap: '12px' }}>
        {tasks.map(t => <TaskCard key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tasks() {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const isMobile = useIsMobile();

  const refresh = async () => {
    try {
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (taskId, completed) => {
    try {
      const { data: updatedTask } = await api.patch(`/tasks/${taskId}`, { completed });
      // Preserve enriched fields (trayLocations, currentPhase) that PATCH doesn't return
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...updatedTask, trayLocations: t.trayLocations, currentPhase: t.currentPhase }
        : t
      ));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDelete = async taskId => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleSave = task => {
    setTasks(prev => [task, ...prev]);
    setModal(false);
  };

  const handleClearCompleted = async () => {
    try {
      await api.delete('/tasks/completed');
      setTasks(prev => prev.filter(t => !t.completed));
    } catch (err) {
      console.error('Failed to clear completed tasks:', err);
    }
  };

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  if (loading) return <LoadingScreen />;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const activeTasks    = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const overdue  = activeTasks.filter(t => new Date(t.dueDate) < now);
  // Fix: compare date strings so tasks due "today" aren't missed due to time mismatches
  const todayT   = activeTasks.filter(t => new Date(t.dueDate).toDateString() === now.toDateString());
  const upcoming = activeTasks.filter(t => new Date(t.dueDate) > now && new Date(t.dueDate).toDateString() !== now.toDateString());

  return (
    <PageWrapper>
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Zadaci</h2>
          <div className="page-subtitle">
            {activeTasks.length} aktivnih zadataka
          </div>
        </div>
        <div className="page-header-right">
          <button onClick={() => setModal(true)} className="btn-primary" style={{ gap: '6px', fontSize: '13px', padding: '9px 14px' }}>
            <Plus size={15} strokeWidth={1.5} /> Novi Zadatak
          </button>
          <button onClick={refresh} className="btn-icon" title="Osvježi">
            <RefreshCw size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {activeTasks.length === 0 && (
        <div className="empty-state flex-1">
          <div style={{ width: 64, height: 64, borderRadius: 28, background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <ClipboardList size={28} color="#4A7A5E" />
          </div>
          <p className="empty-state-text">Svi zadaci su dovršeni! Odmaraj dok biljke rastu.</p>
          <button onClick={() => setModal(true)} className="btn-primary" style={{ marginTop: '8px', gap: '6px' }}>
            <Plus size={15} /> Novi Zadatak
          </button>
        </div>
      )}

      <Section title="Kasno"     tasks={overdue}       accent="#C94B2A" isMobile={isMobile} onToggle={handleToggle} onDelete={handleDelete} />
      <Section title="Danas"     tasks={todayT}        accent="#2D5040" isMobile={isMobile} onToggle={handleToggle} onDelete={handleDelete} />
      <Section title="Predstoji" tasks={upcoming}      accent="#C4914A" isMobile={isMobile} onToggle={handleToggle} onDelete={handleDelete} />

      {completedTasks.length > 0 && (
        <>
          <div className="gsap-reveal" style={{ display:'flex', justifyContent:'flex-end', marginBottom:'-20px' }}>
            <button
              onClick={handleClearCompleted}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'8px 18px', borderRadius:'99px',
                background:'#FEF0EC', border:'1px solid rgba(201,75,42,0.2)',
                color:'#C94B2A', fontSize:'13px', fontWeight:'700',
                cursor:'pointer', transition:'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEE4DA'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FEF0EC'; }}
            >
              <Trash2 size={14} /> Obriši dovršene ({completedTasks.length})
            </button>
          </div>
          <Section title="Dovršeno" tasks={completedTasks} accent="#6B6B60" isMobile={isMobile} onToggle={handleToggle} onDelete={handleDelete} />
        </>
      )}

      {modal && (
        <Modal title="Novi Zadatak" onClose={() => setModal(false)}>
          <AddTaskForm onSave={handleSave} onClose={() => setModal(false)} />
        </Modal>
      )}
    </PageWrapper>
  );
}
