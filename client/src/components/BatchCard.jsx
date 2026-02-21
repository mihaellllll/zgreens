const STATUS_COLORS = {
  germinating: 'bg-amber-100 text-amber-800',
  blackout: 'bg-gray-100 text-gray-700',
  growing: 'bg-brand-100 text-brand-800',
  harvested: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-700',
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
      className="card cursor-pointer hover:shadow-md hover:border-brand-200/80 transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{batch.cropType?.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{batch.trayCount} tray{batch.trayCount !== 1 ? 's' : ''}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[batch.status]}`}>
          {batch.status}
        </span>
      </div>
      <div className="mt-3 flex justify-between text-xs text-gray-500">
        <span>Sown: {new Date(batch.sowDate).toLocaleDateString()}</span>
        {batch.status !== 'harvested' && batch.status !== 'failed' && (
          <span className={daysLeft <= 2 ? 'text-red-600 font-medium' : ''}>
            {daysLeft > 0 ? `${daysLeft}d to harvest` : 'Due!'}
          </span>
        )}
      </div>
      {totalCost > 0 && (
        <p className="mt-2 text-xs text-gray-400">Cost: ${totalCost.toFixed(2)}</p>
      )}
    </div>
  );
}
