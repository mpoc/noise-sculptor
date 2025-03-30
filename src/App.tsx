import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

const NoisePad = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [filterValues, setFilterValues] = useState({
    frequency: 1000,
    type: "lowpass",
    rolloff: -24,
    crossfadePosition: 0.5, // 0-1 value for rolloff crossfade visualization
    filterBlend: 0.5 // 0-1 value for LPF/HPF blend
  });
  const [isDragging, setIsDragging] = useState(false);
  const padRef = useRef(null);
  const noiseRef = useRef(null);
  
  // LPF filters with different rolloffs
  const filter12Ref = useRef(null);
  const filter24Ref = useRef(null);
  const filter48Ref = useRef(null);
  
  // HPF filters with different rolloffs  
  const hpf12Ref = useRef(null);
  const hpf24Ref = useRef(null);
  const hpf48Ref = useRef(null);
  
  // Filter type crossfaders (LPF <-> HPF)
  const xf12Ref = useRef(null);
  const xf24Ref = useRef(null);
  const xf48Ref = useRef(null);
  
  // Rolloff crossfaders
  const crossfade12_24Ref = useRef(null);
  const crossfade24_48Ref = useRef(null);
  const masterCrossfadeRef = useRef(null);
  
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Initialize audio components
  useEffect(() => {
    // Create noise source
    noiseRef.current = new Tone.Noise("white");
    noiseRef.current.volume.value = -15;
    
    // Create LPF filters with different rolloffs
    filter12Ref.current = new Tone.Filter({
      frequency: 20000,
      type: "lowpass",
      rolloff: -12
    });
    
    filter24Ref.current = new Tone.Filter({
      frequency: 20000,
      type: "lowpass",
      rolloff: -24
    });
    
    filter48Ref.current = new Tone.Filter({
      frequency: 20000,
      type: "lowpass",
      rolloff: -48
    });
    
    // Create HPF filters with different rolloffs
    hpf12Ref.current = new Tone.Filter({
      frequency: 20,
      type: "highpass",
      rolloff: -12
    });
    
    hpf24Ref.current = new Tone.Filter({
      frequency: 20,
      type: "highpass",
      rolloff: -24
    });
    
    hpf48Ref.current = new Tone.Filter({
      frequency: 20,
      type: "highpass",
      rolloff: -48
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
    const lpfFactor = Math.max(0, 1 - normX * 1.5); // 0 at x>67%, 1 at x=0%
    const lpfFreq = lpfFactor > 0 ? 
      Math.pow(10, 4.3 - (lpfFactor * 2.5)) : // 20kHz down to ~100Hz 
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
      filter.frequency.value = lpfFreq;
    });
    
    // Update all HPF filters
    [hpf12Ref.current, hpf24Ref.current, hpf48Ref.current].forEach(filter => {
      filter.frequency.value = hpfFreq;
    });
    
    // Update the LPF/HPF crossfade for each rolloff pair
    [xf12Ref.current, xf24Ref.current, xf48Ref.current].forEach(xf => {
      xf.fade.value = filterBlend;
    });
    
    // Update state for display
    setFilterValues({
      frequency: Math.round(frequency),
      type: filterType,
      rolloff: Math.round(rolloff),
      crossfadePosition: crossfadePosition,
      filterBlend: filterBlend
    });
  }, [position]);

  // Draw waveform function
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
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
    for (let i = 0; i < waveform.length; i++) {
      const x = (i / waveform.length) * width;
      const y = ((waveform[i] + 1) / 2) * height;

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
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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

  const togglePlay = async (e) => {
    // Prevent event propagation so it doesn't trigger pad interaction
    e.stopPropagation();

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    if (isPlaying) {
      noiseRef.current.stop();
    } else {
      noiseRef.current.start();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle pad interaction (mouse/touch move)
  const handlePadMove = (e) => {
    // Only handle move if we're dragging
    if (!isDragging || !padRef.current) return;

    // Prevent default for touch events to avoid scrolling
    if (e.cancelable && e.type === 'touchmove') {
      e.preventDefault();
    }

    // Handle both mouse and touch events
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (!clientX || !clientY) return;

    const rect = padRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setPosition({ x, y });
  };

  // Handle pad click/touch
  const handlePadClick = (e) => {
    // Prevent default actions
    if (e.cancelable) {
      e.preventDefault();
    }

    // Stop propagation to avoid conflicts
    e.stopPropagation();

    // Skip if not on the pad
    if (!padRef.current) return;

    // Get coordinates
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (!clientX || !clientY) return;

    // Update position directly
    const rect = padRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setPosition({ x, y });
  };

  // Handle the start of interaction (mousedown/touchstart)
  const handlePadStart = (e) => {
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
    const handleMove = (e) => handlePadMove(e);
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
    // White noise (flat EQ): strongest in the center
    const whiteFactor = Math.pow(middleX * middleY, 0.5) * 1.5;
    
    // Pink noise (-3 dB/oct): LPF with mild slope, stronger in mid-left
    const pinkFactor = leftSide * (middleY * 0.7 + topSide * 0.3);
    
    // Brown noise (-6 dB/oct): LPF with steep slope, stronger in bottom-left
    const brownFactor = leftSide * (middleY * 0.3 + bottomSide * 0.7);
    
    // Blue noise (+3 dB/oct): HPF with mild slope, stronger in mid-right
    const blueFactor = rightSide * (middleY * 0.7 + bottomSide * 0.3);
    
    // Violet noise (+6 dB/oct): HPF with steep slope, stronger in top-right
    const violetFactor = rightSide * (middleY * 0.3 + topSide * 0.7);

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
              linear-gradient(to bottom, 
                rgba(150, 60, 200, 0.22) 0%, 
                rgba(245, 245, 245, 0.4) 50%, 
                rgba(160, 60, 45, 0.25) 100%
              ),
              linear-gradient(to right,
                rgba(255, 50, 150, 0.3) 0%,
                rgba(245, 245, 245, 0.4) 50%,
                rgba(75, 115, 215, 0.3) 100%
              ),
              radial-gradient(circle at 50% 50%, rgba(245, 245, 245, 0.6), transparent 50%)
            `,
            border: '1px solid rgba(0,0,0,0.05)'
          }}
        >
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

      {/* Minimal play button */}
      <button
        onClick={togglePlay}
        className={`px-6 py-1.5 rounded-full text-sm transition-colors ${
          isPlaying
            ? 'bg-black text-white'
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }`}
      >
        {isPlaying ? 'Stop' : 'Play'}
      </button>

      {/* Minimal instruction - placed right below play button */}
      <div className="mt-1.5 mb-2 text-xs text-gray-400 text-center">
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
          {/* Frequency ticks */}
          <div className="absolute bottom-0 left-0 right-0 h-6 flex justify-between px-1">
            <span className="text-[8px] text-gray-400">20Hz</span>
            <span className="text-[8px] text-gray-400">200Hz</span>
            <span className="text-[8px] text-gray-400">1kHz</span>
            <span className="text-[8px] text-gray-400">5kHz</span>
            <span className="text-[8px] text-gray-400">20kHz</span>
          </div>

          {/* Filter curve visualization */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Show both filter types with opacity based on the blend */}
            <div 
              className="absolute h-8 top-1 left-0 right-0"
              style={{
                background: `linear-gradient(90deg, 
                  rgba(50,200,50,0.3) 0%, 
                  rgba(50,200,50,0.3) ${Math.min(95, Math.max(5, (Math.log10(filterValues.filterBlend < 0.5 ? filterValues.frequency : 20000) - 1) * 23))}%, 
                  rgba(50,50,50,0.1) ${Math.min(98, Math.max(8, (Math.log10(filterValues.filterBlend < 0.5 ? filterValues.frequency : 20000) - 1) * 23 + (filterValues.rolloff/-6)))}%,
                  rgba(50,50,50,0.1) 100%)`,
                opacity: Math.max(0, 1 - filterValues.filterBlend * 1.5),
                transition: 'all 0.1s'
              }}
            ></div>
            
            <div 
              className="absolute h-8 top-1 left-0 right-0"
              style={{
                background: `linear-gradient(90deg, 
                  rgba(50,50,50,0.1) 0%,
                  rgba(50,50,50,0.1) ${Math.min(92, Math.max(2, (Math.log10(filterValues.filterBlend > 0.5 ? filterValues.frequency : 20) - 1) * 23 - (filterValues.rolloff/-6)))}%, 
                  rgba(50,200,50,0.3) ${Math.min(95, Math.max(5, (Math.log10(filterValues.filterBlend > 0.5 ? filterValues.frequency : 20) - 1) * 23))}%,
                  rgba(50,200,50,0.3) 100%)`,
                opacity: Math.max(0, filterValues.filterBlend * 1.5 - 0.5),
                transition: 'all 0.1s'
              }}
            ></div>
            
            {/* Center line */}
            <div className="h-px w-full bg-gray-300 opacity-40"></div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default NoisePad;
