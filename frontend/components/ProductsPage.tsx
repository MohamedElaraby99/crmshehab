import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Product, ProductPurchase, User } from '../types';
import { createProduct, deleteProduct, getAllOrders, getAllProducts, getVisibleProducts, getApiOrigin, getProductPurchases, getCurrentUser, updateProduct, uploadProductImage, getSocket, getMyDemands, importProductsFromExcel, importInvoiceFromExcel } from '../services/api';
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
  const [productImageMap, setProductImageMap] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{ id: string; name: string; itemNumber: string; price: number; quantity: number }>>([]);
  const [myDemands, setMyDemands] = useState<any[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePreviewTitle, setImagePreviewTitle] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<Array<{ itemNumber: string; quantity: number; paid: boolean; matched: boolean; name?: string; currentStock?: number; newStock?: number; reason?: string }>>([]);
  const [invoiceApplying, setInvoiceApplying] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const userIsAdmin = useMemo(() => (currentUser?.role === 'admin'), [currentUser]);
  const userIsClient = useMemo(() => (forceClient ? true : currentUser?.role === 'client'), [currentUser, forceClient]);
  const userIsVendor = useMemo(() => (currentUser?.role === 'vendor'), [currentUser]);


  // Consistent price formatting based on role
  const formatPriceForUser = (value: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '-';
    return userIsClient ? `${value.toFixed(2)} RS ريال سعودي` : `¥ ${value.toFixed(2)}`;
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
      <div className="bg-white/90 backdrop-blur-sm shadow-lg ring-1 ring-black/5 overflow-hidden sm:rounded-xl">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Products ({filteredProducts.length})
          </h3>
          {loading ? (
            <div>
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 h-10"></div>
                  <div className="divide-y">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="grid grid-cols-6 gap-4 p-4">
                        <div className="col-span-2 flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-200"></div>
                          <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded w-32 mb-2"></div>
                            <div className="h-3 bg-gray-100 rounded w-48"></div>
                          </div>
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-100 rounded w-16"></div>
                        <div className="h-8 bg-gray-200 rounded w-24 justify-self-end"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((product) => {
                const stats = getProductPurchaseStatsSync(product.id);
                return (
                  <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow bg-white/90 backdrop-blur-sm h-full flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12">
                          {productImageMap[product.id] ? (
                            <>
                              <img
                                src={`${getApiOrigin().replace(/\/api\/?$/, '')}${productImageMap[product.id]}`}
                                alt={product.name}
                                className="h-12 w-12 rounded-lg object-cover border cursor-pointer"
                                title="Click to view photo"
                                onClick={() => openImagePreview(product)}
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
                          <div className="flex items-center space-x-2">
                            <h4 className="text-lg font-semibold text-gray-900">{product.name}</h4>
                            {userIsAdmin && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${((product as any).visibleToClients === false ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200')}`}
                                title={((product as any).visibleToClients === false ? 'Hidden from clients' : 'Visible to clients')}
                              >
                                {((product as any).visibleToClients === false ? 'Hidden' : 'Visible')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 font-mono">{product.itemNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                      <div className="text-sm text-gray-500">Selling Price</div>
                        <div className="text-base font-semibold text-gray-900">{formatPriceForUser((product as any).sellingPrice)}</div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-4 line-clamp-2 break-words">{product.description}</p>

                    <div className="mb-3">
                      <div className="text-sm text-gray-600">Available Stock</div>
                      {(() => {
                        const stock = typeof (product as any).stock === 'number' ? (product as any).stock : 0;
                        const reorder = typeof (product as any).reorderLevel === 'number' ? (product as any).reorderLevel : 0;
                        const levelClass = stock <= 0 ? 'bg-red-50 text-red-700 ring-red-200' : (stock <= reorder ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200');
                        const levelText = stock <= 0 ? 'Out of stock' : (stock <= reorder ? 'Low stock' : 'In stock');
                        return (
                          <div className="flex items-center space-x-2">
                            <div className="text-lg font-semibold text-gray-900">{stock}<span className="text-sm text-gray-500 ml-1">units</span></div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ${levelClass}`}>{levelText}</span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-auto pt-2">
                      {!userIsClient && (
                        <button
                          onClick={() => handleViewHistory(product)}
                          className="text-green-700 hover:text-green-900 text-sm font-medium w-full sm:w-auto text-left sm:text-inherit"
                          title="View Purchase History"
                        >
                          <span className="inline-flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5a1 1 0 112 0v4a1 1 0 01-.293.707l-2 2a1 1 0 11-1.414-1.414L9 8.586V5z" />
                            </svg>
                            History
                          </span>
                        </button>
                      )}
                      {currentUser && !userIsClient ? (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => toggleVisibility(product)}
                            className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ring-1 transition ${((product as any).visibleToClients === false ? 'bg-gray-50 text-gray-700 ring-gray-200 hover:bg-gray-100' : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100')}`}
                            title={((product as any).visibleToClients === false ? 'Show to Clients' : 'Hide from Clients')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
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
                            className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-700 hover:text-blue-900 ring-1 ring-blue-200 hover:bg-blue-50"
                            title="Edit Product"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.464.263l-3 0.75a1 1 0 01-1.213-1.213l.75-3a1 1 0 01.263-.464l8.95-8.95z" />
                              <path d="M5 13l2 2" />
                            </svg>
                            Edit
                          </button>
                          {userIsAdmin && (
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-red-700 hover:text-red-900 ring-1 ring-red-200 hover:bg-red-50"
                              title="Delete Product"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
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
                            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow inline-flex items-center text-sm font-medium w-full sm:w-auto justify-center"
                            title="Add to Cart"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1l1.2 6A2 2 0 007.18 13h6.64a2 2 0 001.98-1.6l1-5A1 1 0 0015.82 5H6.2l-.2-1A2 2 0 004.05 2H3z"/><path d="M7 16a2 2 0 11-4 0 2 2 0 014 0zm10 2a2 2 0 10-4 0 2 2 0 004 0z"/></svg>
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
            <div className="text-center py-12 text-gray-500">
              <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">🗂️</div>
              <div className="font-medium text-gray-700">No products found</div>
              <div className="text-sm">Try adjusting your search terms.</div>
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
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Import Products from Excel/CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Upload a .xlsx/.xls/.csv file. Columns supported: <span className="font-mono">OEM, Quantity</span>. We create/update by OEM as itemNumber and set stock to Quantity.</p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
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
                >Download Template</button>
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
                className="w-full border rounded px-3 py-2"
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
                className="w-full border rounded px-3 py-2"
              />
              {invoiceApplying && <div className="text-sm text-gray-700">Processing…</div>}
              {invoicePreview.length > 0 && (
                <div className="max-h-72 overflow-y-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-center">Paid</th>
                        <th className="px-3 py-2 text-center">Matched</th>
                        <th className="px-3 py-2 text-right">Current</th>
                        <th className="px-3 py-2 text-right">New</th>
                        <th className="px-3 py-2 text-left">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePreview.map((r, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-1 font-mono">{r.itemNumber}</td>
                          <td className="px-3 py-1">{r.name || '-'}</td>
                          <td className="px-3 py-1 text-right">{r.quantity}</td>
                          <td className="px-3 py-1 text-center">{r.paid ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-1 text-center">{r.matched ? '✓' : '✗'}</td>
                          <td className="px-3 py-1 text-right">{typeof r.currentStock === 'number' ? r.currentStock : '-'}</td>
                          <td className="px-3 py-1 text-right">{typeof r.newStock === 'number' ? r.newStock : '-'}</td>
                          <td className="px-3 py-1">{r.reason || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-xs text-gray-500">We match by OEM/Item Number to product `itemNumber`.</div>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => { setShowInvoiceModal(false); setInvoicePreview([]); setInvoiceFile(null); }} className="px-4 py-2 rounded border hover:bg-gray-50 mr-2">Close</button>
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
                className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <div className="text-sm text-gray-700">{formatPriceForUser(ci.price)}</div>
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
              <div className="text-lg font-semibold text-gray-900">Total: {formatPriceForUser(cartTotal)}</div>
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

    // Admin-only fields
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
            {userRole === 'admin' && (
              <>
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
              </>
            )}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!formData.itemNumber || !formData.name}
                title={!formData.itemNumber || !formData.name ? 'Item Number and Name are required' : 'Save product'}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export { ProductModal };
export default ProductsPage;
