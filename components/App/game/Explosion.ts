import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh } from './GameUtils';

export class Explosion {
    particles: { pos: vec3, vel: vec3, life: number, maxLife: number, colorIdx: number, scaleMultiplier: number, type: 'fire' | 'smoke' }[] = [];
    static particleMeshes: Map<string, Gfx3Mesh> = new Map();
    static qMat = new Quaternion();
    colorKeys: string[] = [];
    expType: 'muzzle' | 'normal' | 'grenade' | 'trail' = 'normal';

    constructor(x: number, y: number, z: number, color: [number, number, number] = [1.0, 0.4, 0.0], direction?: vec3, scaleMultiplier: number = 1.0, type: 'muzzle' | 'normal' | 'grenade' | 'trail' = 'normal') {
        const colorKey1 = `${color[0]},${color[1]},${color[2]}`;
        const color2 = [Math.min(1.0, color[0] * 1.5), Math.min(1.0, color[1] * 1.5), Math.min(1.0, color[2] * 1.5)];
        const colorKey2 = `${color2[0]},${color2[1]},${color2[2]}`;
        const color3 = [Math.max(0.0, color[0] * 0.5), Math.max(0.0, color[1] * 0.5), Math.max(0.0, color[2] * 0.5)];
        const colorKey3 = `${color3[0]},${color3[1]},${color3[2]}`;
        
        // Add gray/black smoke colors
        const smokeColor1 = [0.2, 0.2, 0.2];
        const smokeColor2 = [0.4, 0.4, 0.4];
        const smokeKey1 = 'smoke1';
        const smokeKey2 = 'smoke2';
        
        this.colorKeys = [colorKey1, colorKey2, colorKey3, smokeKey1, smokeKey2];
        this.expType = type;
        
        if (!Explosion.particleMeshes.has(colorKey1)) {
            Explosion.particleMeshes.set(colorKey1, createBoxMesh(0.6, 0.6, 0.6, color));
            Explosion.particleMeshes.set(colorKey2, createBoxMesh(0.4, 0.4, 0.4, color2 as [number, number, number]));
            Explosion.particleMeshes.set(colorKey3, createBoxMesh(0.8, 0.8, 0.8, color3 as [number, number, number]));
            Explosion.particleMeshes.set(smokeKey1, createBoxMesh(1.0, 1.0, 1.0, smokeColor1 as [number, number, number]));
            Explosion.particleMeshes.set(smokeKey2, createBoxMesh(1.2, 1.2, 1.2, smokeColor2 as [number, number, number]));
        }

        if (type === 'grenade') {
            // Grenade explosion: big burst of fire and smoke
            const numFire = 25 * scaleMultiplier;
            const numSmoke = 35 * scaleMultiplier;
            
            for (let i = 0; i < numFire; i++) {
                const pos: vec3 = [x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 2];
                const speed = (15 + Math.random() * 25);
                let dirX = (Math.random() - 0.5) * 2;
                let dirY = (Math.random() - 0.5) * 2 + 0.5;
                let dirZ = (Math.random() - 0.5) * 2;
                const vel = UT.VEC3_SCALE(UT.VEC3_NORMALIZE([dirX, dirY, dirZ]), speed);
                const life = (0.3 + Math.random() * 0.4);
                this.particles.push({ pos, vel, life, maxLife: life, colorIdx: Math.floor(Math.random() * 3), scaleMultiplier: scaleMultiplier * (0.8 + Math.random()*0.8), type: 'fire' });
            }
            
            for (let i = 0; i < numSmoke; i++) {
                const pos: vec3 = [x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 3];
                const speed = (5 + Math.random() * 15);
                let dirX = (Math.random() - 0.5) * 2;
                let dirY = Math.random() * 2 + 0.5; // Always upwards mostly
                let dirZ = (Math.random() - 0.5) * 2;
                const vel = UT.VEC3_SCALE(UT.VEC3_NORMALIZE([dirX, dirY, dirZ]), speed);
                const life = (1.0 + Math.random() * 1.0);
                this.particles.push({ pos, vel, life, maxLife: life, colorIdx: 3 + Math.floor(Math.random() * 2), scaleMultiplier: scaleMultiplier * (1.5 + Math.random()*1.5), type: 'smoke' });
            }
            
        } else if (type === 'trail') {
            // Trail: just 1 or 2 small smoke particles
            const numParticles = 1;
            for (let i = 0; i < numParticles; i++) {
                const pos: vec3 = [x + (Math.random() - 0.5) * 0.2, y + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.2];
                let dirX = (Math.random() - 0.5) * 2;
                let dirY = Math.random() * + 0.5;
                let dirZ = (Math.random() - 0.5) * 2;
                const vel = UT.VEC3_SCALE(UT.VEC3_NORMALIZE([dirX, dirY, dirZ]), 2.0);
                const life = 0.5 + Math.random() * 0.3;
                this.particles.push({ pos, vel, life, maxLife: life, colorIdx: 3 + Math.floor(Math.random() * 2), scaleMultiplier: scaleMultiplier * 0.5, type: 'smoke' });
            }
        } else {
            // Muzzle or normal explosion
            const numParticles = Math.floor((direction ? 12 : 20) * (scaleMultiplier >= 2 ? 1.5 : scaleMultiplier));

            for (let i = 0; i < numParticles; i++) {
                const pos: vec3 = [x + (Math.random() - 0.5) * 0.5 * scaleMultiplier, y + (Math.random() - 0.5) * 0.5 * scaleMultiplier, z + (Math.random() - 0.5) * 0.5 * scaleMultiplier];
                
                let vel: vec3;
                let life: number;

                if (direction) {
                    // Muzzle flash: cone spread
                    const speed = (15 + Math.random() * 25) * ((scaleMultiplier > 1) ? 1.5 : 1);
                    const spread = 0.8 * scaleMultiplier;
                    let dirX = direction[0] + (Math.random() - 0.5) * spread;
                    let dirY = direction[1] + (Math.random() - 0.5) * spread;
                    let dirZ = direction[2] + (Math.random() - 0.5) * spread;
                    vel = UT.VEC3_SCALE(UT.VEC3_NORMALIZE([dirX, dirY, dirZ]), speed);
                    life = (0.1 + Math.random() * 0.2) * (scaleMultiplier > 1 ? 1.5 : 1);
                } else {
                    // Explosion: spherical spread
                    const speed = (8 + Math.random() * 15) * scaleMultiplier;
                    let dirX = (Math.random() - 0.5) * 2;
                    let dirY = (Math.random() - 0.5) * 2 + 0.5; // bias upwards
                    let dirZ = (Math.random() - 0.5) * 2;
                    vel = UT.VEC3_SCALE(UT.VEC3_NORMALIZE([dirX, dirY, dirZ]), speed);
                    life = (0.4 + Math.random() * 0.6) * (scaleMultiplier > 1 ? 1.5 : 1);
                }
                
                this.particles.push({ pos, vel, life, maxLife: life, colorIdx: Math.floor(Math.random() * 3), scaleMultiplier, type: 'fire' });
            }
        }
    }

