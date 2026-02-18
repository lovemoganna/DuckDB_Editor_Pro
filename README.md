<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DuckDB Manager Pro

A comprehensive DuckDB SQL editor with AI-powered features including automatic schema generation, SQL assistance, and advanced data management capabilities.

## Features

### 🦆 Core DuckDB Features
- **In-Memory Database**: Full DuckDB WASM integration
- **SQL Editor**: Syntax-highlighted SQL editor with execution
- **Data Management**: Import/export CSV, JSON, and other formats
- **Table Operations**: Create, modify, and manage tables
- **Query History**: Save and manage your SQL queries
- **Audit Logging**: Track all database operations

### 🤖 AI-Powered Features
- **SQL Generation**: Natural language to SQL conversion
- **SQL Error Fixing**: Automatic SQL query correction
- **Schema Generation**: AI-powered schema inference from CSV data
- **Smart Suggestions**: Context-aware SQL completions

### 📊 Advanced Analytics
- **Data Visualization**: Charts and graphs for query results
- **Data Profiling**: Column statistics and data insights
- **Pivot Tables**: Advanced data pivoting capabilities
- **Export Options**: Multiple export formats

## Run Locally

**Prerequisites:** Node.js (v16+ recommended)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Gemini API Key:**

   **Option A: Environment Variable (recommended for development)**
   ```bash
   # Create .env.local file
   echo "VITE_API_KEY=your_gemini_api_key_here" > .env.local
   ```

   **Option B: In-App Configuration (recommended for users)**
   - Launch the app
   - Click ⚙️ Settings in the sidebar
   - Enter your Gemini API key in the "AI Configuration" section
   - Click "💾 Save Key"

   Get your API key from: https://aistudio.google.com/app/apikey

3. **Run the application:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000`

## Usage

### Getting Started
1. **Import Data**: Use the "Import Data" feature to load CSV files
2. **AI Schema Generation**: Switch to the "🤖 AI Schema" tab to automatically generate table schemas from CSV data
3. **SQL Editor**: Write and execute SQL queries with AI assistance
4. **Dashboard**: View saved queries and create data visualizations

### AI Features
- **Natural Language Queries**: Describe what you want in plain English
- **Schema Inference**: Upload CSV files to automatically generate table structures
- **Error Correction**: Get help fixing SQL syntax errors
- **Code Completion**: Context-aware SQL suggestions

## Architecture

This application combines two powerful DuckDB tools:
- **DuckDB Editor**: Full-featured SQL editor with data management
- **DuckDB Schema Generator**: AI-powered schema inference and SQL lifecycle generation

All AI capabilities are unified under a single Gemini API integration for consistent performance and user experience.
