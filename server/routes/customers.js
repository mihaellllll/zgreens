const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' },
    });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body;
    const customer = await prisma.customer.create({
      data: { userId: req.user.id, name, email: email || '', phone: phone || '', notes: notes || '' }
    });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body;
    const customer = await prisma.customer.updateMany({
      where: { id: Number(req.params.id), userId: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(notes !== undefined && { notes }),
      }
    });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
