export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string; // 'pc', 'sachet', 'pack', 'can', 'bottle', 'kilo', 'box'
  costPrice: number; // Puhunan in PHP
  sellingPrice: number; // Presyo / Benta in PHP
  stock: number;
  minStock: number; // Threshold for low stock warning
  imageUrl?: string;
  notes?: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export type PaymentMethod = 'cash' | 'utang' | 'gcash' | 'maya';

export interface CreditPayment {
  id: string;
  amount: number;
  paymentDate: string; // ISO date string of payment
  paymentMethod: 'cash' | 'gcash' | 'maya';
  notes?: string;
  isAdvance?: boolean;
}

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  items: {
    productId: string;
    productName: string;
    barcode: string;
    quantity: number;
    unit: string;
    costPrice: number;
    unitPrice: number;
    subtotal: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  cashTendered: number;
  change: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  isCreditSettled?: boolean;
  creditSettledDate?: string;
  amountPaid?: number; // Total amount paid towards this credit
  payments?: CreditPayment[]; // History of payments with dates
  notes?: string;
  isAdvanceDeposit?: boolean; // If this transaction is a customer advance payment/deposit
}

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  contactNumber: string;
  address: string;
  currencySymbol: string;
  enableScanBeep: boolean;
  enableLowStockSound: boolean;
  defaultLowStockThreshold: number;
}
