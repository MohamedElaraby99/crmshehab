import { User, Order, Product, Vendor, ProductPurchase, Demand } from '../types';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4031/api';

// Return the server origin (without the trailing /api) for building asset URLs
export const getApiOrigin = (): string => {
  const explicitOrigin = (import.meta as any).env?.VITE_API_ORIGIN as string | undefined;
  if (explicitOrigin) return explicitOrigin.replace(/\/$/, '');
  let base = API_BASE_URL;
  // Strip a trailing "/api" or "/api/"
  base = base.replace(/\/api\/?$/, '');
  return base.replace(/\/$/, '');
};

// Socket.IO client (singleton)
let socketInstance: Socket | null = null;
export const getSocket = (): Socket => {
  if (socketInstance) return socketInstance;
  const origin = getApiOrigin();
  socketInstance = io(origin, {
    // Force long-polling to avoid websocket failures in constrained environments
    transports: ['polling'],
    upgrade: false,
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    timeout: 10000,
    path: '/socket.io',
  });
  socketInstance.on('connect', () => console.log('Socket connected', socketInstance?.id));
  socketInstance.on('disconnect', () => console.log('Socket disconnected'));
  ;(window as any).socket = socketInstance; // expose for debugging
  return socketInstance;
};

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
const isTokenExpired = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && now >= payload.exp;
  } catch {
    return false;
  }
};

const clearAuth = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

// Helper function to make unauthenticated API requests
const apiRequestUnauth = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers,
    },
    cache: 'no-store',
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
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers,
    },
    cache: 'no-store',
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
export const authenticateUser = async (username: string, password: string) => {
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

export const authenticateVendor = async (username: string, password: string) => {
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

// Admin: Users API
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const response = await apiRequest('/users');
    return response?.success ? response.data : [];
  } catch (error) {
    console.error('Get users failed:', error);
    return [];
  }
};

export const createUser = async (payload: { username: string; password: string; role: 'admin' | 'vendor' | 'client'; }): Promise<User | null> => {
  try {
    const response = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response?.success ? response.data : null;
  } catch (error) {
    console.error('Create user failed:', error);
    return null;
  }
};

export const updateUser = async (id: string, updates: Partial<{ username: string; role: 'admin' | 'vendor' | 'client'; isActive: boolean; }>): Promise<User | null> => {
  try {
    const response = await apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response?.success ? response.data : null;
  } catch (error) {
    console.error('Update user failed:', error);
    return null;
  }
};

