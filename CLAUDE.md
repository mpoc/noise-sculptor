# Noise Sculptor - Development Guidelines

## Project Overview
Noise Sculptor is an interactive web application that allows users to explore different "colors" of noise by manipulating audio filters. Users interact with a 2D pad where:
- X-axis controls the lowpass filter frequency (100-15000 Hz logarithmically)
- Y-axis controls the highpass filter frequency (32-10000 Hz logarithmically)
- The combination creates different noise "colors" (Brown, Pink, White, Blue, Green)
- Visual feedback includes a live waveform display and filter response visualization

The app uses Web Audio API via Tone.js to generate and shape noise in real-time, with an intuitive touch/mouse interface.

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript and Vite build)
- `npm run lint` - Run ESLint on all files
- `npm run preview` - Preview production build locally

## Code Style
- **TypeScript**: Use strict mode with proper type annotations
- **React**: Use functional components with hooks
- **Imports**: Group React imports first, then libraries, then local modules
- **Naming**: 
  - Components: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPERCASE
- **Formatting**: Use 2-space indentation
- **Error handling**: Use try/catch for async operations, provide meaningful error messages
- **CSS**: Use Tailwind CSS classes
- **Avoid**:
  - Unused variables/parameters
  - Side effects in imports
  - Fallthrough cases in switch statements
  
## Best Practices
- Use React.StrictMode
- Proper cleanup in useEffect hooks (especially for audio and animation)
- Handle both mouse and touch events for cross-device compatibility
- Prevent default browser behavior for touch events when needed
- Use requestAnimationFrame for smooth visualizations
- Implement responsive design using Tailwind classes