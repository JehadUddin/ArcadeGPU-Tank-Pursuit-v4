import { gfx3JoltManager, JOLT_LAYER_MOVING, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Gfx3MeshJSM } from '@lib/gfx3_mesh/gfx3_mesh_jsm';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh } from './GameUtils';

/**
 * The Tank class represents the player-controlled vehicle.
 * It manages multiple mesh components (body, turret, barrel, etc.)
 * and integrates with Jolt Physics for movement.
 */
export class Tank {
  body: Gfx3Mesh;
  turret: Gfx3Mesh;
  barrel: Gfx3Mesh;
  trackL: Gfx3Mesh;
  trackR: Gfx3Mesh;
  engine: Gfx3Mesh;
  hatch: Gfx3Mesh;
  antenna: Gfx3Mesh;
  physicsBody: any;
  velocity: number = 0;
  rotation: number = 0;
  recoil: number = 0;
  turretYaw: number = 0;
  wasFiringInternal: boolean = false;
  currentUp: vec3 = [0, 1, 0];
  
  // Bullets instances
  projectiles: { body: any, life: number, rot: Quaternion }[] = [];

  static projMesh: Gfx3Mesh | null = null;

  constructor() {
    const chassisColor: [number, number, number] = [0.4, 0.5, 0.3];
    const turretColor: [number, number, number] = [0.35, 0.45, 0.25];
    const trackColor: [number, number, number] = [0.15, 0.15, 0.15];
    const engineColor: [number, number, number] = [0.2, 0.2, 0.2];

    // Initial placeholders until JSM models load
    this.body = createBoxMesh(2.25, 0.9, 3.3, chassisColor);
    this.turret = createBoxMesh(1.65, 0.75, 1.65, turretColor);
    this.barrel = createBoxMesh(0.3, 0.3, 2.25, [0.2, 0.2, 0.2]);
    this.trackL = createBoxMesh(0.6, 0.9, 3.6, trackColor);
    this.trackR = createBoxMesh(0.6, 0.9, 3.6, trackColor);
    this.engine = createBoxMesh(1.8, 0.6, 0.9, engineColor);
    this.hatch = createBoxMesh(0.6, 0.15, 0.6, [0.15, 0.15, 0.15]);
    this.antenna = createBoxMesh(0.05, 1.5, 0.05, [0.1, 0.1, 0.1]);

    if (!Tank.projMesh) {
      Tank.projMesh = createBoxMesh(0.2, 0.2, 1.6, [1.0, 0.8, 0.0]);
    }

    this.physicsBody = gfx3JoltManager.addBox({
      width: 3.45, height: 0.9, depth: 3.6,
      x: 0, y: 45, z: 0,
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { mAngularDamping: 1.0, mLinearDamping: 0.5, mMassPropertiesOverride: 100.0 }
    });
  }

  /**
   * Loads high-fidelity JSM models for the tank components.
   */
  async load() {
    const bodyJSM = new Gfx3MeshJSM();
    const turretJSM = new Gfx3MeshJSM();
    const barrelJSM = new Gfx3MeshJSM();

    try {
      await Promise.all([
        bodyJSM.loadFromFile('/models/tank_body.jsm'),
        turretJSM.loadFromFile('/models/tank_turret.jsm'),
        barrelJSM.loadFromFile('/models/tank_barrel.jsm')
      ]);

      this.body = bodyJSM;
      this.turret = turretJSM;
      this.barrel = barrelJSM;
    } catch (e) {
      console.warn('Failed to load JSM models, falling back to procedural boxes.', e);
    }
  }

