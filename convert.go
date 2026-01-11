package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"os"
	"retrosprite/swf"
	"sort"
	"strings"
)

type Sprite struct {
	Name string
	Img  image.Image
	Rect image.Rectangle
}

type ParsedSWF struct {
	Images       map[uint16]*swf.ImageTag
	BinaryData   map[uint16]*swf.DefineBinaryDataTag
	Symbols      map[string]uint16
	ClassNames   map[uint16]string
	ImageSources map[string]string // Maps asset names to sprite names
}

func ConvertSWFToNitro(swfPath string, defaultZ float64) (*NitroFile, error) {
	data, err := os.ReadFile(swfPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read SWF file: %w", err)
	}
	return ConvertSWFBytesToNitro(data, swfPath, defaultZ)
}

func ConvertSWFBytesToNitro(swfData []byte, filename string, defaultZ float64) (*NitroFile, error) {
	reader, err := swf.UncompressSWF(swfData)
	if err != nil {
		return nil, fmt.Errorf("failed to uncompress SWF: %w", err)
	}

	tags, err := swf.ReadTags(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read tags: %w", err)
	}

	parsed := &ParsedSWF{
		Images:       make(map[uint16]*swf.ImageTag),
		BinaryData:   make(map[uint16]*swf.DefineBinaryDataTag),
		Symbols:      make(map[string]uint16),
		ClassNames:   make(map[uint16]string),
		ImageSources: make(map[string]string),
	}

	for _, tag := range tags {
		switch t := tag.(type) {
		case *swf.ImageTag:
			parsed.Images[t.CharacterID] = t
		case *swf.DefineBinaryDataTag:
			parsed.BinaryData[t.TagID] = t
		case *swf.SymbolClassTag:
			for _, sym := range t.Symbols {
				parsed.Symbols[sym.Name] = sym.ID
				// Only set className for the first symbol we see for each ID
				// This ensures we use the canonical image name, not aliases
				if _, exists := parsed.ClassNames[sym.ID]; !exists {
					parsed.ClassNames[sym.ID] = sym.Name
				}
			}
		}
	}

	// Build IMAGE_SOURCES map: maps asset names to actual sprite names
	// When multiple symbols point to the same character ID with different names,
	// we create source references
	for symbolName, charID := range parsed.Symbols {
		if _, exists := parsed.Images[charID]; exists {
			actualClassName := parsed.ClassNames[charID]
			// If symbol name differs from the image's class name, create a reference
			if symbolName != actualClassName {
				// Strip common prefix (document class) if present
				parsed.ImageSources[symbolName] = actualClassName
			}
		}
	}

	var assetsXML *AssetsXML
	var visXML *VisualizationDataXML
	var logicXML *LogicXML
	var indexXML *IndexXML
	var manifestXML *ManifestXML

	findXML := func(suffix string, dest interface{}) {
		for name, id := range parsed.Symbols {
			if strings.HasSuffix(name, "_"+suffix) || name == suffix {
				if bd, ok := parsed.BinaryData[id]; ok {
					xmlData := bd.Data
					// Replace ISO-8859-1 with UTF-8 to fix Go XML unmarshal issues
					sData := string(xmlData)
					sData = strings.Replace(sData, `encoding="ISO-8859-1"`, `encoding="UTF-8"`, 1)
					sData = strings.Replace(sData, `encoding="iso-8859-1"`, `encoding="UTF-8"`, 1)

					err := xml.Unmarshal([]byte(sData), dest)
					if err == nil {
						return
					} else {
						fmt.Printf("Error unmarshalling %s: %v\n", suffix, err)
					}
				}
			}
		}
	}

	findXML("assets", &assetsXML)
	findXML("visualization", &visXML)
	findXML("logic", &logicXML)
	findXML("index", &indexXML)
	findXML("manifest", &manifestXML)

	// Extract base name early so we can use it for sprite filtering
	baseName := strings.TrimSuffix(filename, ".swf")
	if idx := strings.LastIndex(baseName, "/"); idx != -1 {
		baseName = baseName[idx+1:]
	}
	if idx := strings.LastIndex(baseName, "\\"); idx != -1 {
		baseName = baseName[idx+1:]
	}
	baseName = strings.TrimSuffix(baseName, ".swf")

	// Build a set of sprite names that are actually needed (assets without source references)
	neededSprites := make(map[string]bool)
	if assetsXML != nil {
		for _, asset := range assetsXML.Assets {
			// Skip shadow and 32px assets
			if strings.HasPrefix(asset.Name, "sh_") || strings.Contains(asset.Name, "_32_") {
				continue
			}
			// If asset has no source, it needs its own sprite in the spritesheet
			if asset.Source == "" {
				neededSprites[asset.Name] = true
			} else {
				// If it has a source, mark the source as needed
				neededSprites[asset.Source] = true
			}
		}
	}

	var sprites []*Sprite

	// Only include sprites that match assets without source references
	for symbolName, charID := range parsed.Symbols {
		imgTag, exists := parsed.Images[charID]
		if !exists {
			continue
		}

		// Strip the document class prefix to get the asset name
		// symbolName format: "xmas_c22_teleskilift_xmas_c22_teleskilift_64_b_4_0"
		// assetName format: "xmas_c22_teleskilift_64_b_4_0"
		// We need to strip the first "xmas_c22_teleskilift_" prefix
		assetName := symbolName
		if baseName != "" {
			prefix := baseName + "_"
			if strings.HasPrefix(symbolName, prefix) {
				assetName = strings.TrimPrefix(symbolName, prefix)
			}
		}

		// Only include this sprite if it's needed by an asset
		if !neededSprites[assetName] {
			continue
		}

		img, err := imgTag.ToImage()
		if err != nil {
			fmt.Printf("Warning: Failed to decode image %d: %v\n", charID, err)
			continue
		}

		sprites = append(sprites, &Sprite{Name: symbolName, Img: img})
	}

	sheetName := baseName + ".png"
	sheetImg, sheetData, err := packSprites(sprites, sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to pack sprites: %w", err)
	}

	assetData := MapXMLtoAssetData(assetsXML, visXML, logicXML, indexXML, manifestXML, defaultZ, parsed.ImageSources)
	assetData.Spritesheet = sheetData
	assetData.Name = baseName // Ensure name is set

	files := make(map[string][]byte)

	jsonBytes, err := json.Marshal(assetData)
	if err != nil {
		return nil, err
	}

	files[baseName+".json"] = jsonBytes

	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, sheetImg); err != nil {
		return nil, err
	}
	files[sheetData.Meta.Image] = pngBuf.Bytes()

	return &NitroFile{Files: files}, nil
}

