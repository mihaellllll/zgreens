const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/seeds — { cropKey: grams, ... } for current user
router.get('/', auth, async (req, res) => {
  try {
    const rows = await prisma.seedStorage.findMany({ where: { userId: req.user.id } });
    const result = {};
    rows.forEach(r => { result[r.cropKey] = r.grams; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seeds/:cropKey/add — increment grams
router.post('/:cropKey/add', auth, async (req, res) => {
  const { cropKey } = req.params;
  const userId = req.user.id;
  const { grams } = req.body;
  try {
    const existing = await prisma.seedStorage.findUnique({ where: { cropKey_userId: { cropKey, userId } } });
    const current  = existing?.grams ?? 0;
    const record   = await prisma.seedStorage.upsert({
      where:  { cropKey_userId: { cropKey, userId } },
      create: { userId, cropKey, grams: current + Number(grams) },
      update: { grams: current + Number(grams) },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seeds/:cropKey/deduct — decrement, floor at 0
router.post('/:cropKey/deduct', auth, async (req, res) => {
  const { cropKey } = req.params;
  const userId = req.user.id;
  const { grams } = req.body;
  try {
    const existing = await prisma.seedStorage.findUnique({ where: { cropKey_userId: { cropKey, userId } } });
    const current  = existing?.grams ?? 0;
    const newGrams = Math.max(0, current - Number(grams));
    const record   = await prisma.seedStorage.upsert({
      where:  { cropKey_userId: { cropKey, userId } },
      create: { userId, cropKey, grams: newGrams },
      update: { grams: newGrams },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seeds/:cropKey/set — absolute set (import)
router.post('/:cropKey/set', auth, async (req, res) => {
  const { cropKey } = req.params;
  const userId = req.user.id;
  const { grams } = req.body;
  try {
    const record = await prisma.seedStorage.upsert({
      where:  { cropKey_userId: { cropKey, userId } },
      create: { userId, cropKey, grams: Number(grams) },
      update: { grams: Number(grams) },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
