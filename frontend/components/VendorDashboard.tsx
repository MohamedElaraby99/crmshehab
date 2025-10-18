import React, { useState, useEffect } from 'react';
import { Vendor, Order, Product } from '../types';
import { getVendorById, getOrdersByVendorId, updateOrder as apiUpdateOrder, getAllOrders, updateVendorByVendor, vendorHeartbeat, vendorOffline, vendorOrdersLastRead, getAllProducts, createProduct, updateProduct, deleteProduct, createOrder, getApiOrigin } from '../services/api';
import OrderTable from './OrderTable';
import ProductHistoryModal from './ProductHistoryModal';
import DynamicOrderForm from './DynamicOrderForm';
import { ProductModal, ProductModalProps } from './ProductsPage';

interface VendorDashboardProps {
  user: Vendor;
  onLogout: () => void;
  onUpdateVendor: (vendor: Vendor) => void;
}

const VendorDashboard: React.FC<VendorDashboardProps> = ({ user, onLogout, onUpdateVendor }) => {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productImageMap, setProductImageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDashboardData();
    // Send immediate heartbeat, then keep-alive every 20s
    vendorHeartbeat().catch(() => {});
    const id = window.setInterval(() => { vendorHeartbeat().catch(() => {}); }, 20000);
    // Mark orders last-read immediately and every 60s while dashboard is open
    vendorOrdersLastRead().catch(() => {});
    const readId = window.setInterval(() => { vendorOrdersLastRead().catch(() => {}); }, 60000);
    const handleBeforeUnload = () => { try { vendorOffline(); } catch {} };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { window.clearInterval(id); window.clearInterval(readId); window.removeEventListener('beforeunload', handleBeforeUnload); };
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [vendorData, vendorOrders, allOrdersData, allProducts] = await Promise.all([
        getVendorById(user.id),
        getOrdersByVendorId(user.id),
        getAllOrders(),
        getAllProducts()
      ]);
      setVendor(vendorData || user);
      setOrders(vendorOrders);
      setAllOrders(allOrdersData);
      setProducts(allProducts);

      // Build product image map
      const imgMap: Record<string, string> = {};
      (allProducts || []).forEach((p: any) => {
        if (Array.isArray(p.images) && p.images.length > 0) {
          imgMap[p.id] = p.images[0];
          console.log('Vendor Dashboard - Product image found:', p.id, p.images[0]);
        } else {
          console.log('Vendor Dashboard - Product has no images:', p.id, p.name);
        }
      });
      // Fallback from recent order item images if product lacks an image
      ;(allOrdersData || []).forEach((order: any) => {
        if (!order?.items) return;
        order.items.forEach((it: any) => {
          const pid = it?.productId?.id || it?.productId;
          const itemImg = it?.itemImageUrl || it?.imagePath;
          // Prefer the first image encountered (orders are generally fetched newest first)
          if (pid && itemImg && !imgMap[pid]) {
            imgMap[pid] = itemImg;
            console.log('Vendor Dashboard - Order item image found:', pid, itemImg);
          }
        });
      });
      console.log('Vendor Dashboard - Product image map:', imgMap);
      setProductImageMap(imgMap);

      // Debug logging
      console.log('Vendor Dashboard - Orders received:', vendorOrders);
      console.log('First order image data:', vendorOrders[0]?.itemImageUrl, vendorOrders[0]?.imagePath);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order | Partial<Order>) => {
    try {
      console.log('VendorDashboard: handleUpdateOrder received:', updatedOrder);
      
      const orderId = (updatedOrder as any).id;
      if (!orderId) {
        console.error('VendorDashboard: No order ID provided for update');
        return;
      }
      
      // For item-level updates (like itemPriceApprovalStatus)
      if ((updatedOrder as any).itemIndex !== undefined) {
        console.log('VendorDashboard: Handling item-level update:', updatedOrder);
        const { id, itemIndex, ...updateFields } = updatedOrder as any;
        
        // Update the specific item in the order
        setOrders(prevOrders => 
          prevOrders.map(order => {
            if (order.id === id && order.items && order.items[itemIndex]) {
              const updatedItems = [...order.items];
              updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updateFields };
              console.log('VendorDashboard: Updated item in order:', {
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
        
        setAllOrders(prevOrders => 
          prevOrders.map(order => {
            if (order.id === id && order.items && order.items[itemIndex]) {
              const updatedItems = [...order.items];
              updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updateFields };
              console.log('VendorDashboard: Updated item in allOrders:', {
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
        const updated = await apiUpdateOrder(id, updatedOrder as any);
        console.log('VendorDashboard: API update result:', updated);
        return;
      }
      
      // For complete order updates
      // Optimistic update - update the local state immediately
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? (updatedOrder as Order) : order
        )
      );
      setAllOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? (updatedOrder as Order) : order
        )
      );
      
      // Then make the API call
      const updated = await apiUpdateOrder(updatedOrder.id, updatedOrder as Order);
      
      // Only refresh if there was an error (to sync with server state)
      // This prevents unnecessary full refreshes
    } catch (error) {
      console.error('Failed to update order:', error);
      // Revert optimistic update on error
      await fetchDashboardData();
    }
  };
  
  const handleDeleteOrder = (orderId: string) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    console.log(`Order ${orderId} deleted.`);
  };

  const handleViewHistory = (itemNumber: string) => {
    setSelectedProduct(itemNumber);
  };

  const handleUpdateVendor = async (updatedVendor: Vendor) => {
    try {
      const updated = await updateVendorByVendor(updatedVendor.id, updatedVendor);
      if (updated) {
        onUpdateVendor(updated);
        setVendor(updated);
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Failed to update vendor:', error);
    }
  };


  const handleCreateOrder = async (orderData: any) => {
    try {
      console.log('VendorDashboard: Creating order:', orderData);

      // For vendor-created orders, ensure vendorId is set to current vendor
      if (user && user.id) {
        orderData.vendorId = user.id;
        console.log('VendorDashboard: Set vendorId to:', user.id);
      }

      console.log('VendorDashboard: Calling createOrder API...');
      const created = await createOrder(orderData);
      console.log('VendorDashboard: createOrder result:', created);

      if (created) {
        console.log('VendorDashboard: Order created successfully, refreshing data...');
        await fetchDashboardData();
        setShowOrderModal(false);
      } else {
        console.error('VendorDashboard: Order creation failed - no data returned');
      }
    } catch (error) {
      console.error('VendorDashboard: Failed to create order:', error);
    }
  };

  const handleCreateProduct = async (productData: any) => {
    try {
      console.log('VendorDashboard: Creating product:', productData);
      const created = await createProduct(productData);
      if (created) {
        await fetchDashboardData();
        setShowProductModal(false);
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleUpdateProduct = async (productData: Product) => {
    try {
      console.log('VendorDashboard: Updating product:', productData);
      const updated = await updateProduct(productData.id, productData);
      if (updated) {
        await fetchDashboardData();
        setShowProductModal(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {vendor?.name}
          </h1>
          <p className="mt-2 text-gray-600">Manage your orders and products</p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="sm:hidden">
            <label htmlFor="tabs" className="sr-only">Select a tab</label>
            <select
              id="tabs"
              name="tabs"
              className="block w-full focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as 'orders' | 'products')}
            >
              <option value="orders">Orders</option>
              <option value="products">Products</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`${
                    activeTab === 'orders'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  Orders ({orders.length})
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className={`${
                    activeTab === 'products'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  Products ({products.length})
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Orders Section */}
        {activeTab === 'orders' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Related Orders</h3>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Add Order
                </button>
              </div>
              <OrderTable
                orders={orders}
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onViewHistory={handleViewHistory}
                userIsAdmin={false}
                currencySymbol={"¥"}
              />
            </div>
          </div>
        )}

        {/* Products Section */}
        {activeTab === 'products' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Products</h3>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Add Product
                </button>
              </div>

              {products.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">📦</div>
                  <div className="font-medium text-gray-700">No products found</div>
                  <div className="text-sm">Click "Add Product" to create your first product.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="h-12 w-12">
                            {productImageMap[product.id] ? (
                              <>
                                <img
                                  src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                                  alt={product.name}
                                  className="h-12 w-12 rounded-lg object-cover border"
                                  onError={(e) => {
                                    console.error('Failed to load image for product', product.id, productImageMap[product.id]);
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                  }}
                                  onLoad={() => console.log('Image loaded successfully for product', product.id)}
                                />
                                <div className="h-12 w-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center hidden">
                                  <span className="text-2xl">📦</span>
                                </div>
                              </>
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                                <span className="text-2xl">📦</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{product.name}</h4>
                            <p className="text-sm text-gray-500 font-mono">{product.itemNumber}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Edit Product"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>

                      <p className="text-sm text-gray-500 mb-4 line-clamp-2 break-words">{product.description}</p>


                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Product History Modal */}
      {selectedProduct && (() => {
        // Find product information from orders
        const productOrders = allOrders.filter(order => 
          order.items?.some(item => item.itemNumber === selectedProduct)
        );
        
        if (productOrders.length === 0) return null;
        
        const firstItem = productOrders[0].items.find(item => item.itemNumber === selectedProduct);
        if (!firstItem) return null;
        
        // Convert orders to ProductPurchase format
        const purchases = productOrders.map(order => ({
          id: order.id,
          productId: firstItem.productId.id,
          vendorId: typeof order.vendorId === 'string' ? order.vendorId : order.vendorId._id,
          vendorName: typeof order.vendorId === 'string' ? 'Unknown' : order.vendorId.name,
          quantity: firstItem.quantity,
          price: firstItem.unitPrice,
          totalAmount: firstItem.totalPrice,
          purchaseDate: order.orderDate,
          orderId: order.id,
          notes: order.notes
        }));
        
        return (
          <ProductHistoryModal
            productId={firstItem.productId.id}
            productName={firstItem.productId.name}
            purchases={purchases}
            onClose={() => setSelectedProduct(null)}
          />
        );
      })()}

      {/* Vendor Edit Modal */}
      {showEditModal && vendor && (
        <VendorEditModal
          vendor={vendor}
          onSave={handleUpdateVendor}
          onClose={() => setShowEditModal(false)}
        />
      )}


      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Order</h3>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <DynamicOrderForm
              vendors={[]} // Vendors not needed for vendor creating their own orders
              products={products}
              userRole="vendor"
              onSave={handleCreateOrder}
              onClose={() => setShowOrderModal(false)}
            />
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <ProductModal
              product={editingProduct}
              onSave={editingProduct ? handleUpdateProduct : handleCreateProduct}
              onClose={() => {
                setShowProductModal(false);
                setEditingProduct(null);
              }}
              userRole="vendor"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Vendor Edit Modal Component
interface VendorEditModalProps {
  vendor: Vendor;
  onSave: (vendor: Vendor) => void;
  onClose: () => void;
}

const VendorEditModal: React.FC<VendorEditModalProps> = ({ vendor, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: vendor.name,
    contactPerson: vendor.contactPerson,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    city: vendor.city,
    country: vendor.country,
    status: vendor.status
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...vendor, ...formData });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Edit Vendor Information
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Update
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
