import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CROP_RECIPES } from '../data/cropData';
import { TrashIcon, XIcon } from '../components/Icons';

const HARVESTS_KEY = 'zgreens_harvests';

function loadHarvests() {
  try {
    return JSON.parse(localStorage.getItem(HARVESTS_KEY) || '[]')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch {
    return [];
  }
}

function harvestKey(h) {
  return `${h.date}-${h.cropKey}-${h.regal}-${h.shelf}-${h.tray}`;
}

export default function Harvests() {
  const [harvests, setHarvests]         = useState(loadHarvests);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const deleteHarvest = h => {
    const key = harvestKey(h);
    if (pendingDelete !== key) { setPendingDelete(key); return; }
    const all = JSON.parse(localStorage.getItem(HARVESTS_KEY) || '[]');
    const idx = all.findIndex(r =>
      r.cropKey === h.cropKey && r.date === h.date &&
      r.regal === h.regal && r.shelf === h.shelf && r.tray === h.tray
    );
    if (idx !== -1) all.splice(idx, 1);
    localStorage.setItem(HARVESTS_KEY, JSON.stringify(all));
    setHarvests(all.slice().sort((a, b) => new Date(b.date) - new Date(a.date)));
    setPendingDelete(null);
  };

  const clearAll = () => {
    localStorage.setItem(HARVESTS_KEY, '[]');
    setHarvests([]);
    setConfirmClearAll(false);
  };

  // Aggregate stats
  const totalYield = harvests.reduce((s, h) => s + (h.yieldG || 0), 0);
  const withYield  = harvests.filter(h => h.yieldG > 0);
  const avgYield   = withYield.length ? Math.round(totalYield / withYield.length) : 0;

  const cropCounts = {};
  harvests.forEach(h => { cropCounts[h.cropName] = (cropCounts[h.cropName] || 0) + 1; });
  const topCrop = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return (
    <div className="p-10 h-full flex flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="page-title">Evidencija Berbi</h2>
        </div>
        {harvests.length > 0 && (
          confirmClearAll ? (
            <span className="flex items-center gap-2">
              <button onClick={clearAll} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'40px', height:'40px', borderRadius:'12px', background:'#ef4444', border:'none', cursor:'pointer' }} title="Potvrdi brisanje">
                <TrashIcon size={18} color="#fff" />
              </button>
              <button onClick={() => setConfirmClearAll(false)} className="btn-secondary">✕</button>
            </span>
          ) : (
            <button onClick={() => setConfirmClearAll(true)} title="Obriši sve" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'40px', height:'40px', borderRadius:'12px', background:'#fef2f2', border:'1px solid #fca5a530', cursor:'pointer' }}>
              <TrashIcon size={18} color="#ef4444" />
            </button>
          )
        )}
      </div>

      {harvests.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>✂️</p>
          <p className="empty-state-text">Nema zabilježenih berbi</p>
          <Link to="/batches" className="btn-primary">Plitice →</Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-5 mb-8 flex-shrink-0">
            <div className="card text-center">
              <p className="text-3xl font-bold text-brand-600">{harvests.length}</p>
              <p className="text-sm text-gray-500 mt-1">Ukupno berbi</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-brand-600">{totalYield}g</p>
              <p className="text-sm text-gray-500 mt-1">
                Ukupni prinos{avgYield > 0 && <span className="text-gray-400"> · prosj. {avgYield}g</span>}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-brand-600 truncate">{topCrop}</p>
              <p className="text-sm text-gray-500 mt-1">Najčešći usjev</p>
            </div>
          </div>

          {/* Per-crop summary */}
          {Object.keys(cropCounts).length > 1 && (
            <div className="flex gap-3 flex-wrap mb-6 flex-shrink-0">
              {Object.entries(cropCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => {
                  const crop = CROP_RECIPES.find(c => c.name === name);
                  const yieldForCrop = harvests
                    .filter(h => h.cropName === name)
                    .reduce((s, h) => s + (h.yieldG || 0), 0);
                  return (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 14px', borderRadius: '12px',
                      background: crop ? `${crop.color}12` : '#f3f4f6',
                      border: `1.5px solid ${crop ? crop.color + '33' : '#e5e7eb'}`,
                    }}>
                      {crop && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: crop.color, flexShrink: 0 }} />}
                      <span style={{ fontWeight: 700, fontSize: '14px', color: crop ? crop.color : '#374151' }}>{name}</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>{count}× · {yieldForCrop}g</span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden p-0 flex-1">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Datum</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Usjev</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Lokacija</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Prinos</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {harvests.map((h, i) => {
                  const crop = CROP_RECIPES.find(c => c.key === h.cropKey);
                  const key  = harvestKey(h);
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-4 text-gray-600">
                        {new Date(h.date).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {crop && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: crop.color, flexShrink: 0 }} />}
                          <span className="font-medium">{h.cropName}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex gap-1 flex-wrap">
                          {[`R${h.regal}`, `P${h.shelf}`, `T${h.tray}`].map(l => (
                            <span key={l} style={{
                              fontSize: '12px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
                              background: crop ? `${crop.color}18` : '#f3f4f6',
                              color: crop ? crop.color : '#6b7280',
                            }}>{l}</span>
                          ))}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-brand-600">
                        {h.yieldG > 0
                          ? `${h.yieldG}g`
                          : <span className="text-gray-400 font-normal">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {pendingDelete === key ? (
                          <span className="flex items-center gap-2 justify-end">
                            <button onClick={() => deleteHarvest(h)} title="Potvrdi" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'32px', height:'32px', borderRadius:'8px', background:'#fef2f2', border:'none', cursor:'pointer' }}>
                              <TrashIcon size={14} color="#ef4444" />
                            </button>
                            <button onClick={() => setPendingDelete(null)} title="Odustani" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'32px', height:'32px', borderRadius:'8px', background:'#f3f4f6', border:'none', cursor:'pointer' }}>
                              <XIcon size={14} color="#6b7280" />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => setPendingDelete(key)} title="Obriši" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'32px', height:'32px', borderRadius:'8px', background:'transparent', border:'none', cursor:'pointer', marginLeft:'auto' }}>
                            <TrashIcon size={14} color="#d1d5db" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
