import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import './App.css';
// @ts-ignore
import { OpenNitroFile, SaveNitroFile, ConvertSWF, LoadNitroFile, RenameNitroProject, SaveProject, OpenProject, LoadProject, SaveFileAs, CheckForUpdates } from './wailsjs/go/main/App';
// ... updates ...




import {
    Box, TextField, CssBaseline, ThemeProvider, createTheme, Tabs, Tab, Snackbar, Alert, Typography, IconButton,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import PhotoIcon from '@mui/icons-material/Photo';
import AppsIcon from '@mui/icons-material/Apps';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import SettingsIcon from '@mui/icons-material/Settings';
import LayersIcon from '@mui/icons-material/Layers';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import DownloadIcon from '@mui/icons-material/Download';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';

import { SpriteEditor } from './components/SpriteEditor';
import { AssetEditor } from './components/AssetEditor';
import { LayersEditor } from './components/LayersEditor';
import { FurniturePreview } from './components/FurniturePreview';
import { FileExplorer } from './components/FileExplorer';
import { FurnitureSettings } from './components/FurnitureSettings';
import { MainToolbar } from './components/MainToolbar';
import { RecentProjects } from './components/RecentProjects';
import { CodeEditor } from './components/CodeEditor';
import { SplashScreen } from './components/SplashScreen';
import { UpdateDialog } from './components/UpdateDialog';
import { BatchConverterDialog } from './components/BatchConverterDialog';
import type { NitroJSON, RsprProject, AvatarTestingState } from './types';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#90caf9',
        },
        secondary: {
            main: '#f48fb1',
        },
        background: {
            default: '#1b2636',
            paper: '#233044',
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    scrollbarColor: "#6b6b6b #2b2b2b",
                    "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
                        backgroundColor: "#2b2b2b",
                        width: '8px',
                        height: '8px',
                    },
                    "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
                        borderRadius: 8,
                        backgroundColor: "#6b6b6b",
                        minHeight: 24,
                    },
                },
            },
        },
    },
});

interface ProjectData {
    path: string;
    files: Record<string, string>;
    settings?: {
        lastOpenedFile?: string;
    };
}

