import React, { useState } from 'react';
import { Product } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { Camera, Search, CheckCircle2, AlertTriangle, XCircle, ShoppingCart, Eye, EyeOff, RotateCcw, Package } from 'lucide-react';
import { playScanBeep, playWarningSound } from '../utils/audio';

interface PriceCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart?: (product: Product) => void;
}

export const PriceCheckerModal: React.FC<PriceCheckerModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showCostMargin, setShowCostMargin] = useState(false);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBarcodeScanned = (scannedCode: string) => {
    setIsScannerOpen(false);
    setSearchQuery(scannedCode);
    lookupProduct(scannedCode);
  };

  const lookupProduct = (query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) return;

    // Check exact barcode match first
    const byBarcode = products.find(
      (p) => p.barcode.toLowerCase() === clean || p.barcode.replace(/[-\s]/g, '') === clean.replace(/[-\s]/g, '')
    );

    if (byBarcode) {
      setMatchedProduct(byBarcode);
      setNotFoundQuery(null);
      playScanBeep();
      return;
    }

    // Otherwise check name match
    const byName = products.find((p) => p.name.toLowerCase().includes(clean));
    if (byName) {
      setMatchedProduct(byName);
      setNotFoundQuery(null);
      playScanBeep();
      return;
    }

    setMatchedProduct(null);
    setNotFoundQuery(query);
    playWarningSound();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupProduct(searchQuery);
  };

  const clearLookup = () => {
    setMatchedProduct(null);
    setNotFoundQuery(null);
    setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
              ₱
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Presyo Check (Price Checker)</h2>
              <p className="text-xs text-slate-400">I-scan ang barcode o hanapin ang pangalan ng paninda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search bar & Scan action button */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
          <div className="flex gap-2">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="I-type ang barcode o pangalan..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </form>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all shrink-0 active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Camera Scan</span>
            </button>
          </div>

          {/* Quick sample items pills to test quickly */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto pb-1 scrollbar-none">
            <span className="shrink-0 text-slate-500 text-[11px]">Subukan:</span>
            {products.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSearchQuery(p.barcode);
                  lookupProduct(p.barcode);
                }}
                className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-colors font-mono"
              >
                {p.name.split(' ')[0]} ({p.barcode.slice(-4)})
              </button>
            ))}
          </div>
        </div>

        {/* Result Area */}
        <div className="p-5 flex-1 overflow-y-auto">
          {matchedProduct ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
              {/* Product Header with Photo */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Photo container */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 shadow-md">
                  {matchedProduct.imageUrl ? (
                    <img
                      src={matchedProduct.imageUrl}
                      alt={matchedProduct.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Package className="w-10 h-10 opacity-40" />
                    </div>
                  )}
                </div>

                {/* Product Title & Details */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    {matchedProduct.category}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5 leading-snug">
                    {matchedProduct.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Barcode: <span className="text-slate-300 font-bold">{matchedProduct.barcode}</span> · Sukat:{' '}
                    <span className="text-slate-300 uppercase font-semibold">{matchedProduct.unit}</span>
                  </p>
                </div>
              </div>

              {/* Huge Price Tag */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Presyo ng Paninda:</span>
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight flex items-baseline gap-1 mt-0.5">
                    <span>₱{matchedProduct.sellingPrice.toFixed(2)}</span>
                    <span className="text-sm font-normal text-slate-400">/ {matchedProduct.unit}</span>
                  </div>
                </div>

                {/* Stock status indicator */}
                <div className="text-right">
                  {matchedProduct.stock <= 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        UBOS NA
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1">0 {matchedProduct.unit} naiwan</span>
                    </div>
                  ) : matchedProduct.stock <= matchedProduct.minStock ? (
                    <div className="flex flex-col items-end">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        PAUBOS NA
                      </span>
                      <span className="text-[11px] text-amber-400/80 mt-1">{matchedProduct.stock} {matchedProduct.unit} naiwan</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        MAY STOCK
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">{matchedProduct.stock} {matchedProduct.unit} sa estante</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner confidential info: Cost & Profit margin toggle */}
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">May-ari / Puhunan Info:</span>
                  <button
                    type="button"
                    onClick={() => setShowCostMargin(!showCostMargin)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {showCostMargin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showCostMargin ? 'Itago' : 'Ipakita ang Tubo'}
                  </button>
                </div>

                {showCostMargin && (
                  <div className="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block">Puhunan (Cost):</span>
                      <span className="text-slate-200 font-semibold font-mono">
                        ₱{matchedProduct.costPrice.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tubo (Profit Margin):</span>
                      <span className="text-emerald-400 font-semibold font-mono">
                        +₱{(matchedProduct.sellingPrice - matchedProduct.costPrice).toFixed(2)} (
                        {(
                          ((matchedProduct.sellingPrice - matchedProduct.costPrice) /
                            (matchedProduct.costPrice || 1)) *
                          100
                        ).toFixed(0)}
                        %)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                {onAddToCart && (
                  <button
                    type="button"
                    disabled={matchedProduct.stock <= 0}
                    onClick={() => {
                      onAddToCart(matchedProduct);
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Idagdag sa Bayarin (Add to Cart)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearLookup}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Iba Pa</span>
                </button>
              </div>
            </div>
          ) : notFoundQuery ? (
            /* Not Found Screen */
            <div className="text-center py-8 px-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Walang Nahanap na Paninda</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hindi nakarehistro ang barcode na{' '}
                <span className="font-mono text-rose-400 font-medium">"{notFoundQuery}"</span> sa imbentaryo.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> I-scan Ulit
                </button>
                <button
                  type="button"
                  onClick={clearLookup}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Subukan Ulit
                </button>
              </div>
            </div>
          ) : (
            /* Idle Screen */
            <div className="text-center py-10 px-4 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Handa nang Mag-Presyo Check</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  Pindutin ang Camera Scan o i-type ang barcode para malaman agad ang presyo at stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <Camera className="w-4 h-4" /> Buksan ang Camera Scanner
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="I-scan ang Barcode para sa Presyo"
        subtitle="Itutok ang camera sa barcode ng paninda"
      />
    </div>
  );
};
