# CiliaMiner Next.js Setup Guide

This guide will help you set up the CiliaMiner Next.js application on your system.

## Prerequisites

Before you begin, you need to install Node.js and npm (Node Package Manager).

### Installing Node.js

#### Windows
1. **Download Node.js:**
   - Go to [https://nodejs.org/](https://nodejs.org/)
   - Download the LTS (Long Term Support) version
   - Choose the Windows Installer (.msi) for your system (32-bit or 64-bit)

2. **Install Node.js:**
   - Run the downloaded .msi file
   - Follow the installation wizard
   - Make sure to check "Add to PATH" during installation
   - Complete the installation

3. **Verify Installation:**
   - Open Command Prompt or PowerShell
   - Run: `node --version`
   - Run: `npm --version`
   - Both commands should return version numbers

#### macOS
1. **Using Homebrew (Recommended):**
   ```bash
   brew install node
   ```

2. **Or download from website:**
   - Go to [https://nodejs.org/](https://nodejs.org/)
   - Download the macOS installer (.pkg)
   - Run the installer

#### Linux (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install Node.js and npm
sudo apt install nodejs npm

# Verify installation
node --version
npm --version
```

#### Linux (CentOS/RHEL/Fedora)
```bash
# Install Node.js and npm
sudo dnf install nodejs npm

# Or for older versions:
sudo yum install nodejs npm

# Verify installation
node --version
npm --version
```

## Project Setup

Once Node.js is installed, follow these steps:

### 1. Navigate to Project Directory
```bash
cd ciliaminer-nextjs
```

### 2. Install Dependencies
```bash
npm install
```

This will install all required packages listed in `package.json`.

### 3. Start Development Server
```bash
npm run dev
```

The application will start at `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
```

This creates an optimized production build.

### 5. Export Static Site (for GitHub Pages)
```bash
npm run export
```

This creates a static export in the `out/` directory.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run export` - Export static site

## Troubleshooting

### Common Issues

#### "npm is not recognized"
- **Solution:** Node.js is not installed or not in PATH
- **Fix:** Reinstall Node.js and ensure "Add to PATH" is checked

#### "Permission denied" (Linux/macOS)
- **Solution:** Use sudo or fix npm permissions
- **Fix:** `sudo npm install` or `npm config set prefix ~/.npm-global`

#### Port 3000 already in use
- **Solution:** Change port or kill existing process
- **Fix:** `npm run dev -- -p 3001` or kill the process using port 3000

#### Build errors
- **Solution:** Clear cache and reinstall
- **Fix:** 
  ```bash
  rm -rf node_modules package-lock.json
  npm cache clean --force
  npm install
  ```

### Getting Help

If you encounter issues:

1. Check the error message carefully
2. Ensure Node.js version is 18+ (`node --version`)
3. Try clearing npm cache: `npm cache clean --force`
4. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
5. Check the [Next.js documentation](https://nextjs.org/docs)
6. Check the [Node.js documentation](https://nodejs.org/docs)

## Development Workflow

1. **Make Changes:** Edit files in `src/` directory
2. **See Changes:** Development server automatically reloads
3. **Test:** Visit `http://localhost:3000` in your browser
4. **Build:** Run `npm run build` to test production build
5. **Deploy:** Use `npm run export` for static hosting

## File Structure

```
ciliaminer-nextjs/
├── src/
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
│   ├── lib/                 # Utility functions
│   ├── types/               # TypeScript types
│   └── data/                # Data files
├── public/                  # Static assets
├── package.json             # Dependencies
├── next.config.js           # Next.js config
├── tailwind.config.js       # Tailwind CSS config
└── tsconfig.json            # TypeScript config
```

## Next Steps

After setup:

1. **Customize Data:** Replace mock data with your actual CSV data
2. **Add Features:** Extend the application with new functionality
3. **Style:** Modify colors and styling in `tailwind.config.js`
4. **Deploy:** Use `npm run export` for GitHub Pages or other static hosting

## Support

For technical support:
- Check the [Next.js documentation](https://nextjs.org/docs)
- Visit the [Node.js documentation](https://nodejs.org/docs)
- Create an issue in the project repository

## Version Requirements

- **Node.js:** 18.0.0 or higher
- **npm:** 8.0.0 or higher
- **Operating System:** Windows 10+, macOS 10.15+, or Linux

---

**Happy coding!** 🚀
