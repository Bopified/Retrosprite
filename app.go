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
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

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

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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

	nitro, err := ConvertSWFBytesToNitro(data, selection)
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
		nitroFile, err := ConvertSWFToNitro(swfPath)
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
