import { useEffect, useState } from 'react';
import { Plus, UserPlus, Trash2, X, ShoppingCart, Users, TrendingUp, CheckCircle, Clock, AlertCircle, Pencil } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import PageWrapper, { LoadingScreen } from '../components/PageWrapper';
import StatCard from '../components/StatCard';

// ── Add Customer Form ─────────────────────────────────────────────────────────

function AddCustomerForm({ onSave, onClose }) {
  const [form, setForm]   = useState({ name: '', email: '', phone: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/customers', form);
      onSave(res.data);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="form-label">Ime *</label>
        <input required value={form.name} onChange={f('name')} className="input" placeholder="Ime kupca" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Email</label>
          <input type="email" value={form.email} onChange={f('email')} className="input" />
        </div>
        <div>
          <label className="form-label">Telefon</label>
          <input value={form.phone} onChange={f('phone')} className="input" />
        </div>
      </div>
      <div>
        <label className="form-label">Bilješka</label>
        <textarea value={form.notes} onChange={f('notes')} className="input" style={{ height: '72px', resize: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Spremanje…' : 'Dodaj Kupca'}
        </button>
      </div>
    </form>
  );
}

// ── Edit Customer Form ────────────────────────────────────────────────────────

function EditCustomerForm({ customer, onSave, onClose }) {
  const [form, setForm]   = useState({ name: customer.name, email: customer.email || '', phone: customer.phone || '', notes: customer.notes || '' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.patch(`/customers/${customer.id}`, form);
      onSave(res.data);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="form-label">Ime *</label>
        <input required value={form.name} onChange={f('name')} className="input" placeholder="Ime kupca" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Email</label>
          <input type="email" value={form.email} onChange={f('email')} className="input" />
        </div>
        <div>
          <label className="form-label">Telefon</label>
          <input value={form.phone} onChange={f('phone')} className="input" />
        </div>
      </div>
      <div>
        <label className="form-label">Bilješka</label>
        <textarea value={form.notes} onChange={f('notes')} className="input" style={{ height: '72px', resize: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Spremanje…' : 'Spremi'}
        </button>
      </div>
    </form>
  );
}

// ── Add Sale Form ─────────────────────────────────────────────────────────────

function AddSaleForm({ customers, onSave, onClose, initial }) {
  const [date, setDate]           = useState(initial ? new Date(initial.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState(initial?.customerId ? String(initial.customerId) : '');
  const [notes, setNotes]         = useState(initial?.notes || '');
  const [priceMode, setPriceMode] = useState('perG');
  const [items, setItems]         = useState(
    initial?.items?.length > 0
      ? initial.items.map(i => ({ cropName: i.cropName || '', quantityG: String(i.quantityG || ''), pricePerG: String(i.pricePerG || ''), totalPrice: String(((i.quantityG || 0) * (i.pricePerG || 0)).toFixed(2)), batchId: i.batchId ? String(i.batchId) : '' }))
      : [{ cropName: '', quantityG: '', pricePerG: '', totalPrice: '', batchId: '' }]
  );
  const [inventory, setInventory] = useState({});
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    api.get('/inventory').then(r => setInventory(r.data));
  }, []);

  const updateItem = (i, key, val) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [key]: val };
      if (priceMode === 'total' && (key === 'totalPrice' || key === 'quantityG')) {
        const qty = Number(key === 'quantityG' ? val : updated.quantityG) || 0;
        const tot = Number(key === 'totalPrice' ? val : updated.totalPrice) || 0;
        updated.pricePerG = qty > 0 ? String((tot / qty).toFixed(4)) : '';
      }
      if (priceMode === 'perG' && (key === 'pricePerG' || key === 'quantityG')) {
        const qty = Number(key === 'quantityG' ? val : updated.quantityG) || 0;
        const ppg = Number(key === 'pricePerG' ? val : updated.pricePerG) || 0;
        updated.totalPrice = String((qty * ppg).toFixed(2));
      }
      return updated;
    }));
  };
  const addItem    = () => setItems(prev => [...prev, { cropName: '', quantityG: '', pricePerG: '', totalPrice: '', batchId: '' }]);
  const removeItem = i  => setItems(prev => prev.filter((_, idx) => idx !== i));

  const total = items.reduce((s, item) => s + (Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0), 0);

  const cropTotals = {};
  items.forEach(item => {
    if (item.cropName) cropTotals[item.cropName] = (cropTotals[item.cropName] || 0) + (Number(item.quantityG) || 0);
  });

  let hasError = false;
  const errors = {};
  Object.keys(cropTotals).forEach(crop => {
    const avail = inventory[crop] || 0;
    if (cropTotals[crop] > avail) { hasError = true; errors[crop] = `Samo ${avail}g dostupno.`; }
  });

  const submit = async e => {
    e.preventDefault();
    if (hasError) return;
    setLoading(true);
    try {
      const payload = {
        date, customerId: customerId || null, notes,
        items: items.map(item => ({
          ...item,
          subtotal: (Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0),
          batchId: item.batchId || null,
        })),
      };
      const res = initial?.id
        ? await api.put(`/sales/${initial.id}`, payload)
        : await api.post('/sales', payload);
      onSave(res.data);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="form-label">Kupac</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="input">
            <option value="">Bez kupca / Anonimno</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <label className="form-label" style={{ margin: 0 }}>Stavke</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', background: '#F5F3EF', borderRadius: '99px', padding: '2px', gap: '2px' }}>
              {[{ key: 'perG', label: '\u20AC/g' }, { key: 'total', label: '\u20AC ukupno' }].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setPriceMode(key)} style={{
                  padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: priceMode === key ? '#ffffff' : 'transparent',
                  color: priceMode === key ? '#1A2E22' : '#A8A89A',
                  boxShadow: priceMode === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={addItem} style={{
              fontSize: '12px', fontWeight: '700', color: '#2D5040', background: 'none',
              border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}>+ Dodaj stavku</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ border: '1.5px solid #E5E0D5', borderRadius: '28px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <select required value={item.cropName} onChange={e => updateItem(i, 'cropName', e.target.value)} className="input">
                  <option value="">Odaberi usjev</option>
                  {Object.keys(inventory)
                    .filter(name => inventory[name] > 0)
                    .sort()
                    .map(name => (
                      <option key={name} value={name}>{name} ({inventory[name]}g)</option>
                    ))}
                </select>
                {item.cropName && errors[item.cropName] && (
                  <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '4px', fontWeight: 'bold' }}>
                    {errors[item.cropName]}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input required type="number" min="0" step="0.1" placeholder="Kol. (g)"
                  value={item.quantityG} onChange={e => updateItem(i, 'quantityG', e.target.value)}
                  className="input" style={{ flex: 1 }} />
                {priceMode === 'perG' ? (
                  <input required type="number" min="0" step="0.01" placeholder="\u20AC/g"
                    value={item.pricePerG} onChange={e => updateItem(i, 'pricePerG', e.target.value)}
                    className="input" style={{ flex: 1 }} />
                ) : (
                  <input required type="number" min="0" step="0.01" placeholder="\u20AC ukupno"
                    value={item.totalPrice} onChange={e => updateItem(i, 'totalPrice', e.target.value)}
                    className="input" style={{ flex: 1 }} />
                )}
                <span style={{ fontSize: '13px', color: '#2D5040', fontWeight: '700', whiteSpace: 'nowrap', fontFamily: '"IBM Plex Mono", monospace' }}>
                  {'\u20AC'}{((Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0)).toFixed(2)}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    background: '#FEF0EC', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <X size={13} color="#C94B2A" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'right', fontSize: '14px', fontWeight: '800', color: '#1A2E22', marginTop: '10px', fontFamily: '"IBM Plex Mono", monospace' }}>
          Ukupno: €{total.toFixed(2)}
        </p>
      </div>

      <div>
        <label className="form-label">Bilješka</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Opcionalna bilješka" />
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading || hasError} className="btn-primary" style={{ opacity: (loading || hasError) ? 0.6 : 1 }}>
          {loading ? 'Spremanje…' : initial?.id ? `Spremi (€${total.toFixed(2)})` : `Dodaj Prodaju (€${total.toFixed(2)})`}
        </button>
      </div>
    </form>
  );
}

// ── Main Sales page ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'sales',     label: 'Prodaje',  Icon: ShoppingCart },
  { key: 'customers', label: 'Kupci',    Icon: Users        },
  { key: 'duguje',    label: 'Duguje',   Icon: AlertCircle  },
];

const PERIODS = [
  { key: 'week',  label: 'Tjedan' },
  { key: 'month', label: 'Mjesec' },
  { key: 'year',  label: 'Godina' },
  { key: 'all',   label: 'Sve'    },
];

function filterByPeriod(items, period) {
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
  return items.filter(s => new Date(s.date) >= from);
}

export default function Sales() {
  const [sales, setSales]           = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [tab, setTab]               = useState('sales');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState(null);
  const [period, setPeriod]         = useState('all');
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    Promise.all([api.get('/sales'), api.get('/customers')]).then(([s, c]) => {
      setSales(s.data);
      setCustomers(c.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleSaleSave     = sale     => {
    setSales(prev => {
      const idx = prev.findIndex(s => s.id === sale.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = sale; return next; }
      return [sale, ...prev];
    });
    setModal(null);
  };
  const handleCustomerSave = customer => { setCustomers(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name))); setModal(null); };
  const handleCustomerEdit = updated => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingCustomer(null);
  };
  const deleteCustomer = async id => {
    if (pendingDeleteCustomer !== id) { setPendingDeleteCustomer(id); return; }
    await api.delete(`/customers/${id}`);
    setCustomers(prev => prev.filter(c => c.id !== id));
    setPendingDeleteCustomer(null);
  };

  const deleteSale = async id => {
    if (pendingDelete !== id) { setPendingDelete(id); return; }
    await api.delete(`/sales/${id}`);
    setSales(prev => prev.filter(s => s.id !== id));
    setPendingDelete(null);
  };

  const togglePaid = async id => {
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    try {
      const { data } = await api.patch(`/sales/${id}`, { paid: !sale.paid });
      setSales(prev => prev.map(s => s.id === id ? { ...s, paid: data.paid } : s));
    } catch {}
  };

  const filteredSales   = filterByPeriod(sales, period);
  const totalRevenue    = filteredSales.reduce((s, sale) => s + sale.total, 0);
  const unpaidRevenue   = filteredSales.filter(s => !s.paid).reduce((s, sale) => s + sale.total, 0);
  const avgSale         = filteredSales.length ? totalRevenue / filteredSales.length : 0;

  // Outstanding (Duguje) grouped by customer
  const unpaidSales = sales.filter(s => !s.paid);
  const dugujeByCust = {};
  unpaidSales.forEach(sale => {
    const key = sale.customer?.id ?? 'anon';
    const name = sale.customer?.name || 'Anonimno';
    if (!dugujeByCust[key]) dugujeByCust[key] = { name, total: 0, saleCount: 0 };
    dugujeByCust[key].total += sale.total;
    dugujeByCust[key].saleCount += 1;
  });
  const dugujeList = Object.values(dugujeByCust).sort((a, b) => b.total - a.total);

  if (loading) return <LoadingScreen />;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">Prodaja</h2>
          <div className="page-subtitle">Kupci i prodaje</div>
        </div>

        <div className="segmented-control">
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`segmented-btn ${period === key ? 'active' : ''}`}
            >{label}</button>
          ))}
        </div>

        <div className="page-header-right">
          <button onClick={() => setModal('customer')} className="btn-secondary" style={{ gap: '6px', fontSize: '13px', padding: '9px 14px' }}>
            <UserPlus size={15} strokeWidth={1.5} /> Kupac
          </button>
          <button onClick={() => setModal('sale')} className="btn-primary" style={{ gap: '6px', fontSize: '13px', padding: '9px 14px' }}>
            <Plus size={15} strokeWidth={1.5} /> Prodaja
          </button>
        </div>
      </div>

      {/* Stats */}
      {sales.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Ukupno Prodaja"    value={filteredSales.length}                    color="forest" icon={ShoppingCart} />
          <StatCard label="Ukupni Prihod"     value={`€${totalRevenue.toFixed(2)}`}   color="gold"   icon={TrendingUp} />
          <StatCard label="Neplaćeno (Duguje)" value={`€${unpaidRevenue.toFixed(2)}`}  color="clay"   icon={AlertCircle} />
        </div>
      )}

      {/* Tabs */}
      <div className="gsap-reveal" style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #E5E0D5' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => { setTab(key); setPendingDelete(null); setPendingDeleteCustomer(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px', fontSize: '13px', fontWeight: '700',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === key ? '2px solid #1A2E22' : '2px solid transparent',
              color: tab === key ? '#1A2E22' : '#A8A89A',
              marginBottom: '-1px', transition: 'color 0.15s ease',
            }}
          >
            <Icon size={14} />
            {label}
            {key === 'duguje' && dugujeList.length > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: '800', background: '#FEF0EC', color: '#C94B2A' }}>
                {dugujeList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sales tab */}
      {tab === 'sales' && (
        filteredSales.length === 0 ? (
          <div className="empty-state flex-1">
            <div style={{ width: '64px', height: '64px', borderRadius: '28px', background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={28} color="#4A7A5E" />
            </div>
            <p className="empty-state-text">Nema prodaja još. Dodaj prvu prodaju!</p>
            <button onClick={() => setModal('sale')} className="btn-primary" style={{ marginTop: '8px', gap: '6px' }}>
              <Plus size={15} /> Prodaja
            </button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            {isMobile && <div className="flex flex-col gap-3 gsap-reveal">
              {filteredSales.map(sale => {
                const isPending = pendingDelete === sale.id;
                return (
                  <div key={sale.id} className="card" style={{ padding: '16px', background: isPending ? '#FFF5F2' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ color: '#6B6B60', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}>
                        {new Date(sale.date).toLocaleDateString('hr-HR')}
                      </span>
                      <span style={{ fontWeight: '600', color: '#1A1A16', fontSize: '14px' }}>
                        {sale.customer?.name || <span style={{ color: '#A8A89A', fontWeight: '400' }}>Anonimno</span>}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6B6B60', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sale.items?.map(i => `${i.cropName} (${i.quantityG}g)`).join(', ')}
                    </div>
                    {isPending ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => deleteSale(sale.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#C94B2A', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={13} color="#ffffff" />
                        </button>
                        <button onClick={() => setPendingDelete(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#F0EDE8', border: 'none', cursor: 'pointer' }}>
                          <X size={13} color="#6B6B60" />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => togglePaid(sale.id)} className={`badge ${sale.paid ? 'badge-forest' : 'badge-clay'}`} style={{ cursor: 'pointer', border: 'none' }}>
                            {sale.paid ? <><CheckCircle size={12} strokeWidth={1.5} /> Plaćeno</> : <><Clock size={12} strokeWidth={1.5} /> Duguje</>}
                          </button>
                          <span style={{ fontWeight: '700', color: '#1A2E22', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px' }}>€{sale.total.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => setModal(sale)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                            <Pencil size={13} color="#2D5040" />
                          </button>
                          <button onClick={() => setPendingDelete(sale.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                            <Trash2 size={13} color="#C94B2A" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}

            {/* Desktop table */}
            {!isMobile && <div className="gsap-reveal card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E0D5', background: '#FAFAF7' }}>
                    {['Datum', 'Kupac', 'Stavke', 'Status', 'Ukupno', ''].map(h => (
                      <th key={h} style={{
                        padding: '14px 20px', textAlign: h === 'Ukupno' ? 'right' : 'left',
                        fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: '#A8A89A',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(sale => {
                    const isPending = pendingDelete === sale.id;
                    return (
                      <tr key={sale.id} style={{
                        borderBottom: '1px solid #F5F2ED',
                        background: isPending ? '#FFF5F2' : undefined,
                        transition: 'background 0.15s ease',
                      }}
                        onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#FAFAF7'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isPending ? '#FFF5F2' : ''; }}
                      >
                        <td style={{ padding: '14px 20px', color: '#6B6B60', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}>
                          {new Date(sale.date).toLocaleDateString('hr-HR')}
                        </td>
                        <td style={{ padding: '14px 20px', fontWeight: '600', color: '#1A1A16' }}>
                          {sale.customer?.name || <span style={{ color: '#A8A89A', fontWeight: '400' }}>Anonimno</span>}
                        </td>
                        <td style={{ padding: '14px 20px', color: '#6B6B60', maxWidth: '200px' }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sale.items?.map(i => `${i.cropName} (${i.quantityG}g)`).join(', ')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <button
                            onClick={() => togglePaid(sale.id)}
                            title={sale.paid ? 'Označi kao neplaćeno' : 'Označi kao plaćeno'}
                            className={`badge ${sale.paid ? 'badge-forest' : 'badge-clay'}`}
                            style={{ cursor: 'pointer', border: 'none' }}
                          >
                            {sale.paid
                              ? <><CheckCircle size={12} strokeWidth={1.5} /> Plaćeno</>
                              : <><Clock size={12} strokeWidth={1.5} /> Duguje</>
                            }
                          </button>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '700', color: '#1A2E22', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px' }}>
                          €{sale.total.toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => deleteSale(sale.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#C94B2A', border: 'none', cursor: 'pointer' }}>
                                <Trash2 size={13} color="#ffffff" />
                              </button>
                              <button onClick={() => setPendingDelete(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#F0EDE8', border: 'none', cursor: 'pointer' }}>
                                <X size={13} color="#6B6B60" />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                              <button onClick={() => setModal(sale)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s ease' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                              >
                                <Pencil size={13} color="#2D5040" />
                              </button>
                              <button onClick={() => setPendingDelete(sale.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s ease' }}
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
            </div>}
          </>
        )
      )}

      {/* Customers tab */}
      {tab === 'customers' && (
        customers.length === 0 ? (
          <div className="empty-state flex-1">
            <div style={{ width: '64px', height: '64px', borderRadius: '28px', background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color="#4A7A5E" />
            </div>
            <p className="empty-state-text">Nema kupaca još. Dodaj prvog kupca!</p>
            <button onClick={() => setModal('customer')} className="btn-primary" style={{ marginTop: '8px', gap: '6px' }}>
              <UserPlus size={15} /> Kupac
            </button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            {isMobile && <div className="flex flex-col gap-3 gsap-reveal">
              {customers.map(c => {
                const isPending = pendingDeleteCustomer === c.id;
                return (
                  <div key={c.id} className="card" style={{ padding: '16px', background: isPending ? '#FFF5F2' : undefined }}>
                    <div style={{ fontWeight: '700', color: '#1A1A16', fontSize: '15px', marginBottom: '4px' }}>{c.name}</div>
                    {(c.email || c.phone) && (
                      <div style={{ fontSize: '13px', color: '#6B6B60', marginBottom: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}>{c.phone}</span>}
                      </div>
                    )}
                    {c.notes && (
                      <div style={{ fontSize: '12px', color: '#A8A89A', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes}</div>
                    )}
                    {isPending ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button onClick={() => deleteCustomer(c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#C94B2A', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={13} color="#ffffff" />
                        </button>
                        <button onClick={() => setPendingDeleteCustomer(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#F0EDE8', border: 'none', cursor: 'pointer' }}>
                          <X size={13} color="#6B6B60" />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button onClick={() => setEditingCustomer(c)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                          <Pencil size={13} color="#2D5040" />
                        </button>
                        <button onClick={() => setPendingDeleteCustomer(c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                          <Trash2 size={13} color="#C94B2A" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}

            {/* Desktop table */}
            {!isMobile && <div className="gsap-reveal card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E0D5', background: '#FAFAF7' }}>
                    {['Ime', 'Email', 'Telefon', 'Bilješka', ''].map(h => (
                      <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A8A89A' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const isPending = pendingDeleteCustomer === c.id;
                    return (
                      <tr key={c.id} style={{
                        borderBottom: '1px solid #F5F2ED',
                        background: isPending ? '#FFF5F2' : undefined,
                        transition: 'background 0.15s ease',
                      }}
                        onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#FAFAF7'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isPending ? '#FFF5F2' : ''; }}
                      >
                        <td style={{ padding: '14px 20px', fontWeight: '700', color: '#1A1A16' }}>{c.name}</td>
                        <td style={{ padding: '14px 20px', color: '#6B6B60' }}>{c.email || <span style={{ color: '#A8A89A' }}>—</span>}</td>
                        <td style={{ padding: '14px 20px', color: '#6B6B60', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}>{c.phone || <span style={{ color: '#A8A89A', fontFamily: 'inherit', fontSize: '14px' }}>—</span>}</td>
                        <td style={{ padding: '14px 20px', color: '#A8A89A', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '—'}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => deleteCustomer(c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#C94B2A', border: 'none', cursor: 'pointer' }}>
                                <Trash2 size={13} color="#ffffff" />
                              </button>
                              <button onClick={() => setPendingDeleteCustomer(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: '#F0EDE8', border: 'none', cursor: 'pointer' }}>
                                <X size={13} color="#6B6B60" />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                              <button onClick={() => setEditingCustomer(c)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s ease' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                              >
                                <Pencil size={13} color="#2D5040" />
                              </button>
                              <button onClick={() => setPendingDeleteCustomer(c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '28px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s ease' }}
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
            </div>}
          </>
        )
      )}

      {/* Duguje tab */}
      {tab === 'duguje' && (
        dugujeList.length === 0 ? (
          <div className="empty-state flex-1">
            <div style={{ width: '64px', height: '64px', borderRadius: '28px', background: '#EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={28} color="#4A7A5E" />
            </div>
            <p className="empty-state-text">Sve prodaje su plaćene! Nema otvorenih dugova.</p>
          </div>
        ) : (
          <div className="gsap-reveal" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Outstanding total banner */}
            <div style={{
              padding: '16px 24px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #FFF5F2, #FEF0EC)',
              border: '1.5px solid rgba(201,75,42,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} color="#C94B2A" />
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#A8351A' }}>Ukupno neplaćeno</span>
              </div>
              <span style={{ fontWeight: '800', fontSize: '20px', color: '#A8351A', fontFamily: '"IBM Plex Mono", monospace' }}>
                €{unpaidRevenue.toFixed(2)}
              </span>
            </div>

            {/* Per-customer debts */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E0D5', background: '#FAFAF7' }}>
                    {['Kupac', 'Br. prodaja', 'Duguje'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', textAlign: h === 'Duguje' ? 'right' : 'left', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A8A89A' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dugujeList.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F5F2ED', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF8F6'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: '#1A1A16' }}>{item.name}</td>
                      <td style={{ padding: '14px 20px', color: '#6B6B60' }}>{item.saleCount} {item.saleCount === 1 ? 'prodaja' : 'prodaje'}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '800', color: '#C94B2A', fontFamily: '"IBM Plex Mono", monospace', fontSize: '15px' }}>
                        €{item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '12px', color: '#A8A89A', textAlign: 'center', marginTop: '4px' }}>
              Klikni na "Duguje" badge u tablici prodaja da označiš kao plaćeno.
            </p>
          </div>
        )
      )}

      {(modal === 'sale' || (modal && modal !== 'customer' && typeof modal === 'object')) && (
        <Modal title={modal === 'sale' ? 'Dodaj Prodaju' : 'Uredi Prodaju'} onClose={() => setModal(null)}>
          <AddSaleForm
            customers={customers}
            onSave={handleSaleSave}
            onClose={() => setModal(null)}
            initial={modal !== 'sale' ? modal : undefined}
          />
        </Modal>
      )}
      {modal === 'customer' && (
        <Modal title="Dodaj Kupca" onClose={() => setModal(null)}>
          <AddCustomerForm onSave={handleCustomerSave} onClose={() => setModal(null)} />
        </Modal>
      )}
      {editingCustomer && (
        <Modal title="Uredi kupca" onClose={() => setEditingCustomer(null)}>
          <EditCustomerForm customer={editingCustomer} onSave={handleCustomerEdit} onClose={() => setEditingCustomer(null)} />
        </Modal>
      )}
    </PageWrapper>
  );
}
