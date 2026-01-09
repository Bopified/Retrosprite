import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Box, Paper, Typography, TextField, Button, IconButton, FormControl, InputLabel,
    Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox,
    FormControlLabel, Radio, RadioGroup, Snackbar, Alert, Toolbar, CircularProgress,
    Slider, List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Divider
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
import DeleteIcon from '@mui/icons-material/Delete';
import LayersIcon from '@mui/icons-material/Layers';
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

    // Layer management state
    const [layerManagementOpen, setLayerManagementOpen] = useState(false);
    const [layerToDelete, setLayerToDelete] = useState<{ name: string; spriteCount: number } | null>(null);

    // Dialog state
    const [extractDialogOpen, setExtractDialogOpen] = useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
    const [addSpriteDialogOpen, setAddSpriteDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
        // Pass both JSON and image to restore complete state
        onUpdate(previousState.json, previousState.image);
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
            if (!jsonContent || !imageContent) {
                console.log('[SpriteEditor] No content to load');
                return;
            }

            console.log('[SpriteEditor] Loading thumbnails for:', jsonContent.name);
            console.log('[SpriteEditor] Frame count in JSON:', jsonContent.spritesheet?.frames ? Object.keys(jsonContent.spritesheet.frames).length : 0);

            setLoading(true);
            try {
                const files = prepareFilesForBackend(jsonContent, imageContent);
                console.log('[SpriteEditor] Calling GenerateSpriteThumbnails...');
                const thumbnails = await GenerateSpriteThumbnails(files);
                console.log('[SpriteEditor] Received thumbnails:', thumbnails.length);
                console.log('[SpriteEditor] Sample thumbnail names:', thumbnails.slice(0, 5).map(t => t.name));
                setSprites(thumbnails);
                setFilteredSprites(thumbnails);
            } catch (error) {
                console.error('[SpriteEditor] Failed to generate thumbnails:', error);
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
            // Note: Some tools add .png extension, so we need to handle that
            let spriteName = sprite.name;
            if (spriteName.endsWith('.png')) {
                spriteName = spriteName.slice(0, -4);
            }
            const parts = spriteName.split('_');
            const spriteLayer = parts.length >= 3 ? parts[parts.length - 3] : '';
            const matchesLayer = !layerFilter || spriteLayer === layerFilter;

            return matchesQuery && matchesLayer;
        });
        console.log('[SpriteEditor] Filtered sprites:', filtered.length, 'from', sprites.length, 'total');
        if (filtered.length === 0 && sprites.length > 0) {
            console.log('[SpriteEditor] All sprites filtered out! LayerFilter:', layerFilter, 'SearchQuery:', searchQuery);
        }
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
        // Strip .png extension if present
        let name = spriteName;
        if (name.endsWith('.png')) {
            name = name.slice(0, -4);
        }
        const parts = name.split('_');
        return parts.length >= 3 ? parts[parts.length - 3] : 'unknown';
    };

    const availableLayers = useMemo(() => {
        const layers = new Set<string>();
        sprites.forEach(sprite => {
            layers.add(extractLayer(sprite.name));
        });
        return Array.from(layers).sort();
    }, [sprites]);

    // Layer management helper functions
    const getLayerOrder = (): string[] => {
        // Standard layer order: a, b, c, d, ... then sd (shadow)
        const layerOrder = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'sd'];
        return availableLayers.sort((a, b) => {
            const aIdx = layerOrder.indexOf(a);
            const bIdx = layerOrder.indexOf(b);
            if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    };

    const getNextLayerName = (): string => {
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const existingLayers = getLayerOrder().filter(l => l !== 'sd' && l !== 'icon');

        for (const letter of letters) {
            if (!existingLayers.includes(letter)) {
                return letter;
            }
        }
        return 'x'; // Fallback if all standard letters are used
    };

    const handleAddLayer = () => {
        if (!jsonContent.spritesheet || !jsonContent.assets || !jsonContent.visualizations) return;

        const newLayerName = getNextLayerName();
        const furnitureName = jsonContent.name || 'furniture';
        const size = jsonContent.visualizations[0]?.size || 64;

        pushToUndoStack();

        const newJson = JSON.parse(JSON.stringify(jsonContent)) as typeof jsonContent;

        // Get existing directions
        const directions = ['0', '2', '4', '6'];

        // Add frames to spritesheet (placeholder frames)
        if (!newJson.spritesheet) return;

        directions.forEach(dir => {
            const frameName = `${furnitureName}_${size}_${newLayerName}_${dir}_0`;

            // Create a minimal placeholder frame
            if (!newJson.spritesheet!.frames[frameName]) {
                newJson.spritesheet!.frames[frameName] = {
                    frame: { x: 0, y: 0, w: 1, h: 1 },
                    rotated: false,
                    trimmed: false,
                    spriteSourceSize: { x: 0, y: 0, w: 1, h: 1 },
                    sourceSize: { w: 1, h: 1 },
                    pivot: { x: 0.5, y: 0.5 }
                };
            }
        });

        // Add assets
        newJson.assets![`${furnitureName}_${size}_${newLayerName}_0_0`] = { x: 32, y: 32 };
        newJson.assets![`${furnitureName}_${size}_${newLayerName}_2_0`] = { x: 32, y: 32 };
        newJson.assets![`${furnitureName}_${size}_${newLayerName}_4_0`] = {
            source: `${furnitureName}_${size}_${newLayerName}_2_0`,
            x: 32,
            y: 32,
            flipH: true
        };
        newJson.assets![`${furnitureName}_${size}_${newLayerName}_6_0`] = {
            source: `${furnitureName}_${size}_${newLayerName}_0_0`,
            x: 32,
            y: 32,
            flipH: true
        };

        // Update visualization layer count
        if (newJson.visualizations && newJson.visualizations[0]) {
            const viz = newJson.visualizations[0];
            const newLayerCount = getLayerOrder().length + 1;
            viz.layerCount = newLayerCount;

            // Add layer properties
            if (!viz.layers) viz.layers = {};
            const layerIndex = (newLayerCount - 1).toString();
            viz.layers[layerIndex] = {
                z: newLayerCount * 10,
                alpha: 255
            };
        }

        onUpdate(newJson);
        showNotification(`Layer "${newLayerName}" added successfully`, 'success');
    };

    const handleRemoveLayer = (layerName: string, spriteCount: number) => {
        setLayerToDelete({ name: layerName, spriteCount });
    };

    const confirmRemoveLayer = () => {
        if (!layerToDelete || !jsonContent.spritesheet || !jsonContent.assets || !jsonContent.visualizations) return;

        const layerName = layerToDelete.name;
        pushToUndoStack();

        const newJson = JSON.parse(JSON.stringify(jsonContent)) as typeof jsonContent;

        // Remove frames from spritesheet
        const framesToRemove: string[] = [];
        Object.keys(newJson.spritesheet!.frames).forEach(frameName => {
            if (frameName.includes(`_${layerName}_`)) {
                framesToRemove.push(frameName);
            }
        });

        framesToRemove.forEach(frameName => {
            delete newJson.spritesheet!.frames[frameName];
        });

        // Remove assets
        const assetsToRemove: string[] = [];
        Object.keys(newJson.assets!).forEach(assetName => {
            if (assetName.includes(`_${layerName}_`)) {
                assetsToRemove.push(assetName);
            }
        });

        assetsToRemove.forEach(assetName => {
            delete newJson.assets![assetName];
        });

        // Update visualization layer count
        if (newJson.visualizations && newJson.visualizations[0]) {
            const viz = newJson.visualizations[0];
            const newLayerCount = Math.max(0, viz.layerCount - 1);
            viz.layerCount = newLayerCount;

            // Remove layer properties for the highest layer index
            if (viz.layers) {
                const layerKeys = Object.keys(viz.layers).map(k => parseInt(k)).sort((a, b) => b - a);
                if (layerKeys.length > 0) {
                    const highestLayerKey = layerKeys[0].toString();
                    delete viz.layers[highestLayerKey];
                }
            }
        }

        onUpdate(newJson);
        showNotification(`Layer "${layerName}" removed successfully`, 'success');
        setLayerToDelete(null);
    };

    const handleDeleteSprites = () => {
        if (selectedSprites.length === 0) return;
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteSprites = () => {
        if (!jsonContent.spritesheet || !jsonContent.assets) return;

        pushToUndoStack();

        const newJson = JSON.parse(JSON.stringify(jsonContent)) as typeof jsonContent;

        // Track which layers and frame numbers are being deleted
        const deletedFrames: Map<string, Set<number>> = new Map(); // layer -> set of frame numbers

        selectedSprites.forEach(spriteName => {
            // Remove from spritesheet frames
            if (newJson.spritesheet!.frames[spriteName]) {
                delete newJson.spritesheet!.frames[spriteName];
            }

            // Find and remove corresponding asset
            // Sprite name format in gallery: {furniture}_{furniture}_{size}_{layer}_{direction}_{frame}.png
            // Asset name format: {furniture}_{size}_{layer}_{direction}_{frame}
            let assetKey = spriteName;
            if (spriteName.endsWith('.png')) {
                assetKey = spriteName.slice(0, -4);
            }

            // Strip duplicate furniture name prefix if present
            // Example: lizzy_block_01_lizzy_block_01_64_a_2_0 -> lizzy_block_01_64_a_2_0
            const furnitureName = jsonContent.name || '';
            if (furnitureName && assetKey.startsWith(`${furnitureName}_${furnitureName}_`)) {
                assetKey = assetKey.replace(`${furnitureName}_`, '');
            }

            // Extract layer and frame info for animation cleanup
            const parts = assetKey.split('_');
            if (parts.length >= 3) {
                const layer = parts[parts.length - 3]; // layer letter (a, b, c, etc.)
                const frameNum = parseInt(parts[parts.length - 1]); // frame number
                if (!isNaN(frameNum)) {
                    if (!deletedFrames.has(layer)) {
                        deletedFrames.set(layer, new Set());
                    }
                    deletedFrames.get(layer)!.add(frameNum);
                }
            }

            // Remove the asset
            if (newJson.assets![assetKey]) {
                delete newJson.assets![assetKey];
            }

            // Also check for references (source property in mirrored directions)
            Object.keys(newJson.assets!).forEach(key => {
                const asset = newJson.assets![key];
                if (asset.source === assetKey) {
                    delete newJson.assets![key];
                }
            });
        });

        // Clean up animation definitions that reference deleted frames
        const emptyAnimationStates = new Set<number>();

        if (newJson.visualizations) {
            newJson.visualizations.forEach(viz => {
                if (viz.animations) {
                    Object.keys(viz.animations).forEach(animKey => {
                        const anim = viz.animations![animKey];
                        if (anim.layers) {
                            Object.keys(anim.layers).forEach(layerIdxStr => {
                                const layerIdx = parseInt(layerIdxStr);
                                const layerChar = String.fromCharCode(97 + layerIdx); // a, b, c...

                                if (deletedFrames.has(layerChar)) {
                                    const deletedFrameNums = deletedFrames.get(layerChar)!;
                                    const layerAnim = anim.layers![layerIdxStr];

                                    if (layerAnim.frameSequences) {
                                        Object.keys(layerAnim.frameSequences).forEach(seqKey => {
                                            const seq = layerAnim.frameSequences![seqKey];
                                            if (seq.frames) {
                                                // Remove deleted frames from the sequence
                                                Object.keys(seq.frames).forEach(frameKey => {
                                                    const frame = seq.frames![frameKey];
                                                    if (deletedFrameNums.has(frame.id)) {
                                                        delete seq.frames![frameKey];
                                                    }
                                                });

                                                // If sequence is now empty, remove it
                                                if (Object.keys(seq.frames).length === 0) {
                                                    delete layerAnim.frameSequences![seqKey];
                                                }
                                            }
                                        });

                                        // If no sequences left, remove the layer animation
                                        if (Object.keys(layerAnim.frameSequences).length === 0) {
                                            delete anim.layers![layerIdxStr];
                                        }
                                    }
                                }
                            });

                            // Check if this animation state is now completely empty
                            if (Object.keys(anim.layers).length === 0) {
                                emptyAnimationStates.add(parseInt(animKey));
                            }
                        }
                    });

                    // Remove empty animation states and renumber remaining ones
                    if (emptyAnimationStates.size > 0) {
                        const sortedEmptyStates = Array.from(emptyAnimationStates).sort((a, b) => a - b);

                        // Delete empty animation states
                        sortedEmptyStates.forEach(state => {
                            delete viz.animations![state.toString()];
                        });

                        // Renumber remaining animation states to fill gaps
                        const remainingStates = Object.keys(viz.animations)
                            .map(k => parseInt(k))
                            .sort((a, b) => a - b);

                        if (remainingStates.length > 0) {
                            const newAnimations: typeof viz.animations = {};
                            remainingStates.forEach((oldState, index) => {
                                newAnimations[index.toString()] = viz.animations![oldState.toString()];
                            });
                            viz.animations = newAnimations;
                        }
                    }
                }
            });
        }

        onUpdate(newJson);
        showNotification(`${selectedSprites.length} sprite(s) deleted successfully`, 'success');
        setSelectedSprites([]);
        setDeleteConfirmOpen(false);
    };

    const handleAddSprite = (layer: string, direction: string, frame: string) => {
        if (!jsonContent.spritesheet || !jsonContent.assets || !jsonContent.visualizations) return;

        pushToUndoStack();

        const newJson = JSON.parse(JSON.stringify(jsonContent)) as typeof jsonContent;
        const furnitureName = jsonContent.name || 'furniture';
        const size = jsonContent.visualizations[0]?.size || 64;

        const frameName = `${furnitureName}_${size}_${layer}_${direction}_${frame}`;
        const assetName = frameName;

        // Check if sprite already exists
        if (newJson.spritesheet!.frames[frameName]) {
            showNotification(`Sprite "${frameName}" already exists`, 'error');
            return;
        }

        // Add frame to spritesheet (placeholder)
        newJson.spritesheet!.frames[frameName] = {
            frame: { x: 0, y: 0, w: 1, h: 1 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 1, h: 1 },
            sourceSize: { w: 1, h: 1 },
            pivot: { x: 0.5, y: 0.5 }
        };

        // Add asset entry
        // For directions 0 and 2, create normal assets
        // For directions 4 and 6, create mirrored references
        if (direction === '0' || direction === '2') {
            newJson.assets![assetName] = { x: 32, y: 32 };
        } else if (direction === '4') {
            // Mirror of direction 2
            const sourceDirection = '2';
            const sourceName = `${furnitureName}_${size}_${layer}_${sourceDirection}_${frame}`;
            newJson.assets![assetName] = {
                source: sourceName,
                x: 32,
                y: 32,
                flipH: true
            };
        } else if (direction === '6') {
            // Mirror of direction 0
            const sourceDirection = '0';
            const sourceName = `${furnitureName}_${size}_${layer}_${sourceDirection}_${frame}`;
            newJson.assets![assetName] = {
                source: sourceName,
                x: 32,
                y: 32,
                flipH: true
            };
        }

        onUpdate(newJson);
        showNotification(`Sprite "${frameName}" added successfully`, 'success');
        setAddSpriteDialogOpen(false);
    };

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
            <Toolbar sx={{ borderBottom: '1px solid #555', gap: 1, minHeight: '56px !important' }}>
                {viewMode === 'gallery' ? (
                    <>
                        <Typography variant="h6" sx={{ mr: 2 }}>Sprites ({filteredSprites.length})</Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<SelectAllIcon fontSize="small" />}
                            onClick={selectedSprites.length === filteredSprites.length ? handleDeselectAll : handleSelectAll}
                            sx={{ textTransform: 'none' }}
                        >
                            {selectedSprites.length === filteredSprites.length ? 'Deselect' : 'Select All'}
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<ImageIcon fontSize="small" />}
                            onClick={handleExtractClick}
                            disabled={selectedSprites.length === 0}
                            sx={{ textTransform: 'none' }}
                        >
                            Extract
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SwapHorizIcon fontSize="small" />}
                            onClick={handleReplaceClick}
                            disabled={selectedSprites.length !== 1}
                            sx={{ textTransform: 'none' }}
                        >
                            Replace
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<CropIcon fontSize="small" />}
                            onClick={handleEditClick}
                            disabled={selectedSprites.length !== 1}
                            sx={{ textTransform: 'none' }}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={handleDeleteSprites}
                            disabled={selectedSprites.length === 0}
                            sx={{ textTransform: 'none' }}
                        >
                            Delete
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            color="success"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={() => setAddSpriteDialogOpen(true)}
                            sx={{ textTransform: 'none' }}
                        >
                            Add
                        </Button>
                        <Box sx={{ borderLeft: '1px solid #555', height: 32, mx: 1 }} />
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<LayersIcon fontSize="small" />}
                            onClick={() => setLayerManagementOpen(true)}
                            sx={{ textTransform: 'none' }}
                        >
                            Layers
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<UndoIcon fontSize="small" />}
                            onClick={performUndo}
                            disabled={!canUndo}
                            sx={{ textTransform: 'none' }}
                        >
                            Undo
                        </Button>
                        <Box sx={{ flexGrow: 1 }} />
                        <Chip
                            label={`${selectedSprites.length} selected`}
                            size="small"
                            sx={{ bgcolor: selectedSprites.length > 0 ? 'primary.main' : 'rgba(255,255,255,0.1)' }}
                        />
                    </>
                ) : (
                    <>
                        <Typography variant="h6">Editing: {selectedSprite}</Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<UndoIcon fontSize="small" />}
                            onClick={performUndo}
                            disabled={!canUndo}
                            sx={{ textTransform: 'none' }}
                        >
                            Undo
                        </Button>
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                            size="small"
                            onClick={() => setViewMode('gallery')}
                            sx={{ textTransform: 'none' }}
                        >
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

            {/* Layer Management Dialog */}
            <Dialog
                open={layerManagementOpen}
                onClose={() => setLayerManagementOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        <LayersIcon />
                        <Typography variant="h6">Manage Sprite Layers</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Sprite layers define the visual composition of your furniture. Each layer (a, b, c, etc.)
                        represents a separate renderable element that can be stacked and positioned independently.
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle1">Current Layers</Typography>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleAddLayer}
                        >
                            Add Layer
                        </Button>
                    </Box>

                    {getLayerOrder().length === 0 ? (
                        <Typography color="text.secondary" variant="body2">
                            No layers found. Click "Add Layer" to create one.
                        </Typography>
                    ) : (
                        <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                            {getLayerOrder().map((layerName, index) => {
                                // Count sprites for this layer
                                const spriteCount = sprites.filter(s => extractLayer(s.name) === layerName).length;
                                const layerIndex = index;
                                const zIndex = jsonContent.visualizations?.[0]?.layers?.[layerIndex.toString()]?.z ?? layerIndex * 10;

                                return (
                                    <ListItem
                                        key={layerName}
                                        sx={{
                                            border: '1px solid #444',
                                            borderRadius: 1,
                                            mb: 1,
                                            bgcolor: '#2b3a52'
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#90caf9' }}>
                                                        Layer {layerName.toUpperCase()}
                                                    </Typography>
                                                    <Chip
                                                        label={`${spriteCount} sprites`}
                                                        size="small"
                                                        sx={{ ml: 1 }}
                                                    />
                                                </Box>
                                            }
                                            secondary={
                                                <Typography variant="caption" color="text.secondary">
                                                    Z-Index: {zIndex} • Order: {index + 1} of {getLayerOrder().length}
                                                </Typography>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                edge="end"
                                                onClick={() => handleRemoveLayer(layerName, spriteCount)}
                                                sx={{ color: '#f48fb1' }}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}

                    <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(144, 202, 249, 0.05)', borderRadius: 1, border: '1px solid rgba(144, 202, 249, 0.2)' }}>
                        <Typography variant="subtitle2" gutterBottom>Layer Naming Convention</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Layers are automatically named in alphabetical order: <strong>a, b, c, d...</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Special layers: <strong>sd</strong> (shadow), <strong>icon</strong> (furniture icon)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Z-Index determines the stacking order, with higher values appearing on top.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLayerManagementOpen(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Layer Deletion Confirmation Dialog */}
            <Dialog
                open={!!layerToDelete}
                onClose={() => setLayerToDelete(null)}
                maxWidth="sm"
            >
                <DialogTitle>Delete Layer?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to remove layer <strong>{layerToDelete?.name.toUpperCase()}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        This will delete all <strong>{layerToDelete?.spriteCount} sprites</strong> in this layer.
                    </Typography>
                    <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
                        This action can be undone with the Undo button.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLayerToDelete(null)}>
                        Cancel
                    </Button>
                    <Button onClick={confirmRemoveLayer} variant="contained" color="error">
                        Delete Layer
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Sprite Dialog */}
            <AddSpriteDialog
                open={addSpriteDialogOpen}
                onClose={() => setAddSpriteDialogOpen(false)}
                onAdd={handleAddSprite}
                availableLayers={getLayerOrder()}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                maxWidth="sm"
            >
                <DialogTitle>Delete Sprites?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {selectedSprites.length} sprite(s)?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        This will remove the sprites from both the spritesheet and asset definitions.
                        This action can be undone with the Undo button.
                    </Typography>
                    {selectedSprites.length <= 5 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                                Sprites to delete:
                            </Typography>
                            {selectedSprites.map(name => (
                                <Typography key={name} variant="caption" display="block" sx={{ pl: 2 }}>
                                    • {name}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={confirmDeleteSprites} variant="contained" color="error">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

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

// Add Sprite Dialog Component
interface AddSpriteDialogProps {
    open: boolean;
    onClose: () => void;
    onAdd: (layer: string, direction: string, frame: string) => void;
    availableLayers: string[];
}

const AddSpriteDialog: React.FC<AddSpriteDialogProps> = ({ open, onClose, onAdd, availableLayers }) => {
    const [layer, setLayer] = useState('');
    const [direction, setDirection] = useState('0');
    const [frame, setFrame] = useState('0');

    useEffect(() => {
        if (open && availableLayers.length > 0 && !layer) {
            setLayer(availableLayers[0]);
        }
    }, [open, availableLayers]);

    const handleAdd = () => {
        if (!layer) return;
        onAdd(layer, direction, frame);
        // Reset form
        setDirection('0');
        setFrame('0');
    };

    const handleClose = () => {
        onClose();
        setDirection('0');
        setFrame('0');
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Add New Sprite</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Create a new sprite entry with a placeholder frame. You can replace it later with actual image data.
                </Typography>

                <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                    <InputLabel>Layer</InputLabel>
                    <Select
                        value={layer}
                        onChange={(e) => setLayer(e.target.value)}
                        label="Layer"
                    >
                        {availableLayers.filter(l => l !== 'icon').map(l => (
                            <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Direction</InputLabel>
                    <Select
                        value={direction}
                        onChange={(e) => setDirection(e.target.value)}
                        label="Direction"
                    >
                        <MenuItem value="0">0 (South-East)</MenuItem>
                        <MenuItem value="2">2 (South-West)</MenuItem>
                        <MenuItem value="4">4 (North-West)</MenuItem>
                        <MenuItem value="6">6 (North-East)</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    label="Frame Number"
                    type="number"
                    fullWidth
                    value={frame}
                    onChange={(e) => setFrame(e.target.value)}
                    inputProps={{ min: 0 }}
                    helperText="Usually 0 for static furniture, higher numbers for animations"
                />

                <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(144, 202, 249, 0.05)', borderRadius: 1, border: '1px solid rgba(144, 202, 249, 0.2)' }}>
                    <Typography variant="subtitle2" gutterBottom>Note</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Directions 4 and 6 are automatically mirrored from directions 2 and 0 respectively.
                        The sprite will be created with a 1×1 pixel placeholder that you should replace with actual artwork.
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    variant="contained"
                    disabled={!layer}
                >
                    Add Sprite
                </Button>
            </DialogActions>
        </Dialog>
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
