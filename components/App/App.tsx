/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, useRef } from 'react';
import { em } from '@lib/engine/engine_manager';
import { screenManager } from '@lib/screen/screen_manager';
import { Screen } from '@lib/screen/screen';
import { gfx3Manager } from '@lib/gfx3/gfx3_manager';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { gfx3PostRenderer, PostParam } from '@lib/gfx3_post/gfx3_post_renderer';
import { gfx3JoltManager, JOLT_LAYER_MOVING, JOLT_RVEC3_TO_VEC3, VEC3_TO_JOLT_RVEC3, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Camera } from '@lib/gfx3_camera/gfx3_camera';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { eventManager } from '@lib/core/event_manager';
import { Gfx3Drawable, Gfx3MeshEffect } from '@lib/gfx3/gfx3_drawable';
import { inputManager } from '@lib/input/input_manager';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Bomb, LogIn, LogOut } from 'lucide-react';
import { Tank } from './game/Tank';
import { Player } from './game/Player';
import { Environment } from './game/Environment';
import { Enemy } from './game/Enemy';
import { Explosion } from './game/Explosion';
import { createBoxMesh } from './game/GameUtils';

// --- SCREEN ---

import { GameScreen } from './game/GameScreen';

// --- UI COMPONENTS ---

const Joystick = ({ onChange }: { onChange: (dir: { x: number, y: number }) => void }) => {
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
            e.nativeEvent.stopImmediatePropagation();
        }
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = rect.width / 2;
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        setPos({ x: dx, y: dy });
        onChange({ x: dx / maxDist, y: dy / maxDist });
    };

    const handlePointerUp = () => {
        setDragging(false);
        setPos({ x: 0, y: 0 });
        onChange({ x: 0, y: 0 });
    };

    return (
        <div 
            ref={containerRef}
            className="w-32 h-32 rounded-full border-4 border-white/20 bg-white/5 flex items-center justify-center relative touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <motion.div 
                className="w-12 h-12 rounded-full bg-white shadow-xl pointer-events-none"
                animate={{ x: pos.x, y: pos.y }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            />
        </div>
    );
};

// --- APP COMPONENT ---

