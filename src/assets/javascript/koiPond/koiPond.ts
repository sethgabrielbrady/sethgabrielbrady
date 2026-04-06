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

const gltfLoader = new GLTFLoader();

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


  const light: THREE.DirectionalLight = new THREE.DirectionalLight( 0xffffff, 2 );
  light.position.set( 0, 5, 0 );
  light.castShadow = true;
  scene.add( light );

  const directionLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionLight.position.set( 0, 5, 0 );
    directionLight.castShadow = true;
    directionLight.shadow.mapSize.width = 512;
    directionLight.shadow.mapSize.height = 512;

    scene.add( directionLight );
    scene.add( new THREE.AmbientLight( 0xffffff, 0.5 ) );

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
      }
    });
  }
  scene.add(koiGroup);

  let koiMovingArray: Array<THREE.Object3D<THREE.Object3DEventMap>> = [];

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
      })
      .start();

    const koiTweenRot = new TWEEN.Tween(koi.rotation);
    koiTweenRot.to({ y: angle }, 3000)
      .start();
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
    loadModel(grass).then(model => {
      if (model) {
        grassGroup.add(model);
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
    loadModel(weeds).then(model => {
      if (model) {
        weedsGroup.add(model);
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
    loadModel(lilipads).then(model => {
      if (model) {
        lilipadsGroup.add(model);
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
    loadModel(lilipads).then(model => {
      if (model) {
        lilipadsGroup2.add(model);
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
    }
  });

  const log = {
    scale: .5,
    animation: false,
    timeScale: 1,
    path: 'models/log.glb',
    position: { x: .5, y: 0, z: -1.45 },
    rotation: { x: 0, y: 0.5, z: 0 }
  }
  loadModel(log).then(model => {
    if (model) {
      scene.add(model);
    }
  });

  const logToad = {
    scale: .20,
    animation: true,
    timeScale: 0.5,
    path: 'models/toad.glb',
    position: { x: .5, y: .07, z: -1.5 },
    rotation: { x: 0, y: .5, z: 0 }
  }
  loadModel(logToad).then(model => {
    if (model) {
      scene.add(model);
    }
  });

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
