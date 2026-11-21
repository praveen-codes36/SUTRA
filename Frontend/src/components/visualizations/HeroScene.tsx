import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  afterSoftwareDraw,
  buildBenchmarkTopology,
  createCentralGoldNode,
  createRoundedPlateGeometry,
  initStudioEnvironment,
} from './sutra3dShared';

export interface HeroSceneProps {
  isSoftwareGl: boolean;
  reducedMotion: boolean;
  onWebGLError?: () => void;
  className?: string;
}

const _dummy = new THREE.Object3D();
const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export const HeroScene: React.FC<HeroSceneProps> = ({
  isSoftwareGl,
  reducedMotion,
  onWebGLError,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const errorCbRef = useRef(onWebGLError);
  errorCbRef.current = onWebGLError;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      errorCbRef.current?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x102d2a, 1);

    const width = container.clientWidth || 520;
    const height = container.clientHeight || 360;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.tabIndex = -1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x102d2a);
    scene.fog = new THREE.FogExp2(0x102d2a, 0.045);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 11.4);
    camera.lookAt(0, 0, 0);

    const disposeEnv = initStudioEnvironment(renderer, scene);
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const topology = buildBenchmarkTopology();
    const plateGeo = createRoundedPlateGeometry();
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5f2ea,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.25,
    });
    const instancedPlates = new THREE.InstancedMesh(
      plateGeo,
      plateMat,
      topology.plates.length,
    );
    instancedPlates.frustumCulled = false;
    rootGroup.add(instancedPlates);

    // Continuous Catmull-Rom gold thread through all 10 cluster centres
    const threadCurve = new THREE.CatmullRomCurve3(topology.clusterCenters);
    const tubeGeo = new THREE.TubeGeometry(threadCurve, 140, 0.026, 8, false);
    const totalTubeIndices = tubeGeo.index ? tubeGeo.index.count : 0;
    const tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xd5b77b,
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 0.6,
    });
    const threadMesh = new THREE.Mesh(tubeGeo, tubeMat);
    rootGroup.add(threadMesh);

    // Intra-cluster connection lines (updated smoothly during assembly)
    const linePositions = new Float32Array(topology.lineSegments.length * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xb8c4be,
      transparent: true,
      opacity: 0,
    });
    const clusterLines = new THREE.LineSegments(lineGeo, lineMat);
    rootGroup.add(clusterLines);

    // Central gold wireframe node
    const centralNode = createCentralGoldNode();
    centralNode.group.position.set(0, 0.1, 0.2);
    centralNode.group.scale.setScalar(0.001);
    rootGroup.add(centralNode.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    const startTime = performance.now();
    let prevTime = startTime;

    const updateSceneAtTime = (elapsedSec: number, dt: number) => {
      // Master §5.2 timeline:
      // 0-2s scattered drift | 2-5s gold thread draws | 5-8s plates gather + lines fade | 8-24s settle + gentle loosen/re-settle
      const threadProgress = reducedMotion ? 1 : smoothstep(2.0, 5.0, elapsedSec);
      const gatherBase = reducedMotion ? 1 : smoothstep(5.0, 8.0, elapsedSec);

      // Gentle ~24s loosen & re-settle breath after 8s
      let loosen = 0;
      if (!reducedMotion && elapsedSec > 10) {
        const cyclePos = (elapsedSec - 10) % 24;
        if (cyclePos > 16 && cyclePos < 22) {
          loosen = Math.sin(((cyclePos - 16) / 6) * Math.PI) * 0.28;
        }
      }
      const clusterMix = Math.max(0, gatherBase - loosen);

      if (totalTubeIndices > 0) {
        const drawCount = Math.floor((totalTubeIndices * threadProgress) / 3) * 3;
        tubeGeo.setDrawRange(0, drawCount);
      }

      const lineOpacity = reducedMotion ? 0.35 : smoothstep(5.4, 7.8, elapsedSec) * (0.38 - loosen * 0.4);
      lineMat.opacity = Math.max(0, lineOpacity);

      const nodeScale = reducedMotion ? 1 : smoothstep(3.5, 6.2, elapsedSec);
      centralNode.group.scale.setScalar(Math.max(0.001, nodeScale));
      if (!reducedMotion) {
        centralNode.outerRing.rotation.z += dt * 0.22;
        centralNode.outerRing.rotation.x = Math.sin(elapsedSec * 0.4) * 0.25;
        centralNode.innerCore.rotation.y += dt * 0.35;
      }

      for (let i = 0; i < topology.plates.length; i++) {
        const p = topology.plates[i];
        const driftAmp = reducedMotion ? 0 : 0.065 * (1 - clusterMix * 0.65);
        _posA.copy(p.scatteredPos);
        _posA.x += Math.sin(elapsedSec * 0.7 + p.driftPhase) * driftAmp;
        _posA.y += Math.cos(elapsedSec * 0.6 + p.driftPhase) * driftAmp;

        _posB.copy(p.clusteredPos);
        if (!reducedMotion) {
          _posB.y += Math.sin(elapsedSec * 0.9 + p.driftPhase) * 0.025;
        }

        _dummy.position.lerpVectors(_posA, _posB, clusterMix);
        _dummy.rotation.set(
          p.rotSeed.x * (1 - clusterMix * 0.6),
          p.rotSeed.y * (1 - clusterMix * 0.6),
          p.rotSeed.z * (1 - clusterMix * 0.5),
        );
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        instancedPlates.setMatrixAt(i, _dummy.matrix);
      }
      instancedPlates.instanceMatrix.needsUpdate = true;

      // Update cluster connecting segments
      const lineAttr = lineGeo.attributes.position as THREE.BufferAttribute;
      for (let s = 0; s < topology.lineSegments.length; s++) {
        const [aIdx, bIdx] = topology.lineSegments[s];
        const pa = topology.plates[aIdx];
        const pb = topology.plates[bIdx];
        _posA.lerpVectors(pa.scatteredPos, pa.clusteredPos, clusterMix);
        _posB.lerpVectors(pb.scatteredPos, pb.clusteredPos, clusterMix);
        lineAttr.setXYZ(s * 2, _posA.x, _posA.y, _posA.z);
        lineAttr.setXYZ(s * 2 + 1, _posB.x, _posB.y, _posB.z);
      }
      lineAttr.needsUpdate = true;

      // Slow ±8° orbit + pointer <= 3° parallax
      if (!reducedMotion) {
        const orbitAngle = Math.sin(Math.max(0, elapsedSec - 7) * 0.18) * THREE.MathUtils.degToRad(8);
        pointerCurrentRef.current.x = THREE.MathUtils.damp(
          pointerCurrentRef.current.x,
          pointerTargetRef.current.x,
          4.5,
          dt,
        );
        pointerCurrentRef.current.y = THREE.MathUtils.damp(
          pointerCurrentRef.current.y,
          pointerTargetRef.current.y,
          4.5,
          dt,
        );
        rootGroup.rotation.y = orbitAngle + pointerCurrentRef.current.x;
        rootGroup.rotation.x = pointerCurrentRef.current.y;
      }
    };

    const scheduleNext = () => {
      if (disposed || !isVisibleRef.current || document.hidden || reducedMotion) return;
      if (isSoftwareGl) {
        afterSoftwareDraw(renderer, (id) => {
          timerId = id;
        }, tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      if (disposed || !isVisibleRef.current || document.hidden) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - prevTime) / 1000);
      prevTime = now;
      const elapsedSec = (now - startTime) / 1000;

      updateSceneAtTime(elapsedSec, dt);
      renderer.render(scene, camera);
      scheduleNext();
    };

    // Initial render
    updateSceneAtTime(reducedMotion ? 10 : 0.05, 0.016);
    renderer.render(scene, camera);
    if (!reducedMotion) {
      scheduleNext();
    }

    const onPointerMove = (e: PointerEvent) => {
      if (reducedMotion || e.pointerType !== 'mouse') return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      const maxRad = THREE.MathUtils.degToRad(3);
      pointerTargetRef.current.x = nx * maxRad;
      pointerTargetRef.current.y = ny * maxRad * 0.6;
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 520;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && isVisibleRef.current && !reducedMotion) {
        prevTime = performance.now();
        scheduleNext();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        isVisibleRef.current = visible;
        if (visible && !document.hidden && !reducedMotion) {
          prevTime = performance.now();
          scheduleNext();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      observer.disconnect();
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      plateGeo.dispose();
      plateMat.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      centralNode.dispose();
      disposeEnv();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isSoftwareGl, reducedMotion]);

  return (
    <div
      ref={mountRef}
      data-testid="hero-3d-scene"
      aria-hidden="true"
      className={`h-[320px] w-full overflow-hidden rounded-[8px] border border-[#1B4A45] bg-[#102D2A] sm:h-[380px] ${className}`}
    />
  );
};

export default HeroScene;
