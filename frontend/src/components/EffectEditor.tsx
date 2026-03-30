import React, { useState } from 'react';
import {
    Box, Typography, TextField, Switch, FormControlLabel, IconButton, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Chip, Tab, Tabs, Card, CardContent
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { EffectAnimation, EffectAnimationFramePart } from '../types';

interface EffectEditorProps {
    animation: EffectAnimation | null;
    onUpdate: (animation: EffectAnimation) => void;
}

const sectionLabels = ['General', 'Sprites', 'Frames', 'Adds', 'Shadows', 'Removes', 'Avatars', 'Overrides'];

export const EffectEditor: React.FC<EffectEditorProps> = ({ animation, onUpdate }) => {
    const [activeSection, setActiveSection] = useState(0);
    const [selectedFrame, setSelectedFrame] = useState(0);
    const [selectedOverride, setSelectedOverride] = useState(0);

    if (!animation) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <Typography>No effect animation data loaded</Typography>
            </Box>
        );
    }

    const update = (partial: Partial<EffectAnimation>) => {
        onUpdate({ ...animation, ...partial });
    };

    const sectionCounts = [
        null, // General
        animation.sprites?.length || 0,
        animation.frames?.length || 0,
        animation.adds?.length || 0,
        animation.shadows?.length || 0,
        animation.removes?.length || 0,
        animation.avatars?.length || 0,
        animation.overrides?.length || 0,
    ];

    return (
        <Box sx={{ display: 'flex', height: '100%' }}>
            {/* Sidebar tabs */}
            <Box sx={{ width: 180, borderRight: '1px solid #333', overflow: 'auto' }}>
                <Tabs
                    orientation="vertical"
                    value={activeSection}
                    onChange={(_, v) => setActiveSection(v)}
                    sx={{
                        '.MuiTab-root': { minHeight: 40, textTransform: 'none', justifyContent: 'flex-start', px: 2 },
                    }}
                >
                    {sectionLabels.map((label, i) => (
                        <Tab
                            key={i}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <span>{label}</span>
                                    {sectionCounts[i] !== null && (
                                        <Chip label={sectionCounts[i]} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />
                                    )}
                                </Box>
                            }
                        />
                    ))}
                </Tabs>
            </Box>

            {/* Content panel */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                {activeSection === 0 && <GeneralSection animation={animation} update={update} />}
                {activeSection === 1 && <SpritesSection animation={animation} update={update} />}
                {activeSection === 2 && <FramesSection animation={animation} update={update} selectedFrame={selectedFrame} setSelectedFrame={setSelectedFrame} />}
                {activeSection === 3 && <AddsSection animation={animation} update={update} />}
                {activeSection === 4 && <ShadowsSection animation={animation} update={update} />}
                {activeSection === 5 && <RemovesSection animation={animation} update={update} />}
                {activeSection === 6 && <AvatarsSection animation={animation} update={update} />}
                {activeSection === 7 && <OverridesSection animation={animation} update={update} selectedOverride={selectedOverride} setSelectedOverride={setSelectedOverride} />}
            </Box>
        </Box>
    );
};

// ─── General Section ─────────────────────────────────────────────────────────

