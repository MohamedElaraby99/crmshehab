import React, { useEffect, useMemo, useState } from 'react';
import { Product, ProductPurchase, User } from '../types';
import { createProduct, deleteProduct, getAllOrders, getAllProducts, getVisibleProducts, getApiOrigin, getProductPurchases, getCurrentUser, updateProduct, uploadProductImage, getSocket, getMyDemands } from '../services/api';
import { createDemand } from '../services/api';
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
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [productImageMap, setProductImageMap] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{ id: string; name: string; itemNumber: string; price: number; quantity: number }>>([]);
  const [myDemands, setMyDemands] = useState<any[]>([]);

  const userIsAdmin = useMemo(() => (currentUser?.role === 'admin'), [currentUser]);
  const userIsClient = useMemo(() => (forceClient ? true : currentUser?.role === 'client'), [currentUser, forceClient]);

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
    socket.on('demands:created', onAnyChange);
    return () => {
      socket.off('orders:created', onAnyChange);
      socket.off('orders:updated', onAnyChange);
      socket.off('orders:deleted', onAnyChange);
      socket.off('products:created', onAnyChange);
      socket.off('products:updated', onAnyChange);
      socket.off('products:deleted', onAnyChange);
      socket.off('demands:created', onAnyChange);
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

  const raiseDemand = async (p: Product) => {
    try {
      const ok = await createDemand(p.id, 1);
      if (ok) {
        alert('Demand sent. We will contact you.');
      } else {
        alert('Failed to send demand.');
      }
    } catch {
      alert('Failed to send demand.');
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
      setCartOpen(false);
      return;
    }
    try {
      await Promise.all(cartItems.map(ci => createDemand(ci.id, ci.quantity)));
      alert('Demand sent for your cart items. We will contact you.');
      persistCart([]);
      setCartOpen(false);
    } catch (e) {
      alert('Failed to send demand. Please try again.');
    }
  };

  const cartCount = cartItems.reduce((s, ci) => s + ci.quantity, 0);
  const cartTotal = cartItems.reduce((s, ci) => s + ci.quantity * ci.price, 0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allProducts, allOrders, mine] = await Promise.all([
        userIsClient ? getVisibleProducts() : getAllProducts(),
        getAllOrders(),
        userIsClient ? getMyDemands() : Promise.resolve([])
      ]);
      setProducts(allProducts);
      setMyDemands(mine || []);

      const imgMap: Record<string, string> = {};
      (allProducts || []).forEach((p: any) => {
        if (Array.isArray(p.images) && p.images.length > 0) {
          imgMap[p.id] = p.images[0];
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
          }
        });
      });
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

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Products</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200"
          >
            {viewMode === 'table' ? 'Grid View' : 'Table View'}
          </button>
          {userIsAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Add Product
            </button>
          )}
          {userIsClient && (
            <button
              onClick={() => setCartOpen(true)}
              className="px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center"
              title="View Cart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1l1.2 6A2 2 0 007.18 13h6.64a2 2 0 001.98-1.6l1-5A1 1 0 0015.82 5H6.2l-.2-1A2 2 0 004.05 2H3z"/><path d="M7 16a2 2 0 11-4 0 2 2 0 014 0zm10 2a2 2 0 10-4 0 2 2 0 004 0z"/></svg>
              Cart ({cartCount}) - ${cartTotal.toFixed(2)}
            </button>
          )}
        </div>
      </div>

      {/* Client demand history moved to ClientDemandsPage */}

      {/* Search */}
      <div className="mb-6">
        <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search</label>
        <div className="mt-1">
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, item number, or description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Products Display */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Products ({filteredProducts.length})
          </h3>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Selling Price
                    </th>
                    {!userIsClient && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        History
                      </th>
                    )}
                    {userIsAdmin && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reorder Level
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Visible
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </>
                    )}
                    {userIsClient && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Add</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    const stats = getProductPurchaseStatsSync(product.id);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {productImageMap[product.id] ? (
                                <img
                                  src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                                  alt={product.name}
                                  className="h-10 w-10 rounded object-cover border"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-lg">📦</span>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500 max-w-xs truncate">{product.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">{product.itemNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{typeof (product as any).sellingPrice === 'number' ? `$${(product as any).sellingPrice.toFixed(2)}` : '-'}</div>
                        </td>
                        {!userIsClient && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleViewHistory(product)}
                              className="text-green-600 hover:text-green-900"
                              title="View Purchase History"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5a1 1 0 112 0v4a1 1 0 01-.293.707l-2 2a1 1 0 11-1.414-1.414L9 8.586V5z" />
                              </svg>
                            </button>
                          </td>
                        )}
                        {userIsAdmin && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{typeof (product as any).stock === 'number' ? (product as any).stock : 0}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${((product as any).stock ?? 0) <= ((product as any).reorderLevel ?? 0) ? 'text-red-700' : 'text-gray-900'}`}
                                   title="Reorder Level">
                                {typeof (product as any).reorderLevel === 'number' ? (product as any).reorderLevel : 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => toggleVisibility(product)}
                                className={`px-3 py-1 rounded text-xs font-semibold border ${((product as any).visibleToClients === false ? false : true) ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-green-100 text-green-800 border-green-300'}`}
                                title={((product as any).visibleToClients === false ? false : true) ? 'Make Hidden' : 'Make Visible'}
                              >
                                {((product as any).visibleToClients === false ? false : true) ? 'Make Hidden' : 'Make Visible'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {productImageMap[product.id] ? (
                                  <img
                                    src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                                    alt={product.name}
                                    className="h-10 w-10 rounded object-cover border"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-500">No image</div>
                                )}
                                <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const imgs = await uploadProductImage((product as any).id, file);
                                      if (imgs && imgs.length > 0) {
                                        await fetchData();
                                      } else {
                                        alert('Failed to upload image');
                                      }
                                      e.currentTarget.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Edit Product"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.464.263l-3 0.75a1 1 0 01-1.213-1.213l.75-3a1 1 0 01.263-.464l8.95-8.95z" />
                                    <path d="M5 13l2 2" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete Product"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h12a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM5 8a1 1 0 011-1h8a1 1 0 011 1v7a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                        {userIsClient && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 font-semibold">
                                {typeof (product as any).stock === 'number' ? (product as any).stock : 0}
                                <span className="text-xs text-gray-500 ml-1">units</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => addToCart(product)}
                                  className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                  title="Add to Cart"
                                >
                                  Add to Cart
                                </button>
                                <button
                                  onClick={() => raiseDemand(product)}
                                  className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                  title="Send Demand"
                                >
                                  Demand
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => {
                const stats = getProductPurchaseStatsSync(product.id);
                return (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12">
                          {productImageMap[product.id] ? (
                            <img
                              src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                              alt={product.name}
                              className="h-12 w-12 rounded object-cover border"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-2xl">📦</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{product.name}</h4>
                          <p className="text-sm text-gray-500 font-mono">{product.itemNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Selling Price</div>
                        <div className="text-base font-semibold text-gray-900">{typeof (product as any).sellingPrice === 'number' ? `$${(product as any).sellingPrice.toFixed(2)}` : '-'}</div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>

                    <div className="mb-3">
                      <div className="text-sm text-gray-600">Available Stock</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {typeof (product as any).stock === 'number' ? (product as any).stock : 0}
                        <span className="text-sm text-gray-500 ml-1">units</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleViewHistory(product)}
                        className="text-green-600 hover:text-green-900 text-sm font-medium"
                        title="View Purchase History"
                      >
                        <span className="inline-flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5a1 1 0 112 0v4a1 1 0 01-.293.707l-2 2a1 1 0 11-1.414-1.414L9 8.586V5z" />
                          </svg>
                          History
                        </span>
                      </button>
                      {userIsAdmin ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            title="Edit Product"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.464.263l-3 0.75a1 1 0 01-1.213-1.213l.75-3a1 1 0 01.263-.464l8.95-8.95z" />
                              <path d="M5 13l2 2" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                            title="Delete Product"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h12a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM5 8a1 1 0 011-1h8a1 1 0 011 1v7a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => addToCart(product)}
                            className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            title="Add to Cart"
                          >
                            Add to Cart
                          </button>
                          <button
                            onClick={() => raiseDemand(product)}
                            className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                            title="Send Demand"
                          >
                            Demand
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
            <div className="text-center py-8 text-gray-500">
              No products found matching your criteria.
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {userIsAdmin && showModal && (
        <ProductModal
          product={editingProduct}
          onSave={editingProduct ? handleUpdateProduct : handleCreateProduct}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
        />
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
                      <div className="text-sm text-gray-700">${ci.price.toFixed(2)}</div>
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
              <div className="text-lg font-semibold text-gray-900">Total: ${cartTotal.toFixed(2)}</div>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setCartOpen(false)} className="px-4 py-2 rounded border mr-2">Close</button>
              <button onClick={submitDemandFromCart} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Send Demand</button>
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
    reorderLevel: (product as any)?.reorderLevel as number | undefined ?? 0,
    visibleToClients: (product as any)?.visibleToClients as boolean | undefined ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productData: any = {
      itemNumber: formData.itemNumber,
      name: formData.name,
    };
    
    // Only include description if it's not empty
    if (formData.description && formData.description.trim()) {
      productData.description = formData.description;
    }
    
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
    if (product) {
      productData.id = product.id;
    }
    onSave(productData);
  };

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
                        setSelectedFile(file);
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                name="name"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={formData.description}
                onChange={handleChange}
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
      <div>
        <label className="block text-sm font-medium text-gray-700">Reorder Level</label>
        <input
          name="reorderLevel"
          type="number"
          step="1"
          min="0"
          className="mt-1 block w-full border rounded px-3 py-2"
          value={typeof formData.reorderLevel === 'number' ? String(formData.reorderLevel) : ''}
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
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
