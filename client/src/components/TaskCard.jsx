import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, X, Calendar, MapPin, ArrowRight, Check } from 'lucide-react';
import { TASK_META, cleanTaskTitle } from '../utils/farmLogic';
import { getCropColor } from '../data/cropData';

export default function TaskCard({ task, onToggle, onDelete, compact = false }) {
  const [hover, setHover]       = useState(false);
  const [toggling, setToggling] = useState(false);
  const [pendingDel, setPendingDel] = useState(false);
  const navigate = useNavigate();

  const due  = new Date(task.dueDate);
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  const isOverdue = diffDays < 0 && !task.completed;
  const isToday   = diffDays === 0;

  const dueLabel = task.completed ? 'Dovršeno'
                 : isOverdue      ? `Kasno ${Math.abs(diffDays)} dana`
                 : isToday        ? 'Danas'
                 : diffDays === 1 ? 'Sutra'
                 :                  `Za ${diffDays} dana`;

  const meta         = TASK_META[task.type] || TASK_META.custom;
  const cropName     = task.batch?.cropType?.name || task.cropName;
  const displayTitle = cleanTaskTitle(task.title, cropName, task.type);
  const isManual     = task.type === 'manual' || task.type === 'custom';

  const themeColor = task.batch?.cropType?.id
    ? getCropColor(task.batch.cropType.id).color
    : (task.cropColor || meta.accent);

  const accentColor = task.completed ? '#A8A89A'
    : isOverdue     ? '#C94B2A'
    :                 themeColor;

  const handleToggle = async e => {
    e.stopPropagation();
    if (toggling || !onToggle) return;
    setToggling(true);
    await onToggle(task.id, !task.completed);
    setToggling(false);
  };

  const handleClick = () => {
    if (!task.batchId) return;
    const loc = task.trayLocations?.[0];
    if (loc?.regalId != null && loc?.slot != null) {
      navigate(`/batches?regal=${loc.regalId}&highlight=${loc.slot}`);
    } else {
      navigate('/batches');
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleClick()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPendingDel(false); }}
      className="gsap-reveal"
      style={{
        position: 'relative',
        borderRadius: '24px',
        padding: compact ? '18px 20px 16px' : '22px 24px 18px',
        background: task.completed
          ? 'rgba(249, 248, 246, 0.82)'
          : 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${hover && !task.completed
          ? `${accentColor}35`
          : 'rgba(255,255,255,0.55)'}`,
        boxShadow: hover
          ? `0 20px 48px rgba(26,46,34,0.10), 0 6px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)`
          : `0 2px 16px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.8)`,
        transform: hover ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.25s ease',
        cursor: task.batchId ? 'pointer' : 'default',
        opacity: task.completed ? 0.72 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '3px',
        height: '100%',
        background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}55 100%)`,
        opacity: task.completed ? 0.2 : hover ? 0.9 : 0.5,
        transition: 'opacity 0.3s ease',
      }} />

      {/* ── HEADER ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '8px',
        paddingLeft: '12px',
        marginBottom: '12px',
      }}>
        {/* Left: urgent dot + crop chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
          {isOverdue && !task.completed && (
            <span className="task-pulse-dot" />
          )}
          {cropName && !isManual && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '99px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              background: task.completed ? '#F0EDE8' : `${accentColor}14`,
              color: task.completed ? '#A8A89A' : accentColor,
              border: `1px solid ${task.completed ? 'transparent' : `${accentColor}22`}`,
              flexShrink: 0,
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: task.completed ? '#A8A89A' : accentColor,
                flexShrink: 0,
              }} />
              {cropName}
            </span>
          )}
        </div>

        {/* Right: delete + checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {isManual && onDelete && !task.completed && (
            pendingDel ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(task.id); setPendingDel(false); }}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: 'none', background: '#C94B2A', color: '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(201,75,42,0.35)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <Check size={13} strokeWidth={2.5} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setPendingDel(false); }}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: '1px solid var(--color-border)', background: 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setPendingDel(true); }}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: 'none', background: 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#C94B2A',
                  opacity: hover ? 0.45 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )
          )}

          {onToggle && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: task.completed ? 'var(--color-forest-mid)' : 'var(--color-border)',
                transition: 'transform 0.15s ease, color 0.2s ease',
                transform: toggling ? 'scale(0.82)' : 'scale(1)',
              }}
            >
              {task.completed
                ? <CheckCircle size={24} strokeWidth={1.5} fill="var(--color-forest-subtle)" />
                : <Circle size={24} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────── */}
      <div style={{ paddingLeft: '12px', marginBottom: '14px' }}>
        <h4 style={{
          margin: 0,
          fontSize: compact ? '21px' : '24px',
          fontFamily: '"Cormorant Garamond", "Georgia", serif',
          fontWeight: 700,
          fontStyle: 'italic',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: task.completed ? 'var(--color-text-muted)'
               : isOverdue     ? '#C94B2A'
               :                  'var(--color-forest-dark)',
          textDecoration: task.completed ? 'line-through' : 'none',
          opacity: task.completed ? 0.6 : 1,
        }}>
          {displayTitle}
        </h4>

        {/* Location pills */}
        {!isManual && task.trayLocations?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
            {task.trayLocations.map((loc, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 9px',
                borderRadius: '99px',
                fontSize: '10px',
                fontWeight: 600,
                color: task.completed ? 'var(--color-text-muted)' : 'var(--color-text-sec)',
                background: task.completed ? '#F5F3EE' : 'rgba(45,80,64,0.07)',
                border: `1px solid ${task.completed ? 'var(--color-border)' : 'rgba(45,80,64,0.13)'}`,
              }}>
                <MapPin size={9} strokeWidth={1.5} />
                {loc.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER ────────────────────────────────────── */}
      <div style={{
        paddingLeft: '12px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(229,224,213,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={11} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.03em',
              lineHeight: 1.2,
            }}>
              {due.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              lineHeight: 1.2,
              color: isOverdue ? '#C94B2A'
                   : isToday   ? 'var(--color-forest-mid)'
                   :              'var(--color-text-sec)',
            }}>
              {dueLabel}
            </span>
          </div>
        </div>

        {task.batchId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--color-forest-mid)',
            opacity: hover ? 1 : 0,
            transform: hover ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}>
            Detalji <ArrowRight size={11} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
