import { User, Supplier, Order, Product, Vendor, ProductPurchase } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('authToken');
  if (!token) return false;
  
  // Check if token is expired
  if (isTokenExpired(token)) {
    clearAuth();
    return false;
  }
  
  return true;
};

// Helper function to check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true; // If we can't parse the token, consider it expired
  }
};

// Helper function to clear authentication data
const clearAuth = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

// Helper function to make unauthenticated API requests
const apiRequestUnauth = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Helper function to make authenticated API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = getAuthToken();
  
  // Check if token is expired before making the request
  if (token && isTokenExpired(token)) {
    console.warn('Token expired, clearing authentication and redirecting to login');
    clearAuth();
    window.location.href = '/';
    return;
  }
  
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        console.warn('Authentication failed, clearing token and redirecting to login');
        clearAuth();
        // Redirect to login page
        window.location.href = '/';
        return;
      }
      
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Authentication functions
export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
  try {
    const response = await apiRequestUnauth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.success && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
      return response.data.user;
    }
    return null;
  } catch (error) {
    console.error('User authentication failed:', error);
    return null;
  }
};

export const authenticateVendor = async (username: string, password: string): Promise<Vendor | null> => {
  try {
    const response = await apiRequestUnauth('/auth/vendor-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.success && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
      return response.data.vendor;
    }
    return null;
  } catch (error) {
    console.error('Vendor authentication failed:', error);
    return null;
  }
};

// User functions
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await apiRequest('/auth/me');
    return response.success ? response.data.user : null;
  } catch (error) {
    console.error('Get current user failed:', error);
    return null;
  }
};

export const getCurrentVendor = async (): Promise<Vendor | null> => {
  try {
    const response = await apiRequest('/auth/vendor-me');
    return response.success ? response.data.vendor : null;
  } catch (error) {
    console.error('Get current vendor failed:', error);
    return null;
  }
};

// Supplier functions
export const getAllSuppliers = async (): Promise<Supplier[]> => {
  try {
    const response = await apiRequest('/suppliers');
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get suppliers failed:', error);
    return [];
  }
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
  try {
    const response = await apiRequest(`/suppliers/${id}`);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Get supplier failed:', error);
    return null;
  }
};

export const createSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier | null> => {
  try {
    const response = await apiRequest('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplier),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Create supplier failed:', error);
    return null;
  }
};

export const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<Supplier | null> => {
  try {
    const response = await apiRequest(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update supplier failed:', error);
    return null;
  }
};

export const deleteSupplier = async (id: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/suppliers/${id}`, {
      method: 'DELETE',
    });
    return response.success;
  } catch (error) {
    console.error('Delete supplier failed:', error);
    return false;
  }
};

// Vendor functions
export const getAllVendors = async (): Promise<Vendor[]> => {
  try {
    const response = await apiRequest('/vendors');
    console.log('getAllVendors response:', response);
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get vendors failed:', error);
    return [];
  }
};

export const getVendorById = async (id: string): Promise<Vendor | null> => {
  try {
    const response = await apiRequest(`/vendors/${id}`);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Get vendor failed:', error);
    return null;
  }
};

export const createVendor = async (vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'username' | 'password' | 'userId'>): Promise<Vendor | null> => {
  try {
    const response = await apiRequest('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
    return response.success ? response.data.vendor : null;
  } catch (error) {
    console.error('Create vendor failed:', error);
    return null;
  }
};

export const updateVendor = async (id: string, updates: Partial<Vendor>): Promise<Vendor | null> => {
  try {
    const response = await apiRequest(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update vendor failed:', error);
    return null;
  }
};

export const updateVendorByVendor = async (id: string, updates: Partial<Vendor>): Promise<Vendor | null> => {
  try {
    const response = await apiRequest(`/vendors/vendor/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update vendor profile failed:', error);
    return null;
  }
};

export const deleteVendor = async (id: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/vendors/${id}`, {
      method: 'DELETE',
    });
    return response.success;
  } catch (error) {
    console.error('Delete vendor failed:', error);
    return false;
  }
};

// Product functions
export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const response = await apiRequest('/products');
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get products failed:', error);
    return [];
  }
};

export const getProductById = async (id: string): Promise<Product | null> => {
  try {
    const response = await apiRequest(`/products/${id}`);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Get product failed:', error);
    return null;
  }
};

export const getProductsBySupplierId = async (supplierId: string): Promise<Product[]> => {
  try {
    const response = await apiRequest(`/products?supplierId=${supplierId}`);
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get products by supplier failed:', error);
    return [];
  }
};

export const createProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product | null> => {
  try {
    const response = await apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Create product failed:', error);
    return null;
  }
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  try {
    const response = await apiRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update product failed:', error);
    return null;
  }
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/products/${id}`, {
      method: 'DELETE',
    });
    return response.success;
  } catch (error) {
    console.error('Delete product failed:', error);
    return false;
  }
};

// Order functions
export const getAllOrders = async (searchParams?: { search?: string; searchType?: string }): Promise<Order[]> => {
  try {
    let url = '/orders';
    if (searchParams?.search) {
      const params = new URLSearchParams();
      params.append('search', searchParams.search);
      if (searchParams.searchType) {
        params.append('searchType', searchParams.searchType);
      }
      url += `?${params.toString()}`;
    }
    const response = await apiRequest(url);
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get orders failed:', error);
    return [];
  }
};

