# E-Matrimonial Backend

This repository contains the backend services for the E-Matrimonial application. It is built with Node.js, Express, TypeScript, and Drizzle ORM for database interactions.

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

- Node.js (v18 or higher recommended)
- PostgreSQL database
- npm or yarn

### Environment Setup

Create a `.env` file in the root directory of the project and add the following environment variables:

```
DATABASE_URL="postgresql://user:password@host:port/database_name"
JWT_SECRET="your_jwt_secret_key"
SENDGRID_API_KEY="your_sendgrid_api_key"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin_password"
```

- `DATABASE_URL`: Connection string for your PostgreSQL database.
- `JWT_SECRET`: A secret key used for signing and verifying JSON Web Tokens.
- `SENDGRID_API_KEY`: Your API key for SendGrid, used for sending emails.
- `ADMIN_EMAIL`: Default email for the initial admin user.
- `ADMIN_PASSWORD`: Default password for the initial admin user.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/ematrimonial-backend.git
   cd ematrimonial-backend
   ```
2. Install dependencies:
   ```bash
   npm install
   # or yarn install
   ```

### Database Setup

This project uses Drizzle ORM for database management.

1. Generate Drizzle migrations (if schema changes):
   ```bash
   npm run db:generate
   ```
2. Apply migrations to your database:
   ```bash
   npm run db:migrate
   ```
   Alternatively, you can push the schema directly (use with caution in production):
   ```bash
   npm run db:push
   ```

3. Seed the database with initial data:
   ```bash
   npm run seed
   npm run seed:admin
   npm run seed:ui-texts
   ```

### Running the Application

- **Development Mode**: Runs the application with `ts-node` and watches for changes.
  ```bash
  npm run dev
  ```
- **Build and Start (Production)**: Compiles TypeScript to JavaScript and then runs the compiled code.
  ```bash
  npm run build
  npm run start
  ```

## 📂 Project Structure

The project follows a modular structure to keep concerns separated:

```
.
├── drizzle/                 # Drizzle ORM migrations and schema snapshots
│   ├── meta/                # Drizzle metadata
│   └── *.sql                # SQL migration files
├── src/                     # Source code
│   ├── db/                  # Database related files (schema, seeds, connection)
│   │   ├── adminSeed.ts
│   │   ├── index.ts         # Database connection and Drizzle client
│   │   ├── schema.ts        # Drizzle database schema definitions
│   │   ├── seed.ts
│   │   └── uiTextsSeed.ts
│   ├── middleware/          # Express middleware
│   │   └── adminAuth.ts     # Admin authentication middleware
│   ├── routes/              # API route definitions
│   │   ├── admin.ts
│   │   ├── adminManagement.ts
│   │   ├── email.ts
│   │   ├── otp.ts
│   │   ├── posts.ts
│   │   ├── uiTexts.ts
│   │   └── user.ts
│   ├── utils/               # Utility functions
│   │   ├── adminLogger.ts
│   │   └── sendEmail.ts     # Email sending utility (SendGrid)
│   └── index.ts             # Main application entry point
├── .env.example             # Example environment variables file
├── .gitignore               # Git ignore file
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── drizzle.config.ts        # Drizzle ORM configuration
```

## 📜 Available Scripts

In the project directory, you can run:

- `npm run dev`: Starts the application in development mode using `ts-node`.
- `npm run build`: Compiles the TypeScript source code into JavaScript in the `dist` directory.
- `npm run start`: Runs the compiled JavaScript application from the `dist` directory.
- `npm run seed`: Executes the main database seeding script.
- `npm run seed:admin`: Seeds the database with initial admin user data.
- `npm run seed:ui-texts`: Seeds the database with UI text data.
- `npm run db:generate`: Generates new Drizzle migrations based on schema changes.
- `npm run db:migrate`: Applies pending Drizzle migrations to the database.
- `npm run db:push`: Pushes the current Drizzle schema state to the database, creating or altering tables directly. Use with caution.