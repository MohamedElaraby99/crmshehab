
import { User, Order, Product, Vendor, ProductPurchase } from '../types';

export const MOCK_USERS: User[] = [
  { id: 'u1', username: 'admin' },
  // Vendor users
  { id: 'u4', username: 'autoparts_central' },
  { id: 'u5', username: 'global_motors' },
  { id: 'u6', username: 'european_auto' },
  { id: 'u7', username: 'asian_parts' },
];


export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'Auto Parts Central',
    contactPerson: 'John Smith',
    email: 'john@autopartscentral.com',
    phone: '+1-555-0123',
    address: '123 Main Street',
    city: 'Detroit',
    country: 'USA',
    status: 'active',
    username: 'autoparts_central',
    password: 'AutoParts2024!',
    userId: 'u4',
    createdAt: '2023-01-15',
    updatedAt: '2024-01-10'
  },
  {
    id: 'v2',
    name: 'Global Motors Ltd',
    contactPerson: 'Sarah Johnson',
    email: 'sarah@globalmotors.com',
    phone: '+1-555-0456',
    address: '456 Industrial Blvd',
    city: 'Chicago',
    country: 'USA',
    status: 'active',
    username: 'global_motors',
    password: 'GlobalMotors2024!',
    userId: 'u5',
    createdAt: '2023-02-20',
    updatedAt: '2024-01-05'
  },
  {
    id: 'v3',
    name: 'European Auto Supply',
    contactPerson: 'Michael Brown',
    email: 'michael@europeanauto.com',
    phone: '+44-20-7946-0958',
    address: '789 London Road',
    city: 'London',
    country: 'UK',
    status: 'inactive',
    username: 'european_auto',
    password: 'EuropeanAuto2024!',
    userId: 'u6',
    createdAt: '2023-03-10',
    updatedAt: '2023-12-15'
  },
  {
    id: 'v4',
    name: 'Asian Parts Co',
    contactPerson: 'Li Wei',
    email: 'liwei@asianparts.com',
    phone: '+86-21-1234-5678',
    address: '321 Shanghai Street',
    city: 'Shanghai',
    country: 'China',
    status: 'active',
    username: 'asian_parts',
    password: 'AsianParts2024!',
    userId: 'u7',
    createdAt: '2023-04-05',
    updatedAt: '2024-01-08'
  }
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    itemNumber: '68263724',
    name: 'Gear Assembly',
    description: 'High-quality gear assembly for automotive transmission systems',
    category: 'Transmission',
    price: 16.00,
    stock: 150,
    createdAt: '2023-01-15',
    updatedAt: '2024-01-10'
  },
  {
    id: 'p2',
    itemNumber: '4596198',
    name: 'Brake Pad Set',
    description: 'Premium brake pad set with ceramic compound for superior stopping power',
    category: 'Brakes',
    price: 12.00,
    stock: 300,
    createdAt: '2023-01-20',
    updatedAt: '2024-01-08'
  },
  {
    id: 'p3',
    itemNumber: '04891720AA',
    name: 'Oil Filter',
    description: 'High-efficiency oil filter for engine protection and performance',
    category: 'Engine',
    price: 13.00,
    stock: 500,
    createdAt: '2023-02-01',
    updatedAt: '2024-01-12'
  },
  {
    id: 'p4',
    itemNumber: '4782684AB',
    name: 'Control Arm',
    description: 'Durable control arm for suspension system stability',
    category: 'Suspension',
    price: 2.50,
    stock: 200,
    createdAt: '2023-02-10',
    updatedAt: '2024-01-05'
  },
  {
    id: 'p5',
    itemNumber: '68240575AB',
    name: 'Wheel Hub (Iron)',
    description: 'Heavy-duty iron wheel hub for commercial vehicles',
    category: 'Wheels',
    price: 50.00,
    stock: 75,
    createdAt: '2023-03-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'p6',
    itemNumber: '68240575AB-AL',
    name: 'Wheel Hub (Aluminum)',
    description: 'Lightweight aluminum wheel hub for performance vehicles',
    category: 'Wheels',
    price: 70.00,
    stock: 50,
    createdAt: '2023-03-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'p7',
    itemNumber: '4895235AA',
    name: 'Radiator',
    description: 'High-capacity radiator for efficient engine cooling',
    category: 'Cooling',
    price: 20.00,
    stock: 100,
    createdAt: '2023-03-15',
    updatedAt: '2024-01-10'
  },
  {
    id: 'p8',
    itemNumber: '68240574AB',
    name: 'Shock Absorber (Iron)',
    description: 'Heavy-duty iron shock absorber for heavy vehicles',
    category: 'Suspension',
    price: 50.00,
    stock: 80,
    createdAt: '2023-04-01',
    updatedAt: '2024-01-12'
  },
  {
    id: 'p9',
    itemNumber: '68240574AB-AL',
    name: 'Shock Absorber (Aluminum)',
    description: 'Lightweight aluminum shock absorber for sports cars',
    category: 'Suspension',
    price: 70.00,
    stock: 60,
    createdAt: '2023-04-01',
    updatedAt: '2024-01-12'
  },
  {
    id: 'p10',
    itemNumber: '4782683AB',
    name: 'Tie Rod End',
    description: 'Precision tie rod end for steering system accuracy',
    category: 'Steering',
    price: 2.50,
    stock: 150,
    createdAt: '2023-04-10',
    updatedAt: '2024-01-08'
  }
];

