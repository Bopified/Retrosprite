package main

import (
	"archive/zip"
	"bytes"
	"compress/zlib"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type RsprProject struct {
	Version  string            `json:"version"`
	Name     string            `json:"name"`
	Files    map[string]string `json:"files"` // Base64 encoded content
	Settings ProjectSettings   `json:"settings"`
	Path     string            `json:"path,omitempty"` // Internal use, not saved to JSON usually, but good for tracking
}

type ProjectSettings struct {
	LastOpenedFile string `json:"lastOpenedFile,omitempty"`
}

type AppSettings struct {
	DefaultZ float64 `json:"defaultZ"` // Default Z value for SWF conversions
}

type App struct {
	ctx            context.Context
	fileWatcher    *fsnotify.Watcher
	watcherPath    string
	watcherSprites map[string]string // spriteName -> filePath
	settings       AppSettings
}

func NewApp() *App {
	app := &App{
		settings: AppSettings{
			DefaultZ: 1.0, // Default value
		},
	}
	app.loadSettings()
	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// getSettingsPath returns the path to the settings file
func (a *App) getSettingsPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	settingsDir := filepath.Join(homeDir, ".retrosprite")
	if err := os.MkdirAll(settingsDir, 0755); err != nil {
		return "", err
	}

	return filepath.Join(settingsDir, "settings.json"), nil
}

// loadSettings loads app settings from disk
func (a *App) loadSettings() {
	path, err := a.getSettingsPath()
	if err != nil {
		return // Use defaults
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return // Use defaults
	}

	var settings AppSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return // Use defaults
	}

	a.settings = settings
}

// saveSettings saves app settings to disk
func (a *App) saveSettings() error {
	path, err := a.getSettingsPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(a.settings, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// GetSettings returns the current app settings
func (a *App) GetSettings() AppSettings {
	return a.settings
}

// SetDefaultZ sets the default Z value and saves settings
func (a *App) SetDefaultZ(z float64) error {
	a.settings.DefaultZ = z
	return a.saveSettings()
}

type NitroResponse struct {
	Path  string            `json:"path"`
	Files map[string][]byte `json:"files"`
}

// GitHubRelease represents a GitHub release from the API
type GitHubRelease struct {
	TagName    string `json:"tag_name"`
	Name       string `json:"name"`
	Body       string `json:"body"`
	HTMLURL    string `json:"html_url"`
	PreRelease bool   `json:"prerelease"`
	Draft      bool   `json:"draft"`
}

// UpdateInfo represents update information sent to frontend
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseName    string `json:"releaseName"`
	ReleaseNotes   string `json:"releaseNotes"`
	DownloadURL    string `json:"downloadUrl"`
	Error          string `json:"error,omitempty"`
}

// GetCurrentVersion returns the current app version
func (a *App) GetCurrentVersion() string {
	return Version
}

// CheckForUpdates checks GitHub for newer versions
func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	currentVersion := Version
	const githubAPI = "https://api.github.com/repos/Bopified/Retrosprite/releases/latest"

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Fetch latest release from GitHub
	resp, err := client.Get(githubAPI)
	if err != nil {
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVersion,
			Error:          "Failed to connect to update server",
		}, nil // Return gracefully, don't error out
	}
	defer resp.Body.Close()

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVersion,
			Error:          fmt.Sprintf("Update server returned status: %d", resp.StatusCode),
		}, nil
	}

	// Parse response
	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVersion,
			Error:          "Failed to parse update information",
		}, nil
	}

	// Skip drafts and pre-releases
	if release.Draft || release.PreRelease {
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVersion,
			LatestVersion:  currentVersion,
		}, nil
	}

	// Compare versions
	latestVersion := strings.TrimPrefix(release.TagName, "v")
	isNewer, err := isVersionNewer(currentVersion, latestVersion)
	if err != nil {
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVersion,
			Error:          "Failed to compare versions",
		}, nil
	}

	// Truncate release notes to first 500 characters for summary
	releaseNotes := release.Body
	if len(releaseNotes) > 500 {
		releaseNotes = releaseNotes[:500] + "..."
	}

	return &UpdateInfo{
		Available:      isNewer,
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		ReleaseName:    release.Name,
		ReleaseNotes:   releaseNotes,
		DownloadURL:    release.HTMLURL,
	}, nil
}

// isVersionNewer compares semantic versions (e.g., "1.0.0" vs "1.1.0")
// Returns true if newVersion > currentVersion
func isVersionNewer(current, new string) (bool, error) {
	currentParts := strings.Split(current, ".")
	newParts := strings.Split(new, ".")

	// Ensure we have at least 3 parts (major.minor.patch)
	if len(currentParts) < 3 || len(newParts) < 3 {
		return false, fmt.Errorf("invalid version format")
	}

	for i := 0; i < 3; i++ {
		currentNum, err := strconv.Atoi(currentParts[i])
		if err != nil {
			return false, err
		}
		newNum, err := strconv.Atoi(newParts[i])
		if err != nil {
			return false, err
		}

		if newNum > currentNum {
			return true, nil
		} else if newNum < currentNum {
			return false, nil
		}
	}

	return false, nil // Versions are equal
}

func (a *App) SaveProject(path string, project RsprProject, defaultName string) (string, error) {
	if path == "" {
		if defaultName != "" && !strings.HasSuffix(defaultName, ".rspr") {
			defaultName += ".rspr"
		}

		var err error
		path, err = runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "Save Project",
			DefaultFilename: defaultName,
			Filters: []runtime.FileFilter{
				{DisplayName: "Retrosprite Project", Pattern: "*.rspr"},
			},
		})
		if err != nil {
			return "", err
		}
		if path == "" {
			return "", nil
		}
	}

	// Ensure extension
	if !strings.HasSuffix(path, ".rspr") {
		path += ".rspr"
	}

	content, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return "", err
	}

	return path, os.WriteFile(path, content, 0644)
}

func (a *App) OpenProject() (*NitroResponse, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Project",
		Filters: []runtime.FileFilter{
			{DisplayName: "Retrosprite Project", Pattern: "*.rspr"},
		},
	})

	if err != nil {
		return nil, err
	}

	if selection == "" {
		return nil, nil
	}

	return a.LoadProject(selection)
}

