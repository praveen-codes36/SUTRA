import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const BENCHMARK_CLUSTER_SIZES = [7, 5, 6, 6, 4, 6, 6, 4, 4, 4] as const;

export interface PlateRecord {
  index: number;
  clusterIndex: number;
  isDecision: boolean;
  scatteredPos: THREE.Vector3;
  clusteredPos: THREE.Vector3;
  driftPhase: number;
  rotSeed: THREE.Euler;
}

export interface ClusterTopology {
  clusterCenters: THREE.Vector3[];
  plates: PlateRecord[];
  lineSegments: Array<[number, number]>;
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function buildBenchmarkTopology(): ClusterTopology {
  const clusterCenters: THREE.Vector3[] = [];
  const totalClusters = BENCHMARK_CLUSTER_SIZES.length;

  for (let c = 0; c < totalClusters; c++) {
    const t = c / (totalClusters - 1);
    const x = -4.2 + t * 8.4;
    const y = Math.sin(t * Math.PI * 2.2 - 0.5) * 1.45;
    const z = Math.cos(t * Math.PI * 1.8) * 1.35;
    clusterCenters.push(new THREE.Vector3(x, y, z));
  }

  const plates: PlateRecord[] = [];
  const lineSegments: Array<[number, number]> = [];
  let globalIdx = 0;

  BENCHMARK_CLUSTER_SIZES.forEach((size, cIdx) => {
    const center = clusterCenters[cIdx];
    const clusterStartIdx = globalIdx;

    for (let i = 0; i < size; i++) {
      const angle = (i / size) * Math.PI * 2 + cIdx * 0.45;
      const radius = 0.46 + (i % 2) * 0.24;
      const clusteredPos = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius * 0.72,
        center.z + Math.sin(angle * 1.5 + cIdx) * 0.28,
      );

      const scatteredPos = new THREE.Vector3(
        (seededNoise(globalIdx * 3 + 1) - 0.5) * 9.8,
        (seededNoise(globalIdx * 3 + 2) - 0.5) * 5.2,
        (seededNoise(globalIdx * 3 + 3) - 0.5) * 4.2,
      );

      const isDecision = i === size - 1 || (cIdx % 3 === 0 && i === 1);

      plates.push({
        index: globalIdx,
        clusterIndex: cIdx,
        isDecision,
        scatteredPos,
        clusteredPos,
        driftPhase: seededNoise(globalIdx + 17) * Math.PI * 2,
        rotSeed: new THREE.Euler(
          (seededNoise(globalIdx + 31) - 0.5) * 0.35,
          (seededNoise(globalIdx + 53) - 0.5) * 0.45,
          (seededNoise(globalIdx + 71) - 0.5) * 0.25,
        ),
      });

      if (i > 0) {
        lineSegments.push([clusterStartIdx + i - 1, globalIdx]);
      }
      globalIdx++;
    }
  });

  return { clusterCenters, plates, lineSegments };
}

export function createRoundedPlateGeometry(): THREE.ExtrudeGeometry {
  const w = 0.26;
  const h = 0.17;
  const r = 0.032;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.center();
  return geo;
}

export function createCentralGoldNode(): {
  group: THREE.Group;
  outerRing: THREE.Mesh;
  innerCore: THREE.Mesh;
  dispose: () => void;
} {
  const group = new THREE.Group();

  const goldWireMat = new THREE.MeshStandardMaterial({
    color: 0xd5b77b,
    metalness: 0.85,
    roughness: 0.25,
    wireframe: true,
  });
  const goldSolidMat = new THREE.MeshPhysicalMaterial({
    color: 0xd5b77b,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  });
  const ivoryRimMat = new THREE.MeshStandardMaterial({
    color: 0xf5f2ea,
    metalness: 0.15,
    roughness: 0.5,
  });

  const outerRingGeo = new THREE.TorusGeometry(0.56, 0.025, 10, 36);
  const outerRing = new THREE.Mesh(outerRingGeo, goldWireMat);
  group.add(outerRing);

  const collarGeo = new THREE.TorusGeometry(0.36, 0.016, 12, 48);
  const collar = new THREE.Mesh(collarGeo, ivoryRimMat);
  collar.rotation.x = Math.PI / 3;
  group.add(collar);

  const coreGeo = new THREE.OctahedronGeometry(0.24, 1);
  const innerCore = new THREE.Mesh(coreGeo, goldSolidMat);
  group.add(innerCore);

  return {
    group,
    outerRing,
    innerCore,
    dispose: () => {
      outerRingGeo.dispose();
      collarGeo.dispose();
      coreGeo.dispose();
      goldWireMat.dispose();
      goldSolidMat.dispose();
      ivoryRimMat.dispose();
    },
  };
}

export function initStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xf5f2ea, 0x0c211f, 0.85);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff4dd, 1.8);
  keyLight.position.set(5, 7, 6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xd5b77b, 0.9);
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);

  return () => {
    envTarget.dispose();
  };
}

export function afterSoftwareDraw(
  renderer: THREE.WebGLRenderer,
  registerTimer: (id: number) => void,
  cb: () => void,
) {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (!gl || typeof gl.fenceSync !== 'function') {
    registerTimer(window.setTimeout(cb, 80));
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
    if (state === gl.UNSIGNALED) {
      registerTimer(window.setTimeout(poll, 5));
    } else {
      if (sync) gl.deleteSync(sync);
      registerTimer(window.setTimeout(cb, 80));
    }
  };
  registerTimer(window.setTimeout(poll, 5));
}
