# Retrosprite

**Retrosprite** is a modern, high-performance asset editor and converter for Habbo Hotel retro servers, built for the **Nitro** client ecosystem. It allows users to view, edit, and convert SWF assets into Nitro-compatible JSON formats with a sleek, dark-themed UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Version](https://img.shields.io/badge/version-1.1.3-blue.svg)

## Features

### Sprite Editor
-   **Visual Spritesheet Management**: Browse and edit individual sprites with thumbnail previews
-   **Advanced Image Operations**:
    -   Crop, resize, and flip sprites with real-time preview
    -   Replace individual sprites or entire spritesheets
    -   Extract single sprites or batch extract with layer organization
-   **Live Sync**: Watch external sprite directories and auto-update spritesheets on file changes
-   **Undo/Redo**: Full history support for all sprite editing operations

### Positions Editor (Asset Editor)
-   **Direction-Aware Editing**: View and edit all 4 furniture directions (0, 2, 4, 6)
    -   Editable directions: 0 and 2
    -   Auto-mirrored directions: 4 (from 2) and 6 (from 0)
-   **Visual Positioning**: Drag-and-drop sprites on isometric grid canvas
-   **Layer Management**:
    -   Filter by specific layers (A, B, C, SD, etc.) or view all
    -   Context-aware layer properties sidebar
    -   Edit z-index, alpha, ink mode, tags, and mouse interaction
-   **Asset Cards**: Visual cards showing layer badges, thumbnails, positions, and flip toggles
-   **Avatar Testing**: Full Habbo avatar integration for furniture preview
    -   Tile-based positioning on isometric grid
    -   Sub-layer control for fine z-index positioning
    -   Customizable actions, gestures, and directions
    -   Shared state with Preview tab

### Layers Editor
-   **Global Layer Management**: Add, delete, and edit layers across all visualizations
-   **Layer Properties**: Configure z-index, alpha, ink modes, tags, and mouse behavior
-   **Visualization Selector**: Switch between multiple visualization configurations
-   **Contextual Help**: Built-in documentation for layer properties

### Preview Tab
-   **Real-Time Animation Playback**: View furniture animations with FPS control
-   **Direction Rotation**: Preview all 4 isometric directions
-   **Avatar Testing**: Same integrated avatar system as Positions tab
-   **Icon Display**: Automatic furniture icon extraction and display
-   **Isometric Grid Overlay**: Visual grid for spatial reference

### Settings & Configuration
-   **Metadata Editor**: Edit furniture name, description, and type
-   **Visualization Settings**: Configure size, angle, and layer structure
-   **Asset Configuration**: Manage spritesheet settings and frame definitions

### Developer Tools
-   **Integrated Code Editor**: CodeMirror-powered JSON editor with syntax highlighting
-   **File Explorer**: Navigate and manage project files efficiently
-   **Recent Projects**: Quick access sidebar for previously opened projects
-   **Auto-Save**: Automatic project state persistence

### Asset Conversion
-   **SWF to Nitro Conversion**: Convert legacy SWF furniture to Nitro JSON format
    -   Automatic spritesheet packing (2048px wide, height-sorted)
    -   XML to JSON transformation (assets, visualizations, animations)
    -   Icon extraction from spritesheets
-   **Batch Conversion**: Convert multiple SWF files simultaneously
-   **Smart Rename**: Automatically update internal references when renaming projects
-   **Binary Format Support**: Read and write `.nitro` binary format
    -   Per-file zlib compression
    -   BigEndian format compliance
    -   Double base64 decoding for SWF-extracted PNGs

### User Experience
-   **Modern UI**: Material UI (MUI) design with custom dark theme
-   **Cross-Platform**: Native performance on Windows, macOS, and Linux
-   **File Association**: Register `.rspr` project files for seamless workflow
-   **Auto-Update Checker**: GitHub-integrated update notifications
-   **Unsaved Changes Protection**: Confirmation dialogs prevent data loss
-   **Resizable Sidebar**: Customizable workspace layout

## Tech Stack

### Frontend
-   **Framework**: React 19.2.0 with TypeScript
-   **Build Tool**: Vite (with Rolldown optimization)
-   **UI Library**: Material UI (MUI) 7.3.6
-   **Code Editor**: CodeMirror with JSON language support
-   **Styling**: Emotion (CSS-in-JS)

### Backend
-   **Framework**: [Wails v2](https://wails.io/) (Go + Web)
-   **Language**: Go 1.18+
-   **Image Processing**: Go standard library (image/png, image/color)
-   **Compression**: zlib for .nitro format
-   **File Watching**: fsnotify for live sync
-   **HTTP Client**: net/http for update checking

### Development Tools
-   **Package Manager**: npm
-   **Type Checking**: TypeScript 5.9.3
-   **Linting**: ESLint with React hooks plugin
-   **Version Control**: Git with automated releases

### Build & Deployment
-   **Binary Compilation**: Wails CLI
-   **Windows Installer**: NSIS (Nullsoft Scriptable Install System)
-   **macOS Distribution**: DMG with universal binary (Intel + Apple Silicon)
-   **CI/CD**: GitHub Actions with automated versioning

## Getting Started

### Prerequisites

-   **Go**: 1.18 or higher
-   **Node.js**: 16 or higher
-   **Wails CLI**: Install with `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Bopified/Retrosprite.git
   cd Retrosprite
   ```

2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. Run the development server:
   ```bash
   wails dev
   ```

The application will start with hot-reload enabled for both frontend and backend changes.

### Building for Production

#### Quick Build
```bash
wails build
```

The compiled binary will be available in `build/bin/`.

#### Platform-Specific Builds

**Windows**:
```bash
wails build -platform windows/amd64
```

**macOS** (Universal Binary - Intel + Apple Silicon):
```bash
wails build -platform darwin/universal
```

**Linux**:
```bash
wails build -platform linux/amd64
```

#### Windows Installer
For Windows users, you can create an installer with file association support:

1. Build the application:
   ```bash
   wails build
   ```

2. Build the NSIS installer:
   ```bash
   cd build/windows
   makensis installer.nsi
   ```

The installer will:
- Install Retrosprite to Program Files
- Create desktop and Start Menu shortcuts
- Register `.rspr` file association
- Add uninstaller to Windows Settings

See [BUILD_INSTALLER.md](BUILD_INSTALLER.md) for detailed instructions.

### Releases

Retrosprite uses automated GitHub Actions for releases:

1. Update version in `wails.json`:
   ```json
   {
     "version": "1.1.3",
     "productVersion": "1.1.3"
   }
   ```

2. Commit and create a git tag:
   ```bash
   git add wails.json
   git commit -m "chore: bump version to 1.1.3"
   git tag v1.1.3
   git push origin main
   git push origin v1.1.3
   ```

3. GitHub Actions automatically:
   - Builds Windows installer (NSIS)
   - Builds macOS DMG (universal binary)
   - Creates GitHub release with auto-generated notes
   - Attaches binaries to release

The version is injected at build time using:
```bash
wails build -ldflags "-X main.Version=1.1.3"
```

See [RELEASING.md](RELEASING.md) for detailed release instructions (if available).

## Project Structure

```
Retrosprite/
├── app.go                 # Main application logic
├── convert.go             # Asset conversion utilities
├── mapper.go              # Asset mapping functions
├── json_structs.go        # JSON data structures
├── xml_structs.go         # XML parsing structures
├── nitro.go               # Nitro format handlers
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── assets/        # Static assets
│   │   └── App.tsx        # Main app component
│   └── package.json
├── build/
│   └── windows/          # Windows build resources
│       ├── installer.nsi # NSIS installer script
│       └── icon.ico      # Application icon
└── wails.json            # Wails configuration
```

## Usage

### Opening Projects
-   **File > Open Project**: Browse and open existing `.rspr` project files
-   **File > Open Nitro File**: Load `.nitro` binary format files
-   **Recent Projects**: Click on recently opened projects from the sidebar
-   **Recent Projects**: Managed automatically with up to 10 most recent files

### Converting SWF Assets
1. **File > Convert SWF to Nitro**: Select an SWF furniture file
2. The converter automatically:
   - Extracts embedded sprites and XML metadata
   - Packs sprites into a 2048px-wide spritesheet
   - Converts XML (assets, visualizations, animations) to Nitro JSON
   - Generates furniture icon from `_icon_a` frame
3. Save as `.nitro` file (includes both `.nitro` binary and extracted icon PNG in ZIP)

### Batch Converting SWF Files
1. **File > Batch Convert SWFs**: Select multiple SWF files
2. Monitor conversion progress in the dialog
3. Review results and failed conversions
4. All successful conversions are saved as `.nitro` files

### Editing Sprites
1. Open a project and navigate to the **Sprite Editor** tab
2. Browse sprites with visual thumbnails
3. Select a sprite to:
   - **Crop**: Define custom crop area with x, y, width, height
   - **Resize**: Scale to new dimensions
   - **Flip**: Flip horizontally or vertically
   - **Replace**: Upload a new image to replace the sprite
   - **Extract**: Save individual sprites or batch extract organized by layer
4. Use **Live Sync** to watch a folder and auto-update sprites on file changes
5. Use **Undo/Redo** to revert changes

### Positioning Assets
1. Navigate to the **Positions** tab
2. Select a direction (0 or 2 for editing; 4 and 6 are read-only mirrors)
3. Filter by layer or view all layers
4. Adjust positions:
   - Drag sprites on the visual canvas
   - Enter precise X/Y coordinates in asset cards
   - Toggle horizontal flip for individual assets
5. Edit layer properties in the sidebar:
   - Z-index for stacking order
   - Alpha for transparency (0-255)
   - Ink mode (ADD/COPY for blend effects)
   - Tag (COLOR1, COLOR2, BADGE for user customization)
   - ignoreMouse for click-through behavior

### Testing with Avatars
1. In **Positions** or **Preview** tab, enable **Avatar Testing**
2. Configure avatar:
   - Enter username for Habbo Imager
   - Select action (std, sit, wav, etc.)
   - Choose gesture and direction
3. Position avatar on isometric grid:
   - Adjust tile row/col for position
   - Use sub-layer slider for fine z-index control (positions avatar between furniture layers)
   - Adjust height offset for vertical positioning
4. Preview furniture and avatar interaction in real-time

### Managing Layers
1. Navigate to the **Layers** tab
2. View all layers across visualizations
3. Add new layers or delete existing ones
4. Edit layer properties (z-index, alpha, ink, tag, ignoreMouse)
5. Switch between multiple visualization configurations

### Previewing Animations
1. Navigate to the **Preview** tab
2. Use animation controls:
   - Play/pause animation
   - Adjust FPS (frames per second)
   - Rotate through all 4 directions
3. Enable avatar testing to see furniture-avatar interaction
4. View automatically extracted furniture icon

### Editing Metadata
1. Navigate to the **Settings** tab
2. Edit furniture name, description, and type
3. Configure visualization settings (size, angle)
4. Manage spritesheet metadata

### Direct Code Editing
1. Navigate to the **Code Editor** tab
2. Edit JSON directly with syntax highlighting
3. Changes sync with visual editors in real-time

### Renaming Projects
1. **File > Rename Project**
2. Enter new name
3. Choose whether to rename furniture data references
4. All internal references update automatically

### Saving Projects
-   **File > Save Project**: Save current project (Ctrl+S)
-   **File > Save As**: Save with a new name or location
-   **Auto-save**: Project state persists automatically to `.rspr` format

## File Formats

### `.rspr` Project Files
Retrosprite's native project format (JSON-based):
```json
{
  "version": "1.0.1",
  "name": "furniture_name",
  "files": {
    "furniture.json": "base64_encoded_content",
    "spritesheet.png": "base64_encoded_png"
  },
  "settings": {
    "lastOpenedFile": "furniture.json"
  }
}
```
- All binary content (images) is base64-encoded
- Text files (JSON, XML) are stored as base64 for consistency
- Settings track last opened file for restoration

### `.nitro` Binary Format
Nitro's native binary format for furniture assets:
- **Header**: `[FileCount:UI16]` (BigEndian unsigned 16-bit integer)
- **Per File**:
  - `[NameLen:UI16]` - Length of filename
  - `[Name]` - Filename string
  - `[CompressedLen:UI32]` - Length of compressed data (BigEndian unsigned 32-bit)
  - `[ZlibData]` - Individually zlib-compressed file content
- Each file is compressed separately (not the entire archive)
- Allows random access to individual files without full decompression
- **Special case**: PNG data from SWF conversion may be double base64 encoded
  - Detection: prefix `"YVZa"` = base64("iVBORw")
  - Retrosprite automatically detects and decodes correctly

### Nitro JSON Structure
```json
{
  "name": "furniture_name",
  "spritesheet": {
    "meta": {
      "app": "Retrosprite",
      "image": "furniture.png"
    },
    "frames": {
      "furniture_64_a_0_0": {
        "frame": { "x": 0, "y": 0, "w": 64, "h": 64 }
      }
    }
  },
  "visualizations": [
    {
      "angle": 45,
      "size": 64,
      "layers": {
        "0": { "x": 0, "y": 0, "z": 0, "alpha": 255 }
      },
      "directions": {
        "0": { "layers": {} }
      },
      "animations": {
        "0": { "layers": {} }
      }
    }
  ]
}
```

**Sprite Naming Convention**: `{furniture}_{size}_{layer}_{direction}_{frame}`

**Layer Properties**:
- `z`: Z-index for stacking order (integer)
- `alpha`: Transparency 0-255 (0=invisible, 255=opaque)
- `ink`: Blend mode - "ADD" (additive) or "COPY" (normal)
- `ignoreMouse`: Boolean - pass-through clicks if true
- `tag`: String - "COLOR1", "COLOR2", or "BADGE" for user customization points

## Architecture

### Backend (Go)
-   **`app.go`** (508 lines) - Main Wails application
    -   Project management (.rspr format)
    -   GitHub API integration for updates
    -   Icon extraction and file dialogs
-   **`nitro.go`** (141 lines) - Binary .nitro format handler
    -   BigEndian binary parsing
    -   Per-file zlib compression/decompression
    -   Double base64 detection and decoding
-   **`convert.go`** (298 lines) - SWF to Nitro converter
    -   SWF tag parsing (ImageTag, DefineBinaryData, SymbolClass)
    -   XML extraction and processing
    -   Spritesheet packing (2048px wide, height-sorted descending)
    -   JSON metadata generation
-   **`mapper.go`** (189 lines) - XML ↔ JSON transformation
    -   Habbo XML to Nitro JSON conversion
    -   Handles assets, visualizations, animations, layers, palettes
-   **`swf/` package** - Custom SWF parser
    -   Bitfield reader for variable-length fields
    -   Tag-based format with length prefixes

### Frontend (React + TypeScript)
-   **`App.tsx`** (~1500 lines) - Main component with centralized state
    -   Monolithic state management (no Redux/Context)
    -   7 tabbed views: Sprite Editor, Positions, Layers, Preview, Settings, Code Editor, File Explorer
    -   Avatar testing state shared between Positions and Preview
-   **Component Hierarchy**:
    -   **MainToolbar** - File/Edit menus
    -   **SpriteEditor** - Spritesheet metadata editing
    -   **AssetEditor** - Position assets + layer properties + avatar testing
    -   **LayersEditor** - Global layer management
    -   **FurniturePreview** - Canvas renderer with animations
    -   **FurnitureSettings** - Metadata configuration
    -   **CodeEditor** - Raw JSON editing (CodeMirror)
    -   **FileExplorer** - Project file browsing
    -   **RecentProjects** - Sidebar with recent files

### Wails Bridge
Retrosprite uses **Wails v2** to connect Go backend with React frontend:
1. Public methods on `App` struct in `app.go` are callable from React
2. TypeScript bindings auto-generated in `frontend/src/wailsjs/`
3. Async/await interface for frontend calls
4. Wails handles serialization transparently

**Example**:
```typescript
import { OpenNitroFile } from './wailsjs/go/main/App';
const result = await OpenNitroFile(); // Calls Go, returns *NitroResponse
```

After modifying Go methods, run `wails generate module` to update TypeScript bindings.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
-   Follow existing code style and conventions
-   Write clear commit messages
-   Test your changes thoroughly
-   Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

-   Built with [Wails](https://wails.io/) - Go + Web framework
-   UI components from [Material-UI](https://mui.com/)
-   Code editor powered by [CodeMirror](https://codemirror.net/)

## Contact

**Author**: Bopified
**Email**: Bopified@proton.me

---

Made with ❤️ for the Habbo retro community
