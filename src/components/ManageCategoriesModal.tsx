import React, { useState } from 'react';
import { Product } from '../types';
import { Tag, Plus, Edit2, Trash2, Check, X, Layers, AlertCircle, ArrowRight } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../utils/sampleData';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  products: Product[];
  onAddCategory: (categoryName: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (categoryName: string) => void;
  onResetDefaultCategories?: () => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onResetDefaultCategories,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [search, setSearch] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleStartEdit = (cat: string) => {
    setEditingCategory(cat);
    setEditingValue(cat);
  };

  const handleSaveEdit = (oldCat: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      alert('Pakilagay ang wastong pangalan ng kategorya.');
      return;
    }

    if (trimmed.toLowerCase() === oldCat.toLowerCase()) {
      setEditingCategory(null);
      return;
    }

    if (
      categories.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== oldCat.toLowerCase()
      )
    ) {
      alert(`Mayroon nang umiiral na kategorya na may pangalang "${trimmed}".`);
      return;
    }

    const count = products.filter((p) => p.category === oldCat).length;
    if (count > 0) {
      const confirmRename = confirm(
        `Nais mo bang palitan ang pangalan ng "${oldCat}" patungo sa "${trimmed}"?\n\nAwtomatikong ililipat ang ${count} paninda sa bagong kategoryang ito.`
      );
      if (!confirmRename) return;
    }

    onRenameCategory(oldCat, trimmed);
    setEditingCategory(null);
    showFeedback(`Matagumpay na pinalitan: "${oldCat}" ➔ "${trimmed}"`);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Umiiral na ang kategorya na "${trimmed}".`);
      return;
    }

    onAddCategory(trimmed);
    setNewCatName('');
    showFeedback(`Naidagdag ang bagong kategorya: "${trimmed}"`);
  };

  const handleDelete = (cat: string) => {
    const count = products.filter((p) => p.category === cat).length;
    if (count > 0) {
      const confirmDelete = confirm(
        `May ${count} paninda na nakatalaga sa "${cat}".\n\nKung buburahin ito, ililipat ang mga paninda sa kategoryang "Iba pa (General)". Nais mo bang magpatuloy?`
      );
      if (!confirmDelete) return;
    } else {
      const confirmDelete = confirm(`Sigurado ka bang nais mong burahin ang kategoryang "${cat}"?`);
      if (!confirmDelete) return;
    }

    onDeleteCategory(cat);
    showFeedback(`Nabura ang kategorya: "${cat}"`);
  };

  const filtered = categories.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Pamahalaan ang mga Kategorya (Categories)
              </h2>
              <p className="text-xs text-slate-400">
                Baguhin ang pangalan, magdagdag, o mag-ayos ng mga kategorya ng paninda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedbackMsg && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-2 text-xs font-semibold text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Add New Category Input */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40">
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Magdagdag ng Bagong Kategorya:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Hal. Frozen Goods, Softdrinks, School Supplies..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={!newCatName.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>+ Idagdag</span>
              </button>
            </div>
          </form>
        </div>

        {/* Categories List */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400 pb-1">
            <span>
              Kasalukuyang Kategorya ({categories.length})
            </span>
            {categories.length > 5 && (
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hanapin..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-32 sm:w-44"
              />
            )}
          </div>

          <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Walang kategoryang tumutugma sa hinahanap.
              </div>
            ) : (
              filtered.map((cat) => {
                const isEditing = editingCategory === cat;
                const count = products.filter((p) => p.category === cat).length;

                return (
                  <div
                    key={cat}
                    className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="text"
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(cat);
                            if (e.key === 'Escape') setEditingCategory(null);
                          }}
                          className="flex-1 bg-slate-950 border border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                          title="I-save ang Bagong Pangalan"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="Kanselahin"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-xs sm:text-sm font-semibold text-white block truncate">
                              {cat}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {count} mga paninda
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                            title="Palitan ang Pangalan ng Kategoryang ito"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Palitan (Rename)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="p-2 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="Burahin ang Kategorya"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
          {onResetDefaultCategories && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Sigurado ka bang ibabalik sa orihinal na default categories?')) {
                  onResetDefaultCategories();
                  showFeedback('Naibalik sa default categories.');
                }
              }}
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Ibalik sa Default Categories
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold ml-auto"
          >
            Isara
          </button>
        </div>
      </div>
    </div>
  );
};
