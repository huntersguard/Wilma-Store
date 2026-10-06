import { Product, SaleTransaction, StoreSettings } from '../types';
import { DEFAULT_SETTINGS, INITIAL_PRODUCTS } from './sampleData';

const PRODUCTS_KEY = 'tindahan_pos_products_v1';
const SALES_KEY = 'tindahan_pos_sales_v1';
const SETTINGS_KEY = 'tindahan_pos_settings_v1';

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure existing stored products get image URLs if missing
      const enriched = parsed.map((item: Product) => {
        if (!item.imageUrl) {
          const match = INITIAL_PRODUCTS.find((p) => p.id === item.id || p.barcode === item.barcode);
          if (match?.imageUrl) return { ...item, imageUrl: match.imageUrl };
        }
        return item;
      });
      return enriched;
    }
    return INITIAL_PRODUCTS;
  } catch (err) {
    console.error('Error reading products from storage:', err);
    return INITIAL_PRODUCTS;
  }
}

export function saveStoredProducts(products: Product[]): void {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch (err) {
    console.error('Error saving products:', err);
  }
}

export function getStoredSales(): SaleTransaction[] {
  try {
    const raw = localStorage.getItem(SALES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading sales from storage:', err);
    return [];
  }
}

export function saveStoredSales(sales: SaleTransaction[]): void {
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  } catch (err) {
    console.error('Error saving sales:', err);
  }
}

export function getStoredSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    if (parsed.storeName === 'Aling Nena Tindahan & Sari-Sari') {
      parsed.storeName = 'Tindahan ni Wilma';
      parsed.ownerName = 'Wilma';
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Error reading settings:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: StoreSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

export function exportFullBackup(): string {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings: getStoredSettings(),
    products: getStoredProducts(),
    sales: getStoredSales(),
  };
  return JSON.stringify(data, null, 2);
}

export function importFullBackup(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.products && Array.isArray(data.products)) {
      saveStoredProducts(data.products);
    }
    if (data.sales && Array.isArray(data.sales)) {
      saveStoredSales(data.sales);
    }
    if (data.settings && typeof data.settings === 'object') {
      saveStoredSettings(data.settings);
    }
    return true;
  } catch (err) {
    console.error('Failed to import backup:', err);
    return false;
  }
}

export function resetToDefaults(): void {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
}
