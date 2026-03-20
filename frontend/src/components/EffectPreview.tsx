import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
    Box, Typography, IconButton, Slider, ToggleButton, ToggleButtonGroup,
    Paper, Tooltip, Chip, TextField, Switch, FormControlLabel
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { NitroJSON, EffectAnimation, EffectAnimationFrame } from '../types';

interface EffectPreviewProps {
    nitroData: NitroJSON | null;
    spriteImages: Record<string, HTMLImageElement>;
    animation: EffectAnimation | null;
}

// --- Avatar imager ---

function buildAvatarUrl(username: string, direction: number, action: string): string {
    return `https://www.habbo.com/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&direction=${direction}&head_direction=${direction}&action=${action}&gesture=sml&size=l`;
}

function getAvatarActionFromFrame(frame: EffectAnimationFrame | null | undefined): string {
    if (!frame?.bodyparts?.length) return 'std';
    const actions: string[] = [];
    for (const bp of frame.bodyparts) {
        if (bp.action === 'CarryItem' && bp.id === 'rightarm') actions.push('crr=1');
        else if (bp.action === 'Move') actions.push('mv=1');
        else if (bp.action === 'Wave') actions.push('wav');
    }
    return actions.length > 0 ? actions.join(',') : 'std';
}

// --- Sprite frame resolution ---

/**
 * Find the correct spritesheet frame for a given sprite member, direction and animation frame.
 *
 * Spritesheet keys are the full SWF symbol names: {EffectName}_{assetName}
 * The asset name includes size, member, direction, and frame:
 *   e.g. "Staff_h_std_fx102_1_1_0_0"
 *        effectName: "Staff", assetName: "h_std_fx102_1_1_0_0"
 *
 * We match by suffix: _{member}_{direction}_{frame}
 */
function findSpriteFrame(
    frames: Record<string, any>,
    memberName: string,
    direction: number,
    frameIndex: number
): { frameName: string; frameData: any } | null {
    const keys = Object.keys(frames);

    // 1. Exact: _{member}_{dir}_{frame}
    const exactSuffix = `_${memberName}_${direction}_${frameIndex}`;
    let match = keys.find(k => k.endsWith(exactSuffix));
    if (match) return { frameName: match, frameData: frames[match] };

    // 2. Direction with frame 0: _{member}_{dir}_0
    if (frameIndex !== 0) {
        const dirSuffix = `_${memberName}_${direction}_0`;
        match = keys.find(k => k.endsWith(dirSuffix));
        if (match) return { frameName: match, frameData: frames[match] };
    }

    // 3. Non-directional: _{member}_0_{frame}
    if (direction !== 0) {
        const baseSuffix = `_${memberName}_0_${frameIndex}`;
        match = keys.find(k => k.endsWith(baseSuffix));
        if (match) return { frameName: match, frameData: frames[match] };
    }

    // 4. Fallback: _{member}_0_0
    if (direction !== 0 || frameIndex !== 0) {
        const fallbackSuffix = `_${memberName}_0_0`;
        match = keys.find(k => k.endsWith(fallbackSuffix));
        if (match) return { frameName: match, frameData: frames[match] };
    }

    // 5. Any frame containing the member name between underscores
    const memberPattern = `_${memberName}_`;
    match = keys.find(k => k.includes(memberPattern));
    if (match) return { frameName: match, frameData: frames[match] };

    // 6. Partial match on member name
    match = keys.find(k => k.includes(memberName));
    if (match) return { frameName: match, frameData: frames[match] };

    return null;
}

/**
 * Resolve the asset name from a spritesheet frame key.
 * Spritesheet keys use full symbol names: {EffectName}_{assetName}
 * We need to strip the effect name prefix to get the asset key.
 */
function resolveAssetName(frameName: string, effectName: string): string {
    const prefix = effectName + '_';
    if (frameName.startsWith(prefix)) {
        return frameName.substring(prefix.length);
    }
    return frameName;
}

/**
 * Look up asset x/y offsets (registration point) for a sprite.
 * The asset entry's x,y define where the sprite's origin is relative to its top-left corner.
 * To position: drawX = anchorX - assetX, drawY = anchorY - assetY
 */
