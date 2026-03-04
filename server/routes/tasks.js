const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// Mirror of server/utils/tasks.js buildPhases — keep in sync
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

function getCurrentPhaseServer(cropType, sowDate) {
  if (!cropType || !sowDate) return null;
  let phases;
  if (cropType.customPhases) {
    try {
      const parsed = JSON.parse(cropType.customPhases);
      if (Array.isArray(parsed) && parsed.length > 0) phases = parsed;
    } catch {}
  }
  if (!phases) phases = buildPhases(cropType.growDays || 10);
  const sorted = [...phases].sort((a, b) => Number(a.day) - Number(b.day));
  const planted = new Date(sowDate);
  planted.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysElapsed = Math.floor((today - planted) / (1000 * 60 * 60 * 24)) + 1;
  let current = sorted[0];
  for (const ph of sorted) {
    if (daysElapsed >= Number(ph.day)) current = ph;
  }
  return { label: current.label || current.stage, stage: current.stage };
}

router.get('/', auth, async (req, res) => {
  try {
    const [tasks, regals] = await Promise.all([
      prisma.task.findMany({
        where: { userId: req.user.id },
        include: { batch: { include: { cropType: true, traySlots: true } } },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.regal.findMany({ where: { userId: req.user.id } }),
    ]);

    const regalMap = Object.fromEntries(regals.map(r => [r.id, r]));

    const enriched = tasks.map(task => {
      const traySlots = task.batch?.traySlots || [];
      const trayLocations = traySlots.map(ts => {
        const regal = regalMap[ts.regal];
        if (!regal) return null;
        const traysPerShelf = regal.traysPerShelf || 4;
        const shelf = Math.floor(ts.slot / traysPerShelf) + 1;
        const tray  = (ts.slot % traysPerShelf) + 1;
        return { label: `${regal.name} · Polica ${shelf} · Plitica ${tray}`, regalName: regal.name, regalId: regal.id, slot: ts.slot, shelf, tray };
      }).filter(Boolean);

      const currentPhase = task.batch
        ? getCurrentPhaseServer(task.batch.cropType, task.batch.sowDate)
        : null;

      return { ...task, trayLocations, currentPhase };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { batchId, title, type, dueDate } = req.body;
    const task = await prisma.task.create({
      data: {
        userId: req.user.id,
        batchId: batchId ? Number(batchId) : null,
        title,
        type: type || 'custom',
        dueDate: new Date(dueDate),
      },
      include: { batch: { include: { cropType: true } } }
    });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { completed, title, dueDate, type } = req.body;
    const task = await prisma.task.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(completed !== undefined && { completed }),
        ...(title !== undefined && { title }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(type !== undefined && { type }),
      },
      include: { batch: { include: { cropType: true } } }
    });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/completed — bulk-remove all completed tasks for current user
router.delete('/completed', auth, async (req, res) => {
  try {
    const { count } = await prisma.task.deleteMany({
      where: { userId: req.user.id, completed: true },
    });
    res.json({ deleted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