    update(ts: number): boolean {
        // Return false when fully dead
        let aliveCount = 0;
        for (const p of this.particles) {
            p.life -= ts / 1000;
            if (p.life > 0) {
                aliveCount++;
                
                // physics
                if (p.type === 'smoke') {
                    p.vel[0] *= 0.95; // Less drag for smoke
                    p.vel[2] *= 0.95;
                    p.vel[1] += 4 * (ts / 1000); // Smoke rises
                } else {
                    p.vel[0] *= 0.9; // Drag
                    p.vel[2] *= 0.9; // Drag
                    p.vel[1] -= 25 * (ts / 1000); // gravity for chunks/fire
                }
                
                p.pos[0] += p.vel[0] * (ts / 1000);
                p.pos[1] += p.vel[1] * (ts / 1000);
                p.pos[2] += p.vel[2] * (ts / 1000);
            }
        }
        return aliveCount > 0;
    }

    draw() {
        for (const p of this.particles) {
            if (p.life > 0) {
                const mesh = Explosion.particleMeshes.get(this.colorKeys[p.colorIdx]);
                if (!mesh) continue;
                
                let scale = 0;
                const lifeRatio = p.life / p.maxLife;
                
                if (p.type === 'smoke') {
                    // Smoke expands over time and shrinks at the end
                    scale = Math.sin(lifeRatio * Math.PI) * 1.5 * p.scaleMultiplier;
                } else {
                    // Fire chunks shrink
                    scale = Math.max(0, lifeRatio);
                    scale = scale * (1.0 + Math.random() * 0.5) * p.scaleMultiplier; // Add some flicker and scale
                }
                
                const ZERO: vec3 = [0,0,0];
                const mat = UT.MAT4_TRANSFORM(p.pos, ZERO, [scale, scale, scale], Explosion.qMat);
                gfx3MeshRenderer.drawMesh(mesh, mat);
            }
        }
    }
}