export const getOrderById = async (id: string): Promise<Order | null> => {
  try {
    const response = await apiRequest(`/orders/${id}`);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Get order failed:', error);
    return null;
  }
};

export const getOrdersBySupplierId = async (supplierId: string): Promise<Order[]> => {
  try {
    const response = await apiRequest(`/orders?supplierId=${supplierId}`);
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get orders by supplier failed:', error);
    return [];
  }
};

export const getOrdersByVendorId = async (vendorId: string, searchParams?: { search?: string; searchType?: string }): Promise<Order[]> => {
  try {
    let url = `/orders/vendor/${vendorId}`;
    if (searchParams?.search) {
      const params = new URLSearchParams();
      params.append('search', searchParams.search);
      if (searchParams.searchType) {
        params.append('searchType', searchParams.searchType);
      }
      url += `?${params.toString()}`;
    }
    const response = await apiRequest(url);
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get orders by vendor failed:', error);
    return [];
  }
};

export const createOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order | null> => {
  try {
    const response = await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Create order failed:', error);
    return null;
  }
};

export const updateOrder = async (id: string, updates: Partial<Order>): Promise<Order | null> => {
  try {
    const response = await apiRequest(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update order failed:', error);
    return null;
  }
};

export const deleteOrder = async (id: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/orders/${id}`, {
      method: 'DELETE',
    });
    return response.success;
  } catch (error) {
    console.error('Delete order failed:', error);
    return false;
  }
};

// Product Purchase functions
export const getProductPurchases = async (productId: string): Promise<ProductPurchase[]> => {
  try {
    const response = await apiRequest(`/products/${productId}/purchases`);
    return response.success ? response.data.purchases : [];
  } catch (error) {
    console.error('Get product purchases failed:', error);
    return [];
  }
};

export const getAllProductPurchases = async (): Promise<ProductPurchase[]> => {
  try {
    const response = await apiRequest('/product-purchases');
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get all product purchases failed:', error);
    return [];
  }
};

export const getVendorPurchases = async (vendorId: string): Promise<ProductPurchase[]> => {
  try {
    const response = await apiRequest(`/product-purchases?vendorId=${vendorId}`);
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get vendor purchases failed:', error);
    return [];
  }
};

export const createProductPurchase = async (purchase: Omit<ProductPurchase, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductPurchase | null> => {
  try {
    const response = await apiRequest('/product-purchases', {
      method: 'POST',
      body: JSON.stringify(purchase),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Create product purchase failed:', error);
    return null;
  }
};

export const getProductPurchaseStats = async (productId: string) => {
  try {
    const response = await apiRequest(`/products/${productId}/statistics`);
    return response.success ? response.data : {
      totalPurchases: 0,
      totalQuantity: 0,
      totalAmount: 0,
      averagePrice: 0,
      uniqueVendors: 0,
      lastPurchase: null,
      purchases: []
    };
  } catch (error) {
    console.error('Get product purchase stats failed:', error);
    return {
      totalPurchases: 0,
      totalQuantity: 0,
      totalAmount: 0,
      averagePrice: 0,
      uniqueVendors: 0,
      lastPurchase: null,
      purchases: []
    };
  }
};

// Logout function
export const logout = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('currentVendor');
};

// Field Configuration API
export interface FieldConfig {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  editableBy: 'admin' | 'vendor' | 'both';
  visibleTo: 'admin' | 'vendor' | 'both';
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getAllFieldConfigs = async (): Promise<FieldConfig[]> => {
  try {
    const response = await apiRequest('/field-configs');
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get all field configs failed:', error);
    return [];
  }
};

export const getFieldConfig = async (name: string): Promise<FieldConfig | null> => {
  try {
    const response = await apiRequest(`/field-configs/name/${name}`);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Get field config failed:', error);
    return null;
  }
};

export const createFieldConfig = async (config: Omit<FieldConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<FieldConfig | null> => {
  try {
    const response = await apiRequest('/field-configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Create field config failed:', error);
    return null;
  }
};

export const updateFieldConfig = async (name: string, updates: Partial<FieldConfig>): Promise<FieldConfig | null> => {
  try {
    const response = await apiRequest(`/field-configs/name/${name}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update field config failed:', error);
    return null;
  }
};

export const bulkUpdateFieldConfigs = async (configs: Partial<FieldConfig>[]): Promise<FieldConfig[]> => {
  try {
    const response = await apiRequest('/field-configs/bulk', {
      method: 'PUT',
      body: JSON.stringify({ configs }),
    });
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Bulk update field configs failed:', error);
    return [];
  }
};

export const deleteFieldConfig = async (name: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/field-configs/name/${name}`, {
      method: 'DELETE',
    });
    return response.success;
  } catch (error) {
    console.error('Delete field config failed:', error);
    return false;
  }
};

export const resetFieldConfigs = async (): Promise<FieldConfig[]> => {
  try {
    const response = await apiRequest('/field-configs/reset', {
      method: 'POST',
    });
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Reset field configs failed:', error);
    return [];
  }
};
