import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, Vendor, Product } from '../types';
import { getAllOrders, createOrder, updateOrder, deleteOrder, getAllVendors, getAllProducts, getAllFieldConfigs, FieldConfig, createProduct, updateProduct, uploadProductImage, getApiOrigin } from '../services/api';
import DynamicOrderForm from './DynamicOrderForm';
import FieldConfigManager from './FieldConfigManager';
import { OrderFieldConfig } from '../data/orderFieldConfig';

interface OrdersPageProps {
  onLogout: () => void;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<OrderFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allOrders, allVendors, allProducts, allFieldConfigs] = await Promise.all([
        getAllOrders(),
        getAllVendors(),
        getAllProducts(),
        getAllFieldConfigs()
      ]);
      setOrders(allOrders);
      setVendors(allVendors);
      setProducts(allProducts);
      
      // Convert API field configs to OrderFieldConfig format
      if (allFieldConfigs.length > 0) {
        const convertedConfigs = allFieldConfigs.map((config: FieldConfig) => ({
          name: config.name,
          label: config.label,
          type: config.type,
          required: config.required,
          editableBy: config.editableBy,
          visibleTo: config.visibleTo,
          placeholder: config.placeholder,
          options: config.options,
          validation: config.validation
        }));
        console.log('OrdersPage: Loaded field configurations from API', convertedConfigs);
        setFieldConfigs(convertedConfigs);
      } else {
        console.log('OrdersPage: No field configurations found from API');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (orderData: any) => {
    // Optimistic UX: close modal immediately
    setShowModal(false);
    try {
      const created = await createOrder(orderData);
      if (created) {
        await fetchData();
      } else {
        // Reopen if creation failed silently
        console.error('Create order returned null response');
        setShowModal(true);
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      // Reopen modal on error so user can retry
      setShowModal(true);
    }
  };

  const handleUpdateOrder = async (orderData: Order | Partial<Order>) => {
    try {
      console.log('OrdersPage: handleUpdateOrder received orderData:', orderData);
      
      const orderId = (orderData as any).id;
      if (!orderId) {
        console.error('OrdersPage: No order ID provided for update');
        return;
      }
      
      // If this is a partial update (like priceApprovalStatus only), send it directly
      if (Object.keys(orderData).length === 2 && 'id' in orderData && 'priceApprovalStatus' in orderData) {
        console.log('OrdersPage: Sending partial update directly:', orderData);
        const { id, ...updateFields } = orderData as any;
        const updated = await updateOrder(id, updateFields);
        
        // Update local state with the response
        if (updated) {
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === id ? { ...order, ...updated } : order
            )
          );
        }
        return;
      }
      
      // For complete order updates (from modal)
      // Optimistic update - update the local state immediately
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? (orderData as Order) : order
        )
      );
      
      // Close modal immediately for better UX
      setShowModal(false);
      setEditingOrder(null);
      
      // Then make the API call
      console.log('OrdersPage: Sending complete order to API:', orderData);
      const updated = await updateOrder(orderId, orderData as Order);
      
      // Only refresh if there was an error (to sync with server state)
    } catch (error) {
      console.error('Failed to update order:', error);
      // Revert optimistic update on error
      await fetchData();
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        const deleted = await deleteOrder(id);
        if (deleted) {
          await fetchData();
        }
      } catch (error) {
        console.error('Failed to delete order:', error);
      }
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowModal(true);
  };

  const handleFieldConfigChange = (newConfigs: OrderFieldConfig[]) => {
    setFieldConfigs(newConfigs);
    // Force re-render of the modal if it's open
    if (showModal) {
      setShowModal(false);
      setTimeout(() => setShowModal(true), 0);
    }
  };

  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await createProduct(productData as any);
      if (created) {
        await fetchData();
        setShowProductModal(false);
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleUpdateProduct = async (productData: Product) => {
    try {
      const updated = await updateProduct(productData.id, productData);
      if (updated) {
        await fetchData();
        setShowProductModal(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading orders...</div>;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
            <p className="mt-2 text-gray-600">Create and manage orders for vendors</p>
          </div>
          <div className="flex items-center space-x-4">
            <FieldConfigManager onConfigChange={handleFieldConfigChange} />
            <button
              onClick={() => setShowProductModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Add Product
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Order
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Orders ({orders.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price Approval
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.orderNumber || order.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(() => {
                            // Handle both string ID and populated vendor object
                            let vendorName = 'Unknown Vendor';
                            
                            if (typeof order.vendorId === 'string') {
                              // vendorId is a string ID, find the vendor in the vendors array
                              const vendor = vendors.find(v => v.id === order.vendorId);
                              vendorName = vendor?.name || 'Unknown Vendor';
                            } else if (order.vendorId && typeof order.vendorId === 'object') {
                              // vendorId is a populated object, use the name directly
                              vendorName = order.vendorId.name || 'Unknown Vendor';
                            }
                            
                            console.log('OrdersPage: Vendor info:', { vendorId: order.vendorId, vendorName });
                            return vendorName;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.items && order.items[0] ? `${order.items[0].itemNumber} - ${order.items[0].productId?.name || 'Product'}` : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Qty: {order.items && order.items[0] ? order.items[0].quantity : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${order.items && order.items[0] && order.items[0].unitPrice ? order.items[0].unitPrice.toFixed(2) : '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${order.items && order.items[0] ? ((order.items[0].unitPrice || 0) * (order.items[0].quantity || 0)).toFixed(2) : '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${order.totalAmount !== undefined && order.totalAmount !== null ? Number(order.totalAmount).toFixed(2) : '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.confirmFormShehab ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.confirmFormShehab ? 'Confirmed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (order as any).priceApprovalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                          (order as any).priceApprovalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(order as any).priceApprovalStatus ? String((order as any).priceApprovalStatus).toUpperCase() : 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(order.confirmFormShehab || Date.now()).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {orders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No orders found. Create your first order!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Order Modal */}
      {showModal && (
        <DynamicOrderForm
          order={editingOrder}
          vendors={vendors}
          products={products}
          userRole="admin"
          externalFieldConfigs={fieldConfigs}
          onSave={editingOrder ? handleUpdateOrder : handleCreateOrder}
          onClose={() => {
            setShowModal(false);
            setEditingOrder(null);
          }}
        />
      )}

      {/* Product Modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          onSave={editingProduct ? handleUpdateProduct : handleCreateProduct}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};

// Product Modal Component
interface ProductModalProps {
  product: Product | null;
  onSave: (product: any) => void;
  onClose: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    itemNumber: product?.itemNumber || '',
    name: product?.name || '',
    description: product?.description || '',
    sellingPrice: (product as any)?.sellingPrice as number | undefined ?? undefined,
    stock: (product as any)?.stock as number | undefined ?? undefined,
    visibleToClients: (product as any)?.visibleToClients as boolean | undefined ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productData: any = {
      itemNumber: formData.itemNumber,
      name: formData.name,
      description: formData.description,
    };
    if (typeof formData.sellingPrice === 'number' && !Number.isNaN(formData.sellingPrice)) {
      productData.sellingPrice = formData.sellingPrice;
    }
    productData.visibleToClients = !!formData.visibleToClients;
    if (product) {
      productData.id = product.id;
    }
    onSave(productData);
  };

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : (type === 'checkbox' ? checked : value)
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {product ? 'Edit Product' : 'Add New Product'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {product && (
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">Product Image</label>
                <div className="flex items-center space-x-3 mt-1">
                  {(previewUrl || (product as any)?.images?.[0]) ? (
                    <img
                      src={previewUrl || `${getApiOrigin().replace(/\/api\/?$/, '')}${(product as any)?.images?.[0]}`}
                      alt={product.name}
                      className="h-12 w-12 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-500">No image</div>
                  )}
                  <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                    {uploading ? 'Uploading...' : 'Change Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !product) return;
                        const local = URL.createObjectURL(file);
                        setPreviewUrl(local);
                        setUploading(true);
                        const imgs = await uploadProductImage(product.id, file);
                        setUploading(false);
                        if (imgs && imgs.length > 0) {
                          // no-op; list will refresh on save/close
                        } else {
                          alert('Failed to upload image');
                          setPreviewUrl(null);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Item Number</label>
              <input
                name="itemNumber"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={formData.itemNumber}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                name="name"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Selling Price</label>
              <input
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={typeof formData.sellingPrice === 'number' ? String(formData.sellingPrice) : ''}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock</label>
              <input
                name="stock"
                type="number"
                step="1"
                min="0"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={typeof formData.stock === 'number' ? String(formData.stock) : ''}
                onChange={handleChange}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="visibleToClients"
                name="visibleToClients"
                type="checkbox"
                checked={!!formData.visibleToClients}
                onChange={handleChange}
                className="h-4 w-4"
              />
              <label htmlFor="visibleToClients" className="text-sm font-medium text-gray-700">Visible to Clients</label>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-green-600 text-white">Save Product</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
