import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

import { Button } from './components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/ui/collapsible';
import { Slider } from './components/ui/slider';

const NoisePad = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  // Initialize position from localStorage or default to center
  const [position, setPosition] = useState(() => {
    const savedPosition = localStorage.getItem('noisePosition');
    return savedPosition ? JSON.parse(savedPosition) : { x: 50, y: 50 };
  });
  const [filterValues, setFilterValues] = useState({
    frequency: 1000,
    type: "lowpass",
    rolloff: -24,
    crossfadePosition: 0.5, // 0-1 value for rolloff crossfade visualization
    filterBlend: 0.5, // 0-1 value for LPF/HPF blend
    resonance: 1 // Default Q value (no resonance)
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<Tone.Noise | null>(null);

  // LPF filters with different rolloffs
  const filter12Ref = useRef<Tone.Filter | null>(null);
  const filter24Ref = useRef<Tone.Filter | null>(null);
  const filter48Ref = useRef<Tone.Filter | null>(null);

  // HPF filters with different rolloffs
  const hpf12Ref = useRef<Tone.Filter | null>(null);
  const hpf24Ref = useRef<Tone.Filter | null>(null);
  const hpf48Ref = useRef<Tone.Filter | null>(null);

  // Filter type crossfaders (LPF <-> HPF)
  const xf12Ref = useRef<Tone.CrossFade | null>(null);
  const xf24Ref = useRef<Tone.CrossFade | null>(null);
  const xf48Ref = useRef<Tone.CrossFade | null>(null);

  // Rolloff crossfaders
  const crossfade12_24Ref = useRef<Tone.CrossFade | null>(null);
  const crossfade24_48Ref = useRef<Tone.CrossFade | null>(null);
  const masterCrossfadeRef = useRef<Tone.CrossFade | null>(null);

  const analyserRef = useRef<Tone.Analyser | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Initialize audio components
  useEffect(() => {
    // Create noise source
    noiseRef.current = new Tone.Noise("white");
    noiseRef.current.volume.value = -15;

    // Create LPF filters with different rolloffs
    filter12Ref.current = new Tone.Filter({
      frequency: 20000,
      type: "lowpass",
      rolloff: -12,
      Q: 1
    });

    filter24Ref.current = new Tone.Filter({
      frequency: 20000,
      type: "lowpass",
      rolloff: -24,
      Q: 1
    });

    filter48Ref.current = new Tone.Filter({
      frequency: 20000,
      type: "lowpass",
      rolloff: -48,
      Q: 1
    });

    // Create HPF filters with different rolloffs
    hpf12Ref.current = new Tone.Filter({
      frequency: 20,
      type: "highpass",
      rolloff: -12,
      Q: 1
    });

    hpf24Ref.current = new Tone.Filter({
      frequency: 20,
      type: "highpass",
      rolloff: -24,
      Q: 1
    });

    hpf48Ref.current = new Tone.Filter({
      frequency: 20,
      type: "highpass",
      rolloff: -48,
      Q: 1
    });

    // Create crossfaders between the same rolloffs (LPF <-> HPF)
    xf12Ref.current = new Tone.CrossFade(0.5);
    xf24Ref.current = new Tone.CrossFade(0.5);
    xf48Ref.current = new Tone.CrossFade(0.5);

    // Create rolloff crossfaders
    crossfade12_24Ref.current = new Tone.CrossFade(0.5);
    crossfade24_48Ref.current = new Tone.CrossFade(0.5);
    masterCrossfadeRef.current = new Tone.CrossFade(0.5).toDestination();

    // Create an analyser node for visualization
    analyserRef.current = new Tone.Analyser("waveform", 256);

    // Connect everything
    // First fan out to all filters
    noiseRef.current.fan(
      filter12Ref.current, filter24Ref.current, filter48Ref.current,
      hpf12Ref.current, hpf24Ref.current, hpf48Ref.current
    );

    // Create crossfades between LPF and HPF for each rolloff
    filter12Ref.current.connect(xf12Ref.current.a);
    hpf12Ref.current.connect(xf12Ref.current.b);

    filter24Ref.current.connect(xf24Ref.current.a);
    hpf24Ref.current.connect(xf24Ref.current.b);

    filter48Ref.current.connect(xf48Ref.current.a);
    hpf48Ref.current.connect(xf48Ref.current.b);

    // Then crossfade between different rolloffs
    xf12Ref.current.connect(crossfade12_24Ref.current.a);
    xf24Ref.current.connect(crossfade12_24Ref.current.b);

    xf24Ref.current.connect(crossfade24_48Ref.current.a);
    xf48Ref.current.connect(crossfade24_48Ref.current.b);

    crossfade12_24Ref.current.connect(masterCrossfadeRef.current.a);
    crossfade24_48Ref.current.connect(masterCrossfadeRef.current.b);

    // Connect the analyser to the end of the chain
    masterCrossfadeRef.current.connect(analyserRef.current);

    return () => {
      // Clean up all audio nodes
      if (noiseRef.current) noiseRef.current.dispose();

      if (filter12Ref.current) filter12Ref.current.dispose();
      if (filter24Ref.current) filter24Ref.current.dispose();
      if (filter48Ref.current) filter48Ref.current.dispose();

      if (crossfade12_24Ref.current) crossfade12_24Ref.current.dispose();
      if (crossfade24_48Ref.current) crossfade24_48Ref.current.dispose();
      if (masterCrossfadeRef.current) masterCrossfadeRef.current.dispose();

      if (analyserRef.current) analyserRef.current.dispose();

      // Also dispose the other audio nodes
      if (hpf12Ref.current) hpf12Ref.current.dispose();
      if (hpf24Ref.current) hpf24Ref.current.dispose();
      if (hpf48Ref.current) hpf48Ref.current.dispose();

      if (xf12Ref.current) xf12Ref.current.dispose();
      if (xf24Ref.current) xf24Ref.current.dispose();
      if (xf48Ref.current) xf48Ref.current.dispose();

      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('noisePosition', JSON.stringify(position));
  }, [position]);

  // Update filter values when position changes
  useEffect(() => {
    if (!filter12Ref.current || !filter24Ref.current || !filter48Ref.current) return;
    if (!crossfade12_24Ref.current || !crossfade24_48Ref.current || !masterCrossfadeRef.current) return;

    // X-axis now controls a crossfade between LPF and HPF (0 = pure LPF, 100 = pure HPF)
    const normX = position.x / 100;

    // Create a smooth crossfade between the two filter types
    // Instead of a fixed mid-point, we'll use a crossfade area in the middle
    const filterBlend = Math.max(0, Math.min(1, (normX - 0.4) / 0.2)); // 0 at x<40%, 1 at x>60%, linear in between

    // Determine the display filter type (for visualization and display)
    let filterType;
    if (filterBlend < 0.1) {
      filterType = "lowpass";
    } else if (filterBlend > 0.9) {
      filterType = "highpass";
    } else {
      filterType = filterBlend < 0.5 ? "lowpass" : "highpass";
    }

    // Calculate frequencies for both filters based on X position
    // They move in opposite directions as the user moves the slider

    // LPF: freq decreases as you move left
    // At x=50%, LPF is at max frequency (minimal filtering)
    // At x=0%, LPF is at minimum frequency (heavy filtering)
    const lpfFactor = Math.max(0, 1 - normX * 2.0); // 0 at x>50%, 1 at x=0% - extends range further into middle
    const lpfFreq = lpfFactor > 0 ?
      Math.pow(10, 4.3 - (lpfFactor * 2.7)) : // 20kHz down to ~50Hz, steeper curve
      22000; // Effectively no filtering

    // HPF: freq increases as you move right
    // At x=50%, HPF is at min frequency (minimal filtering)
    // At x=100%, HPF is at maximum frequency (heavy filtering)
    const hpfFactor = Math.max(0, normX * 1.5 - 0.5); // 0 at x<33%, 1 at x=100%
    const hpfFreq = hpfFactor > 0 ?
      Math.pow(10, 1.5 + (hpfFactor * 3)) : // 32Hz up to ~3.2kHz (more aggressive range)
      20; // Effectively no filtering

    // For display purposes, pick the "active" frequency based on the blend
    const frequency = filterBlend < 0.5 ? lpfFreq : hpfFreq;

    // Y-axis controls filter slope/rolloff crossfading
    const normY = position.y / 100;

    // Calculate crossfade values based on Y position
    let rolloff = -12; // Default value for display
    let crossfadePosition = 0; // For visualization

    if (normY < 0.5) {
      // Top half: crossfade between -12 and -24 dB/oct
      crossfade12_24Ref.current.fade.value = normY * 2; // 0 to 1
      crossfade24_48Ref.current.fade.value = 0; // Fixed at first input
      masterCrossfadeRef.current.fade.value = 0; // Use the 12/24 crossfader

      // For display, calculate effective rolloff
      rolloff = -12 - (12 * normY * 2);
      crossfadePosition = normY * 2;
    } else {
      // Bottom half: crossfade between -24 and -48 dB/oct
      crossfade12_24Ref.current.fade.value = 1; // Fixed at second input
      crossfade24_48Ref.current.fade.value = (normY - 0.5) * 2; // 0 to 1
      masterCrossfadeRef.current.fade.value = 1; // Use the 24/48 crossfader

      // For display, calculate effective rolloff
      rolloff = -24 - (24 * (normY - 0.5) * 2);
      crossfadePosition = (normY - 0.5) * 2;
    }

    // Update all LPF filters
    [filter12Ref.current, filter24Ref.current, filter48Ref.current].forEach(filter => {
      if (filter) {
        filter.frequency.value = lpfFreq;
        filter.Q.value = filterValues.resonance;
      }
    });

    // Update all HPF filters
    [hpf12Ref.current, hpf24Ref.current, hpf48Ref.current].forEach(filter => {
      if (filter) {
        filter.frequency.value = hpfFreq;
        filter.Q.value = filterValues.resonance;
      }
    });

    // Update the LPF/HPF crossfade for each rolloff pair
    [xf12Ref.current, xf24Ref.current, xf48Ref.current].forEach(xf => {
      if (xf) {
        xf.fade.value = filterBlend;
      }
    });

    // Update state for display
    setFilterValues({
      frequency: Math.round(frequency),
      type: filterType,
      rolloff: Math.round(rolloff),
      crossfadePosition: crossfadePosition,
      filterBlend: filterBlend,
      resonance: filterValues.resonance
    });
  }, [position, filterValues.resonance]);

  // Draw waveform function
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Get waveform data
    const waveform = analyserRef.current.getValue();

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Use a consistent color for the waveform
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;

    // Begin drawing path
    ctx.beginPath();

    // Draw the waveform
    const typedWaveform = waveform as Float32Array;
    for (let i = 0; i < typedWaveform.length; i++) {
      const x = (i / typedWaveform.length) * width;
      // Convert Float32Array value to number
      const value = Number(typedWaveform[i]);
      const y = ((value + 1) / 2) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Stroke the path
    ctx.stroke();

    // Continue animation loop
    animationRef.current = requestAnimationFrame(drawWaveform);
  };

  // Start/stop animation when playing state changes
  useEffect(() => {
    if (isPlaying) {
      // Start animation loop when playing
      animationRef.current = requestAnimationFrame(drawWaveform);
    } else {
      // Stop animation loop when not playing
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Make sure canvas is properly sized
  useEffect(() => {
    if (canvasRef.current) {
      // Set canvas dimensions based on its display size
      const displayWidth = canvasRef.current.clientWidth;
      const displayHeight = canvasRef.current.clientHeight;

      // Set canvas internal dimensions to match display size
      canvasRef.current.width = displayWidth;
      canvasRef.current.height = displayHeight;
    }
  }, []);

  const togglePlay = async (e: React.MouseEvent) => {
    // Prevent event propagation so it doesn't trigger pad interaction
    e.stopPropagation();

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    if (isPlaying && noiseRef.current) {
      noiseRef.current.stop();
    } else if (noiseRef.current) {
      noiseRef.current.start();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle pad interaction (mouse/touch move)
  const handlePadMove = (e: MouseEvent | TouchEvent) => {
    // Only handle move if we're dragging
    if (!isDragging || !padRef.current) return;

    // Prevent default for touch events to avoid scrolling
    if (e.cancelable && e.type === 'touchmove') {
      e.preventDefault();
    }

    // Handle both mouse and touch events
    const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0]?.clientX);
    const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0]?.clientY);

    if (!clientX || !clientY) return;

    const rect = padRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setPosition({ x, y });
  };

  // Animation ref to cancel animation frames if needed
  const randomAnimRef = useRef<number | null>(null);

  // Generate random noise position with animation
  const generateRandomNoise = (e: React.MouseEvent) => {
    // Prevent event propagation so it doesn't trigger pad interaction
    e.stopPropagation();

    // Cancel any existing animation
    if (randomAnimRef.current) {
      cancelAnimationFrame(randomAnimRef.current);
    }

    // Generate random x and y positions
    const randomX = Math.random() * 100;
    const randomY = Math.random() * 100;

    // Start position
    const startX = position.x;
    const startY = position.y;

    // Animation settings
    const duration = 600; // ms
    const startTime = performance.now();

    // Animation function
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      // Calculate new position
      const newX = startX + (randomX - startX) * eased;
      const newY = startY + (randomY - startY) * eased;

      // Update position
      setPosition({ x: newX, y: newY });

      // Continue animation if not done
      if (progress < 1) {
        randomAnimRef.current = requestAnimationFrame(animate);
      } else {
        randomAnimRef.current = null;
      }
    };

    // Start animation
    randomAnimRef.current = requestAnimationFrame(animate);
  };

  // Reset to center position with animation
  const resetPosition = (e: React.MouseEvent) => {
    // Prevent event propagation
    e.stopPropagation();

    // Cancel any existing animation
    if (randomAnimRef.current) {
      cancelAnimationFrame(randomAnimRef.current);
    }

    // Default center position
    const defaultX = 50;
    const defaultY = 50;

    // Start position
    const startX = position.x;
    const startY = position.y;

    // Animation settings
    const duration = 600; // ms
    const startTime = performance.now();

    // Animation function
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      // Calculate new position
      const newX = startX + (defaultX - startX) * eased;
      const newY = startY + (defaultY - startY) * eased;

      // Update position
      setPosition({ x: newX, y: newY });

      // Continue animation if not done
      if (progress < 1) {
        randomAnimRef.current = requestAnimationFrame(animate);
      } else {
        randomAnimRef.current = null;
      }
    };

    // Start animation
    randomAnimRef.current = requestAnimationFrame(animate);
  };

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (randomAnimRef.current) {
        cancelAnimationFrame(randomAnimRef.current);
      }
    };
  }, []);

  // Handle pad click/touch
  const handlePadClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default actions
    if (e.cancelable) {
      e.preventDefault();
    }

    // Stop propagation to avoid conflicts
    e.stopPropagation();

    // Skip if not on the pad
    if (!padRef.current) return;

    // Get coordinates
    const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0]?.clientX);
    const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0]?.clientY);

    if (!clientX || !clientY) return;

    // Update position directly
    const rect = padRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setPosition({ x, y });
  };

  // Handle the start of interaction (mousedown/touchstart)
  const handlePadStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default
    if (e.cancelable) {
      e.preventDefault();
    }

    // Stop propagation
    e.stopPropagation();

    // Start by setting position
    handlePadClick(e);

    // Then set dragging state
    setIsDragging(true);
  };

  // Handle the end of interaction (mouseup/touchend)
  const handleInteractionEnd = () => {
    setIsDragging(false);
  };

  // Add/remove event listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => handlePadMove(e);
    const handleEnd = () => handleInteractionEnd();

    if (isDragging) {
      // Only add move handlers when dragging
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('touchmove', handleMove, { passive: false });
    }

    // Always have end handlers
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      // Clean up
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging]);

  // Get interpolated color for smooth transitions
  const getInterpolatedColor = () => {
    // Normalize x and y to 0-1 range
    const normX = position.x / 100;
    const normY = position.y / 100;

    // Define noise colors according to standard definitions
    const colors = {
      brown: { r: 160, g: 60, b: 45 },     // Brown noise (-6 dB/octave) - Less saturated brown
      pink: { r: 255, g: 50, b: 150 },     // Pink noise (-3 dB/octave) - Softer pink
      white: { r: 245, g: 245, b: 245 },   // White noise (0 dB/octave)
      blue: { r: 75, g: 115, b: 215 },     // Blue noise (+3 dB/octave) - Slightly softer blue
      violet: { r: 150, g: 60, b: 200 }    // Violet noise (+6 dB/octave) - Slightly softer violet
    };

    // Calculate noise color based on position in the filter space
    // X-axis (0-1): Left = LPF (pink/brown), Middle = Flat (white), Right = HPF (blue/violet)
    // Y-axis (0-1): Top = steeper high end (violet/white/pink), Bottom = steeper low end (blue/white/brown)

    // Determine X influence: LPF vs HPF
    const leftSide = Math.max(0, 1 - normX * 2); // 1 at far left, 0 at middle
    const rightSide = Math.max(0, normX * 2 - 1); // 0 at middle, 1 at far right
    const middleX = 1 - leftSide - rightSide; // 1 at middle, 0 at edges

    // Determine Y influence: Top vs Bottom vs Middle
    const topSide = Math.max(0, 1 - normY * 2); // 1 at top, 0 at middle
    const bottomSide = Math.max(0, normY * 2 - 1); // 0 at middle, 1 at bottom
    const middleY = 1 - topSide - bottomSide; // 1 at middle, 0 at extremes

    // Calculate noise color weights based on position
    // White noise (flat EQ): strongest in the center but with less dominance
    const whiteFactor = Math.pow(middleX * middleY, 0.5) * 0.7;

    // Pink noise (-3 dB/oct): LPF with mild slope, stronger in mid-left
    const pinkFactor = Math.pow(Math.max(0, 1 - Math.hypot(position.x/100 - 0.15, position.y/100 - 0.35) / 0.4), 1.2) * 2;

    // Brown noise (-6 dB/oct): LPF with steep slope, stronger in bottom-left
    const brownFactor = Math.pow(Math.max(0, 1 - Math.hypot(position.x/100 - 0.15, position.y/100 - 0.85) / 0.4), 1.2) * 2;

    // Blue noise (+3 dB/oct): HPF with mild slope, stronger in mid-right
    const blueFactor = Math.pow(Math.max(0, 1 - Math.hypot(position.x/100 - 0.85, position.y/100 - 0.65) / 0.4), 1.2) * 2;

    // Violet noise (+6 dB/oct): HPF with steep slope, stronger in top-right
    const violetFactor = Math.pow(Math.max(0, 1 - Math.hypot(position.x/100 - 0.85, position.y/100 - 0.15) / 0.4), 1.2) * 2;

    // Normalize factors so they sum to 1
    const totalFactor = brownFactor + pinkFactor + whiteFactor + blueFactor + violetFactor;
    const normFactor = totalFactor > 0 ? 1 / totalFactor : 1;

    // Blend colors
    const r = Math.round(
      colors.brown.r * brownFactor * normFactor +
      colors.pink.r * pinkFactor * normFactor +
      colors.white.r * whiteFactor * normFactor +
      colors.blue.r * blueFactor * normFactor +
      colors.violet.r * violetFactor * normFactor
    );

    const g = Math.round(
      colors.brown.g * brownFactor * normFactor +
      colors.pink.g * pinkFactor * normFactor +
      colors.white.g * whiteFactor * normFactor +
      colors.blue.g * blueFactor * normFactor +
      colors.violet.g * violetFactor * normFactor
    );

    const b = Math.round(
      colors.brown.b * brownFactor * normFactor +
      colors.pink.b * pinkFactor * normFactor +
      colors.white.b * whiteFactor * normFactor +
      colors.blue.b * blueFactor * normFactor +
      colors.violet.b * violetFactor * normFactor
    );

    // Determine dominant color for the label
    const factors = [
      { name: 'Brown', value: brownFactor },
      { name: 'Pink', value: pinkFactor },
      { name: 'White', value: whiteFactor },
      { name: 'Blue', value: blueFactor },
      { name: 'Violet', value: violetFactor }
    ];

    // Sort by factor value and get the dominant one
    factors.sort((a, b) => b.value - a.value);
    const dominantColor = factors[0].name;

    return {
      color: `rgb(${r}, ${g}, ${b})`,
      name: dominantColor
    };
  };

  // Handle resonance changes
  const handleResonanceChange = (value: number) => {
    const newResonance = parseFloat(value.toString());

    // Update all filters immediately
    if (filter12Ref.current && filter24Ref.current && filter48Ref.current &&
        hpf12Ref.current && hpf24Ref.current && hpf48Ref.current) {

      // Update LPF filters
      [filter12Ref.current, filter24Ref.current, filter48Ref.current].forEach(filter => {
        if (filter) filter.Q.value = newResonance;
      });

      // Update HPF filters
      [hpf12Ref.current, hpf24Ref.current, hpf48Ref.current].forEach(filter => {
        if (filter) filter.Q.value = newResonance;
      });
    }

    // Update state
    setFilterValues({
      ...filterValues,
      resonance: newResonance
    });
  };

  // Get interpolated color
  const interpolatedColor = getInterpolatedColor();

  return (
    <div className="flex flex-col items-center p-3 bg-white/80 backdrop-blur-xl rounded-xl max-w-md mx-auto relative z-10">
      <h1 className="text-xl font-medium text-gray-800 mb-2">Noise Sculptor</h1>

      <div className="relative w-full mb-3">
        {/* Main interactive pad with static gradient background map */}
        <div
          ref={padRef}
          className="relative w-full aspect-square rounded-lg overflow-hidden touch-none"
          onClick={handlePadClick}
          onMouseDown={handlePadStart}
          onTouchStart={handlePadStart}
          style={{
            background: `
              radial-gradient(circle at 15% 85%, rgba(160, 60, 45, 0.55), transparent 35%),
              radial-gradient(circle at 15% 35%, rgba(255, 50, 150, 0.55), transparent 35%),
              radial-gradient(circle at 50% 50%, rgba(245, 245, 245, 0.65), transparent 30%),
              radial-gradient(circle at 85% 65%, rgba(75, 115, 215, 0.55), transparent 35%),
              radial-gradient(circle at 85% 15%, rgba(150, 60, 200, 0.55), transparent 35%),
              rgba(240, 240, 240, 0.6)
            `,
            border: '1px solid rgba(0,0,0,0.05)'
          }}
        >
          {/* Grid lines - conditionally rendered based on showGridLines */}
          {showGridLines && (
            <>
              {/* Axis guides - minimal, just lines */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Horizontal axis line */}
                <div className="absolute left-0 right-0 h-px bg-black opacity-10" style={{ top: '50%' }}></div>
                {/* Vertical axis line */}
                <div className="absolute top-0 bottom-0 w-px bg-black opacity-10" style={{ left: '50%' }}></div>

                {/* Rolloff section markers - subtle horizontal lines */}
                <div className="absolute left-0 right-0 h-px bg-black opacity-5" style={{ top: '33%' }}></div>
                <div className="absolute left-0 right-0 h-px bg-black opacity-5" style={{ top: '66%' }}></div>
              </div>

              {/* Axis labels */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-2">
                <div className="flex justify-between w-full">
                  <span className="text-xs text-gray-500">LPF</span>
                  <span className="text-xs text-gray-500">-12dB/oct</span>
                  <span className="text-xs text-gray-500">HPF</span>
                </div>
                <div className="flex justify-center w-full" style={{ marginTop: '33%' }}>
                  <span className="text-xs text-gray-400 opacity-70">-24dB/oct</span>
                </div>
                <div className="flex justify-between w-full">
                  <span className="text-xs text-gray-500">100Hz</span>
                  <span className="text-xs text-gray-500">-48dB/oct</span>
                  <span className="text-xs text-gray-500">3kHz</span>
                </div>
              </div>
            </>
          )}

          {/* Simple pin/knob */}
          <div
            className="absolute w-10 h-10 flex items-center justify-center pointer-events-none"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div
              className="w-6 h-6 bg-black rounded-full flex items-center justify-center"
              style={{
                opacity: 0.8,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            </div>
          </div>
        </div>

        {/* Stable info display with filter details */}
        <div className="mt-1 text-xs text-gray-500 grid grid-cols-3 w-full">
          <div className="text-left">
            {filterValues.type === "lowpass" ?
              `${filterValues.frequency.toLocaleString()} Hz LPF` :
              (filterValues.type === "highpass" ?
                `${filterValues.frequency.toLocaleString()} Hz HPF` :
                "No Filter")}
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: interpolatedColor.color }}
            ></div>
            <div className="font-medium text-gray-700">{interpolatedColor.name}</div>
          </div>
          <div className="text-right">~{filterValues.rolloff} dB/oct</div>
        </div>
      </div>

      {/* Control buttons container */}
      <div className="flex items-center justify-center gap-2 mb-1">
        {/* Play button with modern minimal style */}
        <Button
          onClick={(e) => togglePlay(e)}
          variant="ghost"
          size="sm"
          className={`rounded-full border border-gray-100 ${
            isPlaying
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
          } px-4 py-1 text-xs shadow-none`}
        >
          <span className="font-medium">{isPlaying ? 'Stop' : 'Play'}</span>
        </Button>

        {/* Random noise button */}
        <Button
          onClick={(e) => generateRandomNoise(e)}
          variant="ghost"
          size="sm"
          className="rounded-full border border-gray-100 bg-gray-50 hover:bg-gray-100 text-gray-600 px-4 py-1 text-xs shadow-none"
        >
          <span className="font-medium">Random</span>
        </Button>
      </div>

      {/* Minimal instruction - placed right below buttons */}
      <div className="mt-0.5 mb-2 text-xs text-gray-400 text-center">
        Touch & drag to shape sound • Background shows noise color
      </div>

      {/* Waveform visualization */}
      <div className="w-full mt-3">
        <div className="text-xs text-gray-500 mb-1 flex justify-between items-center">
          <span>Waveform</span>
          <span>{isPlaying ? 'Live' : 'Idle'}</span>
        </div>
        <div className="w-full h-12 rounded-md overflow-hidden border border-gray-100 bg-gray-50">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Filter visualization */}
      <div className="w-full mt-3">
        <div className="text-xs text-gray-500 mb-1">
          <span>Filter Response</span>
        </div>
        <div className="w-full h-12 rounded-md overflow-hidden border border-gray-100 bg-gray-50 relative">
          {/* Frequency ticks - adjusted positioning */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-between px-1">
            <span className="text-[9px] font-medium text-gray-500">20Hz</span>
            <span className="text-[9px] font-medium text-gray-500">200Hz</span>
            <span className="text-[9px] font-medium text-gray-500">1kHz</span>
            <span className="text-[9px] font-medium text-gray-500">5kHz</span>
            <span className="text-[9px] font-medium text-gray-500">20kHz</span>
          </div>

          {/* Filter curve visualization - balanced top/bottom spacing */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Show both filter types with opacity based on the blend */}
            <div
              className="absolute h-8 top-2 left-0 right-0"
              style={{
                background: `linear-gradient(90deg,
                  rgba(50,200,50,0.3) 0%,
                  rgba(50,200,50,0.3) ${Math.min(95, Math.max(5, (Math.log10(filterValues.filterBlend < 0.5 ? filterValues.frequency : 20000) - 1) * 23))}%,
                  rgba(50,50,50,0.1) ${Math.min(98, Math.max(8, (Math.log10(filterValues.filterBlend < 0.5 ? filterValues.frequency : 20000) - 1) * 23 + (filterValues.rolloff/-6)))}%,
                  rgba(50,50,50,0.1) 100%)`,
                opacity: Math.max(0, 1 - filterValues.filterBlend * 1.5),
                transition: 'all 0.1s'
              }}
            >
              {/* Resonance peak for LPF */}
              {filterValues.resonance > 1 && filterValues.filterBlend < 0.5 && (
                <div className="absolute h-full" style={{
                  left: `${Math.min(95, Math.max(5, (Math.log10(filterValues.frequency) - 1) * 23))}%`,
                  width: `${Math.min(10, (filterValues.resonance - 1) * 1.5)}%`,
                  background: `radial-gradient(ellipse 50% 70% at center, rgba(50,200,50,${Math.min(0.7, (filterValues.resonance - 1) * 0.07)}), transparent)`,
                }}></div>
              )}
            </div>

            <div
              className="absolute h-8 top-2 left-0 right-0"
              style={{
                background: `linear-gradient(90deg,
                  rgba(50,50,50,0.1) 0%,
                  rgba(50,50,50,0.1) ${Math.min(92, Math.max(2, (Math.log10(filterValues.filterBlend > 0.5 ? filterValues.frequency : 20) - 1) * 23 - (filterValues.rolloff/-6)))}%,
                  rgba(50,200,50,0.3) ${Math.min(95, Math.max(5, (Math.log10(filterValues.filterBlend > 0.5 ? filterValues.frequency : 20) - 1) * 23))}%,
                  rgba(50,200,50,0.3) 100%)`,
                opacity: Math.max(0, filterValues.filterBlend * 1.5 - 0.5),
                transition: 'all 0.1s'
              }}
            >
              {/* Resonance peak for HPF */}
              {filterValues.resonance > 1 && filterValues.filterBlend > 0.5 && (
                <div className="absolute h-full" style={{
                  left: `${Math.min(95, Math.max(5, (Math.log10(filterValues.frequency) - 1) * 23))}%`,
                  width: `${Math.min(10, (filterValues.resonance - 1) * 1.5)}%`,
                  background: `radial-gradient(ellipse 50% 70% at center, rgba(50,200,50,${Math.min(0.7, (filterValues.resonance - 1) * 0.07)}), transparent)`,
                }}></div>
              )}
            </div>

            {/* Center line */}
            <div className="h-px w-full bg-gray-300 opacity-40"></div>
          </div>
        </div>
      </div>

      {/* Advanced section using shadcn UI Collapsible - simplified */}
      <Collapsible
        open={showAdvanced}
        onOpenChange={setShowAdvanced}
        className="w-full"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 flex items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-1 text-xs mx-auto shadow-none"
          >
            <span className="font-medium">{showAdvanced ? "Close" : "Advanced"}</span>
            <svg
              className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="w-full">
          <div className="w-full mt-3 pt-2 bg-gray-50/50 rounded-lg p-3">
            <div className="mb-2.5">
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-black rounded-full opacity-70"></div>
                  <span className="text-xs font-medium text-gray-700">Resonance</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{filterValues.resonance.toFixed(1)}</span>
                  <button
                    onClick={() => handleResonanceChange(1)}
                    className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                    title="Reset to default"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="relative">
                <Slider
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={[filterValues.resonance]}
                  onValueChange={(values) => handleResonanceChange(values[0])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Grid lines toggle */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-black rounded-full opacity-70"></div>
                  <span className="text-xs font-medium text-gray-700">Show Grid Lines</span>
                </div>
                <button
                  onClick={() => setShowGridLines(!showGridLines)}
                  className={`px-2 py-1 rounded text-[10px] font-medium ${
                    showGridLines
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {showGridLines ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Reset position option */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-black rounded-full opacity-70"></div>
                  <span className="text-xs font-medium text-gray-700">Reset Position</span>
                </div>
                <Button
                  onClick={(e) => resetPosition(e)}
                  variant="ghost"
                  size="sm"
                  className="rounded-full border border-gray-100 bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-1 text-[10px] shadow-none h-auto"
                >
                  <span className="font-medium">Center</span>
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default NoisePad;
