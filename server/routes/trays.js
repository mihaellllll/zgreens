const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { generateTasks } = require('../utils/tasks');

const prisma = new PrismaClient();

// POST /api/trays/bulk-plant — atomic bulk planting with batch creation + seed deduction
router.post('/bulk-plant', auth, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Nema unosa za sadnju.' });
  }
  const userId = req.user.id;
  try {
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        const regal = parseInt(e.regal, 10);
        const slot  = parseInt(e.slot, 10);

        let cropType = await tx.cropType.findFirst({
          where: { name: e.cropKey, userId }
        });
        if (!cropType) {
          cropType = await tx.cropType.create({
            data: { userId, name: e.cropKey, growDays: 10 }
          });
        }

        const sow = new Date(e.plantedDate);
        const expectedHarvestDate = new Date(sow);
        expectedHarvestDate.setDate(expectedHarvestDate.getDate() + cropType.growDays);

        const batch = await tx.batch.create({
          data: {
            userId,
            cropTypeId: cropType.id,
            sowDate: sow,
            expectedHarvestDate,
            trayCount: 1,
            notes: `Masovna sadnja: Regal ${regal}, Slot ${slot}`,
            status: 'germinating',
          },
          include: { cropType: true }
        });

        const gramsUsed = e.seedsToDeduct || cropType.seedsPerTray || 0;
        if (cropType.seedCostG > 0 && gramsUsed > 0) {
          await tx.cost.create({
            data: {
              batchId: batch.id,
              category: 'seed',
              amount: cropType.seedCostG * gramsUsed,
              note: `Sjeme: ${gramsUsed}g \u00d7 ${cropType.seedCostG}\u20ac/g`
            }
          });
        }

        await tx.traySlot.upsert({
          where:  { regal_slot_userId: { regal, slot, userId } },
          create: { userId, regal, slot, cropKey: e.cropKey, plantedDate: e.plantedDate, notes: e.notes || '', batchId: batch.id },
          update: { cropKey: e.cropKey, plantedDate: e.plantedDate, notes: e.notes || '', batchId: batch.id },
        });

        if (e.seedsToDeduct > 0) {
          const existing = await tx.seedStorage.findUnique({ where: { cropKey_userId: { cropKey: e.cropKey, userId } } });
          const current  = existing?.grams ?? 0;
          const newGrams = Math.max(0, current - e.seedsToDeduct);
          await tx.seedStorage.upsert({
            where:  { cropKey_userId: { cropKey: e.cropKey, userId } },
            create: { userId, cropKey: e.cropKey, grams: newGrams },
            update: { grams: newGrams },
          });
        }

        await generateTasks(batch, userId, tx);
      }
    });
    res.json({ success: true, count: entries.length });
  } catch (err) {
    res.status(500).json({ error: 'Greška pri masovnoj sadnji.' });
  }
});

