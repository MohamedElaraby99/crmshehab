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
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
      // Debug logging for orders and fix ID mapping
      console.log('Fetched orders:', allOrders.length);
      const ordersWithFixedIds = allOrders.map((order, index) => {
        // Ensure order has proper id field (map _id to id if needed)
        const orderWithId = order as any; // Cast to any to access _id property
        if (!order.id && orderWithId._id) {
          console.log(`Fixing ID for order ${index}:`, {
            orderNumber: order.orderNumber,
            _id: orderWithId._id,
            id: order.id
          });
          return { ...order, id: orderWithId._id };
        }
        return order;
      });
      
      ordersWithFixedIds.forEach((order, index) => {
        if (!order.id || order.id === 'undefined') {
          const orderWithId = order as any; // Cast to any to access _id property
          console.warn(`Order ${index} still has invalid ID after fix:`, {
            order,
            id: order.id,
            _id: orderWithId._id,
            orderNumber: order.orderNumber
          });
        }
      });
      
      setOrders(ordersWithFixedIds);
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
    console.log('OrdersPage: handleCreateOrder called with:', orderData);
    
    // Optimistic UX: close modal immediately
    setShowModal(false);
    console.log('OrdersPage: Modal closed, calling createOrder API...');
    
    try {
      const created = await createOrder(orderData);
      console.log('OrdersPage: createOrder API response:', created);
      
      if (created) {
        console.log('OrdersPage: Order created successfully, refreshing data...');
        await fetchData();
        console.log('OrdersPage: Data refreshed successfully');
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
      
      // For item-level updates (like itemPriceApprovalStatus)
      if ((orderData as any).itemIndex !== undefined) {
        console.log('OrdersPage: Handling item-level update:', orderData);
        const { id, itemIndex, ...updateFields } = orderData as any;
        
        // Update the specific item in the order
        setOrders(prevOrders => 
          prevOrders.map(order => {
            if (order.id === id && order.items && order.items[itemIndex]) {
              const updatedItems = [...order.items];
              updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updateFields };
              console.log('OrdersPage: Updated item in order:', {
                orderId: id,
                itemIndex,
                updatedItem: updatedItems[itemIndex],
                updateFields
              });
              return { ...order, items: updatedItems };
            }
            return order;
          })
        );
        
        // Send the update to the API
        const updated = await updateOrder(id, orderData as any);
        console.log('OrdersPage: API update result:', updated);
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
    // Comprehensive ID validation
    if (!id || 
        id === 'undefined' || 
        id === 'null' || 
        id === '' || 
        typeof id !== 'string' ||
        id.trim() === '') {
      console.error('Cannot delete order: invalid ID', {
        id,
        type: typeof id,
        length: id?.length
      });
      alert('Cannot delete order: invalid ID');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        const deleted = await deleteOrder(id);
        if (deleted) {
          await fetchData();
        } else {
          alert('Failed to delete order');
        }
      } catch (error) {
        console.error('Failed to delete order:', error);
        alert('Failed to delete order. Please try again.');
      }
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowModal(true);
  };

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetailsModal(true);
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
                    <tr 
                      key={order.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewOrderDetails(order)}
                    >
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
                        {order.items && order.items.length > 0 ? (
                          <>
                            <div className="text-sm text-gray-900">
                              {order.items.length === 1 ? (
                                // Single item - show full details
                                `${order.items[0].itemNumber} - ${order.items[0].productId?.name || 'Product'}`
                              ) : (
                                // Multiple items - show summary
                                `${order.items.length} items (click to view all)`
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.items.length === 1 ? (
                                `Qty: ${order.items[0].quantity}`
                              ) : (
                                `Total Qty: ${order.items.reduce((sum, item) => sum + item.quantity, 0)}`
                              )}
                            </div>
                            {order.items.length > 1 && (
                              <div className="text-xs text-blue-600 mt-1">
                                Click row to see all {order.items.length} items
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-gray-500">No items</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.items && order.items.length > 0 ? (
                            order.items.length === 1 ? (
                              // Single item - show unit price
                              `$${order.items[0].unitPrice ? order.items[0].unitPrice.toFixed(2) : '0.00'}`
                            ) : (
                              // Multiple items - show average
                              `$${(order.items.reduce((sum, item) => sum + (item.unitPrice || 0), 0) / order.items.length).toFixed(2)} avg`
                            )
                          ) : (
                            '$0.00'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.items && order.items.length > 0 ? (
                            // Calculate total for all items
                            `$${order.items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0).toFixed(2)}`
                          ) : (
                            '$0.00'
                          )}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOrder(order);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrder(order.id);
                            }}
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

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          vendors={vendors}
          products={products}
          onClose={() => {
            setShowOrderDetailsModal(false);
            setSelectedOrder(null);
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

// Order Details Modal Component
interface OrderDetailsModalProps {
  order: Order;
  vendors: Vendor[];
  products: Product[];
  onClose: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, vendors, products, onClose }) => {
  const getVendorName = () => {
    if (typeof order.vendorId === 'string') {
      const vendor = vendors.find(v => v.id === order.vendorId);
      return vendor?.name || 'Unknown Vendor';
    } else if (order.vendorId && typeof order.vendorId === 'object') {
      return order.vendorId.name || 'Unknown Vendor';
    }
    return 'Unknown Vendor';
  };

  const getProductName = (productId: any) => {
    if (typeof productId === 'object' && productId?.name) {
      return productId.name;
    } else if (typeof productId === 'string') {
      const product = products.find(p => p.id === productId || p.itemNumber === productId);
      return product?.name || 'Unknown Product';
    }
    return 'Unknown Product';
  };

  const formatDate = (dateValue: string | Date | null): string => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Order Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Order Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-md font-semibold text-gray-900 mb-3">Order Information</h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Order Number:</span> {order.orderNumber}</div>
              <div><span className="font-medium">Status:</span> 
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                  order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                </span>
              </div>
              <div><span className="font-medium">Vendor:</span> {getVendorName()}</div>
              <div><span className="font-medium">Order Date:</span> {formatDate(order.orderDate)}</div>
              <div><span className="font-medium">Invoice Number:</span> {order.invoiceNumber || 'N/A'}</div>
              <div><span className="font-medium">Total Amount:</span> ${order.totalAmount || 0}</div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-md font-semibold text-gray-900 mb-3">Additional Information</h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Estimated Ready:</span> {order.estimatedDateReady || 'N/A'}</div>
              <div><span className="font-medium">Shipping to Agent:</span> {order.shippingDateToAgent || 'N/A'}</div>
              <div><span className="font-medium">Shipping to Saudi:</span> {order.shippingDateToSaudi || 'N/A'}</div>
              <div><span className="font-medium">Arrival Date:</span> {order.arrivalDate || 'N/A'}</div>
              <div><span className="font-medium">Transfer Amount:</span> ${order.transferAmount || 0}</div>
              <div><span className="font-medium">Notes:</span> {order.notes || 'No notes'}</div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Order Items</h4>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.itemNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getProductName(item.productId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.unitPrice || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(item.quantity * (item.unitPrice || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {order.items && order.items.length > 0 && (
            <div className="mt-4 text-right">
              <div className="text-lg font-semibold text-gray-900">
                Total Items: {order.items.length} | Total Quantity: {order.items.reduce((sum, item) => sum + item.quantity, 0)}
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
