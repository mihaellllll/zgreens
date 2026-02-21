export default function StatCard({ label, value, sub, color = 'green' }) {
  const colors = {
    green: 'bg-brand-50/80 border-brand-200/80 text-brand-800',
    blue: 'bg-blue-50/80 border-blue-200/80 text-blue-800',
    yellow: 'bg-amber-50/80 border-amber-200/80 text-amber-800',
    amber: 'bg-amber-50/80 border-amber-200/80 text-amber-800',
    purple: 'bg-purple-50/80 border-purple-200/80 text-purple-800',
  };
  return (
    <div className={`rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md ${colors[color]}`}>
      <p className="text-sm font-semibold uppercase tracking-wider text-inherit/70">{label}</p>
      <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
      {sub && <p className="text-sm mt-0.5 text-inherit/60">{sub}</p>}
    </div>
  );
}
