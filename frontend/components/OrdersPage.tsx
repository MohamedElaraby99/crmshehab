import React, { useState, useEffect } from 'react';
import { Order, Vendor, Product } from '../types';
import { getAllOrders, createOrder, updateOrder, deleteOrder, getAllVendors, getAllProducts, getAllFieldConfigs, FieldConfig } from '../services/api';
import DynamicOrderForm from './DynamicOrderForm';
import FieldConfigManager from './FieldConfigManager';
import { OrderFieldConfig } from '../data/orderFieldConfig';

interface OrdersPageProps {
  onLogout: () => void;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<OrderFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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
    </div>
  );
};


export default OrdersPage;
