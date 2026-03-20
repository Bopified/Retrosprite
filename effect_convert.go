package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"image"
	"image/png"
	"os"
	"retrosprite/swf"
	"strings"
)

func ConvertEffectSWFToNitro(swfPath string, defaultZ float64) (*NitroFile, error) {
	data, err := os.ReadFile(swfPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read SWF file: %w", err)
	}
	return ConvertEffectSWFBytesToNitro(data, swfPath, defaultZ)
}

func ConvertEffectSWFBytesToNitro(swfData []byte, filename string, defaultZ float64) (*NitroFile, error) {
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
				if _, exists := parsed.ClassNames[sym.ID]; !exists {
					parsed.ClassNames[sym.ID] = sym.Name
				}
			}
		}
	}

	// Build IMAGE_SOURCES map
	for symbolName, charID := range parsed.Symbols {
		if _, exists := parsed.Images[charID]; exists {
			actualClassName := parsed.ClassNames[charID]
			if symbolName != actualClassName {
				parsed.ImageSources[symbolName] = actualClassName
			}
		}
	}

	var assetsXML *AssetsXML
	var visXML *VisualizationDataXML
	var logicXML *LogicXML
	var indexXML *IndexXML
	var manifestXML *ManifestXML
	var animXML *EffectAnimationXML

	findXML := func(suffix string, dest interface{}) {
		for name, id := range parsed.Symbols {
			if strings.HasSuffix(name, "_"+suffix) || name == suffix {
				if bd, ok := parsed.BinaryData[id]; ok {
					xmlData := bd.Data
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
	findXML("animation", &animXML)

	// Extract base name
	baseName := strings.TrimSuffix(filename, ".swf")
	if idx := strings.LastIndex(baseName, "/"); idx != -1 {
		baseName = baseName[idx+1:]
	}
	if idx := strings.LastIndex(baseName, "\\"); idx != -1 {
		baseName = baseName[idx+1:]
	}
	baseName = strings.TrimSuffix(baseName, ".swf")

	// Build needed sprites set - for effects, include all non-shadow sprites
	neededSprites := make(map[string]bool)
	if assetsXML != nil {
		for _, asset := range assetsXML.Assets {
			if strings.HasPrefix(asset.Name, "sh_") || strings.Contains(asset.Name, "_32_") {
				continue
			}
			if asset.Source == "" {
				neededSprites[asset.Name] = true
			} else {
				neededSprites[asset.Source] = true
			}
		}
	}

	// If no assets XML found, include all image sprites (common for some effects)
	includeAll := len(neededSprites) == 0

	var sprites []*Sprite

	for symbolName, charID := range parsed.Symbols {
		imgTag, exists := parsed.Images[charID]
		if !exists {
			continue
		}

		assetName := symbolName
		if baseName != "" {
			prefix := baseName + "_"
			if strings.HasPrefix(symbolName, prefix) {
				assetName = strings.TrimPrefix(symbolName, prefix)
			}
		}

		if !includeAll && !neededSprites[assetName] {
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

	assetData := MapXMLtoEffectAssetData(assetsXML, visXML, logicXML, indexXML, manifestXML, animXML, defaultZ, parsed.ImageSources)
	assetData.Spritesheet = sheetData
	assetData.Name = baseName

	files := make(map[string][]byte)

	jsonBytes, err := json.Marshal(assetData)
	if err != nil {
		return nil, err
	}

	files[baseName+".json"] = jsonBytes

	var pngBuf bytes.Buffer
	if sheetImg != nil {
		// Handle both *image.RGBA and image.Image
		if rgbaImg, ok := sheetImg.(*image.RGBA); ok {
			if err := png.Encode(&pngBuf, rgbaImg); err != nil {
				return nil, err
			}
		} else {
			if err := png.Encode(&pngBuf, sheetImg); err != nil {
				return nil, err
			}
		}
		files[sheetData.Meta.Image] = pngBuf.Bytes()
	}

	return &NitroFile{Files: files}, nil
}
