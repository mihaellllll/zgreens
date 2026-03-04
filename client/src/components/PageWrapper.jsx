import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export function LoadingScreen({ label = 'Učitavanje...' }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '300px', gap: '14px',
    }}>
      <div
        className="animate-spin"
        style={{
          width: '34px', height: '34px', borderRadius: '50%',
          border: '3px solid #EAF0EC', borderTopColor: '#2D5040',
        }}
      />
      <p style={{ color: '#A8A89A', fontSize: '13px', fontWeight: '500', margin: 0 }}>{label}</p>
    </div>
  );
}

/**
 * PageWrapper — wraps every page and runs a staggered GSAP entrance animation.
 * Children should use the CSS class "gsap-reveal" if they want to be animated.
 * Falls back gracefully if GSAP isn't loaded.
 */
export default function PageWrapper({ children, className = '' }) {
  const containerRef = useRef(null);

  useGSAP(() => {
    const targets = containerRef.current?.querySelectorAll('.gsap-reveal');
    if (!targets || targets.length === 0) return;

    gsap.fromTo(
      targets,
      { opacity: 0, y: 24, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      }
    );
  }, { scope: containerRef });

  return (
    <div
      ref={containerRef}
      className={`p-4 md:p-10 min-h-full flex flex-col ${className}`}
    >
      {children}
    </div>
  );
}
