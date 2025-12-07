# VeemahPay

![VeemahPay](https://img.shields.io/badge/VeemahPay-Digital%20Banking-blue?style=for-the-badge&logo=bank)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Active-success?style=for-the-badge)

**VeemahPay** is a modern, secure, and user-friendly digital banking platform designed to simplify financial management. It serves as our final project for **Object Oriented Programming (OOP)** for the 2nd Year, 1st Semester.

---

## 🏫 Project Details

- **Course:** Bachelor of Science in Computer Science (BSCS)
- **Year & Section:** BSCS 2-2
- **Subject:** Object Oriented Programming (OOP)
- **Instructor:** Sir Renz Angelo Cadaoas
- **Date:** December 8, 2024

---

## 👥 Group 4 Members

| Name | Role |
| :--- | :--- |
| **MAGALONA, Adriel M.** | Lead Developer / Full Stack |
| **INSO, Eliazar N.** | Member |
| **JAMISON, Hanzlei** | Member |
| **OLIVEROS, Mariel** | Member |
| **PUTI, Jude Vincent F.** | Member |
| **RODRIGUEZ, Jan Earl F.** | Member |
| **SEVILLA, Mark Elijah R.** | Member |

---

## 🛠 Tech Stack

We utilized a robust and modern technology stack to build VeemahPay, ensuring scalability, security, and performance.

### **Frontend**
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

### **Backend**
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=java&logoColor=white) (Core OOP Logic)

### **Tools & DevOps**
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![VS Code](https://img.shields.io/badge/VS_Code-0078D4?style=for-the-badge&logo=visual-studio-code&logoColor=white)

---

## 🚀 Key Features & CRUD Functionalities

VeemahPay implements full **CRUD (Create, Read, Update, Delete)** operations to manage users, accounts, and transactions effectively.

### **Create**
- **User Registration:** New users can sign up and create a bank account with an initial balance and PIN.
- **Transaction Creation:** Users can initiate deposits, withdrawals, and fund transfers.

### **Read**
- **Dashboard:** View real-time account balance, status, and recent activity.
- **Transaction History:** Access a detailed log of all past transactions with filtering and search capabilities.
- **Admin Panel:** Admins can view all user accounts and system-wide transaction logs.

### **Update**
- **Profile Management:** Users can update their personal information (future scope).
- **Account Status:** Admins can lock or unlock user accounts based on security protocols (e.g., failed login attempts).
- **Transaction Notes:** Users can add or edit notes for their transactions for better tracking.

### **Delete**
- **Account Deletion:** Admins have the privilege to delete accounts that are no longer needed (soft or hard delete depending on policy).
- **Void Transactions:** Admins can void erroneous transactions, effectively reversing them.

---

## ☕ Java OOP Pillars Implementation

Our project strictly adheres to the four fundamental pillars of Object-Oriented Programming (OOP) to ensure code modularity, reusability, and security.

### 1. **Encapsulation**
- **Data Hiding:** Sensitive data like account balances and PINs are private attributes within the `Account` class.
- **Access Control:** Public getter and setter methods are used to access and modify these attributes, ensuring that valid data is always maintained (e.g., preventing negative balances).

### 2. **Inheritance**
- **Code Reusability:** We use a base `User` class that contains common attributes (name, email, ID). Specific roles like `Customer` and `Admin` inherit from `User`, extending its functionality without rewriting code.
- **Hierarchical Structure:** Specialized account types (e.g., `SavingsAccount`, `CheckingAccount`) inherit from a generic `BankAccount` class.

### 3. **Polymorphism**
- **Method Overriding:** Subclasses provide specific implementations for methods defined in the parent class. For example, the `calculateInterest()` method behaves differently for `SavingsAccount` versus `CheckingAccount`.
- **Method Overloading:** We use overloaded constructors and methods to allow flexibility in how objects are created and how operations (like `deposit`) are performed.

### 4. **Abstraction**
- **Simplifying Complexity:** We use abstract classes and interfaces (e.g., `TransactionInterface`) to define the contract for what a transaction must do (execute, validate), hiding the complex implementation details from the main application logic.
- **Focus on What, Not How:** The main system interacts with high-level objects without needing to know the low-level database operations.

---

## 🏁 Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/adr1el-m/banksy.git
    cd banksy
    ```

2.  **Set up Environment Variables:**
    ```bash
    cp .env.example .env.local
    ```

3.  **Start Database (Docker):**
    ```bash
    npm run db:up
    ```

4.  **Install Dependencies:**
    ```bash
    npm install
    ```

5.  **Run the Application:**
    ```bash
    npm run dev
    ```

6.  **Access the App:**
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Default Accounts

| Role | Account Number | PIN | Status |
| :--- | :--- | :--- | :--- |
| **Admin** | `0000` | `0000` | Active |
| **User** | `12345` | `1111` | Active |
| **User** | `23456` | `2222` | Active |
| **User** | `56789` | `5555` | Locked |

---

Made with ❤️ by **Group 4 (BSCS 2-2)**.
