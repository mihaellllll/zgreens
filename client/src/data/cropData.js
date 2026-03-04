// ─── Color palette ────────────────────────────────────────────────────────────

export const CROP_COLORS = [
  { color: '#16a34a', darkColor: '#14532d', bgLight: '#f0fdf4', stemColor: '#86efac', leafColor: '#22c55e', leafShape: 'oval'  },
  { color: '#dc2626', darkColor: '#7f1d1d', bgLight: '#fef2f2', stemColor: '#f87171', leafColor: '#22c55e', leafShape: 'oval'  },
  { color: '#9333ea', darkColor: '#4a044e', bgLight: '#faf5ff', stemColor: '#e879f9', leafColor: '#a855f7', leafShape: 'oval'  },
  { color: '#0891b2', darkColor: '#164e63', bgLight: '#ecfeff', stemColor: '#67e8f9', leafColor: '#06b6d4', leafShape: 'oval'  },
  { color: '#ca8a04', darkColor: '#713f12', bgLight: '#fefce8', stemColor: '#bef264', leafColor: '#84cc16', leafShape: 'thin'  },
  { color: '#db2777', darkColor: '#831843', bgLight: '#fdf2f8', stemColor: '#f9a8d4', leafColor: '#ec4899', leafShape: 'round' },
  { color: '#f97316', darkColor: '#c2410c', bgLight: '#fff7ed', stemColor: '#86efac', leafColor: '#4ade80', leafShape: 'round' },
  { color: '#059669', darkColor: '#064e3b', bgLight: '#ecfdf5', stemColor: '#6ee7b7', leafColor: '#10b981', leafShape: 'oval'  },
];

export function getCropColor(idx) {
  return CROP_COLORS[((idx ?? 0) % CROP_COLORS.length + CROP_COLORS.length) % CROP_COLORS.length];
}

// ─── Phase builder ────────────────────────────────────────────────────────────

/**
 * Derives a 4-5 phase timeline from growDays.
 * Day 1: Sjetva (seed)
 * ~30%: Blackout (if > 1)
 * ~50%: Svijetlo (if gap exists)
 * ~75%: Rast (growing)
 * growDays: Berba (ready)
 */
export function buildPhases(growDays) {
  const phases = [{ day: 1, label: 'Sjetva', stage: 'seed' }];
  const blackout = Math.round(growDays * 0.3);
  const light    = Math.round(growDays * 0.5);
  if (blackout > 1) phases.push({ day: blackout, label: 'Tamna faza', stage: 'blackout' });
  if (light > blackout) phases.push({ day: light, label: 'Svijetlo', stage: 'light' });
  const mid = Math.round((light + growDays) / 2);
  if (mid > light && mid < growDays) phases.push({ day: mid, label: 'Rast', stage: 'growing' });
  phases.push({ day: growDays, label: 'Berba', stage: 'ready' });
  return phases;
}

// ─── API crop → recipe shape ──────────────────────────────────────────────────

/**
 * Converts a CropType DB object into a recipe shape compatible with
 * getCurrentPhase, TrayPlantSVG, and all rendering logic.
 * idx is used to pick the color palette entry (use crop.id for stable colors).
 */
export function apiCropToRecipe(crop, idx) {
  const c = getCropColor(idx ?? crop.id);

  let phases = null;
  if (crop.customPhases) {
    try {
      const parsed = JSON.parse(crop.customPhases);
      if (Array.isArray(parsed) && parsed.length > 0) {
        phases = parsed; // preserve user's display order
      }
    } catch {}
  }
  if (!phases) phases = buildPhases(crop.growDays);

  return {
    key:          `crop-${crop.id}`,
    name:         crop.name,
    nameEn:       crop.name,
    ...c,
    seedsPerTray:  crop.seedsPerTray  || 0,
    harvestWeight: crop.harvestWeight || 0,
    seedCostG:     crop.seedCostG     || 0,
    harvestDay:    crop.growDays,
    notes:         crop.notes || '',
    phases,
    _apiCrop:      crop,
  };
}

// ─── getCurrentPhase ──────────────────────────────────────────────────────────

/**
 * Given a recipe (from apiCropToRecipe) and a planting date (ISO string "day 1"),
 * returns the current phase, days elapsed, and days until harvest.
 */
export function getCurrentPhase(crop, plantedDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse as local date to avoid UTC midnight timezone shift
  const [py, pm, pd] = plantedDate.split('-').map(Number);
  const planted = new Date(py, pm - 1, pd);
  const daysElapsed = Math.floor((today - planted) / 86400000) + 1;

  // Sort by day for detection — keeps display order intact on the recipe itself
  const chronological = [...crop.phases].sort((a, b) => Number(a.day) - Number(b.day));
  let phaseIdx = 0;
  for (let i = 0; i < chronological.length; i++) {
    if (daysElapsed >= chronological[i].day) phaseIdx = i;
  }

  const harvestDay       = crop.harvestDay;
  const daysUntilHarvest = harvestDay - daysElapsed;

  return {
    phase:          chronological[phaseIdx],
    phaseIdx,
    daysElapsed,
    daysUntilHarvest,
    isOverdue: daysElapsed > harvestDay,
    isToday:   daysUntilHarvest === 0,
  };
}
