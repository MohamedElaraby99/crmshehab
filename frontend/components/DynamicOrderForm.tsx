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
      // Load existing order data
      // Extract data from first item for form initialization
      const firstItem = order.items && order.items[0] ? order.items[0] : null;
      const initialData: Record<string, any> = {
        itemNumber: firstItem?.itemNumber || '',
        productName: firstItem?.productId?.name || '',
        quantity: firstItem?.quantity || 1,
        price: firstItem?.unitPrice || 0,
        vendorId: typeof order.vendorId === 'string' ? order.vendorId : order.vendorId?._id || '',
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
      setFormData(initialData);
    } else {
      // Initialize with defaults for new order
      const initialData: Record<string, any> = {
        itemNumber: '',
        productName: '',
        quantity: 1,
        price: 0,
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
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Only validate fields that are visible to the current role and editable by them
    const fieldsToValidate = fieldConfigs.filter(field =>
      (field.visibleTo === userRole || field.visibleTo === 'both') &&
      (field.editableBy === userRole || field.editableBy === 'both')
    );

    // Additionally exclude fields we intentionally hide from admin in UI
    const finalFields = userRole === 'admin'
      ? fieldsToValidate.filter(f => f.name !== 'price' && f.name !== 'confirmFormShehab')
      : fieldsToValidate;

    finalFields.forEach(field => {
      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
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
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Prepare order data based on user role
    let orderData: any;

    if (userRole === 'admin') {
      // Validate required fields for order creation
      if (!formData.vendorId) {
        setErrors(prev => ({ ...prev, vendorId: 'Please select a vendor' }));
        return;
      }

      // Find the product by selected ID or item number
      const selectedProduct = selectedProductId 
        ? products.find(p => p.id === selectedProductId || (p as any)._id === selectedProductId)
        : products.find(p => p.itemNumber === formData.itemNumber);
      
      if (!selectedProduct) {
        setErrors(prev => ({ ...prev, itemNumber: 'Please select a product from the list or enter a valid item number.' }));
        return;
      }

      // Admin creates/updates full order (vendor fills price/confirm later)
      const selectedProductIdFinal = (selectedProduct as any).id || (selectedProduct as any)._id;

      orderData = {
        orderNumber: order?.orderNumber || `ORD-${String(Date.now()).slice(-6)}`,
        vendorId: formData.vendorId,
        items: [{
          productId: selectedProductIdFinal,
          itemNumber: formData.itemNumber,
          quantity: formData.quantity
        }],
        status: formData.status,
        ...formData
      };

      // Remove vendor-only fields from admin create payload
      if (orderData.price !== undefined) delete orderData.price;
      if (orderData.confirmFormShehab !== undefined) delete orderData.confirmFormShehab;
      if (orderData.totalAmount !== undefined) delete orderData.totalAmount;
      if (orderData.items && orderData.items[0]) {
        if (orderData.items[0].unitPrice !== undefined) delete orderData.items[0].unitPrice;
        if (orderData.items[0].totalPrice !== undefined) delete orderData.items[0].totalPrice;
      }

      // Backend compatibility: some environments still expect supplierId and numeric prices
      // Mirror vendorId to supplierId and set zero prices if missing
      (orderData as any).supplierId = orderData.vendorId;
      if (orderData.items && orderData.items[0]) {
        if (orderData.items[0].unitPrice === undefined) orderData.items[0].unitPrice = 0;
        if (orderData.items[0].totalPrice === undefined) orderData.items[0].totalPrice = 0;
      }
      if (orderData.totalAmount === undefined) orderData.totalAmount = 0;

      console.log('DynamicOrderForm: Sending order data to backend', orderData);
    } else {
      // Vendor updates only their fields
      const quantity = Number(formData.quantity) || 0;
      const unitPrice = Number(formData.price) || 0;
      const computedTotal = quantity * unitPrice;

      orderData = {
        id: order?.id,
        ...formData
      };

      // Ensure nested items and totals are updated
      if (order && order.items && order.items[0]) {
        const firstItem = order.items[0];
        orderData.items = [
          {
            productId: (firstItem.productId as any)?.id || (firstItem.productId as any)?._id || firstItem.productId,
            itemNumber: firstItem.itemNumber,
            quantity,
            unitPrice,
            totalPrice: computedTotal
          }
        ];
      }

      orderData.totalAmount = computedTotal;
    }

    // Ensure we have an ID for updates
    if (!orderData.id && order?.id) {
      orderData.id = order.id;
    }

    console.log('DynamicOrderForm: Final order data being sent:', orderData);

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
                
                {/* Product Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Product
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const product = products.find(p => p.id === e.target.value);
                      if (product) {
                        setFormData(prev => ({
                          ...prev,
                          itemNumber: product.itemNumber,
                          productName: product.name
                        }));
                      }
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a product...</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.itemNumber} - {product.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Or enter the item number manually below
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleFields
                    .filter(field => field.editableBy === 'admin')
                    .filter(field => field.name !== 'price')
                    .filter(field => field.name !== 'confirmFormShehab')
                    .map(field => renderField(field))}
                </div>
              </div>
            )}

            {/* Vendor Fields */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-900 mb-3">
                {userRole === 'admin' ? 'Vendor Fields (Vendor Will Fill)' : 'Your Fields (You Can Edit)'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleFields
                  .filter(field => field.editableBy === 'vendor')
                  .map(field => renderField(field))}
              </div>
            </div>

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
