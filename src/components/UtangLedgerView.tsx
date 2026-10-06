import React, { useState } from 'react';
import { SaleTransaction } from '../types';
import { User, CheckCircle2, Clock, Calendar, Search, DollarSign, AlertCircle } from 'lucide-react';
import { playCheckoutChime } from '../utils/audio';

interface UtangLedgerViewProps {
  sales: SaleTransaction[];
  onSettleCredit: (transactionId: string) => void;
}

export const UtangLedgerView: React.FC<UtangLedgerViewProps> = ({
  sales,
  onSettleCredit,
}) => {
  const [filter, setFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [search, setSearch] = useState('');

  const creditTransactions = sales.filter((s) => s.paymentMethod === 'utang');

  const filtered = creditTransactions.filter((s) => {
    const isPaid = s.isCreditSettled === true;
    if (filter === 'unpaid' && isPaid) return false;
    if (filter === 'paid' && !isPaid) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const debtor = (s.customerName || '').toLowerCase();
      const receipt = (s.receiptNumber || '').toLowerCase();
      return debtor.includes(q) || receipt.includes(q);
    }
    return true;
  });

  const totalUnpaidAmount = creditTransactions
    .filter((s) => !s.isCreditSettled)
    .reduce((sum, s) => sum + s.total, 0);

  const totalPaidAmount = creditTransactions
    .filter((s) => s.isCreditSettled)
    .reduce((sum, s) => sum + s.total, 0);

  const handleMarkPaid = (saleId: string, customerName?: string) => {
    if (confirm(`Kumpirmahin: Nabayaran na ba ni "${customerName || 'Customer'}" ang utang?`)) {
      onSettleCredit(saleId);
      playCheckoutChime();
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Summary stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Talaan ng Utang (Customer Credit Ledger)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Subaybayan ang pautang sa mga suki at kapitbahay, at itala kapag nabayaran na.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl self-stretch md:self-auto justify-around">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Kabuuang Pautang (Singilin)</span>
            <span className="text-lg font-bold text-amber-400 font-mono">
              ₱{totalUnpaidAmount.toFixed(2)}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Nabayaran Na</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">
              ₱{totalPaidAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hanapin ang pangalan ng umutang..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('unpaid')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'unpaid'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            May Utang Pa
          </button>
          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'paid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nabayaran Na
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lahat
          </button>
        </div>
      </div>

      {/* Credit Records List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-2">
            <User className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">Walang rekord ng utang sa napiling filter.</p>
            <p className="text-xs text-slate-500">
              Kapag may nag-utang sa POS checkout, piliin lamang ang "Utang (Credit)" para maidagdag dito.
            </p>
          </div>
        ) : (
          filtered.map((sale) => {
            const isSettled = sale.isCreditSettled === true;
            return (
              <div
                key={sale.id}
                className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                  isSettled
                    ? 'border-slate-800/80 opacity-70'
                    : 'border-amber-500/30 hover:border-amber-500/50'
                }`}
              >
                {/* Debtor details & items */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">
                      {sale.customerName || 'Di-kilalang Customer'}
                    </span>
                    {isSettled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Nabayaran na
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Clock className="w-3 h-3" /> May balanse
                      </span>
                    )}
                  </div>

                  {/* Date and receipt number */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(sale.timestamp).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-slate-500">{sale.receiptNumber}</span>
                  </div>

                  {/* Items breakdown list */}
                  <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 mt-2 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Mga inutang:</span>
                    <div className="space-y-0.5">
                      {sale.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span>
                            {it.quantity}x {it.productName}
                          </span>
                          <span className="font-mono text-slate-300">₱{it.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {sale.notes && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-800">
                        Tala: {sale.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount & Mark as paid button */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800 gap-3">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Halaga ng Utang:</span>
                    <span
                      className={`text-xl font-extrabold font-mono ${
                        isSettled ? 'text-slate-400' : 'text-amber-400'
                      }`}
                    >
                      ₱{sale.total.toFixed(2)}
                    </span>
                  </div>

                  {!isSettled ? (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(sale.id, sale.customerName)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Nabayaran Na</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Naayos noong {sale.creditSettledDate ? new Date(sale.creditSettledDate).toLocaleDateString('en-PH') : 'Kamakailan'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
