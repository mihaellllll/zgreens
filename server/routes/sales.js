const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: { customer: true, items: { include: { batch: { include: { cropType: true } } } } },
      orderBy: { date: 'desc' }
    });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { customerId, date, notes, items } = req.body;
    const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const sale = await prisma.sale.create({
      data: {
        customerId: customerId ? Number(customerId) : null,
        date: date ? new Date(date) : new Date(),
        total,
        notes: notes || '',
        items: {
          create: items.map(item => ({
            batchId: item.batchId ? Number(item.batchId) : null,
            cropName: item.cropName,
            quantityG: Number(item.quantityG),
            pricePerG: Number(item.pricePerG),
            subtotal: Number(item.subtotal),
          }))
        }
      },
      include: { customer: true, items: true }
    });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.sale.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
