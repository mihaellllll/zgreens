const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── Crop phase data (mirrors client/src/data/cropData.js) ────────────────────

const CROP_DATA = {
  dragoljub: {
    name: 'Dragoljub', harvestDay: 14,
    phases: [
      { day: 1,  label: 'Sjetva',   stage: 'seed'    },
      { day: 6,  label: 'Provjera', stage: 'sprout'  },
      { day: 8,  label: 'Svijetlo', stage: 'light'   },
      { day: 10, label: 'Rast',     stage: 'growing' },
      { day: 14, label: 'Berba',    stage: 'ready'   },
    ],
  },
  brokula: {
    name: 'Brokula', harvestDay: 10,
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 4,  label: 'Blackout', stage: 'blackout'},
      { day: 6,  label: 'Svijetlo', stage: 'light'   },
      { day: 7,  label: 'Rast',     stage: 'growing' },
      { day: 10, label: 'Berba',    stage: 'ready'   },
    ],
  },
  gorusica: {
    name: 'Gorušica', harvestDay: 10,
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 4,  label: 'Blackout', stage: 'blackout'},
      { day: 6,  label: 'Svijetlo', stage: 'light'   },
      { day: 7,  label: 'Rast',     stage: 'growing' },
      { day: 10, label: 'Berba',    stage: 'ready'   },
    ],
  },
  rotkvica: {
    name: 'Crvena Rotkvica', harvestDay: 10,
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 4,  label: 'Blackout', stage: 'blackout'},
      { day: 6,  label: 'Svijetlo', stage: 'light'   },
      { day: 7,  label: 'Rast',     stage: 'growing' },
      { day: 10, label: 'Berba',    stage: 'ready'   },
    ],
  },
  bosiljak: {
    name: 'Crveni Bosiljak', harvestDay: 14,
    phases: [
      { day: 1,  label: 'Sadnja',   stage: 'seed'    },
      { day: 5,  label: 'Blackout', stage: 'blackout'},
      { day: 7,  label: 'Svijetlo', stage: 'light'   },
      { day: 8,  label: 'Rast',     stage: 'growing' },
      { day: 14, label: 'Berba',    stage: 'ready'   },
    ],
  },
};

