import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export default function Modal({ title, onClose, children, maxWidth = '520px' }) {
  const overlayRef = useRef(null);
  const panelRef   = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Entrance animation
  useGSAP(() => {
    if (!overlayRef.current || !panelRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
    gsap.fromTo(panelRef.current,
      { opacity: 0, y: 24, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out', delay: 0.05 }
    );
  }, {});

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      style={{ background: 'rgba(26,46,34,0.45)', backdropFilter: 'blur(6px)' }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={e => e.stopPropagation()}
        style={{
          background:   '#ffffff',
          borderRadius: '32px',
          boxShadow:    '0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
          width:        '100%',
          maxWidth:     maxWidth,
          transition:   'max-width 0.4s cubic-bezier(0.4,0,0.2,1)',
          maxHeight:    '90vh',
          display:      'flex',
          flexDirection:'column',
          overflow:     'hidden',
          border:       '1px solid rgba(229,224,213,0.8)',
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '22px 24px 20px',
          borderBottom:   '1px solid #E5E0D5',
          flexShrink:     0,
          position:       'relative',
        }}>
          <h2 id="modal-title" style={{
            margin:        0,
            fontSize:      '18px',
            fontWeight:    '700',
            color:         '#1A1A16',
            letterSpacing: '-0.02em',
            flex: 1,
            textAlign: 'center',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Zatvori"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          '32px',
              height:         '32px',
              borderRadius: '28px',
              background:     'transparent',
              border:         'none',
              cursor:         'pointer',
              color:          '#A8A89A',
              transition:     'all 0.15s ease',
              flexShrink:     0,
              position: 'absolute',
              right: '24px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#F0EDE8';
              e.currentTarget.style.color = '#1A1A16';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#A8A89A';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding:    '24px',
          overflowY:  'auto',
          flex:       1,
          fontSize:   '14px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#E5E0D5 transparent',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
