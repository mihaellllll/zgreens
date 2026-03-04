import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const VARIANTS = {
  forest: {
    bg:          'linear-gradient(135deg, #EAF0EC 0%, #d4e5da 100%)',
    border:      'rgba(42,80,64,0.15)',
    iconBg:      '#2D5040',
    iconColor:   '#ffffff',
    valueColor:  '#1A2E22',
    labelColor:  '#4A7A5E',
  },
  gold: {
    bg:          'linear-gradient(135deg, #FDF6EC 0%, #f5e8cc 100%)',
    border:      'rgba(196,145,74,0.20)',
    iconBg:      '#C4914A',
    iconColor:   '#ffffff',
    valueColor:  '#7A5520',
    labelColor:  '#9A6E2E',
  },
  clay: {
    bg:          'linear-gradient(135deg, #FDF0EC 0%, #f5d8cc 100%)',
    border:      'rgba(201,75,42,0.15)',
    iconBg:      '#C94B2A',
    iconColor:   '#ffffff',
    valueColor:  '#8B2510',
    labelColor:  '#A8351A',
  },
  slate: {
    bg:          'linear-gradient(135deg, #F5F4F1 0%, #ede9e3 100%)',
    border:      'rgba(0,0,0,0.08)',
    iconBg:      '#6B6B60',
    iconColor:   '#ffffff',
    valueColor:  '#1A1A16',
    labelColor:  '#6B6B60',
  },
  // legacy compat
  green:  null,
  blue:   null,
  yellow: null,
  amber:  null,
  purple: null,
};

// Resolve legacy color names to new variants
function resolveVariant(color) {
  if (color === 'green')  return VARIANTS.forest;
  if (color === 'blue')   return VARIANTS.slate;
  if (color === 'yellow' || color === 'amber') return VARIANTS.gold;
  if (color === 'purple') return VARIANTS.clay;
  return VARIANTS[color] || VARIANTS.forest;
}

function isNumeric(val) {
  if (typeof val === 'number') return true;
  if (typeof val === 'string') {
    const stripped = val.replace(/[$€£,\s]/g, '');
    return !isNaN(parseFloat(stripped)) && stripped !== '';
  }
  return false;
}

function extractNumber(val) {
  if (typeof val === 'number') return val;
  const stripped = String(val).replace(/[$€£,\s]/g, '');
  return parseFloat(stripped) || 0;
}

function formatValue(val, target) {
  if (typeof val !== 'string') return String(Math.round(target));
  const prefix = val.match(/^[$€£]/)?.[0] || '';
  const suffix = val.match(/[a-zA-Z%]+$/)?.[0] || '';
  const decimals = val.includes('.') ? (val.split('.')[1]?.replace(/[^0-9]/g, '').length || 0) : 0;
  return `${prefix}${target.toFixed(decimals)}${suffix}`;
}

export default function StatCard({ label, value, sub, color = 'forest', icon: Icon }) {
  const v = resolveVariant(color);
  const valueRef = useRef(null);
  const numeric  = isNumeric(value);

  // Count-up animation
  useEffect(() => {
    if (!numeric || !valueRef.current) return;
    const target = extractNumber(value);
    const obj    = { val: 0 };

    const tween = gsap.to(obj, {
      val:      target,
      duration: 1.2,
      ease:     'power2.out',
      delay:    0.2,
      onUpdate: () => {
        if (valueRef.current) {
          valueRef.current.textContent = formatValue(value, obj.val);
        }
      },
    });

    return () => tween.kill();
  }, [value, numeric]);

  return (
    <div
      className="gsap-reveal"
      style={{
        background:   v.bg,
        border:       `1px solid ${v.border}`,
        borderRadius: 'var(--radius-card)',
        padding:      '24px',
        boxShadow:    'var(--shadow-card)',
        transition:   'box-shadow var(--transition-medium), transform var(--transition-medium)',
        display:      'flex',
        flexDirection:'column',
        gap:          '4px',
        position:     'relative',
        overflow:     'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      {/* Decorative blob */}
      <div style={{
        position:     'absolute',
        top:          '-20px',
        right:        '-20px',
        width:        '80px',
        height:       '80px',
        borderRadius: '50%',
        background:   v.iconBg,
        opacity:      0.08,
      }} />

      {/* Icon */}
      {Icon && (
        <div style={{
          width:          '42px',
          height:         '42px',
          borderRadius:   '14px',
          background:     v.iconBg,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginBottom:   '12px',
          flexShrink:     0,
          boxShadow:      '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <Icon size={18} color={v.iconColor} strokeWidth={1.5} />
        </div>
      )}

      {/* Label */}
      <p style={{
        margin:        0,
        fontSize:      '11px',
        fontWeight:    '800',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color:         v.labelColor,
        opacity:       0.8,
      }}>
        {label}
      </p>

      {/* Value */}
      <p
        ref={numeric ? valueRef : undefined}
        style={{
          margin:      0,
          fontSize:    '34px',
          fontWeight:  '700',
          fontFamily:  '"Cormorant Garamond", serif',
          fontStyle:   'italic',
          color:       v.valueColor,
          lineHeight:  1,
          letterSpacing: '-0.02em',
        }}
      >
        {numeric ? '0' : value}
      </p>

      {sub && (
        <div style={{
          marginTop: '4px',
          fontSize: '12px',
          fontWeight: '600',
          color:    v.labelColor,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}
