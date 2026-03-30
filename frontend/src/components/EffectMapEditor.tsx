import React, { useState } from 'react';
import {
    Box, Typography, TextField, Button, IconButton,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Dialog, DialogTitle, DialogContent, DialogActions,
    InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SaveIcon from '@mui/icons-material/Save';
import type { EffectMapData, EffectMapLibrary } from '../types';

interface EffectMapEditorProps {
    effectMap: EffectMapData | null;
    onUpdate: (effectMap: EffectMapData) => void;
    onLoad: () => void;
    onSave: () => void;
}

export const EffectMapEditor: React.FC<EffectMapEditorProps> = ({
    effectMap,
    onUpdate,
    onLoad,
    onSave
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newEntry, setNewEntry] = useState<EffectMapLibrary>({ id: '', lib: '', type: 'fx', revision: 0 });

    const filteredEffects = effectMap?.effects?.filter(e =>
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.lib.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleAdd = () => {
        if (!newEntry.id || !newEntry.lib) return;

        const updated: EffectMapData = {
            effects: [...(effectMap?.effects || []), { ...newEntry }]
        };
        onUpdate(updated);
        setNewEntry({ id: '', lib: '', type: 'fx', revision: 0 });
        setAddDialogOpen(false);
    };

    const handleRemove = (id: string) => {
        if (!effectMap) return;
        const updated: EffectMapData = {
            effects: effectMap.effects.filter(e => e.id !== id)
        };
        onUpdate(updated);
    };

    return (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <Typography variant="h6" sx={{ flexGrow: 0, mr: 2 }}>
                    EffectMap
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileUploadIcon />}
                    onClick={onLoad}
                >
                    Load
                </Button>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={onSave}
                    disabled={!effectMap}
                >
                    Save
                </Button>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setAddDialogOpen(true)}
                >
                    Add Entry
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <TextField
                    size="small"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ width: 250 }}
                />
            </Box>

            {!effectMap ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, opacity: 0.5 }}>
                    <Typography>Load an EffectMap.json or EffectMap.xml to get started</Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Library</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Revision</TableCell>
                                <TableCell width={60}></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredEffects.map((effect) => (
                                <TableRow key={effect.id} hover>
                                    <TableCell>{effect.id}</TableCell>
                                    <TableCell>{effect.lib}</TableCell>
                                    <TableCell>{effect.type}</TableCell>
                                    <TableCell>{effect.revision}</TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleRemove(effect.id)}
                                            color="error"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Box sx={{ mt: 1, opacity: 0.6 }}>
                <Typography variant="caption">
                    {effectMap ? `${effectMap.effects.length} effects` : 'No EffectMap loaded'}
                    {searchQuery && ` (${filteredEffects.length} shown)`}
                </Typography>
            </Box>

            {/* Add Entry Dialog */}
            <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
                <DialogTitle>Add Effect Entry</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 300 }}>
                        <TextField
                            label="Effect ID"
                            value={newEntry.id}
                            onChange={(e) => setNewEntry({ ...newEntry, id: e.target.value })}
                            size="small"
                        />
                        <TextField
                            label="Library Name"
                            value={newEntry.lib}
                            onChange={(e) => setNewEntry({ ...newEntry, lib: e.target.value })}
                            size="small"
                        />
                        <TextField
                            label="Type"
                            value={newEntry.type}
                            onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value })}
                            size="small"
                        />
                        <TextField
                            label="Revision"
                            type="number"
                            value={newEntry.revision}
                            onChange={(e) => setNewEntry({ ...newEntry, revision: parseInt(e.target.value) || 0 })}
                            size="small"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAdd} variant="contained" disabled={!newEntry.id || !newEntry.lib}>
                        Add
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
