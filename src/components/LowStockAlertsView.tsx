import React, { useState } from 'react';
import { Product } from '../types';
import { AlertTriangle, XCircle, PackagePlus, Bell, TrendingDown, DollarSign, CheckCircle2, Package } from 'lucide-react';
import { playWarningSound } from '../utils/audio';

interface LowStockAlertsViewProps {
  products: Product[];
  onRestockProduct: (productId: string, quantityToAdd: number) => void;
  onOpenInventory: () => void;
}

export const LowStockAlertsView: React.FC<LowStockAlertsViewProps> = ({
  products,
  onRestockProduct,
  onOpenInventory,
}) => {
  const [restockAmountMap, setRestockAmountMap] = useState<Record<string, number>>({});

  const outOfStockItems = products.filter((p) => p.stock <= 0);
  const lowStockItems = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);

  // Total investment needed to bring all low/out-of-stock items up to target minStock + 10
  const totalRestockInvestmentNeeded = [...outOfStockItems, ...lowStockItems].reduce((sum, p) => {
    const deficit = Math.max(1, p.minStock * 2 - p.stock);
    return sum + deficit * p.costPrice;
  }, 0);

  const handleRestock = (productId: string, qty: number) => {
    onRestockProduct(productId, qty);
  };

  const getCustomAmount = (id: string, defaultVal: number = 10) => {
    return restockAmountMap[id] !== undefined ? restockAmountMap[id] : defaultVal;
  };

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Babala sa Paubos na Paninda (Low Stock Alerts)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Subaybayan ang mga produktong malapit nang maubos o wala nang laman sa estante.
            </p>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl self-stretch md:self-auto justify-around">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Ubos Na</span>
            <span className="text-base font-bold text-rose-400 font-mono">
              {outOfStockItems.length} items
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Paubos Na</span>
            <span className="text-base font-bold text-amber-400 font-mono">
              {lowStockItems.length} items
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Tinatayang Puhunan</span>
            <span className="text-base font-bold text-sky-400 font-mono">
              ₱{totalRestockInvestmentNeeded.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {outOfStockItems.length === 0 && lowStockItems.length === 0 ? (
        /* Empty / All healthy state */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">Maganda ang Lahat ng Stock!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Lahat ng paninda sa tindahan ay nasa maayos na dami at lampas sa minimum stock limit.
          </p>
          <button
            type="button"
            onClick={onOpenInventory}
            className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Tingnan ang Buong Imbentaryo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: UBOS NA (Out of Stock) */}
          {outOfStockItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <XCircle className="w-4 h-4" />
                <span>KRITIKAL: Ubos na Paninda ({outOfStockItems.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {outOfStockItems.map((p) => {
                  const suggestedRestock = p.minStock * 2 || 10;
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <Package className="w-5 h-5 opacity-40" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-rose-400/80 uppercase">
                              {p.category}
                            </span>
                            <h4 className="text-sm font-bold text-white mt-0.5">{p.name}</h4>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              Barcode: {p.barcode}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            0 {p.unit}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Min: {p.minStock} {p.unit}
                          </span>
                        </div>
                      </div>

                      {/* Financial info & Restock controls */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="text-xs">
                          <span className="text-slate-500 block text-[10px]">Puhunan bawat isa:</span>
                          <span className="font-mono text-slate-300 font-semibold">
                            ₱{p.costPrice.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRestock(p.id, suggestedRestock)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>Mag-Restock (+{suggestedRestock})</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: PAUBOS NA (Low Stock Warning) */}
          {lowStockItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>BABALA: Paubos na Paninda ({lowStockItems.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lowStockItems.map((p) => {
                  const suggestedRestock = p.minStock * 2 - p.stock || 10;
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <Package className="w-5 h-5 opacity-40" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-amber-400/80 uppercase">
                              {p.category}
                            </span>
                            <h4 className="text-sm font-bold text-white mt-0.5">{p.name}</h4>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              Barcode: {p.barcode}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {p.stock} {p.unit} naiwan
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Min: {p.minStock} {p.unit}
                          </span>
                        </div>
                      </div>

                      {/* Restock action */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="text-xs">
                          <span className="text-slate-500 block text-[10px]">Presyo ng Benta:</span>
                          <span className="font-mono text-emerald-400 font-semibold">
                            ₱{p.sellingPrice.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRestock(p.id, 5)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            +5 {p.unit}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestock(p.id, 10)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>+10 {p.unit}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
