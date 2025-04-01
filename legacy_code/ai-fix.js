// Find this line in vibe-hunter.js:
worldToLocal.getInverse(this.el.object3D.matrixWorld);

// Replace with:
if (worldToLocal.getInverse) {
  worldToLocal.getInverse(this.el.object3D.matrixWorld);
} else {
  worldToLocal.copy(this.el.object3D.matrixWorld).invert();
}