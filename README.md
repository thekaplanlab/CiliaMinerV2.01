# CiliaMiner Next.js

A modern, static web application for CiliaMiner - an integrated database for ciliopathy genes and ciliopathies. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Gene Search**: Search for ciliopathy-related genes with autocomplete
- **Ciliopathy Search**: Find diseases and their associated genes
- **Interactive Visualizations**: Charts and graphs for data analysis
- **Data Export**: Download search results in CSV or JSON format
- **Responsive Design**: Mobile-first approach with modern UI
- **Static Generation**: Perfect for GitHub Pages deployment

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Search**: Fuse.js for fuzzy searching
- **Data Processing**: Client-side CSV/JSON handling

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ciliaminer-nextjs
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
ciliaminer-nextjs/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── page.tsx        # Homepage
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   ├── Layout.tsx      # Main layout with navigation
│   │   ├── SearchComponents.tsx  # Search inputs and results
│   │   └── ChartComponents.tsx   # Charts and visualizations
│   ├── lib/               # Utility functions
│   │   ├── utils.ts       # General utilities
│   │   └── search.ts      # Search functionality
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # Main type definitions
│   └── data/              # Data files (CSV/JSON)
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── next.config.js         # Next.js configuration
└── tsconfig.json          # TypeScript configuration
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run export` - Export static site

### Adding New Pages

1. Create a new file in `src/app/` (e.g., `ciliopathy-classification/page.tsx`)
2. Export a default React component
3. Use the `Layout` component for consistent styling

### Adding New Components

1. Create a new file in `src/components/`
2. Export your component
3. Import and use in your pages

### Data Integration

To integrate your actual CSV data:

1. Convert CSV files to JSON format
2. Place in `src/data/` directory
3. Import and use in components
4. Replace mock data with real data

## Deployment

### GitHub Pages

1. Build the project:
```bash
npm run build
```

2. The static files will be in the `out/` directory
3. Push to GitHub and enable GitHub Pages
4. Set source to the `out/` directory

### Other Static Hosting

1. Build the project:
```bash
npm run build
```

2. Deploy the `out/` directory to your hosting provider

## Customization

### Colors

Update colors in `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      primary: '#FF4500',    // Main brand color
      secondary: '#74b3ce',  // Secondary color
      accent: '#bd552e',     // Accent color
    },
  },
},
```

### Styling

- Global styles: `src/app/globals.css`
- Component-specific styles: Use Tailwind classes
- Custom CSS: Add to `globals.css` with `@layer` directives

## Performance

- **Static Generation**: All pages are pre-rendered at build time
- **Code Splitting**: Automatic code splitting for optimal loading
- **Image Optimization**: Built-in Next.js image optimization
- **Bundle Analysis**: Use `@next/bundle-analyzer` for optimization

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills if needed)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the same license as the original CiliaMiner project.

## Support

For questions and support, please contact the Kaplan Lab or create an issue in the repository.

## Acknowledgments

- Original CiliaMiner team
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first CSS framework
- Recharts for the charting library