func (a *App) LoadProject(path string) (*NitroResponse, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var project RsprProject
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, err
	}

	// Decode base64-encoded files for the frontend
	decodedFiles := make(map[string][]byte)
	for fileName, encodedContent := range project.Files {
		decoded, err := base64.StdEncoding.DecodeString(encodedContent)
		if err != nil {
			return nil, fmt.Errorf("failed to decode %s: %w", fileName, err)
		}
		decodedFiles[fileName] = decoded
	}

	return &NitroResponse{
		Path:  path,
		Files: decodedFiles,
	}, nil
}

func (a *App) OpenNitroFile() (*NitroResponse, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Nitro File",
		Filters: []runtime.FileFilter{
			{DisplayName: "Nitro Files", Pattern: "*.nitro"},
		},
	})

	if err != nil {
		return nil, err
	}

	if selection == "" {
		return nil, nil
	}

	return a.LoadNitroFile(selection)
}

func (a *App) LoadNitroFile(path string) (*NitroResponse, error) {
	nitro, err := ReadNitro(path)
	if err != nil {
		return nil, err
	}

	return &NitroResponse{
		Path:  path,
		Files: nitro.Files,
	}, nil
}

// extractIconFromNitro extracts the furniture icon from the nitro files
func extractIconFromNitro(files map[string][]byte, furnitureName string) ([]byte, error) {
	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found in nitro")
	}

	// Parse JSON to find icon frame
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Find the icon frame (ends with _icon_a)
	var iconFrame *SpritesheetFrame
	for frameName, frame := range assetData.Spritesheet.Frames {
		if strings.HasSuffix(frameName, "_icon_a") {
			iconFrame = &frame
			break
		}
	}

	if iconFrame == nil {
		return nil, fmt.Errorf("no icon frame found")
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode the PNG
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Extract the icon region
	iconRect := image.Rect(
		iconFrame.Frame.X,
		iconFrame.Frame.Y,
		iconFrame.Frame.X+iconFrame.Frame.W,
		iconFrame.Frame.Y+iconFrame.Frame.H,
	)

	// Create a new image with just the icon
	iconImg := image.NewRGBA(image.Rect(0, 0, iconFrame.Frame.W, iconFrame.Frame.H))
	for y := iconRect.Min.Y; y < iconRect.Max.Y; y++ {
		for x := iconRect.Min.X; x < iconRect.Max.X; x++ {
			iconImg.Set(x-iconRect.Min.X, y-iconRect.Min.Y, img.At(x, y))
		}
	}

	// Encode the icon as PNG
	var iconBuf bytes.Buffer
	if err := png.Encode(&iconBuf, iconImg); err != nil {
		return nil, fmt.Errorf("failed to encode icon PNG: %w", err)
	}

	return iconBuf.Bytes(), nil
}

// resizeImage resizes an image to fit within maxSize x maxSize using nearest-neighbor scaling
func resizeImage(src image.Image, maxSize int) image.Image {
	srcBounds := src.Bounds()
	srcW, srcH := srcBounds.Dx(), srcBounds.Dy()

	// Calculate scale to fit in maxSize x maxSize
	scale := float64(maxSize) / float64(max(srcW, srcH))
	if scale >= 1.0 {
		// Don't upscale, return original
		return src
	}

	dstW := int(float64(srcW) * scale)
	dstH := int(float64(srcH) * scale)

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

	// Nearest-neighbor scaling for speed
	for y := 0; y < dstH; y++ {
		for x := 0; x < dstW; x++ {
			srcX := int(float64(x) / scale)
			srcY := int(float64(y) / scale)
			dst.Set(x, y, src.At(srcX+srcBounds.Min.X, srcY+srcBounds.Min.Y))
		}
	}

	return dst
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// GenerateSpriteThumbnails creates thumbnails for all sprites in a project
func (a *App) GenerateSpriteThumbnails(files map[string][]byte) ([]SpriteInfo, error) {
	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON to get spritesheet.frames
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode the PNG
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Generate thumbnails for each frame
	sprites := make([]SpriteInfo, 0, len(assetData.Spritesheet.Frames))
	for frameName, frame := range assetData.Spritesheet.Frames {
		// Extract sprite region
		spriteRect := image.Rect(
			frame.Frame.X,
			frame.Frame.Y,
			frame.Frame.X+frame.Frame.W,
			frame.Frame.Y+frame.Frame.H,
		)

		// Create image with just the sprite
		spriteImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
		for y := spriteRect.Min.Y; y < spriteRect.Max.Y; y++ {
			for x := spriteRect.Min.X; x < spriteRect.Max.X; x++ {
				spriteImg.Set(x-spriteRect.Min.X, y-spriteRect.Min.Y, img.At(x, y))
			}
		}

		// Resize to 64x64 thumbnail
		thumbnailImg := resizeImage(spriteImg, 64)

		// Encode as PNG
		var thumbnailBuf bytes.Buffer
		if err := png.Encode(&thumbnailBuf, thumbnailImg); err != nil {
			return nil, fmt.Errorf("failed to encode thumbnail for %s: %w", frameName, err)
		}

		// Base64 encode
		thumbnailBase64 := base64.StdEncoding.EncodeToString(thumbnailBuf.Bytes())

		sprites = append(sprites, SpriteInfo{
			Name:      frameName,
			X:         frame.Frame.X,
			Y:         frame.Frame.Y,
			W:         frame.Frame.W,
			H:         frame.Frame.H,
			Thumbnail: thumbnailBase64,
		})
	}

	return sprites, nil
}

// ExtractSingleSprite extracts one sprite and saves it to a user-selected location
func (a *App) ExtractSingleSprite(files map[string][]byte, spriteName string) (string, error) {
	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return "", fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return "", fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return "", fmt.Errorf("no spritesheet data found")
	}

	// Find the frame
	frame, ok := assetData.Spritesheet.Frames[spriteName]
	if !ok {
		return "", fmt.Errorf("sprite %s not found in spritesheet", spriteName)
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return "", fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode the PNG
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return "", fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Extract sprite region
	spriteRect := image.Rect(
		frame.Frame.X,
		frame.Frame.Y,
		frame.Frame.X+frame.Frame.W,
		frame.Frame.Y+frame.Frame.H,
	)

	// Create image with just the sprite
	spriteImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
	for y := spriteRect.Min.Y; y < spriteRect.Max.Y; y++ {
		for x := spriteRect.Min.X; x < spriteRect.Max.X; x++ {
			spriteImg.Set(x-spriteRect.Min.X, y-spriteRect.Min.Y, img.At(x, y))
		}
	}

	// Show save dialog
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Sprite",
		DefaultFilename: spriteName + ".png",
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image", Pattern: "*.png"},
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to show save dialog: %w", err)
	}

	if savePath == "" {
		return "", fmt.Errorf("save cancelled")
	}

	// Encode and save PNG
	outFile, err := os.Create(savePath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer outFile.Close()

	if err := png.Encode(outFile, spriteImg); err != nil {
		return "", fmt.Errorf("failed to encode PNG: %w", err)
	}

	return savePath, nil
}

// ExtractMultipleSprites extracts selected sprites or all sprites
func (a *App) ExtractMultipleSprites(files map[string][]byte, spriteNames []string, organizeByLayer bool) (*ExtractSpritesResult, error) {
	// Show directory picker
	outputDir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Output Directory",
	})

	if err != nil {
		return nil, fmt.Errorf("failed to show directory dialog: %w", err)
	}

	if outputDir == "" {
		return nil, fmt.Errorf("directory selection cancelled")
	}

	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode the PNG
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// If spriteNames is empty, extract all
	if len(spriteNames) == 0 {
		for name := range assetData.Spritesheet.Frames {
			spriteNames = append(spriteNames, name)
		}
	}

	// Extract each sprite
	var errors []string
	extractedCount := 0

	for _, spriteName := range spriteNames {
		frame, ok := assetData.Spritesheet.Frames[spriteName]
		if !ok {
			errors = append(errors, fmt.Sprintf("sprite %s not found", spriteName))
			continue
		}

		// Extract sprite region
		spriteRect := image.Rect(
			frame.Frame.X,
			frame.Frame.Y,
			frame.Frame.X+frame.Frame.W,
			frame.Frame.Y+frame.Frame.H,
		)

		spriteImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
		for y := spriteRect.Min.Y; y < spriteRect.Max.Y; y++ {
			for x := spriteRect.Min.X; x < spriteRect.Max.X; x++ {
				spriteImg.Set(x-spriteRect.Min.X, y-spriteRect.Min.Y, img.At(x, y))
			}
		}

		// Determine output path
		var savePath string
		if organizeByLayer {
			// Extract layer from sprite name pattern: {name}_{size}_{layer}_{direction}_{frame}
			parts := strings.Split(spriteName, "_")
			layer := "unknown"
			if len(parts) >= 3 {
				layer = parts[len(parts)-3] // Layer is 3rd from end
			}

			layerDir := filepath.Join(outputDir, layer)
			if err := os.MkdirAll(layerDir, 0755); err != nil {
				errors = append(errors, fmt.Sprintf("failed to create directory %s: %v", layerDir, err))
				continue
			}

			savePath = filepath.Join(layerDir, spriteName+".png")
		} else {
			savePath = filepath.Join(outputDir, spriteName+".png")
		}

		// Save sprite
		outFile, err := os.Create(savePath)
		if err != nil {
			errors = append(errors, fmt.Sprintf("failed to create %s: %v", spriteName, err))
			continue
		}

		if err := png.Encode(outFile, spriteImg); err != nil {
			outFile.Close()
			errors = append(errors, fmt.Sprintf("failed to encode %s: %v", spriteName, err))
			continue
		}

		outFile.Close()
		extractedCount++
	}

	return &ExtractSpritesResult{
		Success:        len(errors) == 0,
		ExtractedCount: extractedCount,
		OutputPath:     outputDir,
		Errors:         errors,
	}, nil
}

