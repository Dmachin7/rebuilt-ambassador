import React, { useEffect, useState } from 'react';
import { paymentsAPI } from '../../api/index.js';
import { Card, Badge, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatCurrency, formatHours, formatDate } from '../../utils/formatters.js';

export default function Earnings() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsAPI.list().then(setPayments).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const lifetimeTotal = payments.reduce((s, p) => s + p.amount, 0);
  const monthTotal = payments.filter((p) => new Date(p.createdAt) >= startOfMonth).reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);
  const lifetimeHours = payments.reduce((s, p) => s + p.hoursWorked, 0);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Earnings</h1>
        <p className="text-sm text-slate-500">$20/hr · {formatHours(lifetimeHours)} total</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-slate-500 mb-1">This Month</div>
          <div className="text-2xl font-bold text-mint-600">{formatCurrency(monthTotal)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 mb-1">Lifetime Total</div>
          <div className="text-2xl font-bold text-slate-800">{formatCurrency(lifetimeTotal)}</div>
        </Card>
      </div>

      {pendingTotal > 0 && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-orange-700">Pending Payment</p>
              <p className="text-xs text-orange-500 mt-0.5">Awaiting admin approval</p>
            </div>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(pendingTotal)}</div>
          </div>
        </Card>
      )}

      {/* Payment history */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-3 text-sm">Payment History</h2>
        {payments.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon="💰" title="No payments yet" description="Payments appear here after you check out from a shift" />
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm truncate">{p.shift.event.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{formatDate(p.shift.event.date)}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatHours(p.hoursWorked)} × $20/hr</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-slate-800">{formatCurrency(p.amount)}</div>
                    <div className="mt-1"><Badge status={p.status} /></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
