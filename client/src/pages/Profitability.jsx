import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import api from '../api/client';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import StatCard from '../components/StatCard';

// ── Main Profitability ────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'week',  label: 'Tjedan' },
  { key: 'month', label: 'Mjesec' },
  { key: 'year',  label: 'Godina' },
  { key: 'all',   label: 'Sve'    },
];

function getPeriodDates(key) {
  const now = new Date();
  if (key === 'all') return {};
  if (key === 'week') {
    const d = new Date(now);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (key === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (key === 'year') {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  return {};
}

export default function Profitability() {
  const [data, setData]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState('month');
  const [mouse, setMouse]           = useState({ x: 0, y: 0 });
  const [chartHover, setChartHover] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);

  useEffect(() => {
    setLoading(true);
    const dates = getPeriodDates(period);
    const params = new URLSearchParams();
    if (dates.from) params.set('from', dates.from);
    if (dates.to)   params.set('to',   dates.to);
    const qs = params.toString();
    api.get(`/profitability${qs ? '?' + qs : ''}`)
      .then(r => {
        setData(r.data);
        // Keep selected crop if it still exists in new data, else default to first
        setSelectedCrop(prev =>
          r.data.find(d => d.cropName === prev) ? prev : (r.data[0]?.cropName ?? null)
        );
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <LoadingScreen />;

  // Aggregate totals
  const totalRevenue = data.reduce((s, d) => s + d.totalRevenue, 0);
  const totalCost    = data.reduce((s, d) => s + d.totalCost, 0);
  const totalProfit  = data.reduce((s, d) => s + d.profit, 0);

  // Single-crop chart data
  const cropRow = data.find(d => d.cropName === selectedCrop) || data[0] || null;
  const barData = cropRow ? [
    { metric: 'Prihod', value: Number(cropRow.totalRevenue.toFixed(2)), fill: '#4A7A5E' },
    { metric: 'Trošak', value: Number(cropRow.totalCost.toFixed(2)),    fill: '#C94B2A' },
    { metric: 'Profit', value: Number(cropRow.profit.toFixed(2)),       fill: cropRow.profit >= 0 ? '#C4914A' : '#C94B2A' },
  ] : [];

  return (
    <PageWrapper loading={loading}>
      {/* Header */}
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Profitabilnost</h2>
          <div className="page-subtitle">Analiza profita</div>
        </div>

        <div className="segmented-control">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`segmented-btn ${period === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="page-header-right">
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} strokeWidth={2} /> Analiza
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="empty-state flex-1">
          <div style={{ width: '64px', height: '64px', borderRadius: '28px', background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={28} color="#4A7A5E" />
          </div>
          <p className="empty-state-text">Nema podataka još. Dodaj plitice, troškove i prodaje za analizu profitabilnosti.</p>
        </div>
      ) : (
        <>
          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Ukupni Prihod" value={`€${totalRevenue.toFixed(2)}`} color="forest" icon={TrendingUp} />
            <StatCard label="Ukupni Trošak" value={`€${totalCost.toFixed(2)}`}    color="clay"   icon={TrendingUp} />
            <StatCard label="Neto Profit"   value={`€${totalProfit.toFixed(2)}`}  color={totalProfit >= 0 ? 'gold' : 'clay'} icon={TrendingUp} />
          </div>

          {/* Chart card */}
          <div
            className="card gsap-reveal mb-6"
            style={{ padding: '24px' }}
            onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
          >
            {/* Crop selector pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <span style={{
                fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                letterSpacing: '0.07em', color: 'var(--color-text-muted)', flexShrink: 0,
              }}>
                Usjev:
              </span>
              {data.map(d => {
                const active = d.cropName === (selectedCrop ?? cropRow?.cropName);
                return (
                  <button
                    key={d.cropName}
                    onClick={() => setSelectedCrop(d.cropName)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '99px',
                      fontSize: '13px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      background: active ? 'var(--color-forest-mid)' : 'var(--color-border)',
                      color: active ? '#fff' : 'var(--color-text-sec)',
                      boxShadow: active ? '0 4px 12px rgba(45,80,64,0.25)' : 'none',
                      transform: active ? 'translateY(-1px)' : 'none',
                    }}
                  >
                    {d.cropName}
                  </button>
                );
              })}
            </div>

            {/* Chart title */}
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: '#1A1A16', letterSpacing: '-0.01em' }}>
              {cropRow?.cropName}
              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '13px' }}>
                — Prihod, Trošak, Profit
              </span>
            </h3>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={barData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                barCategoryGap="40%"
                onMouseMove={d => d?.activePayload && setChartHover({ payload: d.activePayload, label: d.activeLabel })}
                onMouseLeave={() => setChartHover(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" vertical={false} />
                <XAxis
                  dataKey="metric"
                  tick={{ fontSize: 13, fill: '#6B6B60', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#A8A89A', fontFamily: '"IBM Plex Mono", monospace' }}
                  tickFormatter={v => `€${v}`}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={() => null} cursor={{ fill: 'rgba(26,46,34,0.04)', radius: 8 }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="gsap-reveal card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E0D5', background: '#FAFAF7' }}>
                    {[
                      { label: 'Usjev',    align: 'left'  },
                      { label: 'Plitice',  align: 'right' },
                      { label: 'Prihod',   align: 'right' },
                      { label: 'Trošak',   align: 'right' },
                      { label: 'Profit',   align: 'right' },
                      { label: 'Marža %',  align: 'right' },
                      { label: 'ROI %',    align: 'right' },
                      { label: 'Prinos g', align: 'right' },
                    ].map(({ label, align }) => (
                      <th key={label} style={{
                        padding: '14px 20px', textAlign: align,
                        fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: '#A8A89A',
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => {
                    const positive = row.profit >= 0;
                    const accentColor = positive ? '#4A7A5E' : '#C94B2A';
                    return (
                      <tr
                        key={row.cropName}
                        style={{
                          borderBottom: '1px solid #F5F2ED',
                          borderLeft: `4px solid ${accentColor}`,
                          transition: 'background 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedCrop(row.cropName)}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAF7'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        {/* Usjev */}
                        <td style={{ padding: '14px 20px', fontWeight: '700', fontSize: '14px', color: '#1A1A16' }}>
                          {row.cropName}
                        </td>

                        {/* Plitice */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 12px', borderRadius: '99px',
                            background: '#1A2E22', color: '#fff',
                            fontSize: '12px', fontWeight: '700',
                            fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.02em',
                          }}>
                            {row.batchCount}
                          </span>
                        </td>

                        {/* Prihod */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: '22px', fontWeight: '700', color: '#2D5040' }}>
                            €{row.totalRevenue.toFixed(2)}
                          </span>
                        </td>

                        {/* Trošak */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: '22px', fontWeight: '700', color: '#C94B2A' }}>
                            €{row.totalCost.toFixed(2)}
                          </span>
                        </td>

                        {/* Profit */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block', padding: '4px 12px', borderRadius: '99px',
                            background: positive ? 'rgba(45,80,64,0.10)' : 'rgba(201,75,42,0.10)',
                            fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic',
                            fontSize: '22px', fontWeight: '800',
                            color: positive ? '#1A2E22' : '#C94B2A',
                          }}>
                            {positive ? '+' : ''}€{row.profit.toFixed(2)}
                          </span>
                        </td>

                        {/* Marža % */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
                            background: row.margin >= 0 ? '#EAF0EC' : '#FEF0EC',
                            color: row.margin >= 0 ? '#2D5040' : '#C94B2A',
                            fontSize: '13px', fontWeight: '700', fontFamily: '"IBM Plex Mono", monospace',
                          }}>
                            {row.margin.toFixed(1)}%
                          </span>
                        </td>

                        {/* ROI % */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
                            background: row.roi >= 0 ? '#EAF0EC' : '#FEF0EC',
                            color: row.roi >= 0 ? '#2D5040' : '#C94B2A',
                            fontSize: '13px', fontWeight: '700', fontFamily: '"IBM Plex Mono", monospace',
                          }}>
                            {row.roi.toFixed(1)}%
                          </span>
                        </td>

                        {/* Prinos g */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: '700', color: '#6B6B60', fontSize: '14px' }}>
                            {row.totalYieldG > 0 ? (
                              <>{row.totalYieldG.toFixed(0)}<span style={{ fontSize: '11px', color: '#A8A89A', marginLeft: '2px' }}>g</span></>
                            ) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Mouse-following tooltip */}
      {chartHover && (
        <div style={{
          position: 'fixed', left: 0, top: 0,
          transform: `translate(${mouse.x + 18}px, ${mouse.y - 90}px)`,
          pointerEvents: 'none', zIndex: 9999,
          background: '#1A2E22', borderRadius: '20px',
          padding: '12px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.30)',
          minWidth: 140, transition: 'transform 0.06s ease-out',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.55)' }}>
            {chartHover.label}
          </p>
          {chartHover.payload.map((p, i) => (
            <p key={i} style={{ margin: '3px 0', fontSize: '14px', fontWeight: '700', color: p.payload?.fill ?? '#fff' }}>
              {p.payload?.metric}: €{Number(p.value).toFixed(2)}
            </p>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
