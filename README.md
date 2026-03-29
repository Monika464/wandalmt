## 📁 Backend README (Monika464/wandalmt)

`````markdown
# ⚙️ Wandalmt Backend API

RESTful API for e-commerce platform built with Node.js, Express, and TypeScript.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21.2-000000?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.13.2-47A248?logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## ✨ Features

- 🔐 **Authentication** - JWT-based auth with bcrypt password hashing
- 👥 **User Management** - Registration, login, profile management
- 🛍️ **Product Management** - CRUD operations for products
- 🖼️ **File Upload** - AWS S3 integration with Multer
- 🛒 **Shopping Cart** - Persistent cart management
- 💳 **Payment Processing** - Stripe integration
- 📧 **Email Notifications** - Mailgun for transactional emails
- 🛡️ **Security** - Input validation, rate limiting, CORS
- 📊 **Database** - MongoDB with Mongoose ODM

## 🛠 Tech Stack

| Technology         | Purpose              |
| ------------------ | -------------------- |
| Node.js            | JavaScript runtime   |
| Express.js         | Web framework        |
| TypeScript         | Type safety          |
| MongoDB + Mongoose | Database             |
| JWT + bcryptjs     | Authentication       |
| AWS S3             | File storage         |
| Stripe             | Payment processing   |
| Mailgun            | Email service        |
| Multer             | File upload handling |
| Sharp              | Image optimization   |

## 📁 Folder Structure

wandalmt/
├── src/
│ ├── models/ # Mongoose schemas
│ │ ├── User.ts
│ │ ├── Product.ts
│ │ ├── Resource.ts
│ │ ├── Cart.ts
│ │ └── Order.ts
│ ├── controllers/ # Business logic
│ │ ├── authController.ts
│ │ ├── productController.ts
│ │ ├── cartController.ts
│ │ └── paymentController.ts
│ ├── routes/ # API endpoints
│ │ ├── auth.ts
│ │ ├── products.ts
│ │ ├── cart.ts
│ │ └── payment.ts
│ ├── middleware/ # Auth & validation
│ │ ├── auth.ts
│ │ ├── admin.ts
│ │ └── validation.ts
│ ├── services/ # External services
│ │ ├── s3Service.ts
│ │ ├── stripeService.ts
│ │ └── emailService.ts
│ ├── utils/ # Helpers
│ │ ├── logger.ts
│ │ └── errorHandler.ts
│ ├── config/ # Configuration
│ │ ├── database.ts
│ │ └── aws.ts
│ ├── types/ # TypeScript types
│ └── app.ts # App configuration
├── uploads/ # Temporary uploads
├── .env.example # Environment variables example
├── package.json
├── tsconfig.json
└── README.md
text

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** (local or Atlas)
- **AWS Account** (for S3 storage)
- **Stripe Account** (for payments)
- **Mailgun Account** (for emails)

### Installation

1. **Clone the repository:**

````bash
git clone https://github.com/Monika464/wandalmt
cd wandalmt

    Install dependencies:

bash

npm install

    Configure environment variables:

bash

cp .env.example .env

Edit .env with your credentials:
env

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/wandalmt

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_EXPIRES_IN=7d

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=eu-central-1
AWS_S3_BUCKET=your_bucket_name

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Mailgun
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

    Start the server:

bash

# Development
npm run dev

# Production
npm run build
npm start

# Available Scripts

Command	Description
|-------------------|
| npm run dev |	Start development server with hot reload |
| npm run build |	Build for production |
| npm start |	Start production server |
| npm test |	Run tests |
| npm run test:coverage	| Run tests with coverage
| npm run lint |	Run ESLint

📡 API Endpoints

Authentication
Method	Endpoint	Description
POST	/api/auth/register	Register new user
POST	/api/auth/login	Login user
POST	/api/auth/logout	Logout user
GET	/api/auth/me	Get current user

Products
Method	Endpoint	Description
GET	/api/products	Get all products
GET	/api/products/:id	Get single product
POST	/api/products	Create product (admin)
PUT	/api/products/:id	Update product (admin)
DELETE	/api/products/:id	Delete product (admin)

Cart
Method	Endpoint	Description
GET	/api/cart	Get user cart
POST	/api/cart	Add item to cart
PUT	/api/cart/:itemId	Update cart item
DELETE	/api/cart/:itemId	Remove from cart
DELETE	/api/cart	Clear cart

Payments
Method	Endpoint	Description
POST	/api/payment/create-payment-intent	Create Stripe payment intent
POST	/api/payment/webhook	Stripe webhook handler

Resources
Method	Endpoint	Description
POST	/api/upload	Upload file to S3
DELETE	/api/resources/:id	Delete resource

🧪 Testing

```bash
# Run all tests
npm test
```

# Run tests with coverage

npm run test:coverage

📦 API Documentation

https://run.pstmn.io/button.svg
Postman Collection

Import the Postman collection from docs/Wandalmt.postman_collection.json
🔗 Related Repositories

    Frontend Application: Wandalmt Frontend

    Live Demo: https://club.boxingonline.eu

📄 License

ISC © 2026 Monika K.

🤝 Contributing

    Fork the repository

    Create your feature branch (git checkout -b feature/amazing)

    Commit your changes (git commit -m 'Add amazing feature')

    Push to the branch (git push origin feature/amazing)

    Open a Pull Request

📧 Support

For issues or questions, please open an issue on GitHub.
````
`````
