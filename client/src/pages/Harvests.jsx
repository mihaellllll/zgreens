import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, Trash2, X, Leaf, Pencil, Check } from 'lucide-react';
import { apiCropToRecipe } from '../data/cropData';
import { fetchHarvests, deleteHarvest, deleteAllHarvests, fetchRegalConfigs } from '../api/growRack';
import api from '../api/client';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import StatCard from '../components/StatCard';

const PERIODS = [
  { key: 'week',  label: 'Tjedan' },
  { key: 'month', label: 'Mjesec' },
  { key: 'year',  label: 'Godina' },
  { key: 'all',   label: 'Sve'    },
];

function filterByPeriod(items, period, dateField = 'date') {
  if (period === 'all') return items;
  const now = new Date();
  let from;
  if (period === 'week') {
    from = new Date(now);
    const dow = from.getDay();
    from.setDate(from.getDate() - (dow === 0 ? 6 : dow - 1));
    from.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
  }
  return items.filter(item => {
    const d = new Date(item[dateField] || item.createdAt);
    return d >= from;
  });
}

export default function Harvests() {
  const [harvests, setHarvests]               = useState([]);
  const [cropTypes, setCropTypes]             = useState([]);
  const [regalConfigs, setRegalConfigs]       = useState([]);
  const [inventory, setInventory]             = useState({});
  const [loading, setLoading]                 = useState(true);
  const [pendingDelete, setPendingDelete]     = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [period, setPeriod]                   = useState('all');
  const [editingId, setEditingId]             = useState(null);
  const [editYieldG, setEditYieldG]           = useState('');

  useEffect(() => {
    Promise.all([
      fetchHarvests().catch(() => []),
      api.get('/crops').catch(() => ({ data: [] })),
      api.get('/inventory').catch(() => ({ data: {} })),
      fetchRegalConfigs().catch(() => []),
    ]).then(([data, cropsRes, invRes, rcs]) => {
      setHarvests(data);
      setCropTypes(cropsRes.data);
      setInventory(invRes.data);
      setRegalConfigs(rcs);
    }).finally(() => setLoading(false));
  }, []);

  const getCropRecipe = name => {
    const ct = cropTypes.find(c => c.name === name);
    return ct ? apiCropToRecipe(ct, ct.id) : null;
  };

  const handleDelete = async h => {
    if (pendingDelete !== h.id) { setPendingDelete(h.id); return; }
    await deleteHarvest(h.id);
    setHarvests(prev => prev.filter(r => r.id !== h.id));
    setPendingDelete(null);
  };

  const startEdit = h => {
    setEditingId(h.id);
    setEditYieldG(String(h.yieldG || 0));
  };

  const saveEdit = async id => {
    try {
      const { data } = await api.patch(`/harvests/${id}`, { yieldG: Number(editYieldG) });
      setHarvests(prev => prev.map(h => h.id === id ? { ...h, yieldG: data.yieldG } : h));
    } catch {}
    setEditingId(null);
  };

  const clearAll = async () => {
    await deleteAllHarvests();
    setHarvests([]);
    setConfirmClearAll(false);
  };

  const filteredHarvests = filterByPeriod(harvests, period);
  const totalGrams = filteredHarvests.reduce((s, h) => s + (h.yieldG || 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const harvestsByCrop = {};
  filteredHarvests.forEach(h => {
    if (!harvestsByCrop[h.cropName]) {
      harvestsByCrop[h.cropName] = { totalYield: 0, dates: [], count: 0 };
    }
    harvestsByCrop[h.cropName].totalYield += (h.yieldG || 0);
    harvestsByCrop[h.cropName].dates.push(h.date);
    harvestsByCrop[h.cropName].count += 1;
  });

  const groupedDisplayCrops = Object.entries(harvestsByCrop);

  if (loading) return <LoadingScreen />;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Evidencija Berbi</h2>
          <div className="page-subtitle">Prinosi i skladište</div>
        </div>

        <div className="segmented-control">
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`segmented-btn ${period === key ? 'active' : ''}`}
            >{label}</button>
          ))}
        </div>

        <div className="page-header-right">
          {harvests.length > 0 && (
            confirmClearAll ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={clearAll} className="btn-danger" style={{ padding: '8px 14px', fontSize: '12px', gap: '5px' }}>
                  <Trash2 size={14} /> Potvrdi
                </button>
                <button onClick={() => setConfirmClearAll(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>
                  X
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="btn-icon"
                title="Obriši sve"
                style={{ background: '#FEF0EC', borderColor: 'rgba(201,75,42,0.15)' }}
              >
                <Trash2 size={16} strokeWidth={1.5} color="#C94B2A" />
              </button>
            )
          )}
        </div>
      </div>

      {filteredHarvests.length > 0 && (
        <div className="gsap-reveal grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <StatCard label="Ukupno Berbi" value={filteredHarvests.length} color="forest" icon={Scissors} />
          <StatCard label="Ukupni Prinos" value={`${totalGrams}g`} color="gold" icon={Leaf} />
        </div>
      )}

      {filteredHarvests.length === 0 ? (
        <div className="empty-state flex-1">
          <div style={{
            width: '64px', height: '64px', borderRadius: '28px',
            background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Scissors size={28} color="#4A7A5E" />
          </div>
          <p className="empty-state-text">Nema zabilježenih berbi. Uberi svoju prvu pliticu!</p>
          <Link to="/batches" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            Plitice
          </Link>
        </div>
      ) : (
        <>
          {/* Grouped Harvests by Crop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {groupedDisplayCrops
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([name, data]) => {
                const crop = getCropRecipe(name);
                const uniqueDates = [...new Set(data.dates)].sort((a, b) => new Date(b) - new Date(a));
                const available = inventory[name] || 0;
                
                return (
                  <div key={name} className="gsap-reveal card" style={{ padding: 24, borderTop: `4px solid ${crop ? crop.color : '#2D5040'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1A1A16' }}>{name}</h3>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '26px', fontWeight: '800', fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', color: crop ? crop.color : '#2D5040', display: 'block', lineHeight: 1 }}>
                          {data.totalYield}g
                        </span>
                        <span style={{ fontSize: '11px', color: '#A8A89A', fontWeight: 700 }}>UKUPNO UBRANO</span>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: available > 0 ? '#2D5040' : '#C94B2A', background: available > 0 ? '#EAF0EC' : '#FEF0EC', padding: '4px 10px', borderRadius: '99px' }}>
                        Dostupno za prodaju: {available}g
                      </span>
                    </div>

                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A8A89A' }}>
                        Zadnji datumi berbe
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {uniqueDates.slice(0, 5).map((date, idx) => (
                          <span key={idx} style={{ fontSize: '12px', padding: '2px 8px', background: '#F0EDE8', borderRadius: '4px', color: '#6B6B60', fontFamily: '"IBM Plex Mono", monospace' }}>
                            {new Date(date).toLocaleDateString('hr-HR')}
                          </span>
                        ))}
                        {uniqueDates.length > 5 && (
                          <span style={{ fontSize: '12px', color: '#A8A89A', padding: '2px 0' }}>i još {uniqueDates.length - 5}...</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {groupedDisplayCrops.length === 0 && (
              <div className="card col-span-full" style={{ padding: '20px', textAlign: 'center', color: '#A8A89A' }}>
                Nema berbi u ovom mjesecu.
              </div>
            )}
          </div>

          {/* Mobile harvest cards */}
          <div className="md:hidden flex flex-col gap-3 mb-4">
            {filteredHarvests.map(h => {
              const crop = getCropRecipe(h.cropName);
              const isPending = pendingDelete === h.id;
              const locationBadges = [
                regalConfigs.find(r => r.id === h.regal)?.name || `R${h.regal}`,
                `P${h.shelf}`,
                `T${h.tray}`,
              ];
              return (
                <div key={h.id} className="card" style={{ padding: '16px', background: isPending ? '#FFF5F2' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {crop && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: crop.color, flexShrink: 0 }} />}
                      <span style={{ fontWeight: '700', color: '#1A1A16', fontSize: '15px' }}>{h.cropName}</span>
                    </div>
                    <span style={{ color: '#6B6B60', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}>
                      {new Date(h.date).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {locationBadges.map(l => (
                        <span key={l} style={{
                          fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '5px',
                          background: crop ? `${crop.color}14` : '#F0EDE8',
                          color: crop ? crop.color : '#6B6B60',
                          fontFamily: '"IBM Plex Mono", monospace',
                        }}>{l}</span>
                      ))}
                    </div>
                    {editingId === h.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number" min="0" step="1"
                          value={editYieldG}
                          onChange={e => setEditYieldG(e.target.value)}
                          className="input"
                          style={{ width: '70px', padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(h.id); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <span style={{ fontSize: '12px', color: '#6B6B60' }}>g</span>
                        <button onClick={() => saveEdit(h.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: '#2D5040', border: 'none', cursor: 'pointer' }}>
                          <Check size={12} color="#fff" />
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: '#F0EDE8', border: 'none', cursor: 'pointer' }}>
                          <X size={12} color="#6B6B60" />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: '700', color: '#2D5040', fontFamily: '"IBM Plex Mono", monospace', fontSize: '14px' }}>
                        {h.yieldG > 0 ? `${h.yieldG}g` : <span style={{ color: '#A8A89A' }}>—</span>}
                      </span>
                    )}
                  </div>
                  {isPending ? (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleDelete(h)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#C94B2A', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={13} color="#ffffff" />
                      </button>
                      <button onClick={() => setPendingDelete(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#F0EDE8', border: 'none', cursor: 'pointer' }}>
                        <X size={13} color="#6B6B60" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button onClick={() => startEdit(h)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                        <Pencil size={13} color="#2D5040" />
                      </button>
                      <button onClick={() => handleDelete(h)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                        <Trash2 size={13} color="#C94B2A" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block gsap-reveal card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E0D5', background: '#FAFAF7' }}>
                  {['Datum', 'Usjev', 'Lokacija', 'Prinos', ''].map(h => (
                    <th key={h} style={{
                      padding: '14px 20px', textAlign: h === 'Prinos' ? 'right' : 'left',
                      fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
                      letterSpacing: '0.07em', color: '#A8A89A',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHarvests.map(h => {
                  const crop = getCropRecipe(h.cropName);
                  const isPending = pendingDelete === h.id;
                  return (
                    <tr key={h.id} style={{
                      borderBottom: '1px solid #F5F2ED',
                      background: isPending ? '#FFF5F2' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                      onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#FAFAF7'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isPending ? '#FFF5F2' : ''; }}
                    >
                      <td style={{ padding: '14px 20px', color: '#6B6B60', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}>
                        {new Date(h.date).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {crop && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: crop.color, flexShrink: 0 }} />}
                          <span style={{ fontWeight: '600', color: '#1A1A16' }}>{h.cropName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {[
                            regalConfigs.find(r => r.id === h.regal)?.name || `R${h.regal}`,
                            `P${h.shelf}`,
                            `T${h.tray}`,
                          ].map(l => (
                            <span key={l} style={{
                              fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '5px',
                              background: crop ? `${crop.color}14` : '#F0EDE8',
                              color: crop ? crop.color : '#6B6B60',
                              fontFamily: '"IBM Plex Mono", monospace',
                            }}>{l}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {editingId === h.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <input
                              type="number" min="0" step="1"
                              value={editYieldG}
                              onChange={e => setEditYieldG(e.target.value)}
                              className="input"
                              style={{ width: '80px', padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(h.id); if (e.key === 'Escape') setEditingId(null); }}
                            />
                            <span style={{ fontSize: '12px', color: '#6B6B60' }}>g</span>
                            <button onClick={() => saveEdit(h.id)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '50%',
                              background: '#2D5040', border: 'none', cursor: 'pointer',
                            }}>
                              <Check size={12} color="#fff" />
                            </button>
                            <button onClick={() => setEditingId(null)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '50%',
                              background: '#F0EDE8', border: 'none', cursor: 'pointer',
                            }}>
                              <X size={12} color="#6B6B60" />
                            </button>
                          </div>
                        ) : h.yieldG > 0
                          ? <span style={{ fontWeight: '700', color: '#2D5040', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px' }}>{h.yieldG}g</span>
                          : <span style={{ color: '#A8A89A' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {isPending ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleDelete(h)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '28px',
                              background: '#C94B2A', border: 'none', cursor: 'pointer',
                            }}>
                              <Trash2 size={13} color="#ffffff" />
                            </button>
                            <button onClick={() => setPendingDelete(null)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '28px',
                              background: '#F0EDE8', border: 'none', cursor: 'pointer',
                            }}>
                              <X size={13} color="#6B6B60" />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEdit(h)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '28px',
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              opacity: 0.7, transition: 'opacity 0.15s ease',
                            }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                            >
                              <Pencil size={13} color="#2D5040" />
                            </button>
                            <button onClick={() => handleDelete(h)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '28px',
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              opacity: 0.7, transition: 'opacity 0.15s ease',
                            }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                            >
                              <Trash2 size={13} color="#C94B2A" />
                            </button>
                          </div>
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
    </PageWrapper>
  );
}
