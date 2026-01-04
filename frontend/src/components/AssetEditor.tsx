import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Typography, TextField, IconButton, Card, CardContent, Switch, FormControlLabel, Select, MenuItem, InputLabel, FormControl, Button, Tooltip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { NitroJSON, NitroAsset } from '../types';
import floorTile from '../assets/floor_tile.png';
import centerTile from '../assets/center_tile.png';
import { LoadNitroFile } from '../wailsjs/go/main/App';

interface AssetEditorProps {
    jsonContent: NitroJSON;
    onUpdate: (newJson: NitroJSON) => void;
    images?: Record<string, string>; // Map of filename to base64
    filePath?: string; // Optional filepath to save to
}

const getInitialDirection = (assets: Record<string, NitroAsset>): number => {
    const directions = new Set<number>();
    Object.keys(assets).forEach(key => {
        const parts = key.split('_');
        if (parts.length >= 4) {
            const dir = parseInt(parts[parts.length - 2]);
            if (!isNaN(dir)) {
                directions.add(dir);
            }
        }
    });

    // Priority: 0 -> 2
    if (directions.has(0)) return 0;
    
    return 2; // Default to 2
};

const getInitialHiddenAssets = (assets: Record<string, NitroAsset>): Set<string> => {
    const hidden = new Set<string>();
    Object.keys(assets).forEach(key => {
        if (key.includes('icon')) return;
        const parts = key.split('_');
        // Check if the last part is a number > 0 (State/Frame index)
        if (parts.length > 0) {
            const stateStr = parts[parts.length - 1];
            const state = parseInt(stateStr);
            if (!isNaN(state) && state > 0) {
                hidden.add(key);
            }
        }
    });
    return hidden;
};

