import React, { useState } from 'react';
import {
    Box, Typography, TextField,
    Card, CardContent, Select, MenuItem, FormControl, InputLabel,
    FormControlLabel, Switch, Button, Tooltip, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { NitroJSON, NitroVisualization, NitroLayer } from '../types';

interface LayersEditorProps {
    jsonContent: NitroJSON;
    onUpdate: (newJson: NitroJSON) => void;
}

export const LayersEditor: React.FC<LayersEditorProps> = ({ jsonContent, onUpdate }) => {
    const [selectedVisualizationIndex, setSelectedVisualizationIndex] = useState(0);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    const visualizations = jsonContent.visualizations || [];

    const updateViz = (vizIndex: number, field: keyof NitroVisualization, value: any) => {
        const newJson = { ...jsonContent };
        if (newJson.visualizations && newJson.visualizations[vizIndex]) {
            // @ts-ignore
            newJson.visualizations[vizIndex][field] = value;
            onUpdate(newJson);
        }
    };

    const updateLayer = (vizIndex: number, layerId: string, field: keyof NitroLayer, value: any) => {
        const newJson = { ...jsonContent };
        if (newJson.visualizations && newJson.visualizations[vizIndex]) {
            const viz = newJson.visualizations[vizIndex];
            if (!viz.layers) viz.layers = {};
            if (!viz.layers[layerId]) viz.layers[layerId] = {};

            // @ts-ignore
            viz.layers[layerId][field] = value;
            onUpdate(newJson);
        }
    };

    const addLayer = (vizIndex: number) => {
        const viz = visualizations[vizIndex];
        if (!viz) return;

        const layers = viz.layers || {};
        const layerIds = Object.keys(layers);

        // Find next available layer ID
        let newLayerId = '0';
        let counter = 0;
        while (layerIds.includes(counter.toString())) {
            counter++;
        }
        newLayerId = counter.toString();

        const newJson = { ...jsonContent };
        if (newJson.visualizations && newJson.visualizations[vizIndex]) {
            const vizToUpdate = newJson.visualizations[vizIndex];
            if (!vizToUpdate.layers) vizToUpdate.layers = {};

            vizToUpdate.layers[newLayerId] = {
                z: 0,
                alpha: 255,
                ink: undefined,
                ignoreMouse: false,
                tag: undefined
            };

            // Update layer count
            vizToUpdate.layerCount = Object.keys(vizToUpdate.layers).length;

            onUpdate(newJson);
            setSelectedLayerId(newLayerId);
        }
    };

    const deleteLayer = (vizIndex: number, layerId: string) => {
        const newJson = { ...jsonContent };
        if (newJson.visualizations && newJson.visualizations[vizIndex]) {
            const viz = newJson.visualizations[vizIndex];
            if (viz.layers && viz.layers[layerId]) {
                delete viz.layers[layerId];

                // Update layer count
                viz.layerCount = Object.keys(viz.layers).length;

                onUpdate(newJson);

                if (selectedLayerId === layerId) {
                    setSelectedLayerId(null);
                }
            }
        }
    };

    if (visualizations.length === 0) {
        return (
            <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                <Typography color="text.secondary">No visualizations defined in this furniture.</Typography>
            </Box>
        );
    }

    const currentViz = visualizations[selectedVisualizationIndex];
    const layers = currentViz?.layers || {};
    const layerIds = Object.keys(layers).sort((a, b) => {
        // Sort by z-index if available, otherwise by layer ID
        const aZ = layers[a]?.z ?? 0;
        const bZ = layers[b]?.z ?? 0;
        return bZ - aZ; // Descending order (highest z-index first)
    });

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left Column: Layer List */}
            <Box sx={{ width: '45%', minWidth: 400, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', bgcolor: '#233044' }}>
                {/* Header */}
                <Box p={2} borderBottom="1px solid #444" bgcolor="#1b2636">
                    <Typography variant="h6" gutterBottom>Layers Editor</Typography>

                    {/* Visualization Selector */}
                    {visualizations.length > 1 && (
                        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                            <InputLabel>Visualization</InputLabel>
                            <Select
                                value={selectedVisualizationIndex}
                                label="Visualization"
                                onChange={(e) => {
                                    setSelectedVisualizationIndex(Number(e.target.value));
                                    setSelectedLayerId(null);
                                }}
                            >
                                {visualizations.map((viz, index) => (
                                    <MenuItem key={index} value={index}>
                                        Viz {index + 1} (Size: {viz.size}, Angle: {viz.angle})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Box display="flex" gap={2} mt={2}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => addLayer(selectedVisualizationIndex)}
                            fullWidth
                        >
                            Add Layer
                        </Button>
                    </Box>
                </Box>

                {/* Layer List */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                    {layerIds.length === 0 ? (
                        <Typography color="text.secondary" variant="body2">
                            No layers defined. Click "Add Layer" to create one.
                        </Typography>
                    ) : (
                        layerIds.map(layerId => {
                            const layer = layers[layerId];
                            const isSelected = selectedLayerId === layerId;

                            return (
                                <Card
                                    key={layerId}
                                    sx={{
                                        mb: 1.5,
                                        border: isSelected ? '2px solid #90caf9' : '1px solid #444',
                                        bgcolor: isSelected ? 'rgba(144, 202, 249, 0.08)' : '#2b3a52',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setSelectedLayerId(layerId)}
                                >
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#90caf9' }}>
                                                Layer {layerId}
                                            </Typography>
                                            <Tooltip title="Delete Layer">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteLayer(selectedVisualizationIndex, layerId);
                                                    }}
                                                    sx={{ color: '#f48fb1' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>

                                        {/* Z-Index */}
                                        <TextField
                                            label="Z-Index"
                                            type="number"
                                            size="small"
                                            fullWidth
                                            value={layer.z ?? 0}
                                            onChange={(e) => updateLayer(selectedVisualizationIndex, layerId, 'z', parseInt(e.target.value) || 0)}
                                            onClick={(e) => e.stopPropagation()}
                                            sx={{ mb: 1.5 }}
                                            helperText="Stacking order (higher = on top)"
                                        />

                                        {/* Alpha */}
                                        <TextField
                                            label="Alpha (Visibility)"
                                            type="number"
                                            size="small"
                                            fullWidth
                                            value={layer.alpha ?? 255}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                updateLayer(selectedVisualizationIndex, layerId, 'alpha', Math.min(255, Math.max(0, val)));
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            inputProps={{ min: 0, max: 255 }}
                                            sx={{ mb: 1.5 }}
                                            helperText="0 = Invisible, 255 = Fully visible"
                                        />

                                        {/* Ink (Blend Mode) */}
                                        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                                            <InputLabel>Ink (Blend Mode)</InputLabel>
                                            <Select
                                                value={layer.ink || 'None'}
                                                label="Ink (Blend Mode)"
                                                onChange={(e) => {
                                                    const val = e.target.value === 'None' ? undefined : e.target.value;
                                                    updateLayer(selectedVisualizationIndex, layerId, 'ink', val);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MenuItem value="None">None</MenuItem>
                                                <MenuItem value="ADD">ADD (Additive Blend)</MenuItem>
                                                <MenuItem value="COPY">COPY (Normal)</MenuItem>
                                            </Select>
                                        </FormControl>

                                        {/* Tag */}
                                        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                                            <InputLabel>Tag (Color/Badge)</InputLabel>
                                            <Select
                                                value={layer.tag || 'None'}
                                                label="Tag (Color/Badge)"
                                                onChange={(e) => {
                                                    const val = e.target.value === 'None' ? undefined : e.target.value;
                                                    updateLayer(selectedVisualizationIndex, layerId, 'tag', val);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MenuItem value="None">None</MenuItem>
                                                <MenuItem value="COLOR1">COLOR1</MenuItem>
                                                <MenuItem value="COLOR2">COLOR2</MenuItem>
                                                <MenuItem value="BADGE">BADGE</MenuItem>
                                            </Select>
                                        </FormControl>

                                        {/* Ignore Mouse Clicks */}
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={layer.ignoreMouse ?? false}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        updateLayer(selectedVisualizationIndex, layerId, 'ignoreMouse', e.target.checked);
                                                    }}
                                                />
                                            }
                                            label={<Typography variant="body2">Ignore Mouse Clicks</Typography>}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </Box>
            </Box>

            {/* Right Column: Info & Visualization Settings */}
            <Box sx={{ flexGrow: 1, bgcolor: '#1b2636', p: 3, overflowY: 'auto' }}>
                <Typography variant="h6" gutterBottom>Visualization Settings</Typography>

                <Box sx={{ maxWidth: 600 }}>
                    <Box display="flex" gap={2} mb={3}>
                        <TextField
                            label="Size"
                            type="number"
                            size="small"
                            value={currentViz.size}
                            onChange={(e) => updateViz(selectedVisualizationIndex, 'size', parseInt(e.target.value) || 0)}
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="Angle"
                            type="number"
                            size="small"
                            value={currentViz.angle}
                            onChange={(e) => updateViz(selectedVisualizationIndex, 'angle', parseInt(e.target.value) || 0)}
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="Layer Count"
                            type="number"
                            size="small"
                            value={currentViz.layerCount}
                            onChange={(e) => updateViz(selectedVisualizationIndex, 'layerCount', parseInt(e.target.value) || 0)}
                            sx={{ flex: 1 }}
                            disabled
                            helperText="Auto-calculated"
                        />
                    </Box>

                    <Box sx={{ bgcolor: '#233044', p: 2, borderRadius: 1, border: '1px solid #444' }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">
                            Layer Overview
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Total Layers: {layerIds.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                            Animations: {Object.keys(currentViz.animations || {}).length} defined
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                            Directions: {Object.keys(currentViz.directions || {}).length} defined
                        </Typography>
                    </Box>

                    <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(144, 202, 249, 0.05)', borderRadius: 1, border: '1px solid rgba(144, 202, 249, 0.2)' }}>
                        <Typography variant="subtitle2" gutterBottom>About Layers</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            <strong>Z-Index:</strong> Controls the stacking order. Higher values appear on top.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            <strong>Alpha:</strong> Transparency (0-255). 0 is invisible, 255 is fully visible.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            <strong>Ink:</strong> Blend mode for rendering. ADD creates additive blending, COPY is normal rendering.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            <strong>Tag:</strong> COLOR1/COLOR2 allow users to customize furniture colors. BADGE shows guild badges.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            <strong>Ignore Mouse:</strong> When enabled, clicks pass through this layer.
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
