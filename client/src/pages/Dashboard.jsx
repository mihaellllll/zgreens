import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers, TrendingUp, Scissors, AlertTriangle,
  Sun, Droplets, ArrowRight, Clock,
  CheckCircle, Package, Zap, ChevronDown,
} from 'lucide-react';
import api from '../api/client';
import { fetchRegals, fetchRegalConfigs } from '../api/growRack';
import PageWrapper from '../components/PageWrapper';
import StatCard from '../components/StatCard';
import { LoadingScreen } from '../components/PageWrapper';
import { useAuth } from '../hooks/useAuth';
import { 
  computeAllTrays, 
  computeDashboardActions, 
  getGreeting, 
  getFormattedDate,
  getPliticaLabel 
} from '../utils/farmLogic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function HarvestBadge({ days }) {
  if (days < 0)  return <span className="badge badge-clay">Kasno {Math.abs(days)}d</span>;
  if (days === 0) return <span className="badge badge-clay">Danas!</span>;
  if (days === 1) return <span className="badge badge-gold">Sutra</span>;
  return                 <span className="badge badge-forest">{days}d</span>;
}

function TrendBadge({ pct }) {
  if (pct === null) return <span className="text-[11px] text-text-muted">Nema prošlotjednih podataka</span>;
  const up = pct >= 0;
  return (
    <div className={`flex items-center gap-1 mt-1 text-[11px] font-bold ${up ? 'text-forest-mid' : 'text-clay'}`}>
      {up ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingUp size={12} strokeWidth={2} className="rotate-180" />}
      <span>{up ? '+' : ''}{pct.toFixed(1)}% vs prošli tjedan</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
  );
}

