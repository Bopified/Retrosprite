import React, { useState } from 'react';
import {
    Box, Typography, TextField, Switch, FormControlLabel, IconButton, Button,
    Accordion, AccordionSummary, AccordionDetails,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { EffectAnimation, EffectAnimationFramePart } from '../types';

interface EffectEditorProps {
    animation: EffectAnimation | null;
    onUpdate: (animation: EffectAnimation) => void;
}

export const EffectEditor: React.FC<EffectEditorProps> = ({ animation, onUpdate }) => {
    const [expanded, setExpanded] = useState<string | false>('general');

    if (!animation) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <Typography>No effect animation data loaded</Typography>
            </Box>
        );
    }

    const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    const update = (partial: Partial<EffectAnimation>) => {
        onUpdate({ ...animation, ...partial });
    };

    return (
        <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Effect Animation Editor</Typography>

            {/* General Settings */}
            <Accordion expanded={expanded === 'general'} onChange={handleChange('general')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>General</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Name"
                            size="small"
                            value={animation.name || ''}
                            onChange={(e) => update({ name: e.target.value })}
                        />
                        <TextField
                            label="Description"
                            size="small"
                            value={animation.desc || ''}
                            onChange={(e) => update({ desc: e.target.value })}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={animation.resetOnToggle || false}
                                    onChange={(e) => update({ resetOnToggle: e.target.checked })}
                                />
                            }
                            label="Reset On Toggle"
                        />
                    </Box>
                </AccordionDetails>
            </Accordion>

            {/* Direction Offsets */}
            <Accordion expanded={expanded === 'directions'} onChange={handleChange('directions')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Directions
                        <Chip label={animation.directions?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Box>
                        {animation.directions?.map((dir, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <TextField
                                    label="Offset"
                                    type="number"
                                    size="small"
                                    value={dir.offset}
                                    onChange={(e) => {
                                        const dirs = [...(animation.directions || [])];
                                        dirs[i] = { offset: parseInt(e.target.value) || 0 };
                                        update({ directions: dirs });
                                    }}
                                    sx={{ width: 120 }}
                                />
                                <IconButton size="small" color="error" onClick={() => {
                                    const dirs = (animation.directions || []).filter((_, idx) => idx !== i);
                                    update({ directions: dirs });
                                }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}
                        <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => update({ directions: [...(animation.directions || []), { offset: 0 }] })}
                        >
                            Add Direction
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            {/* Sprites */}
            <Accordion expanded={expanded === 'sprites'} onChange={handleChange('sprites')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Sprites
                        <Chip label={animation.sprites?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Member</TableCell>
                                    <TableCell>Directions</TableCell>
                                    <TableCell>Ink</TableCell>
                                    <TableCell>StaticY</TableCell>
                                    <TableCell width={40}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {animation.sprites?.map((sprite, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                variant="standard"
                                                value={sprite.id || ''}
                                                onChange={(e) => {
                                                    const sprites = [...(animation.sprites || [])];
                                                    sprites[i] = { ...sprites[i], id: e.target.value };
                                                    update({ sprites });
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                variant="standard"
                                                value={sprite.member || ''}
                                                onChange={(e) => {
                                                    const sprites = [...(animation.sprites || [])];
                                                    sprites[i] = { ...sprites[i], member: e.target.value };
                                                    update({ sprites });
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                variant="standard"
                                                type="number"
                                                value={sprite.directions || 0}
                                                onChange={(e) => {
                                                    const sprites = [...(animation.sprites || [])];
                                                    sprites[i] = { ...sprites[i], directions: parseInt(e.target.value) || 0 };
                                                    update({ sprites });
                                                }}
                                                sx={{ width: 60 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                variant="standard"
                                                type="number"
                                                value={sprite.ink || 0}
                                                onChange={(e) => {
                                                    const sprites = [...(animation.sprites || [])];
                                                    sprites[i] = { ...sprites[i], ink: parseInt(e.target.value) || 0 };
                                                    update({ sprites });
                                                }}
                                                sx={{ width: 60 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                variant="standard"
                                                type="number"
                                                value={sprite.staticY || 0}
                                                onChange={(e) => {
                                                    const sprites = [...(animation.sprites || [])];
                                                    sprites[i] = { ...sprites[i], staticY: parseInt(e.target.value) || 0 };
                                                    update({ sprites });
                                                }}
                                                sx={{ width: 60 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => {
                                                const sprites = (animation.sprites || []).filter((_, idx) => idx !== i);
                                                update({ sprites });
                                            }}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ mt: 1 }}
                        onClick={() => update({
                            sprites: [...(animation.sprites || []), { id: '', member: '', directions: 0 }]
                        })}
                    >
                        Add Sprite
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Adds */}
            <Accordion expanded={expanded === 'adds'} onChange={handleChange('adds')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Adds
                        <Chip label={animation.adds?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Align</TableCell>
                                    <TableCell>Blend</TableCell>
                                    <TableCell>Ink</TableCell>
                                    <TableCell>Base</TableCell>
                                    <TableCell width={40}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {animation.adds?.map((add, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <TextField size="small" variant="standard" value={add.id} onChange={(e) => {
                                                const adds = [...(animation.adds || [])];
                                                adds[i] = { ...adds[i], id: e.target.value };
                                                update({ adds });
                                            }} />
                                        </TableCell>
                                        <TableCell>
                                            <TextField size="small" variant="standard" value={add.align || ''} onChange={(e) => {
                                                const adds = [...(animation.adds || [])];
                                                adds[i] = { ...adds[i], align: e.target.value };
                                                update({ adds });
                                            }} />
                                        </TableCell>
                                        <TableCell>
                                            <TextField size="small" variant="standard" value={add.blend || ''} onChange={(e) => {
                                                const adds = [...(animation.adds || [])];
                                                adds[i] = { ...adds[i], blend: e.target.value };
                                                update({ adds });
                                            }} />
                                        </TableCell>
                                        <TableCell>
                                            <TextField size="small" variant="standard" type="number" value={add.ink || 0} onChange={(e) => {
                                                const adds = [...(animation.adds || [])];
                                                adds[i] = { ...adds[i], ink: parseInt(e.target.value) || 0 };
                                                update({ adds });
                                            }} sx={{ width: 60 }} />
                                        </TableCell>
                                        <TableCell>
                                            <TextField size="small" variant="standard" value={add.base || ''} onChange={(e) => {
                                                const adds = [...(animation.adds || [])];
                                                adds[i] = { ...adds[i], base: e.target.value };
                                                update({ adds });
                                            }} />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => {
                                                update({ adds: (animation.adds || []).filter((_, idx) => idx !== i) });
                                            }}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() =>
                        update({ adds: [...(animation.adds || []), { id: '', align: '', ink: 0 }] })
                    }>
                        Add Entry
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Shadows */}
            <Accordion expanded={expanded === 'shadows'} onChange={handleChange('shadows')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Shadows
                        <Chip label={animation.shadows?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {animation.shadows?.map((shadow, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <TextField
                                label="ID"
                                size="small"
                                value={shadow.id}
                                onChange={(e) => {
                                    const shadows = [...(animation.shadows || [])];
                                    shadows[i] = { id: e.target.value };
                                    update({ shadows });
                                }}
                            />
                            <IconButton size="small" color="error" onClick={() => {
                                update({ shadows: (animation.shadows || []).filter((_, idx) => idx !== i) });
                            }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() =>
                        update({ shadows: [...(animation.shadows || []), { id: '' }] })
                    }>
                        Add Shadow
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Removes */}
            <Accordion expanded={expanded === 'removes'} onChange={handleChange('removes')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Removes
                        <Chip label={animation.removes?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {animation.removes?.map((remove, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <TextField
                                label="ID"
                                size="small"
                                value={remove.id}
                                onChange={(e) => {
                                    const removes = [...(animation.removes || [])];
                                    removes[i] = { id: e.target.value };
                                    update({ removes });
                                }}
                            />
                            <IconButton size="small" color="error" onClick={() => {
                                update({ removes: (animation.removes || []).filter((_, idx) => idx !== i) });
                            }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() =>
                        update({ removes: [...(animation.removes || []), { id: '' }] })
                    }>
                        Add Remove
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Frames */}
            <Accordion expanded={expanded === 'frames'} onChange={handleChange('frames')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Frames
                        <Chip label={animation.frames?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {animation.frames?.map((frame, fi) => (
                        <Paper key={fi} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="subtitle2">Frame {fi}</Typography>
                                <TextField
                                    label="Repeats"
                                    type="number"
                                    size="small"
                                    value={frame.repeats || 0}
                                    onChange={(e) => {
                                        const frames = [...(animation.frames || [])];
                                        frames[fi] = { ...frames[fi], repeats: parseInt(e.target.value) || 0 };
                                        update({ frames });
                                    }}
                                    sx={{ width: 100 }}
                                />
                                <Box sx={{ flexGrow: 1 }} />
                                <IconButton size="small" color="error" onClick={() => {
                                    update({ frames: (animation.frames || []).filter((_, idx) => idx !== fi) });
                                }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>

                            {/* FX Parts */}
                            {frame.fxs && frame.fxs.length > 0 && (
                                <Box sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary">FX Parts</Typography>
                                    {frame.fxs.map((fx, pi) => (
                                        <FramePartRow
                                            key={pi}
                                            part={fx}
                                            onChange={(updated) => {
                                                const frames = [...(animation.frames || [])];
                                                const fxs = [...(frames[fi].fxs || [])];
                                                fxs[pi] = updated;
                                                frames[fi] = { ...frames[fi], fxs };
                                                update({ frames });
                                            }}
                                            onDelete={() => {
                                                const frames = [...(animation.frames || [])];
                                                frames[fi] = { ...frames[fi], fxs: (frames[fi].fxs || []).filter((_, idx) => idx !== pi) };
                                                update({ frames });
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}

                            {/* Body Parts */}
                            {frame.bodyparts && frame.bodyparts.length > 0 && (
                                <Box sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary">Body Parts</Typography>
                                    {frame.bodyparts.map((bp, pi) => (
                                        <FramePartRow
                                            key={pi}
                                            part={bp}
                                            onChange={(updated) => {
                                                const frames = [...(animation.frames || [])];
                                                const bodyparts = [...(frames[fi].bodyparts || [])];
                                                bodyparts[pi] = updated;
                                                frames[fi] = { ...frames[fi], bodyparts };
                                                update({ frames });
                                            }}
                                            onDelete={() => {
                                                const frames = [...(animation.frames || [])];
                                                frames[fi] = { ...frames[fi], bodyparts: (frames[fi].bodyparts || []).filter((_, idx) => idx !== pi) };
                                                update({ frames });
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                                <Button size="small" variant="text" onClick={() => {
                                    const frames = [...(animation.frames || [])];
                                    frames[fi] = { ...frames[fi], fxs: [...(frames[fi].fxs || []), { id: '', frame: 0 }] };
                                    update({ frames });
                                }}>
                                    + FX Part
                                </Button>
                                <Button size="small" variant="text" onClick={() => {
                                    const frames = [...(animation.frames || [])];
                                    frames[fi] = { ...frames[fi], bodyparts: [...(frames[fi].bodyparts || []), { id: '', frame: 0 }] };
                                    update({ frames });
                                }}>
                                    + Body Part
                                </Button>
                            </Box>
                        </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() =>
                        update({ frames: [...(animation.frames || []), { repeats: 1, fxs: [], bodyparts: [] }] })
                    }>
                        Add Frame
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Avatars */}
            <Accordion expanded={expanded === 'avatars'} onChange={handleChange('avatars')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Avatars
                        <Chip label={animation.avatars?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {animation.avatars?.map((avatar, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <TextField label="Background" size="small" value={avatar.background || ''} onChange={(e) => {
                                const avatars = [...(animation.avatars || [])];
                                avatars[i] = { ...avatars[i], background: e.target.value };
                                update({ avatars });
                            }} />
                            <TextField label="Foreground" size="small" value={avatar.foreground || ''} onChange={(e) => {
                                const avatars = [...(animation.avatars || [])];
                                avatars[i] = { ...avatars[i], foreground: e.target.value };
                                update({ avatars });
                            }} />
                            <TextField label="Ink" type="number" size="small" value={avatar.ink || 0} onChange={(e) => {
                                const avatars = [...(animation.avatars || [])];
                                avatars[i] = { ...avatars[i], ink: parseInt(e.target.value) || 0 };
                                update({ avatars });
                            }} sx={{ width: 80 }} />
                            <IconButton size="small" color="error" onClick={() => {
                                update({ avatars: (animation.avatars || []).filter((_, idx) => idx !== i) });
                            }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() =>
                        update({ avatars: [...(animation.avatars || []), { background: '', foreground: '' }] })
                    }>
                        Add Avatar
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Overrides */}
            <Accordion expanded={expanded === 'overrides'} onChange={handleChange('overrides')}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                        Overrides
                        <Chip label={animation.overrides?.length || 0} size="small" sx={{ ml: 1 }} />
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    {animation.overrides?.map((override, i) => (
                        <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <TextField label="Name" size="small" value={override.name || ''} onChange={(e) => {
                                    const overrides = [...(animation.overrides || [])];
                                    overrides[i] = { ...overrides[i], name: e.target.value };
                                    update({ overrides });
                                }} />
                                <TextField label="Override" size="small" value={override.override || ''} onChange={(e) => {
                                    const overrides = [...(animation.overrides || [])];
                                    overrides[i] = { ...overrides[i], override: e.target.value };
                                    update({ overrides });
                                }} />
                                <IconButton size="small" color="error" onClick={() => {
                                    update({ overrides: (animation.overrides || []).filter((_, idx) => idx !== i) });
                                }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {override.frames?.length || 0} frames
                            </Typography>
                        </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() =>
                        update({ overrides: [...(animation.overrides || []), { name: '', override: '', frames: [] }] })
                    }>
                        Add Override
                    </Button>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
};

// Sub-component for frame parts (FX and Body Parts)
const FramePartRow: React.FC<{
    part: EffectAnimationFramePart;
    onChange: (updated: EffectAnimationFramePart) => void;
    onDelete: () => void;
}> = ({ part, onChange, onDelete }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
        <TextField label="id" size="small" variant="standard" value={part.id || ''} onChange={(e) => onChange({ ...part, id: e.target.value })} sx={{ width: 70 }} />
        <TextField label="frame" size="small" variant="standard" type="number" value={part.frame || 0} onChange={(e) => onChange({ ...part, frame: parseInt(e.target.value) || 0 })} sx={{ width: 60 }} />
        <TextField label="base" size="small" variant="standard" value={part.base || ''} onChange={(e) => onChange({ ...part, base: e.target.value })} sx={{ width: 70 }} />
        <TextField label="action" size="small" variant="standard" value={part.action || ''} onChange={(e) => onChange({ ...part, action: e.target.value })} sx={{ width: 70 }} />
        <TextField label="dx" size="small" variant="standard" type="number" value={part.dx || 0} onChange={(e) => onChange({ ...part, dx: parseInt(e.target.value) || 0 })} sx={{ width: 50 }} />
        <TextField label="dy" size="small" variant="standard" type="number" value={part.dy || 0} onChange={(e) => onChange({ ...part, dy: parseInt(e.target.value) || 0 })} sx={{ width: 50 }} />
        <TextField label="dz" size="small" variant="standard" type="number" value={part.dz || 0} onChange={(e) => onChange({ ...part, dz: parseInt(e.target.value) || 0 })} sx={{ width: 50 }} />
        <TextField label="dd" size="small" variant="standard" type="number" value={part.dd || 0} onChange={(e) => onChange({ ...part, dd: parseInt(e.target.value) || 0 })} sx={{ width: 50 }} />
        <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
        </IconButton>
    </Box>
);
