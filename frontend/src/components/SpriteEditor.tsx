import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Box, Paper, Typography, TextField, Button, IconButton, FormControl, InputLabel,
    Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox,
    FormControlLabel, Radio, RadioGroup, Snackbar, Alert, Toolbar, CircularProgress,
    Slider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import FolderIcon from '@mui/icons-material/Folder';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CropIcon from '@mui/icons-material/Crop';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import FlipIcon from '@mui/icons-material/Flip';
import PaletteIcon from '@mui/icons-material/Palette';
import UndoIcon from '@mui/icons-material/Undo';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import AddIcon from '@mui/icons-material/Add';
import { Sketch } from '@uiw/react-color';
import type { NitroJSON } from '../types';
import {
    GenerateSpriteThumbnails,
    ExtractMultipleSprites,
    ExtractSpritesheet,
    ReplaceSingleSprite,
    ReplaceEntireSpritesheet,
    ReadExternalFile,
    CropSprite,
    ResizeSprite,
    FlipSprite,
    ColorizeSprite
} from '../wailsjs/go/main/App';

interface SpriteInfo {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    thumbnail: string;
}

interface SpriteEditorProps {
    jsonContent: NitroJSON;
    imageContent: string | null;
    onUpdate: (newJson: NitroJSON, newImage?: string) => void;
}

type ViewMode = 'gallery' | 'edit';
type EditMode = 'crop' | 'resize' | 'flip' | 'colorize' | null;

