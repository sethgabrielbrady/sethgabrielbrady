import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as TWEEN from '@tweenjs/tween.js';
import { createText } from 'three/examples/jsm/webxr/Text2D.js';


let showHelper = false;
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let delta: number = 0;


const clock: THREE.Clock = new THREE.Clock();
const scene: THREE.Scene = new THREE.Scene();
const interval = 1/60;
const mixerAnimations: Array<THREE.AnimationMixer> = [];
const koiGroup = new THREE.Group();
const dragonflyGroup = new THREE.Group();
const sceneLights: { sun: THREE.DirectionalLight | null; ambient: THREE.AmbientLight | null; moon: THREE.DirectionalLight | null } = { sun: null, ambient: null, moon: null };

const gltfLoader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const toadModels: THREE.Object3D[] = [];
type SwayData = { model: THREE.Object3D; speed: number; amplitude: number; phase: number; disturbance: number };
const grassSwayData: SwayData[] = [];
const cattailSwayData: SwayData[] = [];
const lilypadFloatData: Array<{ model: THREE.Object3D; speedX: number; speedZ: number; speedY: number; ampX: number; ampZ: number; ampY: number; phase: number }> = [];
let logGroup: THREE.Group | null = null;
const logDrift = { phase: Math.random() * Math.PI * 2 };

// Time-of-day lighting system
let timeOverride: number | null = null; // null = use real time, 1-24 = manual hour

interface TimeKeyframe {
  hour: number;
  skyColor: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  sunY: number;
  sunX: number;
  moonIntensity: number;
}

const timeKeyframes: TimeKeyframe[] = [
  { hour: 0,  skyColor: new THREE.Color(0x0a0a1a), sunColor: new THREE.Color(0x1a1a3a), sunIntensity: 0.1, ambientColor: new THREE.Color(0x0a0a2a), ambientIntensity: 0.15, sunY: 0.5, sunX: 0, moonIntensity: 0.8 },
  { hour: 5,  skyColor: new THREE.Color(0x1a1a3a), sunColor: new THREE.Color(0x3a3a6a), sunIntensity: 0.2, ambientColor: new THREE.Color(0x1a1a3a), ambientIntensity: 0.2, sunY: 1, sunX: -4, moonIntensity: 0.6 },
  { hour: 6,  skyColor: new THREE.Color(0x4a3055), sunColor: new THREE.Color(0xff8844), sunIntensity: 0.8, ambientColor: new THREE.Color(0x553344), ambientIntensity: 0.3, sunY: 2, sunX: -3, moonIntensity: 0.2 },
  { hour: 7,  skyColor: new THREE.Color(0x7a5570), sunColor: new THREE.Color(0xffaa66), sunIntensity: 1.2, ambientColor: new THREE.Color(0x886655), ambientIntensity: 0.4, sunY: 3, sunX: -2, moonIntensity: 0 },
  { hour: 9,  skyColor: new THREE.Color(0x88aacc), sunColor: new THREE.Color(0xffeedd), sunIntensity: 1.8, ambientColor: new THREE.Color(0xaabbcc), ambientIntensity: 0.5, sunY: 4.5, sunX: -1, moonIntensity: 0 },
  { hour: 12, skyColor: new THREE.Color(0x222233), sunColor: new THREE.Color(0xffffff), sunIntensity: 2.0, ambientColor: new THREE.Color(0xffffff), ambientIntensity: 0.5, sunY: 5, sunX: 0, moonIntensity: 0 },
  { hour: 15, skyColor: new THREE.Color(0x88aacc), sunColor: new THREE.Color(0xffeedd), sunIntensity: 1.8, ambientColor: new THREE.Color(0xaabbcc), ambientIntensity: 0.5, sunY: 4.5, sunX: 1, moonIntensity: 0 },
  { hour: 17, skyColor: new THREE.Color(0x9a6650), sunColor: new THREE.Color(0xff8844), sunIntensity: 1.2, ambientColor: new THREE.Color(0x886644), ambientIntensity: 0.4, sunY: 3, sunX: 2, moonIntensity: 0 },
  { hour: 18, skyColor: new THREE.Color(0x553040), sunColor: new THREE.Color(0xff6633), sunIntensity: 0.8, ambientColor: new THREE.Color(0x443333), ambientIntensity: 0.3, sunY: 2, sunX: 3, moonIntensity: 0.2 },
  { hour: 19, skyColor: new THREE.Color(0x1a1a3a), sunColor: new THREE.Color(0x3a3a6a), sunIntensity: 0.3, ambientColor: new THREE.Color(0x1a1a3a), ambientIntensity: 0.2, sunY: 1, sunX: 4, moonIntensity: 0.5 },
  { hour: 21, skyColor: new THREE.Color(0x0a0a1a), sunColor: new THREE.Color(0x1a1a3a), sunIntensity: 0.1, ambientColor: new THREE.Color(0x0a0a2a), ambientIntensity: 0.15, sunY: 0.5, sunX: 0, moonIntensity: 0.8 },
  { hour: 24, skyColor: new THREE.Color(0x0a0a1a), sunColor: new THREE.Color(0x1a1a3a), sunIntensity: 0.1, ambientColor: new THREE.Color(0x0a0a2a), ambientIntensity: 0.15, sunY: 0.5, sunX: 0, moonIntensity: 0.8 },
];

