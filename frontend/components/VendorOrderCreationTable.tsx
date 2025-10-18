import React, { useState, useEffect } from 'react';
import { Product } from '../types';

interface OrderItem {
  id: string;
  itemNumber: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  imageFile?: File | null;
  imagePreview?: string;
}

interface VendorOrderCreationTableProps {
  products: Product[];
  onOrderChange: (items: OrderItem[], totalAmount: number) => void;
}

const VendorOrderCreationTable: React.FC<VendorOrderCreationTableProps> = ({
  products,
  onOrderChange
}) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      id: 'item-0',
      itemNumber: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      imageFile: null,
      imagePreview: ''
    }
  ]);

  // Calculate totals whenever items change
  useEffect(() => {
    const totalAmount = orderItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    onOrderChange(orderItems, totalAmount);
  }, [orderItems, onOrderChange]);

  // Cleanup object URLs when component unmounts or items change
  useEffect(() => {
    return () => {
      // Clean up all object URLs to prevent memory leaks
      orderItems.forEach(item => {
        if (item.imagePreview) {
          URL.revokeObjectURL(item.imagePreview);
        }
      });
    };
  }, [orderItems]);

  const addItem = () => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      itemNumber: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      imageFile: null,
      imagePreview: ''
    };
    setOrderItems(prev => [...prev, newItem]);
  };

  const handleImageUpload = (itemId: string, file: File) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          imageFile: file,
          imagePreview: URL.createObjectURL(file)
        };
      }
      return item;
    }));
  };

  const removeImage = (itemId: string) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Revoke the object URL to prevent memory leaks
        if (item.imagePreview) {
          URL.revokeObjectURL(item.imagePreview);
        }
        return {
          ...item,
          imageFile: null,
          imagePreview: ''
        };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    if (orderItems.length > 1) {
      // Clean up the image preview before removing the item
      const itemToRemove = orderItems.find(item => item.id === itemId);
      if (itemToRemove?.imagePreview) {
        URL.revokeObjectURL(itemToRemove.imagePreview);
      }

      setOrderItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: keyof OrderItem, value: any) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };

        // Auto-fill product name when item number is selected
        if (field === 'itemNumber' && value) {
          const selectedProduct = products.find(p => p.itemNumber === value);
          if (selectedProduct) {
            updatedItem.productName = selectedProduct.name;
          }
        }

        // Calculate total price when quantity or unit price changes
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.totalPrice = (updatedItem.quantity || 0) * (updatedItem.unitPrice || 0);
        }

        return updatedItem;
      }
      return item;
    }));
  };

  const getFilteredProducts = (searchTerm: string) => {
    if (!searchTerm) return products;
    return products.filter(p =>
      p.itemNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-lg font-medium text-gray-900">Order Items</h4>
          <p className="text-sm text-gray-600">
            Add products to your order. You can search by item number or product name.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Image
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit Price (¥)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Price (¥)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orderItems.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col items-center space-y-2">
                    {item.imagePreview ? (
                      <div className="relative">
                        <img
                          src={item.imagePreview}
                          alt="Product preview"
                          className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(item.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <span className="text-gray-400 text-xs">No Image</span>
                      </div>
                    )}
                    <div className="flex space-x-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(item.id, file);
                          }
                        }}
                        className="hidden"
                        id={`image-upload-${item.id}`}
                      />
                      <label
                        htmlFor={`image-upload-${item.id}`}
                        className="cursor-pointer bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                      >
                        Upload
                      </label>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="relative">
                    <input
                      type="text"
                      list={`products-${item.id}`}
                      value={item.itemNumber}
                      onChange={(e) => updateItem(item.id, 'itemNumber', e.target.value)}
                      placeholder="Enter item number"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <datalist id={`products-${item.id}`}>
                      {getFilteredProducts(item.itemNumber).map(product => (
                        <option key={product.id} value={product.itemNumber}>
                          {product.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <input
                    type="text"
                    value={item.productName}
                    onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                    placeholder="Product name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice || ''}
                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ¥{((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={orderItems.length === 1}
                    className={`inline-flex items-center p-2 border border-transparent rounded-md text-sm font-medium ${
                      orderItems.length === 1
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
        <div>
          Total Items: {orderItems.length}
        </div>
        <div className="font-medium">
          Total Amount: ¥{orderItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
};

export default VendorOrderCreationTable;