const GeneralSection: React.FC<{ animation: EffectAnimation; update: (p: Partial<EffectAnimation>) => void }> = ({ animation, update }) => (
    <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>General Settings</Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Name" size="small" value={animation.name || ''} onChange={(e) => update({ name: e.target.value })} />
                <TextField label="Description" size="small" value={animation.desc || ''} onChange={(e) => update({ desc: e.target.value })} />
                <FormControlLabel
                    control={<Switch checked={animation.resetOnToggle || false} onChange={(e) => update({ resetOnToggle: e.target.checked })} />}
                    label="Reset On Toggle"
                />
            </Box>
        </Paper>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>Direction Offsets</Typography>
        <Paper sx={{ p: 2 }}>
            {animation.directions?.map((dir, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ width: 60 }}>Dir {i}:</Typography>
                    <TextField
                        type="number" size="small" value={dir.offset}
                        onChange={(e) => {
                            const dirs = [...(animation.directions || [])];
                            dirs[i] = { offset: parseInt(e.target.value) || 0 };
                            update({ directions: dirs });
                        }}
                        sx={{ width: 100 }}
                    />
                    <IconButton size="small" color="error" onClick={() => {
                        update({ directions: (animation.directions || []).filter((_, idx) => idx !== i) });
                    }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => update({ directions: [...(animation.directions || []), { offset: 0 }] })}>
                Add Direction
            </Button>
        </Paper>
    </Box>
);

// ─── Sprites Section ─────────────────────────────────────────────────────────

const SpritesSection: React.FC<{ animation: EffectAnimation; update: (p: Partial<EffectAnimation>) => void }> = ({ animation, update }) => (
    <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Sprites</Typography>
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
                                <TextField size="small" variant="standard" value={sprite.id || ''} onChange={(e) => {
                                    const sprites = [...(animation.sprites || [])];
                                    sprites[i] = { ...sprites[i], id: e.target.value };
                                    update({ sprites });
                                }} />
                            </TableCell>
                            <TableCell>
                                <TextField size="small" variant="standard" value={sprite.member || ''} onChange={(e) => {
                                    const sprites = [...(animation.sprites || [])];
                                    sprites[i] = { ...sprites[i], member: e.target.value };
                                    update({ sprites });
                                }} />
                            </TableCell>
                            <TableCell>
                                <TextField size="small" variant="standard" type="number" value={sprite.directions || 0} onChange={(e) => {
                                    const sprites = [...(animation.sprites || [])];
                                    sprites[i] = { ...sprites[i], directions: parseInt(e.target.value) || 0 };
                                    update({ sprites });
                                }} sx={{ width: 60 }} />
                            </TableCell>
                            <TableCell>
                                <TextField size="small" variant="standard" type="number" value={sprite.ink || 0} onChange={(e) => {
                                    const sprites = [...(animation.sprites || [])];
                                    sprites[i] = { ...sprites[i], ink: parseInt(e.target.value) || 0 };
                                    update({ sprites });
                                }} sx={{ width: 60 }} />
                            </TableCell>
                            <TableCell>
                                <TextField size="small" variant="standard" type="number" value={sprite.staticY || 0} onChange={(e) => {
                                    const sprites = [...(animation.sprites || [])];
                                    sprites[i] = { ...sprites[i], staticY: parseInt(e.target.value) || 0 };
                                    update({ sprites });
                                }} sx={{ width: 60 }} />
                            </TableCell>
                            <TableCell>
                                <IconButton size="small" color="error" onClick={() => {
                                    update({ sprites: (animation.sprites || []).filter((_, idx) => idx !== i) });
                                }}><DeleteIcon fontSize="small" /></IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
        <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() =>
            update({ sprites: [...(animation.sprites || []), { id: '', member: '', directions: 0 }] })
        }>
            Add Sprite
        </Button>
    </Box>
);

// ─── Frames Section (two-column) ────────────────────────────────────────────