function getTrayPhase(cropKey, plantedDate) {
  const crop = CROP_DATA[cropKey];
  if (!crop) return null;

  // Parse as local date to avoid UTC midnight timezone shift
  const [py, pm, pd] = plantedDate.split('-').map(Number);
  const planted = new Date(py, pm - 1, pd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysElapsed = Math.floor((today - planted) / 86400000) + 1;

  let phaseIdx = 0;
  for (let i = 0; i < crop.phases.length; i++) {
    if (daysElapsed >= crop.phases[i].day) phaseIdx = i;
  }

  const daysUntilHarvest = crop.harvestDay - daysElapsed;
  const nextPhase  = crop.phases[phaseIdx + 1] ?? null;
  const laterPhase = crop.phases[phaseIdx + 2] ?? null;

  return {
    cropName: crop.name,
    currentPhase: crop.phases[phaseIdx].label,
    daysElapsed,
    daysUntilHarvest,
    isOverdue: daysElapsed > crop.harvestDay,
    isToday:   daysUntilHarvest === 0,
    nextPhase,
    laterPhase,
  };
}

const SHELF_LABEL = slot => `Polica ${Math.floor(slot / 4) + 1}, Plitice ${(slot % 4) + 1}`;

// ─── POST /api/ai/chat ─────────────────────────────────────────────────────────

router.post('/chat', auth, async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY nije postavljen na serveru.' });
  }

  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Poruka je obavezna.' });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const now  = new Date();

    // Fetch all farm data in parallel
    const [trays, seeds, harvests, sales, customers] = await Promise.all([
      prisma.traySlot.findMany({ orderBy: [{ regal: 'asc' }, { slot: 'asc' }] }),
      prisma.seedStorage.findMany(),
      prisma.harvest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.sale.findMany({
        orderBy: { date: 'desc' }, take: 30,
        include: { items: true, customer: true },
      }),
      prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    ]);

    // ── Trays with live phase info ──
    const trayLines   = [];
    const overdueList = [];
    const todayList   = [];
    const soonList    = [];

    trays.forEach(t => {
      const p = getTrayPhase(t.cropKey, t.plantedDate);
      if (!p) {
        trayLines.push(`  - R${t.regal + 1} ${SHELF_LABEL(t.slot)}: ${t.cropKey}, posijano ${t.plantedDate}`);
        return;
      }

      const status = p.isOverdue  ? ` ⚠ KASNO +${Math.abs(p.daysUntilHarvest)}d`
                   : p.isToday    ? ' ✓ BERBA DANAS'
                   : ` (berba za ${p.daysUntilHarvest}d)`;
      trayLines.push(
        `  - R${t.regal + 1} ${SHELF_LABEL(t.slot)}: ${p.cropName}, Dan ${p.daysElapsed}, faza: ${p.currentPhase}${status}${t.notes ? ', bilješka: ' + t.notes : ''}`
      );

      const loc = `R${t.regal + 1} ${SHELF_LABEL(t.slot)}`;
      if (p.isOverdue || p.isToday) {
        overdueList.push(`${p.cropName} @ ${loc}`);
      }
      if (p.nextPhase) {
        const daysToNext = p.nextPhase.day - p.daysElapsed;
        if (daysToNext <= 0) {
          todayList.push(`${p.cropName} @ ${loc}: ${p.nextPhase.label}`);
        } else if (daysToNext <= 3) {
          soonList.push(`${p.cropName} @ ${loc}: ${p.nextPhase.label} za ${daysToNext}d`);
        }
      }
    });

    const traySummary = trayLines.length ? trayLines.join('\n') : '  Nema aktivnih plitice.';

    const taskSummary = [
      overdueList.length ? `Hitno — berba ili kasno:\n${overdueList.map(x => '  - ' + x).join('\n')}` : '',
      todayList.length   ? `Danas:\n${todayList.map(x => '  - ' + x).join('\n')}` : '',
      soonList.length    ? `Uskoro (1–3 dana):\n${soonList.map(x => '  - ' + x).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') || '  Nema hitnih zadataka.';

    // ── Seeds ──
    const seedSummary = seeds.length
      ? seeds.map(s => `  - ${CROP_DATA[s.cropKey]?.name ?? s.cropKey}: ${s.grams}g`).join('\n')
      : '  Nema podataka o zalihama.';

    // ── Harvests ──
    const harvestByCrop = {};
    harvests.forEach(h => {
      if (!harvestByCrop[h.cropName]) harvestByCrop[h.cropName] = { count: 0, totalG: 0 };
      harvestByCrop[h.cropName].count++;
      harvestByCrop[h.cropName].totalG += h.yieldG || 0;
    });
    const totalHarvestedG = harvests.reduce((s, h) => s + (h.yieldG || 0), 0);

    const harvestSummary = harvests.length
      ? [
          `Po usjevu:\n` + (Object.entries(harvestByCrop)
            .sort((a, b) => b[1].totalG - a[1].totalG)
            .map(([name, d]) => `  - ${name}: ${d.count}× berbi, ${d.totalG}g ukupno`)
            .join('\n')),
          `Zadnjih ${Math.min(harvests.length, 10)} berbi:\n` + harvests.slice(0, 10)
            .map(h => `  - ${h.date}: ${h.cropName} ${h.yieldG}g, R${h.regal + 1} P${h.shelf + 1} T${h.tray + 1}`)
            .join('\n'),
        ].join('\n')
      : '  Nema zabilježenih berbi.';

    // ── Sales & profitability ──
    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);

    const revenuePerCrop = {};
    sales.forEach(s => s.items.forEach(i => {
      revenuePerCrop[i.cropName] = (revenuePerCrop[i.cropName] || 0) + i.subtotal;
    }));
    const revenueByCrop = Object.entries(revenuePerCrop).length
      ? Object.entries(revenuePerCrop).sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  - ${k}: ${v.toFixed(2)}`).join('\n')
      : '  Nema podataka.';

    const salesDetail = sales.length
      ? sales.slice(0, 15).map(s => {
          const buyer = s.customer?.name ?? 'anonimno';
          const items = s.items.map(i => `${i.cropName} ${i.quantityG}g`).join(', ');
          return `  - ${new Date(s.date).toLocaleDateString('hr-HR')}, ${buyer}: ${items} — ${s.total.toFixed(2)}`;
        }).join('\n')
      : '  Nema prodaje.';

    // ── Customers ──
    const customerSummary = customers.length
      ? customers.map(c => `  - ${c.name}${c.phone ? ', tel: ' + c.phone : ''}${c.notes ? ', napomena: ' + c.notes : ''}`).join('\n')
      : '  Nema kupaca.';

    // ── System prompt ──
    const systemPrompt = `Ti si AI asistent za ZGreens — malu farmu microgreens biljaka.
Pomažeš farmeru ${req.user.name} s analizom podataka, preporukama i uvidima o uzgoju.
Odgovaraj isključivo na hrvatskom jeziku. Budi sažet, konkretan i koristan.
Ne izmišljaj podatke — koristi samo podatke navedene ispod.
Danas je ${now.toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

=== PLITICE — ${trays.length} aktivnih ===
${traySummary}

=== ZADACI (generirano iz plitice) ===
${taskSummary}

=== SKLADIŠTE SJEMENA ===
${seedSummary}

=== BERBE — ukupno ${harvests.length} berbi, ${totalHarvestedG}g ===
${harvestSummary}

=== PRODAJA — ${sales.length} prodaja, ukupno ${totalRevenue.toFixed(2)} ===
${salesDetail}

=== PRIHOD PO USJEVU ===
${revenueByCrop}

=== KUPCI ===
${customerSummary}`;

    const chatMessages = [
      ...history.map(m => ({ role: m.role, content: m.text })),
      { role: 'user', content: message },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatMessages,
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