  /**
   * Updates physics and syncs mesh transforms.
   */
  update(ts: number, moveDir: { x: number, y: number }, fireType: 'none' | 'normal' | 'grenade' = 'none', cameraYaw: number = 0): boolean {
    const speed = 15;
    const rotSpeed = 3.5;

    let didShoot = false;
    if (fireType !== 'none') {
        if (this.recoil <= 0) {
            this.shoot(fireType);
            this.recoil = 1.0;
            didShoot = true;
        }
        this.wasFiringInternal = true;
    } else {
        this.wasFiringInternal = false;
    }

    this.recoil -= (ts / 1000) * 5; 
    if (this.recoil < 0) this.recoil = 0;
    
    // Steering Logic
    this.rotation += moveDir.x * rotSpeed * (ts / 1000); 
    
    const throttle = moveDir.y;
    const targetVelocity = throttle * speed;
    const accelRate = throttle !== 0 ? 0.05 : 0.1;
    this.velocity = UT.LERP(this.velocity, targetVelocity, accelRate);

    // Physics Update
    const forward = [Math.sin(this.rotation), 0, Math.cos(this.rotation)] as vec3;
    const linVel = UT.VEC3_SCALE(forward, this.velocity);
    
    const curVel = this.physicsBody.body.GetLinearVelocity();
    const joltLinVel = new Gfx3Jolt.Vec3(linVel[0], curVel.GetY(), linVel[2]);
    gfx3JoltManager.bodyInterface.SetLinearVelocity(this.physicsBody.body.GetID(), joltLinVel);
    
    const pos = this.physicsBody.body.GetPosition();
    let quat = Quaternion.createFromEuler(this.rotation, 0, 0, 'YXZ');
    
    // Cast a ray down to find the ground normal for smooth banking
    let targetUp: vec3 = [0, 1, 0];
    const ray = gfx3JoltManager.createRay(pos.GetX(), pos.GetY() + 0.5, pos.GetZ(), pos.GetX(), pos.GetY() - 2.0, pos.GetZ());
    if (ray.normal) {
        targetUp = [ray.normal.GetX(), ray.normal.GetY(), ray.normal.GetZ()];
    }
    
    // Smoothly lerp the current up vector towards the ground normal
    this.currentUp = UT.VEC3_LERP(this.currentUp, targetUp, 6.0 * (ts / 1000));
    this.currentUp = UT.VEC3_NORMALIZE(this.currentUp);

    const up: vec3 = [0, 1, 0];
    let axis = UT.VEC3_CROSS(up, this.currentUp);
    const dot = UT.VEC3_DOT(up, this.currentUp);
    // Only align if there's a valid angle
    if (UT.VEC3_LENGTH(axis) > 0.001 && Math.abs(dot) < 0.999) {
        axis = UT.VEC3_NORMALIZE(axis);
        const clampedDot = Math.max(-1, Math.min(1, dot));
        const angle = Math.acos(clampedDot);
        const alignQ = Quaternion.createFromAxisAngle(axis, angle);
        quat = Quaternion.multiply(alignQ, quat); // Multiply align * yaw
    }

    const joltQuat = new Gfx3Jolt.Quat(quat.x, quat.y, quat.z, quat.w);
    gfx3JoltManager.bodyInterface.SetRotation(this.physicsBody.body.GetID(), joltQuat, Gfx3Jolt.EActivation_Activate);

    // Sync Mesh Positions
    const rot = this.physicsBody.body.GetRotation();
    const q = new Quaternion(rot.GetW(), rot.GetX(), rot.GetY(), rot.GetZ());

    this.body.setPosition(pos.GetX(), pos.GetY(), pos.GetZ());
    this.body.setQuaternion(q);

    // Component Offsets
    const trackOffsetL = q.rotateVector([-1.425, -0.15, 0]);
    this.trackL.setPosition(pos.GetX() + trackOffsetL[0], pos.GetY() + trackOffsetL[1], pos.GetZ() + trackOffsetL[2]);
    this.trackL.setQuaternion(q);

    const trackOffsetR = q.rotateVector([1.425, -0.15, 0]);
    this.trackR.setPosition(pos.GetX() + trackOffsetR[0], pos.GetY() + trackOffsetR[1], pos.GetZ() + trackOffsetR[2]);
    this.trackR.setQuaternion(q);

    const engineOffset = q.rotateVector([0, 0.3, -1.8]);
    this.engine.setPosition(pos.GetX() + engineOffset[0], pos.GetY() + engineOffset[1], pos.GetZ() + engineOffset[2]);
    this.engine.setQuaternion(q);

    // Turret follows body tilt but has independent yaw
    // We want the turret to smoothly turn to face cameraYaw.
    // Calculate the shortest angle path
    let yawDiff = cameraYaw - this.turretYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    
    const turretTraverseSpeed = 1.5; // rad per second
    const traverseAmount = turretTraverseSpeed * (ts / 1000);
    
    if (Math.abs(yawDiff) < traverseAmount) {
        this.turretYaw = cameraYaw;
    } else {
        this.turretYaw += Math.sign(yawDiff) * traverseAmount;
    }
    
    const localYaw = (this.turretYaw - this.rotation);
    const localYawQ = Quaternion.createFromEuler(localYaw, 0, 0, 'YXZ');
    const turretQ = Quaternion.multiply(q, localYawQ);
    
    const turretOffset = q.rotateVector([0, 0.675, 0]);
    this.turret.setPosition(pos.GetX() + turretOffset[0], pos.GetY() + turretOffset[1], pos.GetZ() + turretOffset[2]);
    this.turret.setQuaternion(turretQ);

    const visualRecoil = this.recoil > 0 ? this.recoil * 0.45 : 0;
    const barrelRelativePos = turretQ.rotateVector([0, 0, 1.2 - visualRecoil]);
    const turretPos = this.turret.getPosition();
    this.barrel.setPosition(turretPos[0] + barrelRelativePos[0], turretPos[1] + barrelRelativePos[1], turretPos[2] + barrelRelativePos[2]);
    this.barrel.setQuaternion(turretQ);
    
    const hatchOffset = turretQ.rotateVector([0, 0.375 + 0.075, -0.3]);
    this.hatch.setPosition(turretPos[0] + hatchOffset[0], turretPos[1] + hatchOffset[1], turretPos[2] + hatchOffset[2]);
    this.hatch.setQuaternion(turretQ);
    
    const antennaOffset = turretQ.rotateVector([-0.6, 0.375 + 0.75, -0.6]);
    this.antenna.setPosition(turretPos[0] + antennaOffset[0], turretPos[1] + antennaOffset[1], turretPos[2] + antennaOffset[2]);
    this.antenna.setQuaternion(turretQ);
    
    // Projectile Lifecycle
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
       const p = this.projectiles[i];
       p.life -= (ts / 1000);
       
       if (p.life <= 0) {
          gfx3JoltManager.remove(p.body.bodyId);
          this.projectiles.splice(i, 1);
       }
    }
    