function lerpKeyframes(hour: number): TimeKeyframe {
  const h = ((hour % 24) + 24) % 24;
  let a = timeKeyframes[0];
  let b = timeKeyframes[1];
  for (let i = 0; i < timeKeyframes.length - 1; i++) {
    if (h >= timeKeyframes[i].hour && h <= timeKeyframes[i + 1].hour) {
      a = timeKeyframes[i];
      b = timeKeyframes[i + 1];
      break;
    }
  }
  const range = b.hour - a.hour || 1;
  const t = (h - a.hour) / range;
  return {
    hour: h,
    skyColor: a.skyColor.clone().lerp(b.skyColor, t),
    sunColor: a.sunColor.clone().lerp(b.sunColor, t),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    ambientColor: a.ambientColor.clone().lerp(b.ambientColor, t),
    ambientIntensity: a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * t,
    sunY: a.sunY + (b.sunY - a.sunY) * t,
    sunX: a.sunX + (b.sunX - a.sunX) * t,
    moonIntensity: a.moonIntensity + (b.moonIntensity - a.moonIntensity) * t,
  };
}

// Console API for testing
(window as unknown as Record<string, unknown>).setTime = (hour: number) => {
  if (hour < 1 || hour > 24) {
    console.log('Usage: setTime(1-24) — e.g. setTime(6) for sunrise, setTime(12) for noon, setTime(18) for sunset');
    return;
  }
  timeOverride = hour;
  console.log(`Time set to ${hour}:00`);
};
(window as unknown as Record<string, unknown>).resetTime = () => {
  timeOverride = null;
  console.log('Time reset to real clock');
};

// Cache for loaded models — load once, clone many
const modelCache = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }>();

function rngNum(min: number, max: number): number {
  return (Math.random() * (max - min) + min);
}

function loadModel(modelObj: { path: string; scale: number; animation: boolean; timeScale: number; position: { x: number; y: number; z: number; }; rotation: { x: number; y: number; z: number; };  }): Promise<THREE.Object3D | undefined> {
  return new Promise((resolve, reject) => {
    const timeScale = modelObj.timeScale;

    function applyModel(modelScene: THREE.Group, animations: THREE.AnimationClip[]) {
      const model = (modelObj.animation
        ? cloneSkeleton(modelScene)
        : modelScene.clone()) as THREE.Group;
      model.scale.set(modelObj.scale, modelObj.scale, modelObj.scale);
      model.rotateX(modelObj.rotation.x);
      model.rotateY(modelObj.rotation.y);
      model.rotateZ(modelObj.rotation.z);
      model.position.copy(modelObj.position);
      model.castShadow = true;

      if (modelObj.animation && animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerAnimations.push(mixer);
        const action = mixer.clipAction(animations[0]);
        action.setEffectiveTimeScale(timeScale);
        action.play();
      }
      resolve(model);
    }

    const cached = modelCache.get(modelObj.path);
    if (cached) {
      applyModel(cached.scene, cached.animations);
      return;
    }

    gltfLoader.load(modelObj.path,
      (gltf) => {
        modelCache.set(modelObj.path, { scene: gltf.scene, animations: gltf.animations });
        applyModel(gltf.scene, gltf.animations);
      },
      undefined,
      (error) => {
        console.error('An error happened while loading the model:', error);
        reject(error);
      }
    );
  });
}

// Tracks cleanup handles for teardown
const cleanupHandles: { intervals: number[]; timeouts: number[]; listeners: Array<[string, EventListener]>; } = {
  intervals: [],
  timeouts: [],
  listeners: [],
};

