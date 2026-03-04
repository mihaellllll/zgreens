const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { generateTasks } = require('../utils/tasks');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      where: { userId: req.user.id },
      include: { cropType: true, costs: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const batch = await prisma.batch.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
      include: { cropType: true, costs: true, tasks: { orderBy: { dueDate: 'asc' } }, saleItems: { include: { sale: true } } }
    });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { cropTypeId, sowDate, trayCount, notes, costs } = req.body;
    const cropType = await prisma.cropType.findFirst({ where: { id: Number(cropTypeId), userId: req.user.id } });
    if (!cropType) return res.status(404).json({ error: 'Crop type not found' });

    const sow = new Date(sowDate);
    const expectedHarvestDate = new Date(sow);
    expectedHarvestDate.setDate(expectedHarvestDate.getDate() + cropType.growDays);

    const batch = await prisma.batch.create({
      data: {
        userId: req.user.id,
        cropTypeId: Number(cropTypeId),
        sowDate: sow,
        expectedHarvestDate,
        trayCount: Number(trayCount || 1),
        notes: notes || '',
        status: 'germinating',
      },
      include: { cropType: true }
    });

    // Add initial costs if provided
    if (costs && costs.length > 0) {
      await prisma.cost.createMany({
        data: costs.map(c => ({
          batchId: batch.id,
          category: c.category,
          amount: Number(c.amount),
          note: c.note || ''
        }))
      });
    }

    // Auto-generate seed cost from crop type
    if (cropType.seedCostG > 0) {
      await prisma.cost.create({
        data: {
          batchId: batch.id,
          category: 'seed',
          amount: cropType.seedCostG * Number(trayCount || 1),
          note: 'Auto: seed cost from crop type'
        }
      });
    }

    await generateTasks(batch, req.user.id, prisma);

    const fullBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
      include: { cropType: true, costs: true }
    });
    res.json(fullBatch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, harvestDate, yieldGrams, notes, trayCount } = req.body;
    const existing = await prisma.batch.findFirst({ where: { id: Number(req.params.id), userId: req.user.id }, include: { cropType: true } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const data = {};
    if (status !== undefined) data.status = status;
    if (harvestDate !== undefined) data.harvestDate = new Date(harvestDate);
    if (yieldGrams !== undefined) data.yieldGrams = Number(yieldGrams);
    if (notes !== undefined) data.notes = notes;
    if (trayCount !== undefined) data.trayCount = Number(trayCount);

    const batch = await prisma.batch.update({
      where: { id: Number(req.params.id) },
      data,
      include: { cropType: true }
    });

    // Generate tasks on status change; delete them when harvested
    if (status && status !== existing.status) {
      if (status === 'harvested') {
        await prisma.task.deleteMany({ where: { batchId: Number(req.params.id) } });
      } else {
        await generateTasks(batch, req.user.id, prisma);
      }
    }

    const fullBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
      include: { cropType: true, costs: true }
    });
    res.json(fullBatch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/costs', auth, async (req, res) => {
  try {
    // Verify batch belongs to user
    const batch = await prisma.batch.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!batch) return res.status(404).json({ error: 'Not found' });

    const { category, amount, note } = req.body;
    const cost = await prisma.cost.create({
      data: {
        batchId: Number(req.params.id),
        category,
        amount: Number(amount),
        note: note || ''
      }
    });
    res.json(cost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/costs/:costId', auth, async (req, res) => {
  try {
    // Verify batch belongs to user
    const batch = await prisma.batch.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!batch) return res.status(404).json({ error: 'Not found' });

    await prisma.cost.delete({ where: { id: Number(req.params.costId) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
