
export interface Order {
  id: string;
  itemNumber: string;
  productName: string;
  quantity: number;
  price: number;
  confirmFormShehab: string;
  estimatedDateReady: string;
  invoiceNumber: string;
  transferAmount: number | null;
  shippingDateToAgent: string;
  shippingDateToSaudi: string;
  arrivalDate: string;
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  userId: string;
}

export interface User {
  id: string;
  username: string;
  password?: string; // Should not be stored long term
  isSupplier: boolean;
  supplierId?: string;
}

export interface Product {
  id: string;
  itemNumber: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  supplierId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPurchase {
  id: string;
  productId: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  purchaseDate: string;
  orderId?: string;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  status: 'active' | 'inactive';
  username: string;
  password: string;
  userId?: string; // Link to User table
  createdAt: string;
  updatedAt: string;
}
