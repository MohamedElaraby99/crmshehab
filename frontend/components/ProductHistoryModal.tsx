
import React from 'react';
import { Order } from '../types';

interface ProductHistoryModalProps {
  itemNumber: string;
  allOrders: Order[];
  onClose: () => void;
}

const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({ itemNumber, allOrders, onClose }) => {
  const productHistory = allOrders.filter(order => order.itemNumber === itemNumber);
  const productName = productHistory.length > 0 ? productHistory[0].productName : '';

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  Order History for: {itemNumber} ({productName})
                </h3>
                <div className="mt-4">
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Arrival Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {productHistory.map(order => (
                                    <tr key={order.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{order.quantity}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${order.price.toFixed(2)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{order.invoiceNumber}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{order.arrivalDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
