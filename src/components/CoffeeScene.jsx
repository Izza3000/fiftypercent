import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useGLTF, Float, Environment, PresentationControls } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import * as THREE from 'three';

function CoffeeBean({ position, rotation }) {
  const mesh = useRef();
  const fbx = useLoader(FBXLoader, '/assets/models/coffee-bean/source/Coffee Bean.fbx');
  
  useEffect(() => {
    if (fbx) {
      // Adjust the scale if needed
      fbx.scale.set(.5, .5, .5);
      
      // Apply materials if needed
      fbx.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#3E1D1D',
            roughness: 0.7,
            metalness: 0.2,
            envMapIntensity: 1
          });
        }
      });
    }
  }, [fbx]);

  useFrame((state) => {
    mesh.current.rotation.y += 0.01;
  });

  return (
    <group ref={mesh} position={position} rotation={rotation}>
      <primitive object={fbx.clone()} />
    </group>
  );
}

function CoffeeTree({ position = [-19, -5, 3], scale = 10 }) {
  const materials = useLoader(MTLLoader, '/assets/models/a-coffee-tree/source/coffee-step00002/coffee-step00002.mtl');
  const obj = useLoader(OBJLoader, '/assets/models/a-coffee-tree/source/coffee-step00002/coffee-step00002.obj', (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  useEffect(() => {
    if (obj) {
      obj.traverse((child) => {
        if (child.isMesh) {
          // Check if this is the floor mesh (usually has a white or very light material)
          if (child.material && (child.material.color.r > 0.9 && child.material.color.g > 0.9 && child.material.color.b > 0.9)) {
            child.visible = false; // Hide the white floor
          } else {
            // Enhance other materials
            child.castShadow = true;
            child.receiveShadow = true;
            
            // If it's a tree part, adjust the material
            if (child.material) {
              child.material.roughness = 0.8;
              child.material.metalness = 0.2;
              child.material.envMapIntensity = 1;
            }
          }
        }
      });
    }
  }, [obj]);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <primitive object={obj.clone()} />
    </group>
  );
}

function Particles({ count = 100 }) {
  const points = useRef();
  const particlesPosition = new Float32Array(count * 3);
  
  for(let i = 0; i < count; i++) {
    particlesPosition[i * 3] = (Math.random() - 0.5) * 10;
    particlesPosition[i * 3 + 1] = (Math.random() - 0.5) * 10;
    particlesPosition[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }

  useFrame((state) => {
    points.current.rotation.y += 0.001;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particlesPosition}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#8B4513"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function CoffeeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
      }}
      shadows
    >
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <spotLight
        position={[5, 5, 5]}
        angle={0.3}
        penumbra={1}
        intensity={0.8}
        castShadow
      />
      <PresentationControls
        global
        rotation={[0.13, 0.1, 0]}
        polar={[-0.4, 0.2]}
        azimuth={[-1, 0.75]}
        config={{ mass: 2, tension: 400 }}
        snap={{ mass: 4, tension: 400 }}
      >
        <Float rotationIntensity={1.5} floatIntensity={4}>
          <group position={[0, 0, 0]}>
            <CoffeeBean position={[-2, 0, 0]} rotation={[0.5, 0, 0]} />
            <CoffeeBean position={[2, 0, 0]} rotation={[-0.5, 0, 0]} />
            <CoffeeBean position={[0, 2, 0]} rotation={[0, 0.5, 0]} />
            <CoffeeBean position={[0, -2, 0]} rotation={[0, -0.5, 0]} />
            <CoffeeBean position={[-1.5, 1.5, 0]} rotation={[0.3, 0.3, 0]} />
          </group>
        </Float>
        <CoffeeTree />
      </PresentationControls>
      <Particles count={200} />
      <Environment preset="city" />
    </Canvas>
  );
} 