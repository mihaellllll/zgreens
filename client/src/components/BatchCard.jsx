const STATUS_COLORS = {
  germinating: 'badge-gold',
  blackout:    'badge-muted',
  growing:     'badge-forest',
  harvested:   'badge-forest', // Or custom blue
  failed:      'badge-clay',
};

export default function BatchCard({ batch, onClick }) {
  const harvestDate = new Date(batch.expectedHarvestDate);
  const today = new Date();
  const daysLeft = Math.ceil((harvestDate - today) / (1000 * 60 * 60 * 24));
  const totalCost = batch.costs?.reduce((s, c) => s + c.amount, 0) || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="card gsap-reveal"
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-text)' }}>
            {batch.cropType?.name}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-sec)' }}>
            {batch.trayCount} tray{batch.trayCount !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`badge ${STATUS_COLORS[batch.status] || 'badge-muted'}`}>
          {batch.status}
        </span>
      </div>
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-sec)', fontWeight: '500' }}>
        <span>Posijano: {new Date(batch.sowDate).toLocaleDateString()}</span>
        {batch.status !== 'harvested' && batch.status !== 'failed' && (
          <span style={{ color: daysLeft <= 2 ? 'var(--color-clay)' : 'inherit', fontWeight: daysLeft <= 2 ? '700' : '500' }}>
            {daysLeft > 0 ? `${daysLeft}d do berbe` : 'Berba!'}
          </span>
        )}
      </div>
      {totalCost > 0 && (
        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
          Trošak: €{totalCost.toFixed(2)}
        </p>
      )}
    </div>
  );
}
