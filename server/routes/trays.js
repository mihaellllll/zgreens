const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/trays — all occupied slots
router.get('/', auth, async (req, res) => {
  try {
    const slots = await prisma.traySlot.findMany();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trays/:regal/:slot/plant — atomic upsert + seed deduction
router.post('/:regal/:slot/plant', auth, async (req, res) => {
  const regal = parseInt(req.params.regal, 10);
  const slot  = parseInt(req.params.slot,  10);
  const { cropKey, plantedDate, notes = '', seedsToDeduct = 0 } = req.body;

  try {
    const tray = await prisma.$transaction(async (tx) => {
      const traySlot = await tx.traySlot.upsert({
        where:  { regal_slot: { regal, slot } },
        create: { regal, slot, cropKey, plantedDate, notes },
        update: { cropKey, plantedDate, notes },
      });

      if (seedsToDeduct > 0) {
        const existing = await tx.seedStorage.findUnique({ where: { cropKey } });
        const current  = existing?.grams ?? 0;
        const newGrams = Math.max(0, current - seedsToDeduct);
        await tx.seedStorage.upsert({
          where:  { cropKey },
          create: { cropKey, grams: newGrams },
          update: { grams: newGrams },
        });
      }

      return traySlot;
    });

    // Return updated seed amount alongside the tray
    const seedRecord = await prisma.seedStorage.findUnique({ where: { cropKey } });
    res.json({ tray, seedGrams: seedRecord?.grams ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trays/:regal/:slot — clear one slot
router.delete('/:regal/:slot', auth, async (req, res) => {
  const regal = parseInt(req.params.regal, 10);
  const slot  = parseInt(req.params.slot,  10);
  try {
    await prisma.traySlot.deleteMany({ where: { regal, slot } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trays — delete all slots (used by import)
router.delete('/', auth, async (req, res) => {
  try {
    await prisma.traySlot.deleteMany();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trays/:regal/:slot — plain upsert without seed deduction (import only)
router.put('/:regal/:slot', auth, async (req, res) => {
  const regal = parseInt(req.params.regal, 10);
  const slot  = parseInt(req.params.slot,  10);
  const { cropKey, plantedDate, notes = '' } = req.body;
  try {
    const tray = await prisma.traySlot.upsert({
      where:  { regal_slot: { regal, slot } },
      create: { regal, slot, cropKey, plantedDate, notes },
      update: { cropKey, plantedDate, notes },
    });
    res.json(tray);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
