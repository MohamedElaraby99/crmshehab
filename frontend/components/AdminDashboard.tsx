import React, { useState, useEffect } from 'react';
import { User, Order, Vendor, Product, ProductPurchase } from '../types';
import { getAllOrders, updateOrder as apiUpdateOrder, getAllVendors, getAllProducts, getProductPurchases, getSocket } from '../services/api';
import OrderTable from './OrderTable';
import ProductHistoryModal from './ProductHistoryModal';
import DynamicOrderForm from './DynamicOrderForm';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showProductHistory, setShowProductHistory] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productPurchases, setProductPurchases] = useState<ProductPurchase[]>([]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [ordersData, vendorsData, productsData] = await Promise.all([
        getAllOrders(),
        getAllVendors(),
        getAllProducts()
      ]);
      // Ensure each order has an 'id' field
      const ordersWithId = (ordersData || []).map((o: any) => ({ ...o, id: o.id || o._id }));
      setOrders(ordersWithId);
      setVendors(vendorsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
      setVendors([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Realtime updates (Socket.IO)
  useEffect(() => {
    const socket = getSocket();
    const handleCreated = (order: Order) => {
      setOrders(prev => {
        const exists = prev.some(o => o.id === (order as any).id || (o as any)._id === (order as any)._id);
        if (exists) return prev.map(o => (o.id === (order as any).id ? order : o));
        return [order, ...prev];
      });
    };
    const handleUpdated = (order: any) => {
      const hasFullData = Array.isArray(order?.items);
      if (!hasFullData) {
        fetchOrders();
        return;
      }
      const incomingId = order?.id || order?._id;
      const normalized = { ...order, id: incomingId } as Order;
      setOrders(prev => prev.map(o => (o.id === incomingId ? normalized : o)));
    };
    const handleDeleted = (payload: { id: string }) => {
      setOrders(prev => prev.filter(o => o.id !== payload.id));
    };

    socket.on('orders:created', handleCreated);
    socket.on('orders:updated', handleUpdated);
    socket.on('orders:deleted', handleDeleted);

    return () => {
      socket.off('orders:created', handleCreated);
      socket.off('orders:updated', handleUpdated);
      socket.off('orders:deleted', handleDeleted);
    };
  }, []);

  const handleUpdateOrder = async (updatedOrder: Order | Partial<Order>) => {
    try {
      console.log('AdminDashboard: handleUpdateOrder received:', updatedOrder);
      
      const orderId = (updatedOrder as any).id;
      if (!orderId) {
        console.error('AdminDashboard: No order ID provided for update');
        return;
      }
      
      // For item-level updates (like itemPriceApprovalStatus)
      if ((updatedOrder as any).itemIndex !== undefined) {
        console.log('AdminDashboard: Handling item-level update:', updatedOrder);
        const { id, itemIndex, ...updateFields } = updatedOrder as any;
        
        // Update the specific item in the order
        setOrders(prevOrders => 
          prevOrders.map(order => {
            if (order.id === id && order.items && order.items[itemIndex]) {
              const updatedItems = [...order.items];
              updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updateFields };
              console.log('AdminDashboard: Updated item in order:', {
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
        const success = await apiUpdateOrder(id, updatedOrder as any);
        console.log('AdminDashboard: API update result:', success);
        return;
      }
      
      // For complete order updates (including when items are deleted)
      console.log('AdminDashboard: Handling complete order update:', updatedOrder);
      const success = await apiUpdateOrder(updatedOrder.id, updatedOrder as Order);
      if (success) {
        setOrders(prev => prev.map(order => 
          order.id === updatedOrder.id ? (updatedOrder as Order) : order
        ));
        setShowEditModal(false);
        setEditingOrder(null);
        console.log('AdminDashboard: Order updated successfully in state');
      } else {
        // If API update failed, refresh the orders to get the latest data
        console.log('AdminDashboard: API update failed, refreshing orders...');
        await fetchOrders();
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingOrder(null);
  };

  const handleProductHistory = async (productId: string) => {
    setSelectedProduct(productId);
    try {
      const purchases = await getProductPurchases(productId);
      setProductPurchases(purchases);
    } catch (err) {
      console.error('Error fetching product purchases:', err);
      setProductPurchases([]);
    }
    setShowProductHistory(true);
  };

  const handleCloseProductHistory = () => {
    setSelectedProduct(null);
    setShowProductHistory(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Admin Dashboard
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Welcome, {user.username}! Manage all orders and system data.
              </p>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Orders
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {orders.length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Confirmed Orders
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {orders.filter(order => order.status === 'confirmed').length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Pending Orders
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {orders.filter(order => order.status === 'pending').length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">All Orders</h2>
            <OrderTable 
              orders={orders}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={() => { /* handled elsewhere if needed */ }}
              onViewHistory={() => { /* handled elsewhere if needed */ }}
              userIsAdmin={true}
            />
          </div>
        </div>

      </div>

      {/* Edit Order Modal */}
      {showEditModal && editingOrder && (
        <DynamicOrderForm
          order={editingOrder}
          vendors={vendors}
          products={products}
          userRole={'admin'}
          onSave={(updated) => { handleUpdateOrder(updated as Order); }}
          onClose={handleCloseEditModal}
        />
      )}

      {/* Product History Modal */}
      {showProductHistory && selectedProduct && (
        <ProductHistoryModal
          productId={selectedProduct}
          productName={products.find(p => p.id === selectedProduct)?.name || ''}
          purchases={productPurchases}
          onClose={handleCloseProductHistory}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
