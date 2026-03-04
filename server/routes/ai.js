const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');
const { generateTasks } = require('../utils/tasks');

const prisma = new PrismaClient();

// ─── Server-side phase builder (mirrors client cropData.js) ───────────────────

function buildPhasesServer(growDays) {
  const phases = [{ day: 1, label: 'Sjetva', stage: 'seed' }];
  const blackout = Math.round(growDays * 0.3);
  const light    = Math.round(growDays * 0.5);
  if (blackout > 1) phases.push({ day: blackout, label: 'Blackout', stage: 'blackout' });
  if (light > blackout) phases.push({ day: light, label: 'Svijetlo', stage: 'light' });
  const mid = Math.round((light + growDays) / 2);
  if (mid > light && mid < growDays) phases.push({ day: mid, label: 'Rast', stage: 'growing' });
  phases.push({ day: growDays, label: 'Berba', stage: 'ready' });
  return phases;
}

function getTrayPhase(cropKey, plantedDate, cropMap) {
  const crop = cropMap[cropKey];
  if (!crop) return null;

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

// ─── Farm action tools (dynamic crop names) ───────────────────────────────────

function buildFarmTools(cropNames, regalConfigs) {
  const cropDesc   = cropNames.length > 0
    ? `Naziv usjeva. Dostupni: ${cropNames.join(', ')}`
    : 'Naziv usjeva (string)';
  const regalDesc  = regalConfigs.length > 0
    ? `ID regala. Dostupni: ${regalConfigs.map(r => `${r.id} (${r.name})`).join(', ')}`
    : 'ID regala (broj)';
  const maxSlot    = regalConfigs.length > 0
    ? Math.max(...regalConfigs.map(r => r.shelfCount * r.traysPerShelf - 1))
    : 15;

  return [
    {
      type: 'function',
      function: {
        name: 'add_seeds',
        description: 'Dodaj grame sjemena u skladište (primljeno/kupljeno sjeme).',
        parameters: {
          type: 'object',
          properties: {
            cropKey: { type: 'string', description: cropDesc },
            grams:   { type: 'number', description: 'Koliko grama dodati' },
          },
          required: ['cropKey', 'grams'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_seeds',
        description: 'Postavi točnu količinu sjemena u skladištu (inventura/ispravak).',
        parameters: {
          type: 'object',
          properties: {
            cropKey: { type: 'string', description: cropDesc },
            grams:   { type: 'number', description: 'Nova točna količina u gramima' },
          },
          required: ['cropKey', 'grams'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'record_harvest',
        description: 'Zabilježi berbu usjeva.',
        parameters: {
          type: 'object',
          properties: {
            cropKey: { type: 'string', description: cropDesc },
            yieldG:  { type: 'number', description: 'Prinos u gramima' },
            regal:   { type: 'number', description: regalDesc },
            shelf:   { type: 'number', description: 'Indeks police (0-N)', minimum: 0 },
            tray:    { type: 'number', description: 'Indeks plitice (0-N)', minimum: 0 },
          },
          required: ['cropKey', 'yieldG'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'clear_tray',
        description: 'Ukloni pliticu iz regala (ubrana ili propala).',
        parameters: {
          type: 'object',
          properties: {
            regal: { type: 'number', description: regalDesc },
            slot:  { type: 'number', description: `Indeks slota unutar regala (0-${maxSlot})`, minimum: 0 },
          },
          required: ['regal', 'slot'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'plant_tray',
        description: 'Posadi novi usjev u pliticu.',
        parameters: {
          type: 'object',
          properties: {
            regal:         { type: 'number', description: regalDesc },
            slot:          { type: 'number', description: `Indeks slota unutar regala (0-${maxSlot})`, minimum: 0 },
            cropKey:       { type: 'string', description: cropDesc },
            plantedDate:   { type: 'string', description: 'Datum sadnje u formatu YYYY-MM-DD' },
            seedsToDeduct: { type: 'number', description: 'Grama sjemena oduzeti iz skladišta (opcionalno)' },
          },
          required: ['regal', 'slot', 'cropKey', 'plantedDate'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_sale',
        description: 'Dodaj novu prodaju s stavkama (usjev, količina, cijena).',
        parameters: {
          type: 'object',
          properties: {
            date:         { type: 'string', description: 'Datum prodaje u formatu YYYY-MM-DD' },
            items:        {
              type: 'array',
              description: 'Stavke prodaje',
              items: {
                type: 'object',
                properties: {
                  cropName:  { type: 'string', description: cropDesc },
                  quantityG: { type: 'number', description: 'Količina u gramima' },
                  pricePerG: { type: 'number', description: 'Cijena po gramu u eurima' },
                },
                required: ['cropName', 'quantityG', 'pricePerG'],
              },
            },
            customerName: { type: 'string', description: 'Ime kupca (opcionalno, traži se po imenu)' },
            notes:        { type: 'string', description: 'Bilješka (opcionalno)' },
          },
          required: ['date', 'items'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_customer',
        description: 'Dodaj novog kupca u bazu.',
        parameters: {
          type: 'object',
          properties: {
            name:  { type: 'string', description: 'Ime kupca' },
            email: { type: 'string', description: 'Email adresa (opcionalno)' },
            phone: { type: 'string', description: 'Broj telefona (opcionalno)' },
            notes: { type: 'string', description: 'Bilješka (opcionalno)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Napravi ručni zadatak.',
        parameters: {
          type: 'object',
          properties: {
            title:   { type: 'string', description: 'Naziv zadatka' },
            dueDate: { type: 'string', description: 'Rok u formatu YYYY-MM-DD' },
          },
          required: ['title', 'dueDate'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mark_sale_paid',
        description: 'Označi prodaju kao plaćenu ili neplaćenu.',
        parameters: {
          type: 'object',
          properties: {
            saleId: { description: 'ID prodaje (broj ili string, npr. "5")' },
            paid:   { type: 'boolean', description: 'true = plaćeno, false = neplaćeno' },
          },
          required: ['saleId', 'paid'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_sale',
        description: 'Trajno obriši prodaju (i sve njene stavke).',
        parameters: {
          type: 'object',
          properties: {
            saleId: { description: 'ID prodaje za brisanje (broj ili string)' },
          },
          required: ['saleId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_harvest',
        description: 'Trajno obriši zapis o berbi.',
        parameters: {
          type: 'object',
          properties: {
            harvestId: { description: 'ID berbe za brisanje (broj ili string)' },
          },
          required: ['harvestId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_task',
        description: 'Trajno obriši zadatak.',
        parameters: {
          type: 'object',
          properties: {
            taskId: { description: 'ID zadatka za brisanje (broj ili string)' },
          },
          required: ['taskId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_customer',
        description: 'Trajno obriši kupca iz baze prema imenu.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: 'Ime kupca za brisanje (traži se po imenu, djelomično podudaranje)' },
          },
          required: ['customerName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_crop',
        description: 'Trajno obriši usjev iz knjižnice (po imenu).',
        parameters: {
          type: 'object',
          properties: {
            cropName: { type: 'string', description: 'Ime usjeva za brisanje' },
          },
          required: ['cropName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_regal',
        description: 'Trajno obriši regal prema imenu (samo ako je prazan — nema posađenih plitica).',
        parameters: {
          type: 'object',
          properties: {
            regalName: { type: 'string', description: 'Ime regala za brisanje' },
          },
          required: ['regalName'],
        },
      },
    },
  ];
}

async function executeTool(name, args, userId, cropMap) {
  switch (name) {
    case 'add_seeds': {
      const { cropKey, grams } = args;
      const existing = await prisma.seedStorage.findUnique({ where: { cropKey_userId: { cropKey, userId } } });
      const newGrams = (existing?.grams ?? 0) + grams;
      await prisma.seedStorage.upsert({
        where:  { cropKey_userId: { cropKey, userId } },
        create: { userId, cropKey, grams: newGrams },
        update: { grams: newGrams },
      });
      const cropName = cropMap[cropKey]?.name ?? cropKey;
      return `Dodano ${grams}g sjemena za ${cropName}. Novo stanje: ${newGrams}g.`;
    }

    case 'set_seeds': {
      const { cropKey, grams } = args;
      await prisma.seedStorage.upsert({
        where:  { cropKey_userId: { cropKey, userId } },
        create: { userId, cropKey, grams },
        update: { grams },
      });
      const cropName = cropMap[cropKey]?.name ?? cropKey;
      return `Zaliha za ${cropName} postavljena na ${grams}g.`;
    }

    case 'record_harvest': {
      const { cropKey } = args;
      const yieldG = Number(args.yieldG ?? 0);
      const regal  = Number(args.regal  ?? 0);
      const shelf  = Number(args.shelf  ?? 0);
      const tray   = Number(args.tray   ?? 0);
      const cropName = cropMap[cropKey]?.name ?? cropKey;
      const today = new Date().toISOString().slice(0, 10);
      await prisma.harvest.create({
        data: { userId, cropKey, cropName, yieldG, regal, shelf, tray, date: today },
      });
      return `Berba zabilježena: ${cropName} ${yieldG}g (R${regal}, P${shelf + 1}, T${tray + 1}).`;
    }

    case 'clear_tray': {
      const regal = Number(args.regal);
      const slot  = Number(args.slot);
      await prisma.traySlot.deleteMany({ where: { regal, slot, userId } });
      return `Plitice regal ${regal} slot ${slot} očišćena.`;
    }

    case 'plant_tray': {
      const regal = Number(args.regal);
      const slot  = Number(args.slot);
      const { cropKey, plantedDate } = args;
      const seedsToDeduct = Number(args.seedsToDeduct ?? 0);

      await prisma.$transaction(async (tx) => {
        // 1. Find or create CropType
        let cropType = await tx.cropType.findFirst({ where: { name: cropKey, userId } });
        if (!cropType) {
          cropType = await tx.cropType.create({ data: { userId, name: cropKey, growDays: 10 } });
        }

        // 2. Create Batch
        const sow = new Date(plantedDate);
        const expectedHarvestDate = new Date(sow);
        expectedHarvestDate.setDate(expectedHarvestDate.getDate() + cropType.growDays);
        const batch = await tx.batch.create({
          data: {
            userId,
            cropTypeId: cropType.id,
            sowDate: sow,
            expectedHarvestDate,
            trayCount: 1,
            notes: `AI asistent: Regal ${regal}, Slot ${slot}`,
            status: 'germinating',
          },
          include: { cropType: true },
        });

        // 3. Auto-add seed cost
        const gramsUsed = seedsToDeduct || cropType.seedsPerTray || 0;
        if (cropType.seedCostG > 0 && gramsUsed > 0) {
          await tx.cost.create({
            data: {
              batchId: batch.id,
              category: 'seed',
              amount: cropType.seedCostG * gramsUsed,
              note: `Sjeme: ${gramsUsed}g \u00d7 ${cropType.seedCostG}\u20ac/g`,
            },
          });
        }

        // 4. Upsert TraySlot with batchId
        await tx.traySlot.upsert({
          where:  { regal_slot_userId: { regal, slot, userId } },
          create: { userId, regal, slot, cropKey, plantedDate, notes: '', batchId: batch.id },
          update: { cropKey, plantedDate, notes: '', batchId: batch.id },
        });

        // 5. Deduct seeds from storage
        if (seedsToDeduct > 0) {
          const existing = await tx.seedStorage.findUnique({ where: { cropKey_userId: { cropKey, userId } } });
          const newGrams = Math.max(0, (existing?.grams ?? 0) - seedsToDeduct);
          await tx.seedStorage.upsert({
            where:  { cropKey_userId: { cropKey, userId } },
            create: { userId, cropKey, grams: newGrams },
            update: { grams: newGrams },
          });
        }

        // 6. Generate tasks
        await generateTasks(batch, userId, tx);
      });

      const cropName = cropMap[cropKey]?.name ?? cropKey;
      return `Posijano: ${cropName} u regal ${regal} slot ${slot}, datum sadnje ${plantedDate}${seedsToDeduct > 0 ? `, oduzeto ${seedsToDeduct}g sjemena` : ''}.`;
    }

    case 'create_sale': {
      const { date, items, customerName, notes = '' } = args;
      let customerId = null;
      if (customerName) {
        const customer = await prisma.customer.findFirst({ where: { userId, name: { contains: customerName } } });
        if (customer) customerId = customer.id;
      }
      const total = items.reduce((s, i) => s + (i.quantityG || 0) * (i.pricePerG || 0), 0);
      const sale = await prisma.sale.create({
        data: {
          userId,
          date: new Date(date),
          total,
          notes,
          customerId,
          items: {
            create: items.map(i => ({
              cropName: i.cropName,
              quantityG: i.quantityG,
              pricePerG: i.pricePerG,
              subtotal: (i.quantityG || 0) * (i.pricePerG || 0),
            })),
          },
        },
        include: { items: true, customer: true },
      });
      const buyer = sale.customer?.name ?? 'anonimno';
      const itemList = sale.items.map(i => `${i.cropName} ${i.quantityG}g`).join(', ');
      return `Prodaja #${sale.id} dodana: ${itemList} za ${buyer} — ukupno €${total.toFixed(2)}.`;
    }

    case 'create_customer': {
      const { name, email = '', phone = '', notes = '' } = args;
      const existing = await prisma.customer.findFirst({ where: { userId, name } });
      if (existing) return `Kupac "${name}" već postoji (ID ${existing.id}).`;
      const customer = await prisma.customer.create({ data: { userId, name, email, phone, notes } });
      return `Kupac "${customer.name}" dodan (ID ${customer.id}).`;
    }

    case 'create_task': {
      const { title, dueDate } = args;
      const task = await prisma.task.create({
        data: { userId, title, type: 'manual', dueDate: new Date(dueDate) },
      });
      return `Zadatak "${task.title}" kreiran za ${new Date(dueDate).toLocaleDateString('hr-HR')} (ID ${task.id}).`;
    }

    case 'mark_sale_paid': {
      const saleId = Number(args.saleId);
      const { paid } = args;
      const sale = await prisma.sale.findFirst({ where: { id: saleId, userId } });
      if (!sale) return `Prodaja #${saleId} nije pronađena.`;
      await prisma.sale.update({ where: { id: saleId }, data: { paid } });
      return `Prodaja #${saleId} označena kao ${paid ? 'plaćena' : 'neplaćena'}.`;
    }

    case 'delete_sale': {
      const saleId = Number(args.saleId);
      const sale = await prisma.sale.findFirst({ where: { id: saleId, userId } });
      if (!sale) return `Prodaja #${saleId} nije pronađena.`;
      await prisma.saleItem.deleteMany({ where: { saleId } });
      await prisma.sale.delete({ where: { id: saleId } });
      return `Prodaja #${saleId} trajno obrisana.`;
    }

    case 'delete_harvest': {
      const harvestId = Number(args.harvestId);
      const harvest = await prisma.harvest.findFirst({ where: { id: harvestId, userId } });
      if (!harvest) return `Berba #${harvestId} nije pronađena.`;
      await prisma.harvest.delete({ where: { id: harvestId } });
      return `Berba #${harvestId} (${harvest.cropName} ${harvest.yieldG}g) trajno obrisana.`;
    }

    case 'delete_task': {
      const taskId = Number(args.taskId);
      const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
      if (!task) return `Zadatak #${taskId} nije pronađen.`;
      await prisma.task.delete({ where: { id: taskId } });
      return `Zadatak #${taskId} "${task.title}" trajno obrisan.`;
    }

    case 'delete_customer': {
      const { customerName } = args;
      const customer = await prisma.customer.findFirst({ where: { userId, name: { contains: customerName } } });
      if (!customer) return `Kupac "${customerName}" nije pronađen.`;
      await prisma.customer.delete({ where: { id: customer.id } });
      return `Kupac "${customer.name}" (ID ${customer.id}) trajno obrisan.`;
    }

    case 'delete_crop': {
      const { cropName } = args;
      const crop = await prisma.cropType.findFirst({ where: { userId, name: { equals: cropName } } });
      if (!crop) return `Usjev "${cropName}" nije pronađen u knjižnici.`;
      await prisma.cropType.delete({ where: { id: crop.id } });
      return `Usjev "${cropName}" trajno obrisan iz knjižnice.`;
    }

    case 'delete_regal': {
      const { regalName } = args;
      const regal = await prisma.regal.findFirst({ where: { userId, name: { contains: regalName } } });
      if (!regal) return `Regal "${regalName}" nije pronađen.`;
      const occupiedTrays = await prisma.traySlot.count({ where: { regal: regal.id, userId } });
      if (occupiedTrays > 0) return `Regal "${regal.name}" nije prazan (${occupiedTrays} plitice). Prvo ukloni sve plitice.`;
      await prisma.regal.delete({ where: { id: regal.id } });
      return `Regal "${regal.name}" (ID ${regal.id}) trajno obrisan.`;
    }

    default:
      throw new Error(`Nepoznati alat: ${name}`);
  }
}

// ─── POST /api/ai/chat ─────────────────────────────────────────────────────────

router.post('/chat', auth, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Poruka je obavezna.' });

  // Resolve API key: user's DB key → env fallback → proxy
  const userRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { groqApiKey: true } });
  const resolvedApiKey = userRecord?.groqApiKey || process.env.GROQ_API_KEY || null;

  if (!resolvedApiKey && !process.env.AI_PROXY_URL) {
    return res.status(503).json({ error: 'Groq API ključ nije postavljen. Dodaj ga u Postavkama.' });
  }

  try {
    const now = new Date();

    // Fetch all farm data in parallel (scoped to current user)
    const [trays, seeds, harvests, sales, customers, userCrops, userRegals, openTasks] = await Promise.all([
      prisma.traySlot.findMany({ where: { userId: req.user.id }, orderBy: [{ regal: 'asc' }, { slot: 'asc' }] }),
      prisma.seedStorage.findMany({ where: { userId: req.user.id } }),
      prisma.harvest.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.sale.findMany({
        where: { userId: req.user.id },
        orderBy: { date: 'desc' }, take: 30,
        include: { items: true, customer: true },
      }),
      prisma.customer.findMany({ where: { userId: req.user.id }, orderBy: { name: 'asc' } }),
      prisma.cropType.findMany({ where: { userId: req.user.id } }),
      prisma.regal.findMany({ where: { userId: req.user.id }, orderBy: { order: 'asc' } }),
      prisma.task.findMany({ where: { userId: req.user.id, completed: false }, orderBy: { dueDate: 'asc' }, take: 30 }),
    ]);

    // Build crop map: { [name]: { name, harvestDay, phases } }
    const cropMap = {};
    userCrops.forEach(c => {
      let phases = null;
      if (c.customPhases) {
        try {
          const parsed = JSON.parse(c.customPhases);
          if (Array.isArray(parsed) && parsed.length > 0)
            phases = [...parsed].sort((a, b) => a.day - b.day);
        } catch {}
      }
      if (!phases) phases = buildPhasesServer(c.growDays);
      cropMap[c.name] = { name: c.name, harvestDay: c.growDays, phases };
    });

    // Build regal map: { [id]: regal }
    const regalMap = {};
    userRegals.forEach(r => { regalMap[r.id] = r; });

    // ── Trays with live phase info ──
    const trayLines   = [];
    const overdueList = [];
    const todayList   = [];
    const soonList    = [];

    trays.forEach(t => {
      const rc = regalMap[t.regal];
      const traysPerShelf = rc?.traysPerShelf ?? 4;
      const shelfLabel = `Polica ${Math.floor(t.slot / traysPerShelf) + 1}, Plitice ${(t.slot % traysPerShelf) + 1}`;
      const regalName  = rc?.name ?? `Regal ${t.regal}`;

      const p = getTrayPhase(t.cropKey, t.plantedDate, cropMap);
      if (!p) {
        trayLines.push(`  - ${regalName} ${shelfLabel}: ${t.cropKey}, posijano ${t.plantedDate}`);
        return;
      }

      const status = p.isOverdue ? ` ⚠ KASNO +${Math.abs(p.daysUntilHarvest)}d`
                   : p.isToday   ? ' ✓ BERBA DANAS'
                   : ` (berba za ${p.daysUntilHarvest}d)`;
      trayLines.push(
        `  - ${regalName} ${shelfLabel}: ${p.cropName}, Dan ${p.daysElapsed}, faza: ${p.currentPhase}${status}${t.notes ? ', bilješka: ' + t.notes : ''}`
      );

      const loc = `${regalName} ${shelfLabel}`;
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
      ? seeds.map(s => `  - ${s.cropKey}: ${s.grams}g`).join('\n')
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
            .map(h => `  - ${h.date}: ${h.cropName} ${h.yieldG}g`)
            .join('\n'),
        ].join('\n')
      : '  Nema zabilježenih berbi.';

    // ── Sales ──
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
          const status = s.paid ? 'plaćeno' : 'duguje';
          return `  - #${s.id} ${new Date(s.date).toLocaleDateString('hr-HR')}, ${buyer}: ${items} — €${s.total.toFixed(2)} [${status}]`;
        }).join('\n')
      : '  Nema prodaje.';

    // ── Customers ──
    const customerSummary = customers.length
      ? customers.map(c => `  - ID ${c.id}: ${c.name}${c.phone ? ', tel: ' + c.phone : ''}${c.notes ? ', napomena: ' + c.notes : ''}`).join('\n')
      : '  Nema kupaca.';

    // ── Open tasks ──
    const openTaskSummary = openTasks.length
      ? openTasks.map(t => `  - #${t.id} [${t.type}] ${t.title} — rok: ${new Date(t.dueDate).toLocaleDateString('hr-HR')}`).join('\n')
      : '  Nema otvorenih zadataka.';

    // ── Regals ──
    const regalSummary = userRegals.length
      ? userRegals.map(r => `  - ID ${r.id}: ${r.name} (${r.shelfCount} polica × ${r.traysPerShelf} plitice)`).join('\n')
      : '  Nema regala.';

    // ── Crops ──
    const cropSummary = userCrops.length
      ? userCrops.map(c => `  - ${c.name} (${c.growDays}d)${c.seedsPerTray > 0 ? `, sjeme/plitici: ${c.seedsPerTray}g` : ''}`).join('\n')
      : '  Nema usjeva.';

    const cropNames = userCrops.map(c => c.name);

    // ── System prompt ──
    const systemPrompt = `Ti si AI asistent za ZGreens — malu farmu microgreens biljaka.
Pomažeš farmeru ${req.user.name} s analizom podataka, preporukama i uvidima o uzgoju.
Odgovaraj isključivo na hrvatskom jeziku. Budi sažet, konkretan i koristan.
Ne izmišljaj podatke — koristi samo podatke navedene ispod.
Danas je ${now.toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

Možeš i izvršavati radnje na farmi koristeći dostupne alate.
Kada korisnik kaže da je primio sjeme, posadio plitice, ubrao urod, dodao prodaju,
kupca ili zadatak — koristi odgovarajući alat. Uvijek potvrdi što si napravio/la.
Alati: add_seeds (dodaj sjeme), set_seeds (postavi sjeme), record_harvest (zabilježi berbu),
clear_tray (ukloni pliticu), plant_tray (posadi pliticu), create_sale (dodaj prodaju),
create_customer (dodaj kupca), create_task (napravi zadatak), mark_sale_paid (označi plaćeno),
delete_sale (obriši prodaju po ID), delete_harvest (obriši berbu po ID), delete_task (obriši zadatak po ID),
delete_customer (obriši kupca po imenu — customerName), delete_crop (obriši usjev po imenu),
delete_regal (obriši regal po imenu — regalName).
VAŽNO: delete_customer koristi customerName (ne ID), delete_regal koristi regalName (ne ID).
Nazivi usjeva (cropKey): ${cropNames.length > 0 ? cropNames.join(', ') : '(nema usjeva)'}

=== USJEVI U KNJIŽNICI ===
${cropSummary}

=== REGALI ===
${regalSummary}

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
${customerSummary}

=== ZADACI (otvoreni) ===
${openTaskSummary}`;

    const FARM_TOOLS = buildFarmTools(cropNames, userRegals);
    const userMsg    = { role: 'user', content: message };
    const historyMsgs = history.map(m => ({ role: m.role, content: m.text }));

    const proxyUrl    = process.env.AI_PROXY_URL;
    const proxySecret = process.env.AI_PROXY_SECRET;

    const callGroq = async (msgs, includeTools) => {
      if (proxyUrl) {
        const body = { messages: msgs };
        if (includeTools) body.tools = FARM_TOOLS;
        const r = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-proxy-secret': proxySecret || '' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }

      const groq = new Groq({ apiKey: resolvedApiKey });
      const params = { model: 'llama-3.3-70b-versatile', max_tokens: 1024, messages: msgs };
      if (includeTools) params.tools = FARM_TOOLS;
      const response = await groq.chat.completions.create(params);
      const msg = response.choices[0].message;
      if (msg.tool_calls?.length) return { toolCalls: msg.tool_calls, assistantMessage: msg };
      return { reply: msg.content };
    };

    const baseMsgs = [{ role: 'system', content: systemPrompt }, ...historyMsgs, userMsg];

    // 1. First call — with tools; fall back to no-tools on tool_use_failed
    let firstData;
    try {
      firstData = await callGroq(baseMsgs, true);
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (msg.includes('tool_use_failed') || msg.includes('Failed to call a function')) {
        // Model generated malformed tool call — retry as plain text
        firstData = await callGroq(baseMsgs, false);
      } else {
        throw err;
      }
    }

    let finalReply;
    let actionsExecuted = false;

    if (firstData.toolCalls?.length) {
      // 2. Execute each tool
      const toolResultMsgs = [];
      for (const tc of firstData.toolCalls) {
        let resultContent;
        try {
          let args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
          // Unwrap if model incorrectly wraps args in an array
          if (Array.isArray(args)) args = args[0] ?? {};
          resultContent = await executeTool(tc.function.name, args, req.user.id, cropMap);
        } catch (e) {
          resultContent = `Greška pri izvođenju ${tc.function.name}: ${e.message}`;
        }
        toolResultMsgs.push({ role: 'tool', tool_call_id: tc.id, content: resultContent });
      }

      // 3. Second call — confirmation reply
      const followUpMsgs = [
        { role: 'system', content: systemPrompt },
        ...historyMsgs,
        userMsg,
        firstData.assistantMessage,
        ...toolResultMsgs,
      ];
      const secondData = await callGroq(followUpMsgs, false);
      finalReply = secondData.reply;
      actionsExecuted = true;
    } else {
      finalReply = firstData.reply;
    }

    res.json({ reply: finalReply, actionsExecuted });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