export const deleteUser = async (id: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/users/${id}`, {
      method: 'DELETE',
    });
    return !!response?.success;
  } catch (error) {
    console.error('Delete user failed:', error);
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
    console.error('Vendor self-update failed:', error);
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

export const updateVendorCredentials = async (id: string, credentials: { username?: string; password?: string }): Promise<Vendor | null> => {
  try {
    const response = await apiRequest(`/vendors/${id}/credentials`, {
      method: 'PUT',
      body: JSON.stringify(credentials),
    });
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Update vendor credentials failed:', error);
    return null;
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

export const getVisibleProducts = async (): Promise<Product[]> => {
  try {
    const response = await apiRequest('/products/visible/list');
    return response.success ? response.data : [];
  } catch (error) {
    console.error('Get visible products failed:', error);
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

export const uploadProductImage = async (id: string, file: File): Promise<string[] | null> => {
  try {
    const token = localStorage.getItem('authToken');
    const url = `${API_BASE_URL}/products/${id}/image`;
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.data.images : null;
  } catch (error) {
    console.error('Upload product image failed:', error);
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
    console.log('API: createOrder called with:', order);
    console.log('API: Sending POST request to /orders');
    
    const response = await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    
    console.log('API: createOrder response:', response);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Create order failed:', error);
    return null;
  }
};

export const updateOrder = async (id: string, updates: Partial<Order>): Promise<Order | null> => {
  try {
    console.log('API: updateOrder called with id:', id);
    console.log('API: updates object:', updates);
    console.log('API: updates type:', typeof updates);
    console.log('API: updates keys:', Object.keys(updates || {}));
    console.log('API: priceApprovalStatus in updates:', updates.priceApprovalStatus);
    console.log('API: JSON.stringify(updates):', JSON.stringify(updates));
    
    const response = await apiRequest(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    console.log('API: updateOrder response:', response);
    console.log('API: Response data priceApprovalStatus:', response.data?.priceApprovalStatus);
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

// Upload order item image
export const uploadOrderImage = async (id: string, file: File): Promise<Order | null> => {
  try {
    const token = localStorage.getItem('authToken');
    const url = `${API_BASE_URL}/orders/${id}/image`;
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Upload order image failed:', error);
    return null;
  }
};

// Upload image for specific item in order
export const uploadOrderItemImage = async (orderId: string, itemIndex: number, file: File): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    const url = `${API_BASE_URL}/orders/${orderId}/item/${itemIndex}/image`;
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Upload order item image failed:', error);
    return { success: false, message: 'Failed to upload item image' };
  }
};

// Confirm item and add to stock
export const confirmOrderItem = async (orderId: string, itemIndex: number, quantity: number): Promise<{ success: boolean; data?: Order; message?: string; stockUpdate?: any }> => {
  try {
    const response = await apiRequest(`/orders/${orderId}/confirm-item`, {
      method: 'POST',
      body: JSON.stringify({ itemIndex, quantity }),
    });
    return response;
  } catch (error) {
    console.error('Confirm order item failed:', error);
    return { success: false, message: 'Failed to confirm item' };
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

export const createDemand = async (productId: string, quantity: number = 1, notes?: string): Promise<boolean> => {
  try {
    const response = await apiRequest('/demands', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, notes })
    });
    return !!response?.success;
  } catch (error) {
    console.error('Create demand failed:', error);
    return false;
  }
};

export const getAllDemands = async (): Promise<Demand[]> => {
  try {
    const response = await apiRequest('/demands');
    return response?.success ? response.data : [];
  } catch (error) {
    console.error('Get demands failed:', error);
    return [];
  }
};

export const getMyDemands = async (): Promise<Demand[]> => {
  try {
    const response = await apiRequest('/demands/mine');
    return response?.success ? response.data : [];
  } catch (error) {
    console.error('Get my demands failed:', error);
    return [];
  }
};

// WhatsApp Recipients API (admin)
export interface WhatsAppRecipient { id: string; phone: string; name?: string; createdAt: string }

export const getWhatsAppRecipients = async (): Promise<WhatsAppRecipient[]> => {
  try {
    const response = await apiRequest('/whatsapp-recipients');
    const list = response?.success ? (response.data || []) : [];
    return list.map((r: any) => ({ ...r, id: r.id || r._id }));
  } catch (error) {
    console.error('Get WhatsApp recipients failed:', error);
    return [];
  }
};

export const createWhatsAppRecipient = async (payload: { phone: string; name?: string }): Promise<WhatsAppRecipient | null> => {
  try {
    const response = await apiRequest('/whatsapp-recipients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response?.success ? { ...(response.data || {}), id: response.data?.id || response.data?._id } : null;
  } catch (error) {
    console.error('Create WhatsApp recipient failed:', error);
    return null;
  }
};

export const deleteWhatsAppRecipient = async (id: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/whatsapp-recipients/${id}`, {
      method: 'DELETE'
    });
    return !!response?.success;
  } catch (error) {
    console.error('Delete WhatsApp recipient failed:', error);
    return false;
  }
};
export const updateDemandStatus = async (id: string, status: 'pending' | 'confirmed' | 'rejected'): Promise<Demand | null> => {
  try {
    const response = await apiRequest(`/demands/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    return response?.success ? response.data : null;
  } catch (error) {
    console.error('Update demand status failed:', error);
    return null;
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
