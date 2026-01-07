import React, { useState, useEffect } from 'react';
import {
    Box, TextField, Checkbox, FormControlLabel,
    Typography, Select, MenuItem, Button, FormControl, Paper, Stack, Divider
} from '@mui/material';
import type { NitroJSON, AvatarTestingState } from '../types';
// @ts-ignore
import { GetSettings, SetDefaultZ } from '../wailsjs/go/main/App';

interface FurnitureSettingsProps {
    jsonContent: NitroJSON;
    onUpdate: (newJson: NitroJSON) => void;
    onRename?: (newName: string) => void;
    avatarTesting?: AvatarTestingState;
    onAvatarTestingChange?: (newState: AvatarTestingState) => void;
}

const FormRow = ({ label, children }: { label?: string, children: React.ReactNode }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ width: '40%', textAlign: 'right', pr: 2 }}>
            {label && <Typography variant="body2">{label}</Typography>}
        </Box>
        <Box sx={{ width: '60%' }}>
            {children}
        </Box>
    </Box>
);

export const FurnitureSettings: React.FC<FurnitureSettingsProps> = ({
    jsonContent,
    onUpdate
}) => {
    // Local state to manage form fields
    const [name, setName] = useState(jsonContent.name || "");
    const [logicType, setLogicType] = useState(jsonContent.logicType || "furniture_multistate");
    const [visualizationType, setVisualizationType] = useState(jsonContent.visualizationType || "furniture_animated");

    // Dimensions
    const [dimX, setDimX] = useState(jsonContent.logic?.model?.dimensions?.x || 1);
    const [dimY, setDimY] = useState(jsonContent.logic?.model?.dimensions?.y || 1);
    const [dimZ, setDimZ] = useState(jsonContent.logic?.model?.dimensions?.z || 1);

    // App-wide conversion settings
    const [defaultZ, setDefaultZState] = useState<number>(1.0);

    // Load app settings on mount
    useEffect(() => {
        GetSettings().then((settings: any) => {
            setDefaultZState(settings.defaultZ || 1.0);
        }).catch((err: any) => {
            console.error('Failed to load app settings:', err);
        });
    }, []);

    const mainViz = jsonContent.visualizations?.find(v => v.size === 64) || jsonContent.visualizations?.[0];

    const getRotationCount = () => {
        if (!mainViz || !mainViz.directions) return 1;
        const dirs = Object.keys(mainViz.directions);
        if (dirs.length <= 1) return 1;
        if (dirs.length <= 2) return 2;
        return 4; // Assumption for now
    };
    const [rotations, setRotations] = useState(getRotationCount());

    const handleUpdate = (field: string, value: any) => {
        const newJson = JSON.parse(JSON.stringify(jsonContent));

        if (field === 'name') {
            newJson.name = value;
            setName(value);
        } else if (field === 'logicType') {
            newJson.logicType = value;
            setLogicType(value);
        } else if (field === 'visualizationType') {
            newJson.visualizationType = value;
            setVisualizationType(value);
        } else if (field === 'dimX') {
            if (!newJson.logic) newJson.logic = { model: { dimensions: { x: 1, y: 1, z: 1 } } };
            newJson.logic.model.dimensions.x = Number(value);
            setDimX(value);
        } else if (field === 'dimY') {
            if (!newJson.logic) newJson.logic = { model: { dimensions: { x: 1, y: 1, z: 1 } } };
            newJson.logic.model.dimensions.y = Number(value);
            setDimY(value);
        } else if (field === 'dimZ') {
            if (!newJson.logic) newJson.logic = { model: { dimensions: { x: 1, y: 1, z: 1 } } };
            newJson.logic.model.dimensions.z = Number(value);
            setDimZ(value);
        } else if (field === 'rotations') {
            setRotations(value);
            if (newJson.visualizations) {
                newJson.visualizations.forEach((v: any) => {
                    if (Number(value) === 1) {
                        v.directions = { "2": {} };
                    } else if (Number(value) === 2) {
                        v.directions = { "2": {}, "4": {} };
                    } else if (Number(value) === 4) {
                        v.directions = { "0": {}, "2": {}, "4": {}, "6": {} };
                    }
                });
            }
        }

        onUpdate(newJson);
    };

    return (
        <Box sx={{ p: 3, height: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Settings for {name}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, borderBottom: '1px solid #444', pb: 1 }}>
                            Furniture data
                        </Typography>

                        <FormRow label="Furniture name">
                            <Box display="flex" gap={1} width="100%">
                                <TextField
                                    fullWidth size="small"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        handleUpdate('name', e.target.value);
                                    }}
                                />
                            </Box>
                        </FormRow>

                        <FormRow label="Rotations">
                            <FormControl fullWidth size="small">
                                <Select
                                    value={rotations}
                                    onChange={(e) => handleUpdate('rotations', e.target.value)}
                                >
                                    <MenuItem value={1}>1</MenuItem>
                                    <MenuItem value={2}>2</MenuItem>
                                    <MenuItem value={4}>4</MenuItem>
                                </Select>
                            </FormControl>
                        </FormRow>

                        <FormRow>
                            <FormControlLabel
                                control={<Checkbox disabled title="Not implemented yet" />}
                                label="Mirrored on rotate"
                            />
                        </FormRow>

                        <FormRow label="Amount of activations">
                            <TextField
                                type="number" fullWidth size="small"
                                inputProps={{ min: 0 }}
                                defaultValue={Object.keys(mainViz?.animations || {}).length}
                                disabled
                                helperText="Modify in animations tab"
                            />
                        </FormRow>

                        <FormRow label="Amount of icon images">
                            <TextField
                                type="number" fullWidth size="small"
                                defaultValue={1}
                                disabled
                            />
                        </FormRow>

                        <FormRow>
                            <FormControlLabel
                                control={<Checkbox checked={!!jsonContent.assets?.[`${name}_64_sd_0_0`] || !!jsonContent.assets?.[`${name}_64_sd_2_0`]} disabled />}
                                label="Shadow"
                            />
                        </FormRow>

                        <FormRow label="Public">
                            <FormControl fullWidth size="small">
                                <Select value={0} disabled>
                                    <MenuItem value={0}>Private</MenuItem>
                                    <MenuItem value={1}>Public (profile only)</MenuItem>
                                    <MenuItem value={2}>Public page</MenuItem>
                                </Select>
                            </FormControl>
                        </FormRow>

                        <FormRow label="Length (X)">
                            <TextField
                                type="number" fullWidth size="small"
                                value={dimX}
                                onChange={(e) => handleUpdate('dimX', e.target.value)}
                            />
                        </FormRow>

                        <FormRow label="Width (Y)">
                            <TextField
                                type="number" fullWidth size="small"
                                value={dimY}
                                onChange={(e) => handleUpdate('dimY', e.target.value)}
                            />
                        </FormRow>

                        <FormRow label="Height (Z)">
                            <TextField
                                type="number" fullWidth size="small"
                                inputProps={{ step: 0.01 }}
                                value={dimZ}
                                onChange={(e) => handleUpdate('dimZ', e.target.value)}
                            />
                        </FormRow>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" color="warning.main">
                                Only change the following values if you know what you're doing
                            </Typography>
                        </Box>

                        <FormRow label="Visualization">
                            <FormControl fullWidth size="small">
                                <Select
                                    value={visualizationType}
                                    onChange={(e) => handleUpdate('visualizationType', e.target.value)}
                                >
                                    <MenuItem value="furniture_static">furniture_static</MenuItem>
                                    <MenuItem value="furniture_animated">furniture_animated</MenuItem>
                                    <MenuItem value="furniture_guild_customized">furniture_guild_customized</MenuItem>
                                    <MenuItem value="furniture_badge_display">furniture_badge_display</MenuItem>
                                    <MenuItem value="furniture_soundblock">furniture_soundblock</MenuItem>
                                </Select>
                            </FormControl>
                        </FormRow>

                        <FormRow label="Logic">
                            <TextField
                                fullWidth size="small"
                                value={logicType}
                                onChange={(e) => handleUpdate('logicType', e.target.value)}
                            />
                        </FormRow>
                    </Box>

                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, borderBottom: '1px solid #444', pb: 1 }}>
                            Animations
                        </Typography>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Animation editing is complex and partially supported in the "Preview" and "Code" tabs.
                                Full animation builder coming soon.
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={2}>
                            <Button variant="contained" color="success" disabled>+ Add layer</Button>
                            <Button variant="contained" color="error" disabled>- Remove layer</Button>
                        </Stack>
                    </Box>
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* Global Conversion Settings */}
                <Box>
                    <Typography variant="h6" gutterBottom>
                        Global Conversion Settings
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        These settings apply to all SWF to Nitro conversions. They are used as defaults when the SWF file doesn't specify values.
                    </Typography>

                    <FormRow label="Default Z Height">
                        <Box display="flex" gap={1} alignItems="center">
                            <TextField
                                type="number"
                                size="small"
                                inputProps={{ step: 0.1, min: 0 }}
                                value={defaultZ}
                                onChange={async (e) => {
                                    const newValue = parseFloat(e.target.value) || 0;
                                    setDefaultZState(newValue);
                                    try {
                                        await SetDefaultZ(newValue);
                                    } catch (err) {
                                        console.error('Failed to save default Z:', err);
                                    }
                                }}
                                sx={{ width: '120px' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Used when converting SWF files with Z=0 or missing Z dimension
                            </Typography>
                        </Box>
                    </FormRow>
                </Box>
            </Paper>
        </Box>
    );
};
