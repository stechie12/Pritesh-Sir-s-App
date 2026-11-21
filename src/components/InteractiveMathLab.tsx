import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Sliders,
  RotateCcw,
  Compass,
  Box,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CurriculumBoard,
  GradeLevel,
  evaluateQuadratic,
  evaluateTrigSightline,
} from '../utils/adaptiveEngine';

type LabSimulationMode = 'quadratic' | 'trigonometry' | 'mensuration3d';

interface InteractiveMathLabProps {
  grade?: GradeLevel;
  board?: CurriculumBoard;
  adaptiveRating?: number;
}

export const InteractiveMathLab: React.FC<InteractiveMathLabProps> = ({
  grade = '10',
  board = 'ICSE',
  adaptiveRating = 1358,
}) => {
  const [mode, setMode] = useState<LabSimulationMode>('mensuration3d');
  const [viewDimension, setViewDimension] = useState<'3D' | '2D'>('3D');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [explodedFactor, setExplodedFactor] = useState<number>(0.25);

  // Quadratic / 3D Paraboloid state: z = a*x^2 + b*x + c (and 3D surface)
  const [quadA, setQuadA] = useState<number>(1);
  const [quadB, setQuadB] = useState<number>(-2);
  const [quadC, setQuadC] = useState<number>(-1);

  // Trigonometry state: Cliff height & Depression angle
  const [cliffHeight, setCliffHeight] = useState<number>(120);
  const [depressionAngle, setDepressionAngle] = useState<number>(40);

  // 3D Mensuration state: Right Circular Cone & Sphere Recasting
  const [coneRadius, setConeRadius] = useState<number>(6);
  const [coneHeight, setConeHeight] = useState<number>(9);

  const [imgError, setImgError] = useState(false);

  // Refs for 3D Three.js Viewport and 2D Blueprint Canvas
  const threeMountRef = useRef<HTMLDivElement | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const sceneObjectsRef = useRef<{
    mensurationGroup?: THREE.Group;
    surfaceGroup?: THREE.Group;
    trigGroup?: THREE.Group;
    coneMesh?: THREE.Mesh;
    coneWire?: THREE.LineSegments;
    altitudeLine?: THREE.Mesh;
    radiusRod?: THREE.Mesh;
    recastSphere?: THREE.Mesh;
    recastRing?: THREE.Mesh;
    surfaceMesh?: THREE.Mesh;
    vertexSphere?: THREE.Mesh;
    cliffBlock?: THREE.Mesh;
    lighthouseGroup?: THREE.Group;
    boatGroup?: THREE.Group;
    sightlineTube?: THREE.Mesh;
  }>({});

  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  // Adapt initial simulation presets to the student's active grade level
  useEffect(() => {
    if (grade === '8' || grade === '9') {
      setConeRadius(5);
      setConeHeight(8);
    } else if (grade === '10') {
      setConeRadius(6);
      setConeHeight(9);
    } else {
      setQuadA(1.5);
      setQuadB(-3);
      setQuadC(-1);
    }
  }, [grade]);

  const quadMetrics = evaluateQuadratic(quadA, quadB, quadC);
  const trigMetrics = evaluateTrigSightline(cliffHeight, depressionAngle);

  const slantHeight = Math.sqrt(coneRadius * coneRadius + coneHeight * coneHeight);
  const coneCurvedArea = Math.PI * coneRadius * slantHeight;
  const coneTotalArea = Math.PI * coneRadius * (slantHeight + coneRadius);
  const coneVolume = (1 / 3) * Math.PI * coneRadius * coneRadius * coneHeight;
  const equivalentSphereRadius = Math.cbrt((coneRadius * coneRadius * coneHeight) / 4);

  // Initialize Three.js Scene once (following Three.js skill software-WebGL + on-demand requestRender rules)
  useEffect(() => {
    const container = threeMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 420;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.028);

    // Mandatory RoomEnvironment studio reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(8.5, 6.2, 10.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 28;
    controls.target.set(0, 1.4, 0);

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    keyLight.position.set(10, 16, 10);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    // Calibrated Coordinate Floor & Pedestal
    const gridHelper = new THREE.GridHelper(22, 22, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const contactDisc = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 32),
      new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      })
    );
    contactDisc.rotation.x = -Math.PI / 2;
    contactDisc.position.y = 0.02;
    scene.add(contactDisc);

    // --- GROUP 1: 3D MENSURATION SOLIDS (Composite 7-part THREE.Group) ---
    const mensurationGroup = new THREE.Group();
    scene.add(mensurationGroup);

    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.3,
    });
    const pedestalBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.24, 32), pedestalMat);
    pedestalBase.position.set(-2.3, 0.12, 0);
    mensurationGroup.add(pedestalBase);

    const coneGeo = new THREE.ConeGeometry(1.8, 3.2, 32, 1);
    const coneMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: 0.68,
      clearcoat: 0.8,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(-2.3, 1.84, 0);
    mensurationGroup.add(coneMesh);

    const coneWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(coneGeo),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc })
    );
    coneWire.position.copy(coneMesh.position);
    mensurationGroup.add(coneWire);

    const altitudeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.7,
    });
    const altitudeLine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 12), altitudeMat);
    altitudeLine.position.set(-2.3, 1.84, 0);
    mensurationGroup.add(altitudeLine);

    const radiusRod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 12), altitudeMat);
    radiusRod.rotation.z = Math.PI / 2;
    radiusRod.position.set(-1.4, 0.26, 0);
    mensurationGroup.add(radiusRod);

    // Recast Equivalent Sphere on Right Pedestal
    const spherePedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.24, 32), pedestalMat);
    spherePedestal.position.set(2.5, 0.12, 0);
    mensurationGroup.add(spherePedestal);

    const recastSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.22,
        metalness: 0.82,
      })
    );
    recastSphere.position.set(2.5, 1.6, 0);
    mensurationGroup.add(recastSphere);

    const recastRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.04, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.6 })
    );
    recastRing.rotation.x = Math.PI / 2;
    recastRing.position.copy(recastSphere.position);
    mensurationGroup.add(recastRing);

    // --- GROUP 2: 3D ALGEBRAIC PARABOLOID & QUADRATIC SURFACE ---
    const surfaceGroup = new THREE.Group();
    surfaceGroup.visible = false;
    scene.add(surfaceGroup);

    const segs = 36;
    const surfGeo = new THREE.PlaneGeometry(7, 7, segs, segs);
    surfGeo.rotateX(-Math.PI / 2);
    const surfMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.3,
      metalness: 0.4,
      side: THREE.DoubleSide,
      wireframe: false,
    });
    const surfaceMesh = new THREE.Mesh(surfGeo, surfMat);
    surfaceGroup.add(surfaceMesh);

    const zeroPlaneRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 3.6, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    zeroPlaneRing.rotation.x = -Math.PI / 2;
    zeroPlaneRing.position.y = 2.0;
    surfaceGroup.add(zeroPlaneRing);

    const vertexSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.8 })
    );
    vertexSphere.position.set(0, 2, 0);
    surfaceGroup.add(vertexSphere);

    // --- GROUP 3: 3D HEIGHTS & DISTANCES CLIFF-TO-BOAT SIGHTLINE ---
    const trigGroup = new THREE.Group();
    trigGroup.visible = false;
    scene.add(trigGroup);

    // Composite Lighthouse + Cliff Assembly (6 parts)
    const lighthouseGroup = new THREE.Group();
    const cliffBlock = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.1 })
    );
    cliffBlock.position.set(-3.5, 1.6, 0);
    lighthouseGroup.add(cliffBlock);

    const towerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.46, 1.6, 20),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.2 })
    );
    towerBody.position.set(-3.5, 4.0, 0);
    lighthouseGroup.add(towerBody);

    const lanternDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.6 })
    );
    lanternDeck.position.set(-3.5, 4.85, 0);
    lighthouseGroup.add(lanternDeck);

    const beaconOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })
    );
    beaconOrb.position.set(-3.5, 5.1, 0);
    lighthouseGroup.add(beaconOrb);

    const roofCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.45, 20),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.3 })
    );
    roofCone.position.set(-3.5, 5.45, 0);
    lighthouseGroup.add(roofCone);
    trigGroup.add(lighthouseGroup);

    // Composite 3D Boat Assembly (4 parts)
    const boatGroup = new THREE.Group();
    const boatHull = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.35, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 })
    );
    boatHull.position.y = 0.2;
    boatGroup.add(boatHull);

    const boatCabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.32, 0.52),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 })
    );
    boatCabin.position.set(-0.1, 0.5, 0);
    boatGroup.add(boatCabin);

    const boatMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.9, 10),
      altitudeMat
    );
    boatMast.position.set(0.3, 0.7, 0);
    boatGroup.add(boatMast);
    boatGroup.position.set(2.8, 0, 0);
    trigGroup.add(boatGroup);

    const sightlineTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 7.5, 12),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
      })
    );
    trigGroup.add(sightlineTube);

    sceneObjectsRef.current = {
      mensurationGroup,
      surfaceGroup,
      trigGroup,
      coneMesh,
      coneWire,
      altitudeLine,
      radiusRod,
      recastSphere,
      recastRing,
      surfaceMesh,
      vertexSphere,
      cliffBlock,
      lighthouseGroup,
      boatGroup,
      sightlineTube,
    };

    // On-demand render scheduler with software-WebGL fenceSync guard
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', requestRender);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Update 3D Scene geometry dynamically whenever sliders or mode change
  useEffect(() => {
    const objs = sceneObjectsRef.current;
    if (!objs.mensurationGroup || !objs.surfaceGroup || !objs.trigGroup) return;

    objs.mensurationGroup.visible = mode === 'mensuration3d';
    objs.surfaceGroup.visible = mode === 'quadratic';
    objs.trigGroup.visible = mode === 'trigonometry';

    if (mode === 'mensuration3d') {
      const rScale = coneRadius / 6;
      const hScale = coneHeight / 9;
      if (objs.coneMesh && objs.coneWire && objs.altitudeLine && objs.radiusRod) {
        objs.coneMesh.scale.set(rScale, hScale, rScale);
        objs.coneMesh.position.y = 0.24 + (3.2 * hScale) / 2 + explodedFactor * 0.8;
        objs.coneWire.scale.copy(objs.coneMesh.scale);
        objs.coneWire.position.copy(objs.coneMesh.position);

        objs.altitudeLine.scale.set(1, hScale, 1);
        objs.altitudeLine.position.y = 0.24 + (3.2 * hScale) / 2;

        objs.radiusRod.scale.set(1, rScale, 1);
        objs.radiusRod.position.x = -2.3 + (1.8 * rScale) / 2;
      }
      if (objs.recastSphere && objs.recastRing) {
        const sRatio = equivalentSphereRadius / 3.5;
        objs.recastSphere.scale.setScalar(Math.max(0.45, Math.min(1.65, sRatio)));
        objs.recastSphere.position.y = 0.24 + 1.35 * objs.recastSphere.scale.y + explodedFactor * 0.5;
        objs.recastRing.scale.setScalar(objs.recastSphere.scale.x);
        objs.recastRing.position.copy(objs.recastSphere.position);
      }
    } else if (mode === 'quadratic' && objs.surfaceMesh && objs.vertexSphere) {
      const geo = objs.surfaceMesh.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const safeA = quadA === 0 ? 0.5 : quadA;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const val = 0.18 * (safeA * (x * x + 0.5 * z * z) + quadB * x + quadC);
        pos.setY(i, Math.max(-0.5, Math.min(5.2, 2.0 + val)));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();

      const vx = Math.max(-3, Math.min(3, quadMetrics.vertexX));
      const vy = Math.max(-0.5, Math.min(5.2, 2.0 + 0.18 * quadMetrics.vertexY));
      objs.vertexSphere.position.set(vx, vy, 0);
    } else if (
      mode === 'trigonometry' &&
      objs.lighthouseGroup &&
      objs.boatGroup &&
      objs.sightlineTube
    ) {
      const hRatio = cliffHeight / 120;
      objs.lighthouseGroup.scale.set(1, Math.max(0.5, Math.min(1.4, hRatio)), 1);

      const boatX = Math.max(-0.5, Math.min(5.2, -3.5 + trigMetrics.horizontalDistanceM * 0.042));
      objs.boatGroup.position.set(boatX, 0, 0);

      const startVec = new THREE.Vector3(-3.5, 5.1 * objs.lighthouseGroup.scale.y, 0);
      const endVec = new THREE.Vector3(boatX, 0.35, 0);
      const midVec = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
      const dist = startVec.distanceTo(endVec);

      objs.sightlineTube.position.copy(midVec);
      objs.sightlineTube.scale.set(1, dist / 7.5, 1);
      objs.sightlineTube.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        endVec.clone().sub(startVec).normalize()
      );
    }

    requestRenderRef.current?.();
  }, [
    mode,
    coneRadius,
    coneHeight,
    explodedFactor,
    quadA,
    quadB,
    quadC,
    cliffHeight,
    depressionAngle,
    equivalentSphereRadius,
    quadMetrics.vertexX,
    quadMetrics.vertexY,
    trigMetrics.horizontalDistanceM,
  ]);

  // 2D Blueprint Canvas Renderer (when user switches to 2D Blueprint or inspects side-by-side)
  useEffect(() => {
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 680;
    const height = 400;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (mode === 'quadratic') {
      const originX = width / 2;
      const originY = height / 2 + 20;
      const scale = 28;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      const safeA = quadA === 0 ? 0.5 : quadA;
      let started = false;
      for (let px = 0; px <= width; px += 2) {
        const xVal = (px - originX) / scale;
        const yVal = safeA * xVal * xVal + quadB * xVal + quadC;
        const py = originY - yVal * scale;
        if (py >= -100 && py <= height + 100) {
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
    } else if (mode === 'trigonometry') {
      const cliffX = 110;
      const waterY = 325;
      const topY = Math.max(70, waterY - cliffHeight * 1.35);
      const boatX = Math.min(width - 70, cliffX + trigMetrics.horizontalDistanceM * 1.85);

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, waterY);
      ctx.lineTo(width - 30, waterY);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cliffX, topY);
      ctx.lineTo(cliffX, waterY);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cliffX, topY);
      ctx.lineTo(boatX, waterY);
      ctx.stroke();
    } else {
      const cx = width / 2;
      const baseY = 305;
      const rx = Math.min(180, coneRadius * 14);
      const ry = Math.max(16, rx * 0.28);
      const apexY = Math.max(55, baseY - coneHeight * 16);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - rx, baseY);
      ctx.lineTo(cx, apexY);
      ctx.lineTo(cx + rx, baseY);
      ctx.stroke();
    }
  }, [mode, viewDimension, quadA, quadB, quadC, cliffHeight, depressionAngle, coneRadius, coneHeight, trigMetrics.horizontalDistanceM]);

  const handleReset = () => {
    setExplodedFactor(0.25);
    if (mode === 'quadratic') {
      setQuadA(1);
      setQuadB(-2);
      setQuadC(-1);
    } else if (mode === 'trigonometry') {
      setCliffHeight(120);
      setDepressionAngle(40);
    } else {
      setConeRadius(6);
      setConeHeight(9);
    }
  };

  return (
    <section aria-labelledby="math-lab-heading" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 id="math-lab-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Interactive 3D Spatial &amp; Function Simulation Lab
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Calibrated for Standard {grade} ({board}) · Level {adaptiveRating} ELO · Drag to orbit 3D solids, paraboloid surfaces, and coastal sightlines.
          </p>
        </div>

        {/* Simulation Mode & 3D/2D Viewport Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('mensuration3d')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'mensuration3d'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ch 20 · 3D Cone &amp; Sphere Recasting
            </button>
            <button
              type="button"
              onClick={() => setMode('quadratic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'quadratic'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ch 5 · 3D Quadratic Surface
            </button>
            <button
              type="button"
              onClick={() => setMode('trigonometry')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'trigonometry'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ch 22 · 3D Lighthouse Sightline
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewDimension('3D')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewDimension === '3D'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Spatial WebGL</span>
            </button>
            <button
              type="button"
              onClick={() => setViewDimension('2D')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewDimension === '2D'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Blueprint</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two-Zone Sandbox Layout (65% 3D/2D Stage / 35% Live Parameter & Formula Deck) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Zone: Interactive 3D WebGL Stage with Unified Bottom Control Dock */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>{viewDimension === '3D' ? '3D Orbit Viewport (Drag to Rotate · Scroll to Zoom)' : '2D Coordinate Cross-Section'}</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span className="font-mono tabular-nums">
                {mode === 'quadratic'
                  ? `z = (${quadA})x² + (${quadB})x + (${quadC})`
                  : mode === 'trigonometry'
                  ? `tan(${depressionAngle}°) = ${cliffHeight} / ${trigMetrics.horizontalDistanceM}`
                  : `V = ⅓π(${coneRadius})²(${coneHeight}) = ${coneVolume.toFixed(1)} cm³`}
              </span>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset View
            </button>
          </div>

          {/* 3D WebGL Mount Container + Collapsible Bottom Control Dock (Zero backdrop-filter over WebGL) */}
          <div className="relative w-full h-[380px] sm:h-[420px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <div
              ref={threeMountRef}
              data-testid="threejs-spatial-viewport"
              className={`w-full h-full ${viewDimension === '3D' ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={canvas2dRef}
              data-testid="math-lab-canvas"
              className={`w-full h-full ${viewDimension === '2D' ? 'block' : 'hidden'}`}
            />

            {/* Collapsible Bottom Control Dock inside 3D Viewport */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[92%] max-w-[540px]">
              <div className="flex justify-center mb-1">
                <button
                  type="button"
                  onClick={() => setDockCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-t-md bg-slate-900/95 border border-b-0 border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:text-white"
                >
                  {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{dockCollapsed ? 'Show 3D Inspection Dock' : 'Hide 3D Dock'}</span>
                </button>
              </div>
              {!dockCollapsed && (
                <div className="rounded-lg bg-slate-900/95 border border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-200">
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <label htmlFor="exploded-view-slider" className="whitespace-nowrap text-[11px] text-slate-300">
                      3D Elevation Offset:
                    </label>
                    <input
                      id="exploded-view-slider"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={explodedFactor}
                      onChange={(e) => setExplodedFactor(Number(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                  </div>
                  <div className="font-mono tabular-nums text-[11px] text-sky-400">
                    Std {grade} ({board}) · 3D PBR Studio
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Semantic State Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {mode === 'quadratic' && (
              <>
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {quadMetrics.discriminant >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ● REAL ROOTS INTERSECTION — {quadMetrics.natureOfRoots}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      ▲ COMPLEX CONJUGATE STATE — {quadMetrics.natureOfRoots}
                    </span>
                  )}
                </div>
                <div className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  Δ = {quadMetrics.discriminant} · Roots: {quadMetrics.rootsText}
                </div>
              </>
            )}

            {mode === 'trigonometry' && (
              <>
                <div className="font-medium text-sky-600 dark:text-sky-400">
                  ● 3D SIGHTLINE LOCKED — Angle of Depression θ = {depressionAngle}°
                </div>
                <div className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  Base Distance x = {trigMetrics.horizontalDistanceM} m · 3D Sightline = {trigMetrics.sightlineHypotenuseM} m
                </div>
              </>
            )}

            {mode === 'mensuration3d' && (
              <>
                <div className="font-medium text-emerald-600 dark:text-emerald-400">
                  ● 3D VOLUME CONSERVATION — Recast Sphere R = {equivalentSphereRadius.toFixed(2)} cm
                </div>
                <div className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  Cone V = {coneVolume.toFixed(1)} cm³ · Slant l = {slantHeight.toFixed(2)} cm
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Zone: Real-Time Parameter Sliders & Curriculum Equations */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Sliders className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Real-Time 3D Parameter Sliders &amp; Equations</span>
            </div>

            {mode === 'mensuration3d' && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-cone-r">Cone Base Radius (r)</label>
                    <span className="font-mono tabular-nums">{coneRadius} cm</span>
                  </div>
                  <input
                    id="slider-cone-r"
                    type="range"
                    min={3}
                    max={12}
                    step={1}
                    value={coneRadius}
                    onChange={(e) => setConeRadius(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-cone-h">Cone Vertical Height (h)</label>
                    <span className="font-mono tabular-nums">{coneHeight} cm</span>
                  </div>
                  <input
                    id="slider-cone-h"
                    type="range"
                    min={4}
                    max={15}
                    step={1}
                    value={coneHeight}
                    onChange={(e) => setConeHeight(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  <p>Slant Height l = √({coneRadius}² + {coneHeight}²) = {slantHeight.toFixed(2)} cm</p>
                  <p>Curved Surface Area (πrl) = {coneCurvedArea.toFixed(2)} cm²</p>
                  <p>Total Surface Area πr(l+r) = {coneTotalArea.toFixed(2)} cm²</p>
                  <p className="text-sky-600 dark:text-sky-400">
                    Recast Sphere Radius: (4/3)πR³ = (1/3)πr²h ⇒ R = {equivalentSphereRadius.toFixed(2)} cm
                  </p>
                </div>
              </div>
            )}

            {mode === 'quadratic' && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-quad-a">Curvature / Leading Coefficient (a)</label>
                    <span className="font-mono tabular-nums">{quadA}</span>
                  </div>
                  <input
                    id="slider-quad-a"
                    type="range"
                    min={-3}
                    max={3}
                    step={0.5}
                    value={quadA}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setQuadA(val === 0 ? 0.5 : val);
                    }}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-quad-b">Linear Slope Coefficient (b)</label>
                    <span className="font-mono tabular-nums">{quadB}</span>
                  </div>
                  <input
                    id="slider-quad-b"
                    type="range"
                    min={-6}
                    max={6}
                    step={1}
                    value={quadB}
                    onChange={(e) => setQuadB(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-quad-c">Vertical Shift Constant (c)</label>
                    <span className="font-mono tabular-nums">{quadC}</span>
                  </div>
                  <input
                    id="slider-quad-c"
                    type="range"
                    min={-5}
                    max={5}
                    step={1}
                    value={quadC}
                    onChange={(e) => setQuadC(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  <p>Discriminant Δ = b² − 4ac = {quadMetrics.discriminant}</p>
                  <p>3D Extremum Vertex = ({quadMetrics.vertexX}, {quadMetrics.vertexY})</p>
                  <p>Sum of Roots (α + β) = {quadMetrics.sumOfRoots} · Product (αβ) = {quadMetrics.productOfRoots}</p>
                </div>
              </div>
            )}

            {mode === 'trigonometry' && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-cliff-h">Cliff &amp; Lighthouse Height (h)</label>
                    <span className="font-mono tabular-nums">{cliffHeight} m</span>
                  </div>
                  <input
                    id="slider-cliff-h"
                    type="range"
                    min={40}
                    max={180}
                    step={10}
                    value={cliffHeight}
                    onChange={(e) => setCliffHeight(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <label htmlFor="slider-trig-angle">Angle of Depression (θ)</label>
                    <span className="font-mono tabular-nums">{depressionAngle}°</span>
                  </div>
                  <input
                    id="slider-trig-angle"
                    type="range"
                    min={15}
                    max={75}
                    step={5}
                    value={depressionAngle}
                    onChange={(e) => setDepressionAngle(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  <p>tan({depressionAngle}°) = {trigMetrics.tanValue} ⇒ Base x = {trigMetrics.horizontalDistanceM} m</p>
                  <p>3D Laser Sightline Hypotenuse = {trigMetrics.sightlineHypotenuseM} m</p>
                </div>
              </div>
            )}
          </div>

          {/* Illustrated Textbook Reference Diagram with Resilient Fallback */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Selina Concise Visual Reference · Cliff Sightline &amp; Ratios
            </div>
            {!imgError ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900">
                <img
                  src="/src/assets/images/diagram_trigonometry_circle_1793965187415.jpg"
                  alt="Selina Concise Heights and Distances cliff tower to boat angle of depression diagram"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-36 object-cover"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 p-4">
                <Compass className="w-6 h-6 text-sky-600 dark:text-sky-400 shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>Sightline Theorem:</strong> Angle of depression θ from horizontal sightline equals angle of elevation from the boat.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
