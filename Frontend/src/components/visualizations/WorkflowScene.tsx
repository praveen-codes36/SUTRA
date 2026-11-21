import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  afterSoftwareDraw,
  buildBenchmarkTopology,
  createCentralGoldNode,
  createRoundedPlateGeometry,
  initStudioEnvironment,
} from './sutra3dShared';

export interface WorkflowSceneProps {
  activeStage: 1 | 2 | 3 | 4;
  isSoftwareGl: boolean;
  reducedMotion: boolean;
  onWebGLError?: () => void;
  className?: string;
}

const _dummy = new THREE.Object3D();
const _posA = new THREE.Vector3();
const _ivory = new THREE.Color(0xf5f2ea);
const _gold = new THREE.Color(0xd5b77b);
const _tempColor = new THREE.Color();

export const WorkflowScene: React.FC<WorkflowSceneProps> = ({
  activeStage,
  isSoftwareGl,
  reducedMotion,
  onWebGLError,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<1 | 2 | 3 | 4>(activeStage);
  const isVisibleRef = useRef(true);
  const errorCbRef = useRef(onWebGLError);
  errorCbRef.current = onWebGLError;

  stageRef.current = activeStage;

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

    const width = container.clientWidth || 540;
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
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.12,
      clearcoat: 0.25,
    });
    const instancedPlates = new THREE.InstancedMesh(
      plateGeo,
      plateMat,
      topology.plates.length,
    );
    instancedPlates.frustumCulled = false;
    for (let i = 0; i < topology.plates.length; i++) {
      instancedPlates.setColorAt(i, _ivory);
    }
    if (instancedPlates.instanceColor) {
      instancedPlates.instanceColor.needsUpdate = true;
    }
    rootGroup.add(instancedPlates);

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

    const centralNode = createCentralGoldNode();
    centralNode.group.position.set(0, 0.1, 0.2);
    centralNode.group.scale.setScalar(0.001);
    rootGroup.add(centralNode.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Damped stage progress values
    let clusterMix = stageRef.current >= 2 ? 1 : 0;
    let decisionMix = stageRef.current >= 3 ? 1 : 0;
    let intelMix = stageRef.current >= 4 ? 1 : 0;

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    let prevTime = performance.now();

    const applyState = (dt: number, elapsedSec: number) => {
      const targetStage = stageRef.current;
      const targetCluster = targetStage >= 2 ? 1 : 0;
      const targetDecision = targetStage >= 3 ? 1 : 0;
      const targetIntel = targetStage >= 4 ? 1 : 0;

      if (reducedMotion) {
        clusterMix = targetCluster;
        decisionMix = targetDecision;
        intelMix = targetIntel;
      } else {
        clusterMix = THREE.MathUtils.damp(clusterMix, targetCluster, 4.5, dt);
        decisionMix = THREE.MathUtils.damp(decisionMix, targetDecision, 4.5, dt);
        intelMix = THREE.MathUtils.damp(intelMix, targetIntel, 4.0, dt);
      }

      if (totalTubeIndices > 0) {
        const drawCount = Math.floor((totalTubeIndices * intelMix) / 3) * 3;
        tubeGeo.setDrawRange(0, drawCount);
      }

      lineMat.opacity = Math.max(0, clusterMix * 0.42);
      centralNode.group.scale.setScalar(Math.max(0.001, intelMix));
      if (!reducedMotion) {
        centralNode.outerRing.rotation.z += dt * 0.25;
        centralNode.innerCore.rotation.y += dt * 0.35;
        rootGroup.rotation.y = Math.sin(elapsedSec * 0.18) * THREE.MathUtils.degToRad(5);
      }

      for (let i = 0; i < topology.plates.length; i++) {
        const p = topology.plates[i];
        _dummy.position.lerpVectors(p.scatteredPos, p.clusteredPos, clusterMix);
        _dummy.rotation.set(
          p.rotSeed.x * (1 - clusterMix * 0.6),
          p.rotSeed.y * (1 - clusterMix * 0.6),
          p.rotSeed.z * (1 - clusterMix * 0.5),
        );
        const scale = p.isDecision ? 1 + decisionMix * 0.22 : 1;
        _dummy.scale.setScalar(scale);
        _dummy.updateMatrix();
        instancedPlates.setMatrixAt(i, _dummy.matrix);

        if (p.isDecision) {
          _tempColor.lerpColors(_ivory, _gold, decisionMix);
          instancedPlates.setColorAt(i, _tempColor);
        } else {
          instancedPlates.setColorAt(i, _ivory);
        }
      }
      instancedPlates.instanceMatrix.needsUpdate = true;
      if (instancedPlates.instanceColor) {
        instancedPlates.instanceColor.needsUpdate = true;
      }

      const lineAttr = lineGeo.attributes.position as THREE.BufferAttribute;
      for (let s = 0; s < topology.lineSegments.length; s++) {
        const [aIdx, bIdx] = topology.lineSegments[s];
        const pa = topology.plates[aIdx];
        const pb = topology.plates[bIdx];
        _posA.lerpVectors(pa.scatteredPos, pa.clusteredPos, clusterMix);
        _posA.lerp(pa.clusteredPos, 0);
        const bx = THREE.MathUtils.lerp(pb.scatteredPos.x, pb.clusteredPos.x, clusterMix);
        const by = THREE.MathUtils.lerp(pb.scatteredPos.y, pb.clusteredPos.y, clusterMix);
        const bz = THREE.MathUtils.lerp(pb.scatteredPos.z, pb.clusteredPos.z, clusterMix);
        lineAttr.setXYZ(s * 2, _posA.x, _posA.y, _posA.z);
        lineAttr.setXYZ(s * 2 + 1, bx, by, bz);
      }
      lineAttr.needsUpdate = true;
    };

    const scheduleNext = () => {
      if (disposed || !isVisibleRef.current || document.hidden) return;
      if (isSoftwareGl) {
        afterSoftwareDraw(renderer, (id) => {
          timerId = id;
        }, tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const startTime = performance.now();
    const tick = () => {
      if (disposed || !isVisibleRef.current || document.hidden) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - prevTime) / 1000);
      prevTime = now;
      applyState(dt, (now - startTime) / 1000);
      renderer.render(scene, camera);
      scheduleNext();
    };

    applyState(0.016, 0);
    renderer.render(scene, camera);
    scheduleNext();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 540;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && isVisibleRef.current) {
        prevTime = performance.now();
        scheduleNext();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        isVisibleRef.current = visible;
        if (visible && !document.hidden) {
          prevTime = performance.now();
          scheduleNext();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      observer.disconnect();
      resizeObserver.disconnect();
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
      data-testid="workflow-3d-scene"
      data-stage={activeStage}
      aria-hidden="true"
      className={`h-[320px] w-full overflow-hidden rounded-[8px] border border-[#1B4A45] bg-[#102D2A] sm:h-[380px] ${className}`}
    />
  );
};

export default WorkflowScene;
