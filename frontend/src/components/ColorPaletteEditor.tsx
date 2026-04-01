import React, { useState, useCallback } from 'react';
import {
    Box, Typography, TextField, Button, IconButton, Tooltip,
    Card, CardContent, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { NitroJSON, NitroColor } from '../types';

interface ColorPaletteEditorProps {
    jsonContent: NitroJSON;
    vizIndex: number;
    onUpdate: (newJson: NitroJSON) => void;
}

/** Convert a decimal color number (e.g. 16737894) to a hex string (#FF6666) */
const colorToHex = (color: number): string => {
    const hex = (color & 0xFFFFFF).toString(16).padStart(6, '0');
    return `#${hex}`;
};

/** Convert a hex string (#FF6666) to a decimal color number */
const hexToColor = (hex: string): number => {
    return parseInt(hex.replace('#', ''), 16) || 0;
};

export const ColorPaletteEditor: React.FC<ColorPaletteEditorProps> = ({ jsonContent, vizIndex, onUpdate }) => {
    const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);

    const viz = jsonContent.visualizations?.[vizIndex];
    const colors: Record<string, NitroColor> = viz?.colors || {};
    const paletteIds = Object.keys(colors).sort((a, b) => parseInt(a) - parseInt(b));

    const updateColor = useCallback((paletteId: string, layerId: string, color: number) => {
        const newJson = { ...jsonContent };
        const v = newJson.visualizations?.[vizIndex];
        if (!v) return;
        if (!v.colors) v.colors = {};
        if (!v.colors[paletteId]) v.colors[paletteId] = { layers: {} };
        v.colors[paletteId].layers[layerId] = { color };
        onUpdate(newJson);
    }, [jsonContent, vizIndex, onUpdate]);

    const addPalette = useCallback(() => {
        const newJson = { ...jsonContent };
        const v = newJson.visualizations?.[vizIndex];
        if (!v) return;
        if (!v.colors) v.colors = {};

        // Find next available ID
        let nextId = 0;
        const existingIds = Object.keys(v.colors).map(Number);
        while (existingIds.includes(nextId)) nextId++;
        const newId = nextId.toString();

        // Create palette with one layer entry per existing layer
        const layers: Record<string, { color: number }> = {};
        const layerIds = Object.keys(v.layers || {});
        if (layerIds.length > 0) {
            // Default to white (no tint)
            layerIds.forEach(lid => {
                layers[lid] = { color: 16777215 };
            });
        } else {
            layers['0'] = { color: 16777215 };
        }

        v.colors[newId] = { layers };
        onUpdate(newJson);
        setSelectedPaletteId(newId);
    }, [jsonContent, vizIndex, onUpdate]);

    const deletePalette = useCallback((paletteId: string) => {
        const newJson = { ...jsonContent };
        const v = newJson.visualizations?.[vizIndex];
        if (!v?.colors) return;
        delete v.colors[paletteId];
        if (Object.keys(v.colors).length === 0) {
            delete v.colors;
        }
        onUpdate(newJson);
        if (selectedPaletteId === paletteId) {
            setSelectedPaletteId(null);
        }
    }, [jsonContent, vizIndex, onUpdate, selectedPaletteId]);

    const duplicatePalette = useCallback((paletteId: string) => {
        const newJson = { ...jsonContent };
        const v = newJson.visualizations?.[vizIndex];
        if (!v?.colors?.[paletteId]) return;

        let nextId = 0;
        const existingIds = Object.keys(v.colors).map(Number);
        while (existingIds.includes(nextId)) nextId++;
        const newId = nextId.toString();

        // Deep copy the palette
        v.colors[newId] = JSON.parse(JSON.stringify(v.colors[paletteId]));
        onUpdate(newJson);
        setSelectedPaletteId(newId);
    }, [jsonContent, vizIndex, onUpdate]);

    const addLayerTopalette = useCallback((paletteId: string) => {
        const newJson = { ...jsonContent };
        const v = newJson.visualizations?.[vizIndex];
        if (!v?.colors?.[paletteId]) return;

        const existing = Object.keys(v.colors[paletteId].layers).map(Number);
        let nextId = 0;
        while (existing.includes(nextId)) nextId++;

        v.colors[paletteId].layers[nextId.toString()] = { color: 16777215 };
        onUpdate(newJson);
    }, [jsonContent, vizIndex, onUpdate]);

    const deleteLayerFromPalette = useCallback((paletteId: string, layerId: string) => {
        const newJson = { ...jsonContent };
        const v = newJson.visualizations?.[vizIndex];
        if (!v?.colors?.[paletteId]) return;

        delete v.colors[paletteId].layers[layerId];
        onUpdate(newJson);
    }, [jsonContent, vizIndex, onUpdate]);

    const selectedPalette = selectedPaletteId !== null ? colors[selectedPaletteId] : null;

    return (
        <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Color Palettes
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addPalette}
                >
                    Add Palette
                </Button>
            </Box>

            {paletteIds.length === 0 ? (
                <Box sx={{ p: 2, bgcolor: 'rgba(144, 202, 249, 0.05)', borderRadius: 1, border: '1px solid rgba(144, 202, 249, 0.2)' }}>
                    <Typography variant="body2" color="text.secondary">
                        No color palettes defined. Color palettes apply tint colors to layers, allowing furniture to have multiple color variants.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Click "Add Palette" to create one, or remove existing palettes if your sprites are already the desired color.
                    </Typography>
                </Box>
            ) : (
                <>
                    {/* Palette selector cards */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {paletteIds.map(pid => {
                            const palette = colors[pid];
                            const layerEntries = Object.entries(palette.layers || {});
                            const isSelected = selectedPaletteId === pid;

                            return (
                                <Card
                                    key={pid}
                                    sx={{
                                        minWidth: 120,
                                        cursor: 'pointer',
                                        border: isSelected ? '2px solid #90caf9' : '1px solid #444',
                                        bgcolor: isSelected ? 'rgba(144, 202, 249, 0.08)' : '#2b3a52',
                                        transition: 'all 0.2s',
                                    }}
                                    onClick={() => setSelectedPaletteId(pid)}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#90caf9' }}>
                                                Palette {pid}
                                            </Typography>
                                            <Box>
                                                <Tooltip title="Duplicate">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => { e.stopPropagation(); duplicatePalette(pid); }}
                                                        sx={{ color: '#aaa', p: 0.5 }}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => { e.stopPropagation(); deletePalette(pid); }}
                                                        sx={{ color: '#f48fb1', p: 0.5 }}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                        {/* Color swatches preview */}
                                        <Box display="flex" gap={0.5} mt={1}>
                                            {layerEntries.map(([lid, lc]) => (
                                                <Tooltip key={lid} title={`Layer ${lid}: ${colorToHex(lc.color)}`}>
                                                    <Box
                                                        sx={{
                                                            width: 20,
                                                            height: 20,
                                                            borderRadius: '4px',
                                                            bgcolor: colorToHex(lc.color),
                                                            border: '1px solid rgba(255,255,255,0.3)',
                                                        }}
                                                    />
                                                </Tooltip>
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Box>

                    <Divider sx={{ mb: 2, borderColor: '#444' }} />

                    {/* Selected palette editor */}
                    {selectedPalette && selectedPaletteId !== null ? (
                        <Box>
                            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                                <Typography variant="subtitle2">
                                    Editing Palette {selectedPaletteId}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => addLayerTopalette(selectedPaletteId)}
                                >
                                    Add Layer Color
                                </Button>
                            </Box>

                            {Object.entries(selectedPalette.layers || {})
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([layerId, layerColor]) => (
                                    <Box
                                        key={layerId}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            mb: 1.5,
                                            p: 1.5,
                                            bgcolor: '#2b3a52',
                                            borderRadius: 1,
                                            border: '1px solid #444',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{ minWidth: 60, color: '#90caf9', fontWeight: 'bold' }}>
                                            Layer {layerId}
                                        </Typography>

                                        {/* Color picker */}
                                        <Tooltip title="Click to pick a color">
                                            <Box
                                                component="input"
                                                type="color"
                                                value={colorToHex(layerColor.color)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    updateColor(selectedPaletteId, layerId, hexToColor(e.target.value));
                                                }}
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    border: '2px solid #555',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    bgcolor: 'transparent',
                                                    padding: '2px',
                                                    '&::-webkit-color-swatch-wrapper': { padding: 0 },
                                                    '&::-webkit-color-swatch': { borderRadius: '4px', border: 'none' },
                                                }}
                                            />
                                        </Tooltip>

                                        {/* Hex input */}
                                        <TextField
                                            size="small"
                                            label="Hex"
                                            value={colorToHex(layerColor.color)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                                                    updateColor(selectedPaletteId, layerId, hexToColor(val));
                                                }
                                            }}
                                            sx={{ width: 120 }}
                                            inputProps={{ style: { fontFamily: 'monospace' } }}
                                        />

                                        {/* Decimal value */}
                                        <TextField
                                            size="small"
                                            label="Decimal"
                                            type="number"
                                            value={layerColor.color}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val >= 0 && val <= 16777215) {
                                                    updateColor(selectedPaletteId, layerId, val);
                                                }
                                            }}
                                            sx={{ width: 140 }}
                                        />

                                        <Tooltip title="Remove layer color">
                                            <IconButton
                                                size="small"
                                                onClick={() => deleteLayerFromPalette(selectedPaletteId, layerId)}
                                                sx={{ color: '#f48fb1' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                ))}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Select a palette above to edit its colors.
                        </Typography>
                    )}
                </>
            )}

            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(144, 202, 249, 0.05)', borderRadius: 1, border: '1px solid rgba(144, 202, 249, 0.2)' }}>
                <Typography variant="subtitle2" gutterBottom>About Color Palettes</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Color palettes define tint colors applied to specific layers. Each palette represents a selectable color variant for the furniture.
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    <strong>Palette ID:</strong> The color state index. Palette 0 is typically the default color shown in-game.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    <strong>Layer colors:</strong> Each entry maps a layer index to a tint color. The color is multiplied with the sprite pixels. Use white (#FFFFFF) for no tint, or remove the palette entirely if your sprites are already the final color.
                </Typography>
            </Box>
        </Box>
    );
};
