import React, { useState } from 'react';
import { Product } from '../types';
import { CATEGORIES } from '../utils/sampleData';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import {
  Plus,
  Search,
  Camera,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  TrendingUp,
  PackageCheck,
  PackageX,
  FileSpreadsheet,
} from 'lucide-react';
import { playScanBeep } from '../utils/audio';

interface InventoryViewProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id' | 'updatedAt'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onQuickAdjustStock: (productId: string, delta: number) => void;
  onExportBackup: () => void;
  onImportBackup: (json: string) => void;
  onResetDefaults: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onQuickAdjustStock,
  onExportBackup,
  onImportBackup,
  onResetDefaults,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'normal'>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetField, setScannerTargetField] = useState<'add' | 'edit'>('add');

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: 'Instant Noodles & Soups',
    unit: 'pack',
    costPrice: 0,
    sellingPrice: 0,
    stock: 10,
    minStock: 5,
    notes: '',
  });

  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const totalInventoryValue = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const totalPotentialRetail = products.reduce((sum, p) => sum + p.sellingPrice * p.stock, 0);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All Items' || p.category === selectedCategory;

    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = p.stock > 0 && p.stock <= p.minStock;
    if (stockFilter === 'out') matchesStock = p.stock <= 0;
    if (stockFilter === 'normal') matchesStock = p.stock > p.minStock;

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      barcode: '',
      category: 'Instant Noodles & Soups',
      unit: 'pack',
      costPrice: 10,
      sellingPrice: 13,
      stock: 12,
      minStock: 5,
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      unit: p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      minStock: p.minStock,
      notes: p.notes || '',
    });
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setIsScannerOpen(false);
    setFormData((prev) => ({ ...prev, barcode: scannedBarcode }));
    playScanBeep();
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.barcode.trim()) return;

    onAddProduct({
      name: formData.name.trim(),
      barcode: formData.barcode.trim(),
      category: formData.category,
      unit: formData.unit.trim() || 'pc',
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 5,
      notes: formData.notes.trim(),
    });

    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    onUpdateProduct({
      ...editingProduct,
      name: formData.name.trim(),
      barcode: formData.barcode.trim(),
      category: formData.category,
      unit: formData.unit.trim() || 'pc',
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 5,
      notes: formData.notes.trim(),
      updatedAt: new Date().toISOString(),
    });

    setEditingProduct(null);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) onImportBackup(content);
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const headers = ['Barcode', 'Name', 'Category', 'Unit', 'Cost Price (Puhunan)', 'Selling Price (Benta)', 'Stock', 'Min Stock', 'Notes'];
    const rows = products.map((p) => [
      `"${p.barcode}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.unit}"`,
      p.costPrice,
      p.sellingPrice,
      p.stock,
      p.minStock,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tindahan_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Inventory Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Kabuuang Paninda</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">{products.length} mga item</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Nasa imbentaryo</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Halaga ng Puhunan</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">₱{totalInventoryValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-[11px] text-emerald-400 mt-0.5">Benta: ₱{totalPotentialRetail.toFixed(0)}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-amber-400 text-xs mb-1 font-medium">
            <span>Paubos na (Low Stock)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-400 tracking-tight">{lowStockCount} mga item</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Kailangang i-restock</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-rose-400 text-xs mb-1 font-medium">
            <span>Ubos na (Out of Stock)</span>
            <PackageX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 tracking-tight">{outOfStockCount} mga item</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Walang stock sa estante</p>
        </div>
      </div>

      {/* Action Header & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hanapin sa pangalan o barcode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Magdagdag ng Paninda</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              title="I-download bilang CSV / Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <label className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Import</span>
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </label>

            <button
              onClick={onResetDefaults}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition-colors shrink-0"
              title="Ibalik sa Sample Sari-Sari Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs: Stock status & Categories */}
        <div className="flex flex-col md:flex-row gap-2 pt-1 border-t border-slate-800/80">
          {/* Stock filter */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                stockFilter === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lahat ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                stockFilter === 'low'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Paubos ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                stockFilter === 'out'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
                  : 'text-rose-400/80 hover:text-rose-300'
              }`}
            >
              <XCircle className="w-3 h-3" />
              Ubos Na ({outOfStockCount})
            </button>
            <button
              onClick={() => setStockFilter('normal')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                stockFilter === 'normal' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sapat na Stock
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="md:ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">Kategorya:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products List / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="py-3 px-4">Paninda at Barcode</th>
                <th className="py-3 px-3">Kategorya</th>
                <th className="py-3 px-3 text-right">Puhunan</th>
                <th className="py-3 px-3 text-right">Benta</th>
                <th className="py-3 px-3 text-right">Tubo</th>
                <th className="py-3 px-4 text-center">Stock on Hand</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Walang nahanap na paninda na tumutugma sa filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const margin = p.sellingPrice - p.costPrice;
                  const marginPercent = p.costPrice > 0 ? (margin / p.costPrice) * 100 : 0;
                  const isOut = p.stock <= 0;
                  const isLow = p.stock > 0 && p.stock <= p.minStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Barcode */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{p.barcode}</span>
                          <span className="text-slate-600">·</span>
                          <span className="uppercase text-slate-500 text-[10px]">{p.unit}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-slate-300">
                        <span className="text-xs text-slate-400">{p.category}</span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        ₱{p.costPrice.toFixed(2)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                        ₱{p.sellingPrice.toFixed(2)}
                      </td>

                      {/* Margin */}
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-400">
                        +₱{margin.toFixed(2)}{' '}
                        <span className="text-emerald-500">({marginPercent.toFixed(0)}%)</span>
                      </td>

                      {/* Stock on Hand with Quick +/- Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => onQuickAdjustStock(p.id, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Bawasan ng 1"
                          >
                            -
                          </button>
                          <span
                            className={`w-10 text-center font-bold font-mono text-xs ${
                              isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-white'
                            }`}
                          >
                            {p.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuickAdjustStock(p.id, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Dagdagan ng 1"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickAdjustStock(p.id, 5)}
                            className="px-1.5 h-6 rounded flex items-center justify-center text-[10px] text-emerald-400 hover:bg-slate-800 font-semibold transition-colors"
                            title="Dagdagan ng 5 (Restock)"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" /> UBOS
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> PAUBOS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> SAPAT
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="I-edit ang Paninda"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Sigurado ka bang nais burahin ang "${p.name}"?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Burahin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                {isAddModalOpen ? 'Magdagdag ng Bagong Paninda' : 'I-edit ang Paninda'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit}
              className="p-5 overflow-y-auto space-y-4"
            >
              {/* Barcode with Scanner Trigger Button */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Barcode Number <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Hal. 4800016644203"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTargetField(isAddModalOpen ? 'add' : 'edit');
                      setIsScannerOpen(true);
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
                    title="I-scan mula sa camera"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>I-scan</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pindutin ang I-scan para basahin ang barcode mula sa mismong supot/bote.
                </p>
              </div>

              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Pangalan ng Paninda <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Hal. Lucky Me Pancit Canton Kalamansi 80g"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Kategorya</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'All Items').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Unit (Sukat)</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="pack, sachet, pc, bote..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Pricing: Cost (Puhunan) & Selling Price (Benta) */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Puhunan (Cost) ₱ <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-emerald-400">
                    Benta (Selling Price) ₱ <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-emerald-400 font-mono font-bold"
                  />
                </div>

                <div className="col-span-2 text-[11px] text-slate-400 flex justify-between">
                  <span>Tubo bawat item:</span>
                  <span className="font-semibold text-emerald-400 font-mono">
                    +₱{(formData.sellingPrice - formData.costPrice).toFixed(2)} (
                    {(formData.costPrice > 0 ? ((formData.sellingPrice - formData.costPrice) / formData.costPrice) * 100 : 0).toFixed(0)}
                    %)
                  </span>
                </div>
              </div>

              {/* Stock on Hand & Min Stock Alert Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Kasalukuyang Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-amber-400">Babala (Min Stock Alert)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Tala / Notes (Opsyonal)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Hal. Mabilis maubos tuwing umaga..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  {isAddModalOpen ? 'I-save ang Paninda' : 'I-update ang Paninda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner modal for adding/editing product */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="I-scan ang Barcode ng Paninda"
        subtitle="Itutok sa barcode ng packaging para kusa itong mai-type"
      />
    </div>
  );
};