// ExtractSpritesheet extracts the entire spritesheet PNG
func (a *App) ExtractSpritesheet(files map[string][]byte) (string, error) {
	// Find the JSON file to get spritesheet name
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return "", fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return "", fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return "", fmt.Errorf("no spritesheet data found")
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return "", fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Show save dialog
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Spritesheet",
		DefaultFilename: spritesheetName,
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image", Pattern: "*.png"},
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to show save dialog: %w", err)
	}

	if savePath == "" {
		return "", fmt.Errorf("save cancelled")
	}

	// Save the spritesheet
	if err := os.WriteFile(savePath, spritesheetData, 0644); err != nil {
		return "", fmt.Errorf("failed to save spritesheet: %w", err)
	}

	return savePath, nil
}

// ReplaceSingleSprite replaces one sprite in the spritesheet
func (a *App) ReplaceSingleSprite(files map[string][]byte, spriteName string, newSpriteData string) (map[string][]byte, error) {
	// Decode base64 newSpriteData
	newSpriteBytes, err := base64.StdEncoding.DecodeString(newSpriteData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode sprite data: %w", err)
	}

	// Decode new sprite PNG
	newSprite, err := png.Decode(bytes.NewReader(newSpriteBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to decode new sprite PNG: %w", err)
	}

	// Find the JSON file
	var jsonData []byte
	var jsonFileName string
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			jsonFileName = name
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Find the frame
	frame, ok := assetData.Spritesheet.Frames[spriteName]
	if !ok {
		return nil, fmt.Errorf("sprite %s not found in spritesheet", spriteName)
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode existing spritesheet
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Create new spritesheet by copying old one
	newSpritesheet := image.NewRGBA(img.Bounds())
	for y := img.Bounds().Min.Y; y < img.Bounds().Max.Y; y++ {
		for x := img.Bounds().Min.X; x < img.Bounds().Max.X; x++ {
			newSpritesheet.Set(x, y, img.At(x, y))
		}
	}

	// Get new sprite dimensions
	newBounds := newSprite.Bounds()
	newW := newBounds.Dx()
	newH := newBounds.Dy()

	// Overlay new sprite at the frame position
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			if frame.Frame.X+x < newSpritesheet.Bounds().Max.X && frame.Frame.Y+y < newSpritesheet.Bounds().Max.Y {
				newSpritesheet.Set(frame.Frame.X+x, frame.Frame.Y+y, newSprite.At(newBounds.Min.X+x, newBounds.Min.Y+y))
			}
		}
	}

	// Update frame metadata if dimensions changed
	if newW != frame.Frame.W || newH != frame.Frame.H {
		frame.Frame.W = newW
		frame.Frame.H = newH
		assetData.Spritesheet.Frames[spriteName] = frame
	}

	// Encode new spritesheet
	var spritesheetBuf bytes.Buffer
	if err := png.Encode(&spritesheetBuf, newSpritesheet); err != nil {
		return nil, fmt.Errorf("failed to encode new spritesheet: %w", err)
	}

	// Encode updated JSON
	updatedJSON, err := json.Marshal(assetData)
	if err != nil {
		return nil, fmt.Errorf("failed to encode JSON: %w", err)
	}

	// Debug logging
	fmt.Printf("[ReplaceSingleSprite] JSON file name: %s\n", jsonFileName)
	fmt.Printf("[ReplaceSingleSprite] Marshaled JSON length: %d bytes\n", len(updatedJSON))
	if len(updatedJSON) > 0 {
		fmt.Printf("[ReplaceSingleSprite] First 100 chars of JSON: %s\n", string(updatedJSON[:min(100, len(updatedJSON))]))
	} else {
		fmt.Printf("[ReplaceSingleSprite] WARNING: Marshaled JSON is empty!\n")
	}
	fmt.Printf("[ReplaceSingleSprite] Spritesheet buffer size: %d bytes\n", spritesheetBuf.Len())

	// Create updated files map
	updatedFiles := make(map[string][]byte)
	for name, data := range files {
		updatedFiles[name] = data
	}
	updatedFiles[spritesheetName] = spritesheetBuf.Bytes()
	updatedFiles[jsonFileName] = updatedJSON

	// Debug logging for final map
	fmt.Printf("[ReplaceSingleSprite] Returning %d files\n", len(updatedFiles))
	for name, data := range updatedFiles {
		fmt.Printf("[ReplaceSingleSprite]   %s: %d bytes\n", name, len(data))
	}

	return updatedFiles, nil
}

