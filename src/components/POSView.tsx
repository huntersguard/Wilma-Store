import React, { useState } from 'react';
import { Product, CartItem, PaymentMethod, SaleTransaction } from '../types';
import { CATEGORIES } from '../utils/sampleData';
import { BarcodeScannerModal } from './BarcodeScannerModal';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playScanBeep, playCheckoutChime, playWarningSound } from '../utils/audio';

interface POSViewProps {
  products: Product[];
  onCompleteSale: (sale: Omit<SaleTransaction, 'id' | 'receiptNumber'>) => void;
  onOpenPriceChecker: () => void;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  onCompleteSale,
  onOpenPriceChecker,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Checkout modal state
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [discount, setDiscount] = useState<number>(0);

  // Success Receipt modal state
  const [lastCompletedSale, setLastCompletedSale] = useState<SaleTransaction | null>(null);

  // Cart calculations
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

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      playWarningSound();
      if (!confirm(`Pansin: Ang "${product.name}" ay ubos na sa imbentaryo (0 stock). Nais mo pa ring ibenta ito?`)) {
        return;
      }
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

    playScanBeep();
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
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Sigurado ka bang nais mong burahin ang laman ng bayarin?')) {
      setCart([]);
      setDiscount(0);
    }
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setIsScannerOpen(false);
    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === scannedBarcode.toLowerCase() ||
        p.barcode.replace(/[-\s]/g, '') === scannedBarcode.replace(/[-\s]/g, '')
    );

    if (matched) {
      addToCart(matched);
    } else {
      playWarningSound();
      alert(`Hindi nahanap ang barcode "${scannedBarcode}". Pakitingnan kung nakarehistro ito sa Inventory.`);
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setCashTendered(grandTotal); // default to exact amount
    setIsCheckoutModalOpen(true);
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
      timestamp: new Date().toISOString(),
      items: saleItems,
      subtotal,
      discount,
      total: grandTotal,
      cashTendered: paymentMethod === 'cash' ? numericCash : grandTotal,
      change: paymentMethod === 'cash' ? change : 0,
      paymentMethod,
      customerName: customerName.trim() || undefined,
      isCreditSettled: paymentMethod === 'utang' ? false : undefined,
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

    // Reset checkout state
    setIsCheckoutModalOpen(false);
    setCart([]);
    setDiscount(0);
    setCashTendered('');
    setCustomerName('');
    setCheckoutNotes('');
  };

  const setQuickCash = (amount: number) => {
    setCashTendered(amount);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
      {/* Left Column: Product Selection & Catalog (7 cols on lg) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search, Scanner & Action Row */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
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
            </div>

            {/* Quick Barcode Scanner Button */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-3.5 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95"
              title="Buksan ang Camera Barcode Scanner"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Camera Scan</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 border border-slate-800/80 rounded-2xl">
              Walang nahanap na paninda sa kategoryang ito.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isOut = p.stock <= 0;
              const isLow = p.stock > 0 && p.stock <= p.minStock;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between group active:scale-[0.98] ${
                    isOut
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-60 hover:border-rose-500/40'
                      : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850'
                  }`}
                >
                  {/* Top info */}
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block truncate">
                      {p.category}
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-white mt-0.5 line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors">
                      {p.name}
                    </h4>
                  </div>

                  {/* Bottom: Price & Stock Badge */}
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                      ₱{p.sellingPrice.toFixed(2)}
                    </span>

                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        isOut
                          ? 'bg-rose-500/20 text-rose-400'
                          : isLow
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isOut ? 'Ubos' : `${p.stock} ${p.unit}`}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Active Cart / Bayarin Drawer (5 cols on lg) */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sticky top-4 shadow-xl">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Kasalukuyang Bayarin</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
              {cart.reduce((total, i) => total + i.quantity, 0)} items
            </span>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Burahin
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="py-3 flex-1 overflow-y-auto max-h-[42vh] divide-y divide-slate-800/60 pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-slate-800/50 text-slate-500 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400">Walang laman ang bayarin.</p>
              <p className="text-[11px] text-slate-500">
                Pumili sa mga paninda o i-scan ang barcode gamit ang camera.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white truncate">
                    {item.product.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    ₱{item.unitPrice.toFixed(2)} × {item.quantity} ={' '}
                    <span className="text-emerald-400 font-semibold">
                      ₱{(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center font-bold text-xs font-mono text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Remove single item */}
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals & Calculation Summary */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Subtotal:</span>
            <span className="font-mono text-slate-200">₱{subtotal.toFixed(2)}</span>
          </div>

          {/* Discount input toggle */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Bawas / Diskwento:</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-500">₱</span>
              <input
                type="number"
                min="0"
                value={discount || ''}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-right font-mono text-xs text-white"
              />
            </div>
          </div>

          {/* Grand Total */}
          <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 block">KABUUANG BAYARIN</span>
              <span className="text-[10px] text-emerald-400 font-medium">Lahat ng paninda</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              ₱{grandTotal.toFixed(2)}
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleOpenCheckout}
            className="w-full mt-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99]"
          >
            <Banknote className="w-5 h-5" />
            <span>Bayad / Tapusin ang Benta</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      </div>

      {/* Checkout Drawer / Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <span>Pagtanggap ng Bayad</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Grand Total Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-400 font-medium block">Kabuuang Halaga</span>
                <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-0.5">
                  ₱{grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Paraan ng Pagbabayad:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('utang')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'utang'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Utang (Credit)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('gcash')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'gcash'
                        ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    GCash / Maya
                  </button>
                </div>
              </div>

              {/* Payment Details according to mode */}
              {paymentMethod === 'cash' ? (
                <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
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
                        autoFocus
                        value={cashTendered}
                        onChange={(e) =>
                          setCashTendered(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Philippine Banknote Shortcut Buttons */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 block">Mabilisang Pera (PHP Bills):</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuickCash(grandTotal)}
                        className="py-1 px-2 text-[11px] font-mono font-bold rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40"
                      >
                        Exact
                      </button>
                      {[20, 50, 100, 200, 500, 1000].map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setQuickCash(bill)}
                          className="py-1 px-2 text-[11px] font-mono font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800"
                        >
                          ₱{bill}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Sukli (Change) Calculator */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Sukli (Change):</span>
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
                /* Utang / Debtor name */
                <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-300">
                      Pangalan ng Umutang (Debtor Name) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Hal. Pareng Boyet / Kapitbahay Rosa"
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    Awtomatikong itatala ito sa <strong>Talaan ng Utang</strong> para masubaybayan at
                    masingil kapag nagbayad na.
                  </p>
                </div>
              ) : (
                /* GCash / Maya reference */
                <div className="space-y-3 bg-sky-500/5 border border-sky-500/20 rounded-xl p-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-sky-300">Pangalan / Reference Code:</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Hal. Ref # 100234 o pangalan ng nag-transfer"
                      className="w-full bg-slate-950 border border-sky-500/40 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>
              )}

              {/* Extra Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Karagdagang Tala (Opsyonal):</label>
                <input
                  type="text"
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Hal. Walang sukling barya..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Bumalik
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSale}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-colors"
                >
                  Kumpirmahin ang Bayad
                </button>
              </div>
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

            <button
              type="button"
              onClick={() => setLastCompletedSale(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Susunod na Customer
            </button>
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
