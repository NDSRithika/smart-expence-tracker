# Ledger - Personal Capital & Expense Tracker

A professional, full-stack Expense Tracker web application built using **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4**, and **Node.js with Express**.

This application implements a complete, lightweight, and modern full-stack system matching the requested architecture, optimized for high-performance Node.js environments.

---

## 🚀 Key Features

*   **Financial Dashboard**: Track total spending, monthly spending, and budget utilization in real-time.
*   **Complete CRUD Management**: Easily add, edit, and delete transactions with immediate interface updates.
*   **Budget Progress Monitor**: Beautiful progress bar showing utilization percentages with adaptive warning alerts (green, warning orange, or over-budget red).
*   **Search & Filter Engine**:
    *   Full-text search across expense titles and descriptions.
    *   Fast filter pills for categories (Food, Travel, Shopping, Bills, Medical, Education, Entertainment, Other).
    *   Dynamic Month-Year selector that scans historical entries automatically.
*   **Interactive Analytics (via Recharts)**:
    *   **Category Breakdown**: Interactive donut chart with beautiful custom colors matching category badges.
    *   **Monthly Expense Trend**: Area chart showing daily cumulative spending against the budget limit.
    *   **Monthly Comparison**: Grouped vertical bar chart highlighting the current month's totals.
*   **Modern Design Elements**:
    *   Dark and Light modes with seamless transitions.
    *   Desktop-responsive data grids and mobile-optimized card layouts.
    *   Smooth entry and exit animations using `motion/react`.
    *   Responsive form validation with instant feedback.
*   **Lightweight Persistence**: A robust backend database storing entries securely inside a local `expenses.json` file.

---

## 📁 Project Architecture & Files

*   **`server.ts`** *(Equivalent to app.py)*:
    *   Launches the Express server on Port 3000.
    *   Operates raw CRUD routes (`/api/expenses`, `/api/budget`).
    *   Performs secure read/write routines on the database and populates high-fidelity mock data on first launch.
    *   Integrates Vite dev middlewares for ultra-fast compilation.
*   **`src/App.tsx`**:
    *   Handles top-level client state (active month, theme, modals, and synchronizing actions).
    *   Synchronizes server data with custom React fetch handlers.
*   **`src/types.ts`**:
    *   Defines unified TypeScript interfaces (`Expense`, `CategoryType`, `BudgetData`) ensuring strict type-safety.
*   **`src/components/`**:
    *   `ExpenseStats.tsx`: Formulates visual cards for total spending, current month spending, and the budget progress bar.
    *   `ExpenseCharts.tsx`: Implements Category-wise Pie, Cumulative Line/Area, and Month Bar charts with responsive containers.
    *   `ExpenseList.tsx`: Handles searching, category filtering, sorting, month dropdown selection, pagination, and desktop table vs. mobile list layouts.
    *   `ExpenseModal.tsx`: Validates form fields (title, amount, date, category) using robust JavaScript validations before posting.
    *   `BudgetModal.tsx`: Provides the input portal to adjust the budget.
    *   `ExpenseCategoryBadge.tsx`: Associates eye-safe colors and Lucide icons with categories.
*   **`src/index.css`**:
    *   Imports modern **Inter** and **Space Grotesk** google fonts.
    *   Declares the custom `@theme` properties for Tailwind CSS v4.
*   **`package.json`** *(Equivalent to requirements.txt)*:
    *   Manages libraries and deployment scripts.

---

## 🔧 Installation & Local Setup

To run this project locally, ensure you have **Node.js (v18 or higher)** installed.

### 1. Extract and Install Dependencies
Navigate to the root directory and install npm packages:
```bash
npm install
```

### 2. Launch Development Server
Start the full-stack server locally:
```bash
npm run dev
```
The application will boot, and you can open it in your browser at `http://localhost:3000`.

### 3. Production Build
To build and compile the application for production distribution:
```bash
npm run build
```
This command bundles the React assets under `dist/` and bundles `server.ts` into a self-contained Node file `dist/server.cjs` using `esbuild` for ultra-fast startup and complete compatibility.

### 4. Production Start
Launch the production server:
```bash
npm run start
```
