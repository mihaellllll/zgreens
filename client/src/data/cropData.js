// Recipe data from recepti.txt — all 5 crops used at ZGreens

export const CROP_RECIPES = [
  {
    key: 'dragoljub',
    name: 'Dragoljub',
    nameEn: 'Nasturtium',
    color: '#f97316',
    darkColor: '#c2410c',
    bgLight: '#fff7ed',
    stemColor: '#86efac',
    leafColor: '#4ade80',
    leafShape: 'round', // broad round leaves
    seedsPerTray: 50,
    harvestWeight: 6,
    germinationDays: 7,
    blackoutDays: 0,
    lightDays: 7,
    harvestDay: 14,
    notes: 'Blackout nije potreban.',
    phases: [
      { day: 1,  label: 'Sjetva',           stage: 'seed'    },
      { day: 6,  label: 'Provjera', stage: 'sprout'  },
      { day: 8,  label: 'Svijetlo',         stage: 'light'   },
      { day: 10, label: 'Rast',             stage: 'growing' },
      { day: 14, label: 'Berba',            stage: 'ready'   },
    ],
  },
  {
    key: 'brokula',
    name: 'Brokula',
    nameEn: 'Broccoli',
    color: '#16a34a',
    darkColor: '#14532d',
    bgLight: '#f0fdf4',
    stemColor: '#86efac',
    leafColor: '#22c55e',
    leafShape: 'oval',
    seedsPerTray: 20,
    harvestWeight: 6,
    germinationDays: 3,
    blackoutDays: 2,
    lightDays: 5,
    harvestDay: 10,
    notes: '',
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 4,  label: 'Blackout', stage: 'blackout'},
      { day: 6,  label: 'Svijetlo', stage: 'light'   },
      { day: 7,  label: 'Rast',     stage: 'growing' },
      { day: 10, label: 'Berba',    stage: 'ready'   },
    ],
  },
  {
    key: 'gorusica',
    name: 'Gorušica',
    nameEn: 'Mustard',
    color: '#ca8a04',
    darkColor: '#713f12',
    bgLight: '#fefce8',
    stemColor: '#bef264',
    leafColor: '#84cc16',
    leafShape: 'thin', // pointed narrow leaves
    seedsPerTray: 20,
    harvestWeight: 6,
    germinationDays: 3,
    blackoutDays: 2,
    lightDays: 5,
    harvestDay: 10,
    notes: '',
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 4,  label: 'Blackout', stage: 'blackout'},
      { day: 6,  label: 'Svijetlo', stage: 'light'   },
      { day: 7,  label: 'Rast',     stage: 'growing' },
      { day: 10, label: 'Berba',    stage: 'ready'   },
    ],
  },
  {
    key: 'rotkvica',
    name: 'Crvena Rotkvica',
    nameEn: 'Red Radish',
    color: '#dc2626',
    darkColor: '#7f1d1d',
    bgLight: '#fef2f2',
    stemColor: '#f87171', // distinctive red stems
    leafColor: '#22c55e', // green tops
    leafShape: 'oval',
    seedsPerTray: 32,
    harvestWeight: 6,
    germinationDays: 3,
    blackoutDays: 2,
    lightDays: 5,
    harvestDay: 10,
    notes: '',
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 4,  label: 'Blackout', stage: 'blackout'},
      { day: 6,  label: 'Svijetlo', stage: 'light'   },
      { day: 7,  label: 'Rast',     stage: 'growing' },
      { day: 10, label: 'Berba',    stage: 'ready'   },
    ],
  },
  {
    key: 'bosiljak',
    name: 'Crveni Bosiljak',
    nameEn: 'Red Basil',
    color: '#9333ea',
    darkColor: '#4a044e',
    bgLight: '#faf5ff',
    stemColor: '#e879f9',
    leafColor: '#a855f7', // dark purple leaves
    leafShape: 'oval',
    seedsPerTray: 10,
    harvestWeight: 6,
    germinationDays: 5,
    blackoutDays: 2,
    lightDays: 14,
    harvestDay: 14,
    harvestDayMax: 21,
    notes: 'Berba dan 14-21.',
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 5,  label: 'Blackout', stage: 'blackout'},
      { day: 7,  label: 'Svijetlo', stage: 'light'   },
      { day: 8,  label: 'Rast',     stage: 'growing' },
      { day: 14, label: 'Berba',    stage: 'ready'   },
    ],
  },
];

/**
 * Given a crop recipe and a planting date (ISO string, "day 1"),
 * returns the current phase, days elapsed, and days until harvest.
 */
export function getCurrentPhase(crop, plantedDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse as local date to avoid UTC midnight timezone shift
  const [py, pm, pd] = plantedDate.split('-').map(Number);
  const planted = new Date(py, pm - 1, pd);
  const daysElapsed = Math.floor((today - planted) / 86400000) + 1;

  let phaseIdx = 0;
  for (let i = 0; i < crop.phases.length; i++) {
    if (daysElapsed >= crop.phases[i].day) phaseIdx = i;
  }

  const harvestDay = crop.harvestDay;
  const daysUntilHarvest = harvestDay - daysElapsed;

  return {
    phase: crop.phases[phaseIdx],
    phaseIdx,
    daysElapsed,
    daysUntilHarvest,
    isOverdue: daysElapsed > harvestDay,
    isToday: daysUntilHarvest === 0,
  };
}
