import React from 'react';

/**
 * Shared deterministic cluster geometry for the 10 benchmark threads:
 * sizes: [7, 5, 6, 6, 4, 6, 6, 4, 4, 4] (52 emails total).
 */
export const CLUSTER_SIZES = [7, 5, 6, 6, 4, 6, 6, 4, 4, 4] as const;

const CLUSTER_CENTERS: Array<[number, number]> = [
  [54, 245],
  [96, 148],
  [146, 224],
  [184, 118],
  [234, 242],
  [264, 160],
  [316, 108],
  [348, 224],
  [392, 148],
  [430, 84],
];

const CENTRAL_NODE: [number, number] = [248, 166];

function buildPlates() {
  const plates: Array<{
    cx: number;
    cy: number;
    clusterIdx: number;
    indexInCluster: number;
    isDecision: boolean;
  }> = [];

  CLUSTER_SIZES.forEach((size, cIdx) => {
    const [kx, ky] = CLUSTER_CENTERS[cIdx];
    for (let i = 0; i < size; i++) {
      const angle = (i / size) * Math.PI * 2 + cIdx * 0.55;
      const radius = 13 + (i % 2) * 8;
      plates.push({
        cx: kx + Math.cos(angle) * radius,
        cy: ky + Math.sin(angle) * radius * 0.78,
        clusterIdx: cIdx,
        indexInCluster: i,
        isDecision: i === size - 1 || (cIdx % 3 === 0 && i === 1),
      });
    }
  });
  return plates;
}

const PLATES = buildPlates();

const THREAD_PATH =
  'M 54 245 C 76 198, 82 160, 96 148 C 118 128, 130 232, 146 224 C 166 214, 164 128, 184 118 C 208 106, 214 236, 234 242 C 252 248, 244 172, 264 160 C 284 148, 296 116, 316 108 C 334 100, 330 218, 348 224 C 368 230, 374 162, 392 148 C 408 135, 416 104, 430 84';

export interface HeroSvgFallbackProps {
  reducedMotion?: boolean;
  className?: string;
}

export const HeroSvgFallback: React.FC<HeroSvgFallbackProps> = ({
  reducedMotion = false,
  className = '',
}) => {
  return (
    <div
      data-testid="hero-svg-fallback"
      className={`relative w-full overflow-hidden rounded-[8px] border border-[#1B4A45] bg-[#102D2A] ${className}`}
    >
      <span className="sr-only">
        Diagram of 52 email message plates grouped into 10 conversation clusters connected by a single gold thread through a central intelligence node.
      </span>
      <svg
        viewBox="0 0 480 320"
        aria-hidden="true"
        className="block h-auto w-full"
      >
        <defs>
          <radialGradient id="sutraHeroField" cx="52%" cy="52%" r="60%">
            <stop offset="0%" stopColor="#1B4A45" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#102D2A" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="480" height="320" fill="#102D2A" />
        <rect width="480" height="320" fill="url(#sutraHeroField)" />

        {/* Subtle intra-cluster connections */}
        {CLUSTER_SIZES.map((size, cIdx) => {
          const clusterPlates = PLATES.filter((p) => p.clusterIdx === cIdx);
          return clusterPlates.slice(1).map((p, idx) => {
            const prev = clusterPlates[idx];
            return (
              <line
                key={`link-${cIdx}-${idx}`}
                x1={prev.cx}
                y1={prev.cy}
                x2={p.cx}
                y2={p.cy}
                stroke="#B8C4BE"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
            );
          });
        })}

        {/* Cluster anchor subtle rings */}
        {CLUSTER_CENTERS.map(([kx, ky], idx) => (
          <circle
            key={`center-${idx}`}
            cx={kx}
            cy={ky}
            r="3.2"
            fill="#F5F2EA"
            fillOpacity="0.85"
          />
        ))}

        {/* 52 ivory message plates */}
        {PLATES.map((p, i) => (
          <rect
            key={`plate-${i}`}
            x={p.cx - 4.5}
            y={p.cy - 3}
            width="9"
            height="6"
            rx="1.5"
            fill={p.isDecision ? '#D5B77B' : '#F5F2EA'}
            fillOpacity={p.isDecision ? 0.92 : 0.85}
            stroke="#102D2A"
            strokeWidth="0.6"
          />
        ))}

        {/* Continuous gold thread */}
        <path
          d={THREAD_PATH}
          pathLength={1000}
          fill="none"
          stroke="#D5B77B"
          strokeWidth="2.2"
          strokeLinecap="round"
          className={reducedMotion ? undefined : 'sutra-svg-thread-animate'}
        />

        {/* Central gold node (wireframe ring + core) */}
        <circle
          cx={CENTRAL_NODE[0]}
          cy={CENTRAL_NODE[1]}
          r="15"
          fill="none"
          stroke="#D5B77B"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        <circle
          cx={CENTRAL_NODE[0]}
          cy={CENTRAL_NODE[1]}
          r="6.5"
          fill="#D5B77B"
          stroke="#F5F2EA"
          strokeWidth="1.6"
        />
      </svg>
    </div>
  );
};

