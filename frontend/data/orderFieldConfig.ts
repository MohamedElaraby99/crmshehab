export interface OrderFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  editableBy: 'admin' | 'vendor' | 'both';
  visibleTo: 'admin' | 'vendor' | 'both';
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export const ORDER_FIELD_CONFIGS: OrderFieldConfig[] = [
  {
    name: 'itemNumber',
    label: 'Item Number',
    type: 'text',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    placeholder: 'e.g., 68240575AB(iron)'
  },
  {
    name: 'productName',
    label: 'Product Name',
    type: 'text',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    placeholder: 'Product description'
  },
  {
    name: 'quantity',
    label: 'Quantity',
    type: 'number',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    validation: { min: 1 }
  },
  {
    name: 'price',
    label: 'Price ($)',
    type: 'number',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    validation: { min: 0 }
  },
  {
    name: 'vendorId',
    label: 'Vendor',
    type: 'select',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both'
  },
  {
    name: 'confirmFormShehab',
    label: 'Confirm Form Shehab',
    type: 'date',
    required: false,
    editableBy: 'admin',
    visibleTo: 'both',
    placeholder: 'Select date'
  },
  {
    name: 'estimatedDateReady',
    label: 'Estimated Date to be Ready',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    placeholder: 'Vendor will fill this'
  },
  {
    name: 'invoiceNumber',
    label: 'Invoice Number',
    type: 'text',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    placeholder: 'e.g., MS002'
  },
  {
    name: 'transferAmount',
    label: 'Transfer Amount ($)',
    type: 'number',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    validation: { min: 0 }
  },
  {
    name: 'shippingDateToAgent',
    label: 'Shipping Date to Agent',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both'
  },
  {
    name: 'shippingDateToSaudi',
    label: 'Shipping Date to Saudi Arabia',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both'
  },
  {
    name: 'arrivalDate',
    label: 'Arrival Date',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both'
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    required: false,
    editableBy: 'both',
    visibleTo: 'both',
    placeholder: 'Additional information'
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: false,
    editableBy: 'admin',
    visibleTo: 'both',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' }
    ]
  }
];

// Helper functions
export const getFieldsForRole = (role: 'admin' | 'vendor'): OrderFieldConfig[] => {
  return ORDER_FIELD_CONFIGS.filter(field => 
    field.visibleTo === role || field.visibleTo === 'both'
  );
};

export const getEditableFieldsForRole = (role: 'admin' | 'vendor'): OrderFieldConfig[] => {
  return ORDER_FIELD_CONFIGS.filter(field => 
    field.editableBy === role || field.editableBy === 'both'
  );
};

export const getFieldConfig = (fieldName: string): OrderFieldConfig | undefined => {
  return ORDER_FIELD_CONFIGS.find(field => field.name === fieldName);
};
