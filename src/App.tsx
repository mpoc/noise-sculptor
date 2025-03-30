import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

const NoisePad = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [filterValues, setFilterValues] = useState({
    lowpass: 10000,
    highpass: 20
  });
  const [isDragging, setIsDragging] = useState(false);
  const padRef = useRef(null);
  const noiseRef = useRef(null);
  const lowpassRef = useRef(null);
  const highpassRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Initialize audio components
  useEffect(() => {
    noiseRef.current = new Tone.Noise("white").toDestination();
    noiseRef.current.volume.value = -8; // Increased amplitude for a stronger signal

    lowpassRef.current = new Tone.Filter(filterValues.lowpass, "lowpass");
    highpassRef.current = new Tone.Filter(filterValues.highpass, "highpass").toDestination();

    // Create an analyser node for visualization
    analyserRef.current = new Tone.Analyser("waveform", 256); // Increased sample rate from 128 to 256

    // Connect the audio chain
    noiseRef.current.disconnect();
    noiseRef.current.connect(lowpassRef.current);
    lowpassRef.current.connect(highpassRef.current);

    // Connect the analyser to the end of the chain
    highpassRef.current.connect(analyserRef.current);

    return () => {
      if (noiseRef.current) noiseRef.current.dispose();
      if (lowpassRef.current) lowpassRef.current.dispose();
      if (highpassRef.current) highpassRef.current.dispose();
      if (analyserRef.current) analyserRef.current.dispose();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Update filter values when position changes
  useEffect(() => {
    if (lowpassRef.current && highpassRef.current) {
      // Scale x position (0-100) to frequency range (100-15000 Hz) logarithmically
      let lowpassFreq = Math.pow(10, 2 + (position.x / 100) * 2.18);

      // Scale y position (0-100) to frequency range (32-10000 Hz) logarithmically
      // FLIPPED: High Y = low HPF, Low Y = high HPF
      // More aggressive HPF curve for a more noticeable effect
      const highpassFreq = Math.pow(10, 1.5 + ((100 - position.y) / 100) * 2.5);

      // Ensure LPF is always at least 1.5 times higher than HPF to prevent silent regions
      const minLowpassFreq = highpassFreq * 1.5;
      if (lowpassFreq < minLowpassFreq) {
        lowpassFreq = minLowpassFreq;
      }

      lowpassRef.current.frequency.value = lowpassFreq;
      highpassRef.current.frequency.value = highpassFreq;

      setFilterValues({
        lowpass: Math.round(lowpassFreq),
        highpass: Math.round(highpassFreq)
      });
    }
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

    // Set stroke style based on the interpolated color
    const { color } = getInterpolatedColor();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5; // Increased line width for better visibility

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

    // Define noise colors - positions updated to match background gradient
    const colors = {
      brown: { r: 121, g: 85, b: 72 },     // Top left
      pink: { r: 233, g: 30, b: 99 },      // Middle left
      green: { r: 139, g: 195, b: 74 },    // Bottom left
      white: { r: 240, g: 240, b: 240 },   // Top right
      blue: { r: 63, g: 81, b: 181 }       // Bottom right
    };

    // Calculate influence factors based on position
    const brownFactor = Math.max(0, (1 - normX) * normY * 1.5);
    const pinkFactor = Math.max(0, (1 - normX) * (1 - Math.abs(normY - 0.5)) * 1.5);
    const greenFactor = Math.max(0, (1 - normX) * (1 - normY) * 1.5);
    const whiteFactor = Math.max(0, normX * normY * 1.5);
    const blueFactor = Math.max(0, normX * (1 - normY) * 1.5);

    // Normalize factors so they sum to 1
    const totalFactor = brownFactor + pinkFactor + blueFactor + whiteFactor + greenFactor;
    const normFactor = totalFactor > 0 ? 1 / totalFactor : 1;

    // Increase color saturation by multiplying r,g,b by a factor before normalization
    const saturationFactor = 1.5; // Increase color intensity

    // Blend colors
    const r = Math.min(255, Math.round(
      colors.brown.r * brownFactor * normFactor * saturationFactor +
      colors.pink.r * pinkFactor * normFactor * saturationFactor +
      colors.blue.r * blueFactor * normFactor * saturationFactor +
      colors.white.r * whiteFactor * normFactor +
      colors.green.r * greenFactor * normFactor * saturationFactor
    ));

    const g = Math.min(255, Math.round(
      colors.brown.g * brownFactor * normFactor * saturationFactor +
      colors.pink.g * pinkFactor * normFactor * saturationFactor +
      colors.blue.g * blueFactor * normFactor * saturationFactor +
      colors.white.g * whiteFactor * normFactor +
      colors.green.g * greenFactor * normFactor * saturationFactor
    ));

    const b = Math.min(255, Math.round(
      colors.brown.b * brownFactor * normFactor * saturationFactor +
      colors.pink.b * pinkFactor * normFactor * saturationFactor +
      colors.blue.b * blueFactor * normFactor * saturationFactor +
      colors.white.b * whiteFactor * normFactor +
      colors.green.b * greenFactor * normFactor * saturationFactor
    ));

    // Determine dominant color for the label
    const factors = [
      { name: 'Brown', value: brownFactor },
      { name: 'Pink', value: pinkFactor },
      { name: 'Blue', value: blueFactor },
      { name: 'White', value: whiteFactor },
      { name: 'Green', value: greenFactor }
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
              radial-gradient(circle at 20% 20%, rgba(233, 30, 99, 0.25), transparent 50%),  /* Pink - top left */
              radial-gradient(circle at 30% 50%, rgba(156, 39, 176, 0.25), transparent 50%),  /* Purple - middle left */
              radial-gradient(circle at 20% 80%, rgba(121, 85, 72, 0.35), transparent 50%),  /* Brown - bottom left */
              radial-gradient(circle at 80% 20%, rgba(63, 81, 181, 0.35), transparent 50%),  /* Blue - top right */
              radial-gradient(circle at 80% 80%, rgba(240, 240, 240, 0.35), transparent 50%) /* White - bottom right */
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
          </div>

          {/* Intuitive axis labels based on sound characteristics */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-2">
            <div className="flex justify-between w-full">
              <span className="text-xs text-gray-500">Hollow</span>
              <span className="text-xs text-gray-500">Crisp</span>
            </div>
            <div className="flex justify-between w-full">
              <span className="text-xs text-gray-500">Rumble</span>
              <span className="text-xs text-gray-500">Full</span>
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

        {/* Stable info display with smooth color transition */}
        <div className="mt-1 text-xs text-gray-500 grid grid-cols-3 w-full">
          <div className="text-left">{filterValues.highpass.toLocaleString()} Hz HPF</div>
          <div className="flex items-center justify-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: interpolatedColor.color }}
            ></div>
            <div className="font-medium text-gray-700">{interpolatedColor.name}</div>
          </div>
          <div className="text-right">{filterValues.lowpass.toLocaleString()} Hz LPF</div>
        </div>

        {/* Bandpass info */}
        <div className="mt-1 text-xs text-gray-500 w-full text-center">
          Bandwidth: {Math.round(filterValues.lowpass - filterValues.highpass).toLocaleString()} Hz
          {position.x < (100 - position.y) ? " (auto-adjusted)" : ""}
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

      {/* Minimal instruction - moved below play button */}
      <div className="mt-1.5 mb-2 text-xs text-gray-400 text-center">
        Touch & drag to shape sound • Background shows noise color
      </div>

      {/* Waveform visualization */}
      <div className="w-full mt-3">
        <div className="text-xs text-gray-500 mb-1 flex justify-between items-center">
          <span>Waveform</span>
          <span>{isPlaying ? 'Live' : 'Idle'}</span>
        </div>
        <div className="w-full h-14 rounded-md overflow-hidden border border-gray-100 bg-gray-50">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Bandpass visualization */}
      <div className="w-full mt-3">
        <div className="text-xs text-gray-500 mb-1">
          <span>Filter Response</span>
        </div>
        <div className="w-full h-14 rounded-md overflow-hidden border border-gray-100 bg-gray-50 relative">
          {/* Visualization of the bandpass filter */}
          <div className="absolute inset-0 flex items-end">
            {/* Frequency ticks */}
            <div className="absolute bottom-0 left-0 right-0 h-6 flex justify-between px-1">
              <span className="text-[8px] text-gray-400">20Hz</span>
              <span className="text-[8px] text-gray-400">100Hz</span>
              <span className="text-[8px] text-gray-400">1kHz</span>
              <span className="text-[8px] text-gray-400">10kHz</span>
              <span className="text-[8px] text-gray-400">20kHz</span>
            </div>

            {/* HPF curve */}
            <div
              className="absolute h-8 bottom-6 left-0 right-0"
              style={{
                background: `linear-gradient(90deg,
                  rgba(255,50,50,0.3) 0%,
                  rgba(255,50,50,0.3) ${(Math.log10(filterValues.highpass) - 1) * 25}%,
                  rgba(50,255,50,0.2) ${(Math.log10(filterValues.highpass) - 1) * 25 + 3}%,
                  rgba(50,255,50,0.2) 100%)`
              }}
            ></div>

            {/* LPF curve */}
            <div
              className="absolute h-8 bottom-6 left-0 right-0"
              style={{
                background: `linear-gradient(90deg,
                  rgba(50,255,50,0.2) 0%,
                  rgba(50,255,50,0.2) ${(Math.log10(filterValues.lowpass) - 1) * 25 - 3}%,
                  rgba(255,50,50,0.3) ${(Math.log10(filterValues.lowpass) - 1) * 25}%,
                  rgba(255,50,50,0.3) 100%)`
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Removed instruction text from here - now above */}
    </div>
  );
};

export default NoisePad;