const FramesSection: React.FC<{
    animation: EffectAnimation;
    update: (p: Partial<EffectAnimation>) => void;
    selectedFrame: number;
    setSelectedFrame: (n: number) => void;
}> = ({ animation, update, selectedFrame, setSelectedFrame }) => {
    const frames = animation.frames || [];
    const frame = frames[selectedFrame];

    return (
        <Box sx={{ display: 'flex', height: '100%', gap: 2 }}>
            {/* Frame list */}
            <Box sx={{ width: 220, flexShrink: 0, overflow: 'auto' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Frames</Typography>
                {frames.map((f, i) => {
                    const fxCount = f.fxs?.length || 0;
                    const bpCount = f.bodyparts?.length || 0;
                    const isSelected = i === selectedFrame;
                    return (
                        <Card
                            key={i}
                            onClick={() => setSelectedFrame(i)}
                            sx={{
                                mb: 0.5, cursor: 'pointer',
                                border: isSelected ? '2px solid #90caf9' : '2px solid transparent',
                                bgcolor: isSelected ? 'rgba(144,202,249,0.08)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(144,202,249,0.04)' },
                            }}
                        >
                            <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                                        Frame {i}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        {fxCount > 0 && <Chip label={`${fxCount} fx`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                        {bpCount > 0 && <Chip label={`${bpCount} bp`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
                                        {f.repeats ? <Chip label={`r:${f.repeats}`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} color="info" /> : null}
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    );
                })}
                <Button size="small" startIcon={<AddIcon />} fullWidth sx={{ mt: 1 }} onClick={() => {
                    const newFrames = [...frames, { repeats: 1, fxs: [], bodyparts: [] }];
                    update({ frames: newFrames });
                    setSelectedFrame(newFrames.length - 1);
                }}>
                    Add Frame
                </Button>
            </Box>

            {/* Frame detail */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {frame ? (
                    <FrameDetail
                        frame={frame}
                        frameIndex={selectedFrame}
                        onChange={(updated) => {
                            const newFrames = [...frames];
                            newFrames[selectedFrame] = updated;
                            update({ frames: newFrames });
                        }}
                        onDelete={() => {
                            const newFrames = frames.filter((_, idx) => idx !== selectedFrame);
                            update({ frames: newFrames });
                            if (selectedFrame >= newFrames.length) setSelectedFrame(Math.max(0, newFrames.length - 1));
                        }}
                    />
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <Typography>Select a frame or add one</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

// ─── Frame Detail ────────────────────────────────────────────────────────────

const FrameDetail: React.FC<{
    frame: EffectAnimation['frames'] extends (infer T)[] | undefined ? T : never;
    frameIndex: number;
    onChange: (f: any) => void;
    onDelete: () => void;
}> = ({ frame, frameIndex, onChange, onDelete }) => {
    if (!frame) return null;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6">Frame {frameIndex}</Typography>
                <TextField
                    label="Repeats" type="number" size="small"
                    value={frame.repeats || 0}
                    onChange={(e) => onChange({ ...frame, repeats: parseInt(e.target.value) || 0 })}
                    sx={{ width: 100 }}
                />
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
                    Delete Frame
                </Button>
            </Box>

            {/* FX Parts */}
            <Paper sx={{ p: 1.5, mb: 2 }} variant="outlined">
                <Typography variant="subtitle2" sx={{ mb: 1 }}>FX Parts ({frame.fxs?.length || 0})</Typography>
                {frame.fxs?.map((fx: EffectAnimationFramePart, pi: number) => (
                    <FramePartRow
                        key={pi}
                        part={fx}
                        onChange={(updated) => {
                            const fxs = [...(frame.fxs || [])];
                            fxs[pi] = updated;
                            onChange({ ...frame, fxs });
                        }}
                        onDelete={() => {
                            onChange({ ...frame, fxs: (frame.fxs || []).filter((_: any, idx: number) => idx !== pi) });
                        }}
                    />
                ))}
                <Button size="small" variant="text" onClick={() => {
                    onChange({ ...frame, fxs: [...(frame.fxs || []), { id: '', frame: 0 }] });
                }}>
                    + FX Part
                </Button>
            </Paper>

            {/* Body Parts */}
            <Paper sx={{ p: 1.5 }} variant="outlined">
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Body Parts ({frame.bodyparts?.length || 0})</Typography>
                {frame.bodyparts?.map((bp: EffectAnimationFramePart, pi: number) => (
                    <FramePartRow
                        key={pi}
                        part={bp}
                        onChange={(updated) => {
                            const bodyparts = [...(frame.bodyparts || [])];
                            bodyparts[pi] = updated;
                            onChange({ ...frame, bodyparts });
                        }}
                        onDelete={() => {
                            onChange({ ...frame, bodyparts: (frame.bodyparts || []).filter((_: any, idx: number) => idx !== pi) });
                        }}
                    />
                ))}
                <Button size="small" variant="text" onClick={() => {
                    onChange({ ...frame, bodyparts: [...(frame.bodyparts || []), { id: '', frame: 0 }] });
                }}>
                    + Body Part
                </Button>
            </Paper>
        </Box>
    );
};

// ─── Adds Section ────────────────────────────────────────────────────────────

const AddsSection: React.FC<{ animation: EffectAnimation; update: (p: Partial<EffectAnimation>) => void }> = ({ animation, update }) => (
    <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Adds</Typography>
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
                                }}><DeleteIcon fontSize="small" /></IconButton>
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
    </Box>
);

// ─── Shadows Section ─────────────────────────────────────────────────────────

const ShadowsSection: React.FC<{ animation: EffectAnimation; update: (p: Partial<EffectAnimation>) => void }> = ({ animation, update }) => (
    <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Shadows</Typography>
        <Paper sx={{ p: 2 }}>
            {animation.shadows?.map((shadow, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TextField label="ID" size="small" value={shadow.id} onChange={(e) => {
                        const shadows = [...(animation.shadows || [])];
                        shadows[i] = { id: e.target.value };
                        update({ shadows });
                    }} />
                    <IconButton size="small" color="error" onClick={() => {
                        update({ shadows: (animation.shadows || []).filter((_, idx) => idx !== i) });
                    }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() =>
                update({ shadows: [...(animation.shadows || []), { id: '' }] })
            }>
                Add Shadow
            </Button>
        </Paper>
    </Box>
);

// ─── Removes Section ─────────────────────────────────────────────────────────

const RemovesSection: React.FC<{ animation: EffectAnimation; update: (p: Partial<EffectAnimation>) => void }> = ({ animation, update }) => (
    <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Removes</Typography>
        <Paper sx={{ p: 2 }}>
            {animation.removes?.map((remove, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TextField label="ID" size="small" value={remove.id} onChange={(e) => {
                        const removes = [...(animation.removes || [])];
                        removes[i] = { id: e.target.value };
                        update({ removes });
                    }} />
                    <IconButton size="small" color="error" onClick={() => {
                        update({ removes: (animation.removes || []).filter((_, idx) => idx !== i) });
                    }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() =>
                update({ removes: [...(animation.removes || []), { id: '' }] })
            }>
                Add Remove
            </Button>
        </Paper>
    </Box>
);

// ─── Avatars Section ─────────────────────────────────────────────────────────

const AvatarsSection: React.FC<{ animation: EffectAnimation; update: (p: Partial<EffectAnimation>) => void }> = ({ animation, update }) => (
    <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Avatars</Typography>
        <Paper sx={{ p: 2 }}>
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
                    }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() =>
                update({ avatars: [...(animation.avatars || []), { background: '', foreground: '' }] })
            }>
                Add Avatar
            </Button>
        </Paper>
    </Box>
);

// ─── Overrides Section (two-column) ──────────────────────────────────────────

const OverridesSection: React.FC<{
    animation: EffectAnimation;
    update: (p: Partial<EffectAnimation>) => void;
    selectedOverride: number;
    setSelectedOverride: (n: number) => void;
}> = ({ animation, update, selectedOverride, setSelectedOverride }) => {
    const overrides = animation.overrides || [];
    const override = overrides[selectedOverride];

    return (
        <Box sx={{ display: 'flex', height: '100%', gap: 2 }}>
            {/* Override list */}
            <Box sx={{ width: 220, flexShrink: 0, overflow: 'auto' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Overrides</Typography>
                {overrides.map((ov, i) => {
                    const isSelected = i === selectedOverride;
                    return (
                        <Card
                            key={i}
                            onClick={() => setSelectedOverride(i)}
                            sx={{
                                mb: 0.5, cursor: 'pointer',
                                border: isSelected ? '2px solid #90caf9' : '2px solid transparent',
                                bgcolor: isSelected ? 'rgba(144,202,249,0.08)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(144,202,249,0.04)' },
                            }}
                        >
                            <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                                <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                                    {ov.name || `Override ${i}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {ov.override || ''} - {ov.frames?.length || 0} frames
                                </Typography>
                            </CardContent>
                        </Card>
                    );
                })}
                <Button size="small" startIcon={<AddIcon />} fullWidth sx={{ mt: 1 }} onClick={() => {
                    const newOverrides = [...overrides, { name: '', override: '', frames: [] }];
                    update({ overrides: newOverrides });
                    setSelectedOverride(newOverrides.length - 1);
                }}>
                    Add Override
                </Button>
            </Box>

            {/* Override detail */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {override ? (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <TextField label="Name" size="small" value={override.name || ''} onChange={(e) => {
                                const newOverrides = [...overrides];
                                newOverrides[selectedOverride] = { ...override, name: e.target.value };
                                update({ overrides: newOverrides });
                            }} />
                            <TextField label="Override" size="small" value={override.override || ''} onChange={(e) => {
                                const newOverrides = [...overrides];
                                newOverrides[selectedOverride] = { ...override, override: e.target.value };
                                update({ overrides: newOverrides });
                            }} />
                            <Box sx={{ flexGrow: 1 }} />
                            <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => {
                                const newOverrides = overrides.filter((_, idx) => idx !== selectedOverride);
                                update({ overrides: newOverrides });
                                if (selectedOverride >= newOverrides.length) setSelectedOverride(Math.max(0, newOverrides.length - 1));
                            }}>
                                Delete
                            </Button>
                        </Box>

                        {/* Override frames */}
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Frames ({override.frames?.length || 0})</Typography>
                        {override.frames?.map((frame: any, fi: number) => (
                            <Paper key={fi} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="body2">Frame {fi}</Typography>
                                    <TextField label="Repeats" type="number" size="small" value={frame.repeats || 0} onChange={(e) => {
                                        const newOverrides = [...overrides];
                                        const frames = [...(override.frames || [])];
                                        frames[fi] = { ...frames[fi], repeats: parseInt(e.target.value) || 0 };
                                        newOverrides[selectedOverride] = { ...override, frames };
                                        update({ overrides: newOverrides });
                                    }} sx={{ width: 100 }} />
                                    <Box sx={{ flexGrow: 1 }} />
                                    <IconButton size="small" color="error" onClick={() => {
                                        const newOverrides = [...overrides];
                                        newOverrides[selectedOverride] = { ...override, frames: (override.frames || []).filter((_: any, idx: number) => idx !== fi) };
                                        update({ overrides: newOverrides });
                                    }}><DeleteIcon fontSize="small" /></IconButton>
                                </Box>

                                {frame.fxs?.map((fx: EffectAnimationFramePart, pi: number) => (
                                    <FramePartRow
                                        key={`fx-${pi}`}
                                        part={fx}
                                        onChange={(updated) => {
                                            const newOverrides = [...overrides];
                                            const frames = [...(override.frames || [])];
                                            const fxs = [...(frames[fi].fxs || [])];
                                            fxs[pi] = updated;
                                            frames[fi] = { ...frames[fi], fxs };
                                            newOverrides[selectedOverride] = { ...override, frames };
                                            update({ overrides: newOverrides });
                                        }}
                                        onDelete={() => {
                                            const newOverrides = [...overrides];
                                            const frames = [...(override.frames || [])];
                                            frames[fi] = { ...frames[fi], fxs: (frames[fi].fxs || []).filter((_: any, idx: number) => idx !== pi) };
                                            newOverrides[selectedOverride] = { ...override, frames };
                                            update({ overrides: newOverrides });
                                        }}
                                    />
                                ))}

                                {frame.bodyparts?.map((bp: EffectAnimationFramePart, pi: number) => (
                                    <FramePartRow
                                        key={`bp-${pi}`}
                                        part={bp}
                                        onChange={(updated) => {
                                            const newOverrides = [...overrides];
                                            const frames = [...(override.frames || [])];
                                            const bodyparts = [...(frames[fi].bodyparts || [])];
                                            bodyparts[pi] = updated;
                                            frames[fi] = { ...frames[fi], bodyparts };
                                            newOverrides[selectedOverride] = { ...override, frames };
                                            update({ overrides: newOverrides });
                                        }}
                                        onDelete={() => {
                                            const newOverrides = [...overrides];
                                            const frames = [...(override.frames || [])];
                                            frames[fi] = { ...frames[fi], bodyparts: (frames[fi].bodyparts || []).filter((_: any, idx: number) => idx !== pi) };
                                            newOverrides[selectedOverride] = { ...override, frames };
                                            update({ overrides: newOverrides });
                                        }}
                                    />
                                ))}
                            </Paper>
                        ))}
                        <Button size="small" startIcon={<AddIcon />} onClick={() => {
                            const newOverrides = [...overrides];
                            newOverrides[selectedOverride] = { ...override, frames: [...(override.frames || []), { repeats: 1, fxs: [], bodyparts: [] }] };
                            update({ overrides: newOverrides });
                        }}>
                            Add Frame
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <Typography>Select an override or add one</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

// ─── FramePartRow (shared sub-component) ─────────────────────────────────────

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