// ReplaceEntireSpritesheet replaces the entire spritesheet PNG
func (a *App) ReplaceEntireSpritesheet(files map[string][]byte, newSpritesheetData string) (map[string][]byte, error) {
	// Decode base64 newSpritesheetData
	newSpritesheetBytes, err := base64.StdEncoding.DecodeString(newSpritesheetData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet data: %w", err)
	}

	// Validate it's a PNG
	newImg, err := png.Decode(bytes.NewReader(newSpritesheetBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to decode new spritesheet PNG: %w", err)
	}

	// Get new dimensions
	newBounds := newImg.Bounds()
	newW := newBounds.Dx()
	newH := newBounds.Dy()

	// Find the JSON file
	var jsonData []byte
	var jsonFileName string
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			jsonFileName = name
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Validate all frame coordinates fit within new bounds
	for frameName, frame := range assetData.Spritesheet.Frames {
		if frame.Frame.X+frame.Frame.W > newW || frame.Frame.Y+frame.Frame.H > newH {
			return nil, fmt.Errorf("frame %s does not fit in new spritesheet (frame at %d+%d, %d+%d but spritesheet is %dx%d)",
				frameName, frame.Frame.X, frame.Frame.W, frame.Frame.Y, frame.Frame.H, newW, newH)
		}
	}

	// Update JSON meta.size
	assetData.Spritesheet.Meta.Size.W = newW
	assetData.Spritesheet.Meta.Size.H = newH

	// Encode updated JSON
	updatedJSON, err := json.Marshal(assetData)
	if err != nil {
		return nil, fmt.Errorf("failed to encode JSON: %w", err)
	}

	// Create updated files map
	spritesheetName := assetData.Spritesheet.Meta.Image
	updatedFiles := make(map[string][]byte)
	for name, data := range files {
		updatedFiles[name] = data
	}
	updatedFiles[spritesheetName] = newSpritesheetBytes
	updatedFiles[jsonFileName] = updatedJSON

	return updatedFiles, nil
}

// StartWatchingSpriteDirectory monitors a directory for sprite changes
func (a *App) StartWatchingSpriteDirectory(path string, spriteNames []string) error {
	// Stop existing watcher if any
	if a.fileWatcher != nil {
		a.fileWatcher.Close()
	}

	// Create new watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create file watcher: %w", err)
	}

	// Add path to watcher
	if err := watcher.Add(path); err != nil {
		watcher.Close()
		return fmt.Errorf("failed to watch directory: %w", err)
	}

	// Store watcher state
	a.fileWatcher = watcher
	a.watcherPath = path
	a.watcherSprites = make(map[string]string)
	for _, spriteName := range spriteNames {
		a.watcherSprites[spriteName] = filepath.Join(path, spriteName+".png")
	}

	// Start goroutine to listen for events
	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Op&fsnotify.Write == fsnotify.Write {
					// File modified
					filename := filepath.Base(event.Name)
					spriteName := strings.TrimSuffix(filename, filepath.Ext(filename))

					// Check if this is one of our watched sprites
					if _, watched := a.watcherSprites[spriteName]; watched {
						// Emit event to frontend
						runtime.EventsEmit(a.ctx, "sprite-file-changed", map[string]string{
							"spriteName": spriteName,
							"filePath":   event.Name,
						})
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				runtime.EventsEmit(a.ctx, "sprite-watcher-error", err.Error())
			}
		}
	}()

	return nil
}

// StopWatchingSpriteDirectory stops monitoring
func (a *App) StopWatchingSpriteDirectory() error {
	if a.fileWatcher != nil {
		if err := a.fileWatcher.Close(); err != nil {
			return fmt.Errorf("failed to stop file watcher: %w", err)
		}
		a.fileWatcher = nil
		a.watcherPath = ""
		a.watcherSprites = nil
	}
	return nil
}

// GetWatcherStatus returns current watching state
func (a *App) GetWatcherStatus() (*FileWatcherStatus, error) {
	if a.fileWatcher == nil {
		return &FileWatcherStatus{
			Watching:    false,
			Path:        "",
			FileCount:   0,
			SpriteNames: []string{},
		}, nil
	}

	spriteNames := make([]string, 0, len(a.watcherSprites))
	for name := range a.watcherSprites {
		spriteNames = append(spriteNames, name)
	}

	return &FileWatcherStatus{
		Watching:    true,
		Path:        a.watcherPath,
		FileCount:   len(a.watcherSprites),
		SpriteNames: spriteNames,
	}, nil
}

// ReadExternalFile reads a file from disk and returns it as base64
func (a *App) ReadExternalFile(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	return base64.StdEncoding.EncodeToString(data), nil
}

