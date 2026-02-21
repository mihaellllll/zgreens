const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const crops = await prisma.cropType.findMany({ orderBy: { name: 'asc' } });
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, growDays, difficulty, seedCostG, notes } = req.body;
    const crop = await prisma.cropType.create({
      data: { name, growDays: Number(growDays), difficulty, seedCostG: Number(seedCostG || 0), notes: notes || '' }
    });
    res.json(crop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, growDays, difficulty, seedCostG, notes } = req.body;
    const crop = await prisma.cropType.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(growDays !== undefined && { growDays: Number(growDays) }),
        ...(difficulty !== undefined && { difficulty }),
        ...(seedCostG !== undefined && { seedCostG: Number(seedCostG) }),
        ...(notes !== undefined && { notes })
      }
    });
    res.json(crop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.cropType.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
