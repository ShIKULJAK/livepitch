'use client';

import type { ReactNode } from 'react';
import { useId } from 'react';

type PitchDimensionsDiagramProps = {
  lengthMeters: number;
  widthMeters: number;
  goalWidthMeters?: number | null;
  goalHeightMeters?: number | null;
  title?: string;
  fieldNumber?: string;
  className?: string;
  size?: 'compact' | 'full';
  rightTitle?: string;
  rightPanel?: ReactNode;
};

export function PitchDimensionsDiagram({
  lengthMeters,
  widthMeters,
  goalWidthMeters,
  goalHeightMeters,
  title = 'Dimenzije terena',
  fieldNumber,
  className = '',
  size = 'compact',
  rightTitle = 'Raspored',
  rightPanel,
}: PitchDimensionsDiagramProps) {
  const safeLength = Math.max(1, Math.round(lengthMeters));
  const safeWidth = Math.max(1, Math.round(widthMeters));
  const hasGoalWidth =
    goalWidthMeters != null && Number.isFinite(goalWidthMeters) && goalWidthMeters > 0;
  const hasGoalHeight =
    goalHeightMeters != null && Number.isFinite(goalHeightMeters) && goalHeightMeters > 0;
  const formatMeters = (value: number) =>
    new Intl.NumberFormat('bs-BA', { maximumFractionDigits: 2 }).format(value);
  const goalLabel = hasGoalWidth
    ? `Gol ${formatMeters(goalWidthMeters!)}${hasGoalHeight ? ` × ${formatMeters(goalHeightMeters!)} m` : ' m'}`
    : null;
  const diagramId = useId().replaceAll(':', '');
  const grassGradientId = `pitchGrass-${diagramId}`;
  const fieldClipId = `pitchFieldClip-${diagramId}`;
  const arrowHeadId = `pitchArrowHead-${diagramId}`;
  const stripeCount = 10;
  const stripeWidth = 500 / stripeCount;
  const fieldStripes = Array.from({ length: stripeCount }, (_, index) => ({
    x: 70 + index * stripeWidth,
    opacity: index % 2 === 0 ? 0.12 : 0.03,
  }));

  const renderPitchSvg = ({
    svgClassName,
    showDimensions = true,
  }: {
    svgClassName: string;
    showDimensions?: boolean;
  }) => (
    <svg viewBox="0 0 640 380" className={svgClassName}>
      <defs>
        <linearGradient id={grassGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f741f" />
          <stop offset="45%" stopColor="#4d9630" />
          <stop offset="100%" stopColor="#27651b" />
        </linearGradient>
        <clipPath id={fieldClipId}>
          <rect x="70" y="50" width="500" height="280" rx="8" />
        </clipPath>
        <marker
          id={arrowHeadId}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#57c7ff" />
        </marker>
      </defs>

      <rect
        x="70"
        y="50"
        width="500"
        height="280"
        rx="8"
        fill={`url(#${grassGradientId})`}
        stroke="#d7f6d0"
        strokeWidth="3"
      />
      <g clipPath={`url(#${fieldClipId})`}>
        {fieldStripes.map((stripe) => (
          <rect
            key={stripe.x}
            x={stripe.x}
            y="50"
            width={stripeWidth}
            height="280"
            fill="#f6ffe8"
            opacity={stripe.opacity}
          />
        ))}
      </g>
      {fieldNumber ? (
        <text
          x="320"
          y="200"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          opacity="0.5"
          fontSize="76"
          fontWeight="800"
        >
          {fieldNumber}
        </text>
      ) : null}
      <line
        x1="320"
        y1="50"
        x2="320"
        y2="330"
        stroke="#eefbea"
        strokeWidth="2"
      />
      <circle
        cx="320"
        cy="190"
        r="42"
        fill="none"
        stroke="#eefbea"
        strokeWidth="2"
      />

      <rect
        x="70"
        y="112"
        width="72"
        height="156"
        fill="none"
        stroke="#eefbea"
        strokeWidth="2"
      />
      <rect
        x="70"
        y="145"
        width="28"
        height="90"
        fill="none"
        stroke="#eefbea"
        strokeWidth="2"
      />
      <rect
        x="498"
        y="112"
        width="72"
        height="156"
        fill="none"
        stroke="#eefbea"
        strokeWidth="2"
      />
      <rect
        x="542"
        y="145"
        width="28"
        height="90"
        fill="none"
        stroke="#eefbea"
        strokeWidth="2"
      />

      {showDimensions ? (
        <>
          {goalLabel ? (
            <>
              <line
                x1="596"
                y1="145"
                x2="596"
                y2="235"
                stroke="#57c7ff"
                strokeWidth="1"
                markerStart={`url(#${arrowHeadId})`}
                markerEnd={`url(#${arrowHeadId})`}
              />
              <text
                x="612"
                y="190"
                textAnchor="middle"
                fill="#f8fbff"
                fontSize="14.5"
                fontWeight="600"
                transform="rotate(90 612 190)"
              >
                {goalLabel}
              </text>
            </>
          ) : null}

          <line
            x1="70"
            y1="26"
            x2="570"
            y2="26"
            stroke="#57c7ff"
            strokeWidth="1.25"
            markerStart={`url(#${arrowHeadId})`}
            markerEnd={`url(#${arrowHeadId})`}
          />
          <text
            x="320"
            y="18"
            textAnchor="middle"
            fill="#f8fbff"
            fontSize="17"
            fontWeight="600"
          >
            Duzina: {safeLength} m
          </text>

          <line
            x1="34"
            y1="50"
            x2="34"
            y2="330"
            stroke="#57c7ff"
            strokeWidth="1.25"
            markerStart={`url(#${arrowHeadId})`}
            markerEnd={`url(#${arrowHeadId})`}
          />
          <text
            x="24"
            y="190"
            textAnchor="middle"
            fill="#f8fbff"
            fontSize="17"
            fontWeight="600"
            transform="rotate(-90 24 190)"
          >
            Sirina: {safeWidth} m
          </text>
        </>
      ) : null}
    </svg>
  );

  return (
    <div
      className={`overflow-hidden rounded-lg border ${className}`}
      style={{
        borderColor: 'var(--border)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 94%, var(--surface-1)) 0%, color-mix(in srgb, var(--surface-1) 90%, var(--surface-2)) 100%)',
      }}
    >
      <div
        className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        {title}
      </div>
      <div className="p-3">
        {size === 'full' ? (
          <div
            className="relative overflow-hidden rounded-[20px] border p-4"
            style={{
              borderColor: 'var(--border)',
              background:
                'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--info) 14%, transparent) 0%, transparent 38%), linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 96%, var(--surface-1)) 0%, color-mix(in srgb, var(--surface-1) 92%, var(--surface-2)) 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(color-mix(in srgb, var(--info) 12%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--info) 12%, transparent) 1px, transparent 1px)',
                backgroundSize: '26px 26px',
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-10 bottom-8 h-20 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--info) 14%, transparent) 0%, transparent 70%)',
              }}
            />
            <div className="relative grid gap-5 lg:grid-cols-2 lg:items-stretch">
              <div className="min-w-0">
                <div className="mb-3 flex h-6 items-center justify-between">
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    2D prikaz
                  </span>
                </div>
                <div className="flex h-[360px] items-center justify-center overflow-hidden">
                  {renderPitchSvg({
                    svgClassName: 'mx-auto w-full',
                    showDimensions: true,
                  })}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-3 flex h-6 items-center justify-between">
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {rightTitle}
                  </span>
                </div>
                <div
                  className="relative flex h-[360px] overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--info) 18%, var(--border))',
                    background:
                      'radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--info) 12%, transparent) 0%, transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 98%, var(--surface-1)) 0%, color-mix(in srgb, var(--surface-1) 96%, var(--surface-2)) 100%)',
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-25"
                    style={{
                      backgroundImage:
                        'linear-gradient(color-mix(in srgb, var(--info) 10%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--info) 10%, transparent) 1px, transparent 1px)',
                      backgroundSize: '22px 22px',
                    }}
                  />
                  <div className="relative z-10 flex h-full w-full min-h-0 flex-col">
                    {rightPanel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderPitchSvg({
            svgClassName: 'mx-auto w-1/2',
            showDimensions: true,
          })
        )}
      </div>
    </div>
  );
}
