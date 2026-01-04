import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Typography, IconButton, Slider, TextField, MenuItem } from '@mui/material';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import GridOnIcon from '@mui/icons-material/GridOn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NorthWestIcon from '@mui/icons-material/NorthWest';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import PersonIcon from '@mui/icons-material/Person';
import type { NitroJSON, AvatarTestingState } from '../types';
import floorTile from '../assets/floor_tile.png';
import centerTile from '../assets/center_tile.png';

interface FurniturePreviewProps {
    jsonContent: NitroJSON;
    images: Record<string, string>; // Map of filename -> base64
    avatarTesting?: AvatarTestingState;
    onAvatarTestingChange?: (newState: AvatarTestingState) => void;
}

export const FurniturePreview: React.FC<FurniturePreviewProps> = ({
    jsonContent,
    images,
    avatarTesting,
    onAvatarTestingChange
}) => {
    // Parse Visualization Data first to set initial direction
    const visualizations = jsonContent.visualizations || [];
    const mainViz = useMemo(() => {
        return visualizations.find(v => v.size === 64) || visualizations[0];
    }, [visualizations]);

    const availableDirections = useMemo(() => {
        if (!mainViz || !mainViz.directions) return [0, 2, 4, 6];
        return Object.keys(mainViz.directions).map(Number).sort((a, b) => a - b);
    }, [mainViz]);

    const availableAnimations = useMemo(() => {
        if (!mainViz || !mainViz.animations) return [0];
        const animStates = Object.keys(mainViz.animations).map(Number);
        // Always include state 0 (default/idle state) even if not defined in animations
        if (!animStates.includes(0)) {
            animStates.unshift(0);
        }
        return animStates.sort((a, b) => a - b);
    }, [mainViz]);

    const [direction, setDirection] = useState(() => {
        // Initialize with a valid direction if possible
        if (availableDirections.length > 0) return availableDirections[0];
        return 0;
    });

    const [animationState, setAnimationState] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [frameIndex, setFrameIndex] = useState(0);
    const [fps, setFps] = useState(24); // Default 24 FPS (Habbo in-game default)

    // Camera controls
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isPanning = React.useRef(false);
    const panStartPos = React.useRef({ x: 0, y: 0 });
    const panStartOffset = React.useRef({ x: 0, y: 0 });

    // Grid and avatar testing
    const [showTileGrid, setShowTileGrid] = useState(false);

    // Timer for animation
    useEffect(() => {
        let interval: number;
        if (isPlaying) {
            const frameDelay = 1000 / fps; // Calculate delay based on FPS
            interval = window.setInterval(() => {
                setFrameIndex(prev => prev + 1);
            }, frameDelay);
        }
        return () => window.clearInterval(interval);
    }, [isPlaying, fps]);

    // Update direction if it becomes invalid (e.g. file switch)
    useEffect(() => {
        if (availableDirections.length > 0 && !availableDirections.includes(direction)) {
            setDirection(availableDirections[0]);
        }
    }, [availableDirections, direction]);

    const handleRotate = () => {
        const currentIndex = availableDirections.indexOf(direction);
        const nextIndex = (currentIndex + 1) % availableDirections.length;
        setDirection(availableDirections[nextIndex]);
    };

    // Avatar movement handlers
    const moveAvatar = (rowDelta: number, colDelta: number) => {
        if (!avatarTesting || !onAvatarTestingChange) return;
        const newRow = avatarTesting.tileRow + rowDelta;
        const newCol = avatarTesting.tileCol + colDelta;

        // Keep within 30x30 grid bounds
        if (newRow >= 0 && newRow < 30 && newCol >= 0 && newCol < 30) {
            onAvatarTestingChange({
                ...avatarTesting,
                tileRow: newRow,
                tileCol: newCol
            });
        }
    };

    const adjustSubLayer = (delta: number) => {
        if (!avatarTesting || !onAvatarTestingChange) return;
        const newSubLayer = Math.max(1, Math.min(29, avatarTesting.subLayer + delta));
        onAvatarTestingChange({
            ...avatarTesting,
            subLayer: newSubLayer
        });
    };

    const toggleAvatar = () => {
        if (!avatarTesting || !onAvatarTestingChange) return;
        onAvatarTestingChange({
            ...avatarTesting,
            enabled: !avatarTesting.enabled
        });
    };

    // Camera control handlers
    const handleWheel = (e: React.WheelEvent) => {
        const delta = -e.deltaY;
        const scaleChange = delta > 0 ? 0.1 : -0.1;
        const newScale = Math.min(Math.max(scale + scaleChange, 0.1), 4);
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isPanning.current = true;
        panStartPos.current = { x: e.clientX, y: e.clientY };
        panStartOffset.current = { x: pan.x, y: pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning.current) {
            const dx = e.clientX - panStartPos.current.x;
            const dy = e.clientY - panStartPos.current.y;

            setPan({
                x: panStartOffset.current.x + dx,
                y: panStartOffset.current.y + dy
            });
        }
    };

    const handleMouseUp = () => {
        isPanning.current = false;
    };

    const resetCamera = () => {
        setScale(1);
        setPan({ x: 0, y: 0 });
    };

    if (!mainViz || !jsonContent.spritesheet || !jsonContent.assets) {
        return <Box p={3}><Typography>Insufficient data for preview.</Typography></Box>;
    }

    const { frames } = jsonContent.spritesheet;
    const { assets } = jsonContent;
    const layerCount = mainViz.layerCount;
    const layers = mainViz.layers || {};

    // Get the base image name (e.g. "bop_blue_hologram") from the JSON name
    const furnitureName = jsonContent.name;

    // Helper to construct sprite name
    const getSpriteName = (layerId: number, frame: number) => {
        const layerChar = String.fromCharCode(97 + layerId); // a, b, c...
        return `${furnitureName}_64_${layerChar}_${direction}_${frame}`;
    };

    // Helper to get shadow name
    const getShadowName = (frame: number) => {
        return `${furnitureName}_64_sd_${direction}_${frame}`;
    };

    // Helper to find image in map case-insensitively or by suffix
    const getImage = (imgName: string) => {
        if (!imgName) return null;
        if (images[imgName]) return images[imgName];

        const lowerName = imgName.toLowerCase();
        const foundKey = Object.keys(images).find(k =>
            k.toLowerCase() === lowerName ||
            k.toLowerCase().endsWith(`/${lowerName}`) ||
            k.endsWith(imgName)
        );
        return foundKey ? images[foundKey] : null;
    };

    // Helper function: Generate Habbo imager URL
    const generateHabboImagerUrl = (avatar: AvatarTestingState): string => {
        const params = new URLSearchParams({
            user: avatar.username,
            direction: avatar.direction.toString(),
            head_direction: avatar.headDirection.toString(),
            action: avatar.action,
            gesture: avatar.gesture,
            size: avatar.size
        });
        return `https://www.habbo.com/habbo-imaging/avatarimage?${params.toString()}`;
    };

    // Build render stack
    interface RenderItem {
        key: string;
        zIndex: number;
        src: string;
        sx: number;
        sy: number;
        sw: number;
        sh: number;
        dx: number;
        dy: number;
        dw: number;
        dh: number;
        flipH?: boolean;
        pX: number;
        pY: number;
        ink?: string;
        isShadow?: boolean;
    }

    // Helper function: Calculate isometric tile screen position
    // Center of grid is (15,15) which represents layer 0
    const getTileScreenPosition = (row: number, col: number): { x: number, y: number } => {
        const tileWidth = 64;
        const tileHeight = 32;
        const centerRow = 15;
        const centerCol = 15;
        const offsetRow = row - centerRow;
        const offsetCol = col - centerCol;
        const x = (offsetCol - offsetRow) * (tileWidth / 2);
        const y = (offsetCol + offsetRow) * (tileHeight / 2);
        return { x, y };
    };

    // Helper function: Calculate layer from isometric position
    const getLayerFromPosition = (row: number, col: number): number => {
        const centerRow = 15;
        const centerCol = 15;
        // In isometric view, layer = (row + col) offset from center
        const offset = (row - centerRow) + (col - centerCol);
        return offset * 1000;
    };

    // Helper function: Calculate avatar z-index
    const getAvatarZIndex = (tileRow: number, tileCol: number, subLayer: number): number => {
        const layer = getLayerFromPosition(tileRow, tileCol);

        if (layer === 0) {
            // Avatar at same tile as furniture (L0)
            // Sublayers position avatar BETWEEN furniture layers
            // Furniture: layer 0 = ~1000, layer 1 = ~1000-4000
            // Sublayer range 1-29 maps to 1100-3900 (between furniture layers)
            return 1000 + (subLayer * 100);
        } else {
            // Avatar at different tile than furniture
            // Tile layer takes precedence - avatar is in front/behind entire furniture
            return (layer * 100) + (subLayer * 100);
        }
    };

    // Helper function: Generate grid tile render items (30x30 grid for better visibility)
    const generateGridTiles = (): RenderItem[] => {
        if (!showTileGrid) return [];
        const gridTiles: RenderItem[] = [];
        const gridSize = 30; // 30x30 grid centered at (15,15)

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const { x, y } = getTileScreenPosition(row, col);
                const isCenter = row === 15 && col === 15;

                gridTiles.push({
                    key: `grid-tile-${row}-${col}`,
                    zIndex: getLayerFromPosition(row, col) * 100 - 10,
                    src: centerTile,
                    sx: 0,
                    sy: 0,
                    sw: 62,
                    sh: 31,
                    dx: Math.round(x - 31),
                    dy: Math.round(y - 15.5),
                    dw: 62,
                    dh: 31,
                    pX: 31,
                    pY: 15.5,
                    // Highlight center tile
                    ...(isCenter && { ink: 'ADD' })
                });
            }
        }

        return gridTiles;
    };

    // Helper function: Generate avatar render item
    const generateAvatarRenderItem = (): RenderItem | null => {
        if (!avatarTesting?.enabled) return null;

        const { x, y } = getTileScreenPosition(avatarTesting.tileRow, avatarTesting.tileCol);
        const avatarWidth = 64;
        const avatarHeight = 110;

        return {
            key: 'avatar',
            zIndex: getAvatarZIndex(avatarTesting.tileRow, avatarTesting.tileCol, avatarTesting.subLayer),
            src: generateHabboImagerUrl(avatarTesting),
            sx: 0,
            sy: 0,
            sw: avatarWidth,
            sh: avatarHeight,
            dx: Math.round(x - avatarWidth / 2),
            dy: Math.round(y - avatarHeight + 10 - avatarTesting.heightOffset),
            dw: avatarWidth,
            dh: avatarHeight,
            pX: avatarWidth / 2,
            pY: avatarHeight - 15
        };
    };

    const renderStack: RenderItem[] = [];

    // 1. Shadow Layer (Explicit check)
    {
        let assetName = getShadowName(0);

        let assetData = assets[assetName];
        if (assetData && assetData.source) assetName = assetData.source;

        const fullSpriteKey = `${furnitureName}_${assetName}`;
        const frameData = frames[fullSpriteKey];

        if (frameData && assetData) {
            const sheetImage = jsonContent.spritesheet.meta.image;
            const b64 = getImage(sheetImage);
            const regX = assetData.x || 0;
            const regY = assetData.y || 0;

            // Handle sprite trimming offset
            const trimOffsetX = frameData.spriteSourceSize?.x || 0;
            const trimOffsetY = frameData.spriteSourceSize?.y || 0;

            if (b64) {
                renderStack.push({
                    key: `sd`,
                    zIndex: -999999, // Shadow must be lowest, even below negative z layers
                    src: `data:image/png;base64,${b64}`,
                    sx: Math.round(frameData.frame.x),
                    sy: Math.round(frameData.frame.y),
                    sw: Math.round(frameData.frame.w),
                    sh: Math.round(frameData.frame.h),
                    dx: Math.round(-regX + trimOffsetX),
                    dy: Math.round(-regY + trimOffsetY),
                    dw: Math.round(frameData.frame.w),
                    dh: Math.round(frameData.frame.h),
                    flipH: assetData.flipH,
                    pX: regX,
                    pY: regY,
                    ink: undefined,
                    isShadow: true
                });
            }
        }
    }

    // 2. Regular Layers
    for (let i = 0; i < layerCount; i++) {
        // Determine current frame for this layer based on animation
        let currentFrame = 0;

        // Check animations
        if (mainViz.animations && mainViz.animations[String(animationState)]) {
            const animLayers = mainViz.animations[String(animationState)].layers;
            if (animLayers && animLayers[String(i)]) {
                const layerAnim = animLayers[String(i)];
                const frameSeqs = layerAnim.frameSequences;
                // Simple animation logic: Flatten all frames in sequence and pick based on timer
                // This is a simplification. Real Habbo logic handles loops/repeats more complexly.
                if (frameSeqs) {
                    const allFrames: number[] = [];
                    Object.values(frameSeqs).forEach(seq => {
                        Object.values(seq.frames).forEach(f => allFrames.push(f.id));
                    });
                    if (allFrames.length > 0) {
                        const repeat = layerAnim.frameRepeat || 1;
                        currentFrame = allFrames[Math.floor(frameIndex / repeat) % allFrames.length];
                    }
                }
            }
        }

        // Construct asset name key
        // Try precise match first: name_64_a_0_0
        let assetName = getSpriteName(i, currentFrame);

        // Fallback: If specific direction/frame doesn't exist in assets, try others?
        // Usually assets map: "name_64_a_0_0": { x: 21, y: 21, flipH: true/false, source: "..." }

        let assetData = assets[assetName];

        // If asset doesn't exist or is empty for this direction, try other directions
        const isEmptyAsset = assetData && Object.keys(assetData).length === 0 && !assetData.source;
        if (!assetData || isEmptyAsset) {
            const layerChar = String.fromCharCode(97 + i); // a, b, c...
            // Try other common directions: 2, 0, 4, 6
            const directionsToTry = [2, 0, 4, 6].filter(d => d !== direction);
            for (const altDir of directionsToTry) {
                const altAssetName = `${furnitureName}_64_${layerChar}_${altDir}_${currentFrame}`;
                const altAsset = assets[altAssetName];
                if (altAsset && (Object.keys(altAsset).length > 0 || altAsset.source)) {
                    assetName = altAssetName;
                    assetData = altAsset;
                    break;
                }
            }
        }

        // Logic for "source" alias
        if (assetData && assetData.source) {
            // If it aliases another asset, use that asset's data BUT which sprite/frame does it use?
            // Usually it just means "use the offsets from this other asset", but the sprite name is still the original?
            // OR does it mean "draw that other sprite"?
            // Standard Habbo: "source" in asset list usually means "reuse the sprite image from this other asset name"
            // but apply offsets/flipping from THIS asset entry (or the source's? It varies).
            // Let's assume source means "use this sprite name instead".
            assetName = assetData.source;
            // Re-fetch asset data for the source if needed, or mix them?
            // Typically: source points to the GRAPHIC, but offsets might be local?
            // Let's look at the example:
            // "bop_blue_hologram_64_c_0_0": {"source":"bop_blue_hologram_64_b_0_0","x":0,"y":0}
            // This means layer 'c' uses graphic 'b', but with offset 0,0.
        }

        // Check if this sprite exists in the spritesheet
        // The spritesheet keys are often "furnitureName_assetName"
        // e.g. "bop_blue_hologram_bop_blue_hologram_64_a_0_0"
        let fullSpriteKey = `${furnitureName}_${assetName}`;
        let frameData = frames[fullSpriteKey];

        // Fallback: if the requested frame doesn't exist, try frame 0
        if (!frameData && currentFrame !== 0) {
            const layerChar = String.fromCharCode(97 + i); // a, b, c...
            let fallbackAssetName = `${furnitureName}_64_${layerChar}_${direction}_0`;

            // Get the asset data for frame 0
            const fallbackAssetData = assets[fallbackAssetName];
            if (fallbackAssetData) {
                assetData = fallbackAssetData;

                // Check if the fallback asset has a source property
                if (assetData.source) {
                    fallbackAssetName = assetData.source;
                }

                // Now try to find the frame
                fullSpriteKey = `${furnitureName}_${fallbackAssetName}`;
                frameData = frames[fullSpriteKey];
            }
        }

        if (frameData && assetData) {
            // Calculate Base Z-Index
            let z = layers[String(i)]?.z || 0;

            // Apply Z-Index overrides from directions if any
            if (mainViz.directions && mainViz.directions[String(direction)]) {
                const dirOverride = mainViz.directions[String(direction)];
                // dirOverride might be { "0": { "z": 500 } } or similar
                // Usually it's mapped by layer ID
                // @ts-ignore
                if (dirOverride[String(i)] && dirOverride[String(i)].z !== undefined) {
                    // @ts-ignore
                    z = dirOverride[String(i)].z;
                }
            }

            // The image source is the spritesheet image.
            const sheetImage = jsonContent.spritesheet.meta.image;
            const b64 = getImage(sheetImage);

            // Registration Point (Pivot)
            const regX = assetData.x || 0;
            const regY = assetData.y || 0;

            // Handle sprite trimming offset
            const trimOffsetX = frameData.spriteSourceSize?.x || 0;
            const trimOffsetY = frameData.spriteSourceSize?.y || 0;

            if (b64) {
                renderStack.push({
                    key: `${i}-${currentFrame}`,
                    zIndex: 1000 + (z * 100) + i,
                    src: `data:image/png;base64,${b64}`,
                    // Sprite sheet coordinates
                    sx: Math.round(frameData.frame.x),
                    sy: Math.round(frameData.frame.y),
                    sw: Math.round(frameData.frame.w),
                    sh: Math.round(frameData.frame.h),
                    // Screen coordinates
                    // Draw such that the registration point aligns with CenterX/CenterY
                    // Standard: left = CenterX - RegX + trimOffsetX
                    dx: Math.round(-regX + trimOffsetX),
                    dy: Math.round(-regY + trimOffsetY),
                    dw: Math.round(frameData.frame.w),
                    dh: Math.round(frameData.frame.h),
                    flipH: assetData.flipH,
                    // Pass pivot for transform origin
                    pX: regX,
                    pY: regY,
                    ink: layers[String(i)]?.ink
                });
            }
        }
    }

    // Add grid tiles to render stack
    const gridTiles = generateGridTiles();
    renderStack.push(...gridTiles);

    // Add avatar to render stack
    const avatarItem = generateAvatarRenderItem();
    if (avatarItem) {
        renderStack.push(avatarItem);
    }

    // Sort by Z-Index
    renderStack.sort((a, b) => a.zIndex - b.zIndex);

    // Normalize Z-Index to ensure visibility (handle negative Zs)
    if (renderStack.length > 0) {
        const minZ = renderStack[0].zIndex;
        // Shift so the lowest item is at 2 (above center tile which is 1)
        // calculated z-indices can be very negative (e.g. -600000), causing them to disappear behind the container background
        if (minZ < 2) {
            const shift = 2 - minZ;
            renderStack.forEach(item => item.zIndex += shift);
        }
    }

    // Calculate bounding box for dynamic sizing
    const calculateBounds = () => {
        if (renderStack.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        renderStack.forEach(item => {
            const left = item.dx;
            const top = item.dy;
            const right = left + item.dw;
            const bottom = top + item.dh;

            minX = Math.min(minX, left);
            maxX = Math.max(maxX, right);
            minY = Math.min(minY, top);
            maxY = Math.max(maxY, bottom);
        });

        // Add padding
        const padding = 50;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding
        };
    };

    const bounds = calculateBounds();
    const containerWidth = Math.max(800, bounds.maxX - bounds.minX);
    const containerHeight = Math.max(600, bounds.maxY - bounds.minY);

    // Extract icon for top-right display
    const getIconSprite = () => {
        if (!jsonContent.spritesheet) return null;

        // Find the icon frame (ends with _icon_a)
        const iconFrameName = Object.keys(frames).find(key => key.endsWith('_icon_a'));
        if (!iconFrameName) return null;

        const frameData = frames[iconFrameName];
        const sheetImage = jsonContent.spritesheet.meta.image;
        const b64 = getImage(sheetImage);

        if (!frameData || !b64) return null;

        return {
            src: `data:image/png;base64,${b64}`,
            sx: frameData.frame.x,
            sy: frameData.frame.y,
            sw: frameData.frame.w,
            sh: frameData.frame.h
        };
    };

    const iconSprite = getIconSprite();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <Box sx={{ p: 1, borderBottom: '1px solid #333', display: 'flex', gap: 1, alignItems: 'center', bgcolor: '#222' }}>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                        const currentIndex = availableAnimations.indexOf(animationState);
                        const nextIndex = (currentIndex + 1) % availableAnimations.length;
                        setAnimationState(availableAnimations[nextIndex]);
                        setIsPlaying(true);
                        setFrameIndex(0);
                    }}
                    sx={{ color: '#aaa', borderColor: '#444' }}
                >
                    Activate ({animationState})
                </Button>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<RotateRightIcon />}
                    onClick={handleRotate}
                >
                    Rotate ({direction})
                </Button>
                <IconButton
                    size="small"
                    onClick={() => setIsPlaying(!isPlaying)}
                    color={isPlaying ? "primary" : "default"}
                >
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>

                {/* Zoom Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: '#aaa', minWidth: 80 }}>
                        Zoom: {(scale * 100).toFixed(0)}%
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={resetCamera}
                        title="Reset Camera"
                        sx={{ color: '#aaa' }}
                    >
                        <RestartAltIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Grid Toggle */}
                <Button
                    variant={showTileGrid ? "contained" : "outlined"}
                    size="small"
                    startIcon={<GridOnIcon />}
                    onClick={() => setShowTileGrid(!showTileGrid)}
                    title="Toggle tile grid visibility"
                >
                    Grid
                </Button>

                {/* Avatar Toggle */}
                <Button
                    variant={avatarTesting?.enabled ? "contained" : "outlined"}
                    size="small"
                    startIcon={<PersonIcon />}
                    onClick={toggleAvatar}
                    title="Toggle avatar visibility"
                    color={avatarTesting?.enabled ? "primary" : "inherit"}
                    sx={{ ml: 1 }}
                >
                    Avatar
                </Button>

                {/* FPS Controls */}
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
                    <Typography variant="caption" sx={{ color: '#aaa', minWidth: 60 }}>
                        FPS: {fps}
                    </Typography>
                    <Slider
                        value={fps}
                        onChange={(_, value) => setFps(value as number)}
                        min={1}
                        max={60}
                        step={1}
                        sx={{
                            width: 100,
                            color: '#1976d2',
                            '& .MuiSlider-thumb': {
                                width: 12,
                                height: 12,
                            }
                        }}
                    />
                    <IconButton
                        size="small"
                        onClick={() => setFps(24)}
                        title="Reset to default (24 FPS)"
                        sx={{ color: fps === 24 ? '#666' : '#aaa' }}
                    >
                        <RestartAltIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            {/* Canvas / Render Area */}
            <Box
                sx={{
                    flexGrow: 1,
                    minHeight: '600px',
                    height: 0,
                    bgcolor: '#2b2b2b',
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundImage: `url(${floorTile})`,
                    backgroundRepeat: 'repeat',
                    backgroundPosition: `calc(50% + ${pan.x}px) calc(50% + ${pan.y}px)`,
                    backgroundSize: `${64 * scale}px ${32 * scale}px`,
                    imageRendering: 'pixelated',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: isPanning.current ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Furniture Icon - Top Right */}
                {iconSprite && (
                    <Box sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 42,
                        height: 42,
                        bgcolor: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                        zIndex: 10000
                    }}>
                        <div style={{
                            width: iconSprite.sw,
                            height: iconSprite.sh,
                            backgroundImage: `url(${iconSprite.src})`,
                            backgroundPosition: `-${iconSprite.sx}px -${iconSprite.sy}px`,
                            imageRendering: 'pixelated'
                        }} />
                    </Box>
                )}

                {/* Avatar Controls Panel - Bottom Right */}
                {avatarTesting?.enabled && (
                    <Box sx={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        bgcolor: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '8px',
                        p: 2,
                        zIndex: 10000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        minWidth: 300,
                        maxWidth: 400,
                        maxHeight: 'calc(100vh - 200px)',
                        overflow: 'auto',
                        pointerEvents: 'auto'
                    }}>
                        <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
                            Avatar Controls
                        </Typography>

                        {/* Movement Grid and Sublayer */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: 0.5 }}>
                                {/* Row 1: Up-Left, Up, Up-Right */}
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(0, -1)}
                                    title="Up-Left (layer -1000)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <NorthWestIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(-1, -1)}
                                    title="Up (layer -2000)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <ArrowUpwardIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(-1, 0)}
                                    title="Up-Right (layer -1000)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <NorthEastIcon fontSize="small" />
                                </IconButton>

                                {/* Row 2: Left, Center Label, Right */}
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(1, -1)}
                                    title="Left (layer 0)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <ArrowBackIcon fontSize="small" />
                                </IconButton>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: '#aaa',
                                        minWidth: 40,
                                        textAlign: 'center',
                                        alignSelf: 'center'
                                    }}
                                >
                                    L{getLayerFromPosition(avatarTesting.tileRow, avatarTesting.tileCol)}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(-1, 1)}
                                    title="Right (layer 0)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <ArrowForwardIcon fontSize="small" />
                                </IconButton>

                                {/* Row 3: Down-Left, Down, Down-Right */}
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(1, 0)}
                                    title="Down-Left (layer +1000)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <SouthWestIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(1, 1)}
                                    title="Down (layer +2000)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <ArrowDownwardIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => moveAvatar(0, 1)}
                                    title="Down-Right (layer +1000)"
                                    sx={{ color: '#aaa' }}
                                >
                                    <SouthEastIcon fontSize="small" />
                                </IconButton>
                            </Box>

                            {/* Sublayer Control */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', fontSize: '0.6rem' }}>
                                    Sub-layer
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => adjustSubLayer(1)}
                                    title="Sub-layer +1"
                                    sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}
                                >
                                    +
                                </IconButton>
                                <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', fontSize: '0.7rem' }}>
                                    {avatarTesting.subLayer}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => adjustSubLayer(-1)}
                                    title="Sub-layer -1"
                                    sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}
                                >
                                    -
                                </IconButton>
                            </Box>
                        </Box>

                        {/* Action and Direction */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                                select
                                label="Action"
                                size="small"
                                value={avatarTesting.action}
                                onChange={(e) => onAvatarTestingChange?.({ ...avatarTesting, action: e.target.value as any })}
                                sx={{ flex: 1 }}
                                SelectProps={{
                                    MenuProps: {
                                        sx: { zIndex: 10001 }
                                    }
                                }}
                            >
                                <MenuItem value="std">Stand</MenuItem>
                                <MenuItem value="wlk">Walk</MenuItem>
                                <MenuItem value="sit">Sit</MenuItem>
                                <MenuItem value="lay">Lay</MenuItem>
                                <MenuItem value="wav">Wave</MenuItem>
                                <MenuItem value="respect">Respect</MenuItem>
                            </TextField>

                            <IconButton
                                size="small"
                                onClick={() => {
                                    let newDirection: number;
                                    let newHeadDirection: number;

                                    if (avatarTesting.action === 'sit') {
                                        const sittingDirections = [0, 2, 4, 6];
                                        const currentIndex = sittingDirections.indexOf(avatarTesting.direction);
                                        const nextIndex = (currentIndex + 1) % sittingDirections.length;
                                        newDirection = sittingDirections[nextIndex];
                                        newHeadDirection = newDirection;
                                    } else {
                                        newDirection = (avatarTesting.direction + 1) % 8;
                                        newHeadDirection = (avatarTesting.headDirection + 1) % 8;
                                    }

                                    onAvatarTestingChange?.({
                                        ...avatarTesting,
                                        direction: newDirection,
                                        headDirection: newHeadDirection
                                    });
                                }}
                                title="Rotate avatar"
                                sx={{ color: '#aaa' }}
                            >
                                <RotateRightIcon />
                            </IconButton>
                        </Box>

                        {/* Height Offset and Reset */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.6rem', textAlign: 'center' }}>
                                    Height Offset
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => onAvatarTestingChange?.({ ...avatarTesting, heightOffset: avatarTesting.heightOffset - 5 })}
                                        title="Lower avatar"
                                        sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}
                                    >
                                        -
                                    </IconButton>
                                    <Typography variant="caption" sx={{ color: '#aaa', minWidth: 30, textAlign: 'center', fontSize: '0.7rem' }}>
                                        {avatarTesting.heightOffset}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => onAvatarTestingChange?.({ ...avatarTesting, heightOffset: avatarTesting.heightOffset + 5 })}
                                        title="Raise avatar"
                                        sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}
                                    >
                                        +
                                    </IconButton>
                                </Box>
                            </Box>

                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<RestartAltIcon />}
                                onClick={() => onAvatarTestingChange?.({
                                    ...avatarTesting,
                                    tileRow: 15,
                                    tileCol: 15,
                                    subLayer: 15,
                                    direction: 2,
                                    headDirection: 2,
                                    heightOffset: 0,
                                    action: 'std'
                                })}
                                title="Reset position"
                                sx={{ color: '#aaa', borderColor: '#444' }}
                            >
                                Reset
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* Stage Container */}
                <div style={{ position: 'relative', width: containerWidth, height: containerHeight, minWidth: '100%', minHeight: '100%' }}>
                    {/* Stage Center Point (0,0) */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: 0,
                        height: 0,
                        overflow: 'visible',
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0'
                    }}>
                    {/* Center Tile Background */}
                    <img
                        src={centerTile}
                        alt="Center Tile"
                        style={{
                            position: 'absolute',
                            left: -31,
                            top: -15,
                            width: 62,
                            height: 31,
                            zIndex: 1,
                            pointerEvents: 'none',
                            imageRendering: 'pixelated'
                        }}
                    />

                    {renderStack.length > 0 ? renderStack.map((item, idx) => (
                        <div
                            key={idx}
                            style={{
                                position: 'absolute',
                                left: item.dx,
                                top: item.dy,
                                width: item.dw,
                                height: item.dh,
                                zIndex: item.zIndex + 10, // Ensure above center tile
                                backgroundImage: `url(${item.src})`,
                                backgroundPosition: `-${item.sx}px -${item.sy}px`,
                                transform: item.flipH ? 'scaleX(-1)' : 'none',
                                transformOrigin: item.flipH ? `${item.pX}px ${item.pY}px` : 'center',
                                opacity: item.isShadow ? 0.3 : 1,
                                mixBlendMode: item.isShadow ? 'multiply' : (item.ink === 'ADD' ? 'screen' : 'normal'),
                                imageRendering: 'auto'
                            }}
                        />
                    )) : null}
                    </div>
                </div>

                {renderStack.length === 0 && (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%" flexDirection="column" position="absolute">
                        <Typography color="text.secondary">No layers rendered for this direction.</Typography>
                        <Typography variant="caption" color="text.disabled">Check sprite names, direction assets, or image file.</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};
