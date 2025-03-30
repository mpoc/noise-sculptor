# Noise Sculptor - Development Guidelines

## Project Overview
Noise Sculptor is an interactive web application that allows users to explore different "colors" of noise by manipulating audio filters. Users interact with a 2D pad where:
- X-axis controls filter type and cutoff frequency (left = LPF, right = HPF), with smooth crossfading between them
- Y-axis continuously crossfades between different filter slopes (-12dB/oct to -48dB/oct)
- The combination creates different noise "colors" and characters
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