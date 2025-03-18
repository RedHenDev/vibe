AFRAME.registerComponent('ai-locomotion', {
    schema: {
        speed: {type: 'number', default: 0.6},
        height: {type: 'number', default: 0.6},
        wiggle: {type: 'boolean', default: true},
        flee: {type: 'boolean', default: false},
        targetID: {type: 'string', default: '#player'},
        rSpeed: {type: 'number', default: 1},
        clampY: {type: 'boolean', default: true},
        adjustY: {type: 'number', default: 0}

    },

    init: function() {
        this.rig = this.el.object3D;
        //this.target = document.querySelector(this.data.target).object3D;

        // These below taken from LookAt. Have changed
        // this.target to this.targetID to avoid clash above.
        this.targetID = document.querySelector(this.data.targetID).object3D;
        this.object = this.el.object3D;
        this.origRotX = this.el.object3D.rotation.x;
        this.origRotZ = this.el.object3D.rotation.z;
    },

    turn: function() {
        //this.rig.lookAt(this.target.position);
        
        // Create a direction vector from object to target
        const direction = new THREE.Vector3();
        direction.subVectors(this.targetID.position, 
            this.object.position).normalize();

        // First, get the angle in the XZ plane (yaw).
        let fleep=0;
        //if (this.data.flee) fleep = 180;
        const yaw = 
        Math.atan2(direction.x, direction.z) + fleep
            + this.data.adjustY;
        // AdjustY here added for models whose forward direction
        // not correct, or just in case otherwise needed.

        // Then get the angle from the ground plane (pitch).
        const pitch = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));

        // Apply the rotations.
        // Are we only rotating Y axis?
        if (this.data.clampY){
            this.object.rotation.set(0, yaw * this.data.rSpeed, 0);
        }
        else {
            // Then get the angle from the ground plane (pitch).
            const pitch = Math.atan2(direction.y, 
                Math.sqrt(direction.x * direction.x + direction.z * direction.z));
            this.object.rotation.set(-pitch * this.data.rSpeed, yaw * this.data.rSpeed, 0);
            }
    },

    tick: function(time, delta) {
        
        if (!delta) return;
        delta = delta * 0.001; // Convert to seconds.
        
        // Experiment. Can we move the armadillo?
        //const radCon = Math.PI / 180;
        
        const mx = this.rig.position.x;
        const mz = this.rig.position.z;
        const my = getTerrainHeight(mx,mz);
        this.rig.position.y = my+this.data.height;

        //if (this.data.aidrive){
            this.turn();
        //}
        let flep=1;
        if (this.data.flee) flep=-1;
        this.rig.position.x += 
                flep*Math.sin(this.rig.rotation.y+this.data.adjustY)*this.data.speed * delta;
            this.rig.position.z += 
                flep*Math.cos(this.rig.rotation.y+this.data.adjustY)*this.data.speed * delta;

        if (!this.data.wiggle) return;
        // Wiggle?
        this.rig.rotation.z = Math.sin((Math.abs(this.rig.position.z) + 
                            Math.abs(this.rig.position.x)) *8) * 0.16;

    }
});