export interface WorkflowSvgFallbackProps {
  activeStage: 1 | 2 | 3 | 4;
  onSelectStage?: (stage: 1 | 2 | 3 | 4) => void;
  className?: string;
}

const PANELS: Array<{
  stage: 1 | 2 | 3 | 4;
  label: string;
  caption: string;
}> = [
  { stage: 1, label: '1 · Email messages', caption: 'Individual records' },
  { stage: 2, label: '2 · Connected conversations', caption: 'Reconstructed threads' },
  { stage: 3, label: '3 · Extracted decisions', caption: 'Typed outcomes in gold' },
  { stage: 4, label: '4 · Institutional intelligence', caption: 'Linked to central node' },
];

export const WorkflowSvgFallback: React.FC<WorkflowSvgFallbackProps> = ({
  activeStage,
  onSelectStage,
  className = '',
}) => {
  return (
    <div
      data-testid="workflow-svg-fallback"
      data-stage={activeStage}
      className={`w-full rounded-[8px] border border-[#1B4A45] bg-[#102D2A] p-3 sm:p-4 ${className}`}
    >
      <span className="sr-only">
        Four-panel diagram illustrating how email messages become connected conversations, extracted decisions, and institutional intelligence.
      </span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PANELS.map((panel) => {
          const isActive = panel.stage === activeStage;
          return (
            <button
              key={panel.stage}
              type="button"
              onClick={() => onSelectStage?.(panel.stage)}
              aria-pressed={isActive}
              className={`rounded-[6px] border p-2.5 text-left transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'border-[#D5B77B] bg-[#1B4A45]'
                  : 'border-[#1B4A45] bg-[#102D2A] hover:border-[#B8C4BE]/60'
              }`}
            >
              <svg viewBox="0 0 220 110" aria-hidden="true" className="block h-auto w-full">
                <rect width="220" height="110" rx="4" fill="#0D2421" />
                {panel.stage === 1 && (
                  <>
                    {[
                      [28, 22], [62, 40], [95, 18], [132, 34], [174, 24],
                      [42, 68], [84, 78], [118, 60], [156, 82], [188, 64],
                      [22, 92], [110, 94],
                    ].map(([x, y], idx) => (
                      <rect
                        key={idx}
                        x={x}
                        y={y}
                        width="11"
                        height="7"
                        rx="1.5"
                        fill="#F5F2EA"
                        fillOpacity="0.82"
                      />
                    ))}
                  </>
                )}

                {panel.stage >= 2 && (
                  <>
                    {[
                      [55, 36],
                      [112, 68],
                      [168, 38],
                    ].map(([cx, cy], cIdx) => {
                      const offsets = [
                        [-16, -12],
                        [14, -10],
                        [-12, 12],
                        [16, 10],
                      ];
                      return (
                        <g key={cIdx}>
                          {offsets.map(([dx, dy], pIdx) => (
                            <React.Fragment key={pIdx}>
                              <line
                                x1={cx}
                                y1={cy}
                                x2={cx + dx}
                                y2={cy + dy}
                                stroke="#B8C4BE"
                                strokeOpacity="0.45"
                                strokeWidth="1"
                              />
                              <rect
                                x={cx + dx - 5}
                                y={cy + dy - 3.5}
                                width="10"
                                height="7"
                                rx="1.5"
                                fill={panel.stage >= 3 && pIdx === 1 ? '#D5B77B' : '#F5F2EA'}
                                fillOpacity="0.92"
                              />
                            </React.Fragment>
                          ))}
                        </g>
                      );
                    })}
                  </>
                )}

                {panel.stage === 4 && (
                  <>
                    <path
                      d="M 55 36 Q 85 52, 112 56 T 168 38"
                      fill="none"
                      stroke="#D5B77B"
                      strokeWidth="1.8"
                    />
                    <line x1="112" y1="68" x2="112" y2="56" stroke="#D5B77B" strokeWidth="1.5" />
                    <circle
                      cx="112"
                      cy="54"
                      r="11"
                      fill="none"
                      stroke="#D5B77B"
                      strokeWidth="1"
                      strokeDasharray="2.5 2"
                    />
                    <circle
                      cx="112"
                      cy="54"
                      r="4.8"
                      fill="#D5B77B"
                      stroke="#F5F2EA"
                      strokeWidth="1.2"
                    />
                  </>
                )}
              </svg>
              <div className="mt-2 flex flex-col items-start gap-0.5">
                <span className="font-display text-[12px] font-semibold text-[#F5F2EA]">
                  {panel.label}
                </span>
                <span className="text-[11px] text-[#B8C4BE]">{panel.caption}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
