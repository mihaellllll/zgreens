import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/client';

export default function Profitability() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/profitability').then(r => { setData(r.data); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[200px]">
      <span className="text-gray-400 text-[15px]">Loading…</span>
    </div>
  );

  const chartData = data.map(d => ({
    name: d.cropName,
    Revenue: Number(d.totalRevenue.toFixed(2)),
    Cost: Number(d.totalCost.toFixed(2)),
    Profit: Number(d.profit.toFixed(2)),
  }));

  return (
    <div className="p-4 md:p-10 h-full flex flex-col">
      <div className="page-header flex-shrink-0">
        <h2 className="page-title">Profitabilnost</h2>
      </div>

      {data.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No data yet. Add batches, costs, and sales to see profitability.</p>
        </div>
      ) : (
        <>
          <div className="card mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-5">Revenue vs Cost by Crop</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                <YAxis tick={{ fontSize: 14 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v, n) => [`$${v}`, n]} />
                <Legend />
                <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cost" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Crop</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Batches</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Revenue</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Cost</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Profit</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Margin %</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">ROI %</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Yield (g)</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.cropName} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium">{row.cropName}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{row.batchCount}</td>
                    <td className="px-5 py-4 text-right text-brand-600 font-medium">${row.totalRevenue.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right text-red-500">${row.totalCost.toFixed(2)}</td>
                    <td className={`px-5 py-4 text-right font-semibold ${row.profit >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                      ${row.profit.toFixed(2)}
                    </td>
                    <td className={`px-5 py-4 text-right ${row.margin >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {row.margin.toFixed(1)}%
                    </td>
                    <td className={`px-5 py-4 text-right ${row.roi >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
                      {row.roi.toFixed(1)}%
                    </td>
                    <td className="px-5 py-4 text-right text-gray-500">{row.totalYieldG > 0 ? `${row.totalYieldG.toFixed(0)}g` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
