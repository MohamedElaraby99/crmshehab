import React from 'react';
import { ProductPurchase } from '../types';

interface ProductHistoryModalProps {
  productId: string;
  productName: string;
  purchases: ProductPurchase[];
  onClose: () => void;
}

const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({ 
  productId, 
  productName, 
  purchases, 
  onClose 
}) => {
  // Add null/undefined checks
  const safePurchases = purchases || [];
  const totalQuantity = safePurchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalAmount = safePurchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const averagePrice = safePurchases.length > 0 ? totalAmount / totalQuantity : 0;
  const uniqueVendors = [...new Set(safePurchases.map(p => p.vendorId))].length;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-gray-900">
              Purchase History: {productName}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-600">Total Purchases</div>
              <div className="text-2xl font-bold text-blue-900">{safePurchases.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-green-600">Total Quantity</div>
              <div className="text-2xl font-bold text-green-900">{totalQuantity}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-purple-600">Total Amount</div>
              <div className="text-2xl font-bold text-purple-900">${totalAmount.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-orange-600">Unique Vendors</div>
              <div className="text-2xl font-bold text-orange-900">{uniqueVendors}</div>
            </div>
          </div>

          {/* Average Price */}
          <div className="mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-600">Average Price per Unit</div>
              <div className="text-xl font-bold text-gray-900">${averagePrice.toFixed(2)}</div>
            </div>
          </div>

          {/* Purchase History Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchase Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {safePurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(purchase.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{purchase.vendorName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${purchase.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${purchase.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {typeof purchase.orderId === 'object' ? (purchase as any).orderId?.orderNumber || (purchase as any).orderId?.id || 'N/A' : (purchase.orderId || 'N/A')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {purchase.notes || 'No notes'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {safePurchases.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No purchase history found for this product.
              </div>
            )}

          {/* Vendor Summary */}
          {uniqueVendors > 1 && (
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h4 className="text-lg font-medium text-gray-900 mb-3">Vendor Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(new Set(safePurchases.map(p => p.vendorId))).map(vendorId => {
                  const vendorPurchases = safePurchases.filter(p => p.vendorId === vendorId);
                  const vendorTotal = vendorPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
                  const vendorQuantity = vendorPurchases.reduce((sum, p) => sum + p.quantity, 0);
                  const vendorName = vendorPurchases[0]?.vendorName || 'Unknown';
                  
                  return (
                    <div key={vendorId} className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900">{vendorName}</div>
                      <div className="text-sm text-gray-600">
                        {vendorPurchases.length} purchase{vendorPurchases.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm text-gray-600">
                        {vendorQuantity} units - ${vendorTotal.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductHistoryModal;