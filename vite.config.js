import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// V3 build optimization — split vendor deps into cacheable chunks so the
// main app bundle shrinks and browser cache wins survive deploys.
//
// Strategy:
//   - 'react'           : react + react-dom + react-router-dom (rarely changes)
//   - 'supabase'        : @supabase/supabase-js (rarely changes; large)
//   - 'radix'           : all @radix-ui/* primitives (rarely changes; medium)
//   - 'maps'            : react-simple-maps + topojson-client + us-atlas (only Dashboard)
//   - 'charts'          : recharts (only Profile / Library portfolio stats)
//   - 'motion'          : motion/react (used across most surfaces)
//   - everything else   : falls into the default index chunk (the actual app)
//
// Anthropic SDK is only imported by /api/* (server-side) so it doesn't
// land in any client bundle.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'react'
          if (id.includes('react-dom') || id.match(/[\\/]react[\\/]/)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('react-simple-maps') || id.includes('topojson') || id.includes('us-atlas') || id.includes('d3-')) return 'maps'
          if (id.includes('recharts')) return 'charts'
          if (id.includes('motion')) return 'motion'
        },
      },
    },
  },
})