function init() {
  scene.background = new THREE.Color( 0x222233 );

  const aspect: number = (window.innerWidth / window.innerHeight);
  const distance: number = 4;


  camera = new THREE.OrthographicCamera(- distance * aspect, distance * aspect, distance, - distance, .1, 1000);
  camera.position.set( 5,5,5 );
  camera.lookAt( scene.position );


  const sunLight = new THREE.DirectionalLight( 0xffffff, 2 );
  sunLight.position.set( 0, 5, 0 );
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 512;
  sunLight.shadow.mapSize.height = 512;
  scene.add( sunLight );

  const ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 );
  scene.add( ambientLight );

  const moonLight = new THREE.DirectionalLight( 0x8090cc, 0 );
  moonLight.position.set( 3, 4, -2 );
  scene.add( moonLight );

  // Store light refs for time-of-day updates
  sceneLights.sun = sunLight;
  sceneLights.ambient = ambientLight;
  sceneLights.moon = moonLight;

  renderer = new THREE.WebGLRenderer( {
    antialias: false,
    alpha: true,
    precision: "mediump",
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.shadowMap.enabled = true;

  const container: HTMLElement = document.getElementById("koiPond")!;
  container.appendChild(renderer.domElement);

  // Resize handler
  const onResize = () => {
    const aspect = window.innerWidth / window.innerHeight;
    const distance = 4;
    camera.left = -distance * aspect;
    camera.right = distance * aspect;
    camera.top = distance;
    camera.bottom = -distance;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  cleanupHandles.listeners.push(['resize', onResize]);


  koiGroup.position.set(0.0, -0.1, 0.0);
  const koiCount = 10;
  const koiArray: THREE.Object3D<THREE.Object3DEventMap>[] = [];
  const koiMixerMap = new Map<THREE.Object3D, { mixer: THREE.AnimationMixer; baseTimeScale: number }>();
  for (let i = 0; i < koiCount; i++) {
    const koi = {
      scale: rngNum(0.4, 1),
      animation: true,
      timeScale: rngNum(0.09, 0.24),
      path: 'models/koi.glb',
      position: { x:koiGroup.position.x, y: koiGroup.position.y, z: koiGroup.position.z },
      rotation: { x: 0, y: 0, z: 0 }
    }
    const redKoi = 0xff0000;
    const orangeKoi = 0xffa500;
    const whiteKoi = 0xffffff;
    const koiColors = [redKoi, orangeKoi, whiteKoi];
    const randomColor = koiColors[Math.floor(Math.random() * koiColors.length)];
    const baseTimeScale = koi.timeScale;
    loadModel(koi).then(model => {
      if (model) {
        const koiThreeObj = new THREE.Object3D();
        koiThreeObj.add(model);
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            ((child as THREE.Mesh).material as THREE.MeshPhysicalMaterial).color.set(new THREE.Color(randomColor));
          }
        });
        koiGroup.add(koiThreeObj);
        koiArray.push(koiThreeObj);
        // The mixer for this koi is the last one pushed by loadModel
        const mixer = mixerAnimations[mixerAnimations.length - 1];
        koiMixerMap.set(koiThreeObj, { mixer, baseTimeScale });
      }
    });
  }
  scene.add(koiGroup);

  let koiMovingArray: Array<THREE.Object3D<THREE.Object3DEventMap>> = [];
  const koiActiveTweens = new Map<THREE.Object3D, { pos: TWEEN.Tween<THREE.Vector3>; rot: TWEEN.Tween<THREE.Euler> }>();

  function stopKoiTweens(koi: THREE.Object3D) {
    const active = koiActiveTweens.get(koi);
    if (active) {
      active.pos.stop();
      active.rot.stop();
      koiActiveTweens.delete(koi);
    }
    koiMovingArray = koiMovingArray.filter((item) => item !== koi);
  }

  function randomizeKoiMovement(koi: THREE.Object3D<THREE.Object3DEventMap>) {
    const startX = koi.position.x;
    const startZ = koi.position.z;
    const targetX = rngNum(-1.8, 1.8);
    const targetY = rngNum(-0.1, -0.07 );
    const targetZ = rngNum(-1.8, 1.8);

    const angle = Math.atan2(targetX - startX, targetZ - startZ);

    const koiTweenPos = new TWEEN.Tween(koi.position);
      koiTweenPos.to({ x: targetX, y: targetY, z: targetZ }, 20000)
      .onComplete(() => {
        koi.position.set(targetX, targetY, targetZ);
        koiMovingArray = koiMovingArray.filter((item) => item !== koi);
        koiActiveTweens.delete(koi);
      })
      .start();

    const koiTweenRot = new TWEEN.Tween(koi.rotation);
    koiTweenRot.to({ y: angle }, 3000)
      .start();

    koiActiveTweens.set(koi, { pos: koiTweenPos, rot: koiTweenRot });
  }

  // Recursive setTimeout so the interval actually changes over time
  let koiDeploymentActive = true;
  const initialDeploymentDuration = 10000;
  const startTime = Date.now();

  function scheduleKoiDeployment() {
    if (!koiDeploymentActive) return;

    const elapsed = Date.now() - startTime;
    const delay = elapsed < initialDeploymentDuration
      ? rngNum(500, 600)
      : rngNum(10000, 20000);

    const id = window.setTimeout(() => {
      const rngKoiIndex = Math.floor(rngNum(0, koiArray.length));
      const rngKoi = koiArray[rngKoiIndex];
      if (rngKoi && !koiMovingArray.includes(rngKoi)) {
        koiMovingArray.push(rngKoi);
        randomizeKoiMovement(rngKoi);
      }
      scheduleKoiDeployment();
    }, delay);
    cleanupHandles.timeouts.push(id);
  }
  scheduleKoiDeployment();


  dragonflyGroup.position.set(0, 0.25, 0);
  const dragonfly = {
      scale: 2.5,
      animation: true,
      timeScale: 1.0,
      path: 'models/dragonfly.glb',
      position: dragonflyGroup.position,
      rotation: { x: 0, y: 0, z: 0 }
    }

  loadModel(dragonfly).then(model => {
    if (model) {
      dragonflyGroup.add(model);
    }
  });
  scene.add(dragonflyGroup);

  function randomizeDragonflyMovement(dragonfly: THREE.Object3D<THREE.Object3DEventMap>) {
    const startX = dragonfly.position.x;
    const startZ = dragonfly.position.z;
    const targetX = rngNum(-2.5,2.5);
    const targetZ = rngNum(-2.5,2.5);

    const angle = Math.atan2(targetX - startX, targetZ - startZ);

    const dragonflyTweenPos = new TWEEN.Tween(dragonfly.position);
    dragonflyTweenPos.to({ x: targetX, y: dragonflyGroup.position.y, z: targetZ }, 1500)
      .onComplete(() => {
        dragonfly.position.set(targetX, dragonflyGroup.position.y, targetZ);
      })
      .start();

    const dragonflyTweenRot = new TWEEN.Tween(dragonfly.rotation);
    dragonflyTweenRot.to({ y: angle }, 200)
      .start();
  }
  randomizeDragonflyMovement(dragonflyGroup);

  const dragonflyIntervalId = window.setInterval(() => {
    randomizeDragonflyMovement(dragonflyGroup);
  }, rngNum(2000, 4000) + rngNum(200, 10000));
  cleanupHandles.intervals.push(dragonflyIntervalId);


  const grassGroup = new THREE.Group();
  grassGroup.position.set(0.0, -0.260, 0.0);
  const grassCount = 80;
  for (let i = 0; i < grassCount; i++) {
    const grass = {
      scale: rngNum(.09, .4),
      animation: false,
      timeScale: 1.0,
      path: 'models/greengrass.glb',
      position: { x:rngNum(-2,2), y: grassGroup.position.y, z: rngNum(-2,2) },
      rotation: { x: 0, y: 0, z: 0 }
    }
    const phase = rngNum(0, Math.PI * 2);
    const speed = rngNum(0.3, 0.6);
    const amplitude = rngNum(0.01, 0.03);
    loadModel(grass).then(model => {
      if (model) {
        grassGroup.add(model);
        grassSwayData.push({ model, speed, amplitude, phase, disturbance: 0 });
      }
    });
  }
  scene.add(grassGroup);


  const weedsGroup = new THREE.Group();
  weedsGroup.position.set(0.0, -0.270, 0.0);
  const weedsCount = 10;
  for (let i = 0; i < weedsCount; i++) {
    const weeds = {
      scale: rngNum(.09, 0.46),
      animation: false,
      timeScale: 1.0,
      path: 'models/cattail2.glb',
      position: { x:rngNum(-1.25,1.25), y: grassGroup.position.y, z: rngNum(-1.25,1.25) },
      rotation: { x: 0, y: 0, z: 0 }
    }
    const weedPhase = rngNum(0, Math.PI * 2);
    const weedSpeed = rngNum(0.5, 0.9);
    const weedAmplitude = rngNum(0.015, 0.035);
    loadModel(weeds).then(model => {
      if (model) {
        weedsGroup.add(model);
        cattailSwayData.push({ model, speed: weedSpeed, amplitude: weedAmplitude, phase: weedPhase, disturbance: 0 });
      }
    });
  }
  scene.add(weedsGroup);

  const lilipadsGroup = new THREE.Group();
  lilipadsGroup.position.set(0.0, -0.002, 0.0);
  const lilipadsCount = 6;
  for (let i = 0; i < lilipadsCount; i++) {
    const lilipads = {
      scale: rngNum(.09, 0.36),
      animation: false,
      timeScale: 1.0,
      path: 'models/lilypad.glb',
      position: { x:rngNum(-1.25,1.25), y: lilipadsGroup.position.y, z: rngNum(-1.25,1.25) },
      rotation: { x: 0, y: rngNum(-1,1), z: 0 }
    }
    const padPhase1 = rngNum(0, Math.PI * 2);
    loadModel(lilipads).then(model => {
      if (model) {
        lilipadsGroup.add(model);
        lilypadFloatData.push({
          model, phase: padPhase1,
          speedX: rngNum(0.15, 0.3), speedZ: rngNum(0.12, 0.25), speedY: rngNum(0.3, 0.5),
          ampX: rngNum(0.003, 0.008), ampZ: rngNum(0.003, 0.008), ampY: rngNum(0.001, 0.003),
        });
      }
    });
  }
  scene.add(lilipadsGroup);


  const lilipadsGroup2 = new THREE.Group();
  lilipadsGroup2.position.set(0.0, -0.002, 0.0);
  const lilipadsCount2 = 4;
  for (let i = 0; i < lilipadsCount2; i++) {
    const lilipads = {
      scale: rngNum(.09, 0.36),
      animation: false,
      timeScale: 1.0,
      path: 'models/lilypad2.glb',
      position: { x:rngNum(-1.25,1.25), y: lilipadsGroup2.position.y, z: rngNum(-1.25,1.25) },
      rotation: { x: 0, y: rngNum(-1,1), z: 0 }
    }
    const padPhase2 = rngNum(0, Math.PI * 2);
    loadModel(lilipads).then(model => {
      if (model) {
        lilipadsGroup2.add(model);
        lilypadFloatData.push({
          model, phase: padPhase2,
          speedX: rngNum(0.15, 0.3), speedZ: rngNum(0.12, 0.25), speedY: rngNum(0.3, 0.5),
          ampX: rngNum(0.003, 0.008), ampZ: rngNum(0.003, 0.008), ampY: rngNum(0.001, 0.003),
        });
      }
    });
  }
  scene.add(lilipadsGroup2);

  const raccoon = {
    scale: .5,
    animation: true,
    timeScale: 1.0,
    path: 'models/raccoon2.glb',
    position: { x: 2.2, y: 0.1, z: -2.6 },
    rotation: { x: 0, y: 1.5, z: 0 }
  }
  loadModel(raccoon).then(model => {
    if (model) {
      scene.add(model);
    }
  });


  const pond = {
    scale: 1.0,
    animation: false,
    timeScale: 1.0,
    path: 'models/pond4.glb',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  loadModel(pond).then(model => {
    if (model) {
      model.renderOrder = - Infinity;
      scene.add(model);
    }
  });


  const water = {
    scale: 1,
    animation: false,
    timeScale: 1.0,
    path: 'models/water2.glb',
    position: { x: 0, y: -0.0002, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  loadModel(water).then(model => {
    if (model) {

      model.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) {
            ((object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).transparent = true;
            ((object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).depthWrite = false;
            ((object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).depthTest = true;
            ((object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
            ((object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).opacity = 0.5;
            ((object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).color.set(new THREE.Color(0x00ffff));
          }
      });

      scene.add(model);
    }
  });


  const tree = {
    scale: 0.60,
    animation: false,
    timeScale: 1.0,
    path: 'models/tree.glb',
    position: { x: -0.7, y: 0, z: -2.0 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  loadModel(tree).then(model => {
    if (model) {
      scene.add(model);
    }
  });

  const frogPad = {
    scale: 0.5,
    animation: false,
    timeScale: 1,
    path: 'models/lilypad.glb',
    position: { x: 0, y: -0.01, z: 0 },
    rotation: { x: 0, y: -0.7, z: 0 }
  }
  loadModel(frogPad).then(model => {
    if (model) {
      scene.add(model);
    }
  });

  const cattail = {
    scale: .4,
    animation: false,
    timeScale: 1,
    path: 'models/cattail.glb',
    position: { x: .65, y: -.1, z: -1.2 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  loadModel(cattail).then(model => {
    if (model) {
      scene.add(model);
      cattailSwayData.push({ model, speed: rngNum(0.5, 0.9), amplitude: rngNum(0.015, 0.035), phase: rngNum(0, Math.PI * 2), disturbance: 0 });
    }
  });

  const cattail2 = {
    scale: .4,
    animation: false,
    timeScale: 1,
    path: 'models/cattail2.glb',
    position: { x: 0, y: -.1, z: -1.15 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  loadModel(cattail2).then(model => {
    if (model) {
      scene.add(model);
      cattailSwayData.push({ model, speed: rngNum(0.5, 0.9), amplitude: rngNum(0.015, 0.035), phase: rngNum(0, Math.PI * 2), disturbance: 0 });
    }
  });

  const rockCattail = {
    scale: .4,
    animation: false,
    timeScale: 1,
    path: 'models/cattail.glb',
    position: { x: -1.25, y: -.1, z: -0.10 },
    rotation: { x: 0, y: .2, z: 0 }
  }
  loadModel(rockCattail).then(model => {
    if (model) {
      scene.add(model);
      cattailSwayData.push({ model, speed: rngNum(0.5, 0.9), amplitude: rngNum(0.015, 0.035), phase: rngNum(0, Math.PI * 2), disturbance: 0 });
    }
  });

  logGroup = new THREE.Group();
  logGroup.position.set(.5, 0, -1.45);

  const log = {
    scale: .5,
    animation: false,
    timeScale: 1,
    path: 'models/log.glb',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0.5, z: 0 }
  }
  loadModel(log).then(model => {
    if (model && logGroup) {
      logGroup.add(model);
    }
  });

  const logToad = {
    scale: .20,
    animation: true,
    timeScale: 0.5,
    path: 'models/toad.glb',
    position: { x: 0, y: .07, z: -0.05 },
    rotation: { x: 0, y: .5, z: 0 }
  }
  loadModel(logToad).then(model => {
    if (model && logGroup) {
      logGroup.add(model);
      toadModels.push(model);
    }
  });
  scene.add(logGroup);

  const lilyToad = {
    scale: .30,
    animation: true,
    timeScale: 0.5,
    path: 'models/toad.glb',

    position: { x: 0, y: -0.00001, z: -.02},
    rotation: { x: 0, y: 0, z: 0 }
  }
  loadModel(lilyToad).then(model => {
    if (model) {
      scene.add(model);
      toadModels.push(model);
    }
  });

  const bench = {
    scale: .125,
    animation: true,
    timeScale: 0.5,
    path: 'models/bench2.glb',
    position: { x:-1.2, y: .07, z: 2.2 },
    rotation: { x: 0, y: 2.5, z: 0 }
  }
  loadModel(bench).then(model => {
    if (model) {
      scene.add(model);
    }
  });


  // Toad hop on click
  const hoppingToads = new Set<THREE.Object3D>();

  function hopToad(toad: THREE.Object3D) {
    if (hoppingToads.has(toad)) return;
    hoppingToads.add(toad);

    const startY = toad.position.y;
    const hopHeight = startY + 0.3;

    new TWEEN.Tween(toad.position)
      .to({ y: hopHeight }, 500)
      .easing(TWEEN.Easing.Quadratic.Out)
      .chain(
        new TWEEN.Tween(toad.position)
          .to({ y: startY }, 500)
          .easing(TWEEN.Easing.Quadratic.In)
          .onComplete(() => { hoppingToads.delete(toad); })
      )
      .start();
  }

  // Koi flee on click
  const fleeingKoi = new Set<THREE.Object3D>();

  function findKoiParent(hit: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = hit;
    while (current) {
      if (koiArray.includes(current)) return current;
      current = current.parent;
    }
    return null;
  }

  function fleeKoi(koi: THREE.Object3D) {
    if (fleeingKoi.has(koi)) return;
    stopKoiTweens(koi);
    fleeingKoi.add(koi);

    // Dart away from current position in the opposite direction from center
    const dirX = koi.position.x || rngNum(-1, 1);
    const dirZ = koi.position.z || rngNum(-1, 1);
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const targetX = Math.max(-1.8, Math.min(1.8, koi.position.x + (dirX / len) * 0.75));
    const targetZ = Math.max(-1.8, Math.min(1.8, koi.position.z + (dirZ / len) * 0.75));

    const angle = Math.atan2(targetX - koi.position.x, targetZ - koi.position.z);

    // Speed up swim animation 6x during flee
    const entry = koiMixerMap.get(koi);
    if (entry) {
      entry.mixer.timeScale = entry.baseTimeScale * 6;
    }

    new TWEEN.Tween(koi.rotation)
      .to({ y: angle }, 200)
      .start();

    new TWEEN.Tween(koi.position)
      .to({ x: targetX, z: targetZ }, 1000)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onComplete(() => {
        fleeingKoi.delete(koi);
        // Restore original animation speed
        if (entry) {
          entry.mixer.timeScale = entry.baseTimeScale;
        }
      })
      .start();
  }

  // Disturb grass near a world-space point
  function disturbGrassNear(x: number, z: number, radius: number) {
    for (const g of grassSwayData) {
      const worldPos = new THREE.Vector3();
      g.model.getWorldPosition(worldPos);
      const dx = worldPos.x - x;
      const dz = worldPos.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < radius) {
        g.disturbance = Math.max(g.disturbance, 1.0 - dist / radius);
      }
    }
  }

  const onClick = (event: MouseEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    // Check toads
    for (const toad of toadModels) {
      const intersects = raycaster.intersectObject(toad, true);
      if (intersects.length > 0) {
        hopToad(toad);
        return;
      }
    }

    // Check koi
    const koiIntersects = raycaster.intersectObject(koiGroup, true);
    if (koiIntersects.length > 0) {
      const koi = findKoiParent(koiIntersects[0].object);
      if (koi) {
        fleeKoi(koi);
        return;
      }
    }

    // Check grass
    const grassIntersects = raycaster.intersectObject(grassGroup, true);
    if (grassIntersects.length > 0) {
      const hitPoint = grassIntersects[0].point;
      disturbGrassNear(hitPoint.x, hitPoint.z, 0.5);
    }
  };
  window.addEventListener('click', onClick);
  cleanupHandles.listeners.push(['click', onClick as EventListener]);

  const bottomColor = 0x4C4E27;
  const bottomGeometry = new THREE.PlaneGeometry( 4, 4);
  const bottomMaterial = new THREE.MeshPhongMaterial({
                                                  color: bottomColor,
                                                  transparent: false,
                                                });
  const bottom = new THREE.Mesh( bottomGeometry, bottomMaterial );
  bottom.rotation.x = - Math.PI / 2;
  bottom.position.y = -0.509;
  scene.add( bottom );



  // controls for the camera
  const orbitControls = new OrbitControls(camera, renderer.domElement)
  orbitControls.enabled = true;
  orbitControls.enableRotate = true;
  orbitControls.keyPanSpeed = 60.0
  orbitControls.enableZoom = true

 //axes helper
    const axesHelper = new THREE.AxesHelper( 5 );
    const xText = createText( 'x5', 0.5);
    const xText2 = createText( '-x5', 0.5 );
    const xText3 = createText( 'x2.5', 0.5 );
    const xText4 = createText( '-x2.5', 0.5 );
    const zText = createText( "z5", 0.5 );
    const zText2 = createText( "-z5", 0.5 );
    const zText3 = createText( "z2.5", 0.5 );
    const zText4 = createText( "-z2.5", 0.5 );
    const axisGroup = new THREE.Group();

    xText.position.set( 5, 1, 0 );
    xText2.position.set( -5, 1, 0 );
    xText3.position.set( 2.5, 1, 0 );
    xText4.position.set( -2.5, 1, 0 );
    zText.position.set( 0, 1, 5 );
    zText2.position.set( 0, 1, -5 );
    zText3.position.set( 0, 1, 2.5 );
    zText4.position.set( 0, 1, -2.5 )

    xText.rotation.x = Math.PI * 2;
    xText2.rotation.x = Math.PI * 2;
    xText3.rotation.x = Math.PI * 2;
    xText4.rotation.x = Math.PI * 2;
    zText.rotation.x = Math.PI * 2;
    zText2.rotation.x = Math.PI * 2;
    zText3.rotation.x = Math.PI * 2;
    zText4.rotation.x = Math.PI * 2;

    axisGroup.add(xText, zText, xText2, zText2, xText3, zText3, xText4, zText4);

    if (showHelper) {
      scene.add(axisGroup);
      scene.add(axesHelper);
    } else {
      scene.remove(axisGroup);
      scene.remove( axesHelper );
    }

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'h') {
      if (showHelper) {
        scene.remove(axisGroup);
        scene.remove( axesHelper );
        showHelper = false;
      } else {
        scene.add(axisGroup);
        scene.add(axesHelper);
        showHelper = true;
      }
    }
  };
  window.addEventListener('keydown', onKeydown);
  cleanupHandles.listeners.push(['keydown', onKeydown as EventListener]);

  // Return a stop flag for the koi deployment
  return () => { koiDeploymentActive = false; };
}


let animationFrameId: number;

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  delta += clock.getDelta();
  if (delta  > interval) {
    render();
    delta = delta % interval;
  }
}

function render() {
  const elapsed = clock.elapsedTime;

  // Shared helper for sway with koi disturbance
  const _worldPos = new THREE.Vector3();

  function updateSway(items: SwayData[]) {
    for (let i = 0; i < items.length; i++) {
      const g = items[i];

      g.model.getWorldPosition(_worldPos);
      let koiInfluence = 0;
      for (let k = 0; k < koiGroup.children.length; k++) {
        const koiChild = koiGroup.children[k];
        const dx = _worldPos.x - koiChild.position.x;
        const dz = _worldPos.z - koiChild.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.4) {
          koiInfluence = Math.max(koiInfluence, 1.0 - dist / 0.4);
        }
      }

      g.disturbance = Math.max(g.disturbance, koiInfluence);

      const totalAmplitude = g.amplitude + g.disturbance * 0.12;
      const totalSpeed = g.speed + g.disturbance * 1.5;
      g.model.rotation.x = Math.sin(elapsed * totalSpeed + g.phase) * totalAmplitude;
      g.model.rotation.z = Math.cos(elapsed * totalSpeed * 0.7 + g.phase) * totalAmplitude * 0.5;

      g.disturbance *= 0.96;
      if (g.disturbance < 0.001) g.disturbance = 0;
    }
  }

  // Grass sway
  updateSway(grassSwayData);

  // Cattail sway
  updateSway(cattailSwayData);

  // Lilypad floating
  for (let i = 0; i < lilypadFloatData.length; i++) {
    const p = lilypadFloatData[i];
    const t = elapsed + p.phase;
    p.model.position.x += Math.sin(t * p.speedX) * p.ampX - Math.sin((t - interval) * p.speedX) * p.ampX;
    p.model.position.z += Math.cos(t * p.speedZ) * p.ampZ - Math.cos((t - interval) * p.speedZ) * p.ampZ;
    p.model.position.y += Math.sin(t * p.speedY) * p.ampY - Math.sin((t - interval) * p.speedY) * p.ampY;
    p.model.rotation.z = Math.sin(t * p.speedX * 0.5) * 0.008;
  }

  // Log idle drift
  if (logGroup) {
    const lt = elapsed + logDrift.phase;
    logGroup.position.x += Math.sin(lt * 0.15) * 0.0004 - Math.sin((lt - interval) * 0.15) * 0.0004;
    logGroup.position.z += Math.cos(lt * 0.12) * 0.0003 - Math.cos((lt - interval) * 0.12) * 0.0003;
    logGroup.position.y = Math.sin(lt * 0.25) * 0.003;
    logGroup.rotation.z = Math.sin(lt * 0.2) * 0.005;
  }

  // Time-of-day lighting
  const currentHour = timeOverride !== null ? timeOverride : new Date().getHours() + new Date().getMinutes() / 60;
  const tod = lerpKeyframes(currentHour);
  scene.background = tod.skyColor;
  if (sceneLights.sun) {
    sceneLights.sun.color.copy(tod.sunColor);
    sceneLights.sun.intensity = tod.sunIntensity;
    sceneLights.sun.position.set(tod.sunX, tod.sunY, 0);
  }
  if (sceneLights.ambient) {
    sceneLights.ambient.color.copy(tod.ambientColor);
    sceneLights.ambient.intensity = tod.ambientIntensity;
  }
  if (sceneLights.moon) {
    sceneLights.moon.intensity = tod.moonIntensity;
  }

  renderer.render( scene, camera );
  TWEEN.update();
  if (mixerAnimations.length > 0) {
    for (let i = 0; i < mixerAnimations.length; i++) {
      mixerAnimations[i].update(delta);
    }
  }
}

function koiPond(): () => void {
  const stopKoiDeployment = init();
  animate();

  // Return cleanup function for Vue unmount
  return () => {
    stopKoiDeployment();
    cancelAnimationFrame(animationFrameId);

    for (const id of cleanupHandles.intervals) clearInterval(id);
    for (const id of cleanupHandles.timeouts) clearTimeout(id);
    for (const [event, listener] of cleanupHandles.listeners) {
      window.removeEventListener(event, listener);
    }

    cleanupHandles.intervals.length = 0;
    cleanupHandles.timeouts.length = 0;
    cleanupHandles.listeners.length = 0;

    renderer.dispose();
    renderer.domElement.remove();
    modelCache.clear();
    mixerAnimations.length = 0;
  };
}


export { koiPond };
