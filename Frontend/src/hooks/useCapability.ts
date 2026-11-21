import { useEffect, useState } from 'react';
import { usePrefs } from './usePrefs';
import { useReducedMotion } from './useReducedMotion';

export interface CapabilityState {
  canUse3D: boolean;
  isSoftwareGl: boolean;
  isMobileViewport: boolean;
  webglAvailable: boolean;
  reducedMotion: boolean;
  fallbackReason: string | null;
}

function probeWebGL(): { available: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') return { available: false, isSoftwareGl: false };
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return { available: false, isSoftwareGl: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
    return { available: true, isSoftwareGl };
  } catch {
    return { available: false, isSoftwareGl: false };
  }
}

export function useCapability(): CapabilityState {
  const { prefs } = usePrefs();
  const reducedMotion = useReducedMotion();
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const [webglProbe] = useState(() => probeWebGL());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobileViewport = viewportWidth < 768;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  const memory =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined;

  let fallbackReason: string | null = null;
  if (!prefs.enable3D) fallbackReason = 'Disabled in Settings';
  else if (reducedMotion) fallbackReason = 'Reduced motion preference';
  else if (isMobileViewport) fallbackReason = 'Compact viewport';
  else if (!webglProbe.available) fallbackReason = 'WebGL unavailable';
  else if (typeof cores === 'number' && cores <= 4) fallbackReason = 'Low CPU concurrency';
  else if (typeof memory === 'number' && memory <= 4) fallbackReason = 'Low device memory';

  return {
    canUse3D: fallbackReason === null,
    isSoftwareGl: webglProbe.isSoftwareGl,
    isMobileViewport,
    webglAvailable: webglProbe.available,
    reducedMotion,
    fallbackReason,
  };
}
