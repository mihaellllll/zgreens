const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const crops = await prisma.cropType.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' },
    });
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, growDays, difficulty, customPhases, seedCostG, seedsPerTray, harvestWeight, notes } = req.body;
    const crop = await prisma.cropType.create({
      data: {
        userId:       req.user.id,
        name,
        growDays:     Number(growDays),
        difficulty:   difficulty || 'easy',
        customPhases: customPhases || '',
        seedCostG:    Number(seedCostG    || 0),
        seedsPerTray: Number(seedsPerTray || 0),
        harvestWeight:Number(harvestWeight|| 0),
        notes:        notes || '',
      }
    });
    res.json(crop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, growDays, difficulty, customPhases, seedCostG, seedsPerTray, harvestWeight, notes } = req.body;
    await prisma.cropType.updateMany({
      where: { id: Number(req.params.id), userId: req.user.id },
      data: {
        ...(name          !== undefined && { name }),
        ...(growDays      !== undefined && { growDays:      Number(growDays)      }),
        ...(difficulty    !== undefined && { difficulty }),
        ...(customPhases  !== undefined && { customPhases }),
        ...(seedCostG     !== undefined && { seedCostG:     Number(seedCostG)     }),
        ...(seedsPerTray  !== undefined && { seedsPerTray:  Number(seedsPerTray)  }),
        ...(harvestWeight !== undefined && { harvestWeight: Number(harvestWeight) }),
        ...(notes         !== undefined && { notes }),
      }
    });
    const updated = await prisma.cropType.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.cropType.deleteMany({ where: { id: Number(req.params.id), userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
