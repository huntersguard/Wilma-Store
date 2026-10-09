import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, StoreSettings } from '../types';
import {
  Store,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  QrCode,
  Copy,
  Check,
  Send,
  MessageCircle,
  Smartphone,
  ExternalLink,
  ArrowLeft,
  Share2,
  Package,
  Receipt,
  AlertCircle,
  X,
  CreditCard,
  Truck,
  ShoppingBag,
} from 'lucide-react';
import QRCode from 'qrcode';

interface CustomerStorefrontProps {
  products: Product[];
  settings: StoreSettings;
  categories: string[];
  isCustomerViewOnly?: boolean;
  onBackToAdmin?: () => void;
}

interface CustomerCartItem {
  product: Product;
  quantity: number;
}

export const CustomerStorefrontView: React.FC<CustomerStorefrontProps> = ({
  products,
  settings,
  categories,
  isCustomerViewOnly = false,
  onBackToAdmin,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [cart, setCart] = useState<CustomerCartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Customer Checkout Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentPreference, setPaymentPreference] = useState<'cash' | 'gcash' | 'maya'>('cash');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderPlacedSummary, setOrderPlacedSummary] = useState<string | null>(null);

  // Generate shareable URL
  const shareableUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?mode=store`;
  }, []);

  // Generate QR code for sharing
  useEffect(() => {
    if (shareableUrl) {
      QRCode.toDataURL(shareableUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url: string) => setQrCodeDataUrl(url))
        .catch(() => {});
    }
  }, [shareableUrl]);

  // Filter products: show only active products with valid names
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = selectedCategory === 'All Items' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  // Cart calculations
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + 1);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    const maxStock = product ? product.stock : 999;
    const finalQty = Math.min(maxStock, newQty);

    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: finalQty } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareableUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2200);
    }
  };

  // Build formatted text message for SMS / Messenger / Copy
  const generateOrderMessage = () => {
    const lines = [
      `🛒 *ONLINE ORDER PARA SA ${settings.storeName.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Pangalan:* ${customerName.trim() || 'Customer'}`,
      `📱 *Cellphone:* ${customerPhone.trim() || 'Hindi nakalagay'}`,
      `🛵 *Paraan ng Pagkuha:* ${deliveryType === 'delivery' ? 'Delivery sa Bahay' : 'Pick-up sa Tindahan'}`,
    ];

    if (deliveryType === 'delivery' && deliveryAddress.trim()) {
      lines.push(`📍 *Tirahan/Address:* ${deliveryAddress.trim()}`);
    }

    lines.push(
      `💳 *Paraan ng Bayad:* ${paymentPreference.toUpperCase()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *MGA IN-ORDER NA PANINDA:*`
    );

    cart.forEach((item, idx) => {
      const lineTotal = item.product.sellingPrice * item.quantity;
      lines.push(
        `${idx + 1}. ${item.product.name} (x${item.quantity} ${item.product.unit}) - ₱${lineTotal.toFixed(2)}`
      );
    });

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💰 *KABUUANG BABAYARAN: ₱${cartSubtotal.toFixed(2)}*`);

    if (orderNotes.trim()) {
      lines.push(`📝 *Habilin / Notes:* ${orderNotes.trim()}`);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Petsa: ${new Date().toLocaleString('en-PH')}`);
    return lines.join('\n');
  };

  const handleSendViaSMS = () => {
    const text = generateOrderMessage();
    const phone = settings.contactNumber ? settings.contactNumber.replace(/[^0-9+]/g, '') : '';
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(text)}`;
    window.open(smsUrl, '_blank');
    setOrderPlacedSummary(text);
  };

  const handleSendViaMessenger = () => {
    const text = generateOrderMessage();
    // Copy first for convenience
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    // Open messenger if link provided or prompt
    if (settings.messengerLink && settings.messengerLink.trim()) {
      window.open(settings.messengerLink.trim(), '_blank');
    } else {
      window.open('https://m.me', '_blank');
    }
    setOrderPlacedSummary(text);
  };

  const handleCopyOrderText = () => {
    const text = generateOrderMessage();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2200);
    }
    setOrderPlacedSummary(text);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner / Store Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Store Logo & Branding */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center font-extrabold shadow-md shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-base sm:text-lg tracking-tight truncate">
                  {settings.storeName || 'Tindahan POS'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Bukas Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                <span>Brgy. Kiwalan</span>
              </p>
            </div>
          </div>

          {/* Action buttons (Share & Cart & Back to Admin) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* If in store owner mode, show Share/QR code & Back button */}
            {!isCustomerViewOnly && (
              <>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  title="I-share ang link o QR code sa mga Customer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Share Link / QR</span>
                </button>

                {onBackToAdmin && (
                  <button
                    type="button"
                    onClick={onBackToAdmin}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Bumalik sa POS</span>
                  </button>
                )}
              </>
            )}

            {/* Customer Cart trigger */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden xs:inline">Basket</span>
              {totalCartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-emerald-700 font-extrabold text-[11px] flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Notice for Online Shoppers */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-teal-950/70 border-b border-emerald-900/40">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">
              {settings.onlineStoreNotice ||
                'Maligayang pagdating! Piliin ang iyong bibilhin at i-send sa amin ang order via SMS o Messenger para maihanda agad.'}
            </span>
          </div>
          {settings.contactNumber && (
            <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px] shrink-0">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tawag/Text: {settings.contactNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 space-y-4 pb-28">
        {/* Search Bar & Categories */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-md">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Maghanap ng grocery paninda, inumin, meryenda..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
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

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {['All Items', ...categories].map((cat) => {
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
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
          </div>
        </div>

        {/* Product Count Header */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Paninda: <strong className="text-white">{availableProducts.length}</strong> items sa{' '}
            <strong className="text-emerald-400">{selectedCategory}</strong>
          </span>
          <span className="text-[11px] text-slate-500">Live updated mula sa imbentaryo</span>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {availableProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800/80 rounded-2xl space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-600 mb-1" />
              <p className="text-sm font-semibold text-slate-300">Walang nahanap na paninda</p>
              <p className="text-xs text-slate-500">
                Subukang magpalit ng kategorya o maghanap ng ibang pangalan.
              </p>
            </div>
          ) : (
            availableProducts.map((p) => {
              const cartItem = cart.find((item) => item.product.id === p.id);
              const inCartQty = cartItem ? cartItem.quantity : 0;
              const isOut = p.stock <= 0;
              const isLow = p.stock > 0 && p.stock <= p.minStock;

              return (
                <div
                  key={p.id}
                  className={`group bg-slate-900 border rounded-2xl p-3 flex flex-col justify-between transition-all duration-150 ${
                    isOut
                      ? 'opacity-65 border-slate-800/80 bg-slate-900/60'
                      : 'border-slate-800 hover:border-emerald-500/50 hover:shadow-lg'
                  }`}
                >
                  {/* Image & Stock Badge */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 mb-2.5">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                        <Store className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">Paninda</span>
                      </div>
                    )}

                    {/* Stock Pill */}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md ${
                        isOut
                          ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
                          : isLow
                          ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-950/80 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isOut ? 'Ubos Na' : `${p.stock} natitira`}
                    </span>
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-medium text-slate-500 block truncate">
                        {p.category}
                      </span>
                      <h3 className="text-xs sm:text-sm font-semibold text-white mt-0.5 line-clamp-2 leading-snug">
                        {p.name}
                      </h3>
                    </div>

                    {/* Price and Cart controls */}
                    <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono">
                          ₱{p.sellingPrice.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono ml-0.5">/{p.unit}</span>
                      </div>

                      {/* Add/Quantity Buttons */}
                      {isOut ? (
                        <span className="text-[11px] text-rose-400 font-semibold">Out of Stock</span>
                      ) : inCartQty > 0 ? (
                        <div className="flex items-center gap-1 bg-slate-950 border border-emerald-500/40 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(p.id, inCartQty - 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold text-xs font-mono text-emerald-400">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            disabled={inCartQty >= p.stock}
                            onClick={() => updateCartQuantity(p.id, inCartQty + 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Piliin</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Sticky Bottom Cart Summary */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40 animate-in slide-in-from-bottom duration-200">
          <div
            onClick={() => setIsCartOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-98 border border-emerald-400/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">
                  {totalCartCount} item{totalCartCount > 1 ? 's' : ''} napili
                </div>
                <div className="text-xs text-emerald-100 font-normal">
                  Pindutin para makumpleto ang order
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold font-mono">
                ₱{cartSubtotal.toFixed(2)}
              </span>
              <span className="px-3 py-1.5 bg-white text-emerald-700 font-bold rounded-xl text-xs shadow-sm">
                Tingnan ➔
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Customer Basket & Checkout Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Ang Iyong Order ({totalCartCount} items)
                  </h3>
                  <p className="text-xs text-slate-400">{settings.storeName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Cart Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-500">
                  <ShoppingBag className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">Walang laman ang iyong basket</p>
                  <p className="text-xs">Pumili ng mga paninda sa listahan para umorder.</p>
                </div>
              ) : (
                <>
                  {/* Items List */}
                  <div className="divide-y divide-slate-800 bg-slate-950/60 rounded-2xl border border-slate-800 p-3 space-y-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                            {item.product.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ₱{item.product.sellingPrice.toFixed(2)} /{item.product.unit}
                          </span>
                        </div>

                        {/* Counter */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-bold text-xs font-mono text-emerald-400">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.quantity >= item.product.stock}
                              onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-16 text-right font-bold text-xs font-mono text-emerald-400">
                            ₱{(item.product.sellingPrice * item.quantity).toFixed(2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Customer Information Form */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span>Impormasyon para sa Order:</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                          Pangalan Mo: <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Hal. Juan Dela Cruz"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                          Cellphone Number:
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Hal. 0917-123-4567"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Delivery or Pickup Toggle */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Paraan ng Pagkuha:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryType('delivery')}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                            deliveryType === 'delivery'
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Ipa-deliver sa Bahay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryType('pickup')}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                            deliveryType === 'pickup'
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Pick-up sa Tindahan</span>
                        </button>
                      </div>
                    </div>

                    {/* Address if Delivery */}
                    {deliveryType === 'delivery' && (
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                          Lugar / Tirahan / Landmark:
                        </label>
                        <input
                          type="text"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Hal. Blk 5 Lot 12, tabi ng covered court"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    {/* Payment Preference */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Paano Magbabayad:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'cash', label: '💵 Kaliwaan' },
                          { id: 'gcash', label: '📱 GCash' },
                          { id: 'maya', label: '💳 Maya' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaymentPreference(m.id as any)}
                            className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              paymentPreference === m.id
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Extra Notes */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Habilin o Dagdag na Pabili (Opsyonal):
                      </label>
                      <input
                        type="text"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Hal. Pabili rin po ng 1 balot ng yelo kung meron..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Total Display */}
                  <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-emerald-200 block">Kabuuan ng Order:</span>
                      <span className="text-[11px] text-slate-400">Kasama ang lahat ng aytem</span>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-400 font-mono">
                      ₱{cartSubtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Submission Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 block text-center">
                      Ipadala ang order sa tindera via:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleSendViaSMS}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>I-send sa SMS / Text</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSendViaMessenger}
                        className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>I-send sa Messenger</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyOrderText}
                      className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
                    >
                      {copyFeedback ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">Na-copy na ang Order!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Kopyahin ang Order Text para i-paste sa Chat</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Confirmation / Success feedback */}
                  {orderPlacedSummary && (
                    <div className="p-3 bg-emerald-950 border border-emerald-600 rounded-2xl text-xs space-y-1.5 text-emerald-200">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Naihanda na ang iyong Order Text!</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        I-paste o ipadala ito kay Ate/Kuya Tindera. Makakatanggap ka ng kumpirmasyon kapag naihanda na ang iyong paninda.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share / QR Code Modal for Store Owner */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-left">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Link at QR Code para sa Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 text-left">
              Ibahagi ang link na ito sa iyong mga customer o i-print ang QR code para idikit sa bintana ng tindahan!
            </p>

            {/* QR Code preview */}
            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code ng Tindahan"
                  className="w-48 h-48 mx-auto"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Shareable Link Input */}
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-semibold text-slate-400 block">
                Link ng Iyong Online Tindahan:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableUrl}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors"
                >
                  {copyFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copyFeedback ? 'Na-copy!' : 'Kopyahin'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: settings.storeName,
                      text: `Silipin ang paninda at umorder online sa ${settings.storeName}!`,
                      url: shareableUrl,
                    }).catch(() => {});
                  } else {
                    handleCopyLink();
                  }
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>I-share sa Phone</span>
              </button>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
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
