const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/harvests — all records ordered by date desc
router.get('/', auth, async (req, res) => {
  try {
    const harvests = await prisma.harvest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(harvests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/harvests — create record
router.post('/', auth, async (req, res) => {
  const { cropKey, cropName, yieldG, date, regal, shelf, tray } = req.body;
  try {
    const record = await prisma.harvest.create({
      data: { cropKey, cropName, yieldG: Number(yieldG), date, regal, shelf, tray },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/harvests — delete all
router.delete('/', auth, async (req, res) => {
  try {
    await prisma.harvest.deleteMany();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/harvests/:id — delete one
router.delete('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await prisma.harvest.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
