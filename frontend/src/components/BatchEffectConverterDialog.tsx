import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
// @ts-ignore
import { BatchConvertEffectSWFsToNitro, SelectMultipleSWFFiles } from '../wailsjs/go/main/App';

interface BatchEffectConverterDialogProps {
    open: boolean;
    onClose: () => void;
}

interface FileStatus {
    name: string;
    path: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    error?: string;
}

export const BatchEffectConverterDialog: React.FC<BatchEffectConverterDialogProps> = ({ open, onClose }) => {
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [converting, setConverting] = useState(false);
    const [resultDialogOpen, setResultDialogOpen] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [resultSuccess, setResultSuccess] = useState(false);

    const handleSelectFiles = async () => {
        try {
            const selectedFiles = await SelectMultipleSWFFiles();

            if (selectedFiles && selectedFiles.length > 0) {
                const newFiles: FileStatus[] = selectedFiles.map((path: string) => ({
                    name: path.split(/[/\\]/).pop() || path,
                    path: path,
                    status: 'pending'
                }));

                setFiles(prev => [...prev, ...newFiles]);
            }
        } catch (error) {
            console.error('Failed to select files:', error);
        }
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleConvert = async () => {
        if (files.length === 0) return;

        setConverting(true);

        const filePaths = files.map(f => f.path);

        try {
            setFiles(prev => prev.map(f => ({ ...f, status: 'processing' })));

            const result = await BatchConvertEffectSWFsToNitro(filePaths);

            setFiles(prev => prev.map(f => {
                const fileResult = result.files.find((r: any) => r.path === f.path);
                if (fileResult) {
                    return {
                        ...f,
                        status: fileResult.success ? 'success' : 'error',
                        error: fileResult.error
                    };
                }
                return f;
            }));

            if (result.success) {
                setResultMessage(`Successfully converted ${result.successCount} effect file${result.successCount !== 1 ? 's' : ''}!\n\nZip saved to:\n${result.zipPath}`);
                setResultSuccess(true);
            } else {
                setResultMessage(`Conversion completed:\n• ${result.successCount} successful\n• ${result.errorCount} failed\n\nZip saved to:\n${result.zipPath}`);
                setResultSuccess(false);
            }
            setResultDialogOpen(true);
        } catch (error) {
            console.error('Batch effect conversion failed:', error);
            setResultMessage(`Batch conversion failed:\n${error}`);
            setResultSuccess(false);
            setResultDialogOpen(true);
            setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: String(error) })));
        } finally {
            setConverting(false);
        }
    };

    const handleClose = () => {
        if (!converting) {
            setFiles([]);
            onClose();
        }
    };

    const getStatusIcon = (status: FileStatus['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircleIcon color="success" />;
            case 'error':
                return <ErrorIcon color="error" />;
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>Batch Effect SWF to Nitro Converter</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={handleSelectFiles}
                        disabled={converting}
                        sx={{ mb: 2 }}
                    >
                        Add Effect SWF Files
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        Select multiple effect SWF files to convert to Nitro format
                    </Typography>
                </Box>

                {files.length > 0 && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Files ({files.length})
                        </Typography>
                        <List dense sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper' }}>
                            {files.map((file, index) => (
                                <ListItem
                                    key={index}
                                    secondaryAction={
                                        !converting && (
                                            <IconButton edge="end" onClick={() => handleRemoveFile(index)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        )
                                    }
                                >
                                    <ListItemIcon>
                                        {getStatusIcon(file.status)}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={file.name.split(/[/\\]/).pop()}
                                        secondary={file.error || file.status}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                {converting && (
                    <Box sx={{ mt: 2 }}>
                        <LinearProgress variant="indeterminate" />
                        <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                            Converting effect files...
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={converting}>
                    Close
                </Button>
                <Button
                    onClick={handleConvert}
                    variant="contained"
                    disabled={files.length === 0 || converting}
                >
                    Convert All
                </Button>
            </DialogActions>

            {/* Result Dialog */}
            <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {resultSuccess ? (
                        <CheckCircleIcon color="success" />
                    ) : (
                        <ErrorIcon color="error" />
                    )}
                    {resultSuccess ? 'Conversion Complete' : 'Conversion Issues'}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                        {resultMessage}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResultDialogOpen(false)} variant="contained">
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
};
