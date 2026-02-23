import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { fetchRegals } from '../api/growRack';
import StatCard from '../components/StatCard';
import { useAuth } from '../hooks/useAuth';
import { CROP_RECIPES, getCurrentPhase } from '../data/cropData';

const STATUS_COLORS = {
  seed:        'bg-yellow-100 text-yellow-700',
  sprout:      'bg-yellow-100 text-yellow-700',
  blackout:    'bg-gray-100 text-gray-700',
  light:       'bg-brand-100 text-brand-700',
  growing:     'bg-brand-100 text-brand-700',
  ready:       'bg-blue-100 text-blue-700',
  germinating: 'bg-yellow-100 text-yellow-700',
  harvested:   'bg-blue-100 text-blue-700',
  failed:      'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  seed:        'Klijanje',
  sprout:      'Nicanje',
  blackout:    'Blackout',
  light:       'Pod svjetlom',
  growing:     'Rast',
  ready:       'Spremo za berbu',
  germinating: 'Klijanje',
  harvested:   'Ubrano',
  failed:      'Propalo',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Dobro jutro';
  if (h < 18) return 'Dobar dan';
  return 'Dobra večer';
}

function computeLocalData(regals) {
  try {
    const allTrays = [];
    regals.forEach((regal, ri) => {
      if (!Array.isArray(regal)) return;
      regal.forEach((tray, si) => {
        if (!tray) return;
        const crop = CROP_RECIPES.find(c => c.key === tray.cropKey);
        if (!crop) return;
        allTrays.push({ tray, crop, regal: ri, slot: si });
      });
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const upcomingHarvests = allTrays
      .map(({ tray, crop, regal, slot }) => {
        const { daysUntilHarvest } = getCurrentPhase(crop, tray.plantedDate);
        if (daysUntilHarvest > 7) return null;
        return {
          id: `r${regal}-s${slot}`,
          cropType: { name: crop.name },
          expectedHarvestDate: new Date(today.getTime() + Math.max(daysUntilHarvest, 0) * 86400000).toISOString(),
          daysUntil: daysUntilHarvest,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);

    const recentBatches = [...allTrays]
      .sort((a, b) => new Date(b.tray.plantedDate) - new Date(a.tray.plantedDate))
      .slice(0, 5)
      .map(({ tray, crop, regal, slot }) => {
        const { phase } = getCurrentPhase(crop, tray.plantedDate);
        return {
          id: `r${regal}-s${slot}`,
          cropType: { name: crop.name },
          sowDate: tray.plantedDate,
          status: phase.stage,
        };
      });

    let pendingTasks = 0;
    allTrays.forEach(({ tray, crop }) => {
      const { phaseIdx, daysElapsed } = getCurrentPhase(crop, tray.plantedDate);
      if (phaseIdx + 1 < crop.phases.length) {
        const daysUntil = crop.phases[phaseIdx + 1].day - daysElapsed;
        if (daysUntil <= 0) pendingTasks++;
      }
    });

    return { activeBatches: allTrays.length, upcomingHarvests, recentBatches, pendingTasks };
  } catch {
    return { activeBatches: 0, upcomingHarvests: [], recentBatches: [], pendingTasks: 0 };
  }
}

const EMPTY_LOCAL = { activeBatches: 0, upcomingHarvests: [], recentBatches: [], pendingTasks: 0 };

export default function Dashboard() {
  const { user } = useAuth();
  const [apiData,   setApiData]   = useState(null);
  const [localData, setLocalData] = useState(EMPTY_LOCAL);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard').catch(() => ({ data: {} })),
      fetchRegals().catch(() => Array(4).fill(null).map(() => Array(16).fill(null))),
    ]).then(([apiRes, regals]) => {
      setApiData(apiRes.data);
      setLocalData(computeLocalData(regals));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[200px]">
      <span className="text-gray-400 text-[15px]">Učitavanje…</span>
    </div>
  );

  return (
    <div className="p-4 md:p-10 h-full flex flex-col">
      <div className="page-header">
        <h2 className="page-title">{greeting()}, {user?.name?.split(' ')[0]}!</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-10">
        <StatCard label="Aktivne Plitice" value={localData.activeBatches} color="green" />
        <StatCard label="Čekajući Zadaci" value={localData.pendingTasks} color="yellow" />
        <StatCard label="Tjedni Prihod" value={`$${Number(apiData?.weeklyRevenue || 0).toFixed(2)}`} color="blue" />
        <StatCard label="Glavni Usjev" value={apiData?.topCrop || '—'} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Predstojeće Berbe */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="card-title">Predstojeće Berbe</h3>
            <Link to="/batches" className="text-base text-brand-600 hover:text-brand-700 font-medium">→</Link>
          </div>
          {localData.upcomingHarvests.length === 0 ? (
            <p className="text-base text-gray-400">—</p>
          ) : (
            <div className="space-y-2">
              {localData.upcomingHarvests.map(batch => (
                <div key={batch.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-base font-medium">{batch.cropType.name}</p>
                    <p className="text-sm text-gray-400">×1</p>
                  </div>
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    batch.daysUntil <= 0 ? 'bg-red-100 text-red-700'
                    : batch.daysUntil === 1 ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-brand-100 text-brand-700'
                  }`}>
                    {batch.daysUntil <= 0 ? 'Danas!' : `${batch.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nedavne Plitice */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="card-title">Nedavne Plitice</h3>
            <Link to="/batches" className="text-base text-brand-600 hover:text-brand-700 font-medium">→</Link>
          </div>
          {localData.recentBatches.length === 0 ? (
            <p className="text-base text-gray-400">—</p>
          ) : (
            <div className="space-y-2">
              {localData.recentBatches.map(batch => (
                <div key={batch.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-base font-medium">{batch.cropType.name}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(batch.sowDate).toLocaleDateString('hr-HR')}
                    </p>
                  </div>
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_COLORS[batch.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[batch.status] || batch.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
