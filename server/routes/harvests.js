const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/harvests — all records for current user, ordered by date desc
router.get('/', auth, async (req, res) => {
  try {
    const harvests = await prisma.harvest.findMany({
      where: { userId: req.user.id },
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
      data: { userId: req.user.id, cropKey, cropName, yieldG: Number(yieldG), date, regal, shelf, tray },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/harvests/:id — update yield
router.patch('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { yieldG } = req.body;
  try {
    const existing = await prisma.harvest.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'Berba nije pronađena' });
    const updated = await prisma.harvest.update({
      where: { id },
      data: { yieldG: Number(yieldG) },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/harvests — delete all for current user
router.delete('/', auth, async (req, res) => {
  try {
    await prisma.harvest.deleteMany({ where: { userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/harvests/:id — delete one (scoped to user)
router.delete('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await prisma.harvest.deleteMany({ where: { id, userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
