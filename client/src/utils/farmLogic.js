import { apiCropToRecipe, getCurrentPhase } from '../data/cropData';

/**
 * Computes all tray data across all regals for a user.
 */
export function computeAllTrays(trayMap, regalConfigs, cropTypes) {
  const result = [];
  regalConfigs.forEach(rc => {
    const slots = trayMap[rc.id] || {};
    const total = rc.shelfCount * rc.traysPerShelf;
    for (let si = 0; si < total; si++) {
      const tray = slots[si];
      if (!tray) continue;
      const ct = cropTypes.find(c => c.name === tray.cropKey);
      if (!ct) continue;
      const crop = apiCropToRecipe(ct, ct.id);
      const { phase, phaseIdx, daysElapsed, daysUntilHarvest } = getCurrentPhase(crop, tray.plantedDate);
      const nextPhase     = crop.phases[phaseIdx + 1];
      const daysUntilNext = nextPhase ? nextPhase.day - daysElapsed : Infinity;
      const shelf   = Math.floor(si / rc.traysPerShelf) + 1;
      const trayNum = (si % rc.traysPerShelf) + 1;
      
      result.push({
        id: `${rc.id}-${si}`,
        regalId: rc.id, 
        regalName: rc.name, 
        slot: si,
        shelf, 
        trayNum,
        cropKey: tray.cropKey, 
        cropName: ct.name, 
        cropColor: crop.color,
        plantedDate: tray.plantedDate,
        phase, 
        phaseIdx, 
        daysElapsed, 
        daysUntilHarvest, 
        daysUntilNext,
        harvestWeight: ct.harvestWeight || 0,
      });
    }
  });
  return result;
}

/**
 * Identifies actions required for today (harvest, move to light, water).
 */
export function computeDashboardActions(allTrays, ackMove = new Set(), ackWater = new Set()) {
  const harvest = [];
  const moveToLight = [];
  const water = [];

  allTrays.forEach(t => {
    if (t.daysUntilHarvest <= 0) {
      harvest.push(t);
    } else if (t.phase.stage === 'blackout' && t.daysUntilNext <= 0 && !ackMove.has(t.id)) {
      moveToLight.push(t);
    } else if ((t.phase.stage === 'light' || t.phase.stage === 'growing') && !ackWater.has(t.id)) {
      water.push(t);
    }
  });

  harvest.sort((a, b) => a.daysUntilHarvest - b.daysUntilHarvest);
  
  return { harvest, moveToLight, water };
}

/**
 * Task metadata mapping for icons and labels.
 */
export const TASK_META = {
  water:           { label: 'Zalij',               emoji: '💧', accent: '#1D4E8A' },
  blackout_remove: { label: 'Tamna faza: Premjesti', emoji: '🌑', accent: '#374151' },
  harvest:         { label: 'Uberi Usjev',         emoji: '✂️',  accent: '#1A2E22' },
  custom:          { label: 'Zadatak',             emoji: '📝', accent: '#4A7A5E' },
  manual:          { label: 'Ručni zadatak',        emoji: '📝', accent: '#4A7A5E' },
};

/**
 * Cleans task titles by removing redundant crop names.
 */
export function cleanTaskTitle(title, cropName, type) {
  if (!cropName || type === 'manual' || type === 'custom') return title;
  
  // Remove crop name and anything after it (like parentheses)
  // e.g. "Zalij Suncokret (Klijanje)" -> "Zalij"
  const regex = new RegExp(`\\s*${cropName}\\b.*`, 'i');
  const cleaned = title.replace(regex, '').trim();
  return cleaned || TASK_META[type]?.label || title;
}

/**
 * Derives pluralized labels for trays.
 */
export function getPliticaLabel(n) {
  if (n === 1) return 'plitica';
  if (n >= 2 && n <= 4) return 'plitice';
  return 'plitica';
}

/**
 * Generates a localized greeting.
 */
export function getGreeting(name) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || '';
  if (h < 12) return `Dobro jutro, ${first}`;
  if (h < 18) return `Dobar dan, ${first}`;
  return `Dobra večer, ${first}`;
}

/**
 * Returns formatted Croatian date string.
 */
export function getFormattedDate() {
  return new Date().toLocaleDateString('hr-HR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
