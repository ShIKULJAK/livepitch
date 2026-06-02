"use client";

import { useId } from "react";

type PitchDimensionsDiagramProps = {
  lengthMeters: number;
  widthMeters: number;
  title?: string;
  fieldNumber?: string;
  className?: string;
};

export function PitchDimensionsDiagram({
  lengthMeters,
  widthMeters,
  title = "Dimenzije terena",
  fieldNumber,
  className = "",
}: PitchDimensionsDiagramProps) {
  const safeLength = Math.max(1, Math.round(lengthMeters));
  const safeWidth = Math.max(1, Math.round(widthMeters));
  const diagramId = useId().replaceAll(":", "");
  const grassGradientId = `pitchGrass-${diagramId}`;
  const fieldClipId = `pitchFieldClip-${diagramId}`;
  const arrowHeadId = `pitchArrowHead-${diagramId}`;
  const stripeCount = 10;
  const stripeWidth = 500 / stripeCount;
  const fieldStripes = Array.from({ length: stripeCount }, (_, index) => ({
    x: 70 + index * stripeWidth,
    opacity: index % 2 === 0 ? 0.12 : 0.03,
  }));

  return (
    <div
      className={`overflow-hidden rounded-lg border ${className}`}
      style={{
        borderColor: "var(--border)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 96%, #0f172a 4%) 0%, color-mix(in srgb, var(--surface-1) 94%, #08111f 6%) 100%)",
      }}
    >
      <div
        className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {title}
      </div>
      <div className="p-3">
        <svg viewBox="0 0 640 380" className="mx-auto w-1/2">
          <defs>
            <linearGradient id={grassGradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2f741f" />
              <stop offset="45%" stopColor="#4d9630" />
              <stop offset="100%" stopColor="#27651b" />
            </linearGradient>
            <clipPath id={fieldClipId}>
              <rect x="70" y="50" width="500" height="280" rx="8" />
            </clipPath>
            <marker id={arrowHeadId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#57c7ff" />
            </marker>
          </defs>

          <rect x="70" y="50" width="500" height="280" rx="8" fill={`url(#${grassGradientId})`} stroke="#d7f6d0" strokeWidth="3" />
          <g clipPath={`url(#${fieldClipId})`}>
            {fieldStripes.map((stripe) => (
              <rect key={stripe.x} x={stripe.x} y="50" width={stripeWidth} height="280" fill="#f6ffe8" opacity={stripe.opacity} />
            ))}
          </g>
          {fieldNumber ? (
            <text x="320" y="200" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" opacity="0.5" fontSize="76" fontWeight="800">
              {fieldNumber}
            </text>
          ) : null}
          <line x1="320" y1="50" x2="320" y2="330" stroke="#eefbea" strokeWidth="2" />
          <circle cx="320" cy="190" r="42" fill="none" stroke="#eefbea" strokeWidth="2" />

          <rect x="70" y="112" width="72" height="156" fill="none" stroke="#eefbea" strokeWidth="2" />
          <rect x="70" y="145" width="28" height="90" fill="none" stroke="#eefbea" strokeWidth="2" />
          <rect x="498" y="112" width="72" height="156" fill="none" stroke="#eefbea" strokeWidth="2" />
          <rect x="542" y="145" width="28" height="90" fill="none" stroke="#eefbea" strokeWidth="2" />

          <line x1="70" y1="26" x2="570" y2="26" stroke="#57c7ff" strokeWidth="1.25" markerStart={`url(#${arrowHeadId})`} markerEnd={`url(#${arrowHeadId})`} />
          <text x="320" y="18" textAnchor="middle" fill="#f8fbff" fontSize="14" fontWeight="600">
            Duzina: {safeLength} m
          </text>

          <line x1="34" y1="50" x2="34" y2="330" stroke="#57c7ff" strokeWidth="1.25" markerStart={`url(#${arrowHeadId})`} markerEnd={`url(#${arrowHeadId})`} />
          <text x="24" y="190" textAnchor="middle" fill="#f8fbff" fontSize="14" fontWeight="600" transform="rotate(-90 24 190)">
            Sirina: {safeWidth} m
          </text>
        </svg>
      </div>
    </div>
  );
}
