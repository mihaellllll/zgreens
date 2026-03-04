// Mirror of client/src/data/cropData.js buildPhases — keep in sync
function buildPhases(growDays) {
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

// Auto-generate tasks when a tray is planted.
// Logic:
//   - seed phase (klijanje)  → no tasks
//   - blackout phase         → one "Tamna faza" task on the first day of that phase, no watering
//   - light / growing / etc  → "Zalij" task every day
//   - ready phase            → "Uberi" task on harvest day (no watering)
// Same-day duplicate tasks for the same batch are skipped.
// Tasks in the past (before today) are also skipped.
async function generateTasks(batch, userId, prisma) {
  const cropType = batch.cropType;
  const cropName = cropType?.name || 'serija';
  const growDays = cropType?.growDays || 10;

  // Resolve phases: use customPhases JSON if present, otherwise derive from growDays
  let phases;
  if (cropType?.customPhases) {
    try {
      const parsed = JSON.parse(cropType.customPhases);
      if (Array.isArray(parsed) && parsed.length > 0) phases = parsed;
    } catch {}
  }
  if (!phases) phases = buildPhases(growDays);

  // Sort chronologically for day-range detection
  const sorted = [...phases].sort((a, b) => Number(a.day) - Number(b.day));

  const sow = new Date(batch.sowDate);
  sow.setHours(0, 0, 0, 0);

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);

  const seen = new Set(); // dedupe key: "type|YYYY-MM-DD"
  const tasks = [];

  function addTask(type, title, dueDate) {
    const dateStr = dueDate.toISOString().split('T')[0];
    const key = `${type}|${dateStr}`;
    if (seen.has(key)) return;
    if (dueDate < cutoff) return; // skip past tasks
    seen.add(key);
    tasks.push({ userId, batchId: batch.id, title, type, dueDate: new Date(dueDate) });
  }

  // Find which phase a given day (1-based) belongs to
  function phaseForDay(day) {
    let current = sorted[0];
    for (const ph of sorted) {
      if (day >= Number(ph.day)) current = ph;
    }
    return current;
  }

  for (let d = 1; d <= growDays; d++) {
    const dueDate = new Date(sow);
    dueDate.setDate(dueDate.getDate() + (d - 1));

    const phase = phaseForDay(d);
    const stage = phase?.stage;

    if (stage === 'seed') {
      // Klijanje — no tasks
    } else if (stage === 'blackout') {
      // First day of blackout → transition reminder; no watering
      if (d === Number(phase.day)) {
        addTask('blackout_remove', `Tamna faza ${cropName}`, dueDate);
      }
    } else if (stage === 'ready') {
      // Harvest day — no watering, just harvest task
      addTask('harvest', `Uberi ${cropName}`, dueDate);
    } else {
      // light, growing, or any custom phase → water every day
      addTask('water', `Zalij ${cropName}`, dueDate);
    }
  }

  if (tasks.length > 0) {
    await prisma.task.createMany({ data: tasks });
  }
}

module.exports = { generateTasks };
