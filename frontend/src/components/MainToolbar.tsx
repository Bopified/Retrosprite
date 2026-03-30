import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Menu, MenuItem, Box, IconButton } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import TransformIcon from '@mui/icons-material/Transform';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import logo from '../assets/retrosprite_logo.png';
import { AboutDialog } from './AboutDialog';

interface MainToolbarProps {
    projectName: string;
    projectPath: string;
    hasProject: boolean;
    onOpenNitro: () => void;
    onSaveNitro: () => void;
    onOpenProject: () => void;
    onSaveProject: () => void;
    onConvert: () => void;
    onCloseProject: () => void;
    onBatchConvert: () => void;
    onConvertEffect?: () => void;
    onBatchConvertEffect?: () => void;
    onLoadEffectMap?: () => void;
}

export function MainToolbar({
    projectName,
    projectPath,
    hasProject,
    onOpenNitro,
    onSaveNitro,
    onOpenProject,
    onSaveProject,
    onConvert,
    onCloseProject,
    onBatchConvert,
    onConvertEffect,
    onBatchConvertEffect,
    onLoadEffectMap
}: MainToolbarProps) {
    const [fileAnchorEl, setFileAnchorEl] = useState<null | HTMLElement>(null);
    const [toolsAnchorEl, setToolsAnchorEl] = useState<null | HTMLElement>(null);
    const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
    const [aboutOpen, setAboutOpen] = useState(false);

    const openFileMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        setFileAnchorEl(event.currentTarget);
    };
    const closeFileMenu = () => {
        setFileAnchorEl(null);
    };

    const openToolsMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        setToolsAnchorEl(event.currentTarget);
    };
    const closeToolsMenu = () => {
        setToolsAnchorEl(null);
    };

    const openMoreMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        setMoreAnchorEl(event.currentTarget);
    };
    const closeMoreMenu = () => {
        setMoreAnchorEl(null);
    };

    return (
        <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid #333', bgcolor: '#233044' }}>
            <Toolbar variant="dense">
                <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                    <img src={logo} alt="icon" style={{ height: 32 }} />
                </Box>

                {/* File Menu */}
                <Button
                    color="inherit"
                    onClick={openFileMenu}
                    endIcon={<KeyboardArrowDownIcon />}
                    sx={{ textTransform: 'none', mr: 1 }}
                >
                    File
                </Button>
                <Menu
                    anchorEl={fileAnchorEl}
                    open={Boolean(fileAnchorEl)}
                    onClose={closeFileMenu}
                >
                    <MenuItem onClick={() => { onOpenProject(); closeFileMenu(); }}>
                        <FolderOpenIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Open Project (.rspr)...
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => { onOpenNitro(); closeFileMenu(); }}>
                        <FolderOpenIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Import Nitro (.nitro)...
                    </MenuItem>
                    <MenuItem onClick={() => { onConvert(); closeFileMenu(); }}>
                        <TransformIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Import SWF (.swf)...
                    </MenuItem>
                    {onConvertEffect && (
                        <MenuItem onClick={() => { onConvertEffect(); closeFileMenu(); }}>
                            <TransformIcon fontSize="small" sx={{ mr: 1.5 }} />
                            Import Effect SWF (.swf)...
                        </MenuItem>
                    )}
                    <Divider />
                    <MenuItem onClick={() => { onSaveProject(); closeFileMenu(); }} disabled={!hasProject}>
                        <SaveIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Save Project (.rspr)
                    </MenuItem>
                    <MenuItem onClick={() => { onSaveNitro(); closeFileMenu(); }} disabled={!hasProject}>
                        <SaveIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Export Nitro (.nitro)
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => { onCloseProject(); closeFileMenu(); }} disabled={!hasProject}>
                        <CloseIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Close Project
                    </MenuItem>
                </Menu>

                {/* Tools Menu */}
                <Button
                    color="inherit"
                    onClick={openToolsMenu}
                    endIcon={<KeyboardArrowDownIcon />}
                    sx={{ textTransform: 'none', mr: 1 }}
                >
                    Tools
                </Button>
                <Menu
                    anchorEl={toolsAnchorEl}
                    open={Boolean(toolsAnchorEl)}
                    onClose={closeToolsMenu}
                >
                    <MenuItem onClick={() => { onBatchConvert(); closeToolsMenu(); }}>
                        <TransformIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Batch SWF to Nitro Converter
                    </MenuItem>
                    <Divider />
                    {onBatchConvertEffect && (
                        <MenuItem onClick={() => { onBatchConvertEffect(); closeToolsMenu(); }}>
                            <TransformIcon fontSize="small" sx={{ mr: 1.5 }} />
                            Batch Effect SWF to Nitro
                        </MenuItem>
                    )}
                    {onLoadEffectMap && (
                        <MenuItem onClick={() => { onLoadEffectMap(); closeToolsMenu(); }}>
                            <TransformIcon fontSize="small" sx={{ mr: 1.5 }} />
                            EffectMap Manager
                        </MenuItem>
                    )}
                </Menu>

                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', opacity: 0.7, flexDirection: 'column', alignItems: 'center' }}>
                    {hasProject && (
                        <>
                            <Typography variant="body2" sx={{ lineHeight: 1 }}>
                                {projectName}
                            </Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                {projectPath}
                            </Typography>
                        </>
                    )}
                </Box>

                {/* More Menu */}
                <IconButton color="inherit" onClick={openMoreMenu}>
                    <MoreVertIcon />
                </IconButton>
                <Menu
                    anchorEl={moreAnchorEl}
                    open={Boolean(moreAnchorEl)}
                    onClose={closeMoreMenu}
                >
                    <MenuItem onClick={() => { setAboutOpen(true); closeMoreMenu(); }}>
                        About Retrosprite
                    </MenuItem>
                </Menu>
                
                <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
            </Toolbar>
        </AppBar>
    );
}

// Helper for divider since I forgot to import it
import { Divider } from '@mui/material';
