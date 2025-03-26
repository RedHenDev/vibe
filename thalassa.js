const seaEntity = document.createElement('a-entity');
seaEntity.setAttribute('the-sea', '');
document.querySelector('a-scene').appendChild(seaEntity);

AFRAME.registerComponent('the-sea', {
    init: function() {

        this.pl = document.querySelector('#player').object3D;

        const bud = document.createElement('a-box');
        bud.setAttribute('thalassa', '0 0 0')
        bud.setAttribute('position', '0 0 0');
        bud.setAttribute('scale','1000 0.01 1000');
        bud.setAttribute('color','#DD00DD');
        bud.setAttribute('transparent', 'true');
        bud.setAttribute('opacity', '0.7');
        document.querySelector('a-scene').appendChild(bud);

        this.sea = bud.object3D;
        //console.log('building sea');

    },
    
    tick: function(time, delta) {
        //console.log(`${this.el.object3D.position.y}`);

        this.sea.position.x = this.pl.position.x;
        this.sea.position.z = this.pl.position.z;
        this.sea.position.y=-12;
    }
});
