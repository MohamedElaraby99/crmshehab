import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Product, ProductPurchase, User } from '../types';
import { createProduct, deleteProduct, getAllOrders, getAllProducts, getVisibleProducts, getApiOrigin, getProductPurchases, getCurrentUser, updateProduct, uploadProductImage, getSocket, importProductsFromExcel, importInvoiceFromExcel, sendProductsToExternalApp, createOrder } from '../services/api';
import ProductHistoryModal from './ProductHistoryModal';

interface ProductsPageProps {
  onLogout: () => void;
  forceClient?: boolean;
}

const ProductsPage: React.FC<ProductsPageProps> = ({ onLogout, forceClient }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductHistory, setSelectedProductHistory] = useState<{product: Product, purchases: ProductPurchase[]} | null>(null);
  const [productImageMap, setProductImageMap] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{ id: string; name: string; itemNumber: string; price: number; quantity: number }>>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePreviewTitle, setImagePreviewTitle] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<Array<{ itemNumber: string; quantity: number; paid: boolean; matched: boolean; name?: string; currentStock?: number; newStock?: number; reason?: string }>>([]);
  const [invoiceApplying, setInvoiceApplying] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [sendingProducts, setSendingProducts] = useState(false);
  const [lastExternalSync, setLastExternalSync] = useState<{ total: number; exportedAt: string } | null>(null);

  const userIsAdmin = useMemo(() => (currentUser?.role === 'admin'), [currentUser]);
  const userIsClient = false; // Client role removed
  const userIsVendor = useMemo(() => (currentUser?.role === 'vendor'), [currentUser]);


  // Consistent price formatting based on role
  const formatPriceForUser = (value: number | null | undefined) => {
    if (value === null || value === undefined || typeof value !== 'number' || Number.isNaN(value)) {
      return { display: 'Not Set', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    }
    const formattedPrice = userIsClient ? `${value.toFixed(2)} RS ريال سعودي` : `¥ ${value.toFixed(2)}`;
    return { display: formattedPrice, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
  };

  useEffect(() => {
    const init = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch {}
      // Restore cart
      try {
        const saved = localStorage.getItem('clientCart');
        if (saved) setCartItems(JSON.parse(saved));
      } catch {}
      fetchData();
    };
    init();
  }, []);

  // Realtime: refresh products when orders/products/demands change
  useEffect(() => {
    const socket = getSocket();
    const onAnyChange = () => fetchData();
    socket.on('orders:created', onAnyChange);
    socket.on('orders:updated', onAnyChange);
    socket.on('orders:deleted', onAnyChange);
    socket.on('products:created', onAnyChange);
    socket.on('products:updated', onAnyChange);
    socket.on('products:deleted', onAnyChange);
    return () => {
      socket.off('orders:created', onAnyChange);
      socket.off('orders:updated', onAnyChange);
      socket.off('orders:deleted', onAnyChange);
      socket.off('products:created', onAnyChange);
      socket.off('products:updated', onAnyChange);
      socket.off('products:deleted', onAnyChange);
    };
  }, []);

  // Refetch when role changes (e.g., after currentUser loads)
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsClient]);

  const persistCart = (items: typeof cartItems) => {
    setCartItems(items);
    try { localStorage.setItem('clientCart', JSON.stringify(items)); } catch {}
  };

  const addToCart = (p: Product) => {
    const price = typeof (p as any).sellingPrice === 'number' ? (p as any).sellingPrice as number : 0;
    const existing = cartItems.find(ci => ci.id === p.id);
    if (existing) {
      const updated = cartItems.map(ci => ci.id === p.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      persistCart(updated);
    } else {
      const item = { id: p.id, name: p.name, itemNumber: p.itemNumber, price, quantity: 1 };
      persistCart([...cartItems, item]);
    }
  };


  const removeFromCart = (id: string) => {
    persistCart(cartItems.filter(ci => ci.id !== id));
  };

  const changeQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    persistCart(cartItems.map(ci => ci.id === id ? { ...ci, quantity: qty } : ci));
  };

  const submitDemandFromCart = async () => {
    if (cartItems.length === 0) {
      alert('Cart is empty');
      return;
    }

    try {
      // Convert cart items to order items format
      const items = cartItems.map(ci => {
        const product = products.find(p => p.id === ci.id);
        return {
          productId: ci.id,
          itemNumber: ci.itemNumber,
          quantity: ci.quantity,
          unitPrice: ci.price,
          totalPrice: ci.price * ci.quantity,
        };
      });

      // For client demands, we might need a special vendor or the backend handles it differently
      // For now, we'll try to create an order - the backend might need vendorId
      // If this fails, we may need to create a demand-specific endpoint
      const orderData: any = {
        orderNumber: `DEMAND-${String(Date.now()).slice(-6)}`,
        items: items,
        status: 'pending',
        notes: 'Client demand from cart',
      };

      // Note: The backend requires vendorId, but for client demands this might be handled differently
      // You may need to add a special vendorId for client demands or modify the backend
      const created = await createOrder(orderData);
      
      if (created) {
        alert('Demand submitted successfully!');
        persistCart([]);
        setCartOpen(false);
        await fetchData();
      } else {
        alert('Failed to submit demand. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to submit demand:', error);
      alert(error?.message || 'Failed to submit demand. Please try again.');
    }
  };

  const cartCount = cartItems.reduce((s, ci) => s + ci.quantity, 0);
  const cartTotal = cartItems.reduce((s, ci) => s + ci.quantity * ci.price, 0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allProducts, allOrders] = await Promise.all([
        userIsClient ? getVisibleProducts() : getAllProducts(),
        getAllOrders(),
      ]);
      setProducts(allProducts);

      const imgMap: Record<string, string> = {};
      (allProducts || []).forEach((p: any) => {
        if (Array.isArray(p.images) && p.images.length > 0) {
          imgMap[p.id] = p.images[0];
          console.log('Product image found:', p.id, p.images[0]);
        } else {
          console.log('Product has no images:', p.id, p.name);
        }
      });
      // Fallback from recent order item images if product lacks an image
      ;(allOrders || []).forEach((order: any) => {
        if (!order?.items) return;
        order.items.forEach((it: any) => {
          const pid = it?.productId?.id || it?.productId;
          const itemImg = it?.itemImageUrl || it?.imagePath;
          // Prefer the first image encountered (orders are generally fetched newest first)
          if (pid && itemImg && !imgMap[pid]) {
            imgMap[pid] = itemImg;
            console.log('Order item image found:', pid, itemImg);
          }
        });
      });
      console.log('Product image map:', imgMap);
      setProductImageMap(imgMap);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await createProduct(productData as any);
      if (created) {
        await fetchData();
        setShowModal(false);
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
        setShowModal(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const ok = await deleteProduct(id);
      if (ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const toggleVisibility = async (product: Product) => {
    const current = ((product as any).visibleToClients === false ? false : true);
    const next = !current;
    const productId = (product as any).id || (product as any)._id;
    if (!productId) {
      console.error('toggleVisibility: missing product id', product);
      alert('Cannot update visibility: missing product id');
      return;
    }
    // Optimistic update
    setProducts(prev => prev.map(p => ((p as any).id || (p as any)._id) === productId ? { ...p, visibleToClients: next } : p));
    try {
      const updated = await updateProduct(productId, { visibleToClients: next } as any);
      if (!updated) {
        // Revert on failure
        setProducts(prev => prev.map(p => ((p as any).id || (p as any)._id) === productId ? { ...p, visibleToClients: current } : p));
        alert('Failed to update visibility.');
      }
    } catch (error) {
      // Revert on error
      setProducts(prev => prev.map(p => ((p as any).id || (p as any)._id) === productId ? { ...p, visibleToClients: current } : p));
      console.error('Failed to toggle visibility:', error);
      alert('Failed to update visibility.');
    }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = userIsClient ? products.filter((p) => (p as any).visibleToClients === true) : products;
    if (!term) return base;
    return base.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.itemNumber.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term)
    );
  }, [products, searchTerm, userIsClient]);

  const getProductPurchaseStatsSync = (productId: string) => {
    return { totalPurchases: 0, uniqueVendors: 0, totalQuantity: 0, totalAmount: 0 };
  };

  const handleViewHistory = async (product: Product) => {
    if (userIsClient) return; // clients cannot view history
    try {
      const purchasesArr = await getProductPurchases(product.id);
      const purchases = Array.isArray(purchasesArr) ? purchasesArr : [];
      setSelectedProductHistory({ product, purchases });
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  const openImagePreview = (product: Product) => {
    const path = productImageMap[product.id];
    if (!path) return;
    const fullUrl = `${getApiOrigin().replace(/\/api\/?$/, '')}${path}`;
    setImagePreviewUrl(fullUrl);
    setImagePreviewTitle(product.name);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleSendProductsToExternalApp = async () => {
    const shouldSend = window.confirm('Send all active products to the configured external application now?');
    if (!shouldSend) return;
    setSendingProducts(true);
    try {
      const response = await sendProductsToExternalApp();
      const total = response?.data?.meta?.total ?? 0;
      const exportedAt = response?.data?.meta?.exportedAt;
      if (exportedAt) {
        setLastExternalSync({ total, exportedAt });
      }
      const remoteStatus = response?.data?.remoteResponse?.status
        ? ` (External status: ${response.data.remoteResponse.status})`
        : '';
      alert(response?.message || `Products sent successfully.${remoteStatus}`);
    } catch (error: any) {
      console.error('Failed to send products externally', error);
      const message = error?.message || 'Failed to send products to external app.';
      alert(message);
    } finally {
      setSendingProducts(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500">Discover our catalog and send demands easily</p>
        </div>
        <div className="flex items-center space-x-2">
          {currentUser && !userIsClient && (
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow"
            >
              Add Product
            </button>
          )}
          {userIsAdmin && (
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow"
            >
              Import Excel
            </button>
          )}
          {userIsAdmin && (
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow"
            >
              Import Invoice
            </button>
          )}
       
          {userIsClient && (
            <button
              onClick={() => setCartOpen(true)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center shadow"
              title="View Cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1l1.2 6A2 2 0 007.18 13h6.64a2 2 0 001.98-1.6l1-5A1 1 0 0015.82 5H6.2l-.2-1A2 2 0 004.05 2H3z"/><path d="M7 16a2 2 0 11-4 0 2 2 0 014 0zm10 2a2 2 0 10-4 0 2 2 0 004 0z"/></svg>
              Cart ({cartCount}) - {`${cartTotal.toFixed(2)} ريال سعودي`}
            </button>
          )}
        </div>
        {userIsAdmin && lastExternalSync && (
          <p className="text-xs text-gray-500 mt-1 text-right">
            Last external sync: {new Date(lastExternalSync.exportedAt).toLocaleString()} • {lastExternalSync.total} products
          </p>
        )}
      </div>

      {/* Client demand history moved to ClientDemandsPage */}

      {/* Search */}
      <div className="mb-6">
        <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search</label>
        <div className="mt-1 relative">
          <span className="absolute left-3 top-2.5 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.817-4.817A6 6 0 012 8z" clipRule="evenodd"/></svg>
          </span>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, item number, or description..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Products Display */}
      <div className="bg-white border border-gray-200 shadow-xl overflow-hidden rounded-2xl">
        <div className="px-6 py-6">
          <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                Product Catalog
              </h3>
              <p className="text-sm text-gray-600 font-medium mt-1">
                {filteredProducts.length} products available • Search and browse our complete inventory
              </p>
            </div>
          </div>
          {loading ? (
            <div>
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded-lg w-48"></div>
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 h-12 border-b border-gray-200"></div>
                  <div className="divide-y divide-gray-100">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="p-6">
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="h-14 w-14 rounded-xl bg-gray-200"></div>
                          <div className="flex-1">
                            <div className="h-5 bg-gray-200 rounded-lg w-48 mb-2"></div>
                            <div className="h-4 bg-gray-100 rounded w-32"></div>
                          </div>
                          <div className="text-right">
                            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                            <div className="h-8 bg-gray-200 rounded-lg w-32"></div>
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                          <div className="h-6 bg-gray-200 rounded w-20"></div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                          <div className="h-8 bg-gray-200 rounded w-24"></div>
                          <div className="flex space-x-2">
                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => {
                const stats = getProductPurchaseStatsSync(product.id);
                return (
                  <div key={product.id} className="border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50/50 hover:from-white hover:to-blue-50/30 h-full flex flex-col group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="relative h-14 w-14">
                          {productImageMap[product.id] ? (
                            <>
                              <img
                                src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                                alt={product.name}
                                className="h-14 w-14 rounded-xl object-cover border-2 border-gray-200 cursor-pointer hover:border-blue-300 transition-all duration-200"
                                title="Click to view photo"
                                onClick={() => openImagePreview(product)}
                                onError={(e) => {
                                  console.error('Failed to load image for product', product.id, productImageMap[product.id]);
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                }}
                                onLoad={() => console.log('Image loaded successfully for product', product.id)}
                              />
                              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 flex items-center justify-center hidden">
                                <span className="text-2xl">📦</span>
                              </div>
                            </>
                          ) : (
                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 flex items-center justify-center">
                              <span className="text-3xl">📦</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start space-x-3">
                            <div className="flex-1">
                              <h4 className="text-xl font-bold text-gray-900 mb-1 leading-tight">{product.name}</h4>
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="flex items-center space-x-2">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  <span className="text-sm font-semibold text-blue-900 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                    {product.itemNumber}
                                  </span>
                                </div>
                                {userIsAdmin && (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${((product as any).visibleToClients === false ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200')}`}
                                    title={((product as any).visibleToClients === false ? 'Hidden from clients' : 'Visible to clients')}
                                  >
                                    {((product as any).visibleToClients === false ? 'Hidden' : 'Visible')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2" >
                        <div className="text-sm font-bold text-gray-700 mb-2"> Selling Price</div>
                        {(() => {
                          const priceInfo = formatPriceForUser((product as any).sellingPrice);
                          return (
                            <div className={`text-2xl font-bold ${priceInfo.color} ${priceInfo.bgColor} px-4 py-2 rounded-xl border-2 ${priceInfo.borderColor} shadow-sm`}>
                              {priceInfo.display}
                            </div>
                          );
                        })()}
                        {formatPriceForUser((product as any).sellingPrice).display === 'Not Set' && userIsAdmin && (
                          <div className="mt-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center shadow-sm hover:shadow-md"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Set Price
                            </button>
                          </div>
                        )}
                        {formatPriceForUser((product as any).sellingPrice).display !== 'Not Set' && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            ✓ Price configured
                          </div>
                        )}
                        {formatPriceForUser((product as any).sellingPrice).display === 'Not Set' && userIsVendor && (
                          <div className="text-xs text-amber-600 font-medium mt-1">
                            ⏳ Awaiting pricing
                          </div>
                        )}
                      </div>
                        </div>
                        
                      </div>
                      
                    </div>

                    <p className="text-sm text-gray-500 mb-4 line-clamp-2 break-words">{product.description}</p>

                    <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-700">Available Stock</div>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5l8 4" />
                        </svg>
                      </div>
                      {(() => {
                        const stock = typeof (product as any).stock === 'number' ? (product as any).stock : 0;
                        const reorder = typeof (product as any).reorderLevel === 'number' ? (product as any).reorderLevel : 0;
                        const levelClass = stock <= 0 ? 'bg-red-100 text-red-800 border-red-200' : (stock <= reorder ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200');
                        const levelText = stock <= 0 ? 'Out of stock' : (stock <= reorder ? 'Low stock' : 'In stock');
                        return (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="text-2xl font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-200">
                                {stock}
                              </div>
                              <span className="text-sm font-medium text-gray-600">units</span>
                            </div>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${levelClass}`}>
                              {levelText}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-auto pt-4 border-t border-gray-100">
                      {!userIsClient && (
                        <button
                          onClick={() => handleViewHistory(product)}
                          className="text-green-700 hover:text-green-900 text-sm font-semibold w-full sm:w-auto text-left sm:text-center transition-all duration-200 hover:bg-green-50 px-3 py-2 rounded-lg"
                          title="View Purchase History"
                        >
                          <span className="inline-flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5a1 1 0 112 0v4a1 1 0 01-.293.707l-2 2a1 1 0 11-1.414-1.414L9 8.586V5z" />
                            </svg>
                            View History
                          </span>
                        </button>
                      )}
                      {currentUser && !userIsClient ? (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => toggleVisibility(product)}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold ring-1 transition-all duration-200 ${((product as any).visibleToClients === false ? 'bg-gray-50 text-gray-700 ring-gray-200 hover:bg-gray-100 hover:ring-gray-300' : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100 hover:ring-amber-300')}`}
                            title={((product as any).visibleToClients === false ? 'Show to Clients' : 'Hide from Clients')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              {((product as any).visibleToClients === false) ? (
                                <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12a5 5 0 110-10 5 5 0 010 10z" />
                              ) : (
                                <path d="M4.03 3.97a.75.75 0 10-1.06 1.06l1.46 1.46C2.3 7.6 1.27 9.14 1 10c.73 2.89 4 7 9 7 1.67 0 3.16-.44 4.45-1.13l1.52 1.52a.75.75 0 101.06-1.06l-14-14zM10 5c.8 0 1.54.2 2.2.55l-1.2 1.2A2.5 2.5 0 007.75 10c0 .3.05.58.15.84l-1.2 1.2A4 4 0 0110 5z" />
                              )}
                            </svg>
                            {((product as any).visibleToClients === false ? 'Show' : 'Hide')}
                          </button>
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-blue-700 hover:text-blue-900 ring-1 ring-blue-200 hover:bg-blue-50 hover:ring-blue-300 transition-all duration-200"
                            title="Edit Product"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.464.263l-3 0.75a1 1 0 01-1.213-1.213l.75-3a1 1 0 01.263-.464l8.95-8.95z" />
                              <path d="M5 13l2 2" />
                            </svg>
                            Edit
                          </button>
                          {userIsAdmin && (
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-red-700 hover:text-red-900 ring-1 ring-red-200 hover:bg-red-50 hover:ring-red-300 transition-all duration-200"
                              title="Delete Product"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h12a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM5 8a1 1 0 011-1h8a1 1 0 011 1v7a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" clipRule="evenodd" />
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => addToCart(product)}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center text-sm font-semibold w-full sm:w-auto justify-center transform hover:-translate-y-0.5"
                            title="Add to Cart"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M3 3a1 1 0 000 2h1l1.2 6A2 2 0 007.18 13h6.64a2 2 0 001.98-1.6l1-5A1 1 0 0015.82 5H6.2l-.2-1A2 2 0 004.05 2H3z"/>
                              <path d="M7 16a2 2 0 11-4 0 2 2 0 014 0zm10 2a2 2 0 10-4 0 2 2 0 004 0z"/>
                            </svg>
                            Add to Cart
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5l8 4" />
                </svg>
              </div>
              <div className="text-xl font-bold text-gray-900 mb-2">No products found</div>
              <div className="text-sm text-gray-600 mb-4">Try adjusting your search terms or check if products are available.</div>
              <div className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-50 text-gray-700 border border-gray-200">
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-sm font-medium">Use the search bar above to find products</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {currentUser && !userIsClient && showModal && (
        <ProductModal
          product={editingProduct}
          onSave={editingProduct ? handleUpdateProduct : handleCreateProduct}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          userRole={userIsAdmin ? 'admin' : 'vendor'}
        />
      )}

      {/* Import Excel Modal */}
      {userIsAdmin && showImportModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Import Products</h3>
                  <p className="text-sm text-gray-600">Upload Excel/CSV file</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Upload a <strong>.xlsx/.xls/.csv</strong> file. Required columns: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">OEM, Quantity</span>.
                We create/update products by OEM as itemNumber and set stock to Quantity.
              </p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 inline-flex items-center"
                  onClick={() => {
                    try {
                      const aoa: any[][] = [];
                      aoa.push(['OEM', 'Quantity']);
                      aoa.push(['123-ABC', 10]);
                      const ws = XLSX.utils.aoa_to_sheet(aoa);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Template');
                      XLSX.writeFile(wb, 'product_import_template.xlsx');
                    } catch (e) {
                      console.error('Failed to generate template', e);
                      alert('Failed to generate template');
                    }
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Template
                </button>
                <span className="text-xs text-gray-500">Tip: Fill OEM (item number) and Quantity.</span>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImporting(true);
                  const res = await importProductsFromExcel(file);
                  setImporting(false);
                  if (res?.success) {
                    alert('Import finished');
                    setShowImportModal(false);
                    await fetchData();
                  } else {
                    alert(res?.message || 'Import failed');
                  }
                  e.currentTarget.value = '';
                }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {importing && <div className="text-sm text-gray-700">Uploading and processing…</div>}
              <div className="text-xs text-gray-500">Tip: For very large files, keep this tab open until completion.</div>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 rounded border">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Import Modal */}
      {userIsAdmin && showInvoiceModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Import Invoice (Excel/CSV)</h3>
              <button onClick={() => { setShowInvoiceModal(false); setInvoicePreview([]); }} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Upload an invoice file. Expected columns: <span className="font-mono">OEM/Item Number, Quantity, Paid/Status</span>. Only rows marked Paid will reduce stock when you click Apply.</p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
                  onClick={() => {
                    try {
                      const aoa: any[][] = [];
                      aoa.push(['OEM/Item Number', 'Quantity', 'Paid']);
                      aoa.push(['123-ABC', 2, 'Paid']);
                      const ws = XLSX.utils.aoa_to_sheet(aoa);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Template');
                      XLSX.writeFile(wb, 'invoice_import_template.xlsx');
                    } catch (e) {
                      console.error('Failed to generate invoice template', e);
                      alert('Failed to generate template');
                    }
                  }}
                >Download Template</button>
                <span className="text-xs text-gray-500">Mark Paid rows as Paid/Yes/True/تم/مدفوع.</span>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setInvoiceApplying(true);
                  setInvoiceFile(file);
                  const res = await importInvoiceFromExcel(file, false);
                  setInvoiceApplying(false);
                  if (res?.success) {
                    setInvoicePreview(res.data?.preview || []);
                  } else {
                    alert(res?.message || 'Failed to parse invoice');
                  }
                  e.currentTarget.value = '';
                }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {invoiceApplying && <div className="text-sm text-gray-700">Processing…</div>}
              {invoicePreview.length > 0 && (
                <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 sticky top-0">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-800 bg-gradient-to-br from-blue-50 to-blue-100/50 border-r-2 border-blue-200">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span>Item Number</span>
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Qty</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Paid</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Matched</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Current</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">New</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePreview.map((r, idx) => (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 py-2 font-mono font-bold text-blue-900 bg-gradient-to-r from-blue-50/50 to-transparent">
                            {r.itemNumber}
                          </td>
                          <td className="px-4 py-2 font-medium">{r.name || '-'}</td>
                          <td className="px-4 py-2 text-right font-semibold">{r.quantity}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${r.paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {r.paid ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${r.matched ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {r.matched ? '✓' : '✗'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-medium">{typeof r.currentStock === 'number' ? r.currentStock : '-'}</td>
                          <td className="px-4 py-2 text-right font-medium">{typeof r.newStock === 'number' ? r.newStock : '-'}</td>
                          <td className="px-4 py-2 font-medium">{r.reason || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-xs text-gray-500">We match by OEM/Item Number to product `itemNumber`.</div>
            </div>
            <div className="mt-4 text-right">
              <button
                onClick={() => { setShowInvoiceModal(false); setInvoicePreview([]); setInvoiceFile(null); }}
                className="px-6 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-semibold text-gray-700 mr-3 shadow-sm hover:shadow-md"
              >
                Close
              </button>
              <button
                disabled={invoicePreview.length === 0 || !invoiceFile}
                onClick={async () => {
                  if (!invoiceFile) return;
                  try {
                    setInvoiceApplying(true);
                    const res = await importInvoiceFromExcel(invoiceFile, true);
                    setInvoiceApplying(false);
                    if (res?.success) {
                      alert(`Applied. Updated rows: ${res.data?.appliedCount || 0}`);
                      setShowInvoiceModal(false);
                      setInvoicePreview([]);
                      setInvoiceFile(null);
                      await fetchData();
                    } else {
                      alert(res?.message || 'Failed to apply invoice');
                    }
                  } catch {}
                }}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Apply Paid Rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal for client */}
      {userIsClient && cartOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Your Cart</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>
            {cartItems.length === 0 ? (
              <div className="text-gray-500">Cart is empty.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {cartItems.map(ci => (
                  <div key={ci.id} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <div className="font-medium text-gray-900">{ci.name}</div>
                      <div className="text-xs text-gray-500">Item #{ci.itemNumber}</div>
                      <div className="text-sm text-gray-700">{formatPriceForUser(ci.price).display}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={1}
                        value={ci.quantity}
                        onChange={(e) => changeQty(ci.id, parseInt(e.target.value || '1', 10))}
                        className="w-16 border rounded px-2 py-1"
                      />
                      <button onClick={() => removeFromCart(ci.id)} className="text-red-600 hover:text-red-800" title="Remove">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h12a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM5 8a1 1 0 011-1h8a1 1 0 011 1v7a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" clipRule="evenodd"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">Total items: {cartCount}</div>
              <div className="text-lg font-semibold text-gray-900">Total: {formatPriceForUser(cartTotal).display}</div>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setCartOpen(false)} className="px-4 py-2 rounded border hover:bg-gray-50 mr-2">Close</button>
              <button onClick={submitDemandFromCart} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={cartItems.length === 0}>Send Demand</button>
            </div>
          </div>
        </div>
      )}

      {/* Product History Modal */}
      {selectedProductHistory && (
        <ProductHistoryModal
          productId={(selectedProductHistory.product as any).id}
          productName={selectedProductHistory.product.name}
          purchases={selectedProductHistory.purchases}
          onClose={() => setSelectedProductHistory(null)}
        />
      )}

      {/* Image Preview Modal */}
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={() => setImagePreviewUrl(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-medium text-gray-900 truncate pr-4">{imagePreviewTitle}</div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setImagePreviewUrl(null)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="bg-black flex items-center justify-center">
              <img src={imagePreviewUrl} alt={imagePreviewTitle} className="max-h-[80vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Product Modal Component
export interface ProductModalProps {
  product: Product | null;
  onSave: (product: any) => void;
  onClose: () => void;
  userRole?: 'admin' | 'vendor';
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onClose, userRole = 'admin' }) => {
  const [formData, setFormData] = useState({
    itemNumber: product?.itemNumber || '',
    name: product?.name || '',
    description: product?.description || '',
    ...(userRole === 'admin' && {
      sellingPrice: (product as any)?.sellingPrice as number | undefined ?? undefined,
      stock: (product as any)?.stock as number | undefined ?? undefined,
      reorderLevel: (product as any)?.reorderLevel as number | undefined ?? 0,
      visibleToClients: (product as any)?.visibleToClients as boolean | undefined ?? true,
    }),
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const productData: any = {
        itemNumber: formData.itemNumber,
        name: formData.name,
      };

      if (formData.description && formData.description.trim()) {
        productData.description = formData.description;
      }

      if (userRole === 'admin') {
        if (typeof formData.sellingPrice === 'number' && !Number.isNaN(formData.sellingPrice)) {
          productData.sellingPrice = formData.sellingPrice;
        }
        if (typeof formData.stock === 'number' && !Number.isNaN(formData.stock)) {
          productData.stock = formData.stock;
        }
        if (typeof formData.reorderLevel === 'number' && !Number.isNaN(formData.reorderLevel)) {
          productData.reorderLevel = formData.reorderLevel;
        }
        productData.visibleToClients = !!formData.visibleToClients;
      }

      if (product) {
        productData.id = product.id;
      }

      // Include image file in the payload
      if (selectedFile) {
        productData.imageFile = selectedFile;
        console.log('ProductModal: Including image file in payload:', selectedFile.name, selectedFile.size);
      } else {
        console.log('ProductModal: No image file selected');
      }

      console.log('ProductModal: Sending product data:', productData);
      
      // Save the product (with image file included)
      onSave(productData);
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : (type === 'checkbox' ? checked : value)
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('ProductModal: File selected:', file);
    if (file) {
      console.log('ProductModal: Setting selected file:', file.name, file.size);
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      console.log('ProductModal: No file selected');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {product ? '✏️ Edit Product' : '➕ Add New Product'}
              </h2>
              <p className="text-gray-600 mt-1">
                {product ? 'Update product details' : 'Create a new product'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Number <span className="text-red-500">*</span>
              </label>
              <input
                name="itemNumber"
                required
                placeholder="e.g., PROD-001"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.itemNumber}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                required
                placeholder="e.g., Premium Widget"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Describe your product..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Product Image Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Product Image</h3>
            
            <div className="flex items-center space-x-6">
              {/* Image Preview */}
              <div className="flex-shrink-0">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Product preview"
                      className="h-24 w-24 rounded-lg object-cover border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewUrl(null);
                        setSelectedFile(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : product && (product as any)?.images?.[0] ? (
                  <img
                    src={`${getApiOrigin().replace(/\/api\/?$/, '')}${(product as any).images[0]}`}
                    alt={product.name}
                    className="h-24 w-24 rounded-lg object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                    <span className="text-2xl text-gray-400">📷</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Product Image
                </label>
                <div className="flex items-center space-x-4">
                  <label className="cursor-pointer">
                    <div className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>{uploading ? 'Uploading...' : 'Choose Image'}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {previewUrl && (
                    <span className="text-sm text-green-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Image selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Recommended: JPG, PNG, or WebP. Max size: 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Admin Settings */}
          {userRole === 'admin' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Admin Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selling Price (¥)
                  </label>
                  <input
                    name="sellingPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={typeof formData.sellingPrice === 'number' ? String(formData.sellingPrice) : ''}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Quantity
                  </label>
                  <input
                    name="stock"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={typeof formData.stock === 'number' ? String(formData.stock) : ''}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reorder Level
                </label>
                <input
                  name="reorderLevel"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={typeof formData.reorderLevel === 'number' ? String(formData.reorderLevel) : ''}
                  onChange={handleChange}
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  id="visibleToClients"
                  name="visibleToClients"
                  type="checkbox"
                  checked={!!formData.visibleToClients}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="visibleToClients" className="text-sm font-medium text-gray-700">
                  Visible to Clients
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!formData.itemNumber || !formData.name}
            >
              {product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { ProductModal };
export default ProductsPage;
