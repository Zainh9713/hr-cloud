<div align="center">
  <img src="https://img.shields.io/badge/NEXT.JS-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer" />

  <h1 align="center">⚡ H&R CLOUD (Sys_Core v4.0) ⚡</h1>
  <p align="center"><strong>A Next-Gen, Cyberpunk-Themed Encrypted Cloud Storage Platform</strong></p>
</div>

---

## 🌌 Overview
**H&R Cloud** is a highly advanced, full-stack cloud storage application inspired by Google Drive, but built with a breathtaking **Cyberpunk and Glassmorphism** aesthetic. Designed for the digital frontier, it provides users with a secure portal to upload, manage, and encrypt their files.

This project was built to demonstrate advanced full-stack capabilities, integrating a sleek frontend (Next.js 16 App Router, Framer Motion) with a robust custom backend (MongoDB, JWT Authentication, Node.js filesystem APIs) and futuristic AI mocks.

## ✨ Key Features

### 📂 Core Drive Capabilities
- **Real Local File Storage**: Files are physically saved to a secure `/uploads` directory using Node.js `fs.promises` and `FormData` (No third-party SaaS dependency).
- **Advanced File Manager Grid**: Full support for infinite nested folders, breadcrumb navigation, and grid rendering.
- **Cinematic File Previews**: A framer-motion powered glassmorphic modal allows users to natively preview Images, PDFs, and Code/Text files without downloading.
- **Zero-Reload Context Menus**: Securely Rename, Download, or Delete files using a 3-dot dropdown menu. State updates optimistically.
- **Dynamic Storage Tracking**: Real-time aggregation of physical file sizes dynamically visualized via a Recharts Pie Chart.

### 🤖 Futuristic AI Capabilities
- **AI File Summarizer**: When viewing a text document, trigger the neural net to scan the text and generate a Cyberpunk-styled summary.
- **AI Storage Optimizer**: A dedicated dashboard module that scans your storage network and surfaces actionable suggestions (e.g., "Delete Duplicates", "Archive Stale Data").
- **AI Smart Search**: A glowing semantic search bar with neon pulsing animations.

---

## 🛠️ Tech Stack
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/) & Vanilla CSS (Glassmorphism & Neon Shadows)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Database**: [MongoDB](https://www.mongodb.com/) via Mongoose
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` and `httpOnly` Edge Cookies.
- **Icons & Charts**: [Lucide React](https://lucide.dev/) & [Recharts](https://recharts.org/)

---

## 🚀 Architecture Deep-Dive (For Examiners)

### 1. Local File System Integration (`/uploads`)
Unlike basic tutorials that use Base64 strings or AWS S3, this application physically stores binary files on the server running the app. 
When a file is uploaded via the **Drag & Drop Zone**, the Next.js API Route (`/api/files/route.ts`) parses the `FormData`. It extracts the `File` object, converts it to an ArrayBuffer, and writes it directly to the root `uploads/` folder using Node's `fs.promises.writeFile`. 
A unique `crypto` hex string is appended to the filename to prevent collisions. A reference object containing the file size, MIME type, and path is then securely saved to **MongoDB** to link it to the user.

### 2. Mock AI APIs
To ensure the architecture is production-ready for real LLMs (like OpenAI or Anthropic), the AI features are driven by robust Next.js REST endpoints (`/api/ai/summarize` and `/api/ai/optimize`). 
Currently, these endpoints utilize `setTimeout` promises to simulate realistic neural network processing delays (1.5s - 2.5s) before returning heuristic-based responses. This demonstrates API consumption, asynchronous state management, and loading UI handles perfectly.

---

## 💻 Local Setup & Installation

Follow these steps to deploy H&R Cloud on your local machine:

### 1. Clone the repository & Install Dependencies
```bash
git clone <repository-url>
cd hr-cloud
npm install
```

### 2. Configure Environment Variables
Create a `.env` or `.env.local` file in the root of your project and add the following keys:
```env
# MongoDB Connection String (Replace with your actual MongoDB URI)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/hrcloud

# JSON Web Token Secret (Used for encrypting sessions)
JWT_SECRET=super_secret_cyberpunk_key_2026
```

### 3. Initialize the Core Server
Start the Next.js development server:
```bash
npm run dev
```

### 4. Access the Grid
Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

1. Click **INITIALIZE** to register a new Agent account.
2. Login to access your command center.
3. Begin dragging and dropping files into the network!

---
*Built with passion for the digital frontier.*
