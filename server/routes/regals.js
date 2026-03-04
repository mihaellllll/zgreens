const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const regals = await prisma.regal.findMany({
      where: { userId: req.user.id },
      orderBy: { order: 'asc' },
    });
    res.json(regals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, shelfCount, traysPerShelf, order } = req.body;
    const regal = await prisma.regal.create({
      data: {
        userId: req.user.id,
        name: name?.trim(),
        shelfCount:    Number(shelfCount    ?? 4),
        traysPerShelf: Number(traysPerShelf ?? 4),
        order:         Number(order         ?? 0),
      },
    });
    res.json(regal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, shelfCount, traysPerShelf, order } = req.body;
    await prisma.regal.updateMany({
      where: { id: Number(req.params.id), userId: req.user.id },
      data: {
        ...(name          !== undefined && { name: name.trim() }),
        ...(shelfCount    !== undefined && { shelfCount:    Number(shelfCount)    }),
        ...(traysPerShelf !== undefined && { traysPerShelf: Number(traysPerShelf) }),
        ...(order         !== undefined && { order:         Number(order)         }),
      },
    });
    const updated = await prisma.regal.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      // Find all tray slots in this regal to get their batchIds
      const slots = await tx.traySlot.findMany({
        where: { regal: id, userId: req.user.id },
        select: { batchId: true },
      });
      const batchIds = slots.map(s => s.batchId).filter(Boolean);
      // Delete tasks for those batches
      if (batchIds.length > 0) {
        await tx.task.deleteMany({ where: { batchId: { in: batchIds } } });
      }
      await tx.traySlot.deleteMany({ where: { regal: id, userId: req.user.id } });
      await tx.regal.deleteMany({ where: { id, userId: req.user.id } });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
