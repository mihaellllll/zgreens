const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/inventory — Returns available harvested grams grouped by cropName
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Sum yields from harvests
    const harvests = await prisma.harvest.groupBy({
      by: ['cropName'],
      where: { userId },
      _sum: { yieldG: true }
    });
    
    // Sum quantities from sales
    // Since SaleItem doesn't have a userId directly, we filter via the Sale relation
    const sales = await prisma.saleItem.groupBy({
      by: ['cropName'],
      where: { sale: { userId } },
      _sum: { quantityG: true }
    });

    const inventory = {};
    
    harvests.forEach(h => {
      inventory[h.cropName] = h._sum.yieldG || 0;
    });

    sales.forEach(s => {
      if (inventory[s.cropName]) {
        inventory[s.cropName] -= (s._sum.quantityG || 0);
      }
    });

    // Floor at 0 just in case
    Object.keys(inventory).forEach(k => {
      inventory[k] = Math.max(0, inventory[k]);
    });

    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