    return didShoot;
  }
  
  /**
   * Spawns a projectile from the barrel.
   */
  shoot(type: 'normal' | 'grenade' = 'normal') {
    const q = this.barrel.getQuaternion();
    const direction = q.rotateVector([0, 0, 1]); 
    const bPos = this.barrel.getPosition();
    const startPos = [
      bPos[0] + direction[0] * 3.0,
      bPos[1] + direction[1] * 3.0,
      bPos[2] + direction[2] * 3.0,
    ];
    
    const pBody = gfx3JoltManager.addBox({
      width: 0.4, height: 0.4, depth: 0.4,
      x: startPos[0], y: startPos[1], z: startPos[2],
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { mMassPropertiesOverride: 0.01, mRestitution: 0.4 }
    });
    
    let forwardSpeed = 100;
    let upwardVelocity = 2; // slight arc for normal fire
    
    if (type === 'grenade') {
        forwardSpeed = 45;
        upwardVelocity = 15;
    }
    
    const pVel = new Gfx3Jolt.Vec3(
      direction[0] * forwardSpeed, 
      (direction[1] * forwardSpeed) + upwardVelocity, 
      direction[2] * forwardSpeed
    );
    gfx3JoltManager.bodyInterface.SetLinearVelocity(pBody.body.GetID(), pVel);
    
    // Tank no longer receives hard physics recoil from shooting to avoid camera jump
    
    this.projectiles.push({ body: pBody, life: 3.0, rot: q });
  }

  /**
   * Renders all tank components and active projectiles.
   */
  draw() {
    this.body.draw();
    this.trackL.draw();
    this.trackR.draw();
    this.engine.draw();
    this.turret.draw();
    this.barrel.draw();
    this.hatch.draw();
    this.antenna.draw();
    
    if (Tank.projMesh) {
      const scale: [number, number, number] = [1, 1, 1];
      for (const p of this.projectiles) {
         const pPos = p.body.body.GetPosition();
         const ZERO: [number, number, number] = [0,0,0];
         const matProj = UT.MAT4_TRANSFORM([pPos.GetX(), pPos.GetY(), pPos.GetZ()], ZERO, scale, p.rot);
         gfx3MeshRenderer.drawMesh(Tank.projMesh, matProj);
      }
    }
  }
}