function getAssetOffset(
    assets: Record<string, { x?: number; y?: number; source?: string; flipH?: boolean }> | undefined,
    assetName: string
): { x: number; y: number; flipH: boolean } {
    if (!assets) return { x: 0, y: 0, flipH: false };
    let entry = assets[assetName];
    // Follow source reference
    if (entry?.source) {
        entry = assets[entry.source] || entry;
    }
    return {
        x: entry?.x || 0,
        y: entry?.y || 0,
        flipH: entry?.flipH || false,
    };
}

// --- Expand frames with repeats ---

interface ExpandedFrame {
    originalIndex: number;
    frame: EffectAnimationFrame;
}

function expandFrames(frames: EffectAnimation['frames']): ExpandedFrame[] {
    if (!frames?.length) return [];
    const expanded: ExpandedFrame[] = [];
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const count = Math.max(1, f.repeats || 1);
        for (let r = 0; r < count; r++) {
            expanded.push({ originalIndex: i, frame: f });
        }
    }
    return expanded;
}

// --- Main component ---

export const EffectPreview: React.FC<EffectPreviewProps> = ({
    nitroData,
    spriteImages,
    animation
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTick, setCurrentTick] = useState(0);
    const [direction, setDirection] = useState(2);
    const [fps, setFps] = useState(24);
    const animFrameRef = useRef<number | null>(null);

    // Avatar state
    const [showAvatar, setShowAvatar] = useState(true);
    const [avatarUsername, setAvatarUsername] = useState(() =>
        localStorage.getItem('retrosprite_effect_avatar') || 'Habbo'
    );

    // Avatar image cache: keyed by URL to avoid re-downloading
    const avatarCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const [avatarReady, setAvatarReady] = useState(false);

    // Expand frames (honoring repeats)
    const expandedFrames = useMemo(() => expandFrames(animation?.frames), [animation?.frames]);
    const totalTicks = expandedFrames.length;

    // Current expanded frame
    const currentExpanded = totalTicks > 0 ? expandedFrames[currentTick % totalTicks] : null;
    const currentFrame = currentExpanded?.frame ?? null;
    const currentFrameIndex = currentExpanded?.originalIndex ?? 0;

    // Avatar action for current frame
    const avatarAction = useMemo(() => {
        if (!currentFrame) return 'std';
        return getAvatarActionFromFrame(currentFrame);
    }, [currentFrame]);

    // Build avatar URL
    const avatarUrl = useMemo(() => {
        if (!showAvatar || !avatarUsername) return '';
        return buildAvatarUrl(avatarUsername, direction, avatarAction);
    }, [showAvatar, avatarUsername, direction, avatarAction]);

    // Load/cache avatar image
    useEffect(() => {
        if (!avatarUrl) {
            setAvatarReady(false);
            return;
        }

        const cache = avatarCacheRef.current;
        if (cache.has(avatarUrl)) {
            setAvatarReady(true);
            return;
        }

        setAvatarReady(false);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            cache.set(avatarUrl, img);
            // Evict old entries (keep last 32)
            if (cache.size > 32) {
                const firstKey = cache.keys().next().value;
                if (firstKey) cache.delete(firstKey);
            }
            setAvatarReady(true);
        };
        img.onerror = () => setAvatarReady(false);
        img.src = avatarUrl;

        localStorage.setItem('retrosprite_effect_avatar', avatarUsername);
    }, [avatarUrl, avatarUsername]);

    // Get current cached avatar image
    const getAvatarImage = useCallback((): HTMLImageElement | null => {
        if (!avatarUrl) return null;
        // Try exact URL first
        const exact = avatarCacheRef.current.get(avatarUrl);
        if (exact) return exact;
        // Fallback: any cached image for the same direction (prevents blank during action change)
        const dirKey = `direction=${direction}&head_direction=${direction}`;
        for (const [url, img] of avatarCacheRef.current) {
            if (url.includes(dirKey) && url.includes(encodeURIComponent(avatarUsername))) return img;
        }
        return null;
    }, [avatarUrl, direction, avatarUsername]);

    // Avatar base dimensions (from Habbo imager "l" size: ~64x110)
    // Anchor point in Habbo is at the avatar's feet (bottom center)
    const AVATAR_BASE_W = 64;
    const AVATAR_BASE_H = 110;
    const AVATAR_FEET_RATIO = 0.90; // feet position ratio from top

    // Effect name for resolving asset keys from spritesheet frame names
    const effectName = useMemo(() => nitroData?.name || '', [nitroData]);

    // Calculate effect bounds for canvas sizing
    const effectMetrics = useMemo(() => {
        if (!animation || !nitroData?.spritesheet?.frames) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, maxSpriteSize: 0 };
        }

        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        let maxSpriteSize = 0;
        const ssFrames = nitroData.spritesheet.frames;
        const assets = nitroData.assets;
        const frames = animation.frames || [];

        for (const frame of frames) {
            for (const fx of (frame.fxs || [])) {
                const spriteInfo = animation.sprites?.find(s => s.id === fx.id);
                if (!spriteInfo) continue;
                const member = spriteInfo.member || spriteInfo.id || '';

                for (let d = 0; d < 8; d++) {
                    const found = findSpriteFrame(ssFrames, member, d, fx.frame || 0);
                    if (!found) continue;
                    const fd = found.frameData;

                    // Get asset registration point
                    const assetName = resolveAssetName(found.frameName, effectName);
                    const assetOff = getAssetOffset(assets, assetName);

                    // Direction-specific offset
                    const dirInfo = spriteInfo.directionList?.find(dl => dl.id === d);
                    const dirDx = dirInfo?.dx || 0;
                    const dirDy = dirInfo?.dy || 0;

                    // Position = -assetX + fxDx + dirDx, -assetY + fxDy + dirDy
                    const drawX = -(assetOff.x) + (fx.dx || 0) + dirDx;
                    const drawY = -(assetOff.y) + (fx.dy || 0) + dirDy;

                    minX = Math.min(minX, drawX);
                    minY = Math.min(minY, drawY);
                    maxX = Math.max(maxX, drawX + fd.frame.w);
                    maxY = Math.max(maxY, drawY + fd.frame.h);
                    maxSpriteSize = Math.max(maxSpriteSize, fd.frame.w, fd.frame.h);
                }
            }
        }

        return { minX, minY, maxX, maxY, maxSpriteSize };
    }, [animation, nitroData, effectName]);

    // Avatar at natural size, anchored at feet
    const avatarW = AVATAR_BASE_W;
    const avatarH = AVATAR_BASE_H;
    const avatarAnchorY = Math.round(avatarH * AVATAR_FEET_RATIO);

    // Canvas bounds
    const pad = 50;
    const boundsMinX = Math.min(effectMetrics.minX, -avatarW / 2) - pad;
    const boundsMinY = Math.min(effectMetrics.minY, -avatarAnchorY) - pad;
    const boundsMaxX = Math.max(effectMetrics.maxX, avatarW / 2) + pad;
    const boundsMaxY = Math.max(effectMetrics.maxY, avatarH - avatarAnchorY) + pad;

    const canvasWidth = Math.max(320, boundsMaxX - boundsMinX);
    const canvasHeight = Math.max(320, boundsMaxY - boundsMinY);
    const anchorX = -boundsMinX;
    const anchorY = -boundsMinY;

    // --- Draw ---

    const drawFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !nitroData || !animation) return;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        const width = canvas.width;
        const height = canvas.height;

        // Background
        ctx.fillStyle = '#1b2636';
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = '#2a3a4f';
        ctx.lineWidth = 0.5;
        const gridSize = 32;
        for (let x = anchorX % gridSize; x < width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = anchorY % gridSize; y < height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Crosshair at anchor
        ctx.strokeStyle = '#4a6a8f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(anchorX - 20, anchorY); ctx.lineTo(anchorX + 20, anchorY);
        ctx.moveTo(anchorX, anchorY - 20); ctx.lineTo(anchorX, anchorY + 20);
        ctx.stroke();

        // Collect render items with z-ordering
        interface RenderItem {
            z: number;
            draw: () => void;
        }
        const renderItems: RenderItem[] = [];

        // Avatar (z = 0)
        const avatarImg = getAvatarImage();
        if (showAvatar && avatarImg) {
            renderItems.push({
                z: 0,
                draw: () => {
                    ctx.drawImage(avatarImg,
                        Math.round(anchorX - avatarW / 2),
                        Math.round(anchorY - avatarAnchorY),
                        avatarW, avatarH
                    );
                }
            });
        }

        const ssFrames = nitroData.spritesheet?.frames;
        const sheetImageName = nitroData.spritesheet?.meta?.image;
        const sheetImage = sheetImageName ? spriteImages[sheetImageName] : null;

        const assets = nitroData.assets;

        if (ssFrames && sheetImage && currentFrame) {
            // Render FX sprites from current frame
            (currentFrame.fxs || []).forEach((fx) => {
                const spriteInfo = animation.sprites?.find(s => s.id === fx.id);
                if (!spriteInfo) return;

                const member = spriteInfo.member || spriteInfo.id || '';
                const fxDx = fx.dx || 0;
                const fxDy = fx.dy || 0;
                const fxFrame = fx.frame || 0;

                // Direction-specific offset from sprite's directionList
                const dirInfo = spriteInfo.directionList?.find(d => d.id === direction);
                const dirDx = dirInfo?.dx || 0;
                const dirDy = dirInfo?.dy || 0;
                const dz = dirInfo?.dz ?? 1; // default: in front of avatar

                // Resolve directional sprite
                const hasDirections = (spriteInfo.directions || 0) > 0;
                const spriteDir = hasDirections ? direction : 0;
                const found = findSpriteFrame(ssFrames, member, spriteDir, fxFrame);
                if (!found) return;

                const fd = found.frameData;

                // Get asset registration point (x, y offsets)
                const assetName = resolveAssetName(found.frameName, effectName);
                const assetOff = getAssetOffset(assets, assetName);

                // Position: registration point negated + frame offsets + direction offsets
                const drawX = Math.round(anchorX - assetOff.x + fxDx + dirDx);
                const drawY = Math.round(anchorY - assetOff.y + fxDy + dirDy);
                const ink = spriteInfo.ink || 0;
                const flipH = assetOff.flipH;

                renderItems.push({
                    z: dz,
                    draw: () => {
                        ctx.save();

                        // Ink blend modes
                        if (ink === 33) {
                            ctx.globalCompositeOperation = 'lighter';
                        } else if (ink === 37) {
                            ctx.globalCompositeOperation = 'multiply';
                        }

                        if (flipH) {
                            ctx.translate(drawX + fd.frame.w, drawY);
                            ctx.scale(-1, 1);
                            ctx.drawImage(sheetImage,
                                fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h,
                                0, 0, fd.frame.w, fd.frame.h
                            );
                        } else {
                            ctx.drawImage(sheetImage,
                                fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h,
                                drawX, drawY, fd.frame.w, fd.frame.h
                            );
                        }

                        ctx.restore();
                    }
                });
            });
        } else if (ssFrames && sheetImage && !currentFrame && animation.sprites?.length) {
            // No frames defined: show all sprites at their default position
            animation.sprites.forEach((sprite) => {
                const member = sprite.member || sprite.id || '';
                const hasDirections = (sprite.directions || 0) > 0;
                const spriteDir = hasDirections ? direction : 0;
                const found = findSpriteFrame(ssFrames, member, spriteDir, 0);
                if (!found) return;
                const fd = found.frameData;
                const ink = sprite.ink || 0;

                const assetName = resolveAssetName(found.frameName, effectName);
                const assetOff = getAssetOffset(assets, assetName);
                const drawX = Math.round(anchorX - assetOff.x);
                const drawY = Math.round(anchorY - assetOff.y);

                renderItems.push({
                    z: 1,
                    draw: () => {
                        ctx.save();
                        if (ink === 33) ctx.globalCompositeOperation = 'lighter';
                        else if (ink === 37) ctx.globalCompositeOperation = 'multiply';

                        if (assetOff.flipH) {
                            ctx.translate(drawX + fd.frame.w, drawY);
                            ctx.scale(-1, 1);
                            ctx.drawImage(sheetImage,
                                fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h,
                                0, 0, fd.frame.w, fd.frame.h
                            );
                        } else {
                            ctx.drawImage(sheetImage,
                                fd.frame.x, fd.frame.y, fd.frame.w, fd.frame.h,
                                drawX, drawY, fd.frame.w, fd.frame.h
                            );
                        }

                        ctx.restore();
                    }
                });
            });
        }

        // Sort by z: negative = behind avatar, 0 = avatar, positive = in front
        renderItems.sort((a, b) => a.z - b.z);
        renderItems.forEach(item => item.draw());

        // --- Overlay info ---

        ctx.fillStyle = '#90caf9';
        ctx.font = '11px monospace';

        if (currentFrame) {
            ctx.fillText(`Frame: ${currentFrameIndex}/${(animation.frames?.length || 1) - 1}  Tick: ${currentTick}/${totalTicks - 1}`, 8, 16);
            ctx.fillText(`Dir: ${direction}`, 8, 30);
            if (currentFrame.repeats && currentFrame.repeats > 1) {
                ctx.fillText(`Repeats: ${currentFrame.repeats}`, 8, 44);
            }

            // Bodyparts info at bottom
            let infoY = height - 12;
            if (currentFrame.bodyparts?.length) {
                ctx.fillStyle = '#ffab40';
                for (let i = currentFrame.bodyparts.length - 1; i >= 0; i--) {
                    const bp = currentFrame.bodyparts[i];
                    ctx.fillText(`bp: ${bp.id || '?'}${bp.action ? ' [' + bp.action + ']' : ''}`, 8, infoY);
                    infoY -= 14;
                }
            }
            if (currentFrame.fxs?.length) {
                ctx.fillStyle = '#81d4fa';
                for (let i = currentFrame.fxs.length - 1; i >= 0; i--) {
                    const fx = currentFrame.fxs[i];
                    const spriteInfo = animation.sprites?.find(s => s.id === fx.id);
                    const matched = spriteInfo ? findSpriteFrame(
                        nitroData.spritesheet?.frames || {},
                        spriteInfo.member || spriteInfo.id || '',
                        (spriteInfo.directions || 0) > 0 ? direction : 0,
                        fx.frame || 0
                    ) : null;
                    const status = matched ? '' : ' [!]';
                    ctx.fillText(`fx: ${fx.id || '?'} f:${fx.frame || 0} dx:${fx.dx || 0} dy:${fx.dy || 0}${status}`, 8, infoY);
                    infoY -= 14;
                }
            }
        } else if (totalTicks === 0) {
            ctx.fillText(`Dir: ${direction}`, 8, 16);
        }

        // Body-only effect indicator
        if (totalTicks > 0 && !animation.sprites?.length) {
            ctx.fillStyle = '#ffab40';
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Body animation effect (avatar only)', width / 2, height - 20);
            ctx.textAlign = 'left';
        }

        // Sprite resolution debug: show unmatched sprites in red
        if (ssFrames && animation.sprites?.length) {
            let unmatchedCount = 0;
            for (const sprite of animation.sprites) {
                const member = sprite.member || sprite.id || '';
                const found = findSpriteFrame(ssFrames, member, direction, 0);
                if (!found) unmatchedCount++;
            }
            if (unmatchedCount > 0) {
                ctx.fillStyle = '#ff5252';
                ctx.font = '11px monospace';
                ctx.fillText(`${unmatchedCount} sprite(s) not found in sheet`, width - 220, 16);
            }
        }

    }, [nitroData, animation, spriteImages, currentFrame, currentFrameIndex, currentTick, direction,
        totalTicks, showAvatar, avatarReady, getAvatarImage, canvasWidth, canvasHeight,
        anchorX, anchorY, avatarW, avatarH, avatarAnchorY, effectName]);

    // Animation loop
    useEffect(() => {
        if (!playing || totalTicks === 0) return;

        const interval = 1000 / fps;
        let lastTime = performance.now();

        const tick = (time: number) => {
            if (time - lastTime >= interval) {
                setCurrentTick(prev => (prev + 1) % totalTicks);
                lastTime = time;
            }
            animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [playing, totalTicks, fps]);

    // Redraw when state changes
    useEffect(() => {
        drawFrame();
    }, [drawFrame]);

    // Reset tick when animation changes
    useEffect(() => {
        setCurrentTick(0);
    }, [animation]);

    const handleDirectionChange = (_: React.MouseEvent, newDir: number | null) => {
        if (newDir !== null) setDirection(newDir);
    };

    if (!nitroData || !animation) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <Typography>No effect data to preview</Typography>
            </Box>
        );
    }

    // Compute original frame index for slider display
    const originalFrameCount = animation.frames?.length || 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1 }}>
            {/* Canvas */}
            <Box sx={{
                flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: '#1b2636', borderRadius: 1, overflow: 'auto',
                minHeight: 200
            }}>
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
                />
            </Box>

            {/* Controls */}
            <Paper sx={{ mt: 1, p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Previous Frame">
                        <span>
                            <IconButton size="small" onClick={() => setCurrentTick(prev => Math.max(0, prev - 1))} disabled={totalTicks === 0}>
                                <SkipPreviousIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={playing ? 'Pause' : 'Play'}>
                        <span>
                            <IconButton size="small" onClick={() => setPlaying(!playing)} disabled={totalTicks === 0}>
                                {playing ? <PauseIcon /> : <PlayArrowIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Next Frame">
                        <span>
                            <IconButton size="small" onClick={() => setCurrentTick(prev => (prev + 1) % Math.max(1, totalTicks))} disabled={totalTicks === 0}>
                                <SkipNextIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Reset">
                        <IconButton size="small" onClick={() => { setCurrentTick(0); setPlaying(false); }}>
                            <RestartAltIcon />
                        </IconButton>
                    </Tooltip>

                    <Box sx={{ flexGrow: 1, mx: 2 }}>
                        <Slider
                            size="small"
                            value={currentTick}
                            min={0}
                            max={Math.max(0, totalTicks - 1)}
                            onChange={(_, value) => setCurrentTick(value as number)}
                            disabled={totalTicks === 0}
                        />
                    </Box>

                    <Typography variant="caption" sx={{ minWidth: 80, textAlign: 'right', fontFamily: 'monospace' }}>
                        {currentFrameIndex}/{Math.max(0, originalFrameCount - 1)} ({currentTick}/{Math.max(0, totalTicks - 1)})
                    </Typography>
                </Box>

                {/* Direction + FPS */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="caption">Dir:</Typography>
                    <ToggleButtonGroup value={direction} exclusive onChange={handleDirectionChange} size="small">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
                            <ToggleButton key={d} value={d} sx={{ px: 1, minWidth: 28 }}>{d}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption">FPS:</Typography>
                    <Slider size="small" value={fps} min={1} max={60} onChange={(_, v) => setFps(v as number)} sx={{ width: 100 }} />
                    <Typography variant="caption" sx={{ minWidth: 24, fontFamily: 'monospace' }}>{fps}</Typography>
                </Box>

                {/* Avatar controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <FormControlLabel
                        control={<Switch size="small" checked={showAvatar} onChange={(e) => setShowAvatar(e.target.checked)} />}
                        label={<Typography variant="caption">Avatar</Typography>}
                        sx={{ mr: 0 }}
                    />
                    {showAvatar && (
                        <TextField
                            size="small" variant="standard" placeholder="Username"
                            value={avatarUsername}
                            onChange={(e) => setAvatarUsername(e.target.value)}
                            sx={{ width: 120 }}
                        />
                    )}
                </Box>

                {/* Info chips */}
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {animation.name && <Chip label={animation.name} size="small" variant="outlined" />}
                    {(animation.sprites?.length || 0) > 0 && (
                        <Chip label={`${animation.sprites!.length} sprites`} size="small" variant="outlined" />
                    )}
                    <Chip label={`${originalFrameCount} frames (${totalTicks} ticks)`} size="small" variant="outlined" />
                    {animation.resetOnToggle && <Chip label="resetOnToggle" size="small" color="info" />}
                    {animation.adds?.map((add, i) => (
                        <Chip key={i} label={`+${add.id}${add.align ? ' ' + add.align : ''}`} size="small" color="warning" variant="outlined" />
                    ))}
                    {animation.removes?.map((rem, i) => (
                        <Chip key={i} label={`-${rem.id}`} size="small" color="error" variant="outlined" />
                    ))}
                    {(animation.overrides?.length || 0) > 0 && (
                        <Chip label={`${animation.overrides!.length} overrides`} size="small" color="secondary" variant="outlined" />
                    )}
                </Box>
            </Paper>
        </Box>
    );
};
