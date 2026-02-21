const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/seeds — { cropKey: grams, ... }
router.get('/', auth, async (req, res) => {
  try {
    const rows = await prisma.seedStorage.findMany();
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
  const { grams } = req.body;
  try {
    const existing = await prisma.seedStorage.findUnique({ where: { cropKey } });
    const current  = existing?.grams ?? 0;
    const record   = await prisma.seedStorage.upsert({
      where:  { cropKey },
      create: { cropKey, grams: current + Number(grams) },
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
  const { grams } = req.body;
  try {
    const existing = await prisma.seedStorage.findUnique({ where: { cropKey } });
    const current  = existing?.grams ?? 0;
    const newGrams = Math.max(0, current - Number(grams));
    const record   = await prisma.seedStorage.upsert({
      where:  { cropKey },
      create: { cropKey, grams: newGrams },
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
  const { grams } = req.body;
  try {
    const record = await prisma.seedStorage.upsert({
      where:  { cropKey },
      create: { cropKey, grams: Number(grams) },
      update: { grams: Number(grams) },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