export const MOCK_PRODUCT_PURCHASES: ProductPurchase[] = [
  // Gear Assembly purchases
  {
    id: 'pp1',
    productId: 'p1',
    vendorId: 'v1',
    vendorName: 'Auto Parts Central',
    quantity: 100,
    price: 16.00,
    totalAmount: 1600.00,
    purchaseDate: '2023-12-20',
    orderId: 'o1',
    notes: 'Initial bulk order'
  },
  {
    id: 'pp2',
    productId: 'p1',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 50,
    price: 15.50,
    totalAmount: 775.00,
    purchaseDate: '2023-11-01',
    orderId: 'o11',
    notes: 'Follow-up order with discount'
  },
  // Brake Pad Set purchases
  {
    id: 'pp3',
    productId: 'p2',
    vendorId: 'v1',
    vendorName: 'Auto Parts Central',
    quantity: 200,
    price: 12.00,
    totalAmount: 2400.00,
    purchaseDate: '2023-12-20',
    orderId: 'o2',
    notes: 'Standard order'
  },
  {
    id: 'pp4',
    productId: 'p2',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 150,
    price: 11.50,
    totalAmount: 1725.00,
    purchaseDate: '2023-10-15',
    orderId: 'o12',
    notes: 'Previous order with better pricing'
  },
  // Oil Filter purchases
  {
    id: 'pp5',
    productId: 'p3',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 300,
    price: 13.00,
    totalAmount: 3900.00,
    purchaseDate: '2023-12-20',
    orderId: 'o3',
    notes: 'High volume order'
  },
  // Control Arm purchases
  {
    id: 'pp6',
    productId: 'p4',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 400,
    price: 2.50,
    totalAmount: 1000.00,
    purchaseDate: '2023-12-20',
    orderId: 'o4',
    notes: 'Bulk order for suspension parts'
  },
  // Wheel Hub (Iron) purchases
  {
    id: 'pp7',
    productId: 'p5',
    vendorId: 'v1',
    vendorName: 'Auto Parts Central',
    quantity: 100,
    price: 50.00,
    totalAmount: 5000.00,
    purchaseDate: '2023-12-14',
    orderId: 'o6',
    notes: 'Urgent order for commercial vehicles'
  },
  // Wheel Hub (Aluminum) purchases
  {
    id: 'pp8',
    productId: 'p6',
    vendorId: 'v1',
    vendorName: 'Auto Parts Central',
    quantity: 100,
    price: 70.00,
    totalAmount: 7000.00,
    purchaseDate: '2023-12-14',
    orderId: 'o7',
    notes: 'Performance vehicle parts'
  },
  // Radiator purchases
  {
    id: 'pp9',
    productId: 'p7',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 200,
    price: 20.00,
    totalAmount: 4000.00,
    purchaseDate: '2023-11-08',
    orderId: 'o10',
    notes: 'Holiday shipping arrangement'
  },
  // Shock Absorber (Iron) purchases
  {
    id: 'pp10',
    productId: 'p8',
    vendorId: 'v1',
    vendorName: 'Auto Parts Central',
    quantity: 100,
    price: 50.00,
    totalAmount: 5000.00,
    purchaseDate: '2023-12-14',
    orderId: 'o8',
    notes: 'Heavy vehicle suspension'
  },
  // Shock Absorber (Aluminum) purchases
  {
    id: 'pp11',
    productId: 'p9',
    vendorId: 'v1',
    vendorName: 'Auto Parts Central',
    quantity: 100,
    price: 70.00,
    totalAmount: 7000.00,
    purchaseDate: '2023-12-14',
    orderId: 'o9',
    notes: 'Sports car suspension'
  },
  // Tie Rod End purchases
  {
    id: 'pp12',
    productId: 'p10',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 400,
    price: 2.50,
    totalAmount: 1000.00,
    purchaseDate: '2023-12-20',
    orderId: 'o5',
    notes: 'Steering system components'
  },
  // Additional purchases from different vendors for same products
  {
    id: 'pp13',
    productId: 'p1',
    vendorId: 'v3',
    vendorName: 'European Auto Supply',
    quantity: 75,
    price: 17.50,
    totalAmount: 1312.50,
    purchaseDate: '2023-09-15',
    orderId: 'o13',
    notes: 'European supplier - higher quality'
  },
  {
    id: 'pp14',
    productId: 'p2',
    vendorId: 'v4',
    vendorName: 'Asian Parts Co',
    quantity: 300,
    price: 10.00,
    totalAmount: 3000.00,
    purchaseDate: '2023-08-20',
    orderId: 'o14',
    notes: 'Asian supplier - competitive pricing'
  },
  {
    id: 'pp15',
    productId: 'p5',
    vendorId: 'v2',
    vendorName: 'Global Motors Ltd',
    quantity: 50,
    price: 48.00,
    totalAmount: 2400.00,
    purchaseDate: '2023-07-10',
    orderId: 'o15',
    notes: 'Alternative supplier for wheel hubs'
  }
];

