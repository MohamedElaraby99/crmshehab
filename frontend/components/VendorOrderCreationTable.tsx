import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { getApiOrigin } from '../services/api';

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
      // Clean up only uploaded file object URLs to prevent memory leaks
      // Don't revoke URLs for product images as they're external resources
      orderItems.forEach(item => {
        if (item.imagePreview && item.imageFile) {
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
    const objectUrl = URL.createObjectURL(file);
    console.log('Created object URL for uploaded file:', objectUrl);
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          imageFile: file,
          imagePreview: objectUrl
        };
      }
      return item;
    }));
  };

  const removeImage = (itemId: string) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Revoke the object URL to prevent memory leaks (only for uploaded files)
        if (item.imagePreview && item.imageFile) {
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
      // Clean up the image preview before removing the item (only for uploaded files)
      const itemToRemove = orderItems.find(item => item.id === itemId);
      if (itemToRemove?.imagePreview && itemToRemove?.imageFile) {
        URL.revokeObjectURL(itemToRemove.imagePreview);
      }

      setOrderItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: keyof OrderItem, value: any) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };

        // Auto-fill product name and image when item number is selected
        if (field === 'itemNumber') {
          if (value) {
            const selectedProduct = products.find(p => p.itemNumber === value);
            if (selectedProduct) {
              console.log('Selected product:', selectedProduct.itemNumber, selectedProduct.name, 'Images:', selectedProduct.images);
              updatedItem.productName = selectedProduct.name;

              // Auto-display product image if available
              if (selectedProduct.images && selectedProduct.images.length > 0) {
                // Use the first image from the product
                const productImageUrl = selectedProduct.images[0];
                // Convert relative URL to absolute URL pointing to backend server
                const fullImageUrl = productImageUrl.startsWith('http')
                  ? productImageUrl
                  : `${getApiOrigin()}${productImageUrl}`;
                console.log('Setting product image preview:', fullImageUrl);
                updatedItem.imagePreview = fullImageUrl;
                // Clear any uploaded file since we're using product image
                updatedItem.imageFile = null;
              } else {
                console.log('Product has no images');
              }
            }
          } else {
            // Clear product name and image when item number is cleared
            updatedItem.productName = '';
            if (updatedItem.imageFile) {
              // Keep uploaded image if user uploaded one
              // Only clear if it was a product image (no imageFile)
            } else {
              // Clear product image when item number is cleared
              updatedItem.imagePreview = '';
            }
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
    <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-6 rounded-xl border border-green-200/60">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-green-900">Order Items</h4>
              </div>
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">
                  🎯 <strong>Item Number is the primary field</strong> • Start by entering or searching for product codes
                </p>
                <p className="text-xs opacity-75">
                  Search by item number (e.g., 68282329AA) or product name • Product details and images load automatically
                </p>
              </div>
            </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add New Item
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Image
              </th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider bg-blue-50 border-r-2 border-blue-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span>Item Number</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    KEY FIELD
                  </span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Unit Price (¥)
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Total Price (¥)
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orderItems.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col items-center space-y-2">
                    {item.imagePreview ? (
                      <div className="relative">
                        <img
                          src={item.imagePreview}
                          alt="Product preview"
                          className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
                          onLoad={() => console.log('Image loaded successfully:', item.imagePreview)}
                          onError={(e) => console.error('Failed to load image:', item.imagePreview, e)}
                        />
                        {item.imageFile ? (
                          // Show different indicator for uploaded images
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                            ✓
                          </div>
                        ) : (
                          // Show indicator for product images
                          <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                            P
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(item.id)}
                          className="absolute -bottom-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <span className="text-gray-400 text-xs block">No Image</span>
                          <span className="text-gray-300 text-xs">for product</span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col space-y-1">
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
                        className={`cursor-pointer px-2 py-1 rounded text-xs font-medium ${
                          item.imagePreview && !item.imageFile
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                        title={item.imagePreview && !item.imageFile ? 'Upload to override product image' : 'Upload custom image'}
                      >
                        {item.imagePreview && !item.imageFile ? 'Override' : 'Upload'}
                      </label>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap bg-blue-50/30 border-r-2 border-blue-100">
                  <div className="relative">
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="block text-xs font-bold text-blue-800 tracking-wide">
                        Item Number *
                      </label>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Primary
                      </span>
                    </div>
                    <input
                      type="text"
                      list={`products-${item.id}`}
                      value={item.itemNumber}
                      onChange={(e) => updateItem(item.id, 'itemNumber', e.target.value)}
                      placeholder="e.g., 68282329AA - Search existing or enter custom"
                      className="block w-full px-4 py-3 border-2 border-blue-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium bg-white hover:border-blue-300 transition-all duration-200"
                    />
                    <datalist id={`products-${item.id}`}>
                      {getFilteredProducts(item.itemNumber).map(product => (
                        <option key={product.id} value={product.itemNumber}>
                          {product.name} {product.images && product.images.length > 0 ? '🖼️' : ''}
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
                    placeholder="Auto-filled when item number is selected"
                    className="block w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium bg-gray-50 hover:bg-white transition-all duration-200"
                    disabled={item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber)}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    className="block w-32 px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium bg-white hover:border-gray-300 transition-all duration-200"
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
                    className="block w-32 px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium bg-white hover:border-gray-300 transition-all duration-200"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-lg font-bold text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    ¥{((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={orderItems.length === 1}
                    className={`inline-flex items-center p-2 border border-transparent rounded-lg text-sm font-medium transition-all duration-200 ${
                      orderItems.length === 1
                        ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                        : 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300'
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

      <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Total Items:</span>
              <span className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-200">
                {orderItems.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Total Amount:</span>
              <span className="text-xl font-bold text-green-700 bg-white px-4 py-2 rounded-lg border-2 border-green-200">
                ¥{orderItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorOrderCreationTable;
