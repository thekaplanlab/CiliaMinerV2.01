# CiliaMiner V2.01

CiliaMiner is an integrated database for ciliopathy genes and ciliopathies. This repository contains a static Next.js frontend and a FastAPI backend that share generated dataset files.

## Features

- **Gene Search**: Search for ciliopathy-related genes with autocomplete
- **Ciliopathy Search**: Find diseases and their associated genes
- **Interactive Visualizations**: Charts and graphs for data analysis
- **Data Export**: Download search results in CSV or JSON format
- **Responsive Design**: Mobile-first approach with modern UI
- **Static Generation**: Perfect for GitHub Pages deployment

## Tech Stack

- **Framework**: Next.js (App Router, static export)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Search**: Fuse.js for fuzzy searching
- **Backend API**: FastAPI (Python)
- **Data Processing**: Python ETL scripts to JSON datasets

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
CiliaMinerV2.01/
├── src/                    # Next.js frontend source
│   ├── app/                # App Router pages/layout
│   ├── components/         # UI components
│   ├── lib/                # Frontend utilities
│   ├── services/           # Frontend data services
│   └── types/              # TypeScript types
├── data/processed/         # Canonical generated JSON datasets
├── public/data/            # Frontend runtime JSON datasets
├── backend/                # FastAPI backend
│   ├── app/                # Routers, services, models, config
│   └── data/               # Backend runtime JSON datasets
├── scripts/                # Data conversion and helper scripts
├── package.json            # Frontend dependencies/scripts
└── README.md
```

## Data Flow

1. Update source workbook/CSV files.
2. Run conversion scripts in `scripts/` to regenerate canonical JSON in `data/processed`.
3. Scripts sync canonical JSON to:
   - `public/data` (frontend runtime)
   - `backend/data` (backend runtime)
4. Frontend reads via `/data/*.json`; backend reads via `backend/data`.

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

To update datasets:

1. Convert workbook/CSV files to JSON using scripts in `scripts/`
2. Canonical JSON is generated in `data/processed`
3. Scripts sync runtime copies to `public/data` and `backend/data`
4. Frontend fetches data from `/data`
5. Backend services load data from `backend/data`

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