function App() {
    const [projects, setProjects] = useState<Record<string, ProjectData>>({});
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>("");
    const [tabIndex, setTabIndex] = useState(0);
    const [recentProjects, setRecentProjects] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isDirty, setIsDirty] = useState(false);

    const [avatarTestingState, setAvatarTestingState] = useState<AvatarTestingState>({
        enabled: false,
        tileRow: 15, // Center of 30x30 grid = layer 0
        tileCol: 15, // Center of 30x30 grid
        subLayer: 15,
        avatarImage: null,
        heightOffset: 0, // Y offset for avatar height
        // Habbo imager parameters
        username: 'bop',
        action: 'std',
        gesture: 'nrm',
        direction: 2,
        headDirection: 2,
        size: 'm'
    });

    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const isResizing = useRef(false);

    useState(() => {
        const stored = localStorage.getItem('recent_projects');
        if (stored) {
            try {
                setRecentProjects(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse recent projects", e);
            }
        }
    });

    const addToRecent = (path: string) => {
        const newState = [path, ...recentProjects.filter(p => p !== path)].slice(0, 10);
        setRecentProjects(newState);
        localStorage.setItem('recent_projects', JSON.stringify(newState));
    };

    const removeFromRecent = (path: string) => {
        const newState = recentProjects.filter(p => p !== path);
        setRecentProjects(newState);
        localStorage.setItem('recent_projects', JSON.stringify(newState));
    };

    // Sidebar Resize Logic
    const startResizing = useCallback(() => {
        isResizing.current = true;
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
    }, []);

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing.current) {
            const newWidth = mouseMoveEvent.clientX;
            if (newWidth > 150 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    // Sync avatar image to localStorage
    useEffect(() => {
        if (avatarTestingState.avatarImage) {
            localStorage.setItem('retrosprite_avatar_test_image', avatarTestingState.avatarImage);
        }
    }, [avatarTestingState.avatarImage]);

    // Check for updates on startup
    useEffect(() => {
        if (!isLoading) {
            const checkUpdates = async () => {
                try {
                    const info = await CheckForUpdates();
                    if (info.available && !info.error) {
                        setUpdateInfo(info);
                        setUpdateDialogOpen(true);
                    }
                } catch (err) {
                    // Silently fail on startup check
                    console.error('Update check failed:', err);
                }
            };

            // Delay check by 2 seconds to not interfere with app startup
            const timer = setTimeout(checkUpdates, 2000);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    // Event listeners for manual update checks
    useEffect(() => {
        const handleUpdateAvailable = (e: Event) => {
            const customEvent = e as CustomEvent;
            setUpdateInfo(customEvent.detail);
            setUpdateDialogOpen(true);
        };

        const handleUpdateNotAvailable = () => {
            showNotification('You are using the latest version!', 'success');
        };

        const handleUpdateError = (e: Event) => {
            const customEvent = e as CustomEvent;
            showNotification(customEvent.detail || 'Failed to check for updates', 'error');
        };

        window.addEventListener('updateAvailable', handleUpdateAvailable);
        window.addEventListener('updateNotAvailable', handleUpdateNotAvailable);
        window.addEventListener('updateCheckError', handleUpdateError);

        return () => {
            window.removeEventListener('updateAvailable', handleUpdateAvailable);
            window.removeEventListener('updateNotAvailable', handleUpdateNotAvailable);
            window.removeEventListener('updateCheckError', handleUpdateError);
        };
    }, []);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<AlertColor>("info");

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<any>(null);

    const [batchConverterDialogOpen, setBatchConverterDialogOpen] = useState(false);

    const [pendingRenameName, setPendingRenameName] = useState<string | null>(null);

    const [resetDialogOpen, setResetDialogOpen] = useState(false);

    // File rename/delete dialog states
    const [renameFileDialogOpen, setRenameFileDialogOpen] = useState(false);
    const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false);
    const [fileToRename, setFileToRename] = useState<{ projectName: string; fileName: string } | null>(null);
    const [fileToDelete, setFileToDelete] = useState<{ projectName: string; fileName: string } | null>(null);
    const [newFileName, setNewFileName] = useState("");

    // Project rename dialog state
    const [renameProjectDialogOpen, setRenameProjectDialogOpen] = useState(false);
    const [projectToRename, setProjectToRename] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState("");

    // Generic Confirmation Dialog State
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmDialogTitle, setConfirmDialogTitle] = useState("");
    const [confirmDialogContent, setConfirmDialogContent] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<(() => void) | null>(null);

    const requestConfirmation = (action: () => void, title: string, content: string) => {
        setPendingConfirmAction(() => action);
        setConfirmDialogTitle(title);
        setConfirmDialogContent(content);
        setConfirmDialogOpen(true);
    };

    const onConfirmAction = () => {
        if (pendingConfirmAction) pendingConfirmAction();
        setConfirmDialogOpen(false);
        setPendingConfirmAction(null);
    };

    const showNotification = (message: string, severity: AlertColor = "info") => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };

    const decodeContent = (b64: string) => {
        try {
            return atob(b64);
        } catch (e) {
            return "";
        }
    };

    const encodeContent = (str: string) => {
        return btoa(str);
    };

    const isTextFile = (name: string) => {
        return name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.txt') || name.endsWith('.atlas');
    };

    const isImageFile = (name: string) => {
        return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    };

    const getFileNameFromPath = (path: string) => {
        return path.split(/[\\/]/).pop() || path;
    };

    const performOpenFile = async () => {
        try {
            const result = await OpenNitroFile();
            if (result) {
                const projectName = getFileNameFromPath(result.path);
                setProjects(prev => ({
                    ...prev,
                    [projectName]: {
                        path: result.path,
                        files: result.files as any
                    }
                }));
                // Auto select the new project
                setSelectedProject(projectName);
                setSelectedFile(null);
                setFileContent("");
                addToRecent(result.path);
                setIsDirty(false);
            }
        } catch (err) {
            console.error(err);
            showNotification("Error opening file: " + err, "error");
        }
    };

    const handleOpenFile = () => {
        if (isDirty) {
            requestConfirmation(performOpenFile, "Unsaved Changes", "You have unsaved changes. Discard them?");
        } else {
            performOpenFile();
        }
    };

    const performOpenProject = async () => {
        try {
            // @ts-ignore
            const result = await OpenProject();
            if (result && result.files && result.path) {
                const path = result.path;
                const projectName = getFileNameFromPath(path);
                setProjects(prev => ({
                    ...prev,
                    [projectName]: {
                        path: path,
                        files: result.files as any
                    }
                }));

                setSelectedProject(projectName);
                setSelectedFile(null);
                setFileContent("");

                addToRecent(path);
                setIsDirty(false);
            }
        } catch (err) {
            console.error(err);
            showNotification("Error opening project: " + err, "error");
        }
    };

    const handleOpenProject = () => {
        if (isDirty) {
            requestConfirmation(performOpenProject, "Unsaved Changes", "You have unsaved changes. Discard them?");
        } else {
            performOpenProject();
        }
    };

    const performLoadRecent = async (path: string) => {
        try {
            if (path.endsWith('.rspr')) {
                 // @ts-ignore
                 const result = await LoadProject(path);
                 if (result && result.files && result.path) {
                     const resultPath = result.path;
                     const projectName = getFileNameFromPath(resultPath);
                     setProjects(prev => ({
                         ...prev,
                         [projectName]: {
                             path: resultPath,
                             files: result.files as any
                         }
                     }));

                     setSelectedProject(projectName);
                     setSelectedFile(null);
                     setFileContent("");

                     addToRecent(resultPath); 
                     setIsDirty(false);
                 }
            } else {
                // Assume Nitro
                // @ts-ignore
                const result = await LoadNitroFile(path);
                if (result) {
                    const projectName = getFileNameFromPath(result.path);
                    setProjects(prev => ({
                        ...prev,
                        [projectName]: {
                            path: result.path,
                            files: result.files as any
                        }
                    }));
                    // Auto select the new project
                    setSelectedProject(projectName);
                    setSelectedFile(null);
                    setFileContent("");
                    addToRecent(path); // Update order
                    setIsDirty(false);
                }
            }
        } catch (err) {
            console.error(err);
            showNotification("Error opening file (it may have been moved): " + err, "error");
        }
    };

    const handleLoadRecent = (path: string) => {
        if (isDirty) {
            requestConfirmation(() => performLoadRecent(path), "Unsaved Changes", "You have unsaved changes. Discard them?");
        } else {
            performLoadRecent(path);
        }
    }


    const performCloseProject = (projectName: string) => {
        setProjects(prev => {
            const next = { ...prev };
            delete next[projectName];
            return next;
        });
        if (selectedProject === projectName) {
            setSelectedProject(null);
            setSelectedFile(null);
            setFileContent("");
            setIsDirty(false);
        }
    };

    const handleCloseProject = (projectName: string) => {
        if (isDirty) {
            requestConfirmation(() => performCloseProject(projectName), "Unsaved Changes", "You have unsaved changes. Close anyway?");
        } else {
            performCloseProject(projectName);
        }
    };

    const finalizeSave = async () => {
        if (!selectedProject) return;
        const project = projects[selectedProject];

        try {
            const filesToSave = { ...project.files };
            // Use current fileContent (which might have been updated by handleJsonUpdate)
            if (selectedFile && isTextFile(selectedFile)) {
                filesToSave[selectedFile] = encodeContent(fileContent);
            }

            if (project.path.endsWith('.rspr')) {
                // Save as Project
                const rsprData: RsprProject = {
                    version: "1.0",
                    name: selectedProject.replace('.rspr', ''),
                    files: filesToSave,
                    settings: {
                        lastOpenedFile: selectedFile || undefined
                    }
                };
                await SaveProject(project.path, rsprData as any, rsprData.name);
            } else {
                // Save as Nitro (default for .nitro or .swf imports)
                const nitroName = selectedProject.replace(/\.(nitro|swf|rspr)$/i, '');
                // @ts-ignore
                const result = await SaveNitroFile(project.path, filesToSave as any, nitroName);
                if (!result) return;
            }

            setProjects(prev => ({
                ...prev,
                [selectedProject]: {
                    ...prev[selectedProject],
                    files: filesToSave
                }
            }));

            setIsDirty(false);
            showNotification("Saved successfully!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Error saving file: " + err, "error");
        }
    };

    const handleSaveProjectAs = async () => {
        if (!selectedProject) return;
        const project = projects[selectedProject];
        
        try {
            // If currently .nitro, clear path to force dialog
            const savePath = project.path.endsWith('.rspr') ? project.path : "";

            const filesToSave = { ...project.files };
            if (selectedFile && isTextFile(selectedFile)) {
                filesToSave[selectedFile] = encodeContent(fileContent);
            }

            const rsprData: RsprProject = {
                version: "1.0",
                name: selectedProject.replace(/\.(nitro|rspr|swf)$/i, ''),
                files: filesToSave,
                settings: {
                    lastOpenedFile: selectedFile || undefined
                }
            };

            // @ts-ignore
            const savedPath = await SaveProject(savePath, rsprData as any, rsprData.name);
            if (savedPath) {
                 const newProjectName = getFileNameFromPath(savedPath);
                 
                 // Update state with new path/name
                 setProjects(prev => {
                    const next = { ...prev };
                    // If name changed, delete old key
                    if (newProjectName !== selectedProject) {
                        delete next[selectedProject];
                    }
                    next[newProjectName] = {
                        path: savedPath,
                        files: filesToSave,
                        settings: rsprData.settings
                    };
                    return next;
                });
                
                setSelectedProject(newProjectName);
                addToRecent(savedPath);
                setIsDirty(false);
                showNotification("Project saved.", "success");
            }
        } catch (err) {
             console.error(err);
             showNotification("Error saving project: " + err, "error");
        }
    };

    const handleExportNitro = async () => {
         if (!selectedProject) return;
         const project = projects[selectedProject];
         const filesToSave = { ...project.files };
         if (selectedFile && isTextFile(selectedFile)) {
             filesToSave[selectedFile] = encodeContent(fileContent);
         }
         
         // Always force dialog for export
         const nitroName = selectedProject.replace(/\.(nitro|swf|rspr)$/i, '');
         try {
             // @ts-ignore
             const result = await SaveNitroFile("", filesToSave as any, nitroName);
             if (!result) return;
             showNotification("Exported Nitro successfully.", "success");
         } catch(err) {
             console.error(err);
             showNotification("Error exporting nitro: " + err, "error");
         }
    }

    const handleSaveFile = async () => {
        if (!selectedProject) return;

        // Check for potential Rename if editing JSON
        if (selectedFile && selectedFile.endsWith('.json')) {
            try {
                const parsed = JSON.parse(fileContent);
                const currentBaseName = selectedProject.replace(/\.nitro$/i, '');

                if (parsed.name && parsed.name !== currentBaseName) {
                    setPendingRenameName(parsed.name);
                    return;
                }
            } catch (e) {
                // Ignore JSON parse errors, proceed to save
            }
        }

        await finalizeSave();
    };

    const handleConfirmRename = async () => {
        if (pendingRenameName) {
            await handleRename(pendingRenameName);
            setPendingRenameName(null);
        }
    };

    const handleResetRequest = () => {
        if (!selectedProject) return;
        setResetDialogOpen(true);
    };

    const handleConfirmReset = async () => {
        setResetDialogOpen(false);
        if (!selectedProject) return;

        try {
            const project = projects[selectedProject];
            let resultFiles = {};

            if (project.path.endsWith('.rspr')) {
                 // @ts-ignore
                const result = await LoadProject(project.path);
                resultFiles = result.files as any;
            } else {
                 // @ts-ignore
                const result = await LoadNitroFile(project.path);
                resultFiles = result.files as any;
            }
            
            setProjects(prev => ({
                ...prev,
                [selectedProject]: {
                    ...prev[selectedProject],
                    files: resultFiles
                }
            }));

            // If viewing a file, reload its content from the freshly loaded project
            if (selectedFile) {
                // @ts-ignore
                const content = resultFiles[selectedFile] || "";
                if (isTextFile(selectedFile)) {
                    const decoded = decodeContent(content);
                    if (selectedFile.endsWith('.json')) {
                        try {
                            const parsed = JSON.parse(decoded);
                            setFileContent(JSON.stringify(parsed, null, 4));
                        } catch (e) {
                            setFileContent(decoded);
                        }
                    } else {
                        setFileContent(decoded);
                    }
                } else {
                    setFileContent(content);
                }
            }

            setIsDirty(false);
            showNotification("Reset to saved state.", "info");
        } catch (err) {
            console.error(err);
            showNotification("Error resetting: " + err, "error");
        }
    };



    const handleConvertSWF = async () => {
        try {
            const result = await ConvertSWF() as any;
            if (result) {
                // Auto open the converted project
                const projectName = getFileNameFromPath(result.path);
                setProjects(prev => ({
                    ...prev,
                    [projectName]: {
                        path: result.path,
                        files: result.files as any
                    }
                }));
                setSelectedProject(projectName);
                setSelectedFile(null);
                setFileContent("");
                addToRecent(result.path);
                setIsDirty(false);

                showNotification("Converted successfully! Saved to: " + result.path, "success");
            }
        } catch (err) {
            console.error(err);
            showNotification("Error converting SWF: " + err, "error");
        }
    };

    const performProjectSelect = (projectName: string) => {
        setSelectedProject(projectName);
        // Don't auto-select a file, just focus the project in tree
    };

    const handleProjectSelect = (projectName: string) => {
        if (isDirty) {
            requestConfirmation(() => performProjectSelect(projectName), "Unsaved Changes", "You have unsaved changes. Switch projects?");
        } else {
            performProjectSelect(projectName);
        }
    };

    const handleFileSelect = (projectName: string, fileName: string) => {
        // If switching from another text file where we have pending edits in 'fileContent', 
        // strictly speaking we should probably save them to the project state first.
        // For now, let's just update the previous file in the project state before switching.
        if (selectedProject && selectedFile && isTextFile(selectedFile)) {
            setProjects(prev => {
                const currentProj = prev[selectedProject];
                if (!currentProj) return prev;
                return {
                    ...prev,
                    [selectedProject]: {
                        ...currentProj,
                        files: {
                            ...currentProj.files,
                            [selectedFile]: encodeContent(fileContent)
                        }
                    }
                };
            });
        }

        setSelectedProject(projectName);
        setSelectedFile(fileName);

        const project = projects[projectName];
        const content = project.files[fileName] || "";

        if (isTextFile(fileName)) {
            const decoded = decodeContent(content);
            if (fileName.endsWith('.json')) {
                try {
                    const parsed = JSON.parse(decoded);
                    setFileContent(JSON.stringify(parsed, null, 4));
                } catch (e) {
                    setFileContent(decoded);
                }
            } else {
                setFileContent(decoded);
            }
        } else {
            setFileContent(content);
        }

        // Default to Code/View tab (2) for JSON files, Preview tab (0) for others
        setTabIndex(fileName.endsWith('.json') ? 2 : 0);
        setIsDirty(false); // Switching files resets dirtyness of the VIEW (not necessarily the project, but we are simple for now)
    };

    const handleJsonUpdate = (newJson: NitroJSON, newImage?: string) => {
        const newJsonString = JSON.stringify(newJson, null, 4);
        // Only set dirty if content actually changed
        if (newJsonString !== fileContent) {
            setFileContent(newJsonString);
            setIsDirty(true);
        }

        if (selectedProject && selectedFile) {
            const updates: Record<string, string> = {
                [selectedFile]: encodeContent(newJsonString)
            };

            // If a new image is provided, update it as well
            if (newImage && newJson.spritesheet?.meta?.image) {
                const imageName = newJson.spritesheet.meta.image;
                updates[imageName] = newImage;
            }

            setProjects(prev => ({
                ...prev,
                [selectedProject]: {
                    ...prev[selectedProject],
                    files: {
                        ...prev[selectedProject].files,
                        ...updates
                    }
                }
            }));
        }
    };

    const parsedJson = useMemo(() => {
        if (selectedFile && isTextFile(selectedFile) && selectedFile.endsWith('.json')) {
            try {
                return JSON.parse(fileContent);
            } catch (e) {
                return null;
            }
        }
        return null;
    }, [fileContent, selectedFile]);

    const linkedImageContent = useMemo(() => {
        if (selectedProject && parsedJson && parsedJson.spritesheet && parsedJson.spritesheet.meta && parsedJson.spritesheet.meta.image) {
            return projects[selectedProject].files[parsedJson.spritesheet.meta.image] || null;
        }
        return null;
    }, [parsedJson, selectedProject, projects]);

    const currentProjectFiles = useMemo(() => {
        if (!selectedProject) return {};
        return projects[selectedProject].files;
    }, [projects, selectedProject]);

    const handleRename = async (newName: string) => {
        if (!selectedProject) return;
        const project = projects[selectedProject];

        try {
            // Try to find the original name from the asset keys, as the file name might be different
            let oldName = "";
            if (parsedJson?.assets) {
                const firstAssetKey = Object.keys(parsedJson.assets)[0];
                if (firstAssetKey) {
                    const parts = firstAssetKey.split('_64_');
                    if (parts.length > 1) {
                        oldName = parts[0];
                    } else {
                        const partsIcon = firstAssetKey.split('_icon_');
                        if (partsIcon.length > 1) {
                            oldName = partsIcon[0];
                        }
                    }
                }
            }

            // @ts-ignore - renameFurnitureData=true to rename all furniture references
            const result = await RenameNitroProject(project.path, newName, oldName, true);
            if (result) {
                // For .rspr files, the path stays the same (furniture rename, not file rename)
                // For .nitro files, the path changes
                const newProjectName = getFileNameFromPath(result.path);
                const pathChanged = result.path !== project.path;

                setProjects(prev => {
                    const next = { ...prev };
                    if (pathChanged) {
                        // File was renamed (.nitro files)
                        delete next[selectedProject];
                        next[newProjectName] = {
                            path: result.path,
                            files: result.files as any
                        };
                    } else {
                        // Just update the files in place (.rspr files)
                        next[selectedProject] = {
                            ...next[selectedProject],
                            files: result.files as any
                        };
                    }
                    return next;
                });

                if (pathChanged) {
                    setSelectedProject(newProjectName);
                    addToRecent(result.path);
                    removeFromRecent(project.path);
                }

                setSelectedFile(null);
                setFileContent("");
                setIsDirty(false);

                showNotification(`Renamed to ${newName} successfully!`, "success");
            }
        } catch (err) {
            console.error("Failed to rename:", err);
            showNotification("Failed to rename: " + err, "error");
        }
    };

    const handleSaveFileAs = async (projectName: string, fileName: string) => {
        try {
            const project = projects[projectName];
            if (!project) return;

            const fileContent = project.files[fileName];
            if (!fileContent) return;

            // For text files, decode the content first, then encode to base64
            // For binary files, the content is already base64
            let contentBase64: string;
            if (fileName.endsWith('.json') || fileName.endsWith('.xml') || fileName.endsWith('.txt') || fileName.endsWith('.atlas')) {
                // Text file - decode and re-encode to base64
                const decoded = decodeContent(fileContent);
                contentBase64 = btoa(unescape(encodeURIComponent(decoded)));
            } else {
                // Binary file (image) - already base64
                contentBase64 = fileContent;
            }

            // Call Wails SaveFileAs with save dialog
            // @ts-ignore
            const savedPath = await SaveFileAs(contentBase64, fileName);

            if (savedPath) {
                showNotification(`File saved to "${savedPath}"`, "success");
            }
        } catch (err) {
            console.error("Failed to save file:", err);
            showNotification("Failed to save file: " + err, "error");
        }
    };

    const handleExportFile = async (projectName: string, fileName: string) => {
        // Export is the same as Save As for now
        await handleSaveFileAs(projectName, fileName);
    };

    const handleRenameFile = (projectName: string, fileName: string) => {
        setFileToRename({ projectName, fileName });
        setNewFileName(fileName);
        setRenameFileDialogOpen(true);
    };

    const handleRenameProject = (projectName: string) => {
        setProjectToRename(projectName);
        setNewProjectName(projectName.replace('.rspr', ''));
        setRenameProjectDialogOpen(true);
    };

    const handleConfirmRenameProject = async () => {
        if (!projectToRename) return;

        const newName = newProjectName.trim();
        if (!newName || newName === projectToRename.replace('.rspr', '')) {
            setRenameProjectDialogOpen(false);
            setProjectToRename(null);
            return;
        }

        try {
            const project = projects[projectToRename];
            if (!project) {
                showNotification("Project not found", "error");
                return;
            }

            // @ts-ignore - renameFurnitureData=false to only rename the project file, not the furniture data
            const result = await RenameNitroProject(project.path, newName, '', false);

            if (!result || !result.files) {
                showNotification("Failed to rename project: Invalid response", "error");
                return;
            }

            const newProjectName = getFileNameFromPath(result.path);

            setProjects(prev => {
                const next = { ...prev };
                delete next[projectToRename];
                next[newProjectName] = {
                    path: result.path,
                    files: result.files as any
                };
                return next;
            });

            setSelectedProject(newProjectName);
            setSelectedFile(null);
            addToRecent(result.path);
            removeFromRecent(project.path);

            showNotification(`Project renamed to ${newName}.rspr`, "success");
            setRenameProjectDialogOpen(false);
            setProjectToRename(null);
        } catch (err) {
            console.error("Failed to rename project:", err);
            showNotification("Failed to rename project: " + err, "error");
        }
    };

    const handleConfirmRenameFile = async () => {
        if (!fileToRename) return;
        const { projectName, fileName } = fileToRename;

        if (!newFileName || newFileName === fileName) {
            setRenameFileDialogOpen(false);
            setFileToRename(null);
            return;
        }

        try {
            const project = projects[projectName];
            if (!project) return;

            const fileContent = project.files[fileName];
            if (!fileContent) return;

            // Update project with renamed file
            setProjects(prev => ({
                ...prev,
                [projectName]: {
                    ...prev[projectName],
                    files: {
                        ...prev[projectName].files,
                        [newFileName]: fileContent
                    }
                }
            }));

            // Remove old file
            setProjects(prev => {
                const updatedFiles = { ...prev[projectName].files };
                delete updatedFiles[fileName];
                return {
                    ...prev,
                    [projectName]: {
                        ...prev[projectName],
                        files: updatedFiles
                    }
                };
            });

            // Update selected file if it was the renamed one
            if (selectedProject === projectName && selectedFile === fileName) {
                setSelectedFile(newFileName);
            }

            showNotification(`File renamed to "${newFileName}"`, "success");
        } catch (err) {
            console.error("Failed to rename file:", err);
            showNotification("Failed to rename file: " + err, "error");
        } finally {
            setRenameFileDialogOpen(false);
            setFileToRename(null);
            setNewFileName("");
        }
    };

    const handleDeleteFile = (projectName: string, fileName: string) => {
        setFileToDelete({ projectName, fileName });
        setDeleteFileDialogOpen(true);
    };

    const handleConfirmDeleteFile = async () => {
        if (!fileToDelete) return;
        const { projectName, fileName } = fileToDelete;

        try {
            // Remove file from project
            setProjects(prev => {
                const updatedFiles = { ...prev[projectName].files };
                delete updatedFiles[fileName];
                return {
                    ...prev,
                    [projectName]: {
                        ...prev[projectName],
                        files: updatedFiles
                    }
                };
            });

            // Clear selection if it was the deleted file
            if (selectedProject === projectName && selectedFile === fileName) {
                setSelectedFile(null);
                setFileContent("");
            }

            showNotification(`File "${fileName}" deleted`, "success");
        } catch (err) {
            console.error("Failed to delete file:", err);
            showNotification("Failed to delete file: " + err, "error");
        } finally {
            setDeleteFileDialogOpen(false);
            setFileToDelete(null);
        }
    };

    const handleDownloadImage = async () => {
        if (!selectedFile || !fileContent) return;

        try {
            // fileContent is already base64 for images
            // @ts-ignore
            const savedPath = await SaveFileAs(fileContent, selectedFile);

            if (savedPath) {
                showNotification(`Image saved to "${savedPath}"`, "success");
            }
        } catch (err) {
            console.error("Failed to save image:", err);
            showNotification("Failed to save image: " + err, "error");
        }
    };

    const handleDownloadSpritesheet = async () => {
        if (!linkedImageContent || !parsedJson?.spritesheet) return;

        try {
            // Get spritesheet filename from parsedJson
            const spritesheetName = parsedJson.spritesheet || 'spritesheet.png';

            // linkedImageContent is already base64
            // @ts-ignore
            const savedPath = await SaveFileAs(linkedImageContent, spritesheetName);

            if (savedPath) {
                showNotification(`Spritesheet saved to "${savedPath}"`, "success");
            }
        } catch (err) {
            console.error("Failed to save spritesheet:", err);
            showNotification("Failed to save spritesheet: " + err, "error");
        }
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            {isLoading ? (
                <SplashScreen onComplete={() => setIsLoading(false)} />
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
                    <MainToolbar
                    projectName={selectedProject || ""}
                    projectPath={selectedProject ? projects[selectedProject].path : ""}
                    hasProject={!!selectedProject}
                    onOpenNitro={handleOpenFile}
                    onSaveNitro={handleExportNitro}
                    onOpenProject={handleOpenProject}
                    onSaveProject={handleSaveProjectAs}
                    onConvert={handleConvertSWF}
                    onCloseProject={() => selectedProject && handleCloseProject(selectedProject)}
                    onBatchConvert={() => setBatchConverterDialogOpen(true)}
                />

                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                    <Box sx={{
                        width: isSidebarOpen ? sidebarWidth : 0,
                        minWidth: isSidebarOpen ? 150 : 0,
                        borderRight: '1px solid #333',
                        display: 'flex',
                        flexDirection: 'column',
                        bgcolor: 'background.paper',
                        zIndex: 10,
                        position: 'relative',
                        transition: isResizing.current ? 'none' : 'width 0.2s ease',
                        overflow: 'hidden'
                    }}>
                        <Box p={1.5} borderBottom="1px solid #333" display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                EXPLORER
                            </Typography>
                            <IconButton size="small" onClick={toggleSidebar}>
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <FileExplorer
                            projects={projects}
                            selectedProject={selectedProject}
                            selectedFile={selectedFile}
                            onSelectProject={handleProjectSelect}
                            onSelectFile={handleFileSelect}
                            onCloseProject={handleCloseProject}
                            onSaveFileAs={handleSaveFileAs}
                            onExportFile={handleExportFile}
                            onRenameFile={handleRenameFile}
                            onDeleteFile={handleDeleteFile}
                            onRenameProject={handleRenameProject}
                        />

                        <Box
                            sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '4px',
                                cursor: 'col-resize',
                                '&:hover': {
                                    bgcolor: 'primary.main',
                                },
                                zIndex: 20
                            }}
                            onMouseDown={startResizing}
                        />
                    </Box>

                    {!isSidebarOpen && (
                        <Box sx={{ borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, bgcolor: 'background.paper' }}>
                            <IconButton size="small" onClick={toggleSidebar}>
                                <ChevronRightIcon />
                            </IconButton>
                        </Box>
                    )}

                    <Box sx={{ flexGrow: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {selectedProject ? (
                            selectedFile ? (
                                <>
                                    {selectedFile.endsWith('.json') && parsedJson && (
                                        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                                            <Tabs
                                                value={tabIndex}
                                                onChange={(_, v) => setTabIndex(v)}
                                                variant="scrollable"
                                                scrollButtons="auto"
                                                sx={{ minHeight: 48 }}
                                            >
                                                <Tab label="Preview" icon={<VisibilityIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />
                                                <Tab label="Settings" icon={<SettingsIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />
                                                <Tab label="Code / View" icon={<TextSnippetIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />

                                                {parsedJson?.spritesheet && (
                                                    <Tab label="Sprite Editor" icon={<AppsIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />
                                                )}
                                                {parsedJson?.assets && (
                                                    <Tab label="Positions (Assets)" icon={<OpenWithIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />
                                                )}
                                                {parsedJson?.visualizations && (
                                                    <Tab label="Layers" icon={<LayersIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />
                                                )}
                                                {parsedJson?.spritesheet && (
                                                    <Tab label="Images (Raw)" icon={<PhotoIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 48 }} />
                                                )}
                                            </Tabs>
                                        </Box>
                                    )}

                                    <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>

                                        {/* Render specialized view for non-JSON or JSON without specific furniture tabs */}
                                        {(!selectedFile.endsWith('.json') || !parsedJson) ? (
                                            <Box sx={{ height: '100%', width: '100%' }}>
                                                {isImageFile(selectedFile) ? (
                                                    <Box sx={{
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        height: '100%',
                                                        bgcolor: '#1e1e1e',
                                                        backgroundImage: 'linear-gradient(45deg, #252525 25%, transparent 25%), linear-gradient(-45deg, #252525 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #252525 75%), linear-gradient(-45deg, transparent 75%, #252525 75%)',
                                                        backgroundSize: '20px 20px',
                                                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                                        position: 'relative'
                                                    }}>
                                                        <img
                                                            src={`data:image/png;base64,${fileContent}`}
                                                            alt={selectedFile}
                                                            style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }}
                                                        />
                                                        <Tooltip title="Download Image">
                                                            <IconButton
                                                                onClick={handleDownloadImage}
                                                                sx={{
                                                                    position: 'absolute',
                                                                    top: 16,
                                                                    right: 16,
                                                                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                                                                    '&:hover': {
                                                                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                                                                    }
                                                                }}
                                                            >
                                                                <DownloadIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                ) : (
                                                    <TextField
                                                        multiline
                                                        fullWidth
                                                        variant="standard"
                                                        value={fileContent}
                                                        onChange={(e) => {
                                                            setFileContent(e.target.value);
                                                            setIsDirty(true);
                                                        }}
                                                        inputProps={{
                                                            style: {
                                                                fontFamily: 'Consolas, "Courier New", monospace',
                                                                lineHeight: '1.5',
                                                                whiteSpace: 'pre',
                                                                fontSize: '13px',
                                                                tabSize: 4
                                                            }
                                                        }}
                                                        sx={{
                                                            height: '100%',
                                                            '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', p: 2 },
                                                            '& .MuiInputBase-input': { height: '100% !important', overflow: 'auto !important' },
                                                            '& .MuiInput-underline:before': { borderBottom: 'none' },
                                                            '& .MuiInput-underline:after': { borderBottom: 'none' },
                                                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' }
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        ) : (
                                            <>
                                                {parsedJson?.spritesheet && (
                                                    <Box role="tabpanel" hidden={tabIndex !== 0} sx={{ height: '100%', width: '100%' }}>
                                                        {tabIndex === 0 && (
                                                            <FurniturePreview
                                                                jsonContent={parsedJson}
                                                                images={currentProjectFiles}
                                                                avatarTesting={avatarTestingState}
                                                                onAvatarTestingChange={setAvatarTestingState}
                                                            />
                                                        )}
                                                    </Box>
                                                )}

                                                <Box role="tabpanel" hidden={tabIndex !== 1} sx={{ height: '100%', width: '100%' }}>
                                                    {tabIndex === 1 && (
                                                        <FurnitureSettings
                                                            jsonContent={parsedJson}
                                                            onUpdate={handleJsonUpdate}
                                                            onRename={handleRename}
                                                            avatarTesting={avatarTestingState}
                                                            onAvatarTestingChange={setAvatarTestingState}
                                                        />
                                                    )}
                                                </Box>

                                                <Box role="tabpanel" hidden={tabIndex !== 2} sx={{ height: '100%', width: '100%' }}>
                                                    {tabIndex === 2 && (
                                                        <CodeEditor
                                                            value={fileContent}
                                                            onChange={(newContent) => {
                                                                setFileContent(newContent);
                                                                setIsDirty(true);
                                                            }}
                                                            onSave={handleSaveFile}
                                                        />
                                                    )}
                                                </Box>

                                                {parsedJson?.spritesheet && (
                                                    <Box role="tabpanel" hidden={tabIndex !== 3} sx={{ height: '100%', width: '100%' }}>
                                                        {tabIndex === 3 && (
                                                            <SpriteEditor
                                                                jsonContent={parsedJson}
                                                                imageContent={linkedImageContent}
                                                                onUpdate={handleJsonUpdate}
                                                            />
                                                        )}
                                                    </Box>
                                                )}

                                                <Box role="tabpanel" hidden={tabIndex !== 4} sx={{ height: '100%', width: '100%' }}>
                                                    {tabIndex === 4 && (
                                                        <AssetEditor
                                                            jsonContent={parsedJson}
                                                            onUpdate={handleJsonUpdate}
                                                            images={currentProjectFiles}
                                                            avatarTesting={avatarTestingState}
                                                            onAvatarTestingChange={setAvatarTestingState}
                                                        />
                                                    )}
                                                </Box>

                                                {parsedJson?.visualizations && (
                                                    <Box role="tabpanel" hidden={tabIndex !== 5} sx={{ height: '100%', width: '100%' }}>
                                                        {tabIndex === 5 && (
                                                            <LayersEditor
                                                                jsonContent={parsedJson}
                                                                onUpdate={handleJsonUpdate}
                                                            />
                                                        )}
                                                    </Box>
                                                )}

                                                {parsedJson?.spritesheet && (
                                                    <Box role="tabpanel" hidden={tabIndex !== 6} sx={{ height: '100%', width: '100%' }}>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            height: '100%',
                                                            bgcolor: '#1e1e1e',
                                                            overflow: 'auto',
                                                            position: 'relative'
                                                        }}>
                                                            {linkedImageContent && (
                                                                <>
                                                                    <img
                                                                        src={`data:image/png;base64,${linkedImageContent}`}
                                                                        alt="Raw Sheet"
                                                                        style={{ maxWidth: '100%', display: 'block' }}
                                                                    />
                                                                    <Tooltip title="Download Spritesheet">
                                                                        <IconButton
                                                                            onClick={handleDownloadSpritesheet}
                                                                            sx={{
                                                                                position: 'absolute',
                                                                                top: 16,
                                                                                right: 16,
                                                                                bgcolor: 'rgba(0, 0, 0, 0.5)',
                                                                                '&:hover': {
                                                                                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                                                                                }
                                                                            }}
                                                                        >
                                                                            <DownloadIcon />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                )}
                                            </>
                                        )}

                                    </Box>
                                </>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.5 }}>
                                    <InsertDriveFileIcon sx={{ fontSize: 60, mb: 2 }} />
                                    <Typography variant="h6">No File Selected</Typography>
                                    <Typography variant="body2">Select a file from the explorer</Typography>
                                </Box>
                            )
                        ) : (
                            <RecentProjects
                                recentProjects={recentProjects}
                                onOpenPath={handleLoadRecent}
                                onOpenProject={handleOpenProject}
                                onOpenNitro={handleOpenFile}
                                onRemoveRecent={removeFromRecent}
                            />
                        )}
                    </Box>
                </Box>
            </Box>
            )}

            {isDirty && (
                <Box sx={{ position: 'fixed', bottom: 32, right: 32, display: 'flex', gap: 2, zIndex: 1000 }}>
                    <Tooltip title="Reset to saved">
                        <Fab color="error" size="medium" onClick={handleResetRequest}>
                            <RestoreIcon />
                        </Fab>
                    </Tooltip>
                    <Tooltip title="Save changes">
                        <Fab color="primary" size="large" onClick={handleSaveFile}>
                            <SaveIcon />
                        </Fab>
                    </Tooltip>
                </Box>
            )}

            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>

            <UpdateDialog
                open={updateDialogOpen}
                onClose={() => setUpdateDialogOpen(false)}
                updateInfo={updateInfo}
            />

            <BatchConverterDialog
                open={batchConverterDialogOpen}
                onClose={() => setBatchConverterDialogOpen(false)}
            />

            <Dialog
                open={!!pendingRenameName}
                onClose={() => setPendingRenameName(null)}
            >
                <DialogTitle>Rename Project?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        The furniture name has changed to <strong>{pendingRenameName}</strong>.
                        Do you want to rename the entire project and all assets to match?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPendingRenameName(null)} color="inherit">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmRename} variant="contained" color="primary" autoFocus>
                        Rename Project
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={resetDialogOpen}
                onClose={() => setResetDialogOpen(false)}
            >
                <DialogTitle>Reset Changes?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to reset to the last saved state?
                        <strong> All unsaved changes will be lost.</strong>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetDialogOpen(false)} color="inherit" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmReset} variant="contained" color="error">
                        Reset Changes
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
            >
                <DialogTitle>{confirmDialogTitle}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmDialogContent}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)} color="inherit" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={onConfirmAction} variant="contained" color="error">
                        Discard Changes
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={renameFileDialogOpen}
                onClose={() => {
                    setRenameFileDialogOpen(false);
                    setFileToRename(null);
                    setNewFileName("");
                }}
            >
                <DialogTitle>Rename File</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Enter a new name for <strong>{fileToRename?.fileName}</strong>
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleConfirmRenameFile();
                            }
                        }}
                        variant="outlined"
                        size="small"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setRenameFileDialogOpen(false);
                        setFileToRename(null);
                        setNewFileName("");
                    }} color="inherit">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmRenameFile} variant="contained" color="primary">
                        Rename
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={renameProjectDialogOpen}
                onClose={() => {
                    setRenameProjectDialogOpen(false);
                    setProjectToRename(null);
                    setNewProjectName("");
                }}
            >
                <DialogTitle>Rename Project File</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Enter a new name for the project file <strong>{projectToRename}</strong>
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleConfirmRenameProject();
                            }
                        }}
                        variant="outlined"
                        size="small"
                        helperText="This will only rename the .rspr file, not the furniture inside"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setRenameProjectDialogOpen(false);
                        setProjectToRename(null);
                        setNewProjectName("");
                    }} color="inherit">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmRenameProject} variant="contained" color="primary">
                        Rename
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={deleteFileDialogOpen}
                onClose={() => {
                    setDeleteFileDialogOpen(false);
                    setFileToDelete(null);
                }}
            >
                <DialogTitle>Delete File?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete <strong>{fileToDelete?.fileName}</strong>?
                        <br />
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setDeleteFileDialogOpen(false);
                        setFileToDelete(null);
                    }} color="inherit" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmDeleteFile} variant="contained" color="error">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider >
    );
}

export default App;