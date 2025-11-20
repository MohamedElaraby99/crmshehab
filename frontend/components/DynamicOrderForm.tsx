import React, { useState, useEffect } from 'react';
import { Order, Vendor, Product } from '../types';
import { ORDER_FIELD_CONFIGS, OrderFieldConfig, getEditableFieldsForRole } from '../data/orderFieldConfig';
import VendorOrderCreationTable from './VendorOrderCreationTable';
import { uploadOrderItemImage, createOrder } from '../services/api';

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
  imageFile?: File;
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
  const [tableItems, setTableItems] = useState<OrderItem[]>([]);
  const [tableTotalAmount, setTableTotalAmount] = useState<number>(0);

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

    // Additionally exclude fields we intentionally hide from admin in UI
    const finalFields = userRole === 'admin'
      ? fieldsToValidate.filter(f =>
          f.name !== 'confirmFormShehab'
        )
      : fieldsToValidate.filter(f => {
          const vendorExcludedFields = new Set([
            'unitPrice',
            'totalPrice',
            'price',
            'confirmFormShehab',
            'itemNumber',
            'productName',
            'quantity'
          ]);
          return !vendorExcludedFields.has(f.name);
        });

    console.log('DynamicOrderForm: Fields to validate:', finalFields.map(f => f.name));
    
    finalFields.forEach(field => {
      const value = formData[field.name];

      // For vendor orders, skip validation for item-specific fields that come from table items
      if (userRole === 'vendor' && (field.name === 'unitPrice' || field.name === 'totalPrice')) {
        console.log(`DynamicOrderForm: Skipping validation for vendor item field: ${field.name}`);
        return;
      }

      // Only validate if the field has a value or is required
      if (value !== undefined && value !== '' && value !== null) {
        const error = validateField(field, value);
        if (error) {
          console.log(`DynamicOrderForm: Field ${field.name} validation failed:`, error, 'Value:', value);
          newErrors[field.name] = error;
          isValid = false;
        }
      } else if (field.required) {
        // For required fields, validate even if empty
        const error = validateField(field, value);
        if (error) {
          console.log(`DynamicOrderForm: Required field ${field.name} validation failed:`, error, 'Value:', value);
          newErrors[field.name] = error;
          isValid = false;
        }
      }
    });

    // Validate order items - use tableItems for vendor orders, orderItems for admin orders
    const itemsToValidate = userRole === 'vendor' ? tableItems : orderItems;

    itemsToValidate.forEach((item, index) => {
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

  const handleTableChange = (items: OrderItem[], totalAmount: number) => {
    setTableItems(items);
    setTableTotalAmount(totalAmount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('DynamicOrderForm: Submit button clicked');
    e.preventDefault();

    console.log('DynamicOrderForm: Current formData:', formData);
    console.log('DynamicOrderForm: Current tableItems:', tableItems);
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

      // Remove fields that shouldn't be sent to backend
      if (orderData.price !== undefined) delete orderData.price;
      if (orderData.confirmFormShehab !== undefined) delete orderData.confirmFormShehab;
      if (orderData.totalAmount !== undefined) delete orderData.totalAmount;

      // Backend compatibility: some environments still expect supplierId and numeric prices
      (orderData as any).supplierId = orderData.vendorId;
      if (orderData.totalAmount === undefined) orderData.totalAmount = 0;

      console.log('DynamicOrderForm: Sending order data to backend', orderData);
    } else {
      // Vendor creates order using table data
      console.log('DynamicOrderForm: Processing vendor order creation');
      console.log('DynamicOrderForm: tableItems:', tableItems);
      console.log('DynamicOrderForm: tableTotalAmount:', tableTotalAmount);

      if (tableItems.length === 0 || tableItems.every(item => !item.itemNumber.trim())) {
        console.log('DynamicOrderForm: Validation failed - no valid items');
        setErrors(prev => ({ ...prev, items: 'Please add at least one item to the order' }));
        return;
      }

      const items = tableItems.map(item => {
        const unitPrice = item.unitPrice || 0;
        const totalPrice = item.quantity * unitPrice;

        // For vendor orders, we need to handle cases where the product might not exist yet
        // Try to find the actual product by itemNumber to get the proper productId
        const existingProduct = products.find(p => p.itemNumber === item.itemNumber);
        let productId;

        if (existingProduct) {
          productId = (existingProduct as any).id || (existingProduct as any)._id;
        } else {
          // For new products, we'll use the itemNumber as a temporary identifier
          // The backend should handle this case and create the product if needed
          productId = item.itemNumber;
        }

        console.log('DynamicOrderForm: Processing item:', {
          itemNumber: item.itemNumber,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          existingProduct: existingProduct ? 'found' : 'not found',
          productId: productId
        });

        return {
          productId: productId, // Use actual product ID if found, otherwise use itemNumber as temporary ID
          itemNumber: item.itemNumber,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice
        };
      });

      orderData = {
        id: order?.id,
        items: items,
        totalAmount: tableTotalAmount,
        ...formData
      };

      // Remove the overall price field from vendor orders since they use unitPrice per item
      if (orderData.price !== undefined) delete orderData.price;

      console.log('DynamicOrderForm: Final vendor orderData:', orderData);
    }

    // For vendor orders, create the order directly and handle image uploads
    if (userRole === 'vendor') {
      console.log('DynamicOrderForm: Creating vendor order...');
      try {
        const createdOrder = await createOrder(orderData);
        if (createdOrder && createdOrder.id && tableItems.some(item => item.imageFile)) {
          console.log('DynamicOrderForm: Uploading item images...');

          // Upload images for each item that has one
          for (let i = 0; i < tableItems.length; i++) {
            const item = tableItems[i];
            if (item.imageFile) {
              try {
                const uploadResult = await uploadOrderItemImage(createdOrder.id, i, item.imageFile);
                if (uploadResult.success) {
                  console.log(`DynamicOrderForm: Successfully uploaded image for item ${i}`);
                } else {
                  console.error(`DynamicOrderForm: Failed to upload image for item ${i}:`, uploadResult.message);
                }
              } catch (error) {
                console.error(`DynamicOrderForm: Error uploading image for item ${i}:`, error);
              }
            }
          }
        }

        // Call onSave to refresh the dashboard
        onSave(orderData);
      } catch (error) {
        console.error('DynamicOrderForm: Failed to create vendor order:', error);
        return;
      }
    } else {
      // For admin orders, use the regular flow
      onSave(orderData);
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

    const baseClasses = `mt-1 block w-full px-4 py-3 border rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
      error
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
        : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300'
    }`;

    const disabledClasses = isEditable ? '' : 'bg-gray-50 cursor-not-allowed opacity-60';
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
                <option value="">Choose a vendor...</option>
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
              rows={4}
              placeholder={field.placeholder}
              className={`${fieldClasses} resize-none`}
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
      <div key={field.name} className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800 tracking-wide">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
          {!isEditable && (
            <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full border">
              {field.editableBy === 'admin' ? 'Admin Only' : 'Vendor Only'}
            </span>
          )}
        </label>
        <div className="relative">
          {fieldElement}
        </div>
        {error && (
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
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
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-5xl shadow-2xl rounded-xl bg-white">
        <div className="mt-2">
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-100">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                {order ? 'Edit Order' : 'Create New Order'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                {userRole === 'admin' ? 'Administrative View' : 'Vendor Portal'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Admin Fields */}
            {userRole === 'admin' && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-xl border border-blue-200/60">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-blue-900">Administrative Information</h4>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visibleFields
                    .filter(field => field.editableBy === 'admin')
                    .filter(field => field.name !== 'price')
                    .filter(field => field.name !== 'confirmFormShehab')
                    .filter(field => field.name !== 'productName' && field.name !== 'quantity')
                    .map(field => renderField(field))}
                </div>

                {/* Invoice Items Section */}
                <div className="mt-8 pt-6 border-t border-blue-200/60">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Order Items
                      </h5>
                      <div className="text-sm text-gray-600 mt-1">
                        <p className="font-medium">
                          📋 <strong>Item Number</strong> is the key field • {products.length} products available
                        </p>
                        <p className="text-xs mt-1 opacity-75">
                          Search existing products or enter custom item numbers like "68240575AB(iron)"
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {orderItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-gray-600">{index + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-700">Item Details</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={orderItems.length === 1}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${
                              orderItems.length === 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <label className="block text-sm font-bold text-gray-800 tracking-wide">
                                Item Number *
                              </label>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Key Field
                              </span>
                            </div>
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
                              placeholder="e.g., 68240575AB(iron) - Search or enter custom"
                              className={`w-full px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                errors[`item_${index}_itemNumber`]
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                  : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300'
                              }`}
                            />
                            <datalist id={`products-${item.id}`}>
                              {products.map(product => (
                                <option key={product.id} value={product.itemNumber}>{product.name}</option>
                              ))}
                            </datalist>
                            {errors[`item_${index}_itemNumber`] && (
                              <div className="flex items-center space-x-1 mt-2">
                                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <p className="text-xs text-red-600 font-medium">{errors[`item_${index}_itemNumber`]}</p>
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-sm font-bold text-gray-800 mb-2 tracking-wide">
                              Product Name *
                            </label>
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                              disabled={item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber)}
                              className={`w-full px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                errors[`item_${index}_productName`]
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                  : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300'
                              } ${item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber)
                                ? 'bg-gray-50 cursor-not-allowed opacity-60' : ''}`}
                              placeholder={item.itemNumber && item.itemNumber !== 'custom' && products.some(p => p.itemNumber === item.itemNumber)
                                ? "Auto-filled from selected product" : "Enter product name"}
                            />
                            {errors[`item_${index}_productName`] && (
                              <div className="flex items-center space-x-1 mt-2">
                                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <p className="text-xs text-red-600 font-medium">{errors[`item_${index}_productName`]}</p>
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-sm font-bold text-gray-800 mb-2 tracking-wide">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className={`w-full px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                errors[`item_${index}_quantity`]
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                  : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300'
                              }`}
                            />
                            {errors[`item_${index}_quantity`] && (
                              <div className="flex items-center space-x-1 mt-2">
                                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <p className="text-xs text-red-600 font-medium">{errors[`item_${index}_quantity`]}</p>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    ))}
                </div>

                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="font-medium text-gray-700">Total Items:</span>
                          <span className="font-semibold text-gray-900">{orderItems.length}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                          <span className="font-medium text-gray-700">Total Quantity:</span>
                          <span className="font-semibold text-gray-900">{orderItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vendor Fields */}
            {userRole === 'vendor' && !order && (
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-6 rounded-xl border border-green-200/60">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-green-900">Order Items</h4>
                </div>
                <VendorOrderCreationTable
                  products={products}
                  onOrderChange={handleTableChange}
                />
              </div>
            )}

            {userRole === 'vendor' && order && (
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-6 rounded-xl border border-green-200/60">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-green-900">Your Fields</h4>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visibleFields
                    .filter(field => field.editableBy === 'vendor')
                    .map(field => renderField(field))}
                </div>
              </div>
            )}

            {userRole === 'admin' && (
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 rounded-xl border border-amber-200/60">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-amber-900">Vendor Fields</h4>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visibleFields
                    .filter(field => field.editableBy === 'vendor')
                    .map(field => renderField(field))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{order ? 'Update Order' : 'Create Order'}</span>
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DynamicOrderForm;