// GET /api/trays — all occupied slots for current user
router.get('/', auth, async (req, res) => {
  try {
    const slots = await prisma.traySlot.findMany({
      where: { userId: req.user.id },
      include: { batch: { include: { cropType: true } } }
    });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trays/:regal/:slot/plant — atomic upsert + batch creation + seed deduction
router.post('/:regal/:slot/plant', auth, async (req, res) => {
  const regal  = parseInt(req.params.regal, 10);
  const slot   = parseInt(req.params.slot,  10);
  const userId = req.user.id;
  const { cropKey, plantedDate, notes = '', seedsToDeduct = 0 } = req.body;

  try {
    const tray = await prisma.$transaction(async (tx) => {
      // 1. Find or create CropType (matching name/cropKey)
      let cropType = await tx.cropType.findFirst({
        where: { name: cropKey, userId }
      });

      // If it doesn't exist, we might be using a hardcoded recipe from frontend
      // For now, let's assume it should exist or we create a minimal one
      if (!cropType) {
        cropType = await tx.cropType.create({
          data: { userId, name: cropKey, growDays: 10 } // default 10 days if unknown
        });
      }

      // 2. Create a Batch for this tray
      const sow = new Date(plantedDate);
      const expectedHarvestDate = new Date(sow);
      expectedHarvestDate.setDate(expectedHarvestDate.getDate() + cropType.growDays);

      const batch = await tx.batch.create({
        data: {
          userId,
          cropTypeId: cropType.id,
          sowDate: sow,
          expectedHarvestDate,
          trayCount: 1,
          notes: `Created from rack planting: Regal ${regal}, Slot ${slot}`,
          status: 'germinating',
        },
        include: { cropType: true }
      });

      // 3. Auto-add seed cost (total = price per gram * grams used)
      const gramsUsed = seedsToDeduct || cropType.seedsPerTray || 0;
      if (cropType.seedCostG > 0 && gramsUsed > 0) {
        await tx.cost.create({
          data: {
            batchId: batch.id,
            category: 'seed',
            amount: cropType.seedCostG * gramsUsed,
            note: `Sjeme: ${gramsUsed}g \u00d7 ${cropType.seedCostG}\u20ac/g`
          }
        });
      }

      // 4. Upsert TraySlot
      const traySlot = await tx.traySlot.upsert({
        where:  { regal_slot_userId: { regal, slot, userId } },
        create: { userId, regal, slot, cropKey, plantedDate, notes, batchId: batch.id },
        update: { cropKey, plantedDate, notes, batchId: batch.id },
      });

      // 5. Deduct seeds
      if (seedsToDeduct > 0) {
        const existing = await tx.seedStorage.findUnique({ where: { cropKey_userId: { cropKey, userId } } });
        const current  = existing?.grams ?? 0;
        const newGrams = Math.max(0, current - seedsToDeduct);
        await tx.seedStorage.upsert({
          where:  { cropKey_userId: { cropKey, userId } },
          create: { userId, cropKey, grams: newGrams },
          update: { grams: newGrams },
        });
      }

      // 6. Generate Tasks
      await generateTasks(batch, userId, tx);

      return traySlot;
    });

    // Return updated seed amount alongside the tray
    const seedRecord = await prisma.seedStorage.findUnique({ where: { cropKey_userId: { cropKey, userId: req.user.id } } });
    res.json({ tray, seedGrams: seedRecord?.grams ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trays/:regal/:slot — clear one slot
router.delete('/:regal/:slot', auth, async (req, res) => {
  const regal  = parseInt(req.params.regal, 10);
  const slot   = parseInt(req.params.slot,  10);
  const userId = req.user.id;
  try {
    await prisma.$transaction(async (tx) => {
      // Find the slot first to get batchId
      const existing = await tx.traySlot.findUnique({
        where: { regal_slot_userId: { regal, slot, userId } },
      });

      // Clean up linked batch: delete its tasks and mark it done
      if (existing?.batchId) {
        await tx.task.deleteMany({ where: { batchId: existing.batchId } });
      }

      await tx.traySlot.deleteMany({ where: { regal, slot, userId } });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trays — delete all slots for current user (used by import)
router.delete('/', auth, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Collect batchIds from all tray slots before deleting
      const slots = await tx.traySlot.findMany({
        where: { userId: req.user.id },
        select: { batchId: true },
      });
      const batchIds = slots.map(s => s.batchId).filter(Boolean);
      if (batchIds.length > 0) {
        await tx.task.deleteMany({ where: { batchId: { in: batchIds } } });
      }
      await tx.traySlot.deleteMany({ where: { userId: req.user.id } });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trays/:regal/:slot — plain upsert without seed deduction (import only)
router.put('/:regal/:slot', auth, async (req, res) => {
  const regal  = parseInt(req.params.regal, 10);
  const slot   = parseInt(req.params.slot,  10);
  const userId = req.user.id;
  const { cropKey, plantedDate, notes = '' } = req.body;
  try {
    const tray = await prisma.traySlot.upsert({
      where:  { regal_slot_userId: { regal, slot, userId } },
      create: { userId, regal, slot, cropKey, plantedDate, notes },
      update: { cropKey, plantedDate, notes },
    });
    res.json(tray);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trays/bulk-harvest
// Body: { trays: [{ regal, slot, cropKey, cropName, regalName, shelf, tray, yieldG }] }
// Atomically: creates Harvest records + deletes TraySlots for the given user.
router.post('/bulk-harvest', auth, async (req, res) => {
  const userId = req.user.id;
  const { trays = [] } = req.body;
  if (!trays.length) return res.json({ harvested: 0 });

  const today = new Date().toISOString().split('T')[0];
  try {
    await prisma.$transaction(async (tx) => {
      for (const t of trays) {
        // Guard: tray must still belong to this user
        const exists = await tx.traySlot.findUnique({
          where: { regal_slot_userId: { regal: Number(t.regal), slot: Number(t.slot), userId } },
        });
        if (!exists) continue;

        await tx.harvest.create({
          data: {
            userId,
            cropKey:  t.cropKey,
            cropName: t.cropName,
            yieldG:   Number(t.yieldG ?? 0),
            date:     today,
            regal:    Number(t.regal),
            shelf:    Number(t.shelf ?? 0),
            tray:     Number(t.tray  ?? 0),
          },
        });

        // Update linked batch + wipe all its tasks
        if (exists.batchId) {
          await tx.batch.update({
            where: { id: exists.batchId },
            data: {
              status: 'harvested',
              harvestDate: new Date(),
              yieldGrams: Number(t.yieldG ?? 0),
            },
          });
          await tx.task.deleteMany({ where: { batchId: exists.batchId } });
        }

        await tx.traySlot.deleteMany({
          where: { regal: Number(t.regal), slot: Number(t.slot), userId },
        });
      }
    });
    res.json({ harvested: trays.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