function ActionGroup({ icon: Icon, title, items, accentColor, actionLabel, onAction, loading }) {
  if (items.length === 0) return null;

  return (
    <div className="flex-1 min-w-[220px] bg-white/95 rounded-[22px] overflow-hidden border border-white/30 shadow-sm flex flex-col transition-all hover:shadow-md">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div 
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: accentColor }}
        >
          <Icon size={16} strokeWidth={1.5} color="#fff" />
        </div>
        <span className="font-bold text-sm text-text">{title}</span>
        <span 
          className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white ml-auto"
          style={{ background: accentColor }}
        >
          {items.length}
        </span>
      </div>

      {/* Individual item chips */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span 
            key={item.id ?? i} 
            className="text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
            style={{ 
              background: `${accentColor}12`, 
              color: accentColor,
              border: `1px solid ${accentColor}25`
            }}
          >
            {item.cropName ?? item.title}
          </span>
        ))}
      </div>

      {/* Bulk action button */}
      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={onAction}
          disabled={loading}
          className="w-full py-2.5 rounded-full border-none text-white font-bold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-2"
          style={{ background: loading ? 'var(--color-border)' : accentColor }}
        >
          {loading ? <><Spinner /> Obrađujem…</> : <><CheckCircle size={14} strokeWidth={1.5} /> {actionLabel}</>}
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();

  const [trayMap,      setTrayMap]      = useState({});
  const [regalConfigs, setRegalConfigs] = useState([]);
  const [cropTypes,    setCropTypes]    = useState([]);
  const [apiData,      setApiData]      = useState(null);
  const [loading,      setLoading]      = useState(true);

  const [bulkLoading, setBulkLoading] = useState({ harvest:false, move:false, water:false });
  const [danasOpen, setDanasOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [trays, rcs, cropsRes, dashRes] = await Promise.all([
        fetchRegals().catch(() => ({})),
        fetchRegalConfigs().catch(() => []),
        api.get('/crops').catch(() => ({ data:[] })),
        api.get('/dashboard').catch(() => ({ data:{} })),
      ]);
      setTrayMap(trays);
      setRegalConfigs(rcs);
      setCropTypes(cropsRes.data);
      setApiData(dashRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allTrays = useMemo(
    () => computeAllTrays(trayMap, regalConfigs, cropTypes),
    [trayMap, regalConfigs, cropTypes]
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  const [ackMove, setAckMove] = useState(() => {
    try {
      const stored = localStorage.getItem(`zgreens_ack_move_${todayKey}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [ackWater, setAckWater] = useState(() => {
    try {
      const stored = localStorage.getItem(`zgreens_ack_water_${todayKey}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(`zgreens_ack_move_${todayKey}`, JSON.stringify([...ackMove]));
  }, [ackMove, todayKey]);

  useEffect(() => {
    localStorage.setItem(`zgreens_ack_water_${todayKey}`, JSON.stringify([...ackWater]));
  }, [ackWater, todayKey]);

  const actions = useMemo(
    () => computeDashboardActions(allTrays, ackMove, ackWater),
    [allTrays, ackMove, ackWater]
  );

  const { harvest, moveToLight, water } = actions;
  const totalActionCount = harvest.length + moveToLight.length + water.length;

  const totalCapacity = apiData?.totalCapacity
    ?? regalConfigs.reduce((s, r) => s + r.shelfCount * r.traysPerShelf, 0);

  const harvest3Days = useMemo(
    () => allTrays.filter(t => t.daysUntilHarvest >= 0 && t.daysUntilHarvest <= 3).length,
    [allTrays]
  );

  const weeklyRevenue   = Number(apiData?.weeklyRevenue   ?? 0);
  const lastWeekRevenue = Number(apiData?.lastWeekRevenue ?? 0);
  const monthlyRevenue  = Number(apiData?.monthlyRevenue  ?? 0);
  const revChangePct    = lastWeekRevenue > 0
    ? ((weeklyRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
    : null;

  const lowSeeds = apiData?.lowSeeds ?? [];
  const activeTrayCount = apiData?.activeTrayCount ?? allTrays.length;

  // ── Bulk action handlers ────────────────────────────────────────────────────

  async function handleBulkHarvest() {
    setBulkLoading(p => ({ ...p, harvest:true }));
    try {
      const harvestTrays = harvest.map(t => ({
        regal: String(t.regalId),
        slot: String(t.slot),
        cropKey: t.cropKey,
        cropName: t.cropName,
        regalName: t.regalName,
        shelf: t.shelf,
        tray: t.trayNum,
        yieldG: t.harvestWeight || 0,
      }));

      if (harvestTrays.length > 0) {
        await api.post('/trays/bulk-harvest', { trays: harvestTrays });
      }
      await loadData();
    } finally {
      setBulkLoading(p => ({ ...p, harvest:false }));
    }
  }

  async function handleBulkMove() {
    setBulkLoading(p => ({ ...p, move:true }));
    setAckMove(prev => {
      const next = new Set(prev);
      moveToLight.forEach(t => next.add(t.id));
      return next;
    });
    setBulkLoading(p => ({ ...p, move:false }));
  }

  async function handleBulkWater() {
    setBulkLoading(p => ({ ...p, water:true }));
    setAckWater(prev => {
      const next = new Set(prev);
      water.forEach(t => next.add(t.id));
      return next;
    });
    setBulkLoading(p => ({ ...p, water:false }));
  }

  if (loading) return <LoadingScreen />;

  return (
    <PageWrapper className="page-container">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="gsap-reveal page-header">
        <div className="page-header-left">
          <h2 className="page-title">{getGreeting(user?.name)}</h2>
          <div className="page-subtitle">
            <Clock size={12} strokeWidth={2} /> {getFormattedDate()}
          </div>
        </div>
      </div>

      {/* ── DANAS TREBAŠ (Collapsible Control Panel) ──────────────────────────── */}
      {totalActionCount > 0 && (
        <div className="gsap-reveal mb-8 rounded-[32px] bg-gradient-to-br from-[#1A2E22] to-[#2D5040] shadow-premium relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[120%] bg-white/5 blur-[80px] rounded-full pointer-events-none" />

          {/* Toggle header */}
          <button
            onClick={() => setDanasOpen(o => !o)}
            className="w-full flex items-center gap-4 px-6 py-5 relative z-10 bg-transparent border-none cursor-pointer text-left"
            style={{ paddingBottom: danasOpen ? '12px' : '20px' }}
          >
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/10 shrink-0">
              <Zap size={20} strokeWidth={1.5} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="m-0 text-xl font-extrabold text-white tracking-tight">
                Danas Trebaš
              </h3>
              <p className="m-0 text-[11px] font-bold text-white/50 uppercase tracking-wider">
                {totalActionCount} {totalActionCount === 1 ? 'akcija' : totalActionCount <= 4 ? 'akcije' : 'akcija'} čekaju
              </p>
            </div>
            <ChevronDown
              size={22}
              strokeWidth={2}
              color="rgba(255,255,255,0.6)"
              style={{
                transform: danasOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
                flexShrink: 0,
              }}
            />
          </button>

          {/* Collapsible body */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: danasOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div className="flex gap-4 flex-wrap relative z-10 px-6 pb-6">
                <ActionGroup
                  icon={Scissors} title="Uberi" items={harvest}
                  accentColor="#C94B2A" actionLabel="Uberi Sve"
                  onAction={handleBulkHarvest} loading={bulkLoading.harvest}
                />
                <ActionGroup
                  icon={Sun} title="Pod Svjetlo" items={moveToLight}
                  accentColor="#C4914A" actionLabel="Potvrdi Premještaj"
                  onAction={handleBulkMove} loading={bulkLoading.move}
                />
                <ActionGroup
                  icon={Droplets} title="Zalij" items={water}
                  accentColor="#1D4E8A" actionLabel="Označi Zalijeveno"
                  onAction={handleBulkWater} loading={bulkLoading.water}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatCard 
          label="Aktivne Plitice"
          value={activeTrayCount}
          icon={Layers}
          color="forest"
          sub={`${activeTrayCount} / ${totalCapacity} popunjeno`}
        />
        <StatCard 
          label="Tjedni Prihod"
          value={`€${weeklyRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="gold"
          sub={<TrendBadge pct={revChangePct} />}
        />
        <StatCard 
          label="Berba u 3 Dana"
          value={harvest3Days}
          icon={Scissors}
          color="clay"
          sub={harvest3Days === 0 ? 'Nema predstojećih berbi' : `${getPliticaLabel(harvest3Days)} uskoro`}
        />
      </div>

      {/* ── SEED RISK WIDGET ───────────────────────────────────────────────── */}
      {lowSeeds.length > 0 ? (
        <div className="gsap-reveal mb-8 bg-[#FFF5F2] border border-clay/20 rounded-[24px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-clay/10 flex items-center justify-center">
              <AlertTriangle size={16} strokeWidth={1.5} color="#C94B2A" />
            </div>
            <h3 className="m-0 text-sm font-extrabold text-clay uppercase tracking-widest">
              Zalihe Sjemena — Kritično
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap mb-4">
            {lowSeeds.map(s => (
              <div key={s.cropKey} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-clay/10 shadow-sm">
                <Package size={14} strokeWidth={1.5} color="#C94B2A" />
                <span className="text-sm font-bold text-text">{s.name}</span>
                <span className="text-xs font-mono font-bold text-clay ml-1">0g</span>
              </div>
            ))}
          </div>
          <Link to="/storage" className="inline-flex items-center gap-2 text-xs font-bold text-clay no-underline hover:underline">
            Dopuni zalihe <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      ) : allTrays.length > 0 && (
        <div className="gsap-reveal mb-8 bg-forest-subtle/50 border border-forest-light/10 rounded-[24px] p-4 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-forest-mid/10 flex items-center justify-center">
            <CheckCircle size={14} strokeWidth={1.5} color="var(--color-forest-mid)" />
          </div>
          <span className="text-sm font-bold text-forest-mid">
            Sve zalihe sjemena su na optimalnoj razini.
          </span>
        </div>
      )}

      {/* ── UPCOMING HARVESTS ────────────────────────────────────────────── */}
      {(() => {
        const upcoming = allTrays
          .filter(t => t.daysUntilHarvest > 0 && t.daysUntilHarvest <= 7)
          .sort((a, b) => a.daysUntilHarvest - b.daysUntilHarvest);
        if (upcoming.length === 0) return null;
        return (
          <div className="gsap-reveal mb-10">
            <h3 className="section-title flex items-center gap-2">
              Nadolazeće Berbe 
              <span className="text-text-muted font-bold text-xs bg-border/40 px-2 py-0.5 rounded-full">Sljedećih 7 dana</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcoming.map(t => (
                <div key={t.id} className="card py-3.5 px-5 flex items-center justify-between border-l-4" style={{ borderLeftColor: t.cropColor }}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" 
                      style={{ background: `${t.cropColor}15` }}
                    >
                      <Scissors size={18} strokeWidth={1.5} color={t.cropColor} />
                    </div>
                    <div>
                      <p className="m-0 font-bold text-sm text-text">{t.cropName}</p>
                      <p className="m-0 text-[11px] font-medium text-text-muted uppercase tracking-wide">
                        {t.regalName} • P{t.shelf} • T{t.trayNum}
                      </p>
                    </div>
                  </div>
                  <HarvestBadge days={t.daysUntilHarvest} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </PageWrapper>
  );
}

