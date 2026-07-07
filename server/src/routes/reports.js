const express = require('express');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { COMMISSION_UNDER_THRESHOLD, COMMISSION_OVER_THRESHOLD } = require('../config/constants');
const { sendSalesVerificationEmail } = require('../services/emailService');

const router = express.Router();

// GET /api/reports — ADMIN only
router.get('/', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { eventId } = req.query;
    const where = eventId ? { shift: { eventId } } : {};
    const reports = await prisma.report.findMany({
      where,
      include: {
        sales: true,
        shift: {
          include: {
            event: true,
            ambassador: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/mine — ambassador's own reports
router.get('/mine', verifyToken, requireRole('AMBASSADOR'), async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { shift: { ambassadorId: req.user.id } },
      include: { sales: true, shift: { include: { event: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reports
router.post('/', verifyToken, async (req, res) => {
  try {
    const { shiftId, feedback, issues, mealsSold, sales } = req.body;
    if (!shiftId || !feedback) {
      return res.status(400).json({ error: 'shiftId and feedback are required' });
    }

    const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { event: true } });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.ambassadorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your shift' });
    }

    const existing = await prisma.report.findUnique({ where: { shiftId } });
    if (existing) return res.status(409).json({ error: 'Report already submitted for this shift' });

    const parsedMealsSold = parseInt(mealsSold) || 0;
    const saleRows = Array.isArray(sales) ? sales : [];
    const mealsPerSale =
      saleRows.length > 0
        ? Math.round((parsedMealsSold / saleRows.length) * 100) / 100
        : null;

    const report = await prisma.report.create({
      data: {
        shiftId,
        feedback,
        issues: issues || null,
        mealsSold: parsedMealsSold,
        totalSales: saleRows.length,
        mealsPerSale,
        sales: {
          create: saleRows.map((s) => ({
            overThreshold: !!s.overThreshold,
            commission: s.overThreshold ? COMMISSION_OVER_THRESHOLD : COMMISSION_UNDER_THRESHOLD,
          })),
        },
      },
      include: { sales: true },
    });

    // Increment ambassador's lifetime sales count
    if (shift.ambassadorId && saleRows.length > 0) {
      await prisma.user.update({
        where: { id: shift.ambassadorId },
        data: { lifetimeSalesCount: { increment: saleRows.length } },
      });
    }

    // Notify staff to verify sales against Shopify before commission is paid
    if (report.sales.length > 0) {
      const [ambassador, staff] = await Promise.all([
        shift.ambassadorId
          ? prisma.user.findUnique({ where: { id: shift.ambassadorId }, select: { firstName: true, lastName: true } })
          : null,
        prisma.user.findMany({ where: { role: { in: ['ADMIN', 'EVENT_COORDINATOR'] } }, select: { email: true } }),
      ]);
      const staffEmails = staff.map((u) => u.email);
      if (staffEmails.length > 0) {
        sendSalesVerificationEmail(staffEmails, shift.event, ambassador, report).catch((err) =>
          console.error('[SALES VERIFY EMAIL]', err)
        );
      }
    }

    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/reports/:reportId/sales/:saleId/verify — admin verifies (or corrects) a sale's tier
router.put('/:reportId/sales/:saleId/verify', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { overThreshold } = req.body;
    if (typeof overThreshold !== 'boolean') {
      return res.status(400).json({ error: 'overThreshold (boolean) is required' });
    }

    const sale = await prisma.sale.findUnique({ where: { id: req.params.saleId } });
    if (!sale || sale.reportId !== req.params.reportId) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const updated = await prisma.sale.update({
      where: { id: sale.id },
      data: {
        overThreshold,
        commission: overThreshold ? COMMISSION_OVER_THRESHOLD : COMMISSION_UNDER_THRESHOLD,
        verified: true,
        verifiedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