// Helper functions for color conversion
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const SpriteEditor: React.FC<SpriteEditorProps> = ({ jsonContent, imageContent, onUpdate }) => {
    // Gallery state
    const [sprites, setSprites] = useState<SpriteInfo[]>([]);
    const [filteredSprites, setFilteredSprites] = useState<SpriteInfo[]>([]);
    const [selectedSprites, setSelectedSprites] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [layerFilter, setLayerFilter] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('gallery');
    const [selectedSprite, setSelectedSprite] = useState<string | null>(null);

    // Dialog state
    const [extractDialogOpen, setExtractDialogOpen] = useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);

    // File watching state
    const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map());

    // Notification state
    const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info'
    });

    const showNotification = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ open: true, message, severity });
    };

    // In-app editing state
    const [editMode, setEditMode] = useState<EditMode>(null);
    const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [resizeDimensions, setResizeDimensions] = useState<{ w: number; h: number }>({ w: 64, h: 64 });
    const [colorizeValues, setColorizeValues] = useState<{ h: number; s: number; l: number; pickerL: number }>({ h: 0, s: 100, l: 100, pickerL: 50 });
    const [savedColors, setSavedColors] = useState<{ h: number; s: number; l: number; pickerL: number }[]>(() => {
        const saved = localStorage.getItem('retrosprite-saved-colors');
        return saved ? JSON.parse(saved) : [];
    });
    const [isCropping, setIsCropping] = useState(false);
    const [canvasZoom, setCanvasZoom] = useState(1);
    const cropStartRef = useRef<{ x: number; y: number } | null>(null);

    // Canvas ref for editing
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Undo functionality
    const [undoStack, setUndoStack] = useState<{ json: NitroJSON; image: string }[]>([]);
    const canUndo = undoStack.length > 0;

    const pushToUndoStack = () => {
        if (!imageContent) return;
        setUndoStack(prev => [...prev, { json: JSON.parse(JSON.stringify(jsonContent)), image: imageContent }]);
    };

    const performUndo = () => {
        if (undoStack.length === 0) return;

        const newStack = [...undoStack];
        const previousState = newStack.pop()!;
        setUndoStack(newStack);
        onUpdate(previousState.json);
    };

    // Keyboard shortcut for undo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                performUndo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undoStack]);

    // Save colors to localStorage
    useEffect(() => {
        localStorage.setItem('retrosprite-saved-colors', JSON.stringify(savedColors));
    }, [savedColors]);

    // Load thumbnails on mount
    useEffect(() => {
        const loadThumbnails = async () => {
            if (!jsonContent || !imageContent) return;

            setLoading(true);
            try {
                const files = prepareFilesForBackend(jsonContent, imageContent);
                const thumbnails = await GenerateSpriteThumbnails(files);
                setSprites(thumbnails);
                setFilteredSprites(thumbnails);
            } catch (error) {
                console.error('Failed to generate thumbnails:', error);
            } finally {
                setLoading(false);
            }
        };

        loadThumbnails();
    }, [jsonContent, imageContent]);

    // Filter sprites when search/layer changes
    useEffect(() => {
        const filtered = sprites.filter(sprite => {
            const matchesQuery = sprite.name.toLowerCase().includes(searchQuery.toLowerCase());

            // Extract layer from sprite name: {name}_{size}_{layer}_{direction}_{frame}
            const parts = sprite.name.split('_');
            const spriteLayer = parts.length >= 3 ? parts[parts.length - 3] : '';
            const matchesLayer = !layerFilter || spriteLayer === layerFilter;

            return matchesQuery && matchesLayer;
        });
        setFilteredSprites(filtered);
    }, [searchQuery, layerFilter, sprites]);

    // Listen for file watcher events
    useEffect(() => {
        const handleSpriteChanged = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { spriteName, filePath } = customEvent.detail;

            setPendingChanges(prev => new Map(prev).set(spriteName, filePath));
        };

        window.addEventListener('sprite-file-changed', handleSpriteChanged as EventListener);
        return () => window.removeEventListener('sprite-file-changed', handleSpriteChanged as EventListener);
    }, []);

    // Draw sprite on canvas for editing
    useEffect(() => {
        if (viewMode !== 'edit' || !selectedSprite || !canvasRef.current) return;

        const sprite = sprites.find(s => s.name === selectedSprite);
        if (!sprite) return;

        const ctx = canvasRef.current.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Disable image smoothing for crisp pixel art
        ctx.imageSmoothingEnabled = false;

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Clear and redraw the sprite
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (editMode === 'colorize') {
                // Draw to a temporary canvas first to get pixel data
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = sprite.w;
                tempCanvas.height = sprite.h;
                const tempCtx = tempCanvas.getContext('2d', { alpha: true });
                if (tempCtx) {
                    tempCtx.drawImage(img, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, sprite.w, sprite.h);
                    const data = imageData.data;

                    const hueVal = colorizeValues.h / 360; // 0-1
                    const satVal = colorizeValues.s / 100; // 0-1
                    const lightMult = colorizeValues.l / 100; // Multiplier

                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] === 0) continue; // Skip transparent

                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        let [h, s, l] = rgbToHsl(r, g, b);

                        // Set Hue (Absolute)
                        h = hueVal;

                        // Set Saturation (Absolute)
                        s = satVal;

                        // Adjust Lightness (Relative Multiplier)
                        l = Math.max(0, Math.min(1, l * lightMult));

                        const [newR, newG, newB] = hslToRgb(h, s, l);

                        data[i] = newR;
                        data[i + 1] = newG;
                        data[i + 2] = newB;
                    }

                    tempCtx.putImageData(imageData, 0, 0);
                    ctx.drawImage(tempCanvas, 0, 0, sprite.w, sprite.h);
                }
            } else {
                ctx.drawImage(img, 0, 0, sprite.w, sprite.h);
            }

            // Draw crop overlay if in crop mode
            if (editMode === 'crop' && cropRect && cropRect.w > 0 && cropRect.h > 0) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

                // Draw semi-transparent overlay outside crop area
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, cropRect.y); // Top
                ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h); // Left
                ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, canvas.width - (cropRect.x + cropRect.w), cropRect.h); // Right
                ctx.fillRect(0, cropRect.y + cropRect.h, canvas.width, canvas.height - (cropRect.y + cropRect.h)); // Bottom
            }
        };
        img.onerror = () => {
            console.error('Failed to load sprite image for editing');
        };
        img.src = `data:image/png;base64,${sprite.thumbnail}`;
    }, [viewMode, selectedSprite, editMode, cropRect, sprites, colorizeValues]);

    // Helper functions
    const prepareFilesForBackend = (json: NitroJSON, image: string): { [key: string]: number[] } => {
        const files: { [key: string]: number[] } = {};

        const jsonStr = JSON.stringify(json);
        const jsonBytes = new TextEncoder().encode(jsonStr);
        files[json.name + '.json'] = Array.from(jsonBytes);

        const pngBytes = Uint8Array.from(atob(image), c => c.charCodeAt(0));
        files[json.spritesheet!.meta.image] = Array.from(pngBytes);

        return files;
    };

    const processBackendResponse = (files: { [key: string]: number[] | string }): { jsonContent: NitroJSON; imageContent: string } => {
        console.log('Processing backend response. Files received:', Object.keys(files));

        const jsonFileName = Object.keys(files).find(name => name.endsWith('.json'));
        if (!jsonFileName) {
            console.error('Available files:', Object.keys(files));
            throw new Error('No JSON file in response');
        }

        // Handle both base64 strings and number arrays from Wails
        let jsonBytes: Uint8Array;
        const jsonData = files[jsonFileName];

        if (typeof jsonData === 'string') {
            // Wails returned base64-encoded string
            console.log('Decoding base64 JSON string');
            jsonBytes = Uint8Array.from(atob(jsonData), c => c.charCodeAt(0));
        } else {
            // Wails returned number array
            console.log('Converting number array to Uint8Array');
            jsonBytes = new Uint8Array(jsonData);
        }

        console.log('JSON file bytes length:', jsonBytes.length);

        if (jsonBytes.length === 0) {
            console.error('JSON file is empty! Backend returned 0 bytes for JSON.');
            throw new Error('JSON file is empty (0 bytes)');
        }

        const jsonStr = new TextDecoder().decode(jsonBytes);
        console.log('Decoded JSON string length:', jsonStr.length);
        console.log('First 200 chars:', jsonStr.substring(0, 200));
        console.log('Last 200 chars:', jsonStr.substring(Math.max(0, jsonStr.length - 200)));

        if (!jsonStr || jsonStr.trim().length === 0) {
            throw new Error('JSON string is empty after decoding');
        }

        let jsonContent;
        try {
            jsonContent = JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse JSON. String:', jsonStr);
            throw new Error(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
        }

        const pngFileName = jsonContent.spritesheet.meta.image;
        const pngData = files[pngFileName];

        let imageContent: string;
        if (typeof pngData === 'string') {
            // Already base64-encoded
            imageContent = pngData;
        } else {
            // Convert number array to base64
            const pngBytes = new Uint8Array(pngData);
            imageContent = btoa(String.fromCharCode(...pngBytes));
        }

        return { jsonContent, imageContent };
    };

    const extractLayer = (spriteName: string): string => {
        const parts = spriteName.split('_');
        return parts.length >= 3 ? parts[parts.length - 3] : 'unknown';
    };

    const availableLayers = useMemo(() => {
        const layers = new Set<string>();
        sprites.forEach(sprite => {
            layers.add(extractLayer(sprite.name));
        });
        return Array.from(layers).sort();
    }, [sprites]);

    // Event handlers
    const handleSpriteSelect = (spriteName: string) => {
        if (selectedSprites.includes(spriteName)) {
            setSelectedSprites(selectedSprites.filter(s => s !== spriteName));
        } else {
            setSelectedSprites([...selectedSprites, spriteName]);
        }
    };

    const handleSelectAll = () => {
        setSelectedSprites(filteredSprites.map(s => s.name));
    };

    const handleDeselectAll = () => {
        setSelectedSprites([]);
    };

    const handleExtractClick = () => {
        setExtractDialogOpen(true);
    };

    const handleReplaceClick = () => {
        if (selectedSprites.length === 1) {
            setSelectedSprite(selectedSprites[0]);
        }
        setReplaceDialogOpen(true);
    };

    const handleEditClick = () => {
        if (selectedSprites.length === 1) {
            setSelectedSprite(selectedSprites[0]);
            const sprite = sprites.find(s => s.name === selectedSprites[0]);
            if (sprite) {
                setResizeDimensions({ w: sprite.w, h: sprite.h });
            }
            setViewMode('edit');
        }
    };

    const handleReloadExternalChanges = async () => {
        for (const [spriteName, filePath] of pendingChanges) {
            try {
                const fileData = await ReadExternalFile(filePath);
                const files = prepareFilesForBackend(jsonContent, imageContent!);
                const result = await ReplaceSingleSprite(files, spriteName, fileData);

                const { jsonContent: newJson } = processBackendResponse(result);
                onUpdate(newJson);
            } catch (error) {
                console.error(`Failed to reload ${spriteName}:`, error);
            }
        }

        setPendingChanges(new Map());
    };

    // Canvas mouse handlers for crop
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (editMode !== 'crop') return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / canvasZoom);
        const y = Math.round((e.clientY - rect.top) / canvasZoom);

        cropStartRef.current = { x, y };
        setCropRect({ x, y, w: 0, h: 0 });
        setIsCropping(true);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (editMode !== 'crop' || !isCropping || !cropStartRef.current) return;

        const rect = canvasRef.current!.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / canvasZoom);
        const y = Math.round((e.clientY - rect.top) / canvasZoom);

        setCropRect({
            x: Math.min(cropStartRef.current.x, x),
            y: Math.min(cropStartRef.current.y, y),
            w: Math.abs(x - cropStartRef.current.x),
            h: Math.abs(y - cropStartRef.current.y)
        });
    };

    const handleCanvasMouseUp = () => {
        setIsCropping(false);
    };

    const handleApplyCrop = async () => {
        if (!cropRect || !selectedSprite) return;

        try {
            pushToUndoStack();
            const files = prepareFilesForBackend(jsonContent, imageContent!);

            // Ensure all crop values are integers
            const x = Math.round(cropRect.x);
            const y = Math.round(cropRect.y);
            const w = Math.round(cropRect.w);
            const h = Math.round(cropRect.h);

            // selectedSprite already contains the full frame name from spritesheet
            console.log('Cropping sprite:', selectedSprite, 'at', { x, y, w, h });

            const result = await CropSprite(files, selectedSprite, x, y, w, h);

            console.log('Raw result from backend:', result);
            console.log('Result type:', typeof result);
            console.log('Result is null?', result === null);
            console.log('Result is undefined?', result === undefined);
            console.log('Result keys:', result ? Object.keys(result) : 'no keys');

            if (!result || Object.keys(result).length === 0) {
                throw new Error('Backend returned empty response');
            }

            console.log('Crop result received:', Object.keys(result));

            const { jsonContent: newJson, imageContent: newImage } = processBackendResponse(result);
            onUpdate(newJson, newImage);
            setViewMode('gallery');
            setCropRect(null);
            showNotification('Sprite cropped successfully', 'success');
        } catch (error) {
            console.error('Failed to crop sprite:', error);
            showNotification(`Failed to crop sprite: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    };

    const handleApplyResize = async () => {
        if (!selectedSprite) return;

        try {
            pushToUndoStack();
            const files = prepareFilesForBackend(jsonContent, imageContent!);

            // Ensure dimensions are integers
            const w = Math.round(resizeDimensions.w);
            const h = Math.round(resizeDimensions.h);

            // selectedSprite already contains the full frame name from spritesheet
            const result = await ResizeSprite(files, selectedSprite, w, h);

            if (!result || Object.keys(result).length === 0) {
                throw new Error('Backend returned empty response');
            }

            const { jsonContent: newJson, imageContent: newImage } = processBackendResponse(result);
            onUpdate(newJson, newImage);
            setViewMode('gallery');
            showNotification('Sprite resized successfully', 'success');
        } catch (error) {
            console.error('Failed to resize sprite:', error);
            showNotification(`Failed to resize sprite: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    };

    const handleApplyFlip = async (horizontal: boolean) => {
        if (!selectedSprite) return;

        console.log('Flipping sprite:', selectedSprite, 'horizontal:', horizontal);

        try {
            pushToUndoStack();
            const files = prepareFilesForBackend(jsonContent, imageContent!);
            console.log('Calling FlipSprite with files:', Object.keys(files));

            // selectedSprite already contains the full frame name from spritesheet
            console.log('Sprite name:', selectedSprite);

            const result = await FlipSprite(files, selectedSprite, horizontal);
            console.log('FlipSprite result:', result ? 'success' : 'null');

            if (!result || Object.keys(result).length === 0) {
                throw new Error('Backend returned empty response');
            }

            const { jsonContent: newJson, imageContent: newImage } = processBackendResponse(result);
            console.log('Processed response, updating...');

            onUpdate(newJson, newImage);
            setViewMode('gallery');
            console.log('Flip completed successfully');
            showNotification(`Sprite flipped ${horizontal ? 'horizontally' : 'vertically'}`, 'success');
        } catch (error) {
            console.error('Failed to flip sprite:', error);
            showNotification(`Failed to flip sprite: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    };

    const handleApplyColorize = async () => {
        if (!selectedSprite) return;

        try {
            pushToUndoStack();
            const files = prepareFilesForBackend(jsonContent, imageContent!);
            
            const result = await ColorizeSprite(
                files, 
                selectedSprite, 
                colorizeValues.h, 
                colorizeValues.s, 
                colorizeValues.l
            );

            if (!result || Object.keys(result).length === 0) {
                throw new Error('Backend returned empty response');
            }

            const { jsonContent: newJson, imageContent: newImage } = processBackendResponse(result);
            onUpdate(newJson, newImage);
            setViewMode('gallery');
            setColorizeValues({ h: 0, s: 100, l: 100, pickerL: 50 });
            showNotification('Sprite colorized successfully', 'success');
        } catch (error) {
            console.error('Failed to colorize sprite:', error);
            showNotification(`Failed to colorize sprite: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    };

    if (!jsonContent.spritesheet) {
        return <Box p={2}>No spritesheet data found in this JSON.</Box>;
    }

    return (
        <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
            {/* Toolbar */}
            <Toolbar sx={{ borderBottom: '1px solid #555', gap: 2 }}>
                {viewMode === 'gallery' ? (
                    <>
                        <Typography variant="h6">Sprites ({filteredSprites.length})</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<SelectAllIcon />}
                            onClick={selectedSprites.length === filteredSprites.length ? handleDeselectAll : handleSelectAll}
                        >
                            {selectedSprites.length === filteredSprites.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<ImageIcon />}
                            onClick={handleExtractClick}
                            disabled={selectedSprites.length === 0}
                        >
                            Extract
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<SwapHorizIcon />}
                            onClick={handleReplaceClick}
                            disabled={selectedSprites.length !== 1}
                        >
                            Replace
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<CropIcon />}
                            onClick={handleEditClick}
                            disabled={selectedSprites.length !== 1}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<UndoIcon />}
                            onClick={performUndo}
                            disabled={!canUndo}
                        >
                            Undo
                        </Button>
                        <Box sx={{ flexGrow: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                            {selectedSprites.length} selected
                        </Typography>
                    </>
                ) : (
                    <>
                        <Typography variant="h6">Editing: {selectedSprite}</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<UndoIcon />}
                            onClick={performUndo}
                            disabled={!canUndo}
                        >
                            Undo
                        </Button>
                        <Box sx={{ flexGrow: 1 }} />
                        <Button onClick={() => setViewMode('gallery')}>
                            Back to Gallery
                        </Button>
                    </>
                )}
            </Toolbar>

            {/* Main content */}
            <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                {viewMode === 'gallery' ? (
                    <>
                        {/* Gallery view */}
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Search bar */}
                            <Box sx={{ display: 'flex', gap: 2, p: 2, borderBottom: '1px solid #555' }}>
                                <TextField
                                    placeholder="Search sprites..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    size="small"
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                                    }}
                                    sx={{ flexGrow: 1 }}
                                />

                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel>Layer</InputLabel>
                                    <Select
                                        value={layerFilter || ''}
                                        onChange={(e) => setLayerFilter(e.target.value || null)}
                                        label="Layer"
                                    >
                                        <MenuItem value="">All Layers</MenuItem>
                                        {availableLayers.map(layer => (
                                            <MenuItem key={layer} value={layer}>{layer.toUpperCase()}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>

                            {/* Sprite gallery */}
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                    gap: 2,
                                    p: 2,
                                    overflow: 'auto'
                                }}>
                                    {filteredSprites.map(sprite => (
                                        <Paper
                                            key={sprite.name}
                                            sx={{
                                                p: 1,
                                                cursor: 'pointer',
                                                border: selectedSprites.includes(sprite.name) ? '2px solid #90caf9' : 'none',
                                                bgcolor: selectedSprites.includes(sprite.name) ? 'rgba(144, 202, 249, 0.1)' : 'background.paper',
                                                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                                            }}
                                            onClick={() => handleSpriteSelect(sprite.name)}
                                        >
                                            <Box sx={{
                                                width: '100%',
                                                height: 100,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: '#333',
                                                backgroundImage: 'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)',
                                                backgroundSize: '20px 20px',
                                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                            }}>
                                                <img
                                                    src={`data:image/png;base64,${sprite.thumbnail}`}
                                                    alt={sprite.name}
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '100%'
                                                    }}
                                                />
                                            </Box>

                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    display: 'block',
                                                    mt: 1,
                                                    fontSize: '0.7rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={sprite.name}
                                            >
                                                {sprite.name}
                                            </Typography>

                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                {sprite.w}x{sprite.h}
                                            </Typography>
                                        </Paper>
                                    ))}
                                </Box>
                            )}
                        </Box>

                        {/* Inspector sidebar */}
                        <Paper sx={{ width: 300, p: 2, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #555' }}>
                            <Typography variant="h6" gutterBottom>Inspector</Typography>

                            {selectedSprites.length === 1 ? (
                                <>
                                    {(() => {
                                        const sprite = sprites.find(s => s.name === selectedSprites[0]);
                                        if (!sprite) return null;

                                        return (
                                            <>
                                                <Typography variant="subtitle2" sx={{ mb: 2, wordBreak: 'break-all', fontSize: '0.8rem', bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: 1 }}>
                                                    {sprite.name}
                                                </Typography>

                                                <Box sx={{ mb: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">Position:</Typography>
                                                    <Typography variant="body2">{sprite.x}, {sprite.y}</Typography>
                                                </Box>

                                                <Box sx={{ mb: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">Dimensions:</Typography>
                                                    <Typography variant="body2">{sprite.w} x {sprite.h}</Typography>
                                                </Box>

                                                <Box sx={{ mb: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">Layer:</Typography>
                                                    <Typography variant="body2">{extractLayer(sprite.name).toUpperCase()}</Typography>
                                                </Box>
                                            </>
                                        );
                                    })()}
                                </>
                            ) : selectedSprites.length > 1 ? (
                                <Typography color="text.secondary">{selectedSprites.length} sprites selected</Typography>
                            ) : (
                                <Typography color="text.secondary">Select a sprite to view details</Typography>
                            )}
                        </Paper>
                    </>
                ) : (
                    /* Edit view */
                    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Edit controls panel */}
                        <Box sx={{ p: 2, borderBottom: '1px solid #555', bgcolor: '#1e1e1e' }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Edit mode selector */}
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant={editMode === 'crop' ? 'contained' : 'outlined'}
                                        startIcon={<CropIcon />}
                                        onClick={() => setEditMode('crop')}
                                    >
                                        Crop
                                    </Button>
                                    <Button
                                        variant={editMode === 'resize' ? 'contained' : 'outlined'}
                                        startIcon={<AspectRatioIcon />}
                                        onClick={() => setEditMode('resize')}
                                    >
                                        Resize
                                    </Button>
                                    <Button
                                        variant={editMode === 'flip' ? 'contained' : 'outlined'}
                                        startIcon={<FlipIcon />}
                                        onClick={() => setEditMode('flip')}
                                    >
                                        Flip
                                    </Button>
                                    <Button
                                        variant={editMode === 'colorize' ? 'contained' : 'outlined'}
                                        startIcon={<PaletteIcon />}
                                        onClick={() => setEditMode('colorize')}
                                    >
                                        Colorize
                                    </Button>
                                </Box>

                                {/* Zoom controls */}
                                {editMode === 'crop' && (
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 2 }}>
                                        <IconButton
                                            onClick={() => setCanvasZoom(Math.max(1, canvasZoom - 1))}
                                            disabled={canvasZoom <= 1}
                                            size="small"
                                        >
                                            <ZoomOutIcon />
                                        </IconButton>
                                        <Typography variant="caption" sx={{ minWidth: 60, textAlign: 'center' }}>
                                            {(canvasZoom * 100).toFixed(0)}%
                                        </Typography>
                                        <IconButton
                                            onClick={() => setCanvasZoom(Math.min(8, canvasZoom + 1))}
                                            disabled={canvasZoom >= 8}
                                            size="small"
                                        >
                                            <ZoomInIcon />
                                        </IconButton>
                                    </Box>
                                )}

                                <Box sx={{ flexGrow: 1 }} />

                                {/* Action buttons */}
                                {editMode === 'crop' && (
                                    <Button
                                        variant="contained"
                                        onClick={handleApplyCrop}
                                        disabled={!cropRect || cropRect.w === 0 || cropRect.h === 0}
                                    >
                                        Apply Crop
                                    </Button>
                                )}

                                {editMode === 'resize' && (
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <TextField
                                            label="Width"
                                            type="number"
                                            value={resizeDimensions.w}
                                            onChange={(e) => setResizeDimensions(prev => ({ ...prev, w: parseInt(e.target.value) || 0 }))}
                                            size="small"
                                            sx={{ width: 100 }}
                                        />
                                        <TextField
                                            label="Height"
                                            type="number"
                                            value={resizeDimensions.h}
                                            onChange={(e) => setResizeDimensions(prev => ({ ...prev, h: parseInt(e.target.value) || 0 }))}
                                            size="small"
                                            sx={{ width: 100 }}
                                        />
                                        <Button variant="contained" onClick={handleApplyResize}>
                                            Apply Resize
                                        </Button>
                                    </Box>
                                )}

                                {editMode === 'flip' && (
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Button variant="contained" onClick={() => handleApplyFlip(true)}>
                                            Flip Horizontal
                                        </Button>
                                        <Button variant="contained" onClick={() => handleApplyFlip(false)}>
                                            Flip Vertical
                                        </Button>
                                    </Box>
                                )}
                            </Box>

                            {editMode === 'crop' && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    Click and drag on the canvas to select crop area. Use zoom controls for precision.
                                </Typography>
                            )}
                        </Box>

                        {/* Content Area with Flex Row layout */}
                        <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                            
                            {/* Left Panel: Color Picker (Colorize Mode) */}
                            {editMode === 'colorize' && (
                                <Paper sx={{ 
                                    width: 250, 
                                    p: 2, 
                                    borderRight: '1px solid #555', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: 2,
                                    overflow: 'auto',
                                    alignItems: 'center'
                                }}>
                                    <Typography variant="subtitle1" gutterBottom>Color Picker</Typography>
                                    <Typography variant="caption" color="text.secondary" align="center">
                                        Pick a color to tint the sprite.
                                    </Typography>
                                    
                                    <Sketch
                                        color={(() => {
                                            const [r, g, b] = hslToRgb(
                                                colorizeValues.h / 360, 
                                                colorizeValues.s / 100, 
                                                colorizeValues.pickerL / 100
                                            );
                                            return rgbToHex(r, g, b);
                                        })()}
                                        disableAlpha
                                        onChange={(color: any) => {
                                            setColorizeValues(prev => ({
                                                ...prev,
                                                h: color.hsl.h,
                                                s: color.hsl.s,
                                                pickerL: color.hsl.l
                                            }));
                                        }}
                                    />

                                    <Box sx={{ borderTop: '1px solid #444', pt: 2, mt: 2, width: '100%' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="subtitle2">Saved Colors</Typography>
                                            <IconButton 
                                                size="small" 
                                                onClick={() => {
                                                    const exists = savedColors.some(c => 
                                                        c.h === colorizeValues.h && 
                                                        c.s === colorizeValues.s && 
                                                        c.l === colorizeValues.l &&
                                                        c.pickerL === colorizeValues.pickerL
                                                    );
                                                    if (!exists) {
                                                        setSavedColors([...savedColors, { ...colorizeValues }]);
                                                    }
                                                }}
                                                title="Save current color"
                                            >
                                                <AddIcon />
                                            </IconButton>
                                        </Box>
                                        
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {savedColors.length === 0 && (
                                                <Typography variant="caption" color="text.secondary">No saved colors</Typography>
                                            )}
                                            {savedColors.map((color, index) => {
                                                 const [r, g, b] = hslToRgb(color.h / 360, color.s / 100, color.pickerL / 100);
                                                 const hex = rgbToHex(r, g, b);
                                                 return (
                                                    <Box
                                                        key={index}
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 1,
                                                            bgcolor: hex,
                                                            cursor: 'pointer',
                                                            border: '1px solid #555',
                                                            position: 'relative',
                                                            '&:hover .delete-btn': { display: 'flex' }
                                                        }}
                                                        onClick={() => setColorizeValues({ ...color })}
                                                        title={`H:${Math.round(color.h)} S:${Math.round(color.s)} L:${Math.round(color.l)}`}
                                                    >
                                                        <Box
                                                            className="delete-btn"
                                                            sx={{
                                                                display: 'none',
                                                                position: 'absolute',
                                                                top: -4,
                                                                right: -4,
                                                                bgcolor: 'error.main',
                                                                borderRadius: '50%',
                                                                width: 16,
                                                                height: 16,
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 1
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSavedColors(savedColors.filter((_, i) => i !== index));
                                                            }}
                                                        >
                                                            <CloseIcon sx={{ fontSize: 10, color: 'white' }} />
                                                        </Box>
                                                    </Box>
                                                 );
                                            })}
                                        </Box>
                                    </Box>
                                </Paper>
                            )}

                            {/* Center Panel: Canvas */}
                            <Box sx={{
                                flexGrow: 1,
                                overflow: 'auto',
                                bgcolor: '#2b2b2b',
                                display: 'flex',
                                alignItems: 'center', // Center vertically
                                justifyContent: 'center', // Center horizontally
                                p: 2,
                                position: 'relative'
                            }}>
                                {selectedSprite && sprites.find(s => s.name === selectedSprite) && (() => {
                                    const sprite = sprites.find(s => s.name === selectedSprite)!;
                                    const scaledWidth = sprite.w * canvasZoom;
                                    const scaledHeight = sprite.h * canvasZoom;

                                    return (
                                        <Box sx={{
                                            width: scaledWidth,
                                            height: scaledHeight,
                                            minWidth: scaledWidth,
                                            minHeight: scaledHeight,
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                        }}>
                                            <canvas
                                                ref={canvasRef}
                                                width={sprite.w}
                                                height={sprite.h}
                                                onMouseDown={handleCanvasMouseDown}
                                                onMouseMove={handleCanvasMouseMove}
                                                onMouseUp={handleCanvasMouseUp}
                                                style={{
                                                    border: '2px solid #555',
                                                    cursor: editMode === 'crop' ? 'crosshair' : 'default',
                                                    transform: `scale(${canvasZoom})`,
                                                    transformOrigin: 'top left',
                                                    display: 'block',
                                                    backgroundColor: '#1a1a1a',
                                                    width: sprite.w,
                                                    height: sprite.h
                                                }}
                                            />
                                        </Box>
                                    );
                                })()}
                            </Box>

                            {/* Right Panel: Sliders (Colorize Mode) */}
                            {editMode === 'colorize' && (
                                <Paper sx={{ 
                                    width: 300, 
                                    p: 2, 
                                    borderLeft: '1px solid #555',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3,
                                    overflow: 'auto'
                                }}>
                                    <Typography variant="subtitle1" gutterBottom>Adjustments</Typography>
                                    
                                    <Box>
                                        <Typography variant="caption" gutterBottom>Hue ({Math.round(colorizeValues.h)}°)</Typography>
                                        <Slider
                                            value={colorizeValues.h}
                                            onChange={(_, v) => setColorizeValues(prev => ({ ...prev, h: v as number }))}
                                            min={0}
                                            max={360}
                                            valueLabelDisplay="auto"
                                        />
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" gutterBottom>Saturation ({Math.round(colorizeValues.s)}%)</Typography>
                                        <Slider
                                            value={colorizeValues.s}
                                            onChange={(_, v) => setColorizeValues(prev => ({ ...prev, s: v as number }))}
                                            min={0}
                                            max={100}
                                            valueLabelDisplay="auto"
                                        />
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" gutterBottom>Lightness Multiplier ({Math.round(colorizeValues.l)}%)</Typography>
                                        <Slider
                                            value={colorizeValues.l}
                                            onChange={(_, v) => setColorizeValues(prev => ({ ...prev, l: v as number }))}
                                            min={0}
                                            max={200}
                                            valueLabelDisplay="auto"
                                        />
                                    </Box>

                                    <Button 
                                        variant="contained" 
                                        fullWidth 
                                        onClick={handleApplyColorize}
                                        size="large"
                                    >
                                        Apply Color
                                    </Button>
                                </Paper>
                            )}

                        </Box>
                    </Box>
                )}
            </Box>

            {/* Extract Dialog */}
            <ExtractDialog
                open={extractDialogOpen}
                onClose={() => setExtractDialogOpen(false)}
                selectedSprites={selectedSprites}
                jsonContent={jsonContent}
                imageContent={imageContent}
            />

            {/* Replace Dialog */}
            <ReplaceDialog
                open={replaceDialogOpen}
                onClose={() => setReplaceDialogOpen(false)}
                spriteName={selectedSprite}
                jsonContent={jsonContent}
                imageContent={imageContent}
                onUpdate={onUpdate}
            />

            {/* Watcher Notification */}
            <Snackbar
                open={pendingChanges.size > 0}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity="info"
                    action={
                        <>
                            <Button color="inherit" size="small" onClick={handleReloadExternalChanges}>
                                Reload
                            </Button>
                            <IconButton size="small" color="inherit" onClick={() => setPendingChanges(new Map())}>
                                <CloseIcon />
                            </IconButton>
                        </>
                    }
                >
                    {pendingChanges.size} sprite{pendingChanges.size !== 1 ? 's' : ''} changed externally
                </Alert>
            </Snackbar>

            {/* General Notifications */}
            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={() => setNotification({ ...notification, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setNotification({ ...notification, open: false })}
                    severity={notification.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

// Extract Dialog Component
interface ExtractDialogProps {
    open: boolean;
    onClose: () => void;
    selectedSprites: string[];
    jsonContent: NitroJSON;
    imageContent: string | null;
}

const ExtractDialog: React.FC<ExtractDialogProps> = ({ open, onClose, selectedSprites, jsonContent, imageContent }) => {
    const [organizeByLayer, setOrganizeByLayer] = useState(false);
    const [extractAll, setExtractAll] = useState(false);
    const [extractSpritesheet, setExtractSpritesheet] = useState(false);

    const prepareFilesForBackend = (json: NitroJSON, image: string): { [key: string]: number[] } => {
        const files: { [key: string]: number[] } = {};
        const jsonStr = JSON.stringify(json);
        const jsonBytes = new TextEncoder().encode(jsonStr);
        files[json.name + '.json'] = Array.from(jsonBytes);
        const pngBytes = Uint8Array.from(atob(image), c => c.charCodeAt(0));
        files[json.spritesheet!.meta.image] = Array.from(pngBytes);
        return files;
    };

    const handleExtract = async () => {
        if (!imageContent) return;

        try {
            const files = prepareFilesForBackend(jsonContent, imageContent);

            if (extractSpritesheet) {
                const result = await ExtractSpritesheet(files);
                console.log('Extracted spritesheet to:', result);
            } else {
                const result = await ExtractMultipleSprites(
                    files,
                    extractAll ? [] : selectedSprites,
                    organizeByLayer
                );

                if (result.success) {
                    console.log(`Extracted ${result.extractedCount} sprites to ${result.outputPath}`);
                } else {
                    console.error('Extraction completed with errors:', result.errors);
                }
            }

            onClose();
        } catch (error) {
            console.error('Extraction failed:', error);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Extract Sprites</DialogTitle>
            <DialogContent>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={extractSpritesheet}
                            onChange={(e) => setExtractSpritesheet(e.target.checked)}
                        />
                    }
                    label="Extract entire spritesheet instead"
                />

                {!extractSpritesheet && (
                    <>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={extractAll}
                                    onChange={(e) => setExtractAll(e.target.checked)}
                                />
                            }
                            label="Extract all sprites"
                        />

                        {!extractAll && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Selected: {selectedSprites.length} sprite{selectedSprites.length !== 1 ? 's' : ''}
                            </Typography>
                        )}

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={organizeByLayer}
                                    onChange={(e) => setOrganizeByLayer(e.target.checked)}
                                />
                            }
                            label="Organize into layer folders"
                        />

                        <Typography variant="caption" color="text.secondary">
                            {organizeByLayer
                                ? 'Sprites will be organized into folders by layer (a, b, c, etc.)'
                                : 'All sprites will be saved in a single folder'
                            }
                        </Typography>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    onClick={handleExtract}
                    variant="contained"
                    disabled={!extractSpritesheet && !extractAll && selectedSprites.length === 0}
                >
                    Extract
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// Replace Dialog Component
interface ReplaceDialogProps {
    open: boolean;
    onClose: () => void;
    spriteName: string | null;
    jsonContent: NitroJSON;
    imageContent: string | null;
    onUpdate: (newJson: NitroJSON, newImage?: string) => void;
}

const ReplaceDialog: React.FC<ReplaceDialogProps> = ({ open, onClose, spriteName, jsonContent, imageContent, onUpdate }) => {
    const [replaceType, setReplaceType] = useState<'single' | 'entire'>('single');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const prepareFilesForBackend = (json: NitroJSON, image: string): { [key: string]: number[] } => {
        const files: { [key: string]: number[] } = {};
        const jsonStr = JSON.stringify(json);
        const jsonBytes = new TextEncoder().encode(jsonStr);
        files[json.name + '.json'] = Array.from(jsonBytes);
        const pngBytes = Uint8Array.from(atob(image), c => c.charCodeAt(0));
        files[json.spritesheet!.meta.image] = Array.from(pngBytes);
        return files;
    };

    const processBackendResponse = (files: { [key: string]: number[] | string }): { jsonContent: NitroJSON; imageContent: string } => {
        const jsonFileName = Object.keys(files).find(name => name.endsWith('.json'));
        if (!jsonFileName) throw new Error('No JSON file in response');

        // Handle both base64 strings and number arrays from Wails
        const jsonData = files[jsonFileName];
        let jsonBytes: Uint8Array;

        if (typeof jsonData === 'string') {
            jsonBytes = Uint8Array.from(atob(jsonData), c => c.charCodeAt(0));
        } else {
            jsonBytes = new Uint8Array(jsonData);
        }

        const jsonStr = new TextDecoder().decode(jsonBytes);
        const jsonContent = JSON.parse(jsonStr);
        const pngFileName = jsonContent.spritesheet.meta.image;
        const pngData = files[pngFileName];

        let imageContent: string;
        if (typeof pngData === 'string') {
            imageContent = pngData;
        } else {
            const pngBytes = new Uint8Array(pngData);
            imageContent = btoa(String.fromCharCode(...pngBytes));
        }

        return { jsonContent, imageContent };
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'image/png') {
            setSelectedFile(file);
        } else {
            console.error('Please select a PNG file');
        }
    };

    const handleReplace = async () => {
        if (!selectedFile || !imageContent) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            const base64Data = base64.split(',')[1];

            try {
                const files = prepareFilesForBackend(jsonContent, imageContent);

                if (replaceType === 'single' && spriteName) {
                    const result = await ReplaceSingleSprite(files, spriteName, base64Data);
                    const { jsonContent: newJson, imageContent: newImage } = processBackendResponse(result);
                    onUpdate(newJson, newImage);
                    console.log(`Replaced sprite "${spriteName}"`);
                } else {
                    const result = await ReplaceEntireSpritesheet(files, base64Data);
                    const { jsonContent: newJson, imageContent: newImage } = processBackendResponse(result);
                    onUpdate(newJson, newImage);
                    console.log('Replaced entire spritesheet');
                }

                onClose();
                setSelectedFile(null);
            } catch (error) {
                console.error('Replacement failed:', error);
            }
        };

        reader.readAsDataURL(selectedFile);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Replace Sprite</DialogTitle>
            <DialogContent>
                <FormControl component="fieldset" sx={{ mb: 2 }}>
                    <RadioGroup
                        value={replaceType}
                        onChange={(e) => setReplaceType(e.target.value as any)}
                    >
                        <FormControlLabel
                            value="single"
                            control={<Radio />}
                            label={spriteName ? `Replace "${spriteName}" only` : 'Replace single sprite'}
                        />
                        <FormControlLabel
                            value="entire"
                            control={<Radio />}
                            label="Replace entire spritesheet"
                        />
                    </RadioGroup>
                </FormControl>

                <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<FolderIcon />}
                >
                    Select PNG File
                    <input
                        type="file"
                        hidden
                        accept="image/png"
                        onChange={handleFileSelect}
                    />
                </Button>

                {selectedFile && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        Selected: {selectedFile.name}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    onClick={handleReplace}
                    variant="contained"
                    disabled={!selectedFile}
                >
                    Replace
                </Button>
            </DialogActions>
        </Dialog>
    );
};
