# ArcadeGPU: Tank Command

**ELI10 TLDR:** You play as a character who can run around on foot and jump into a tank! Drive your tank, aim the turret with your mouse, and blast enemy cubes while navigating a 3D pixelated battlefield.

A high-performance 3D Tank Game built with the **ArcadeGPU** engine. This project features real-time Jolt Physics, custom 3D mesh rendering, and a nostalgic arcade aesthetic.

## 🎮 How to Play

### Controls
*   **W A S D** - Walk and drive the tank
*   **SHIFT** - Run faster (on foot)
*   **MOUSE** - Look around and aim your tank turret
*   **SPACE / LEFT CLICK** - Shoot tank projectiles (if inside the tank) and jump (if outside the tank)
*   **E** - Hop in or out of the tank
*   **Virtual Joystick / Buttons** - On-screen controls for mobile players

## 📁 Directory Structure

```text
/
├── arcadegpu-code/          # Core Engine Library (ArcadeGPU)
│   ├── src/lib/             # Engine Source (gfx3, jolt, input, etc.)
│   └── public/              # Core Assets (WASMs, standard textures)
├── components/
│   ├── App/                 # Main Application Components
│   │   ├── game/            # Game Entities (Tank, Player, Enemy, Explosion)
│   │   └── App.tsx          # Main Game Screen Logic & UI Overlay
│   ├── Core/                # UI Design System Components
│   └── Package/             # Complex UI Modules
```

## 🛠 Developer Handoff Guide

### Key Systems

1.  **Input Handling**: Centralized in `inputManager`. Actions are registered in `GameScreen.onEnter()`. Pointer event propagation is explicitly stopped for touch UI buttons to prevent unintended camera movement while shooting/driving.
2.  **Continuous Fire**: Holding the fire button tracks the input state and recalculates recoil without requiring repeated button presses.
3.  **Entity Lifecycle**:
    -   `constructor()`: Setup physics bodies and load JSM meshes.
    -   `update(ts)`: Handle logic, move physics bodies, and sync mesh positions.
    -   `draw()`: Submit meshes to the `gfx3MeshRenderer`.
4.  **Targeting & Recoil**: The turret uses Shortest Angle Path to rotate towards the camera's yaw smoothly. The Tank physics recoil force was removed so the camera doesn't violently snap when shooting.

## ⚙️ Build and Run

1.  Ensure all dependencies are installed via `npm install`.
2.  Run the development server with `npm run dev` (or `tsx server.ts` if running in full stack mode).
3.  Navigate to `localhost:3000` to play.
