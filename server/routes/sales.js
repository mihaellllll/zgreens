const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      where: { userId: req.user.id },
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
        userId: req.user.id,
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

router.patch('/:id', auth, async (req, res) => {
  try {
    const { paid } = req.body;
    const sale = await prisma.sale.updateMany({
      where: { id: Number(req.params.id), userId: req.user.id },
      data: { ...(paid !== undefined && { paid }) },
    });
    if (sale.count === 0) return res.status(404).json({ error: 'Prodaja nije pronađena' });
    const updated = await prisma.sale.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
      include: { customer: true, items: true }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.sale.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'Prodaja nije pronađena' });

    const { customerId, date, notes, items } = req.body;
    const total = items.reduce((sum, item) => sum + (Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0), 0);

    await prisma.saleItem.deleteMany({ where: { saleId: id } });

    const sale = await prisma.sale.update({
      where: { id },
      data: {
        customerId: customerId ? Number(customerId) : null,
        date: date ? new Date(date) : existing.date,
        total,
        notes: notes || '',
        items: {
          create: items.map(item => ({
            batchId: item.batchId ? Number(item.batchId) : null,
            cropName: item.cropName,
            quantityG: Number(item.quantityG),
            pricePerG: Number(item.pricePerG),
            subtotal: (Number(item.quantityG) || 0) * (Number(item.pricePerG) || 0),
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
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      // Verify ownership first
      const sale = await tx.sale.findFirst({ where: { id, userId: req.user.id } });
      if (!sale) return;
      // Explicitly remove items before sale (ensures profitability data is clean)
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
