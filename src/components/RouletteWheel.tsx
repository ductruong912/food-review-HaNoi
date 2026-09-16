'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Restaurant } from '@/lib/types';
import { soundFX } from '@/lib/audio';

interface RouletteWheelProps {
  candidates: Restaurant[];
  isSpinning: boolean;
  onSpinStart: () => void;
  onSpinEnd: (result: Restaurant) => void;
}

const PALETTE = [
  '#163E33', // Deep forest emerald
  '#234E42', // Muted sage
  '#2C5E50', // Rich pine
  '#1B493C', // Dark teal
  '#356859', // Jade green
  '#1E4338', // Moss
  '#265345', // Forest
  '#3A6F60', // Soft teal-green
];

export default function RouletteWheel({
  candidates,
  isSpinning,
  onSpinStart,
  onSpinEnd,
}: RouletteWheelProps) {
  // Use up to 8 representative candidates for clean, legible slices
  const slices = candidates.slice(0, 8);
  const numSlices = Math.max(slices.length, 1);
  const sliceAngle = 360 / numSlices;

  const [rotation, setRotation] = useState(0);
  const [isPointerTicking, setIsPointerTicking] = useState(false);
  const tickIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, []);

  const triggerSpin = useCallback(() => {
    if (isSpinning || slices.length === 0) return;

    onSpinStart();

    // Pick random winning index
    const winningIndex = Math.floor(Math.random() * slices.length);
    const winningRestaurant = slices[winningIndex];

    // Pointer is at the top (270 degrees in SVG coordinates or 0 deg relative to top)
    // To align slice i under the top pointer:
    // Slice center angle: (i + 0.5) * sliceAngle
    // Rotation needed = Full spins + (360 - center angle)
    const extraSpins = (5 + Math.floor(Math.random() * 3)) * 360; // 5-7 full spins
    const targetSliceCenter = (winningIndex + 0.5) * sliceAngle;
    const finalAngle = rotation + extraSpins + (360 - (rotation % 360)) + (360 - targetSliceCenter);

    setRotation(finalAngle);

    // Audio tick simulation during deceleration
    let currentStep = 0;
    const totalTicks = 28;
    const baseInterval = 45;

    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    const playTickingSequence = () => {
      currentStep++;
      soundFX.playTick(1 + (totalTicks - currentStep) * 0.02);
      setIsPointerTicking(true);
      setTimeout(() => setIsPointerTicking(false), 30);

      // Haptic feedback if available
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // ignore
        }
      }

      if (currentStep < totalTicks) {
        // Progressive delay to simulate friction slowing down
        const nextDelay = baseInterval + Math.pow(currentStep / 3.2, 2.3);
        tickIntervalRef.current = setTimeout(playTickingSequence, nextDelay);
      } else {
        // Complete spin
        setTimeout(() => {
          onSpinEnd(winningRestaurant);
        }, 200);
      }
    };

    tickIntervalRef.current = setTimeout(playTickingSequence, baseInterval);
  }, [isSpinning, slices, rotation, sliceAngle, onSpinStart, onSpinEnd]);

  const size = 280;
  const center = size / 2;
  const radius = center - 12;

  return (
    <div className="flex flex-col items-center justify-center relative select-none py-2">
      {/* Top Pointer Arrow */}
      <div
        className={`absolute -top-1 z-20 transition-transform duration-75 origin-top ${
          isPointerTicking ? 'rotate-[-12deg] scale-105' : 'rotate-0'
        }`}
      >
        <div className="w-6 h-7 relative filter drop-shadow-md">
          <svg viewBox="0 0 24 28" fill="none" className="w-full h-full">
            <polygon
              points="12,28 0,4 24,4"
              fill="#7EC8A4"
              stroke="#0D1B16"
              strokeWidth="2"
            />
            <circle cx="12" cy="7" r="3.5" fill="#0D1B16" />
          </svg>
        </div>
      </div>

      {/* Roulette SVG Circle */}
      <div className="relative p-1 rounded-full bg-gradient-to-b from-[#7EC8A4]/40 via-[#264038]/60 to-[#0D1B16] shadow-[0_0_30px_rgba(126,200,164,0.15)] border-2 border-[#7EC8A4]/30">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rounded-full shadow-inner"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? 'transform 3.8s cubic-bezier(0.12, 0.85, 0.15, 1)'
              : 'none',
          }}
        >
          {/* Wheel Slices */}
          {slices.map((restaurant, idx) => {
            const startAngle = idx * sliceAngle - 90;
            const endAngle = (idx + 1) * sliceAngle - 90;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);

            const largeArc = sliceAngle > 180 ? 1 : 0;
            const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            const textAngle = startAngle + sliceAngle / 2;
            const textRad = (textAngle * Math.PI) / 180;
            const textDistance = radius * 0.65;
            const textX = center + textDistance * Math.cos(textRad);
            const textY = center + textDistance * Math.sin(textRad);

            const sliceColor = PALETTE[idx % PALETTE.length];

            // Truncate long restaurant name for wheel display
            const displayName =
              restaurant.name.length > 13
                ? restaurant.name.substring(0, 12) + '…'
                : restaurant.name;

            return (
              <g key={restaurant.id || idx}>
                <path
                  d={pathData}
                  fill={sliceColor}
                  stroke="#132A22"
                  strokeWidth="1.5"
                />
                <text
                  x={textX}
                  y={textY}
                  fill="#E4EDE8"
                  fontSize={numSlices > 6 ? '10' : '11'}
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                  className="pointer-events-none tracking-tight"
                >
                  {displayName}
                </text>
              </g>
            );
          })}

          {/* Outer Border ring rivets */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * (360 / 16) * Math.PI) / 180;
            const rx = center + (radius + 5) * Math.cos(angle);
            const ry = center + (radius + 5) * Math.sin(angle);
            return (
              <circle
                key={i}
                cx={rx}
                cy={ry}
                r="1.8"
                fill="#7EC8A4"
                opacity="0.8"
              />
            );
          })}
        </svg>

        {/* Center Spin Button (Center Hub) */}
        <button
          type="button"
          onClick={triggerSpin}
          disabled={isSpinning || slices.length === 0}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-[#7EC8A4] to-[#459570] text-[#0D1B16] font-extrabold text-xs shadow-lg shadow-black/50 border-2 border-white/40 flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 z-10"
        >
          <span className="text-sm">🎲</span>
          <span className="tracking-wider uppercase text-[10px] leading-tight font-black">
            {isSpinning ? 'Quay...' : 'Quay'}
          </span>
        </button>
      </div>

      <div className="mt-3 text-[11px] text-text-muted flex items-center gap-1">
        <span>Bấm nút giữa hoặc kéo cần gạt để chọn</span>
      </div>
    </div>
  );
}
