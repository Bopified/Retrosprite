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
	Images     map[uint16]*swf.ImageTag
	BinaryData map[uint16]*swf.DefineBinaryDataTag
	Symbols    map[string]uint16
	ClassNames map[uint16]string
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
		Images:     make(map[uint16]*swf.ImageTag),
		BinaryData: make(map[uint16]*swf.DefineBinaryDataTag),
		Symbols:    make(map[string]uint16),
		ClassNames: make(map[uint16]string),
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
				parsed.ClassNames[sym.ID] = sym.Name
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

	var sprites []*Sprite

	for id, imgTag := range parsed.Images {
		name, hasName := parsed.ClassNames[id]
		if !hasName {
			name = fmt.Sprintf("sprite_%d", id)
		}

		img, err := imgTag.ToImage()
		if err != nil {
			fmt.Printf("Warning: Failed to decode image %d: %v\n", id, err)
			continue
		}

		sprites = append(sprites, &Sprite{Name: name, Img: img})
	}

	baseName := strings.TrimSuffix(filename, ".swf")
	if idx := strings.LastIndex(baseName, "/"); idx != -1 {
		baseName = baseName[idx+1:]
	}
	if idx := strings.LastIndex(baseName, "\\"); idx != -1 {
		baseName = baseName[idx+1:]
	}
	baseName = strings.TrimSuffix(baseName, ".swf")

	sheetName := baseName + ".png"
	sheetImg, sheetData, err := packSprites(sprites, sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to pack sprites: %w", err)
	}

	assetData := MapXMLtoAssetData(assetsXML, visXML, logicXML, indexXML, manifestXML, defaultZ)
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