// CropSprite crops a sprite to a new rectangle
func (a *App) CropSprite(files map[string][]byte, spriteName string, cropX, cropY, cropW, cropH int) (map[string][]byte, error) {
	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Find the frame
	frame, ok := assetData.Spritesheet.Frames[spriteName]
	if !ok {
		return nil, fmt.Errorf("sprite %s not found in spritesheet", spriteName)
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode spritesheet
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Extract original sprite
	spriteRect := image.Rect(
		frame.Frame.X,
		frame.Frame.Y,
		frame.Frame.X+frame.Frame.W,
		frame.Frame.Y+frame.Frame.H,
	)

	spriteImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
	for y := spriteRect.Min.Y; y < spriteRect.Max.Y; y++ {
		for x := spriteRect.Min.X; x < spriteRect.Max.X; x++ {
			spriteImg.Set(x-spriteRect.Min.X, y-spriteRect.Min.Y, img.At(x, y))
		}
	}

	// Create cropped sprite
	croppedImg := image.NewRGBA(image.Rect(0, 0, cropW, cropH))
	for y := 0; y < cropH; y++ {
		for x := 0; x < cropW; x++ {
			if cropX+x < frame.Frame.W && cropY+y < frame.Frame.H {
				croppedImg.Set(x, y, spriteImg.At(cropX+x, cropY+y))
			}
		}
	}

	// Encode cropped sprite
	var croppedBuf bytes.Buffer
	if err := png.Encode(&croppedBuf, croppedImg); err != nil {
		return nil, fmt.Errorf("failed to encode cropped sprite: %w", err)
	}

	// Use ReplaceSingleSprite to update the spritesheet
	croppedBase64 := base64.StdEncoding.EncodeToString(croppedBuf.Bytes())
	return a.ReplaceSingleSprite(files, spriteName, croppedBase64)
}

// bilinearResize resizes an image using bilinear interpolation
func bilinearResize(src image.Image, dstW, dstH int) image.Image {
	srcBounds := src.Bounds()
	srcW, srcH := srcBounds.Dx(), srcBounds.Dy()

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

	scaleX := float64(srcW) / float64(dstW)
	scaleY := float64(srcH) / float64(dstH)

	for y := 0; y < dstH; y++ {
		for x := 0; x < dstW; x++ {
			// Calculate source coordinates
			srcX := float64(x) * scaleX
			srcY := float64(y) * scaleY

			// Get integer parts
			x1 := int(srcX)
			y1 := int(srcY)
			x2 := min(x1+1, srcW-1)
			y2 := min(y1+1, srcH-1)

			// Get fractional parts
			fx := srcX - float64(x1)
			fy := srcY - float64(y1)

			// Get four neighboring pixels
			c11 := src.At(x1+srcBounds.Min.X, y1+srcBounds.Min.Y)
			c21 := src.At(x2+srcBounds.Min.X, y1+srcBounds.Min.Y)
			c12 := src.At(x1+srcBounds.Min.X, y2+srcBounds.Min.Y)
			c22 := src.At(x2+srcBounds.Min.X, y2+srcBounds.Min.Y)

			// Convert to RGBA
			r11, g11, b11, a11 := c11.RGBA()
			r21, g21, b21, a21 := c21.RGBA()
			r12, g12, b12, a12 := c12.RGBA()
			r22, g22, b22, a22 := c22.RGBA()

			// Bilinear interpolation
			r := uint8((float64(r11)*(1-fx)*(1-fy) + float64(r21)*fx*(1-fy) + float64(r12)*(1-fx)*fy + float64(r22)*fx*fy) / 256)
			g := uint8((float64(g11)*(1-fx)*(1-fy) + float64(g21)*fx*(1-fy) + float64(g12)*(1-fx)*fy + float64(g22)*fx*fy) / 256)
			b := uint8((float64(b11)*(1-fx)*(1-fy) + float64(b21)*fx*(1-fy) + float64(b12)*(1-fx)*fy + float64(b22)*fx*fy) / 256)
			alpha := uint8((float64(a11)*(1-fx)*(1-fy) + float64(a21)*fx*(1-fy) + float64(a12)*(1-fx)*fy + float64(a22)*fx*fy) / 256)

			dst.Set(x, y, color.RGBA{R: r, G: g, B: b, A: alpha})
		}
	}

	return dst
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ResizeSprite resizes a sprite using bilinear interpolation
func (a *App) ResizeSprite(files map[string][]byte, spriteName string, newW, newH int) (map[string][]byte, error) {
	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Find the frame
	frame, ok := assetData.Spritesheet.Frames[spriteName]
	if !ok {
		return nil, fmt.Errorf("sprite %s not found in spritesheet", spriteName)
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode spritesheet
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Extract original sprite
	spriteRect := image.Rect(
		frame.Frame.X,
		frame.Frame.Y,
		frame.Frame.X+frame.Frame.W,
		frame.Frame.Y+frame.Frame.H,
	)

	spriteImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
	for y := spriteRect.Min.Y; y < spriteRect.Max.Y; y++ {
		for x := spriteRect.Min.X; x < spriteRect.Max.X; x++ {
			spriteImg.Set(x-spriteRect.Min.X, y-spriteRect.Min.Y, img.At(x, y))
		}
	}

	// Resize sprite
	resizedImg := bilinearResize(spriteImg, newW, newH)

	// Encode resized sprite
	var resizedBuf bytes.Buffer
	if err := png.Encode(&resizedBuf, resizedImg); err != nil {
		return nil, fmt.Errorf("failed to encode resized sprite: %w", err)
	}

	// Use ReplaceSingleSprite to update the spritesheet
	resizedBase64 := base64.StdEncoding.EncodeToString(resizedBuf.Bytes())
	return a.ReplaceSingleSprite(files, spriteName, resizedBase64)
}

// FlipSprite flips a sprite horizontally or vertically
func (a *App) FlipSprite(files map[string][]byte, spriteName string, horizontal bool) (map[string][]byte, error) {
	// Find the JSON file
	var jsonData []byte
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("no JSON file found")
	}

	// Parse JSON
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if assetData.Spritesheet == nil {
		return nil, fmt.Errorf("no spritesheet data found")
	}

	// Find the frame
	frame, ok := assetData.Spritesheet.Frames[spriteName]
	if !ok {
		return nil, fmt.Errorf("sprite %s not found in spritesheet", spriteName)
	}

	// Get the spritesheet PNG
	spritesheetName := assetData.Spritesheet.Meta.Image
	spritesheetData, ok := files[spritesheetName]
	if !ok {
		return nil, fmt.Errorf("spritesheet image not found: %s", spritesheetName)
	}

	// Decode spritesheet
	img, err := png.Decode(bytes.NewReader(spritesheetData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode spritesheet PNG: %w", err)
	}

	// Extract original sprite
	spriteRect := image.Rect(
		frame.Frame.X,
		frame.Frame.Y,
		frame.Frame.X+frame.Frame.W,
		frame.Frame.Y+frame.Frame.H,
	)

	spriteImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
	for y := spriteRect.Min.Y; y < spriteRect.Max.Y; y++ {
		for x := spriteRect.Min.X; x < spriteRect.Max.X; x++ {
			spriteImg.Set(x-spriteRect.Min.X, y-spriteRect.Min.Y, img.At(x, y))
		}
	}

	// Flip sprite
	flippedImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
	for y := 0; y < frame.Frame.H; y++ {
		for x := 0; x < frame.Frame.W; x++ {
			if horizontal {
				// Horizontal flip
				flippedImg.Set(frame.Frame.W-1-x, y, spriteImg.At(x, y))
			} else {
				// Vertical flip
				flippedImg.Set(x, frame.Frame.H-1-y, spriteImg.At(x, y))
			}
		}
	}

	// Encode flipped sprite
	var flippedBuf bytes.Buffer
	if err := png.Encode(&flippedBuf, flippedImg); err != nil {
		return nil, fmt.Errorf("failed to encode flipped sprite: %w", err)
	}

	// Use ReplaceSingleSprite to update the spritesheet
	flippedBase64 := base64.StdEncoding.EncodeToString(flippedBuf.Bytes())
	return a.ReplaceSingleSprite(files, spriteName, flippedBase64)
}

// createNitroZip creates a ZIP file containing the .nitro file and icon PNG
func createNitroZip(zipPath string, nitroPath string, iconData []byte, furnitureName string) error {
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Add the .nitro file
	nitroData, err := os.ReadFile(nitroPath)
	if err != nil {
		return fmt.Errorf("failed to read nitro file: %w", err)
	}

	nitroWriter, err := zipWriter.Create(filepath.Base(nitroPath))
	if err != nil {
		return fmt.Errorf("failed to create nitro entry in zip: %w", err)
	}

	if _, err := nitroWriter.Write(nitroData); err != nil {
		return fmt.Errorf("failed to write nitro data to zip: %w", err)
	}

	// Add the icon PNG
	iconWriter, err := zipWriter.Create(furnitureName + "_icon.png")
	if err != nil {
		return fmt.Errorf("failed to create icon entry in zip: %w", err)
	}

	if _, err := iconWriter.Write(iconData); err != nil {
		return fmt.Errorf("failed to write icon data to zip: %w", err)
	}

	return nil
}

func (a *App) SaveNitroFile(path string, files map[string][]byte, defaultName string) (string, error) {
	// Determine the furniture name from defaultName
	furnitureName := defaultName
	if furnitureName == "" {
		furnitureName = "furniture"
	}

	// Update the JSON metadata to set app to "Retrosprite"
	updatedFiles := make(map[string][]byte)
	for name, data := range files {
		if strings.HasSuffix(name, ".json") {
			// Parse the JSON
			var assetData AssetData
			if err := json.Unmarshal(data, &assetData); err == nil {
				// Update the meta app field
				if assetData.Spritesheet != nil {
					assetData.Spritesheet.Meta.App = "Retrosprite"
				}
				// Re-encode the JSON
				if updatedJSON, err := json.MarshalIndent(assetData, "", "  "); err == nil {
					updatedFiles[name] = updatedJSON
				} else {
					updatedFiles[name] = data // Keep original if re-encoding fails
				}
			} else {
				updatedFiles[name] = data // Keep original if parsing fails
			}
		} else {
			updatedFiles[name] = data
		}
	}

	if path == "" {
		// Change to .zip extension for the save dialog
		if defaultName != "" && !strings.HasSuffix(defaultName, ".zip") {
			defaultName += ".zip"
		}

		var err error
		path, err = runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "Save Nitro Package",
			DefaultFilename: defaultName,
			Filters: []runtime.FileFilter{
				{DisplayName: "ZIP Files", Pattern: "*.zip"},
			},
		})
		if err != nil {
			return "", err
		}
		if path == "" {
			return "", nil
		}
	}

	// Ensure .zip extension
	if !strings.HasSuffix(path, ".zip") {
		path += ".zip"
	}

	// Create a temporary .nitro file
	tempDir := os.TempDir()
	nitroPath := filepath.Join(tempDir, furnitureName+".nitro")

	nitro := &NitroFile{Files: updatedFiles}
	if err := WriteNitro(nitroPath, nitro); err != nil {
		return "", fmt.Errorf("failed to create temporary nitro file: %w", err)
	}
	defer os.Remove(nitroPath) // Clean up temp file

	// Extract the icon
	iconData, err := extractIconFromNitro(updatedFiles, furnitureName)
	if err != nil {
		return "", fmt.Errorf("failed to extract icon: %w", err)
	}

	// Create the ZIP file with .nitro and icon
	if err := createNitroZip(path, nitroPath, iconData, furnitureName); err != nil {
		return "", fmt.Errorf("failed to create zip package: %w", err)
	}

	return path, nil
}

func (a *App) ConvertSWF() (*NitroResponse, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select SWF File",
		Filters: []runtime.FileFilter{
			{DisplayName: "SWF Files", Pattern: "*.swf"},
		},
	})

	if err != nil {
		return nil, err
	}

	if selection == "" {
		return nil, nil
	}

	data, err := os.ReadFile(selection)
	if err != nil {
		return nil, err
	}

	nitro, err := ConvertSWFBytesToNitro(data, selection, a.settings.DefaultZ)
	if err != nil {
		return nil, err
	}

	savePath := strings.TrimSuffix(selection, ".swf") + ".nitro"
	err = WriteNitro(savePath, nitro)
	if err != nil {
		return nil, err
	}

	return &NitroResponse{
		Path:  savePath,
		Files: nitro.Files,
	}, nil
}

