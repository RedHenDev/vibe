// Rocky Archways System for Eigengrau Light
// Creates procedural arch formations using the world seed for consistent placement
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('loaded', () => {
      const archSystemEntity = document.createElement('a-entity');
      archSystemEntity.setAttribute('id', 'rocky-archways');
      archSystemEntity.setAttribute('archway-system', '');
      scene.appendChild(archSystemEntity);
      console.log('Rocky archways system initialized');
    });
  }
});
AFRAME.registerComponent('archway-system', {
  schema: {
    chunkSize: { type: 'number', default: 96 },          // Size of each chunk in meters (larger than terrain chunks)
    renderDistance: { type: 'number', default: 400 },     // Max distance to render arches
    updateThreshold: { type: 'number', default: 40 },     // Distance player must move to trigger update
    archDensity: { type: 'number', default: 0.15 },       // Probability of arch in a chunk (0-1)
    minHeight: { type: 'number', default: 30 },           // Minimum arch height
    maxHeight: { type: 'number', default: 65 },           // Maximum arch height
    minWidth: { type: 'number', default: 15 },            // Minimum arch width
    maxWidth: { type: 'number', default: 40 },            // Maximum arch width
    minThickness: { type: 'number', default: 5 },         // Minimum arch thickness
    maxThickness: { type: 'number', default: 12 },        // Maximum arch thickness
    avoidWater: { type: 'boolean', default: true },       // Avoid placing in water areas
    waterLevel: { type: 'number', default: -11 },         // Water level threshold
    chunksPerFrame: { type: 'number', default: 1 },       // Chunks to process per frame
    segmentsCount: { type: 'number', default: 5 },        // Number of segments in the arch (low-poly)
    useDeterministicPlacement: { type: 'boolean', default: true } // Use world seed for placement
  },
  init: function() {
    this.chunks = new Map();
    this.lastUpdatePosition = new THREE.Vector3();
    this.chunkQueue = [];
    this.isProcessingQueue = false;
    this.getHeight = getTerrainHeight; // Assumes global terrain height function
    this.player = this.el.sceneEl.querySelector('#player').object3D;
    this.worldSeed = window.worldSeed || getSeed('1');
    this.seededRandom = new Math.seedrandom(arch-${this.worldSeed});
    console.log(Rocky archways system using world seed: ${this.worldSeed});
    if (this.player) {
      this.queueInitialChunks();
      this.lastUpdatePosition.copy(this.player.position);
    }
  },
  queueInitialChunks: function() {
    const chunkSize = this.data.chunkSize;
    const radius = Math.ceil(this.data.renderDistance / chunkSize);
    const cx = Math.floor(this.player.position.x / chunkSize);
    const cz = Math.floor(this.player.position.z / chunkSize);
    const chunksToLoad = [];
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const chunkX = cx + i;
        const chunkZ = cz + j;
        const key = ${chunkX},${chunkZ};
        if (this.chunks.has(key)) continue;
        const distanceSquared = i * i + j * j;
        chunksToLoad.push({ x: chunkX, z: chunkZ, key: key, distanceSquared: distanceSquared });
      }
    }
    chunksToLoad.sort((a, b) => a.distanceSquared - b.distanceSquared);
    this.chunkQueue = chunksToLoad;
    if (!this.isProcessingQueue) {
      this.isProcessingQueue = true;
      this.startQueueProcessing();
    }
  },
  startQueueProcessing: function() {
    const component = this;
    requestAnimationFrame(function() {
      component.processChunkQueue();
    });
  },
  processChunkQueue: function() {
    if (this.chunkQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    const limit = Math.min(this.data.chunksPerFrame, this.chunkQueue.length);
    for (let i = 0; i < limit; i++) {
      const chunk = this.chunkQueue.shift();
      this.processChunk(chunk.x, chunk.z);
    }
    this.startQueueProcessing();
  },
  tick: function() {
    const player = this.player;
    if (!player) return;
    const playerPosition = player.position;
    const dx = playerPosition.x - this.lastUpdatePosition.x;
    const dz = playerPosition.z - this.lastUpdatePosition.z;
    const distanceMoved = Math.sqrt(dx * dx + dz * dz);
    if (distanceMoved > this.data.updateThreshold) {
      this.updateChunks(playerPosition);
      this.lastUpdatePosition.copy(playerPosition);
    }
  },
  updateChunks: function(playerPosition) {
    const chunkSize = this.data.chunkSize;
    const radius = Math.ceil(this.data.renderDistance / chunkSize);
    const cx = Math.floor(playerPosition.x / chunkSize);
    const cz = Math.floor(playerPosition.z / chunkSize);
    const requiredChunks = new Set();
    const newChunks = [];
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const chunkX = cx + i;
        const chunkZ = cz + j;
        const key = ${chunkX},${chunkZ};
        requiredChunks.add(key);
        if (!this.chunks.has(key) && !this.chunkQueue.some(item => item.key === key)) {
          newChunks.push({ x: chunkX, z: chunkZ, key: key, distanceSquared: i * i + j * j });
        }
      }
    }
    newChunks.sort((a, b) => a.distanceSquared - b.distanceSquared);
    this.chunkQueue.push(...newChunks);
    if (!this.isProcessingQueue && this.chunkQueue.length > 0) {
      this.isProcessingQueue = true;
      this.startQueueProcessing();
    }
    for (const key of this.chunks.keys()) {
      if (!requiredChunks.has(key)) {
        this.removeChunk(key);
      }
    }
  },
  getChunkRandom: function(chunkX, chunkZ, salt = '') {
    if (this.data.useDeterministicPlacement) {
      const seed = arch-${this.worldSeed}-${chunkX}-${chunkZ}-${salt};
      return new Math.seedrandom(seed)();
    } else {
      return this.seededRandom();
    }
  },
  processChunk: function(chunkX, chunkZ) {
    const chunkSize = this.data.chunkSize;
    const geologyRandom = this.getChunkRandom(chunkX, chunkZ, 'geology');
    const shouldHaveArch = geologyRandom < this.data.archDensity;
    if (!shouldHaveArch) {
      this.chunks.set(${chunkX},${chunkZ}, { isEmpty: true });
      return;
    }
    const centerX = (chunkX + 0.5) * chunkSize;
    const centerZ = (chunkZ + 0.5) * chunkSize;
    const offsetX = (this.getChunkRandom(chunkX, chunkZ, 'offsetX') - 0.5) * 0.6 * chunkSize;
    const offsetZ = (this.getChunkRandom(chunkX, chunkZ, 'offsetZ') - 0.5) * 0.6 * chunkSize;
    const posX = centerX + offsetX;
    const posZ = centerZ + offsetZ;
    const terrainHeight = this.getHeight(posX, posZ);
    const sampleDistance = 10;
    const nearbyHeights = [
      this.getHeight(posX + sampleDistance, posZ),
      this.getHeight(posX - sampleDistance, posZ),
      this.getHeight(posX, posZ + sampleDistance),
      this.getHeight(posX, posZ - sampleDistance)
    ];
    const maxHeightDiff = Math.max(...nearbyHeights.map(h => Math.abs(h - terrainHeight)));
    if ((this.data.avoidWater && terrainHeight < this.data.waterLevel) || maxHeightDiff > 20) {
      this.chunks.set(${chunkX},${chunkZ}, { isEmpty: true });
      return;
    }
    const elevation = terrainHeight + 10;
    let archHeight, archWidth, archThickness, formationType = 'standard';
    const styleRandom = this.getChunkRandom(chunkX, chunkZ, 'style');
    if (elevation > 40 && styleRandom < 0.3) {
      formationType = 'monolithic';
      archHeight = this.data.maxHeight * (0.9 + this.getChunkRandom(chunkX, chunkZ, 'height') * 0.3);
      archWidth = this.data.maxWidth * (0.8 + this.getChunkRandom(chunkX, chunkZ, 'width') * 0.4);
      archThickness = this.data.maxThickness * (0.7 + this.getChunkRandom(chunkX, chunkZ, 'thickness') * 0.5);
    } else if (elevation < 0 && styleRandom < 0.4) {
      formationType = 'eroded';
      archHeight = this.data.minHeight + this.getChunkRandom(chunkX, chunkZ, 'height') * (this.data.maxHeight - this.data.minHeight) * 0.6;
      archWidth = this.data.minWidth + this.getChunkRandom(chunkX, chunkZ, 'width') * (this.data.maxWidth - this.data.minWidth) * 0.7;
      archThickness = this.data.minThickness + this.getChunkRandom(chunkX, chunkZ, 'thickness') * (this.data.maxThickness - this.data.minThickness) * 0.6;
    } else if (styleRandom < 0.2) {
      formationType = 'compound';
      archHeight = this.data.minHeight + this.getChunkRandom(chunkX, chunkZ, 'height') * (this.data.maxHeight - this.data.minHeight) * 0.8;
      archWidth = this.data.minWidth + this.getChunkRandom(chunkX, chunkZ, 'width') * (this.data.maxWidth - this.data.minWidth) * 0.9;
      archThickness = this.data.minThickness + this.getChunkRandom(chunkX, chunkZ, 'thickness') * (this.data.maxThickness - this.data.minThickness) * 0.8;
    } else {
      archHeight = this.data.minHeight + this.getChunkRandom(chunkX, chunkZ, 'height') * (this.data.maxHeight - this.data.minHeight);
      archWidth = this.data.minWidth + this.getChunkRandom(chunkX, chunkZ, 'width') * (this.data.maxWidth - this.data.minWidth);
      archThickness = this.data.minThickness + this.getChunkRandom(chunkX, chunkZ, 'thickness') * (this.data.maxThickness - this.data.minThickness);
    }
    const eastHeight = this.getHeight(posX + sampleDistance * 2, posZ);
    const westHeight = this.getHeight(posX - sampleDistance * 2, posZ);
    const northHeight = this.getHeight(posX, posZ + sampleDistance * 2);
    const southHeight = this.getHeight(posX, posZ - sampleDistance * 2);
    let rotation;
    const eastWestDiff = Math.abs(eastHeight - westHeight);
    const northSouthDiff = Math.abs(northHeight - southHeight);
    if (eastWestDiff > northSouthDiff * 1.5) {
      rotation = Math.PI / 2;
    } else if (northSouthDiff > eastWestDiff * 1.5) {
      rotation = 0;
    } else {
      rotation = this.getChunkRandom(chunkX, chunkZ, 'rotation') * Math.PI * 2;
    }
    let arch;
    switch (formationType) {
      case 'monolithic':
        arch = this.createMonolithicArch(posX, terrainHeight, posZ, archWidth, archHeight, archThickness, rotation, this.data.segmentsCount + 3);
        break;
      case 'eroded':
        arch = this.createErodedArch(posX, terrainHeight, posZ, archWidth, archHeight, archThickness, rotation, this.data.segmentsCount);
        break;
      case 'compound':
        arch = this.createCompoundArch(posX, terrainHeight, posZ, archWidth, archHeight, archThickness, rotation, this.data.segmentsCount);
        break;
      default:
        arch = this.createArch(posX, terrainHeight, posZ, archWidth, archHeight, archThickness, rotation, this.data.segmentsCount);
    }
    this.el.sceneEl.object3D.add(arch);
    this.chunks.set(${chunkX},${chunkZ}, { arch: arch, isEmpty: false, formationType: formationType });
    this.animateChunkIn(arch);
  },
  createArch: function(x, y, z, width, height, thickness, rotation, segments) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    const rockColor = this.getGeologicalColor(y);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.9, metalness: 0.1, flatShading: true });
    const leftX = -width / 2;
    const rightX = width / 2;
    const createIrregularPillar = (baseX, baseY, baseZ, pillarHeight, pillarThickness) => {
      const baseGeometry = new THREE.BoxGeometry(pillarThickness, pillarHeight, pillarThickness, 3, 5, 3);
      const positionAttr = baseGeometry.attributes.position;
      const vertexCount = positionAttr.count;
      for (let i = 0; i < vertexCount; i++) {
        const yPos = positionAttr.getY(i);
        if (yPos > -pillarHeight / 2 + pillarHeight * 0.1) {
          const displacementFactor = Math.abs(yPos) / (pillarHeight / 2) * 0.3;
          const displaceX = (this.getChunkRandom(baseX, baseZ, pillar-vx-${i}) * 2 - 1) * pillarThickness * 0.3 * displacementFactor;
          const displaceZ = (this.getChunkRandom(baseX, baseZ, pillar-vz-${i}) * 2 - 1) * pillarThickness * 0.3 * displacementFactor;
          positionAttr.setX(i, positionAttr.getX(i) + displaceX);
          positionAttr.setZ(i, positionAttr.getZ(i) + displaceZ);
        }
      }
      positionAttr.needsUpdate = true;
      baseGeometry.computeVertexNormals();
      baseGeometry.translate(baseX, baseY + pillarHeight / 2, baseZ);
      return new THREE.Mesh(baseGeometry, rockMaterial.clone());
    };
    const leftPillarThickness = thickness * (0.9 + this.getChunkRandom(leftX, z, 'left-width') * 0.6);
    const rightPillarThickness = thickness * (0.9 + this.getChunkRandom(rightX, z, 'right-width') * 0.6);
    const pillarHeight = height * 0.7;
    const pillar1 = createIrregularPillar(leftX, 0, 0, pillarHeight, leftPillarThickness);
    const pillar2 = createIrregularPillar(rightX, 0, 0, pillarHeight, rightPillarThickness);
    group.add(pillar1);
    group.add(pillar2);
    const archHeight = height * 1.2;
    const peakOffset = (this.getChunkRandom(x, z, 'peak-offset') * 0.4 - 0.2) * width;
    const controlPoints = [
      new THREE.Vector3(leftX, pillarHeight, 0),
      new THREE.Vector3(leftX + width * 0.2, pillarHeight + height * 0.3, 0),
      new THREE.Vector3(leftX + width * 0.5 + peakOffset, archHeight, 0),
      new THREE.Vector3(rightX - width * 0.2, pillarHeight + height * 0.3, 0),
      new THREE.Vector3(rightX, pillarHeight, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(controlPoints);
    curve.tension = 0.4;
    const curveSegments = segments + Math.floor(width / 10);
    const points = curve.getPoints(curveSegments);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const length = new THREE.Vector3().subVectors(end, start).length();
      const progress = i / (points.length - 1);
      const segmentThickness = thickness * (0.9 + this.getChunkRandom(x, z, segment-${i}) * 0.4);
      const segmentHeight = segmentThickness * (1.0 + Math.sin(progress * Math.PI) * 0.3);
      const segmentGeometry = new THREE.BoxGeometry(segmentThickness, segmentHeight, length, 2, 2, 1);
      const positionAttr = segmentGeometry.attributes.position;
      const vertexCount = positionAttr.count;
      for (let v = 0; v < vertexCount; v++) {
        const vz = positionAttr.getZ(v);
        if (Math.abs(vz) < length * 0.4) {
          const displacement = (this.getChunkRandom(x, z, segment-${i}-vertex-${v}) * 2 - 1) * segmentThickness * 0.2;
          positionAttr.setX(v, positionAttr.getX(v) + displacement);
          positionAttr.setY(v, positionAttr.getY(v) + displacement);
        }
      }
      positionAttr.needsUpdate = true;
      segmentGeometry.computeVertexNormals();
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      segmentGeometry.applyQuaternion(quaternion);
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      segmentGeometry.translate(midpoint.x, midpoint.y, midpoint.z);
      const segmentMaterial = rockMaterial.clone();
      const colorVariation = 0.1;
      const color = segmentMaterial.color.clone();
      color.r *= (1 - colorVariation / 2) + this.getChunkRandom(x, z, color-${i}) * colorVariation;
      color.g *= (1 - colorVariation / 2) + this.getChunkRandom(x, z, color-${i}) * colorVariation;
      color.b *= (1 - colorVariation / 2) + this.getChunkRandom(x, z, color-${i}) * colorVariation;
      segmentMaterial.color = color;
      const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
      group.add(segmentMesh);
    }
    this.addRockyDetails(group, width, height, thickness);
    return group;
  },
  createMonolithicArch: function(x, y, z, width, height, thickness, rotation, segments) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    const rockColor = this.getGeologicalColor(y);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.9, metalness: 0.1, flatShading: true });
    const leftX = -width / 2;
    const rightX = width / 2;
    const createMassivePillar = (baseX, baseZ, pillarHeight, pillarThickness) => {
      const pillarGroup = new THREE.Group();
      const mainColumn = new THREE.CylinderGeometry(pillarThickness * 0.8, pillarThickness * 1.2, pillarHeight, 8, 6, true);
      const positionAttr = mainColumn.attributes.position;
      const vertexCount = positionAttr.count;
      for (let i = 0; i < vertexCount; i++) {
        const vx = positionAttr.getX(i);
        const vy = positionAttr.getY(i);
        const vz = positionAttr.getZ(i);
        if (vy > -pillarHeight / 2 + pillarHeight * 0.1) {
          const displacementFactor = (vy + pillarHeight / 2) / pillarHeight * 0.4;
          const noiseX = this.getChunkRandom(baseX + vx, baseZ + vz, monolith-${i});
          const noiseY = this.getChunkRandom(baseX + vx, baseZ + vz, monolith-y-${i});
          positionAttr.setX(i, vx + (noiseX * 2 - 1) * pillarThickness * 0.3 * displacementFactor);
          positionAttr.setZ(i, vz + (noiseY * 2 - 1) * pillarThickness * 0.3 * displacementFactor);
        }
      }
      positionAttr.needsUpdate = true;
      mainColumn.computeVertexNormals();
      mainColumn.translate(baseX, pillarHeight / 2, baseZ);
      const pillarMesh = new THREE.Mesh(mainColumn, rockMaterial.clone());
      pillarGroup.add(pillarMesh);
      const boulderCount = 5 + Math.floor(this.getChunkRandom(baseX, baseZ, 'boulder-count') * 4);
      for (let i = 0; i < boulderCount; i++) {
        const angle = (i / boulderCount) * Math.PI * 2;
        const radius = pillarThickness * (0.8 + this.getChunkRandom(baseX, baseZ, boulder-radius-${i}) * 0.4);
        const bx = baseX + Math.cos(angle) * radius;
        const bz = baseZ + Math.sin(angle) * radius;
        const boulderSize = pillarThickness * (0.3 + this.getChunkRandom(baseX, baseZ, boulder-size-${i}) * 0.3);
        let boulderGeometry;
        if (this.getChunkRandom(baseX, baseZ, boulder-shape-${i}) < 0.6) {
          boulderGeometry = new THREE.DodecahedronGeometry(boulderSize, 0);
        } else {
          boulderGeometry = new THREE.BoxGeometry(
            boulderSize * (0.8 + this.getChunkRandom(baseX, baseZ, boulder-x-${i}) * 0.4),
            boulderSize * (0.8 + this.getChunkRandom(baseX, baseZ, boulder-y-${i}) * 0.4),
            boulderSize * (0.8 + this.getChunkRandom(baseX, baseZ, boulder-z-${i}) * 0.4)
          );
          const boulderAttr = boulderGeometry.attributes.position;
          for (let v = 0; v < boulderAttr.count; v++) {
            const offset = boulderSize * 0.2;
            boulderAttr.setX(v, boulderAttr.getX(v) + (this.getChunkRandom(baseX, baseZ, boulder-vx-${i}-${v}) * 2 - 1) * offset);
            boulderAttr.setY(v, boulderAttr.getY(v) + (this.getChunkRandom(baseX, baseZ, boulder-vy-${i}-${v}) * 2 - 1) * offset);
            boulderAttr.setZ(v, boulderAttr.getZ(v) + (this.getChunkRandom(baseX, baseZ, boulder-vz-${i}-${v}) * 2 - 1) * offset);
          }
          boulderAttr.needsUpdate = true;
        }
        const by = this.getChunkRandom(baseX, baseZ, boulder-y-${i}) * boulderSize;
        boulderGeometry.translate(bx, by, bz);
        boulderGeometry.rotateX(this.getChunkRandom(baseX, baseZ, boulder-rx-${i}) * Math.PI);
        boulderGeometry.rotateY(this.getChunkRandom(baseX, baseZ, boulder-ry-${i}) * Math.PI);
        boulderGeometry.rotateZ(this.getChunkRandom(baseX, baseZ, boulder-rz-${i}) * Math.PI);
        const boulderMaterial = rockMaterial.clone();
        boulderMaterial.color = this.getGeologicalColor(0);
        boulderMaterial.color.multiplyScalar(0.8 + this.getChunkRandom(baseX, baseZ, boulder-color-${i}) * 0.4);
        const boulderMesh = new THREE.Mesh(boulderGeometry, boulderMaterial);
        pillarGroup.add(boulderMesh);
      }
      return pillarGroup;
    };
    const leftPillarThickness = thickness * 1.5;
    const rightPillarThickness = thickness * 1.5;
    const pillarHeight = height * 0.75;
    const pillar1 = createMassivePillar(leftX, 0, pillarHeight, leftPillarThickness);
    const pillar2 = createMassivePillar(rightX, 0, pillarHeight, rightPillarThickness);
    group.add(pillar1);
    group.add(pillar2);
    const archHeight = height * 1.3;
    const controlPoints = [
      new THREE.Vector3(leftX, pillarHeight, 0),
      new THREE.Vector3(leftX + width * 0.2, pillarHeight + height * 0.4, 0),
      new THREE.Vector3(leftX + width * 0.5, archHeight, 0),
      new THREE.Vector3(rightX - width * 0.2, pillarHeight + height * 0.4, 0),
      new THREE.Vector3(rightX, pillarHeight, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(controlPoints);
    curve.tension = 0.4;
    const curveSegments = segments + Math.floor(width / 8);
    const points = curve.getPoints(curveSegments);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const length = new THREE.Vector3().subVectors(end, start).length();
      const progress = i / (points.length - 1);
      const segmentThickness = thickness * 1.5 * (1.0 + Math.sin(progress * Math.PI) * 0.3);
      const segmentHeight = segmentThickness * (1.0 + Math.sin(progress * Math.PI) * 0.4);
      const segmentGeometry = new THREE.BoxGeometry(segmentThickness, segmentHeight, length, 3, 3, 1);
      const positionAttr = segmentGeometry.attributes.position;
      const vertexCount = positionAttr.count;
      for (let v = 0; v < vertexCount; v++) {
        const vz = positionAttr.getZ(v);
        if (Math.abs(vz) < length * 0.4) {
          const displacement = (this.getChunkRandom(x, z, monolith-seg-${i}-${v}) * 2 - 1) * segmentThickness * 0.25;
          positionAttr.setX(v, positionAttr.getX(v) + displacement);
          positionAttr.setY(v, positionAttr.getY(v) + displacement);
        }
      }
      positionAttr.needsUpdate = true;
      segmentGeometry.computeVertexNormals();
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      segmentGeometry.applyQuaternion(quaternion);
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      segmentGeometry.translate(midpoint.x, midpoint.y, midpoint.z);
      const segmentMaterial = rockMaterial.clone();
      const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
      group.add(segmentMesh);
    }
    this.addRockyDetails(group, width, height, thickness * 1.5);
    this.addGroundingFormations(group, width, height, thickness);
    return group;
  },
  createErodedArch: function(x, y, z, width, height, thickness, rotation, segments) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    const rockColor = this.getGeologicalColor(y);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 1.0, metalness: 0.05, flatShading: true });
    const leftX = -width / 2 - (this.getChunkRandom(x, z, 'left-offset') * width * 0.1);
    const rightX = width / 2 + (this.getChunkRandom(x, z, 'right-offset') * width * 0.1);
    const createErodedPillar = (baseX, baseZ, pillarHeight, pillarThickness) => {
      const baseGeometry = new THREE.CylinderGeometry(pillarThickness * 0.7, pillarThickness * 1.3, pillarHeight, 7, 4, true);
      const positionAttr = baseGeometry.attributes.position;
      const vertexCount = positionAttr.count;
      for (let i = 0; i < vertexCount; i++) {
        const vy = positionAttr.getY(i);
        const heightFactor = 1 - Math.abs((vy + pillarHeight / 2) / pillarHeight - 0.5) * 2;
        const erosionFactor = 0.4 * heightFactor;
        const displaceX = (this.getChunkRandom(baseX, baseZ, erode-vx-${i}) * 2 - 1) * pillarThickness * erosionFactor;
        const displaceZ = (this.getChunkRandom(baseX, baseZ, erode-vz-${i}) * 2 - 1) * pillarThickness * erosionFactor;
        positionAttr.setX(i, positionAttr.getX(i) + displaceX);
        positionAttr.setZ(i, positionAttr.getZ(i) + displaceZ);
      }
      positionAttr.needsUpdate = true;
      baseGeometry.computeVertexNormals();
      baseGeometry.translate(baseX, pillarHeight / 2, baseZ);
      return new THREE.Mesh(baseGeometry, rockMaterial.clone());
    };
    const leftPillarThickness = thickness * (0.8 + this.getChunkRandom(x, z, 'left-thick') * 0.4);
    const rightPillarThickness = thickness * (0.8 + this.getChunkRandom(x, z, 'right-thick') * 0.4);
    const leftPillarHeight = height * (0.6 + this.getChunkRandom(x, z, 'left-height') * 0.2);
    const rightPillarHeight = height * (0.6 + this.getChunkRandom(x, z, 'right-height') * 0.2);
    const pillar1 = createErodedPillar(leftX, 0, leftPillarHeight, leftPillarThickness);
    const pillar2 = createErodedPillar(rightX, 0, rightPillarHeight, rightPillarThickness);
    group.add(pillar1);
    group.add(pillar2);
    const peakOffset = (this.getChunkRandom(x, z, 'peak-offset') * 0.4 - 0.2) * width;
    const peakHeight = height * (1.0 + this.getChunkRandom(x, z, 'peak-height') * 0.15);
    const controlPoints = [];
    controlPoints.push(new THREE.Vector3(leftX, leftPillarHeight, 0));
    const numIntermediatePoints = 2 + Math.floor(this.getChunkRandom(x, z, 'control-points') * 3);
    for (let i = 1; i <= numIntermediatePoints; i++) {
      const t = i / (numIntermediatePoints + 1);
      const pointX = leftX + (rightX - leftX) * t;
      const baseHeight = leftPillarHeight + (rightPillarHeight - leftPillarHeight) * t;
      const heightVariation = height * 0.3 * (this.getChunkRandom(x, z, height-var-${i}) * 2 - 1);
      const middleBoost = Math.sin(t * Math.PI) * peakHeight * 0.7;
      const pointY = baseHeight + heightVariation + middleBoost;
      const pointZ = (this.getChunkRandom(x, z, z-var-${i}) * 2 - 1) * thickness * 0.3;
      controlPoints.push(new THREE.Vector3(pointX, pointY, pointZ));
    }
    controlPoints.push(new THREE.Vector3(rightX, rightPillarHeight, 0));
    const curve = new THREE.CatmullRomCurve3(controlPoints);
    curve.tension = 0.5;
    const points = curve.getPoints(segments);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const length = new THREE.Vector3().subVectors(end, start).length();
      const progress = i / (points.length - 1);
      const erodeFactor = this.getChunkRandom(x, z, erode-seg-${i});
      if (erodeFactor < 0.2 && i > 0 && i < points.length - 2) continue; // Skip some segments for erosion gaps
      const segmentThickness = thickness * (0.5 + erodeFactor * 0.8) * (1.0 + Math.sin(progress * Math.PI) * 0.4);
      const segmentHeight = segmentThickness * (0.8 + this.getChunkRandom(x, z, seg-height-${i}) * 0.4);
      const segmentGeometry = new THREE.BoxGeometry(segmentThickness, segmentHeight, length, 2, 2, 1);
      const positionAttr = segmentGeometry.attributes.position;
      const vertexCount = positionAttr.count;
      for (let v = 0; v < vertexCount; v++) {
        const vz = positionAttr.getZ(v);
        if (Math.abs(vz) < length * 0.4) {
          const displacement = (this.getChunkRandom(x, z, erode-seg-${i}-${v}) * 2 - 1) * segmentThickness * 0.3;
          positionAttr.setX(v, positionAttr.getX(v) + displacement);
          positionAttr.setY(v, positionAttr.getY(v) + displacement);
        }
      }
      positionAttr.needsUpdate = true;
      segmentGeometry.computeVertexNormals();
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      segmentGeometry.applyQuaternion(quaternion);
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      segmentGeometry.translate(midpoint.x, midpoint.y, midpoint.z);
      const segmentMaterial = rockMaterial.clone();
      segmentMaterial.color.multiplyScalar(0.8 + this.getChunkRandom(x, z, erode-color-${i}) * 0.4);
      const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
      group.add(segmentMesh);
    }
    this.addRockyDetails(group, width, height, thickness);
    this.addGroundingFormations(group, width, height, thickness);
    return group;
  },
  createCompoundArch: function(x, y, z, width, height, thickness, rotation, segments) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    const rockColor = this.getGeologicalColor(y);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.9, metalness: 0.1, flatShading: true });
    const leftX = -width / 2;
    const centerX = 0;
    const rightX = width / 2;
    const createPillar = (baseX, baseZ, pillarHeight, pillarThickness) => {
      const baseGeometry = new THREE.CylinderGeometry(pillarThickness * 0.9, pillarThickness * 1.1, pillarHeight, 6, 4, true);
      const positionAttr = baseGeometry.attributes.position;
      const vertexCount = positionAttr.count;
      for (let i = 0; i < vertexCount; i++) {
        const vy = positionAttr.getY(i);
        if (vy > -pillarHeight / 2 + pillarHeight * 0.1) {
          const displacementFactor = (vy + pillarHeight / 2) / pillarHeight * 0.3;
          const displaceX = (this.getChunkRandom(baseX, baseZ, compound-vx-${i}) * 2 - 1) * pillarThickness * 0.25 * displacementFactor;
          const displaceZ = (this.getChunkRandom(baseX, baseZ, compound-vz-${i}) * 2 - 1) * pillarThickness * 0.25 * displacementFactor;
          positionAttr.setX(i, positionAttr.getX(i) + displaceX);
          positionAttr.setZ(i, positionAttr.getZ(i) + displaceZ);
        }
      }
      positionAttr.needsUpdate = true;
      baseGeometry.computeVertexNormals();
      baseGeometry.translate(baseX, pillarHeight / 2, baseZ);
      return new THREE.Mesh(baseGeometry, rockMaterial.clone());
    };
    const pillarHeight = height * 0.65;
    const leftPillarThickness = thickness * 1.2;
    const centerPillarThickness = thickness * 1.4;
    const rightPillarThickness = thickness * 1.2;
    const pillar1 = createPillar(leftX, 0, pillarHeight, leftPillarThickness);
    const pillar2 = createPillar(centerX, 0, pillarHeight * 1.1, centerPillarThickness);
    const pillar3 = createPillar(rightX, 0, pillarHeight, rightPillarThickness);
    group.add(pillar1);
    group.add(pillar2);
    group.add(pillar3);
    const createArchSpan = (startX, endX, startHeight, endHeight, archHeight, spanThickness) => {
      const controlPoints = [
        new THREE.Vector3(startX, startHeight, 0),
        new THREE.Vector3(startX + (endX - startX) * 0.3, startHeight + (archHeight - startHeight) * 0.5, 0),
        new THREE.Vector3(startX + (endX - startX) * 0.5, archHeight, 0),
        new THREE.Vector3(endX - (endX - startX) * 0.3, endHeight + (archHeight - endHeight) * 0.5, 0),
        new THREE.Vector3(endX, endHeight, 0)
      ];
      const curve = new THREE.CatmullRomCurve3(controlPoints);
      curve.tension = 0.4;
      const points = curve.getPoints(segments);
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const length = new THREE.Vector3().subVectors(end, start).length();
        const progress = i / (points.length - 1);
        const segmentThickness = spanThickness * (1.0 + Math.sin(progress * Math.PI) * 0.3);
        const segmentHeight = segmentThickness * (0.9 + this.getChunkRandom(x, z, compound-seg-height-${i}) * 0.3);
        const segmentGeometry = new THREE.BoxGeometry(segmentThickness, segmentHeight, length, 2, 2, 1);
        const positionAttr = segmentGeometry.attributes.position;
        const vertexCount = positionAttr.count;
        for (let v = 0; v < vertexCount; v++) {
          const vz = positionAttr.getZ(v);
          if (Math.abs(vz) < length * 0.4) {
            const displacement = (this.getChunkRandom(x, z, compound-seg-${i}-${v}) * 2 - 1) * segmentThickness * 0.2;
            positionAttr.setX(v, positionAttr.getX(v) + displacement);
            positionAttr.setY(v, positionAttr.getY(v) + displacement);
          }
        }
        positionAttr.needsUpdate = true;
        segmentGeometry.computeVertexNormals();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        segmentGeometry.applyQuaternion(quaternion);
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        segmentGeometry.translate(midpoint.x, midpoint.y, midpoint.z);
        const segmentMaterial = rockMaterial.clone();
        segmentMaterial.color.multiplyScalar(0.9 + this.getChunkRandom(x, z, compound-color-${i}) * 0.2);
        const segmentMesh = new THREE.Mesh(segmentGeometry, segmentMaterial);
        group.add(segmentMesh);
      }
    };
    const archHeight1 = height * (1.1 + this.getChunkRandom(x, z, 'arch1-height') * 0.2);
    const archHeight2 = height * (1.0 + this.getChunkRandom(x, z, 'arch2-height') * 0.2);
    createArchSpan(leftX, centerX, pillarHeight, pillarHeight * 1.1, archHeight1, thickness * 1.1);
    createArchSpan(centerX, rightX, pillarHeight * 1.1, pillarHeight, archHeight2, thickness * 1.0);
    this.addRockyDetails(group, width, height, thickness);
    this.addGroundingFormations(group, width, height, thickness);
    return group;
  },
  getGeologicalColor: function(height) {
    if (height < -11.5) return new THREE.Color(0x000F00);
    if (height < 0) return new THREE.Color(0x003200);
    if (height < 5) return new THREE.Color(0x003900);
    if (height < 10) return new THREE.Color(0x004400);
    if (height < 30) return new THREE.Color(0x005800);
    if (height < 50) return new THREE.Color(0x006500);
    if (height < 70) return new THREE.Color(0x6B776B);
    return new THREE.Color(0xBBBBBB);
  },
  addRockyDetails: function(group, width, height, thickness) {
    const baseMaterial = group.children[0].material.clone();
    const numDetails = Math.floor(8 + this.getChunkRandom(0, 0, 'detail-count') * 10 + width / 10);
    for (let i = 0; i < numDetails; i++) {
      const placement = this.getChunkRandom(0, 0, placement-${i});
      const onPillar = placement < 0.4;
      const onArch = placement < 0.8;
      let detailGeometry;
      const detailSize = thickness * (0.5 + this.getChunkRandom(0, 0, size-${i}) * 0.9);
      const shape = this.getChunkRandom(0, 0, shape-${i});
      if (shape < 0.3) {
        const boxDims = [
          detailSize * (0.7 + this.getChunkRandom(0, 0, dim-x-${i}) * 0.9),
          detailSize * (0.7 + this.getChunkRandom(0, 0, dim-y-${i}) * 1.2),
          detailSize * (0.7 + this.getChunkRandom(0, 0, dim-z-${i}) * 0.9)
        ];
        detailGeometry = new THREE.BoxGeometry(boxDims[0], boxDims[1], boxDims[2], 2, 2, 2);
        const posAttr = detailGeometry.attributes.position;
        for (let v = 0; v < posAttr.count; v++) {
          const displaceAmount = detailSize * 0.2;
          posAttr.setX(v, posAttr.getX(v) + (this.getChunkRandom(0, 0, disp-x-${i}-${v}) * 2 - 1) * displaceAmount);
          posAttr.setY(v, posAttr.getY(v) + (this.getChunkRandom(0, 0, disp-y-${i}-${v}) * 2 - 1) * displaceAmount);
          posAttr.setZ(v, posAttr.getZ(v) + (this.getChunkRandom(0, 0, disp-z-${i}-${v}) * 2 - 1) * displaceAmount);
        }
        posAttr.needsUpdate = true;
      } else if (shape < 0.6) {
        detailGeometry = new THREE.TetrahedronGeometry(detailSize * 0.9, 1);
      } else if (shape < 0.85) {
        detailGeometry = new THREE.OctahedronGeometry(detailSize * 0.7, 0);
      } else {
        detailGeometry = new THREE.ConeGeometry(
          detailSize * 0.6,
          detailSize * (1.5 + this.getChunkRandom(0, 0, cone-height-${i}) * 1.0),
          5 + Math.floor(this.getChunkRandom(0, 0, cone-sides-${i}) * 3),
          1,
          true
        );
        const posAttr = detailGeometry.attributes.position;
        for (let v = 0; v < posAttr.count; v++) {
          const y = posAttr.getY(v);
          if (Math.abs(y) < detailSize * 0.7) {
            const displaceAmount = detailSize * 0.15;
            posAttr.setX(v, posAttr.getX(v) + (this.getChunkRandom(0, 0, cone-disp-x-${i}-${v}) * 2 - 1) * displaceAmount);
            posAttr.setZ(v, posAttr.getZ(v) + (this.getChunkRandom(0, 0, cone-disp-z-${i}-${v}) * 2 - 1) * displaceAmount);
          }
        }
        posAttr.needsUpdate = true;
      }
      let posX, posY, posZ;
      if (onPillar) {
        posX = this.getChunkRandom(0, 0, pillar-side-${i}) < 0.5 ? -width / 2 : width / 2;
        posY = this.getChunkRandom(0, 0, pillar-y-${i}) * (height * 0.75);
        const angle = this.getChunkRandom(0, 0, pillar-angle-${i}) * Math.PI * 2;
        const pillarThickness = thickness * 1.2;
        posZ = Math.sin(angle) * pillarThickness;
        posX += Math.cos(angle) * pillarThickness * (posX > 0 ? -1 : 1);
      } else if (onArch) {
        posX = -width / 2 + this.getChunkRandom(0, 0, arch-x-${i}) * width;
        const t = (posX + width / 2) / width;
        posY = height * 0.7 + Math.sin(t * Math.PI) * (height * 0.5);
        const angle = this.getChunkRandom(0, 0, arch-angle-${i}) * Math.PI * 2;
        const offset = thickness * (0.5 + this.getChunkRandom(0, 0, arch-offset-${i}) * 0.8);
        posZ = Math.sin(angle) * offset;
        posY += Math.cos(angle) * offset * 0.5;
      } else {
        const side = this.getChunkRandom(0, 0, base-side-${i}) < 0.5 ? -1 : 1;
        posX = (width / 2) * side * (0.8 + this.getChunkRandom(0, 0, base-x-${i}) * 0.4);
        posY = 0;
        posZ = (this.getChunkRandom(0, 0, base-z-${i}) * 2 - 1) * thickness * 2;
      }
      detailGeometry.translate(posX, posY, posZ);
      detailGeometry.rotateX(this.getChunkRandom(0, 0, rot-x-${i}) * Math.PI);
      detailGeometry.rotateY(this.getChunkRandom(0, 0, rot-y-${i}) * Math.PI);
      detailGeometry.rotateZ(this.getChunkRandom(0, 0, rot-z-${i}) * Math.PI);
      detailGeometry.computeVertexNormals();
      const detailMaterial = baseMaterial.clone();
      let detailColor = posY < height * 0.2 ? this.getGeologicalColor(posY) : baseMaterial.color.clone();
      const variationAmount = 0.15;
      detailColor.r *= (1 - variationAmount / 2) + this.getChunkRandom(0, 0, color-r-${i}) * variationAmount;
      detailColor.g *= (1 - variationAmount / 2) + this.getChunkRandom(0, 0, color-g-${i}) * variationAmount;
      detailColor.b *= (1 - variationAmount / 2) + this.getChunkRandom(0, 0, color-b-${i}) * variationAmount;
      detailMaterial.color = detailColor;
      const detailMesh = new THREE.Mesh(detailGeometry, detailMaterial);
      group.add(detailMesh);
    }
    this.addConnectiveRocks(group, width, height, thickness);
  },
  addConnectiveRocks: function(group, width, height, thickness) {
    const baseMaterial = group.children[0].material.clone();
    const connectiveCount = Math.floor(width / 5);
    for (let i = 0; i < connectiveCount; i++) {
      const side = this.getChunkRandom(0, 0, connect-side-${i}) < 0.5 ? -1 : 1;
      const posX = (width / 2) * side;
      const posY = height * (0.5 + this.getChunkRandom(0, 0, connect-y-${i}) * 0.3);
      const posZ = (this.getChunkRandom(0, 0, connect-z-${i}) * 2 - 1) * thickness;
      const rockSize = thickness * (0.3 + this.getChunkRandom(0, 0, connect-size-${i}) * 0.4);
      const rockGeometry = new THREE.IcosahedronGeometry(rockSize, 0);
      const posAttr = rockGeometry.attributes.position;
      for (let v = 0; v < posAttr.count; v++) {
        const displaceAmount = rockSize * 0.2;
        posAttr.setX(v, posAttr.getX(v) + (this.getChunkRandom(0, 0, connect-disp-x-${i}-${v}) * 2 - 1) * displaceAmount);
        posAttr.setY(v, posAttr.getY(v) + (this.getChunkRandom(0, 0, connect-disp-y-${i}-${v}) * 2 - 1) * displaceAmount);
        posAttr.setZ(v, posAttr.getZ(v) + (this.getChunkRandom(0, 0, connect-disp-z-${i}-${v}) * 2 - 1) * displaceAmount);
      }
      posAttr.needsUpdate = true;
      rockGeometry.computeVertexNormals();
      rockGeometry.translate(posX, posY, posZ);
      const rockMaterial = baseMaterial.clone();
      rockMaterial.color.multiplyScalar(0.9 + this.getChunkRandom(0, 0, connect-color-${i}) * 0.2);
      const rockMesh = new THREE.Mesh(rockGeometry, rockMaterial);
      group.add(rockMesh);
    }
  },
  addGroundingFormations: function(group, width, height, thickness) {
    const baseMaterial = group.children[0].material.clone();
    const groundCount = 4 + Math.floor(this.getChunkRandom(0, 0, 'ground-count') * 4);
    for (let i = 0; i < groundCount; i++) {
      const side = this.getChunkRandom(0, 0, ground-side-${i}) < 0.5 ? -1 : 1;
      const posX = (width / 2) * side * (0.8 + this.getChunkRandom(0, 0, ground-x-${i}) * 0.6);
      const posZ = (this.getChunkRandom(0, 0, ground-z-${i}) * 2 - 1) * thickness * 1.5;
      const rockSize = thickness * (0.6 + this.getChunkRandom(0, 0, ground-size-${i}) * 0.8);
      const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
      const posAttr = rockGeometry.attributes.position;
      for (let v = 0; v < posAttr.count; v++) {
        const displaceAmount = rockSize * 0.15;
        posAttr.setX(v, posAttr.getX(v) + (this.getChunkRandom(0, 0, ground-disp-x-${i}-${v}) * 2 - 1) * displaceAmount);
        posAttr.setZ(v, posAttr.getZ(v) + (this.getChunkRandom(0, 0, ground-disp-z-${i}-${v}) * 2 - 1) * displaceAmount);
      }
      posAttr.needsUpdate = true;
      rockGeometry.translate(posX, rockSize / 2, posZ);
      rockGeometry.rotateX(this.getChunkRandom(0, 0, ground-rx-${i}) * Math.PI);
      rockGeometry.rotateY(this.getChunkRandom(0, 0, ground-ry-${i}) * Math.PI);
      const rockMaterial = baseMaterial.clone();
      rockMaterial.color = this.getGeologicalColor(0);
      rockMaterial.color.multiplyScalar(0.8 + this.getChunkRandom(0, 0, ground-color-${i}) * 0.3);
      const rockMesh = new THREE.Mesh(rockGeometry, rockMaterial);
      group.add(rockMesh);
    }
  },
  removeChunk: function(key) {
    const chunk = this.chunks.get(key);
    if (chunk && !chunk.isEmpty) {
      this.animateChunkOut(chunk.arch, key);
    } else {
      this.chunks.delete(key);
    }
  },
  animateChunkIn: function(object) {
    object.scale.set(0.001, 0.001, 0.001);
    const targetScale = new THREE.Vector3(1, 1, 1);
    const duration = 1000;
    const startTime = performance.now();
    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      object.scale.set(
        0.001 + (targetScale.x - 0.001) * easeProgress,
        0.001 + (targetScale.y - 0.001) * easeProgress,
        0.001 + (targetScale.z - 0.001) * easeProgress
      );
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  },
  animateChunkOut: function(object, key) {
    const duration = 800;
    const startTime = performance.now();
    const startScale = object.scale.clone();
    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      object.scale.set(
        startScale.x * (1 - easeProgress),
        startScale.y * (1 - easeProgress),
        startScale.z * (1 - easeProgress)
      );
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.finalizeChunkRemoval(key);
      }
    };
    requestAnimationFrame(animate);
  },
  finalizeChunkRemoval: function(key) {
    const chunk = this.chunks.get(key);
    if (chunk && !chunk.isEmpty) {
      const arch = chunk.arch;
      this.el.sceneEl.object3D.remove(arch);
      arch.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
    this.chunks.delete(key);
  },
  remove: function() {
    this.chunkQueue = [];
    this.isProcessingQueue = false;
    for (const key of this.chunks.keys()) {
      const chunk = this.chunks.get(key);
      if (chunk && !chunk.isEmpty) {
        this.el.sceneEl.object3D.remove(chunk.arch);
        chunk.arch.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    }
    this.chunks.clear();
  }
});
// Seedrandom for deterministic random placement (https://github.com/davidbau/seedrandom)
!function(f,a,c){var s,l=256,p="random",d=c.pow(l,6),g=c.pow(2,52),y=2g,h=l-1;function n(n,t,r){function e(){for(var n=u.g(6),t=d,r=0;n<g;)n=(n+r)l,t=l,r=u.g(1);for(;y<=n;)n/=2,t/=2,r>>>=1;return(n+r)/t}var o=[],i=j(function n(t,r){var e,o=[],i=typeof t;if(r&&"object"==i)for(e in t)try{o.push(n(t[e],r-1))}catch(n){}return o.length?o:"string"==i?t:t+"\0"}((t=1==t?{entropy:!0}:t||{}).entropy?[n,S(a)]:null==n?function(){try{var n;return s&&(n=s.randomBytes)?n=n(l):(n=new Uint8Array(l),(f.crypto||f.msCrypto).getRandomValues(n)),S(n)}catch(n){var t=f.navigator,r=t&&t.plugins;return[+new Date,f,r,f.screen,S(a)]}}():n,3),o),u=new m(o);return e.int32=function(){return 0|u.g(4)},e.quick=function(){return u.g(4)/4294967296},e.double=e,j(S(u.S),a),(t.pass||r||function(n,t,r,e){return e&&(e.S&&v(e,u),n.state=function(){return v(u,{})}),r?(c[p]=n,t):n})(e,i,"global"in t?t.global:this==c,t.state)}function m(n){var t,r=n.length,u=this,e=0,o=u.i=u.j=0,i=u.S=[];for(r||(n=[r++]);e<l;)i[e]=e++;for(e=0;e<l;e++)i[e]=i[o=h&o+n[e%r]+(t=i[e])],i[o]=t;(u.g=function(n){for(var t,r=0,e=u.i,o=u.j,i=u.S;n--;)t=i[e=h&e+1],r=rl+i[h&(i[e]=i[o=h&o+t])+(i[o]=t)];return u.i=e,u.j=o,r})(l)}function v(n,t){return t.i=n.i,t.j=n.j,t.S=n.S.slice(),t}function j(n,t){for(var r,e=n+"",o=0;o<e.length;)t[h&o]=h&(r^=19*t[h&o])+e.charCodeAt(o++);return S(t)}function S(n){return String.fromCharCode.apply(0,n)}if(j(c.random(),a),"object"==typeof module&&module.exports){module.exports=n;try{s=require("crypto")}catch(n){}}else"function"==typeof define&&define.amd?define(function(){return n}):c["seed"+p]=n}("undefined"!=typeof self?self:this,[],Math);


