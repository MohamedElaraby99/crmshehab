# CRM System Backend API

A comprehensive backend API for the CRM system built with Node.js, Express, and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based authentication for users and vendors
- **User Management**: Admin, supplier, and vendor user roles
- **Supplier Management**: CRUD operations for suppliers
- **Vendor Management**: CRUD operations for vendors with auto-generated credentials
- **Product Management**: Complete product catalog with search and filtering
- **Order Management**: Order processing and tracking
- **Purchase History**: Detailed product purchase tracking
- **Data Validation**: Comprehensive input validation using express-validator
- **Error Handling**: Centralized error handling middleware
- **Security**: Helmet for security headers, CORS configuration
- **Database**: MongoDB with Mongoose ODM

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/vendor-login` - Vendor login
- `GET /api/auth/me` - Get current user
- `GET /api/auth/vendor-me` - Get current vendor
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user (Admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `GET /api/suppliers/:id` - Get supplier by ID
- `POST /api/suppliers` - Create supplier (Admin only)
- `PUT /api/suppliers/:id` - Update supplier (Admin only)
- `DELETE /api/suppliers/:id` - Delete supplier (Admin only)

### Vendors
- `GET /api/vendors` - Get all vendors
- `GET /api/vendors/:id` - Get vendor by ID
- `POST /api/vendors` - Create vendor (Admin only)
- `PUT /api/vendors/:id` - Update vendor (Admin only)
- `PUT /api/vendors/vendor/:id` - Update vendor profile (Vendor only)
- `DELETE /api/vendors/:id` - Delete vendor (Admin only)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/:id/purchases` - Get product purchase history
- `GET /api/products/:id/statistics` - Get product statistics
- `POST /api/products` - Create product (Admin only)
- `PUT /api/products/:id` - Update product (Admin only)
- `DELETE /api/products/:id` - Delete product (Admin only)

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders/vendor/:vendorId` - Get vendor orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Product Purchases
- `GET /api/product-purchases` - Get all product purchases
- `GET /api/product-purchases/:id` - Get product purchase by ID
- `GET /api/product-purchases/statistics/overview` - Get purchase statistics
- `POST /api/product-purchases` - Create product purchase
- `PUT /api/product-purchases/:id` - Update product purchase
- `DELETE /api/product-purchases/:id` - Delete product purchase

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

3. Start MongoDB (if running locally):
```bash
mongod
```

4. Run the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

- `PORT`: Server port (default: 4031)
- `NODE_ENV`: Environment (development/production)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT secret key
- `FRONTEND_URL`: Frontend URL for CORS

## Database Models

### User
- Authentication and authorization
- Role-based access control
- Password hashing with bcrypt

### Supplier
- Business information
- Contact details
- Status management

### Vendor
- Business information
- Auto-generated credentials
- Linked to User model

### Product
- Product catalog
- Inventory management
- Category and pricing

### Order
- Order processing
- Multi-item support
- Status tracking

### ProductPurchase
- Purchase history tracking
- Vendor and product relationships
- Financial data

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- Role-based access control

## Error Handling

- Centralized error handling middleware
- Validation error responses
- Proper HTTP status codes
- Detailed error logging

## Development

- Nodemon for auto-restart
- Morgan for request logging
- Comprehensive error handling
- Input validation
- Database indexing for performance

## Production Considerations

- Environment variable configuration
- Database connection pooling
- Error logging and monitoring
- Security headers
- CORS configuration
- Input validation
- Rate limiting (recommended)