func packSprites(sprites []*Sprite, sheetName string) (image.Image, *SpritesheetData, error) {
	if len(sprites) == 0 {
		return image.NewRGBA(image.Rect(0, 0, 1, 1)), &SpritesheetData{}, nil
	}

	sort.Slice(sprites, func(i, j int) bool {
		return sprites[i].Img.Bounds().Dy() > sprites[j].Img.Bounds().Dy()
	})

	// Calculate max width and total height for vertical packing
	maxWidth := 0
	totalHeight := 0

	for _, s := range sprites {
		w := s.Img.Bounds().Dx()
		h := s.Img.Bounds().Dy()

		if w > maxWidth {
			maxWidth = w
		}
		totalHeight += h
	}

	// Pack sprites vertically
	currentY := 0
	var packedSprites []*Sprite

	for _, s := range sprites {
		w := s.Img.Bounds().Dx()
		h := s.Img.Bounds().Dy()

		// All sprites aligned at x=0, stacked vertically
		s.Rect = image.Rect(0, currentY, w, currentY+h)
		packedSprites = append(packedSprites, s)

		currentY += h
	}

	sheet := image.NewRGBA(image.Rect(0, 0, maxWidth, totalHeight))

	frames := make(map[string]SpritesheetFrame)

	for _, s := range packedSprites {
		draw.Draw(sheet, s.Rect, s.Img, s.Img.Bounds().Min, draw.Src)

		frames[s.Name] = SpritesheetFrame{
			Frame:            Rect{X: s.Rect.Min.X, Y: s.Rect.Min.Y, W: s.Rect.Dx(), H: s.Rect.Dy()},
			SourceSize:       Size{W: s.Rect.Dx(), H: s.Rect.Dy()},
			SpriteSourceSize: Rect{X: 0, Y: 0, W: s.Rect.Dx(), H: s.Rect.Dy()},
			Rotated:          false,
			Trimmed:          false,
			Pivot:            Point{X: 0.5, Y: 0.5},
		}
	}

	return sheet, &SpritesheetData{
		Meta: SpritesheetMeta{
			Image:  sheetName,
			Format: "RGBA8888",
			Size:   Size{W: maxWidth, H: totalHeight},
			Scale:  1,
		},
		Frames: frames,
	}, nil
}
