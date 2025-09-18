import { User, Supplier, Order, Product, Vendor } from '../types';
import { MOCK_USERS, MOCK_SUPPLIERS, MOCK_ORDERS, MOCK_PRODUCTS, MOCK_VENDORS } from '../data/mockData';

let users: User[] = MOCK_USERS;
let suppliers: Supplier[] = MOCK_SUPPLIERS;
let orders: Order[] = MOCK_ORDERS;
let products: Product[] = MOCK_PRODUCTS;
let vendors: Vendor[] = MOCK_VENDORS;

export const authenticateUser = (username: string, password: string): User | null => {
  // In a real app, you'd send this to a backend for secure authentication.
  // For this prototype, we find the user by username and ignore the password.
  const user = users.find(u => u.username === username);
  return user ? { ...user } : null; // Return a copy
};

export const getSupplierById = (id: string): Supplier | undefined => {
  return suppliers.find(s => s.id === id);
};

export const getOrdersBySupplierId = (supplierId: string): Order[] => {
  // In a real DB, orders would be linked to suppliers. Here we simulate it.
  if(supplierId === 's1') {
      return orders.filter(o => ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o11', 'o12'].includes(o.id));
  }
  if(supplierId === 's2') {
      return orders.filter(o => ['o8', 'o9', 'o10'].includes(o.id) || o.itemNumber.startsWith('NEWITEM'));
  }
  return [];
};

export const getAllOrders = (): Order[] => {
    return [...orders];
};

export const updateOrder = (updatedOrder: Order): Order | null => {
  const orderIndex = orders.findIndex(o => o.id === updatedOrder.id);
  if (orderIndex !== -1) {
    orders[orderIndex] = updatedOrder;
    return orders[orderIndex];
  }
  return null;
};

// Vendor API functions
export const getAllVendors = (): Vendor[] => {
  return [...vendors];
};

export const getVendorById = (id: string): Vendor | undefined => {
  return vendors.find(v => v.id === id);
};

export const createVendor = (vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Vendor => {
  const newVendor: Vendor = {
    ...vendor,
    id: `v${vendors.length + 1}`,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0]
  };
  vendors.push(newVendor);
  return newVendor;
};

export const updateVendor = (updatedVendor: Vendor): Vendor | null => {
  const vendorIndex = vendors.findIndex(v => v.id === updatedVendor.id);
  if (vendorIndex !== -1) {
    vendors[vendorIndex] = { ...updatedVendor, updatedAt: new Date().toISOString().split('T')[0] };
    return vendors[vendorIndex];
  }
  return null;
};

export const deleteVendor = (id: string): boolean => {
  const vendorIndex = vendors.findIndex(v => v.id === id);
  if (vendorIndex !== -1) {
    vendors.splice(vendorIndex, 1);
    return true;
  }
  return false;
};

// Product API functions
export const getAllProducts = (): Product[] => {
  return [...products];
};

export const getProductById = (id: string): Product | undefined => {
  return products.find(p => p.id === id);
};

export const getProductsBySupplierId = (supplierId: string): Product[] => {
  return products.filter(p => p.supplierId === supplierId);
};

export const createProduct = (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
  const newProduct: Product = {
    ...product,
    id: `p${products.length + 1}`,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0]
  };
  products.push(newProduct);
  return newProduct;
};

export const updateProduct = (updatedProduct: Product): Product | null => {
  const productIndex = products.findIndex(p => p.id === updatedProduct.id);
  if (productIndex !== -1) {
    products[productIndex] = { ...updatedProduct, updatedAt: new Date().toISOString().split('T')[0] };
    return products[productIndex];
  }
  return null;
};

export const deleteProduct = (id: string): boolean => {
  const productIndex = products.findIndex(p => p.id === id);
  if (productIndex !== -1) {
    products.splice(productIndex, 1);
    return true;
  }
  return false;
};