/**
 * Defines which fields in an Order can be edited by a supplier.
 * Admin users can edit all fields.
 */
export const SUPPLIER_EDITABLE_FIELDS: (keyof Order)[] = [
  'estimatedDateReady',
  'invoiceNumber',
  'transferAmount',
  'shippingDateToAgent',
  'shippingDateToSaudi',
  'arrivalDate',
  'notes'
];

// Additional item-level fields that vendors can edit
export const VENDOR_EDITABLE_ITEM_FIELDS = [
  'itemPriceApprovalRejectionReason',
  'itemNotes',
  'itemEstimatedDateReady'
];


export const MOCK_ORDERS: Order[] = [
  { id: 'o1', itemNumber: '68263724', productName: 'Gear Assembly', quantity: 100, price: 16, confirmFormShehab: 'Dec 20th', estimatedDateReady: '', invoiceNumber: '', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o2', itemNumber: '4596198', productName: 'Brake Pad Set', quantity: 200, price: 12, confirmFormShehab: 'Dec 20th', estimatedDateReady: '', invoiceNumber: '', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o3', itemNumber: '04891720AA', productName: 'Oil Filter', quantity: 300, price: 13, confirmFormShehab: 'Dec 20th', estimatedDateReady: '', invoiceNumber: '', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o4', itemNumber: '4782684AB', productName: 'Control Arm', quantity: 400, price: 2.5, confirmFormShehab: 'Dec 20th', estimatedDateReady: '', invoiceNumber: '', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o5', itemNumber: '4782683AB', productName: 'Tie Rod End', quantity: 400, price: 2.5, confirmFormShehab: 'Dec 20th', estimatedDateReady: '', invoiceNumber: '', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o6', itemNumber: '68240575AB', productName: 'Wheel Hub (Iron)', quantity: 100, price: 50, confirmFormShehab: 'Dec 14th', estimatedDateReady: 'Jan 10th', invoiceNumber: 'MS002', transferAmount: 5000, shippingDateToAgent: 'Jan 15th', shippingDateToSaudi: 'Jan 20th', arrivalDate: 'Feb 1st', notes: 'Urgent' },
  { id: 'o7', itemNumber: '68240575AB', productName: 'Wheel Hub (Aluminum)', quantity: 100, price: 70, confirmFormShehab: 'Dec 14th', estimatedDateReady: 'Jan 12th', invoiceNumber: 'MS002', transferAmount: 7000, shippingDateToAgent: 'Jan 18th', shippingDateToSaudi: 'Jan 22nd', arrivalDate: 'Feb 5th', notes: '' },
  { id: 'o8', itemNumber: '68240574AB', productName: 'Shock Absorber (Iron)', quantity: 100, price: 50, confirmFormShehab: 'Dec 14th', estimatedDateReady: '', invoiceNumber: 'MS002', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o9', itemNumber: '68240574AB', productName: 'Shock Absorber (Aluminum)', quantity: 100, price: 70, confirmFormShehab: 'Dec 14th', estimatedDateReady: '', invoiceNumber: 'MS002', transferAmount: null, shippingDateToAgent: '', shippingDateToSaudi: '', arrivalDate: '', notes: '' },
  { id: 'o10', itemNumber: '4895235AA', productName: 'Radiator', quantity: 200, price: 20, confirmFormShehab: 'Nov 08', estimatedDateReady: 'Dec 1st', invoiceNumber: 'MS002', transferAmount: 4000, shippingDateToAgent: 'Dec 5th', shippingDateToSaudi: 'Dec 10th', arrivalDate: 'Dec 25th', notes: 'Holiday shipping' },
  { id: 'o11', itemNumber: '68263724', productName: 'Gear Assembly', quantity: 50, price: 15.5, confirmFormShehab: 'Nov 1st', estimatedDateReady: 'Nov 15th', invoiceNumber: 'MS001', transferAmount: 775, shippingDateToAgent: 'Nov 20th', shippingDateToSaudi: 'Nov 25th', arrivalDate: 'Dec 10th', notes: 'Previous order' },
  { id: 'o12', itemNumber: '4596198', productName: 'Brake Pad Set', quantity: 150, price: 11.5, confirmFormShehab: 'Oct 15th', estimatedDateReady: 'Nov 1st', invoiceNumber: 'MS000', transferAmount: 1725, shippingDateToAgent: 'Nov 5th', shippingDateToSaudi: 'Nov 10th', arrivalDate: 'Nov 25th', notes: '' },
  ...Array.from({ length: 17 }, (_, i) => ({
    id: `o${13 + i}`,
    itemNumber: `NEWITEM${100 + i}`,
    productName: `New Product ${1 + i}`,
    quantity: 10 * (i + 1),
    price: 5 * (i + 1),
    confirmFormShehab: 'Jan 1st',
    estimatedDateReady: '',
    invoiceNumber: '',
    transferAmount: null,
    shippingDateToAgent: '',
    shippingDateToSaudi: '',
    arrivalDate: '',
    notes: '',
  }))
];