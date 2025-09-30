import React, { useState, useEffect } from 'react';
import { Order, Vendor, Product } from '../types';
import { ORDER_FIELD_CONFIGS, OrderFieldConfig, getEditableFieldsForRole } from '../data/orderFieldConfig';

interface DynamicOrderFormProps {
  order?: Order | null;
  vendors: Vendor[];
  products: Product[];
  userRole: 'admin' | 'vendor';
  onSave: (order: any) => void;
  onClose: () => void;
  externalFieldConfigs?: OrderFieldConfig[];
}

interface OrderItem {
  id: string;
  itemNumber: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
}

const DynamicOrderForm: React.FC<DynamicOrderFormProps> = ({
  order,
  vendors,
  products,
  userRole,
  onSave,
  onClose,
  externalFieldConfigs
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fieldConfigs, setFieldConfigs] = useState<OrderFieldConfig[]>(ORDER_FIELD_CONFIGS);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productFilters, setProductFilters] = useState<Record<string, string>>({});

  // Load field configurations
  useEffect(() => {
    console.log('DynamicOrderForm: Loading field configurations', { externalFieldConfigs });
    
    if (externalFieldConfigs && externalFieldConfigs.length > 0) {
      // Use external configurations passed from parent
      console.log('DynamicOrderForm: Using external field configurations', externalFieldConfigs);
      setFieldConfigs(externalFieldConfigs);
    } else {
      // Fallback to localStorage or default configurations
      const savedConfigs = localStorage.getItem('orderFieldConfigs');
      if (savedConfigs) {
        try {
          const parsed = JSON.parse(savedConfigs);
          console.log('DynamicOrderForm: Using localStorage field configurations', parsed);
          setFieldConfigs(parsed);
        } catch (error) {
          console.error('Error loading field configurations from localStorage:', error);
        }
      } else {
        console.log('DynamicOrderForm: Using default field configurations');
      }
    }
  }, [externalFieldConfigs]);

  // Initialize form data
  useEffect(() => {
    if (order) {
      // Debug vendor information
      console.log('DynamicOrderForm: Initializing with order:', {
        orderId: order.id,
        vendorId: order.vendorId,
        vendorIdType: typeof order.vendorId,
        vendorId_id: typeof order.vendorId === 'object' ? order.vendorId?._id : undefined
      });
      
      // Load existing order data
      const vendorId = typeof order.vendorId === 'string' 
        ? order.vendorId 
        : (typeof order.vendorId === 'object' && order.vendorId) 
          ? order.vendorId._id || ''
          : '';
      
      const initialData: Record<string, any> = {
        vendorId,
        confirmFormShehab: formatDateForInput(order.confirmFormShehab),
        estimatedDateReady: formatDateForInput(order.estimatedDateReady),
        invoiceNumber: order.invoiceNumber || '',
        transferAmount: order.transferAmount || 0,
        shippingDateToAgent: formatDateForInput(order.shippingDateToAgent),
        shippingDateToSaudi: formatDateForInput(order.shippingDateToSaudi),
        arrivalDate: formatDateForInput(order.arrivalDate),
        notes: order.notes || '',
        status: order.status || 'pending'
      };
      console.log('DynamicOrderForm: Setting initial form data:', initialData);
      setFormData(initialData);

      // Load existing items
      if (order.items && order.items.length > 0) {
        const items = order.items.map((item, index) => ({
          id: `item-${index}`,
          itemNumber: item.itemNumber || '',
          productName: typeof item.productId === 'object' ? item.productId?.name || '' : '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0
        }));
        setOrderItems(items);
      }
    } else {
      // Initialize with defaults for new order
      const initialData: Record<string, any> = {
        vendorId: '',
        confirmFormShehab: '',
        estimatedDateReady: '',
        invoiceNumber: '',
        transferAmount: 0,
        shippingDateToAgent: '',
        shippingDateToSaudi: '',
        arrivalDate: '',
        notes: '',
        status: 'pending'
      };
      setFormData(initialData);
      
      // Start with one empty item
      const initialItem = {
        id: 'item-0',
        itemNumber: '',
        productName: '',
        quantity: 1,
        unitPrice: 0
      };
      setOrderItems([initialItem]);
      console.log('DynamicOrderForm: Initialized new order with empty item:', initialItem);
    }
  }, [order]);

  // Helper function to format date values for input
  const formatDateForInput = (dateValue: string | Date | null): string => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const handleChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }));
    }
  };

  const addItem = () => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      itemNumber: '',
      productName: '',
      quantity: 1,
      unitPrice: 0
    };
    setOrderItems(prev => [...prev, newItem]);
  };

  const removeItem = (itemId: string) => {
    if (orderItems.length > 1) {
      setOrderItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: keyof OrderItem, value: any) => {
    setOrderItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const validateField = (field: OrderFieldConfig, value: any): string => {
    if (field.required && (!value || value === '')) {
      return `${field.label} is required`;
    }

    if (field.type === 'number' && value !== '') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return `${field.label} must be a valid number`;
      }
      if (field.validation?.min !== undefined && numValue < field.validation.min) {
        return `${field.label} must be at least ${field.validation.min}`;
      }
      if (field.validation?.max !== undefined && numValue > field.validation.max) {
        return `${field.label} must be at most ${field.validation.max}`;
      }
    }

    return '';
  };

  const validateForm = (): boolean => {
    console.log('DynamicOrderForm: Starting form validation');
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Only validate fields that are visible to the current role and editable by them
    const fieldsToValidate = fieldConfigs.filter(field =>
      (field.visibleTo === userRole || field.visibleTo === 'both') &&
      (field.editableBy === userRole || field.editableBy === 'both')
    );

    // Additionally exclude fields we intentionally hide from admin in UI and order item fields
    const finalFields = userRole === 'admin'
      ? fieldsToValidate.filter(f => 
          f.name !== 'price' && 
          f.name !== 'confirmFormShehab' && 
          f.name !== 'quantity' &&
          f.name !== 'itemNumber' &&
          f.name !== 'productName'
        )
      : fieldsToValidate;

    console.log('DynamicOrderForm: Fields to validate:', finalFields.map(f => f.name));
    
    finalFields.forEach(field => {
      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        console.log(`DynamicOrderForm: Field ${field.name} validation failed:`, error, 'Value:', value);
        newErrors[field.name] = error;
        isValid = false;
      }
    });

    // Validate order items
    orderItems.forEach((item, index) => {
      console.log(`Validating item ${index}:`, item);
      
      // Skip validation if item number is 'custom' (this means user is still in custom mode but hasn't entered value yet)
      if (item.itemNumber === 'custom') {
        newErrors[`item_${index}_itemNumber`] = 'Please enter a custom item number';
        isValid = false;
        return; // Skip other validations for this item
      }
      
      if (!item.itemNumber || !item.itemNumber.trim()) {
        newErrors[`item_${index}_itemNumber`] = 'Please select a product or enter a custom item number';
        isValid = false;
      }
      
      if (!item.productName || !item.productName.trim()) {
        newErrors[`item_${index}_productName`] = 'Please enter a product name';
        isValid = false;
      }
      
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0';
        isValid = false;
      }
    });

    setErrors(newErrors);
    console.log('DynamicOrderForm: Form validation result:', { isValid, errors: newErrors });
    
    if (!isValid) {
      console.log('DynamicOrderForm: Validation failed with errors:', Object.keys(newErrors).map(key => `${key}: ${newErrors[key]}`));
    }
    
    return isValid;
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      onClose();
    } catch (err) {
      console.error('DynamicOrderForm: onClose failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    console.log('DynamicOrderForm: Submit button clicked');
    e.preventDefault();
    
    console.log('DynamicOrderForm: Current formData:', formData);
    console.log('DynamicOrderForm: Current orderItems:', orderItems);
    console.log('DynamicOrderForm: Current errors:', errors);
    
    if (!validateForm()) {
      console.log('DynamicOrderForm: Form validation failed');
      return;
    }
    
    console.log('DynamicOrderForm: Form validation passed, proceeding with submission');

    // Prepare order data based on user role
    let orderData: any;

    if (userRole === 'admin') {
      // Validate required fields for order creation
      if (!formData.vendorId) {
        setErrors(prev => ({ ...prev, vendorId: 'Please select a vendor' }));
        return;
      }

      // Prepare items array
      const items = orderItems.map(item => {
        // Try to find existing product by item number
        const existingProduct = products.find(p => p.itemNumber === item.itemNumber);
        const productId = existingProduct ? ((existingProduct as any).id || (existingProduct as any)._id) : null;
        
        return {
          productId: productId || item.itemNumber, // Fallback to itemNumber if product not found
          itemNumber: item.itemNumber,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0
        };
      });

      // Admin creates/updates full order (vendor fills price/confirm later)
      orderData = {
        orderNumber: order?.orderNumber || `ORD-${String(Date.now()).slice(-6)}`,
        vendorId: formData.vendorId,
        items: items,
        status: formData.status,
        ...formData
      };

      // Remove vendor-only fields from admin create payload
      if (orderData.price !== undefined) delete orderData.price;
      if (orderData.confirmFormShehab !== undefined) delete orderData.confirmFormShehab;
      if (orderData.totalAmount !== undefined) delete orderData.totalAmount;

      // Backend compatibility: some environments still expect supplierId and numeric prices
      (orderData as any).supplierId = orderData.vendorId;
      if (orderData.totalAmount === undefined) orderData.totalAmount = 0;

      console.log('DynamicOrderForm: Sending order data to backend', orderData);
    } else {
      // Vendor updates only their fields
      const items = orderItems.map(item => {
        const unitPrice = item.unitPrice || 0;
        const totalPrice = item.quantity * unitPrice;
        
        return {
          productId: item.itemNumber, // Use itemNumber as fallback
          itemNumber: item.itemNumber,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice
        };
      });

      const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

      orderData = {
        id: order?.id,
        items: items,
        totalAmount: totalAmount,
        ...formData
      };
    }

    // Ensure we have an ID for updates
    if (!orderData.id && order?.id) {
      orderData.id = order.id;
    }

    console.log('DynamicOrderForm: Calling onSave with orderData:', orderData);
    onSave(orderData);
  };

  const renderField = (field: OrderFieldConfig) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const isEditable = field.editableBy === userRole || field.editableBy === 'both';
    const isVisible = field.visibleTo === userRole || field.visibleTo === 'both';


    if (!isVisible) {
      return null;
    }

    const baseClasses = `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      error 
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
    }`;

    const disabledClasses = isEditable ? '' : 'bg-gray-100 cursor-not-allowed';
    const fieldClasses = `${baseClasses} ${disabledClasses}`;

    const fieldElement = (() => {
      switch (field.type) {
        case 'select':
          if (field.name === 'vendorId') {
            return (
              <select
                name={field.name}
                value={value}
                onChange={(e) => handleChange(field.name, e.target.value)}
                disabled={!isEditable}
                className={fieldClasses}
              >
                <option value="">Select Vendor</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            );
          } else if (field.options) {
            return (
              <select
                name={field.name}
                value={value}
                onChange={(e) => handleChange(field.name, e.target.value)}
                disabled={!isEditable}
                className={fieldClasses}
              >
                {field.options.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            );
          }
          break;

        case 'textarea':
          return (
            <textarea
              name={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              disabled={!isEditable}
              rows={3}
              placeholder={field.placeholder}
              className={fieldClasses}
            />
          );

        case 'number':
          return (
            <input
              type="number"
              name={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, parseFloat(e.target.value) || 0)}
              disabled={!isEditable}
              min={field.validation?.min}
              max={field.validation?.max}
              step={field.name === 'price' || field.name === 'transferAmount' ? '0.01' : '1'}
              placeholder={field.placeholder}
              className={fieldClasses}
            />
          );

        case 'date':
          return (
            <input
              type="date"
              name={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              disabled={!isEditable}
              placeholder={field.placeholder}
              className={fieldClasses}
            />
          );

        default:
          return (
            <input
              type="text"
              name={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              disabled={!isEditable}
              placeholder={field.placeholder}
              className={fieldClasses}
            />
          );
      }
    })();

    return (
      <div key={field.name} className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
          {!isEditable && (
            <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {field.editableBy === 'admin' ? 'Admin Only' : 'Vendor Only'}
            </span>
          )}
        </label>
        {fieldElement}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  };

  const editableFields = fieldConfigs.filter(field => 
    field.editableBy === userRole || field.editableBy === 'both'
  );
  const visibleFields = fieldConfigs.filter(field => 
    field.visibleTo === userRole || field.visibleTo === 'both'
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {order ? 'Edit Order' : 'Add New Order'} - {userRole === 'admin' ? 'Admin View' : 'Vendor View'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin Fields */}
            {userRole === 'admin' && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-3">Admin Fields (You Fill)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {visibleFields
                    .filter(field => field.editableBy === 'admin')
                    .filter(field => field.name !== 'price')
                    .filter(field => field.name !== 'confirmFormShehab')
                    .filter(field => field.name !== 'itemNumber' && field.name !== 'productName' && field.name !== 'quantity')
                    .map(field => renderField(field))}
                </div>

                {/* Invoice Items Section */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-900">Order Items</h5>
                      <p className="text-xs text-gray-500">
                        {products.length} products available to select from
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {orderItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Select Product *
                            </label>
                            <input
                              list={`products-${item.id}`}
                              value={item.itemNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateItem(item.id, 'itemNumber', val);
                                const selected = products.find(p => p.itemNumber === val);
                                if (selected) {
                                  updateItem(item.id, 'productName', selected.name);
                                }
                              }}
                              placeholder="Type to search existing products or enter custom item number"
                              className={`w-full px-3 py-2 border rounded-md text-sm ${
                                errors[`item_${index}_itemNumber`] 
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                              }`}
                            />
                            <datalist id={`products-${item.id}`}>
                              {products.map(product => (
                                <option key={product.id} value={product.itemNumber}>{product.name}</option>
                              ))}
                            </datalist>
                            {errors[`item_${index}_itemNumber`] && (
                              <p className="text-xs text-red-600 mt-1">{errors[`item_${index}_itemNumber`]}</p>
                            )}
                          </div>

                          <div className="md:col-span-5">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Product Name *
                            </label>
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                              disabled={item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber)}
                              className={`w-full px-3 py-2 border rounded-md text-sm ${
                                errors[`item_${index}_productName`] 
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                              } ${item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber) 
                                ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              placeholder={item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber) 
                                ? "Auto-filled from selected product" : "Enter product name"}
                            />
                            {errors[`item_${index}_productName`] && (
                              <p className="text-xs text-red-600 mt-1">{errors[`item_${index}_productName`]}</p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className={`w-full px-3 py-2 border rounded-md text-sm ${
                                errors[`item_${index}_quantity`] 
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                              }`}
                            />
                            {errors[`item_${index}_quantity`] && (
                              <p className="text-xs text-red-600 mt-1">{errors[`item_${index}_quantity`]}</p>
                            )}
                          </div>

                          <div className="md:col-span-1">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={orderItems.length === 1}
                              className={`w-full p-2 rounded-md text-sm font-medium ${
                                orderItems.length === 1
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-red-100 text-red-600 hover:bg-red-200'
                              }`}
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                  <div className="mt-4 text-sm text-gray-600">
                    Total Items: {orderItems.length} | Total Quantity: {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Vendor Fields */}
            {/* <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-900 mb-3">
                {userRole === 'admin' ? 'Vendor Fields (Vendor Will Fill)' : 'Your Fields (You Can Edit)'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleFields
                  .filter(field => field.editableBy === 'vendor')
                  .map(field => renderField(field))}
              </div>
            </div> */}

            {/* Shared Fields */}
            {visibleFields.some(field => field.editableBy === 'both') && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-yellow-900 mb-3">Shared Fields (Both Can Edit)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleFields
                    .filter(field => field.editableBy === 'both')
                    .map(field => renderField(field))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={(e) => {
                  console.log('DynamicOrderForm: Submit button clicked directly');
                }}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {order ? 'Update Order' : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DynamicOrderForm;
