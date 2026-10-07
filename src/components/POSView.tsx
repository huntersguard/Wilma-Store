import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, CartItem, PaymentMethod, SaleTransaction } from '../types';
import { CATEGORIES } from '../utils/sampleData';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import {
  getAllDebtorsSummary,
  getCustomerCreditSummary,
  CustomerDebtorSummary,
} from '../utils/creditUtils';
import {
  Camera,
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Receipt,
  User,
  CreditCard,
  Banknote,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Package,
  Layers,
  Columns,
  Check,
  Tag,
  ShoppingBag,
  Calendar,
  Wallet,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playScanBeep, playCheckoutChime, playWarningSound } from '../utils/audio';

export type POSMode = 'catalog' | 'cashier' | 'split';

interface POSViewProps {
  products: Product[];
  sales: SaleTransaction[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  initialMode?: POSMode;
  onCompleteSale: (sale: Omit<SaleTransaction, 'id' | 'receiptNumber'>) => void;
  onOpenPriceChecker: () => void;
  categories?: string[];
  onOpenManageCategories?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  sales,
  cart,
  setCart,
  initialMode = 'catalog',
  onCompleteSale,
  onOpenPriceChecker,
  categories,
  onOpenManageCategories,
}) => {
  const [posMode, setPosMode] = useState<POSMode>(initialMode);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Out of stock warning confirmation modal state
  const [outOfStockPromptProduct, setOutOfStockPromptProduct] = useState<Product | null>(null);

  // Payment form states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState('');
  const [creditDate, setCreditDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [discount, setDiscount] = useState<number>(0);

  // Existing customer debtor summary (if customer name is typed)
  const existingDebtorSummary = useMemo(() => {
    if (!customerName.trim() || paymentMethod !== 'utang') return null;
    return getCustomerCreditSummary(sales, customerName.trim());
  }, [customerName, paymentMethod, sales]);

  // All debtors for autocomplete
  const allDebtors = useMemo(() => getAllDebtorsSummary(sales), [sales]);

  // Success Receipt modal state
  const [lastCompletedSale, setLastCompletedSale] = useState<SaleTransaction | null>(null);

  // Sync mode if initialMode changes
  useEffect(() => {
    if (initialMode) {
      setPosMode(initialMode);
    }
  }, [initialMode]);

  // Cart calculations
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const numericCash = typeof cashTendered === 'number' ? cashTendered : 0;
  const change = Math.max(0, numericCash - grandTotal);
  const isCashInsufficient = paymentMethod === 'cash' && numericCash < grandTotal && numericCash > 0;

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All Items' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  };

  // Add product to cart
  const addToCart = (product: Product, bypassWarning = false, suppressBeep = false) => {
    if (product.stock <= 0 && !bypassWarning) {
      playWarningSound();
      setOutOfStockPromptProduct(product);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice }];
      }
    });

    if (!suppressBeep) {
      playScanBeep();
    }
    showToast(`✓ Naidagdag: ${product.name} (₱${product.sellingPrice.toFixed(2)})`);
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    if (item) {
      showToast(`Inalis sa bayarin: ${item.product.name}`);
    }
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Sigurado ka bang nais mong burahin ang lahat ng laman ng bayarin?')) {
      setCart([]);
      setDiscount(0);
      setCashTendered('');
      showToast('Nalinis na ang bayarin.');
    }
  };

  const lastScanProcessedTimeRef = useRef<number>(0);

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setIsScannerOpen(false);
    const clean = scannedBarcode.trim();
    if (!clean) return;

    const now = Date.now();
    if (now - lastScanProcessedTimeRef.current < 2000) {
      return; // 2-second debounce guard against rapid bursts
    }
    lastScanProcessedTimeRef.current = now;

    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === clean.toLowerCase() ||
        p.barcode.replace(/[-\s]/g, '') === clean.replace(/[-\s]/g, '')
    );

    if (matched) {
      // suppressBeep=true because scanner already sounded the beep
      addToCart(matched, false, true);
    } else {
      playWarningSound();
      alert(`Hindi nahanap ang barcode "${clean}". Pakitiyak na nakalista ito sa Imbentaryo.`);
    }
  };

  const handleConfirmSale = () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'cash' && numericCash < grandTotal) {
      playWarningSound();
      alert(`Kulang ang ibinayad na pera! Kulang pa ng ₱${(grandTotal - numericCash).toFixed(2)}.`);
      return;
    }

    if (paymentMethod === 'utang' && !customerName.trim()) {
      playWarningSound();
      alert('Pakilagay ang Pangalan ng Umutang bago itala ang utang.');
      return;
    }

    const saleItems = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      barcode: item.product.barcode,
      quantity: item.quantity,
      unit: item.product.unit,
      costPrice: item.product.costPrice,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
    }));

    const salePayload = {
      timestamp:
        paymentMethod === 'utang' && creditDate
          ? new Date(creditDate).toISOString()
          : new Date().toISOString(),
      items: saleItems,
      subtotal,
      discount,
      total: grandTotal,
      cashTendered: paymentMethod === 'cash' ? numericCash : grandTotal,
      change: paymentMethod === 'cash' ? change : 0,
      paymentMethod,
      customerName: customerName.trim() || undefined,
      isCreditSettled: paymentMethod === 'utang' ? false : undefined,
      amountPaid: 0,
      payments: [],
      notes: checkoutNotes.trim() || undefined,
    };

    onCompleteSale(salePayload);

    // Sound and celebration
    playCheckoutChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
    });

    // Generate local receipt copy for modal
    setLastCompletedSale({
      ...salePayload,
      id: `sale-${Date.now()}`,
      receiptNumber: `OR-${Date.now().toString().slice(-6)}`,
    });

    // Reset checkout fields
    setCart([]);
    setDiscount(0);
    setCashTendered('');
    setCustomerName('');
    setCreditDate(new Date().toISOString().slice(0, 16));
    setCheckoutNotes('');
  };

  const setQuickCash = (amount: number) => {
    setCashTendered(amount);
  };

  /* =========================================================================
   * SUB-COMPONENT: Product Catalog View (Paninda)
   * ========================================================================= */
  const renderCatalogView = () => (
    <div className="space-y-3.5 pb-24 sm:pb-20">
      {/* Search & Camera Barcode Action Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-md">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Maghanap ng paninda o barcode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Barcode Scanner Button */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95"
            title="Buksan ang Camera Barcode Scanner"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Camera Scan</span>
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['All Items', ...(categories && categories.length > 0 ? categories : CATEGORIES.filter((c) => c !== 'All Items'))].map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === 'All Items'
                ? products.length
                : products.filter((p) => p.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {onOpenManageCategories && (
            <button
              type="button"
              onClick={onOpenManageCategories}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all shrink-0 flex items-center gap-1 bg-slate-950 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/30"
              title="Palitan ang pangalan o magdagdag ng mga kategorya"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">I-edit ang Kategorya</span>
            </button>
          )}
        </div>
      </div>

      {/* Catalog Grid Header Note */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Ipinapakita: <strong className="text-white">{filteredProducts.length}</strong> paninda sa{' '}
          <strong className="text-emerald-400">{selectedCategory}</strong>
        </span>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          Pindutin ang larawan o kahon para idagdag sa bayarin
        </span>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800/80 rounded-2xl space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-600 mb-1" />
            <p className="text-sm font-semibold text-slate-300">Walang nahanap na paninda</p>
            <p className="text-xs text-slate-500">
              Subukang magpalit ng kategorya o maghanap ng ibang pangalan/barcode.
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Burahin ang Search
              </button>
            )}
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isOut = p.stock <= 0;
            const isLow = p.stock > 0 && p.stock <= p.minStock;
            const inCartItem = cart.find((i) => i.product.id === p.id);
            const inCartQty = inCartItem?.quantity || 0;

            return (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className={`relative p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between group cursor-pointer select-none active:scale-[0.98] ${
                  inCartQty > 0
                    ? 'bg-emerald-950/20 border-emerald-500/70 shadow-emerald-950/20 shadow-md ring-1 ring-emerald-500/30'
                    : isOut
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-65 hover:border-rose-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850'
                }`}
              >
                {/* Product Image / Photo Banner */}
                <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-950 mb-2 border border-slate-800/80">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                      <Package className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  {/* Top-right In-Cart Quantity Indicator */}
                  {inCartQty > 0 && (
                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-slate-950 font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-scale-in">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{inCartQty} sa Kaha</span>
                    </div>
                  )}

                  {/* Stock badge overlay */}
                  <span
                    className={`absolute bottom-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs ${
                      isOut
                        ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
                        : isLow
                        ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-950/80 text-slate-300 border border-slate-700/50'
                    }`}
                  >
                    {isOut ? 'Ubos' : `${p.stock} ${p.unit}`}
                  </span>
                </div>

                {/* Title & Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block truncate">
                      {p.category}
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-white mt-0.5 line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors">
                      {p.name}
                    </h4>
                  </div>

                  {/* Price and Add/Counter Row */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    <div>
                      <span className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                        ₱{p.sellingPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono ml-0.5">/{p.unit}</span>
                    </div>

                    {/* Inline Counter if already in cart */}
                    {inCartQty > 0 ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 bg-slate-950 border border-emerald-500/40 rounded-lg p-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, inCartQty - 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Bawasan"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-5 text-center font-bold text-xs font-mono text-emerald-400">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, inCartQty + 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Dagdagan"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p);
                        }}
                        className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors border border-emerald-500/30"
                        title="Idagdag sa bayarin"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Sticky Bottom Bar for Mobile & Desktop (Always visible when in catalog mode) */}
      <div className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-6 max-w-3xl mx-auto z-40">
        <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-2.5">
          <div
            onClick={() => setPosMode('cashier')}
            className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  Kasalukuyang Kaha
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold shrink-0">
                  {totalItemsCount} item{totalItemsCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                ₱{grandTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                title="Burahin ang Laman"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                if (cart.length > 0) {
                  setCashTendered(grandTotal);
                  setPosMode('cashier');
                }
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
            >
              <span>Buksan ang Kaha / Magbayad</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* =========================================================================
   * SUB-COMPONENT: Dedicated Separated Cashier View (Kaha / Bayarin)
   * ========================================================================= */
  const renderCashierView = () => (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Back to Products & Cashier Header */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
        <button
          type="button"
          onClick={() => setPosMode('catalog')}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Bumalik sa Paninda (+ Dagdag pa)</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Kabuuan sa Kaha
            </span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
              ₱{grandTotal.toFixed(2)}
            </span>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1 transition-colors"
              title="Burahin Lahat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Burahin</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Cashier Workspace (Items List on left, Payment on right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left Column: Cart Items List (7 cols on md) */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-base">Mga Biniling Paninda</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                {totalItemsCount} pcs
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPosMode('catalog')}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Dagdag Paninda
            </button>
          </div>

          {/* Cart Items List */}
          <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[55vh] pr-1">
            {cart.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/50 text-slate-500 flex items-center justify-center mx-auto">
                  <Receipt className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300">Walang laman ang bayarin</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Pumili ng mga paninda sa catalog o i-scan ang barcode gamit ang cellphone camera.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPosMode('catalog')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pumili ng Paninda</span>
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-850/50 rounded-xl px-1.5 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Title & Price breakdown */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      ₱{item.unitPrice.toFixed(2)} × {item.quantity} ={' '}
                      <span className="text-emerald-400 font-semibold font-mono">
                        ₱{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper Controls */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-bold text-xs sm:text-sm font-mono text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Alisin ang panindang ito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Quick Scanner shortcut inside Cashier */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>May idadagdag pang barcode?</span>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>I-scan ang Barcode</span>
            </button>
          </div>
        </div>

        {/* Right Column: Payment & Checkout Console (5 cols on md) */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col space-y-4 shadow-xl">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-base">Pagtanggap ng Bayad</h3>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Cashier
            </span>
          </div>

          {/* Price Calculation Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-200 font-semibold">₱{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount input */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-850">
              <span>Bawas / Diskwento:</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">₱</span>
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  placeholder="0"
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 bg-slate-900 border border-slate-750 rounded-lg px-2 py-1 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Grand Total Display */}
            <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-bold text-slate-300 block">KABUUANG BAYARIN</span>
                <span className="text-[10px] text-emerald-400 font-medium">Kabuuang babayaran</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                ₱{grandTotal.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Paraan ng Pagbabayad:</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Banknote className="w-4 h-4" />
                Cash
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('utang')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'utang'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                Utang (Credit)
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('gcash')}
                className={`py-2 px-2 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'gcash'
                    ? 'bg-sky-600/20 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                GCash / Maya
              </button>
            </div>
          </div>

          {/* Payment Details per method */}
          {paymentMethod === 'cash' ? (
            <div className="space-y-3 bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
              {/* Cash Tendered Input */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Iniaabot na Pera (Cash):</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={cashTendered}
                    onChange={(e) =>
                      setCashTendered(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder={grandTotal.toFixed(2)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Philippine Banknotes Shortcuts */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">
                  Mabilisang Pera (PHP Bills):
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickCash(grandTotal)}
                    className="py-1 px-1.5 text-[11px] font-mono font-bold rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40 transition-colors"
                  >
                    Sakto
                  </button>
                  {[20, 50, 100, 200, 500, 1000].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setQuickCash(bill)}
                      className="py-1 px-1.5 text-[11px] font-mono font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors"
                    >
                      ₱{bill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Change (Sukli) Calculator */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Sukli (Change):</span>
                <span
                  className={`text-xl font-mono font-extrabold ${
                    isCashInsufficient ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isCashInsufficient
                    ? `Kulang ng ₱${(grandTotal - numericCash).toFixed(2)}`
                    : `₱${change.toFixed(2)}`}
                </span>
              </div>
            </div>
          ) : paymentMethod === 'utang' ? (
            <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5">
              {/* Petsa ng Pagkautang (Date Incurred) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Petsa ng Utang (Date Incurred):</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={creditDate}
                  onChange={(e) => setCreditDate(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              {/* Pangalan ng Umutang with Autocomplete */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300">
                  Pangalan ng Umutang (Debtor Name) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Hal. Kapitbahay Boyet / Ate Wilma"
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                />

                {/* Suki Autocomplete Pills */}
                {allDebtors.length > 0 && customerName.trim() && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {allDebtors
                      .filter((d: CustomerDebtorSummary) =>
                        d.customerName.toLowerCase().includes(customerName.toLowerCase())
                      )
                      .slice(0, 4)
                      .map((d: CustomerDebtorSummary) => (
                        <button
                          key={d.customerName}
                          type="button"
                          onClick={() => setCustomerName(d.customerName)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-500/30 text-[11px] text-amber-300 hover:bg-slate-800 flex items-center gap-1 transition-colors"
                        >
                          <span>{d.customerName}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            (May utang: ₱{d.netBalance.toFixed(0)})
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Dynamic Existing Balance Breakdown */}
              {existingDebtorSummary && (existingDebtorSummary.netBalance > 0 || existingDebtorSummary.advanceDeposit > 0) && (
                <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Kasalukuyang Dating Utang:</span>
                    <span className="font-mono font-bold text-amber-400">
                      ₱{existingDebtorSummary.netBalance.toFixed(2)}
                    </span>
                  </div>

                  {existingDebtorSummary.advanceDeposit > 0 && (
                    <div className="flex justify-between text-teal-300 font-semibold">
                      <span>May Paunang Pondo (Advance):</span>
                      <span className="font-mono text-teal-400">
                        -₱{existingDebtorSummary.advanceDeposit.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-300">
                    <span>Bagong Utang Ngayong Araw:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +₱{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-white">
                    <span>Kabuuang Utang Matapos Ito:</span>
                    <span className="font-mono text-amber-400 text-sm">
                      ₱{Math.max(
                        0,
                        existingDebtorSummary.netBalance + grandTotal - existingDebtorSummary.advanceDeposit
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Awtomatikong itatala ito sa <strong>Talaan ng Utang</strong> para masubaybayan at
                masingil sa susunod na may kumpletong petsa.
              </p>
            </div>
          ) : (
            <div className="space-y-2 bg-sky-500/5 border border-sky-500/20 rounded-2xl p-3.5">
              <label className="text-xs font-bold text-sky-300">Reference # o Pangalan sa App:</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Hal. Ref # 100234 o pangalan ng nagpadala"
                className="w-full bg-slate-950 border border-sky-500/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-400"
              />
            </div>
          )}

          {/* Optional Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Karagdagang Tala (Opsyonal):</label>
            <input
              type="text"
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              placeholder="Hal. Walang barya, susunod ang sukli..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
            />
          </div>

          {/* Confirm Sale Final Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleConfirmSale}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.99]"
          >
            <Banknote className="w-5 h-5" />
            <span>Kumpirmahin ang Bayad / Tapusin ang Benta</span>
            <CheckCircle className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================================
   * SUB-COMPONENT: Desktop Split View (Side-by-Side)
   * ========================================================================= */
  const renderSplitView = () => (
    <div className="grid grid-cols-12 gap-5 items-start">
      <div className="col-span-7">{renderCatalogView()}</div>
      <div className="col-span-5 sticky top-20">{renderCashierView()}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* POS Top Navigation Mode Switcher (Separated Tabs) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex items-center justify-between gap-2 shadow-md">
        {/* Primary View Toggle */}
        <div className="flex items-center gap-1.5 flex-1">
          {/* Tab 1: Paninda (Catalog) */}
          <button
            type="button"
            onClick={() => setPosMode('catalog')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              posMode === 'catalog'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Paninda (Catalog)</span>
          </button>

          {/* Tab 2: Kaha / Bayarin (Cashier) */}
          <button
            type="button"
            onClick={() => {
              if (cart.length > 0 && typeof cashTendered !== 'number') {
                setCashTendered(grandTotal);
              }
              setPosMode('cashier');
            }}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${
              posMode === 'cashier'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>2. Kaha / Bayarin</span>
            {totalItemsCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                  posMode === 'cashier'
                    ? 'bg-emerald-950 text-emerald-200'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {totalItemsCount} • ₱{grandTotal.toFixed(0)}
              </span>
            )}
          </button>
        </div>

        {/* Desktop Split View Toggle (Visible on lg screens only) */}
        <div className="hidden lg:flex items-center pl-2 border-l border-slate-800">
          <button
            type="button"
            onClick={() => setPosMode('split')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              posMode === 'split'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Tingnan nang Magkatabi ang Paninda at Kaha"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Magkatabi (Split)</span>
          </button>
        </div>
      </div>

      {/* Render the Active View */}
      {posMode === 'catalog' && renderCatalogView()}
      {posMode === 'cashier' && renderCashierView()}
      {posMode === 'split' && renderSplitView()}

      {/* Out of stock warning modal */}
      {outOfStockPromptProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-white text-base">Pansin: Ubos na ang Paninda!</h3>
              <p className="text-xs text-slate-400">
                Ang <strong className="text-white">"{outOfStockPromptProduct.name}"</strong> ay may{' '}
                <strong className="text-rose-400">0 stock</strong> sa kasalukuyang imbentaryo.
              </p>
              <p className="text-xs text-slate-400">
                Nais mo pa rin ba itong idagdag sa bayarin ng mamimili?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOutOfStockPromptProduct(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Huwag Idagdag
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = outOfStockPromptProduct;
                  setOutOfStockPromptProduct(null);
                  addToCart(p, true);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Oo, Ibenta Pa Rin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Receipt Modal Confirmation */}
      {lastCompletedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Matagumpay na Benta!</h3>
              <p className="text-xs text-slate-400 font-mono">
                Resibo: {lastCompletedSale.receiptNumber}
              </p>
            </div>

            {/* Receipt Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Paraan:</span>
                <span className="font-semibold text-white uppercase">
                  {lastCompletedSale.paymentMethod}
                </span>
              </div>
              {lastCompletedSale.customerName && (
                <div className="flex justify-between text-slate-400">
                  <span>Customer:</span>
                  <span className="font-semibold text-white">
                    {lastCompletedSale.customerName}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Kabuuang Halaga:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ₱{lastCompletedSale.total.toFixed(2)}
                </span>
              </div>
              {lastCompletedSale.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>Binayad na Pera:</span>
                    <span className="font-mono text-slate-200">
                      ₱{lastCompletedSale.cashTendered.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Sukli:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      ₱{lastCompletedSale.change.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLastCompletedSale(null);
                  setPosMode('catalog');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Susunod na Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="I-scan ang Barcode para sa Bayarin"
        subtitle="Kusang idadagdag sa bayarin ang scanned product"
      />
    </div>
  );
};
