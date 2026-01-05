import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Box, Typography, TextField, IconButton, Card, CardContent, Switch, FormControlLabel,
    Select, MenuItem, InputLabel, FormControl, Button, Tooltip, Chip, Accordion,
    AccordionSummary, AccordionDetails
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PersonIcon from '@mui/icons-material/Person';
import GridOnIcon from '@mui/icons-material/GridOn';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NorthWestIcon from '@mui/icons-material/NorthWest';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import type { NitroJSON, NitroAsset, NitroLayer, AvatarTestingState } from '../types';
import floorTile from '../assets/floor_tile.png';
import centerTile from '../assets/center_tile.png';
import { LoadNitroFile } from '../wailsjs/go/main/App';

interface AssetEditorProps {
    jsonContent: NitroJSON;
    onUpdate: (newJson: NitroJSON) => void;
    images?: Record<string, string>;
    filePath?: string;
    avatarTesting?: AvatarTestingState;
    onAvatarTestingChange?: (newState: AvatarTestingState) => void;
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

    if (directions.has(0)) return 0;
    return 2;
};

const getInitialHiddenAssets = (assets: Record<string, NitroAsset>): Set<string> => {
    const hidden = new Set<string>();
    Object.keys(assets).forEach(key => {
        if (key.includes('icon')) return;
        const parts = key.split('_');
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

export const AssetEditor: React.FC<AssetEditorProps> = ({
    jsonContent,
    onUpdate,
    images = {},
    filePath,
    avatarTesting,
    onAvatarTestingChange
}) => {
    const [selectedAssetKey, setSelectedAssetKey] = useState<string | null>(null);
    const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(() => getInitialHiddenAssets(jsonContent.assets || {}));
    const [originalAssets, setOriginalAssets] = useState<Record<string, NitroAsset>>({});

    const [viewDirection, setViewDirection] = useState<number>(() => getInitialDirection(jsonContent.assets || {}));
    const [showOnlyCurrentDirection, setShowOnlyCurrentDirection] = useState(true);
    const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
    const [showTileGrid, setShowTileGrid] = useState(false);

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
    const panStartPos = useRef({ x: 0, y: 0 });
    const panStartOffset = useRef({ x: 0, y: 0 });

    const assets = jsonContent.assets || {};
    const assetKeys = Object.keys(assets).sort();
    const spritesheet = jsonContent.spritesheet;
    const spritesheetImage = spritesheet?.meta?.image ? images[spritesheet.meta.image] : null;

    const visualizations = jsonContent.visualizations || [];
    const mainViz = useMemo(() => {
        return visualizations.find(v => v.size === 64) || visualizations[0];
    }, [visualizations]);

    const layers = mainViz?.layers || {};

    useEffect(() => {
        if (filePath) {
            LoadNitroFile(filePath)
                .then((data: any) => {
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

    const getAssetMeta = (key: string) => {
        const parts = key.split('_');
        if (parts.length >= 4) {
            const direction = parseInt(parts[parts.length - 2]);
            const layer = parts[parts.length - 3];
            return { layer, direction };
        }
        return { layer: 'unknown', direction: -1 };
    };

    // Get available layers
    const availableLayers = useMemo(() => {
        const layerSet = new Set<string>();
        assetKeys.forEach(key => {
            const { layer } = getAssetMeta(key);
            if (layer !== 'unknown' && !key.includes('icon')) {
                layerSet.add(layer);
            }
        });
        return Array.from(layerSet).sort();
    }, [assetKeys]);

    const keysToRender = useMemo(() => {
        return assetKeys.filter(key => {
            if (key.includes('icon')) return false;

            const { direction, layer } = getAssetMeta(key);

            // Allow all valid directions: 0, 2, 4, 6
            if (direction !== 0 && direction !== 2 && direction !== 4 && direction !== 6) return false;

            if (showOnlyCurrentDirection && direction !== viewDirection) return false;

            if (selectedLayer && layer !== selectedLayer) return false;

            return true;
        });
    }, [assetKeys, viewDirection, showOnlyCurrentDirection, selectedLayer]);

    // Check if we're in read-only mode (viewing direction 4 or 6)
    const isReadOnlyDirection = viewDirection === 4 || viewDirection === 6;

    const getAssetRenderData = (key: string, asset: NitroAsset) => {
        const { layer } = getAssetMeta(key);
        const isShadow = layer === 'sd';
        const opacity = isShadow ? 0.3 : 1;
        const blendMode: React.CSSProperties['mixBlendMode'] = isShadow ? 'multiply' : 'normal';

        const frameData = findFrame(key);
        if (frameData && spritesheetImage) {
            const frame = frameData.frame;
            const baseTrimOffset = frameData.spriteSourceSize || { x: 0, y: 0 };
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

        let targetKey = key;
        if (asset.source) targetKey = asset.source;

        const sourceFrameData = findFrame(targetKey);
        if (sourceFrameData && spritesheetImage) {
            const frame = sourceFrameData.frame;
            const baseTrimOffset = sourceFrameData.spriteSourceSize || { x: 0, y: 0 };
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

    const RenderAsset = ({ assetKey, asset, style }: { assetKey: string, asset: NitroAsset, style?: React.CSSProperties }) => {
        const renderData = getAssetRenderData(assetKey, asset);

        if (!renderData) {
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

    const updateLayer = (layerId: string, field: keyof NitroLayer, value: any) => {
        const newJson = { ...jsonContent };
        if (newJson.visualizations && mainViz) {
            const vizIndex = visualizations.indexOf(mainViz);
            if (vizIndex !== -1) {
                const viz = newJson.visualizations[vizIndex];
                if (!viz.layers) viz.layers = {};
                if (!viz.layers[layerId]) viz.layers[layerId] = {};

                // @ts-ignore
                viz.layers[layerId][field] = value;
                onUpdate(newJson);
            }
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

    const handleMouseDown = (e: React.MouseEvent, assetKey?: string) => {
        if (assetKey) {
            e.stopPropagation();
            setSelectedAssetKey(assetKey);
            isDraggingAsset.current = true;
            dragStartPos.current = { x: e.clientX, y: e.clientY };

            const asset = assets[assetKey];
            draggedAssetStartPos.current = { x: asset.x || 0, y: asset.y || 0 };
        } else {
            isPanning.current = true;
            panStartPos.current = { x: e.clientX, y: e.clientY };
            panStartOffset.current = { x: pan.x, y: pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDraggingAsset.current && selectedAssetKey) {
            const dx = (e.clientX - dragStartPos.current.x) / scale;
            const dy = (e.clientY - dragStartPos.current.y) / scale;

            const asset = assets[selectedAssetKey];
            const isFlipped = asset?.flipH;

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedAssetKey) return;

            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const asset = assets[selectedAssetKey];
            if (!asset) return;

            let newX = asset.x || 0;
            let newY = asset.y || 0;
            let handled = false;

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
    }, [selectedAssetKey, assets, onUpdate]);

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isPanning.current) {
            const dx = Math.abs(e.clientX - panStartPos.current.x);
            const dy = Math.abs(e.clientY - panStartPos.current.y);
            if (dx < 5 && dy < 5) {
                setSelectedAssetKey(null);
            }
        }
        isDraggingAsset.current = false;
        isPanning.current = false;
    };

    // Avatar helpers
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

    const getLayerFromPosition = (row: number, col: number): number => {
        const centerRow = 15;
        const centerCol = 15;
        const offset = (row - centerRow) + (col - centerCol);
        return offset * 1000;
    };

    const getAvatarZIndex = (tileRow: number, tileCol: number, subLayer: number): number => {
        const layer = getLayerFromPosition(tileRow, tileCol);

        if (layer === 0) {
            return 1000 + (subLayer * 100);
        } else {
            return (layer * 100) + (subLayer * 100);
        }
    };

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

    const moveAvatar = (rowDelta: number, colDelta: number) => {
        if (!avatarTesting || !onAvatarTestingChange) return;
        const newRow = avatarTesting.tileRow + rowDelta;
        const newCol = avatarTesting.tileCol + colDelta;

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

    // Get layer info for selected asset
    const getLayerInfo = (assetKey: string) => {
        const { layer } = getAssetMeta(assetKey);

        // Map layer letter to index
        const layerIndex = layer === 'sd' ? 'shadow' : layer.charCodeAt(0) - 97; // a=0, b=1, c=2, etc.

        if (layerIndex === 'shadow') {
            return {
                layerId: 'shadow',
                layerData: null,
                layerName: 'Shadow'
            };
        }

        const layerId = layerIndex.toString();
        const layerData = layers[layerId];
        return {
            layerId,
            layerData,
            layerName: `Layer ${layer.toUpperCase()}`
        };
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left Column: Asset List */}
            <Box sx={{ width: '35%', minWidth: 350, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', bgcolor: '#233044' }}>
                <Box p={2} borderBottom="1px solid #444" bgcolor="#1b2636">
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">Assets Position</Typography>
                    </Box>
                    <Box display="flex" gap={2} alignItems="center" mt={2}>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Direction</InputLabel>
                            <Select
                                value={viewDirection}
                                label="Direction"
                                onChange={(e) => setViewDirection(Number(e.target.value))}
                                sx={{ height: 32 }}
                            >
                                {[0, 2, 4, 6].map(d => (
                                    <MenuItem key={d} value={d}>
                                        {d} {(d === 4 || d === 6) && '(View Only)'}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Layer</InputLabel>
                            <Select
                                value={selectedLayer || 'all'}
                                label="Layer"
                                onChange={(e) => setSelectedLayer(e.target.value === 'all' ? null : e.target.value)}
                                sx={{ height: 32 }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                {availableLayers.map(l => (
                                    <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControlLabel
                            control={<Switch size="small" checked={showOnlyCurrentDirection} onChange={(e) => setShowOnlyCurrentDirection(e.target.checked)} />}
                            label={<Typography variant="caption">Filter Dir</Typography>}
                        />
                    </Box>

                    {(viewDirection === 4 || viewDirection === 6) && (
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)', borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ color: '#ffb74d' }}>
                                <strong>View Only Mode:</strong> Direction {viewDirection} is mirrored from direction {viewDirection === 4 ? '2' : '0'}.
                                To modify positions, switch to direction {viewDirection === 4 ? '2' : '0'}.
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
                    {keysToRender.map(key => {
                        const asset = assets[key];
                        const isHidden = hiddenAssets.has(key);
                        const isSelected = selectedAssetKey === key;
                        const { layer } = getAssetMeta(key);

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
                                            <Box display="flex" alignItems="center" gap={1} flexGrow={1} overflow="hidden">
                                                <Chip
                                                    label={layer.toUpperCase()}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: layer === 'sd' ? 'rgba(100, 100, 100, 0.3)' : 'rgba(144, 202, 249, 0.2)',
                                                        color: '#fff',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.7rem',
                                                        height: 20
                                                    }}
                                                />
                                                <Typography variant="caption" noWrap title={key} sx={{ fontSize: '0.75rem', flexGrow: 1 }}>
                                                    {key}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Tooltip title="Reset Position">
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

                                        <Box display="flex" gap={2} alignItems="center">
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

                                            <Box flexGrow={1} display="flex" gap={1}>
                                                <TextField
                                                    label="X" type="number" size="small"
                                                    value={asset.x || 0}
                                                    onChange={(e) => !isReadOnlyDirection && updateAsset(key, 'x', parseInt(e.target.value) || 0)}
                                                    InputProps={{ sx: { fontSize: '0.8rem' }, readOnly: isReadOnlyDirection }}
                                                    disabled={isReadOnlyDirection}
                                                    sx={{ flex: 1 }}
                                                />
                                                <TextField
                                                    label="Y" type="number" size="small"
                                                    value={asset.y || 0}
                                                    onChange={(e) => !isReadOnlyDirection && updateAsset(key, 'y', parseInt(e.target.value) || 0)}
                                                    InputProps={{ sx: { fontSize: '0.8rem' }, readOnly: isReadOnlyDirection }}
                                                    disabled={isReadOnlyDirection}
                                                    sx={{ flex: 1 }}
                                                />
                                                <Box display="flex" alignItems="center">
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                size="small"
                                                                checked={!!asset.flipH}
                                                                onChange={(e) => !isReadOnlyDirection && updateAsset(key, 'flipH', e.target.checked)}
                                                                disabled={isReadOnlyDirection}
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
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Toolbar */}
                <Box sx={{ p: 1, borderBottom: '1px solid #333', display: 'flex', gap: 1, alignItems: 'center', bgcolor: '#222' }}>
                    <Button
                        variant={showTileGrid ? "contained" : "outlined"}
                        size="small"
                        startIcon={<GridOnIcon />}
                        onClick={() => setShowTileGrid(!showTileGrid)}
                    >
                        Grid
                    </Button>

                    <Button
                        variant={avatarTesting?.enabled ? "contained" : "outlined"}
                        size="small"
                        startIcon={<PersonIcon />}
                        onClick={toggleAvatar}
                        color={avatarTesting?.enabled ? "primary" : "inherit"}
                    >
                        Avatar
                    </Button>

                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
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
                </Box>

                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                    {/* Canvas */}
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
                    >
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: `url(${floorTile})`,
                            backgroundRepeat: 'repeat',
                            backgroundPosition: `calc(50% + ${pan.x}px) calc(50% + ${pan.y}px)`,
                            backgroundSize: `${64 * scale}px`,
                            pointerEvents: 'none',
                            opacity: 0.5
                        }} />

                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                            width: 0,
                            height: 0,
                            overflow: 'visible'
                        }}>
                            {/* Grid tiles */}
                            {showTileGrid && Array.from({ length: 30 }).map((_, row) =>
                                Array.from({ length: 30 }).map((_, col) => {
                                    const { x, y } = getTileScreenPosition(row, col);
                                    const isCenter = row === 15 && col === 15;
                                    return (
                                        <img
                                            key={`tile-${row}-${col}`}
                                            src={centerTile}
                                            alt=""
                                            style={{
                                                position: 'absolute',
                                                left: Math.round(x - 31),
                                                top: Math.round(y - 15.5),
                                                width: 62,
                                                height: 31,
                                                pointerEvents: 'none',
                                                opacity: isCenter ? 1 : 0.3,
                                                zIndex: getLayerFromPosition(row, col) * 100 - 10
                                            }}
                                        />
                                    );
                                })
                            )}

                            {/* Center Tile */}
                            <img
                                src={centerTile}
                                alt="Center"
                                style={{
                                    position: 'absolute',
                                    left: -31,
                                    top: -15,
                                    width: 62,
                                    height: 31,
                                    pointerEvents: 'none',
                                    zIndex: 0
                                }}
                            />

                            {/* Assets */}
                            {keysToRender.map(key => {
                                if (hiddenAssets.has(key)) return null;

                                const asset = assets[key];
                                const isSelected = selectedAssetKey === key;
                                const renderData = getAssetRenderData(key, asset);

                                if (!renderData) return null;

                                const pivotX = (asset.x || 0) - renderData.offset.x;
                                const pivotY = (asset.y || 0) - renderData.offset.y;

                                const { layer } = getAssetMeta(key);
                                const isShadow = layer === 'sd';

                                // Calculate proper z-index based on layer properties (like Preview tab)
                                let calculatedZ = 0;
                                if (isShadow) {
                                    calculatedZ = -999999; // Shadow must be lowest
                                } else {
                                    // Map layer letter to index (a=0, b=1, c=2, etc.)
                                    const layerIndex = layer.charCodeAt(0) - 97;
                                    const layerId = layerIndex.toString();

                                    // Get z-index from layer properties
                                    let z = layers[layerId]?.z || 0;

                                    // Apply direction overrides if any
                                    if (mainViz?.directions && mainViz.directions[String(viewDirection)]) {
                                        const dirOverride = mainViz.directions[String(viewDirection)];
                                        if (dirOverride[layerId] && dirOverride[layerId].z !== undefined) {
                                            z = dirOverride[layerId].z;
                                        }
                                    }

                                    calculatedZ = 1000 + (z * 100) + layerIndex;
                                }

                                // Don't change z-index when selected, use outline instead
                                const finalZ = calculatedZ;

                                return (
                                    <div
                                        key={key}
                                        onMouseDown={(e) => !isReadOnlyDirection && handleMouseDown(e, key)}
                                        style={{
                                            position: 'absolute',
                                            left: -(asset.x || 0) + renderData.offset.x,
                                            top: -(asset.y || 0) + renderData.offset.y,
                                            zIndex: finalZ,
                                            cursor: isReadOnlyDirection ? 'default' : 'move',
                                            outline: isSelected ? '1px solid #00ff00' : 'none',
                                            transform: asset.flipH ? 'scaleX(-1)' : 'none',
                                            transformOrigin: `${pivotX}px ${pivotY}px`,
                                            userSelect: 'none',
                                            opacity: isReadOnlyDirection ? 0.7 : 1
                                        }}
                                    >
                                        <div style={renderData.style} />
                                    </div>
                                );
                            })}

                            {/* Avatar */}
                            {avatarTesting?.enabled && (
                                <img
                                    src={generateHabboImagerUrl(avatarTesting)}
                                    alt="Avatar"
                                    style={{
                                        position: 'absolute',
                                        left: Math.round(getTileScreenPosition(avatarTesting.tileRow, avatarTesting.tileCol).x - 32),
                                        top: Math.round(getTileScreenPosition(avatarTesting.tileRow, avatarTesting.tileCol).y - 100 - avatarTesting.heightOffset),
                                        width: 64,
                                        height: 110,
                                        pointerEvents: 'none',
                                        zIndex: getAvatarZIndex(avatarTesting.tileRow, avatarTesting.tileCol, avatarTesting.subLayer)
                                    }}
                                />
                            )}
                        </div>

                        <Box sx={{ position: 'absolute', top: 16, left: 16, bgcolor: 'rgba(0,0,0,0.6)', p: 1, borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                Drag assets or use Arrow Keys. Click to select.
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Pan: Drag | Zoom: Scroll
                            </Typography>
                        </Box>

                        {/* Avatar Controls */}
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
                                minWidth: 300
                            }}>
                                <Typography variant="subtitle2" sx={{ color: '#fff' }}>
                                    Avatar Controls
                                </Typography>

                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: 0.5 }}>
                                        <IconButton size="small" onClick={() => moveAvatar(0, -1)} sx={{ color: '#aaa' }}>
                                            <NorthWestIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => moveAvatar(-1, -1)} sx={{ color: '#aaa' }}>
                                            <ArrowUpwardIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => moveAvatar(-1, 0)} sx={{ color: '#aaa' }}>
                                            <NorthEastIcon fontSize="small" />
                                        </IconButton>

                                        <IconButton size="small" onClick={() => moveAvatar(1, -1)} sx={{ color: '#aaa' }}>
                                            <ArrowBackIcon fontSize="small" />
                                        </IconButton>
                                        <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', alignSelf: 'center' }}>
                                            L{getLayerFromPosition(avatarTesting.tileRow, avatarTesting.tileCol)}
                                        </Typography>
                                        <IconButton size="small" onClick={() => moveAvatar(-1, 1)} sx={{ color: '#aaa' }}>
                                            <ArrowForwardIcon fontSize="small" />
                                        </IconButton>

                                        <IconButton size="small" onClick={() => moveAvatar(1, 0)} sx={{ color: '#aaa' }}>
                                            <SouthWestIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => moveAvatar(1, 1)} sx={{ color: '#aaa' }}>
                                            <ArrowDownwardIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => moveAvatar(0, 1)} sx={{ color: '#aaa' }}>
                                            <SouthEastIcon fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', fontSize: '0.6rem' }}>
                                            Sub-layer
                                        </Typography>
                                        <IconButton size="small" onClick={() => adjustSubLayer(1)} sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}>
                                            +
                                        </IconButton>
                                        <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', fontSize: '0.7rem' }}>
                                            {avatarTesting.subLayer}
                                        </Typography>
                                        <IconButton size="small" onClick={() => adjustSubLayer(-1)} sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}>
                                            -
                                        </IconButton>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
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

                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.6rem' }}>
                                            Height
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <IconButton size="small" onClick={() => onAvatarTestingChange?.({ ...avatarTesting, heightOffset: avatarTesting.heightOffset - 5 })} sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}>
                                                -
                                            </IconButton>
                                            <Typography variant="caption" sx={{ color: '#aaa', minWidth: 30, textAlign: 'center', fontSize: '0.7rem' }}>
                                                {avatarTesting.heightOffset}
                                            </Typography>
                                            <IconButton size="small" onClick={() => onAvatarTestingChange?.({ ...avatarTesting, heightOffset: avatarTesting.heightOffset + 5 })} sx={{ color: '#aaa', fontSize: '0.7rem', padding: 0.5 }}>
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
                                        sx={{ color: '#aaa', borderColor: '#444' }}
                                    >
                                        Reset
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>

                    {/* Layer Properties Sidebar */}
                    {selectedAssetKey && (
                        <Box sx={{ width: 320, borderLeft: '1px solid #444', bgcolor: '#1b2636', p: 2, overflowY: 'auto' }}>
                            <Typography variant="h6" gutterBottom>Layer Properties</Typography>

                            {(() => {
                                const { layerId, layerData, layerName } = getLayerInfo(selectedAssetKey);

                                if (layerId === 'shadow') {
                                    return (
                                        <Typography variant="body2" color="text.secondary">
                                            Shadow layer has no editable properties.
                                        </Typography>
                                    );
                                }

                                return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#90caf9', mb: 1 }}>
                                            {layerName} (ID: {layerId})
                                        </Typography>

                                        <TextField
                                            label="Z-Index"
                                            type="number"
                                            size="small"
                                            fullWidth
                                            value={layerData?.z ?? 0}
                                            onChange={(e) => updateLayer(layerId, 'z', parseInt(e.target.value) || 0)}
                                            helperText="Stacking order (higher = on top)"
                                        />

                                        <TextField
                                            label="Alpha (Visibility)"
                                            type="number"
                                            size="small"
                                            fullWidth
                                            value={layerData?.alpha ?? 255}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                updateLayer(layerId, 'alpha', Math.min(255, Math.max(0, val)));
                                            }}
                                            inputProps={{ min: 0, max: 255 }}
                                            helperText="0 = Invisible, 255 = Fully visible"
                                        />

                                        <FormControl fullWidth size="small">
                                            <InputLabel>Ink (Blend Mode)</InputLabel>
                                            <Select
                                                value={layerData?.ink || 'None'}
                                                label="Ink (Blend Mode)"
                                                onChange={(e) => {
                                                    const val = e.target.value === 'None' ? undefined : e.target.value;
                                                    updateLayer(layerId, 'ink', val);
                                                }}
                                            >
                                                <MenuItem value="None">None</MenuItem>
                                                <MenuItem value="ADD">ADD (Additive)</MenuItem>
                                                <MenuItem value="COPY">COPY (Normal)</MenuItem>
                                            </Select>
                                        </FormControl>

                                        <FormControl fullWidth size="small">
                                            <InputLabel>Tag</InputLabel>
                                            <Select
                                                value={layerData?.tag || 'None'}
                                                label="Tag"
                                                onChange={(e) => {
                                                    const val = e.target.value === 'None' ? undefined : e.target.value;
                                                    updateLayer(layerId, 'tag', val);
                                                }}
                                            >
                                                <MenuItem value="None">None</MenuItem>
                                                <MenuItem value="COLOR1">COLOR1</MenuItem>
                                                <MenuItem value="COLOR2">COLOR2</MenuItem>
                                                <MenuItem value="BADGE">BADGE</MenuItem>
                                            </Select>
                                        </FormControl>

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={layerData?.ignoreMouse ?? false}
                                                    onChange={(e) => updateLayer(layerId, 'ignoreMouse', e.target.checked)}
                                                />
                                            }
                                            label={<Typography variant="body2">Ignore Mouse Clicks</Typography>}
                                        />

                                        <Accordion sx={{ bgcolor: '#233044', mt: 2 }}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography variant="caption">About Layer Properties</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Typography variant="caption" color="text.secondary" component="div">
                                                    <div><strong>Z-Index:</strong> Controls stacking order</div>
                                                    <div><strong>Alpha:</strong> Transparency (0-255)</div>
                                                    <div><strong>Ink:</strong> Blend mode for rendering</div>
                                                    <div><strong>Tag:</strong> COLOR1/COLOR2 for user customization, BADGE for guild badges</div>
                                                    <div><strong>Ignore Mouse:</strong> Clicks pass through</div>
                                                </Typography>
                                            </AccordionDetails>
                                        </Accordion>
                                    </Box>
                                );
                            })()}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};