export const AssetEditor: React.FC<AssetEditorProps> = ({ jsonContent, onUpdate, images = {}, filePath }) => {
    const [selectedAssetKey, setSelectedAssetKey] = useState<string | null>(null);
    const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(() => getInitialHiddenAssets(jsonContent.assets || {}));
    const [originalAssets, setOriginalAssets] = useState<Record<string, NitroAsset>>({});

    const [viewDirection, setViewDirection] = useState<number>(() => getInitialDirection(jsonContent.assets || {}));
    const [showOnlyCurrentDirection, setShowOnlyCurrentDirection] = useState(true);

    // Camera State
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setHiddenAssets(getInitialHiddenAssets(jsonContent.assets || {}));
    }, [jsonContent.name]);

    useEffect(() => {
        setViewDirection(getInitialDirection(jsonContent.assets || {}));
    }, [filePath]);

    const isDraggingAsset = useRef(false);
    const isPanning = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const draggedAssetStartPos = useRef({ x: 0, y: 0 });
    const panStartPos = useRef({ x: 0, y: 0 }); // Mouse pos when pan started
    const panStartOffset = useRef({ x: 0, y: 0 }); // Pan value when pan started

    const assets = jsonContent.assets || {};
    const assetKeys = Object.keys(assets).sort();
    const spritesheet = jsonContent.spritesheet;
    const spritesheetImage = spritesheet?.meta?.image ? images[spritesheet.meta.image] : null;

    useEffect(() => {
        if (filePath) {
            LoadNitroFile(filePath)
                .then((data: NitroJSON) => {
                    if (data && data.assets) {
                        setOriginalAssets(JSON.parse(JSON.stringify(data.assets)));
                    }
                })
                .catch((err: any) => console.error("Failed to load original file:", err));
        } else {
            setOriginalAssets(JSON.parse(JSON.stringify(jsonContent.assets || {})));
        }
    }, [filePath]);

    const findFrame = (key: string) => {
        if (!spritesheet || !spritesheet.frames) return null;

        if (spritesheet.frames[key]) return spritesheet.frames[key];

        const frameKeys = Object.keys(spritesheet.frames);
        for (const fKey of frameKeys) {
            if (fKey.endsWith(`_${key}`)) {
                return spritesheet.frames[fKey];
            }
        }
        return null;
    };

    // Helper to get asset details (layer, direction, frame)
    const getAssetMeta = (key: string) => {
        const parts = key.split('_');
        if (parts.length >= 4) {
            const direction = parseInt(parts[parts.length - 2]);
            const layer = parts[parts.length - 3];
            return { layer, direction };
        }
        return { layer: 'unknown', direction: -1 };
    };

    // Computed keys to render based on filters
    const keysToRender = useMemo(() => {
        return assetKeys.filter(key => {
            if (key.includes('icon')) return false; // Always hide icons

            const { direction } = getAssetMeta(key);
            
            // Strictly only allow directions 0 and 2
            if (direction !== 0 && direction !== 2) return false;

            if (!showOnlyCurrentDirection) return true;

            return direction === viewDirection;
        });
    }, [assetKeys, viewDirection, showOnlyCurrentDirection]);


    // Helper to get image style and offsets for an asset
    const getAssetRenderData = (key: string, asset: NitroAsset) => {
        const { layer } = getAssetMeta(key);
        const isShadow = layer === 'sd';
        const opacity = isShadow ? 0.3 : 1;
        const blendMode: React.CSSProperties['mixBlendMode'] = isShadow ? 'multiply' : 'normal';

        // 1. Try Spritesheet with fuzzy lookup
        const frameData = findFrame(key);
        if (frameData && spritesheetImage) {
            const frame = frameData.frame;
            const baseTrimOffset = frameData.spriteSourceSize || { x: 0, y: 0 };
            // When flipped horizontally, mirror the trim offset
            const offsetX = asset.flipH
                ? (frameData.sourceSize?.w || frame.w) - baseTrimOffset.x - frame.w
                : baseTrimOffset.x;
            return {
                style: {
                    backgroundImage: `url(data:image/png;base64,${spritesheetImage})`,
                    backgroundPosition: `-${frame.x}px -${frame.y}px`,
                    width: frame.w,
                    height: frame.h,
                    display: 'block',
                    opacity,
                    mixBlendMode: blendMode
                },
                offset: { x: offsetX, y: baseTrimOffset.y }
            };
        }

        // 2. Try Source (if alias)
        let targetKey = key;
        if (asset.source) targetKey = asset.source;

        // Check if targetKey is in spritesheet
        const sourceFrameData = findFrame(targetKey);
        if (sourceFrameData && spritesheetImage) {
            const frame = sourceFrameData.frame;
            const baseTrimOffset = sourceFrameData.spriteSourceSize || { x: 0, y: 0 };
            // When flipped horizontally, mirror the trim offset
            const offsetX = asset.flipH
                ? (sourceFrameData.sourceSize?.w || frame.w) - baseTrimOffset.x - frame.w
                : baseTrimOffset.x;
            return {
                style: {
                    backgroundImage: `url(data:image/png;base64,${spritesheetImage})`,
                    backgroundPosition: `-${frame.x}px -${frame.y}px`,
                    width: frame.w,
                    height: frame.h,
                    display: 'block',
                    opacity,
                    mixBlendMode: blendMode
                },
                offset: { x: offsetX, y: baseTrimOffset.y }
            };
        }

        // 3. Try Individual Image File
        const directImage = images[targetKey] || images[`${targetKey}.png`] || images[`${targetKey}.jpg`];
        if (directImage) {
            return {
                style: {
                    backgroundImage: `url(data:image/png;base64,${directImage})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    width: 50,
                    height: 50,
                    display: 'block',
                    opacity,
                    mixBlendMode: blendMode
                },
                offset: { x: 0, y: 0 }
            };
        }

        return null;
    };

    // Helper component to render asset
    const RenderAsset = ({ assetKey, asset, style }: { assetKey: string, asset: NitroAsset, style?: React.CSSProperties }) => {
        const renderData = getAssetRenderData(assetKey, asset);

        if (!renderData) {
            // Fallback
            let targetKey = asset.source || assetKey;
            const directImage = images[targetKey] || images[`${targetKey}.png`] || images[`${targetKey}.jpg`];
            if (directImage) {
                return <img src={`data:image/png;base64,${directImage}`} draggable={false} style={{ ...style, display: 'block' }} alt={assetKey} />;
            }
            return <Box sx={{ width: 32, height: 32, border: '1px dashed red', ...style }} title={`Missing: ${assetKey}`} />;
        }

        return <div style={{ ...renderData.style, ...style }} />;
    };


    const handleAssetSelect = (key: string) => {
        setSelectedAssetKey(key);
    };

    const toggleHideAsset = (key: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newHidden = new Set(hiddenAssets);
        if (newHidden.has(key)) {
            newHidden.delete(key);
        } else {
            newHidden.add(key);
        }
        setHiddenAssets(newHidden);
    };

    const updateAsset = (key: string, field: keyof NitroAsset, value: any) => {
        if (!jsonContent.assets) return;
        const newJson = { ...jsonContent };
        const assetData = newJson.assets![key];
        if (assetData) {
            // @ts-ignore
            assetData[field] = value;
            onUpdate(newJson);
        }
    };

    const handleResetAsset = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!jsonContent.assets) return;

        const original = originalAssets[key];
        const newJson = { ...jsonContent };
        const assetData = newJson.assets![key];

        if (assetData) {
            if (original) {
                assetData.x = original.x;
                assetData.y = original.y;
            } else {
                assetData.x = 0;
                assetData.y = 0;
            }
            onUpdate(newJson);
        }
    };

    const resetCamera = () => {
        setScale(1);
        setPan({ x: 0, y: 0 });
    };

    const handleWheel = (e: React.WheelEvent) => {
        const delta = -e.deltaY;
        const scaleChange = delta > 0 ? 0.1 : -0.1;
        const newScale = Math.min(Math.max(scale + scaleChange, 0.1), 4);
        setScale(newScale);
    };

    // Canvas Interactions
    const handleMouseDown = (e: React.MouseEvent, assetKey?: string) => {
        if (assetKey) {
            e.stopPropagation();
            setSelectedAssetKey(assetKey);
            isDraggingAsset.current = true;
            dragStartPos.current = { x: e.clientX, y: e.clientY };

            const asset = assets[assetKey];
            draggedAssetStartPos.current = { x: asset.x || 0, y: asset.y || 0 };
        } else {
            // Pan start
            isPanning.current = true;
            panStartPos.current = { x: e.clientX, y: e.clientY };
            panStartOffset.current = { x: pan.x, y: pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDraggingAsset.current && selectedAssetKey) {
            const dx = (e.clientX - dragStartPos.current.x) / scale; // Adjust for scale
            const dy = (e.clientY - dragStartPos.current.y) / scale;

            const asset = assets[selectedAssetKey];
            const isFlipped = asset?.flipH;

            // Inverted delta because rendering is -(x) and -(y)
            // If flipped, the transformOrigin logic effectively inverts the X axis visual movement relative to the value
            const appliedDx = isFlipped ? -dx : dx;

            const newX = Math.round(draggedAssetStartPos.current.x - appliedDx);
            const newY = Math.round(draggedAssetStartPos.current.y - dy);

            updateAsset(selectedAssetKey, 'x', newX);
            updateAsset(selectedAssetKey, 'y', newY);
        } else if (isPanning.current) {
            const dx = e.clientX - panStartPos.current.x;
            const dy = e.clientY - panStartPos.current.y;

            setPan({
                x: panStartOffset.current.x + dx,
                y: panStartOffset.current.y + dy
            });
        }
    };

    // Keyboard Movement
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedAssetKey) return;

            // Allow inputs to work normally if focused
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const asset = assets[selectedAssetKey];
            if (!asset) return;

            let newX = asset.x || 0;
            let newY = asset.y || 0;
            let handled = false;

            // Invert X controls if flipped to maintain visual direction
            const isFlipped = !!asset.flipH;
            const dirX = isFlipped ? -1 : 1;

            if (e.key === 'ArrowUp') {
                newY += 1;
                handled = true;
            } else if (e.key === 'ArrowDown') {
                newY -= 1;
                handled = true;
            } else if (e.key === 'ArrowLeft') {
                newX += 1 * dirX;
                handled = true;
            } else if (e.key === 'ArrowRight') {
                newX -= 1 * dirX;
                handled = true;
            }

            if (handled) {
                e.preventDefault();
                updateAsset(selectedAssetKey, 'x', newX);
                updateAsset(selectedAssetKey, 'y', newY);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedAssetKey, assets, onUpdate]); // Dep on assets to get current pos

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isPanning.current) {
            const dx = Math.abs(e.clientX - panStartPos.current.x);
            const dy = Math.abs(e.clientY - panStartPos.current.y);
            // If movement is small, treat as a click to deselect
            if (dx < 5 && dy < 5) {
                setSelectedAssetKey(null);
            }
        }
        isDraggingAsset.current = false;
        isPanning.current = false;
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left Column: Asset List */}
            <Box sx={{ width: '40%', minWidth: 350, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', bgcolor: '#233044' }}>
                <Box p={2} borderBottom="1px solid #444" bgcolor="#1b2636">
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">Assets Position</Typography>
                    </Box>
                    <Box display="flex" gap={2} alignItems="center" mt={1}>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Direction</InputLabel>
                            <Select
                                value={viewDirection}
                                label="Direction"
                                onChange={(e) => setViewDirection(Number(e.target.value))}
                                sx={{ height: 32 }}
                            >
                                {[0, 2].map(d => (
                                    <MenuItem key={d} value={d}>{d}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControlLabel
                            control={<Switch size="small" checked={showOnlyCurrentDirection} onChange={(e) => setShowOnlyCurrentDirection(e.target.checked)} />}
                            label={<Typography variant="caption">Filter View</Typography>}
                        />
                    </Box>
                </Box>

                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
                    {keysToRender.map(key => {
                        const asset = assets[key];
                        const isHidden = hiddenAssets.has(key);
                        const isSelected = selectedAssetKey === key;

                        return (
                            <Card
                                key={key}
                                sx={{
                                    mb: 1,
                                    border: isSelected ? '1px solid #90caf9' : '1px solid #444',
                                    bgcolor: isSelected ? 'rgba(144, 202, 249, 0.08)' : '#2b3a52'
                                }}
                                onClick={() => handleAssetSelect(key)}
                            >
                                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                    <Box display="flex" flexDirection="column" gap={1}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="subtitle2" noWrap title={key} sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                {key}
                                            </Typography>
                                            <Box>
                                                <Tooltip title="Reset Position to Saved State">
                                                    <IconButton size="small" onClick={(e) => handleResetAsset(key, e)}>
                                                        <RestartAltIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => toggleHideAsset(key, e)}
                                                    color={isHidden ? "default" : "primary"}
                                                >
                                                    {isHidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                                </IconButton>
                                            </Box>
                                        </Box>

                                        {/* Main Row */}
                                        <Box display="flex" gap={2} alignItems="center">
                                            {/* Thumbnail */}
                                            <Box
                                                sx={{
                                                    width: 50,
                                                    height: 50,
                                                    bgcolor: '#1e1e1e',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    borderRadius: 1,
                                                    overflow: 'hidden',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <Box sx={{ transform: 'scale(0.8)' }}>
                                                    <RenderAsset assetKey={key} asset={asset} />
                                                </Box>
                                            </Box>

                                            {/* Inputs */}
                                            <Box flexGrow={1} display="flex" gap={1}>
                                                <TextField
                                                    label="X" type="number" size="small"
                                                    value={asset.x || 0}
                                                    onChange={(e) => updateAsset(key, 'x', parseInt(e.target.value) || 0)}
                                                    InputProps={{ sx: { fontSize: '0.8rem' } }}
                                                    sx={{ flex: 1 }}
                                                />
                                                <TextField
                                                    label="Y" type="number" size="small"
                                                    value={asset.y || 0}
                                                    onChange={(e) => updateAsset(key, 'y', parseInt(e.target.value) || 0)}
                                                    InputProps={{ sx: { fontSize: '0.8rem' } }}
                                                    sx={{ flex: 1 }}
                                                />
                                                <Box display="flex" alignItems="center">
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                size="small"
                                                                checked={!!asset.flipH}
                                                                onChange={(e) => updateAsset(key, 'flipH', e.target.checked)}
                                                            />
                                                        }
                                                        label={<Typography variant="caption">Flip</Typography>}
                                                        sx={{ mr: 0, ml: 1 }}
                                                    />
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            </Box>

            {/* Right Column: Visual Editor */}
            <Box
                sx={{
                    flexGrow: 1,
                    bgcolor: '#2b2b2b',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: isPanning.current ? 'grabbing' : 'grab'
                }}
                onMouseDown={(e) => handleMouseDown(e)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                // onClick={handleBackgroundClick} // Move click logic or allow pan to consume
            >
                {/* Background Tile Logic - Infinite Scroll effect */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${floorTile})`,
                    backgroundRepeat: 'repeat',
                    backgroundPosition: `calc(50% + ${pan.x}px) calc(50% + ${pan.y}px)`,
                    backgroundSize: `${64 * scale}px`, // Assuming 64px is base tile size? Actually floor_tile is usually smaller, but let's assume base. 
                    // floorTile is small. Let's assume standard size. 
                    pointerEvents: 'none',
                    opacity: 0.5
                }} />

                {/* World Container - Transformed */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    width: 0,
                    height: 0,
                    // Ensure children are visible
                    overflow: 'visible'
                }}>
                    {/* Center Tile - Simply Centered */}
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        pointerEvents: 'none',
                        zIndex: 0
                    }}>
                        <img
                            src={centerTile}
                            alt="Center Tile"
                            style={{
                                position: 'absolute',
                                left: -31, // Half width
                                top: -15,  // Half height approx
                                width: 62,
                                height: 31,
                                pointerEvents: 'none'
                            }}
                        />
                    </div>

                    {/* Assets Layer */}
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0
                    }}>
                        {keysToRender.map(key => {
                            if (hiddenAssets.has(key)) return null;

                            const asset = assets[key];
                            const isSelected = selectedAssetKey === key;
                            const renderData = getAssetRenderData(key, asset);

                            if (!renderData) return null;

                            // Calculate Transform Origin for correct flipping behavior
                            const pivotX = (asset.x || 0) - renderData.offset.x;
                            const pivotY = (asset.y || 0) - renderData.offset.y;

                            // Shadow Layering Logic
                            const isShadow = getAssetMeta(key).layer === 'sd';
                            const baseZ = isShadow ? 1 : 10;
                            const finalZ = isSelected ? 100 : baseZ;

                            return (
                                <div
                                    key={key}
                                    onMouseDown={(e) => handleMouseDown(e, key)}
                                    style={{
                                        position: 'absolute',
                                        left: -(asset.x || 0) + renderData.offset.x,
                                        top: -(asset.y || 0) + renderData.offset.y,
                                        zIndex: finalZ,
                                        cursor: 'move',
                                        outline: isSelected ? '1px solid #00ff00' : 'none',
                                        // FlipH logic
                                        transform: asset.flipH ? 'scaleX(-1)' : 'none',
                                        transformOrigin: `${pivotX}px ${pivotY}px`,
                                        userSelect: 'none'
                                    }}
                                >
                                    <div style={renderData.style} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Box sx={{ position: 'absolute', top: 16, left: 16, bgcolor: 'rgba(0,0,0,0.6)', p: 1, borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        Drag assets or use Arrow Keys to position. Click to select.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Pan: Drag Background | Zoom: Scroll
                    </Typography>
                    <Button variant="outlined" size="small" onClick={resetCamera} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>
                        Reset Camera
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};
