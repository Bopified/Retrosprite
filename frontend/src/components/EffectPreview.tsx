import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, IconButton, Slider, ToggleButton, ToggleButtonGroup,
    Paper, Tooltip, Chip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { NitroJSON, EffectAnimation } from '../types';

interface EffectPreviewProps {
    nitroData: NitroJSON | null;
    spriteImages: Record<string, HTMLImageElement>;
    animation: EffectAnimation | null;
}

export const EffectPreview: React.FC<EffectPreviewProps> = ({
    nitroData,
    spriteImages,
    animation
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [direction, setDirection] = useState(0);
    const [fps, setFps] = useState(24);
    const animFrameRef = useRef<number | null>(null);

    const totalFrames = animation?.frames?.length || 0;

    const drawFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !nitroData || !animation) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#1b2636';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = '#2a3a4f';
        ctx.lineWidth = 0.5;
        const gridSize = 32;
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw crosshair at center
        const cx = width / 2;
        const cy = height / 2;
        ctx.strokeStyle = '#4a6a8f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy);
        ctx.lineTo(cx + 20, cy);
        ctx.moveTo(cx, cy - 20);
        ctx.lineTo(cx, cy + 20);
        ctx.stroke();

        // If no frames, show sprites list
        if (totalFrames === 0 && animation.sprites) {
            // Draw all sprites at center
            animation.sprites.forEach((sprite, i) => {
                const spriteName = sprite.member || sprite.id || '';
                drawSpriteAtCenter(ctx, nitroData, spriteImages, spriteName, cx, cy + i * 40);
            });
            return;
        }

        // Draw current frame's FX parts
        const frame = animation.frames?.[currentFrame];
        if (!frame) return;

        // Draw FX parts
        frame.fxs?.forEach((fx) => {
            const spriteInfo = animation.sprites?.find(s => s.id === fx.id);
            if (!spriteInfo) return;

            const spriteName = spriteInfo.member || spriteInfo.id || '';
            const dx = fx.dx || 0;
            const dy = fx.dy || 0;

            drawSpriteAtCenter(ctx, nitroData, spriteImages, spriteName, cx + dx, cy + dy);
        });

        // Draw frame info
        ctx.fillStyle = '#90caf9';
        ctx.font = '12px monospace';
        ctx.fillText(`Frame: ${currentFrame}/${totalFrames - 1}`, 10, 20);
        ctx.fillText(`Direction: ${direction}`, 10, 36);
        if (frame.repeats) {
            ctx.fillText(`Repeats: ${frame.repeats}`, 10, 52);
        }

        // Draw sprite names for current frame
        const parts = [...(frame.fxs || []), ...(frame.bodyparts || [])];
        parts.forEach((part, i) => {
            ctx.fillStyle = '#aaa';
            ctx.fillText(`${part.id || '?'} (f:${part.frame || 0})`, 10, height - 20 - (parts.length - 1 - i) * 16);
        });

    }, [nitroData, animation, spriteImages, currentFrame, direction, totalFrames]);

    // Animation loop
    useEffect(() => {
        if (!playing || totalFrames === 0) return;

        const interval = 1000 / fps;
        let lastTime = performance.now();

        const tick = (time: number) => {
            if (time - lastTime >= interval) {
                setCurrentFrame(prev => (prev + 1) % totalFrames);
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
    }, [playing, totalFrames, fps]);

    // Draw on frame change
    useEffect(() => {
        drawFrame();
    }, [drawFrame]);

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

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1 }}>
            {/* Canvas */}
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#1b2636', borderRadius: 1, overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    width={512}
                    height={384}
                    style={{ imageRendering: 'pixelated' }}
                />
            </Box>

            {/* Controls */}
            <Paper sx={{ mt: 1, p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Playback controls */}
                    <Tooltip title="Previous Frame">
                        <IconButton size="small" onClick={() => setCurrentFrame(prev => Math.max(0, prev - 1))} disabled={totalFrames === 0}>
                            <SkipPreviousIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={playing ? 'Pause' : 'Play'}>
                        <IconButton size="small" onClick={() => setPlaying(!playing)} disabled={totalFrames === 0}>
                            {playing ? <PauseIcon /> : <PlayArrowIcon />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Next Frame">
                        <IconButton size="small" onClick={() => setCurrentFrame(prev => (prev + 1) % Math.max(1, totalFrames))} disabled={totalFrames === 0}>
                            <SkipNextIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset">
                        <IconButton size="small" onClick={() => { setCurrentFrame(0); setPlaying(false); }}>
                            <RestartAltIcon />
                        </IconButton>
                    </Tooltip>

                    {/* Frame slider */}
                    <Box sx={{ flexGrow: 1, mx: 2 }}>
                        <Slider
                            size="small"
                            value={currentFrame}
                            min={0}
                            max={Math.max(0, totalFrames - 1)}
                            onChange={(_, value) => setCurrentFrame(value as number)}
                            disabled={totalFrames === 0}
                        />
                    </Box>

                    <Typography variant="caption" sx={{ minWidth: 60, textAlign: 'right' }}>
                        {currentFrame}/{Math.max(0, totalFrames - 1)}
                    </Typography>
                </Box>

                {/* Direction selector and FPS */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="caption">Direction:</Typography>
                    <ToggleButtonGroup
                        value={direction}
                        exclusive
                        onChange={handleDirectionChange}
                        size="small"
                    >
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
                            <ToggleButton key={d} value={d} sx={{ px: 1, minWidth: 32 }}>
                                {d}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    <Box sx={{ flexGrow: 1 }} />

                    <Typography variant="caption">FPS:</Typography>
                    <Slider
                        size="small"
                        value={fps}
                        min={1}
                        max={60}
                        onChange={(_, value) => setFps(value as number)}
                        sx={{ width: 100 }}
                    />
                    <Typography variant="caption" sx={{ minWidth: 24 }}>{fps}</Typography>
                </Box>

                {/* Info */}
                <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                    {animation.name && <Chip label={`Name: ${animation.name}`} size="small" variant="outlined" />}
                    <Chip label={`Sprites: ${animation.sprites?.length || 0}`} size="small" variant="outlined" />
                    <Chip label={`Frames: ${totalFrames}`} size="small" variant="outlined" />
                    {animation.resetOnToggle && <Chip label="resetOnToggle" size="small" color="info" />}
                </Box>
            </Paper>
        </Box>
    );
};

// Helper: draw a named sprite at a position
function drawSpriteAtCenter(
    ctx: CanvasRenderingContext2D,
    nitroData: NitroJSON,
    spriteImages: Record<string, HTMLImageElement>,
    spriteName: string,
    x: number,
    y: number
) {
    const spritesheet = nitroData.spritesheet;
    if (!spritesheet) return;

    // Find matching frame in spritesheet
    const frameName = Object.keys(spritesheet.frames).find(name =>
        name.includes(spriteName)
    );

    if (!frameName) return;

    const frameData = spritesheet.frames[frameName];
    const sheetImage = spriteImages[spritesheet.meta.image];
    if (!sheetImage || !frameData) return;

    const sx = frameData.frame.x;
    const sy = frameData.frame.y;
    const sw = frameData.frame.w;
    const sh = frameData.frame.h;

    // Draw centered at position
    ctx.drawImage(sheetImage, sx, sy, sw, sh, x - sw / 2, y - sh / 2, sw, sh);
}
