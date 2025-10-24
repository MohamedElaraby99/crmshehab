import React, { useState, useEffect } from 'react';
import { Vendor, Order, Product } from '../types';
import { getVendorById, getOrdersByVendorId, updateOrder as apiUpdateOrder, getAllOrders, updateVendorByVendor, vendorHeartbeat, vendorOffline, vendorOrdersLastRead, getAllProducts, createProduct, updateProduct, deleteProduct, createOrder, getApiOrigin, uploadProductImage } from '../services/api';
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
  const [selectedImage, setSelectedImage] = useState<{url: string, alt: string} | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');

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
      console.log('VendorDashboard: Has imageFile?', !!productData.imageFile);
      if (productData.imageFile) {
        console.log('VendorDashboard: Image file details:', productData.imageFile.name, productData.imageFile.size);
      }
      
      // Extract image file if present
      const { imageFile, ...productDataWithoutImage } = productData;
      
      const created = await createProduct(productDataWithoutImage);
      if (created) {
        // Upload image if provided
        if (imageFile) {
          console.log('VendorDashboard: Uploading product image:', imageFile);
          const uploadResult = await uploadProductImage(created.id, imageFile);
          console.log('VendorDashboard: Image upload result:', uploadResult);
        } else {
          console.log('VendorDashboard: No image file to upload');
        }
        await fetchDashboardData();
        setShowProductModal(false);
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleUpdateProduct = async (productData: any) => {
    try {
      console.log('VendorDashboard: Updating product:', productData);
      
      // Extract image file if present
      const { imageFile, ...productDataWithoutImage } = productData;
      
      const updated = await updateProduct(productData.id, productDataWithoutImage);
      if (updated) {
        // Upload image if provided
        if (imageFile) {
          console.log('VendorDashboard: Uploading product image:', imageFile);
          await uploadProductImage(productData.id, imageFile);
        }
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="animate-pulse absolute inset-0 rounded-full bg-blue-100 opacity-20"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Loading Dashboard</h3>
          <p className="text-gray-500">Please wait while we fetch your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  Welcome back, {vendor?.name}
                </h1>
                <p className="text-lg text-gray-600">Manage your orders and products from your dashboard</p>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
                  <div className="text-sm text-gray-500">Orders</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{products.length}</div>
                  <div className="text-sm text-gray-500">Products</div>
                </div>
              </div>
            </div>
        </div>

        {/* Modern Tabs */}
        <div className="mb-8">
          <div className="sm:hidden">
            <label htmlFor="tabs" className="sr-only">Select a tab</label>
            <select
              id="tabs"
              name="tabs"
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as 'orders' | 'products')}
            >
              <option value="orders">📋 Orders ({orders.length})</option>
              <option value="products">📦 Products ({products.length})</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
              <nav className="flex space-x-1" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`${
                    activeTab === 'orders'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  } flex items-center space-x-2 whitespace-nowrap py-3 px-6 rounded-lg font-medium text-sm transition-all duration-200`}
                >
                  <span>📋</span>
                  <span>Orders</span>
                  <span className={`${
                    activeTab === 'orders'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  } px-2 py-1 rounded-full text-xs font-semibold`}>
                    {orders.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className={`${
                    activeTab === 'products'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  } flex items-center space-x-2 whitespace-nowrap py-3 px-6 rounded-lg font-medium text-sm transition-all duration-200`}
                >
                  <span>📦</span>
                  <span>Products</span>
                  <span className={`${
                    activeTab === 'products'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  } px-2 py-1 rounded-full text-xs font-semibold`}>
                    {products.length}
                  </span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Modern Orders Section */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Orders Management</h3>
                  <p className="text-gray-600 mt-1">Track and manage your order history</p>
                </div>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  ➕ Add New Order
                </button>
              </div>
            </div>
            <div className="p-8">
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

        {/* Modern Products Section */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Product Catalog</h3>
                  <p className="text-gray-600 mt-1">Manage your inventory and product listings</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 lg:items-center">
                  {/* Search Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                    />
                  </div>
                  
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    ➕ Add New Product
                  </button>
                </div>
              </div>
            </div>

            <div className="p-8">
              {products.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-6">
                    <span className="text-4xl">📦</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Start building your product catalog by adding your first product. Click the button above to get started.
                  </p>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    ➕ Create Your First Product
                  </button>
                </div>
              ) : (() => {
                const filteredProducts = products.filter((product) => {
                  if (!productSearchTerm) return true;
                  const searchLower = productSearchTerm.toLowerCase();
                  return (
                    product.name.toLowerCase().includes(searchLower) ||
                    product.itemNumber.toLowerCase().includes(searchLower) ||
                    (product.description && product.description.toLowerCase().includes(searchLower))
                  );
                });

                if (filteredProducts.length === 0 && productSearchTerm) {
                  return (
                    <div className="text-center py-16">
                      
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        No products match your search for "{productSearchTerm}". Try adjusting your search terms.
                      </p>
                      <button
                        onClick={() => setProductSearchTerm('')}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        🔄 Clear Search
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => (
                    <div key={product.id} className="group bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-gray-300 transition-all duration-300 hover:-translate-y-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="relative h-16 w-16">
                            {productImageMap[product.id] ? (
                              <div 
                                className="relative h-16 w-16 cursor-pointer group/image"
                                onClick={() => setSelectedImage({
                                  url: `${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`,
                                  alt: product.name
                                })}
                              >
                                <img
                                  src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                                  alt={product.name}
                                  className="h-16 w-16 rounded-xl object-cover border-2 border-gray-100 hover:border-blue-300 transition-all duration-200 group-hover:scale-105"
                                  onError={(e) => {
                                    console.error('Failed to load image for product', product.id, productImageMap[product.id]);
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                  }}
                                  onLoad={() => console.log('Image loaded successfully for product', product.id)}
                                />
                                
                              </div>
                            ) : (
                              <div
                                className="h-16 w-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-300 transition-all duration-200 group-hover:scale-105"
                                onClick={() => setSelectedImage({
                                  url: '',
                                  alt: product.name
                                })}
                                title="Click to view product details"
                              >
                                <span className="text-3xl">📦</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">{product.name}</h4>
                            <p className="text-sm text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-md mt-1">{product.itemNumber}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                          title="Edit Product"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>

                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">{product.description}</p>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-gray-500">Active</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: {product.id.slice(-6)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
          </div>
        )}
        </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl transform transition-all duration-300">
            <div className="flex items-center justify-between p-8 border-b border-gray-100">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">👤 Edit Profile</h3>
                <p className="text-gray-600 mt-1">Update your company information</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateVendor({ ...vendor, ...{
                name: (e.target as any).name?.value || vendor.name,
                contactPerson: (e.target as any).contactPerson?.value || vendor.contactPerson,
                email: (e.target as any).email?.value || vendor.email,
                phone: (e.target as any).phone?.value || vendor.phone,
                address: (e.target as any).address?.value || vendor.address,
                city: (e.target as any).city?.value || vendor.city,
                country: (e.target as any).country?.value || vendor.country,
                status: (e.target as any).status?.value || vendor.status
              }});
            }} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={vendor.name}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Person</label>
                  <input
                    type="text"
                    name="contactPerson"
                    defaultValue={vendor.contactPerson}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={vendor.email}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={vendor.phone}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={vendor.address}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={vendor.city}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    name="country"
                    defaultValue={vendor.country}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select
                    name="status"
                    defaultValue={vendor.status}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                  >
                    <option value="active">✅ Active</option>
                    <option value="inactive">⏸️ Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-8 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-3 border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  💾 Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modern Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl transform transition-all duration-300">
            <div className="flex items-center justify-between p-8 border-b border-gray-100">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Create New Order</h3>
                <p className="text-gray-600 mt-1">Add a new order to your system</p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8">
            <DynamicOrderForm
              vendors={[]} // Vendors not needed for vendor creating their own orders
              products={products}
              userRole="vendor"
              onSave={handleCreateOrder}
              onClose={() => setShowOrderModal(false)}
            />
            </div>
          </div>
        </div>
      )}

      {/* Modern Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl transform transition-all duration-300">
            <div className="flex items-center justify-between p-8 border-b border-gray-100">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}
              </h3>
                <p className="text-gray-600 mt-1">
                  {editingProduct ? 'Update product information' : 'Create a new product in your catalog'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8">
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
        </div>
      )}

      {/* Modern Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative max-w-5xl max-h-full w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-16 right-0 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-70 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-bold text-gray-900"> Product Image</h3>
                  <p className="text-gray-600 mt-1">{selectedImage.alt}</p>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-8 flex items-center justify-center bg-gray-50 min-h-[400px]">
                {selectedImage.url ? (
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.alt}
                    className="max-w-full max-h-[500px] object-contain rounded-2xl shadow-lg"
                    onError={() => {
                      console.error('Failed to load image in modal:', selectedImage.url);
                      setSelectedImage(null);
                    }}
                  />
                ) : (
                  <div className="text-center py-16">
                    <div className="mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center mb-6">
                      <span className="text-6xl">📦</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">No Image Available</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      This product doesn't have an associated image yet. You can add one when editing the product.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Click outside or press ESC to close</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default VendorDashboard;