const App = () => {
    const [isReady, setIsReady] = useState(false);
    const gameScreenRef = useRef<GameScreen | null>(null);
    const [nearTank, setNearTank] = useState(false);
    const [inTank, setInTank] = useState(false);

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };
        document.addEventListener('contextmenu', handleContextMenu);

        const init = async () => {
            // Give a moment for the DOM to settle
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Initialization is handled by singleton imports, 
            // but we need to wait for Jolt and WebGPU.
            // gfx3Manager initializes itself on import, but we need to make sure the loop starts.
            
            const screen = new GameScreen();
            gameScreenRef.current = screen;
            screenManager.requestSetScreen(screen);
            
            await screen.onEnter();
            
            em.startup(false);
            setIsReady(true);
        };

        init();

        const interval = setInterval(() => {
            const screen = gameScreenRef.current;
            if (screen) {
                const tankPos = screen.tank.body.getPosition();
                const playerPos = screen.player.position;
                const dist = UT.VEC3_DISTANCE(tankPos, playerPos);
                setNearTank(!screen.isPlayerInTank && dist < 6.0);
                setInTank(screen.isPlayerInTank);
            }
        }, 100);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            clearInterval(interval);
            em.pause();
        };
    }, []);

    const handleJoystickChange = (dir: { x: number, y: number }) => {
        if (gameScreenRef.current) {
            gameScreenRef.current.moveDir = dir;
        }
    };

    const activeFires = useRef<Set<string>>(new Set());

    const handleFireDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, type: 'normal' | 'grenade') => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if ((e as any).nativeEvent && (e as any).nativeEvent.stopImmediatePropagation) {
            (e as any).nativeEvent.stopImmediatePropagation();
        }
        
        activeFires.current.add(type);
        if (gameScreenRef.current) {
            gameScreenRef.current.virtualFire = type; // The tank will pick the latest or whichever
        }
        (e.target as HTMLElement).setPointerCapture((e as any).pointerId);
    };

    const handleFireUp = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, type: 'normal' | 'grenade') => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if ((e as any).nativeEvent && (e as any).nativeEvent.stopImmediatePropagation) {
            (e as any).nativeEvent.stopImmediatePropagation();
        }
        
        activeFires.current.delete(type);
        
        if (gameScreenRef.current) {
            if (activeFires.current.has('grenade')) gameScreenRef.current.virtualFire = 'grenade';
            else if (activeFires.current.has('normal')) gameScreenRef.current.virtualFire = 'normal';
            else gameScreenRef.current.virtualFire = 'none';
        }
        
        try {
            (e.target as HTMLElement).releasePointerCapture((e as any).pointerId);
        } catch (err) {}
    };

    const handleInteract = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if ((e as any).nativeEvent && (e as any).nativeEvent.stopImmediatePropagation) {
            (e as any).nativeEvent.stopImmediatePropagation();
        }
        if (gameScreenRef.current) gameScreenRef.current.virtualInteract = true;
    };

    return (
        <div className="fixed inset-0 w-full h-full pointer-events-none flex flex-col justify-end p-8 overflow-hidden font-sans">
            <AnimatePresence>
                {!isReady && (
                    <motion.div 
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 pointer-events-auto"
                    >
                        <div className="text-white text-2xl font-bebas tracking-widest animate-pulse">
                            INITIALIZING ARCADEGPU...
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute top-8 left-8 pointer-events-auto">
                <h1 className="text-4xl font-bebas text-white drop-shadow-lg tracking-wider">TANK COMMAND</h1>
                <div className="bg-black/20 backdrop-blur-sm p-3 rounded-lg border border-white/5 mt-2">
                    <p className="text-white/80 text-xs font-bold uppercase tracking-tighter mb-1">Controls</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">WASD + SHIFT • WALK / RUN</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">MOUSE • LOOK AROUND</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">SPACE • JUMP / FIRE</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">L CLICK • FIRE | R CLICK • GRENADE</p>
                    <p className="text-white/60 text-[11px] font-mono leading-tight">E • ENTER / EXIT TANK</p>
                </div>
            </div>
            
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
               <div className="w-1 h-1 bg-white rounded-full opacity-50 mix-blend-difference"></div>
            </div>

            {nearTank && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-16 pointer-events-none">
                    <div className="bg-black/50 text-white font-mono px-4 py-2 rounded-lg border border-white/20 backdrop-blur">
                        Press <span className="text-yellow-400 font-bold">E</span> to enter tank
                    </div>
                </div>
            )}
            
            {inTank && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-16 pointer-events-none">
                    <div className="bg-black/50 text-white font-mono px-4 py-2 rounded-lg border border-white/20 backdrop-blur">
                        Press <span className="text-yellow-400 font-bold">E</span> to exit tank
                    </div>
                </div>
            )}

            <div className="pointer-events-auto flex justify-between items-end w-full pb-8">
                <Joystick onChange={handleJoystickChange} />
                
                <div className="flex flex-col items-end gap-2">
                    {nearTank && !inTank && (
                        <button 
                            onPointerDown={handleInteract}
                            className="w-16 h-16 rounded-full bg-blue-500 shadow-lg border-b-4 border-blue-700 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center text-white font-bold mb-2 z-50 pointer-events-auto select-none touch-none">
                            <LogIn size={28} />
                        </button>
                    )}
                    {inTank && (
                        <button 
                            onPointerDown={handleInteract}
                            className="w-16 h-16 rounded-full bg-yellow-500 shadow-lg border-b-4 border-yellow-700 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center text-black font-bold mb-2 z-50 pointer-events-auto select-none touch-none">
                            <LogOut size={28} />
                        </button>
                    )}
                    <div className="flex gap-4 items-end">
                        <button 
                            onPointerDown={(e) => handleFireDown(e, 'grenade')}
                            onPointerUp={(e) => handleFireUp(e, 'grenade')}
                            onPointerLeave={(e) => handleFireUp(e, 'grenade')}
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-16 h-16 rounded-full bg-orange-500 shadow-[0_4px_10px_rgba(249,115,22,0.4)] border-b-[6px] border-orange-700 active:translate-y-1.5 active:border-b-0 transition-all flex items-center justify-center text-white bg-gradient-to-tr from-orange-700 to-orange-400 z-50 pointer-events-auto select-none touch-none shrink-0 mb-4">
                            <Bomb size={28} />
                        </button>
                        <button 
                            onPointerDown={(e) => handleFireDown(e, 'normal')}
                            onPointerUp={(e) => handleFireUp(e, 'normal')}
                            onPointerLeave={(e) => handleFireUp(e, 'normal')}
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-24 h-24 rounded-[30px] bg-red-600 shadow-[0_8px_20px_rgba(220,38,38,0.5)] border-b-[8px] border-red-800 active:translate-y-2 active:border-b-0 transition-all flex items-center justify-center text-white bg-gradient-to-tr from-red-800 to-red-500 z-50 pointer-events-auto select-none touch-none shrink-0">
                            <Target size={40} className="drop-shadow-lg" />
                        </button>
                    </div>
                    <div className="text-white/40 text-xs font-mono uppercase mt-4">Version 0.2.1-Alpha</div>
                </div>
            </div>

            <style>{`
                canvas {
                    image-rendering: auto;
                }
            `}</style>
        </div>
    );
};

export default App;
