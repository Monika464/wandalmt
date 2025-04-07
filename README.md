## 📦 E-commerce Backend API

This is a Node.js + TypeScript backend API for an e-commerce application.
The project provides user and admin authentication, resource management, product handling, and shopping cart features.

## 🚀 Features

    🔐 Authentication & Authorization
        Login and token-based auth for admin and users
        Route protection using middleware
        Logout and token revocation

    🛍 Product Management
        Create, update, delete, and fetch products
        Products can have multiple associated resources (images/videos)
        Products are assigned to categories or collections

    📂 Resource Management
        Upload and manage resources (image/video files) via cloud or B2
        Add/remove/update resources for each product

    🧺 Cart Functionality
        Add products to the user’s cart
        Modify quantity or remove items
        Clear entire cart

    📦 Database Operations
        Fetch product data, users, resources
        Admin view of all users and their data
        Populate references for nested documents

## 🛠 Tech Stack

- Node.js + Express

- TypeScript

- MongoDB + Mongoose

- JWT (JSON Web Tokens) for authentication

- Multer / B2 SDK for file uploads

- Postman for API testing

- Backblaze B2 for storing resources

## 📁 Folder Structure

```
├── src/
│ ├── models/ # Mongoose schemas
│ ├── routes/ # Route controllers
│ ├── middleware/ # Auth and other middleware
│ ├── utils/ # Utility functions
│ └── app.ts # App configuration
├── public/ # Static files (if any)
├── uploads/ # Temporarily stored uploads
├── package.json
└── tsconfig.json
```

## Run Locally

Clone the project

```
  git clone https://github.com/Monika464/wandalmt
  cd wandalmt
```

Install dependencies

```
  npm install
```

Configure your .env file

`PORT=3000`
`MONGODB_URL`
`JWT_SECRET`
`B2_APPLICATION_KEY`

Run the server

```
  npm run dev
```

### Prerequisites

Before you begin, make sure you have the following installed on your machine:

- **Node.js** (version >= 16.0.0)  
  Install from [Node.js official website](https://nodejs.org/).
- **npm** (Node Package Manager)  
  It comes installed with Node.js, but if needed, you can install it separately from [npm official website](https://www.npmjs.com/get-npm).
- **MongoDB** (for database management)  
  You can install it locally from [MongoDB official website](https://www.mongodb.com/try/download/community) or use a hosted solution like [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

- **Postman** (for API testing)  
  Download it from [Postman website](https://www.postman.com/downloads/).

Once these prerequisites are installed, you can proceed with setting up and running the project.

### Postman Collection for API Testing

To make it easier to test the API endpoints, a **Postman collection** is included. This collection contains pre-configured requests for:
[Postman Test Set](https://elements.getpostman.com/redirect?entityId=16542142-5a86d7a6-aef1-4cd7-b98e-5e26335f7c0e&entityType=collection)

###### Wandalmt e-commerce App © 2025 by MK