func (a *App) RenameNitroProject(currentPath string, newName string, oldName string, renameFurnitureData bool) (*NitroResponse, error) {
	if oldName == "" {
		baseName := filepath.Base(currentPath)
		oldName = strings.TrimSuffix(baseName, filepath.Ext(baseName))
	}

	// Check if it's a .rspr file (JSON format) or .nitro file (binary format)
	ext := strings.ToLower(filepath.Ext(currentPath))

	if ext == ".rspr" {
		// Handle .rspr (JSON) files
		data, err := os.ReadFile(currentPath)
		if err != nil {
			return nil, err
		}

		var project RsprProject
		if err := json.Unmarshal(data, &project); err != nil {
			return nil, err
		}

		var decodedFiles map[string][]byte
		var savePath string

		if renameFurnitureData {
			// Rename furniture data: update file names and content, but keep same .rspr filename
			project.Name = newName // Update internal furniture name
			newFiles := make(map[string]string)
			decodedFiles = make(map[string][]byte)

			for fileName, encodedContent := range project.Files {
				newFileName := strings.ReplaceAll(fileName, oldName, newName)

				// Decode the base64 content
				decoded, err := base64.StdEncoding.DecodeString(encodedContent)
				if err != nil {
					return nil, fmt.Errorf("failed to decode %s: %w", fileName, err)
				}

				// Replace old name in text files
				var newData []byte
				if isTextFile(fileName) {
					strContent := string(decoded)
					newStrContent := strings.ReplaceAll(strContent, oldName, newName)
					newData = []byte(newStrContent)
				} else {
					newData = decoded
				}

				// Re-encode to base64
				newFiles[newFileName] = base64.StdEncoding.EncodeToString(newData)
				decodedFiles[newFileName] = newData
			}

			project.Files = newFiles
			savePath = currentPath // Save to same file
		} else {
			// Rename project container: rename the .rspr file, keep furniture data unchanged
			project.Name = newName // Update project name
			decodedFiles = make(map[string][]byte)
			for fileName, encodedContent := range project.Files {
				decoded, err := base64.StdEncoding.DecodeString(encodedContent)
				if err != nil {
					return nil, fmt.Errorf("failed to decode %s: %w", fileName, err)
				}
				decodedFiles[fileName] = decoded
			}

			dir := filepath.Dir(currentPath)
			savePath = filepath.Join(dir, newName+".rspr") // New filename
		}

		project.Path = savePath
		content, err := json.MarshalIndent(project, "", "  ")
		if err != nil {
			return nil, err
		}

		if err := os.WriteFile(savePath, content, 0644); err != nil {
			return nil, err
		}

		// Delete old file if we renamed the container (paths are different)
		if currentPath != savePath {
			os.Remove(currentPath)
		}

		return &NitroResponse{
			Path:  savePath,
			Files: decodedFiles,
		}, nil
	}

	// Handle .nitro (binary) files
	nitro, err := ReadNitro(currentPath)
	if err != nil {
		return nil, err
	}

	newFiles := make(map[string][]byte)

	for fileName, data := range nitro.Files {
		newFileName := strings.ReplaceAll(fileName, oldName, newName)

		var newData []byte
		if isTextFile(fileName) {
			strContent := string(data)
			newStrContent := strings.ReplaceAll(strContent, oldName, newName)
			newData = []byte(newStrContent)
		} else {
			newData = data
		}

		newFiles[newFileName] = newData
	}

	dir := filepath.Dir(currentPath)
	newPath := filepath.Join(dir, newName+".nitro")

	newNitro := &NitroFile{Files: newFiles}
	if err := WriteNitro(newPath, newNitro); err != nil {
		return nil, err
	}

	// Delete old file if rename was successful and paths are different
	if currentPath != newPath {
		os.Remove(currentPath)
	}

	return &NitroResponse{
		Path:  newPath,
		Files: newFiles,
	}, nil
}

func isTextFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".json" || ext == ".xml" || ext == ".txt" || ext == ".atlas"
}

// SaveFileAs shows a save dialog and saves a file with custom name
// contentBase64 is the file content encoded as base64 string
func (a *App) SaveFileAs(contentBase64 string, defaultFileName string) (string, error) {
	// Determine file type for filter
	ext := filepath.Ext(defaultFileName)
	var filters []runtime.FileFilter

	switch strings.ToLower(ext) {
	case ".json":
		filters = []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
			{DisplayName: "All Files", Pattern: "*.*"},
		}
	case ".png", ".jpg", ".jpeg":
		filters = []runtime.FileFilter{
			{DisplayName: "Image Files", Pattern: "*.png;*.jpg;*.jpeg"},
			{DisplayName: "All Files", Pattern: "*.*"},
		}
	case ".xml":
		filters = []runtime.FileFilter{
			{DisplayName: "XML Files", Pattern: "*.xml"},
			{DisplayName: "All Files", Pattern: "*.*"},
		}
	default:
		filters = []runtime.FileFilter{
			{DisplayName: "All Files", Pattern: "*.*"},
		}
	}

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save File As",
		DefaultFilename: defaultFileName,
		Filters:         filters,
	})

	if err != nil {
		return "", err
	}

	if path == "" {
		return "", nil // User cancelled
	}

	// Decode base64 content - handle both text and binary content
	var content []byte

	// For text files, the content might already be plain text (not base64)
	// Try to determine if it's base64 or plain text
	if isTextFile(defaultFileName) {
		// Could be plain text or base64 encoded text
		// Try to decode as base64 first, if it fails, use as-is
		decoded, err := decodeBase64OrText(contentBase64)
		if err != nil {
			return "", fmt.Errorf("failed to decode content: %w", err)
		}
		content = decoded
	} else {
		// Binary files should always be base64 encoded
		decoded, err := base64.StdEncoding.DecodeString(contentBase64)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 content: %w", err)
		}
		content = decoded
	}

	// Write the file
	if err := os.WriteFile(path, content, 0644); err != nil {
		return "", err
	}

	return path, nil
}

// decodeBase64OrText attempts to decode base64, falls back to treating as plain text
func decodeBase64OrText(input string) ([]byte, error) {
	// Try standard base64 first
	if decoded, err := base64.StdEncoding.DecodeString(input); err == nil {
		return decoded, nil
	}

	// If that fails, try URL encoding
	if decoded, err := base64.URLEncoding.DecodeString(input); err == nil {
		return decoded, nil
	}

	// If both fail, assume it's plain text
	return []byte(input), nil
}

