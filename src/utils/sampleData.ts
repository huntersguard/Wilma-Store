import { Product, StoreSettings } from '../types';

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Wilmanatic Store',
  ownerName: 'Wilma Cuyos',
  contactNumber: '0912-3456-7890',
  address: 'Brgy. Kiwalan',
  currencySymbol: '₱',
  enableScanBeep: true,
  enableLowStockSound: true,
  defaultLowStockThreshold: 5,
  theme: 'rose-boutique',
  adminPin: '113024',
  requireUtangPin: true,
  recoveryQuestion: 'Ano ang pangalan ng May-ari ng tindahan?',
  recoveryAnswer: 'Wilma',
  masterRecoveryCode: 'OWNER-999999',
};

// GUARANTEE: Empty initial products array.
// Never holds any sample or mock items so products can never be auto-seeded or resurrected.
export const INITIAL_PRODUCTS: Product[] = [];

// Helper to identify and block legacy boilerplate demo product IDs (prod-001 through prod-024)
export const isSampleProductId = (id: string): boolean => {
  return /^prod-0(0[1-9]|1[0-9]|2[0-4])$/.test(id);
};

export const DEFAULT_CATEGORIES = [
  'Instant Noodles',
  'Coffee & Beverages',
  'Canned Goods',
  'Snacks',
  'Sachets',
  'Laundry',
  'Candies',
  'Shampoo & Soaps',
];

export const CATEGORIES = [
  'All Items',
  ...DEFAULT_CATEGORIES,
];
