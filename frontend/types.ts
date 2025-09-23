
export interface OrderItem {
  productId: {
    id: string;
    name: string;
  };
  itemNumber: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  vendorId: string | { _id: string; name: string; contactPerson?: string; email?: string };
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  priceApprovalStatus?: 'pending' | 'approved' | 'rejected';
  confirmFormShehab?: string;
  itemImageUrl?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  notes?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Additional fields that might be added dynamically
  estimatedDateReady?: string;
  invoiceNumber?: string;
  transferAmount?: number | null;
  shippingDateToAgent?: string;
  shippingDateToSaudi?: string;
  arrivalDate?: string;
}


export interface User {
  id: string;
  username: string;
  role?: 'admin' | 'vendor' | 'client';
  password?: string; // Should not be stored long term
}

export interface Product {
  id: string;
  itemNumber: string;
  name: string;
  description: string;
  sellingPrice?: number;
  stock?: number;
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