// BatchConversionFileResult represents the result of converting a single file
type BatchConversionFileResult struct {
	Path    string `json:"path"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// BatchConversionResult represents the result of a batch conversion
type BatchConversionResult struct {
	Success      bool                        `json:"success"`
	ZipPath      string                      `json:"zipPath"`
	SuccessCount int                         `json:"successCount"`
	ErrorCount   int                         `json:"errorCount"`
	Files        []BatchConversionFileResult `json:"files"`
}

// SelectMultipleSWFFiles opens a file dialog to select multiple SWF files
func (a *App) SelectMultipleSWFFiles() ([]string, error) {
	files, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select SWF Files",
		Filters: []runtime.FileFilter{
			{DisplayName: "SWF Files (*.swf)", Pattern: "*.swf"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})

	if err != nil {
		return nil, err
	}

	return files, nil
}

// BatchConvertSWFsToNitro converts multiple SWF files to Nitro format and packages them in a ZIP
func (a *App) BatchConvertSWFsToNitro(swfPaths []string) (*BatchConversionResult, error) {
	result := &BatchConversionResult{
		Success: true,
		Files:   make([]BatchConversionFileResult, 0),
	}

	// Ask user where to save the zip file
	zipPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Converted Files",
		DefaultFilename: "converted_nitro_files.zip",
		Filters: []runtime.FileFilter{
			{DisplayName: "ZIP Files (*.zip)", Pattern: "*.zip"},
		},
	})

	if err != nil || zipPath == "" {
		return nil, fmt.Errorf("save dialog cancelled")
	}

	result.ZipPath = zipPath

	// Create zip file
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Process each SWF file
	for _, swfPath := range swfPaths {
		fileResult := BatchConversionFileResult{
			Path:    swfPath,
			Success: false,
		}

		// Convert SWF to Nitro
		nitroFile, err := ConvertSWFToNitro(swfPath, a.settings.DefaultZ)
		if err != nil {
			fileResult.Error = fmt.Sprintf("conversion failed: %v", err)
			result.Files = append(result.Files, fileResult)
			result.ErrorCount++
			result.Success = false
			continue
		}

		// Get base name for the files
		baseName := filepath.Base(swfPath)
		baseName = strings.TrimSuffix(baseName, filepath.Ext(baseName))

		// Add .nitro file to zip
		nitroFileName := baseName + ".nitro"
		if err := addNitroToZip(zipWriter, nitroFileName, nitroFile); err != nil {
			fileResult.Error = fmt.Sprintf("failed to add nitro to zip: %v", err)
			result.Files = append(result.Files, fileResult)
			result.ErrorCount++
			result.Success = false
			continue
		}

		// Try to extract and add icon
		iconFileName := baseName + "_icon.png"
		if err := extractAndAddIcon(zipWriter, iconFileName, nitroFile); err != nil {
			// Icon extraction failure is not critical, just log it
			fmt.Printf("Warning: failed to extract icon for %s: %v\n", baseName, err)
		}

		fileResult.Success = true
		result.Files = append(result.Files, fileResult)
		result.SuccessCount++
	}

	return result, nil
}

// addNitroToZip adds a NitroFile to the zip archive
func addNitroToZip(zipWriter *zip.Writer, filename string, nitroFile *NitroFile) error {
	// Create a buffer to write the nitro file
	var buf bytes.Buffer

	// Write nitro file manually to buffer
	fileCount := uint16(len(nitroFile.Files))
	if err := binary.Write(&buf, binary.BigEndian, fileCount); err != nil {
		return err
	}

	for name, data := range nitroFile.Files {
		// Write name length
		nameLen := uint16(len(name))
		if err := binary.Write(&buf, binary.BigEndian, nameLen); err != nil {
			return err
		}

		// Write name
		if _, err := buf.WriteString(name); err != nil {
			return err
		}

		// Compress data
		var compressedBuf bytes.Buffer
		zlibW := zlib.NewWriter(&compressedBuf)
		if _, err := zlibW.Write(data); err != nil {
			zlibW.Close()
			return err
		}
		zlibW.Close()

		compressedData := compressedBuf.Bytes()
		fileLen := uint32(len(compressedData))

		// Write file length
		if err := binary.Write(&buf, binary.BigEndian, fileLen); err != nil {
			return err
		}

		// Write compressed data
		if _, err := buf.Write(compressedData); err != nil {
			return err
		}
	}

	// Add to zip
	writer, err := zipWriter.Create(filename)
	if err != nil {
		return err
	}

	_, err = writer.Write(buf.Bytes())
	return err
}

// extractAndAddIcon extracts the icon from a nitro file and adds it to the zip
func extractAndAddIcon(zipWriter *zip.Writer, filename string, nitroFile *NitroFile) error {
	// Find the JSON file
	var jsonData []byte
	for name, data := range nitroFile.Files {
		if strings.HasSuffix(name, ".json") {
			jsonData = data
			break
		}
	}

	if jsonData == nil {
		return fmt.Errorf("no JSON file found in nitro")
	}

	// Parse the JSON to find icon sprite name
	var assetData AssetData
	if err := json.Unmarshal(jsonData, &assetData); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Find icon sprite (usually ends with _icon_a)
	var iconSpriteName string
	if assetData.Spritesheet != nil {
		for frameName := range assetData.Spritesheet.Frames {
			if strings.Contains(frameName, "icon_a") || strings.Contains(frameName, "icon") {
				iconSpriteName = frameName
				break
			}
		}
	}

	if iconSpriteName == "" {
		return fmt.Errorf("no icon sprite found")
	}

	// Find the PNG file
	var pngData []byte
	for name, data := range nitroFile.Files {
		if strings.HasSuffix(name, ".png") {
			pngData = data
			break
		}
	}

	if pngData == nil {
		return fmt.Errorf("no PNG file found in nitro")
	}

	// Decode the spritesheet
	img, err := png.Decode(bytes.NewReader(pngData))
	if err != nil {
		return fmt.Errorf("failed to decode PNG: %w", err)
	}

	// Get the frame info
	frame := assetData.Spritesheet.Frames[iconSpriteName]

	// Extract the icon from the spritesheet
	iconRect := image.Rect(
		frame.Frame.X,
		frame.Frame.Y,
		frame.Frame.X+frame.Frame.W,
		frame.Frame.Y+frame.Frame.H,
	)

	// Create a new image with just the icon (starting at 0,0)
	iconImg := image.NewRGBA(image.Rect(0, 0, frame.Frame.W, frame.Frame.H))
	for y := iconRect.Min.Y; y < iconRect.Max.Y; y++ {
		for x := iconRect.Min.X; x < iconRect.Max.X; x++ {
			iconImg.Set(x-iconRect.Min.X, y-iconRect.Min.Y, img.At(x, y))
		}
	}

	// Encode icon as PNG
	var iconBuf bytes.Buffer
	if err := png.Encode(&iconBuf, iconImg); err != nil {
		return fmt.Errorf("failed to encode icon: %w", err)
	}

	// Add to zip
	writer, err := zipWriter.Create(filename)
	if err != nil {
		return err
	}

	_, err = writer.Write(iconBuf.Bytes())
	return err
}
