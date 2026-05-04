import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh } from './GameUtils';

export class Explosion {
    particles: { pos: vec3, vel: vec3, life: number, maxLife: number, colorIdx: number, scaleMultiplier: number }[] = [];
    static particleMeshes: Map<string, Gfx3Mesh> = new Map();
    static qMat = new Quaternion();
    colorKeys: string[] = [];

    constructor(x: number, y: number, z: number, color: [number, number, number] = [1.0, 0.4, 0.0], direction?: vec3, scaleMultiplier: number = 1.0) {
        const colorKey1 = `${color[0]},${color[1]},${color[2]}`;
        const color2 = [Math.min(1.0, color[0] * 1.5), Math.min(1.0, color[1] * 1.5), Math.min(1.0, color[2] * 1.5)];
        const colorKey2 = `${color2[0]},${color2[1]},${color2[2]}`;
        const color3 = [Math.max(0.0, color[0] * 0.5), Math.max(0.0, color[1] * 0.5), Math.max(0.0, color[2] * 0.5)];
        const colorKey3 = `${color3[0]},${color3[1]},${color3[2]}`;
        
        this.colorKeys = [colorKey1, colorKey2, colorKey3];
        
        if (!Explosion.particleMeshes.has(colorKey1)) {
            Explosion.particleMeshes.set(colorKey1, createBoxMesh(0.6, 0.6, 0.6, color));
            Explosion.particleMeshes.set(colorKey2, createBoxMesh(0.4, 0.4, 0.4, color2 as [number, number, number]));
            Explosion.particleMeshes.set(colorKey3, createBoxMesh(0.8, 0.8, 0.8, color3 as [number, number, number]));
        }

        const numParticles = Math.floor((direction ? 12 : 20) * (scaleMultiplier >= 2 ? 2.5 : scaleMultiplier));

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
            
            this.particles.push({ pos, vel, life, maxLife: life, colorIdx: Math.floor(Math.random() * 3), scaleMultiplier });
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
                p.vel[0] *= 0.9; // Drag
                p.vel[2] *= 0.9; // Drag
                p.vel[1] -= 25 * (ts / 1000); // gravity
                
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
                
                let scale = Math.max(0, p.life / p.maxLife);
                scale = scale * (1.0 + Math.random() * 0.5) * p.scaleMultiplier; // Add some flicker and scale
                
                const ZERO: vec3 = [0,0,0];
                const mat = UT.MAT4_TRANSFORM(p.pos, ZERO, [scale, scale, scale], Explosion.qMat);
                gfx3MeshRenderer.drawMesh(mesh, mat);
            }
        }
    }
}
