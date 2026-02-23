import { useEffect, useState } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import { PlusIcon, UserPlusIcon, TrashIcon, XIcon } from '../components/Icons';

function AddCustomerForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/customers', form);
      onSave(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ime *</label>
        <input required value={form.name} onChange={f('name')} className="input" placeholder="Ime kupca" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={f('email')} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input value={form.phone} onChange={f('phone')} className="input" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bilješka</label>
        <textarea value={form.notes} onChange={f('notes')} className="input h-16 resize-none" />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Spremanje…' : 'Dodaj Kupca'}</button>
      </div>
    </form>
  );
}

function AddSaleForm({ customers, onSave, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ cropName: '', quantityG: '', pricePerG: '', batchId: '' }]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/batches').then(r => setBatches(r.data.filter(b => b.status === 'harvested' || b.yieldGrams > 0)));
  }, []);

  const updateItem = (i, key, val) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  const addItem = () => setItems(prev => [...prev, { cropName: '', quantityG: '', pricePerG: '', batchId: '' }]);
  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i));

  const total = items.reduce((s, item) => {
    return s + (Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0);
  }, 0);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        date,
        customerId: customerId || null,
        notes,
        items: items.map(item => ({
          ...item,
          subtotal: (Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0),
          batchId: item.batchId || null,
        }))
      };
      const res = await api.post('/sales', payload);
      onSave(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kupac</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="input">
            <option value="">Bez kupca / Anonimno</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Stavke</p>
          <button type="button" onClick={addItem} className="text-xs text-brand-600 hover:underline">+ Dodaj stavku</button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  required
                  placeholder="Vrsta usjeva"
                  value={item.cropName}
                  onChange={e => updateItem(i, 'cropName', e.target.value)}
                  className="input text-sm"
                />
                <select value={item.batchId} onChange={e => updateItem(i, 'batchId', e.target.value)} className="input text-sm">
                  <option value="">Bez plitice</option>
                  {batches.map(b => <option key={b.id} value={b.id}>#{b.id} {b.cropType?.name}</option>)}
                </select>
              </div>
              <div className="flex gap-1.5 items-center">
                <input required type="number" min="0" step="0.1" placeholder="Kol. (g)" value={item.quantityG} onChange={e => updateItem(i, 'quantityG', e.target.value)} className="input text-sm flex-1" />
                <input required type="number" min="0" step="0.01" placeholder="$/g" value={item.pricePerG} onChange={e => updateItem(i, 'pricePerG', e.target.value)} className="input text-sm flex-1" />
                <span className="text-sm text-gray-600 whitespace-nowrap">${((Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0)).toFixed(2)}</span>
                {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">✕</button>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-right text-sm font-bold text-gray-800 mt-2">Ukupno: ${total.toFixed(2)}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bilješka</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Opcionalna bilješka" />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Odustani</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Spremanje…' : `Dodaj Prodaju ($${total.toFixed(2)})`}</button>
      </div>
    </form>
  );
}

const TABS = [
  { key: 'sales',     label: 'Prodaje'  },
  { key: 'customers', label: 'Kupci'    },
];

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('sales');
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/sales'), api.get('/customers')]).then(([s, c]) => {
      setSales(s.data);
      setCustomers(c.data);
    });
  }, []);

  const handleSaleSave = sale => {
    setSales(prev => [sale, ...prev]);
    setModal(null);
  };

  const handleCustomerSave = customer => {
    setCustomers(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name)));
    setModal(null);
  };

  const deleteSale = async id => {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    await api.delete(`/sales/${id}`);
    setSales(prev => prev.filter(s => s.id !== id));
    setPendingDelete(null);
  };

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);

  return (
    <div className="p-4 md:p-10 h-full flex flex-col">
      <div className="page-header flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="page-title">Prodaja</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('customer')} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <UserPlusIcon size={16} /> Kupac
          </button>
          <button onClick={() => setModal('sale')} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <PlusIcon size={16} color="#fff" /> Prodaja
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 border-b border-gray-200 flex-shrink-0">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => { setTab(key); setPendingDelete(null); }}
            className={`px-5 py-3 text-base font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        sales.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Nema prodaja još.</p>
            <button onClick={() => setModal('sale')} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'6px' }}><PlusIcon size={16} color="#fff" /> Prodaja</button>
          </div>
        ) : (
          <div className="card overflow-hidden p-0 flex-1">
            <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Datum</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Kupac</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Stavke</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-600">Ukupno</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-4 text-gray-600">{new Date(sale.date).toLocaleDateString('hr-HR')}</td>
                    <td className="px-5 py-4">{sale.customer?.name || <span className="text-gray-400">Bez kupca</span>}</td>
                    <td className="px-5 py-4 text-gray-500">
                      {sale.items?.map(i => `${i.cropName} (${i.quantityG}g)`).join(', ')}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-brand-600">${sale.total.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right">
                      {pendingDelete === sale.id ? (
                        <span className="flex items-center gap-2 justify-end">
                          <button onClick={() => deleteSale(sale.id)} title="Potvrdi" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'32px', height:'32px', borderRadius:'8px', background:'#fef2f2', border:'none', cursor:'pointer' }}>
                            <TrashIcon size={14} color="#ef4444" />
                          </button>
                          <button onClick={() => setPendingDelete(null)} title="Odustani" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'32px', height:'32px', borderRadius:'8px', background:'#f3f4f6', border:'none', cursor:'pointer' }}>
                            <XIcon size={14} color="#6b7280" />
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setPendingDelete(sale.id)} title="Obriši" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'32px', height:'32px', borderRadius:'8px', background:'transparent', border:'none', cursor:'pointer', marginLeft:'auto' }}>
                          <TrashIcon size={14} color="#d1d5db" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )
      )}

      {tab === 'customers' && (
        customers.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Nema kupaca još.</p>
            <button onClick={() => setModal('customer')} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'6px' }}><UserPlusIcon size={16} color="#fff" /> Kupac</button>
          </div>
        ) : (
          <div className="card overflow-hidden p-0 flex-1">
            <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Ime</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Telefon</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600">Bilješka</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium">{c.name}</td>
                    <td className="px-5 py-4 text-gray-500">{c.email || '—'}</td>
                    <td className="px-5 py-4 text-gray-500">{c.phone || '—'}</td>
                    <td className="px-5 py-4 text-gray-400 max-w-xs truncate">{c.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )
      )}

      {modal === 'sale' && (
        <Modal title="Dodaj Prodaju" onClose={() => setModal(null)}>
          <AddSaleForm customers={customers} onSave={handleSaleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'customer' && (
        <Modal title="Dodaj Kupca" onClose={() => setModal(null)}>
          <AddCustomerForm onSave={handleCustomerSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
