import React, { useState } from 'react';
import { SaleTransaction } from '../types';
import { Receipt, Calendar, TrendingUp, DollarSign, Eye, X, Printer, ArrowUpRight } from 'lucide-react';

interface SalesHistoryViewProps {
  sales: SaleTransaction[];
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ sales }) => {
  const [selectedReceipt, setSelectedReceipt] = useState<SaleTransaction | null>(null);

  // Today calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => s.timestamp.slice(0, 10) === todayStr);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayCost = todaySales.reduce(
    (sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + item.costPrice * item.quantity, 0),
    0
  );
  const todayProfit = todayRevenue - todayCost;

  const totalAllTimeRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-5">
      {/* Sales Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Benta Ngayong Araw</span>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono mt-1">
            ₱{todayRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{todaySales.length} transaksyon ngayong araw</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Tinatayang Tubo Ngayon</span>
          <div className="text-xl sm:text-2xl font-extrabold text-sky-400 font-mono mt-1">
            +₱{todayProfit.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Margin: {todayRevenue > 0 ? ((todayProfit / todayRevenue) * 100).toFixed(0) : 0}%
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Kabuuang Benta (Kailanman)</span>
          <div className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-1">
            ₱{totalAllTimeRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{sales.length} kabuuang benta</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Pangkaraniwang Benta</span>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-400 font-mono mt-1">
            ₱{sales.length > 0 ? (totalAllTimeRevenue / sales.length).toFixed(2) : '0.00'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Bawat basket</span>
        </div>
      </div>

      {/* Sales Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Kasaysayan ng mga Benta (Recent Sales)</span>
          </h3>
          <span className="text-xs text-slate-500">{sales.length} mga resibo</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="py-3 px-4">Resibo #</th>
                <th className="py-3 px-3">Petsa at Oras</th>
                <th className="py-3 px-3">Mga Binili</th>
                <th className="py-3 px-3">Paraan ng Bayad</th>
                <th className="py-3 px-3 text-right">Halaga</th>
                <th className="py-3 px-4 text-right">Aksyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Wala pang naitalang benta. Magsimulang mag-benta sa POS tab!
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-white">{sale.receiptNumber}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {new Date(sale.timestamp).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      <span className="line-clamp-1 max-w-xs text-xs">
                        {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          sale.paymentMethod === 'cash'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : sale.paymentMethod === 'utang'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        }`}
                      >
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      ₱{sale.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(sale)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Resibo
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Receipt Viewer Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl p-6 font-mono text-xs space-y-4">
            <div className="text-center space-y-0.5 border-b pb-3 border-dashed border-slate-300">
              <h3 className="font-bold text-sm tracking-wide">TINDAHAN SARI-SARI STORE</h3>
              <p className="text-[11px] text-slate-500">Official Sales Receipt</p>
              <p className="text-[10px] text-slate-400">Resibo: {selectedReceipt.receiptNumber}</p>
              <p className="text-[10px] text-slate-400">
                {new Date(selectedReceipt.timestamp).toLocaleString('en-PH')}
              </p>
            </div>

            {/* Receipt Items */}
            <div className="space-y-1.5 py-2 border-b border-dashed border-slate-300">
              {selectedReceipt.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-baseline">
                  <div className="truncate pr-2">
                    <span>{it.quantity}x {it.productName}</span>
                  </div>
                  <span className="font-bold shrink-0">₱{it.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="space-y-1 border-b pb-2 border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₱{selectedReceipt.subtotal.toFixed(2)}</span>
              </div>
              {selectedReceipt.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Diskwento:</span>
                  <span>-₱{selectedReceipt.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
                <span>TOTAL:</span>
                <span>₱{selectedReceipt.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase">{selectedReceipt.paymentMethod}</span>
              </div>
              {selectedReceipt.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{selectedReceipt.customerName}</span>
                </div>
              )}
              {selectedReceipt.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered:</span>
                    <span>₱{selectedReceipt.cashTendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Change:</span>
                    <span>₱{selectedReceipt.change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-400">
              Salamat po sa pagtangkilik! Balik po kayo muli.
            </div>

            {/* Close button */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Isara
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
