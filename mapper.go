package main

import (
	"strconv"
	"strings"
)

func MapXMLtoAssetData(
	assets *AssetsXML,
	vis *VisualizationDataXML,
	logic *LogicXML,
	index *IndexXML,
	manifest *ManifestXML,
	defaultZ float64,
) *AssetData {
	data := &AssetData{
		Assets:         make(map[string]Asset),
		Palettes:       make(map[string]AssetPalette),
		Visualizations: []AssetVisualizationData{},
	}

	if index != nil {
		data.Type = index.Type
		data.Visualization = index.VisualizationType
		data.Logic = index.LogicType
	}

	if assets != nil {
		mapAssets(assets, data)
	}

	if vis != nil {
		mapVisualization(vis, data)
	}

	if logic != nil {
		z := logic.Model.Dimensions.Z
		// Use configured default Z if it's 0 or missing
		if z == 0 {
			z = defaultZ
		}

		directions := mapLogicDirections(logic.Model.Directions)
		// Add default directions [0, 90] if missing or empty
		if len(directions) == 0 {
			directions = []int{0, 90}
		}

		data.LogicData = &AssetLogic{
			Model: AssetLogicModel{
				Dimensions: Dimensions3D{X: float64(logic.Model.Dimensions.X), Y: float64(logic.Model.Dimensions.Y), Z: z},
				Directions: directions,
			},
		}
	}

	return data
}

func mapLogic(xml *LogicXML, data *AssetData) {
}

func mapAssets(xml *AssetsXML, data *AssetData) {
	for _, asset := range xml.Assets {
		if strings.HasPrefix(asset.Name, "sh_") || strings.Contains(asset.Name, "_32_") {
			continue
		}

		a := Asset{
			Source:      asset.Source,
			X:           asset.X,
			Y:           asset.Y,
			FlipH:       asset.FlipH,
			FlipV:       asset.FlipV,
			UsesPalette: asset.UsesPalette,
		}
		if a.Source == "" {
		}

		data.Assets[asset.Name] = a
	}

	for _, pal := range xml.Palettes {
		p := AssetPalette{
			ID:       pal.ID,
			Source:   pal.Source,
			Master:   pal.Master,
			Breed:    pal.Breed,
			ColorTag: pal.ColorTag,
			Color1:   pal.Color1,
			Color2:   pal.Color2,
		}
		if pal.Tags != "" {
			p.Tags = strings.Split(pal.Tags, ",")
		}
		data.Palettes[strconv.Itoa(pal.ID)] = p
	}
}

func mapVisualization(xml *VisualizationDataXML, data *AssetData) {
	for _, v := range xml.Visualizations {
		if v.Size == 32 {
			continue
		}

		vis := AssetVisualizationData{
			LayerCount: v.LayerCount,
			Angle:      v.Angle,
			Size:       v.Size,
			Layers:     make(map[string]AssetVisualizationLayer),
			Directions: make(map[string]AssetVisualizationDirection),
			Colors:     make(map[string]AssetColor),
			Animations: make(map[string]AssetVisualAnimation),
			Gestures:   []AssetGesture{},
		}

		for _, l := range v.Layers {
			vis.Layers[strconv.Itoa(l.ID)] = AssetVisualizationLayer{
				X:           l.X,
				Y:           l.Y,
				Z:           l.Z,
				Alpha:       l.Alpha,
				Ink:         l.Ink,
				Tag:         l.Tag,
				IgnoreMouse: l.IgnoreMouse,
			}
		}

		for _, d := range v.Directions {
			dir := AssetVisualizationDirection{
				Layers: make(map[string]AssetVisualizationLayer),
			}
			for _, l := range d.Layers {
				dir.Layers[strconv.Itoa(l.ID)] = AssetVisualizationLayer{
					X:           l.X,
					Y:           l.Y,
					Z:           l.Z,
					Alpha:       l.Alpha,
					Ink:         l.Ink,
					Tag:         l.Tag,
					IgnoreMouse: l.IgnoreMouse,
				}
			}
			vis.Directions[strconv.Itoa(d.ID)] = dir
		}

		for _, c := range v.Colors {
			col := AssetColor{
				Layers: make(map[string]AssetColorLayer),
			}
			for _, cl := range c.Layers {
				colorInt := 0
				if cl.Color != "" {
					val, _ := strconv.ParseInt(strings.Replace(cl.Color, "#", "", -1), 16, 32)
					colorInt = int(val)
				}
				col.Layers[strconv.Itoa(cl.ID)] = AssetColorLayer{Color: colorInt}
			}
			vis.Colors[strconv.Itoa(c.ID)] = col
		}

		for _, anim := range v.Animations {
			a := AssetVisualAnimation{
				TransitionTo:        anim.TransitionTo,
				TransitionFrom:      anim.TransitionFrom,
				ImmediateChangeFrom: anim.ImmediateChangeFrom,
				RandomStart:         anim.RandomStart,
				Layers:              make(map[string]AssetVisualAnimationLayer),
			}

			for _, al := range anim.Layers {
				layer := AssetVisualAnimationLayer{
					LoopCount:      al.LoopCount,
					FrameRepeat:    al.FrameRepeat,
					Random:         al.Random,
					FrameSequences: make(map[string]AssetVisualAnimationSequence),
				}

				for i, fs := range al.FrameSequences {
					seq := AssetVisualAnimationSequence{
						LoopCount: fs.LoopCount,
						Random:    fs.Random,
						Frames:    make(map[string]AssetVisualAnimationSequenceFrame),
					}

					for j, f := range fs.Frames {
						fid := 0
						if f.ID != "" && f.ID != "NaN" {
							val, _ := strconv.Atoi(f.ID)
							fid = val
						}

						frame := AssetVisualAnimationSequenceFrame{
							ID:      fid,
							X:       f.X,
							Y:       f.Y,
							RandomX: f.RandomX,
							RandomY: f.RandomY,
							Offsets: make(map[string]AssetVisualAnimationSequenceFrameOffset),
						}

						for k, off := range f.Offsets {
							frame.Offsets[strconv.Itoa(k)] = AssetVisualAnimationSequenceFrameOffset{
								Direction: off.Direction,
								X:         off.X,
								Y:         off.Y,
							}
						}

						seq.Frames[strconv.Itoa(j)] = frame
					}

					layer.FrameSequences[strconv.Itoa(i)] = seq
				}

				a.Layers[strconv.Itoa(al.ID)] = layer
			}

			vis.Animations[strconv.Itoa(anim.ID)] = a
		}

		data.Visualizations = append(data.Visualizations, vis)
	}
}

func mapLogicDirections(dirs []LogicDirectionXML) []int {
	res := make([]int, len(dirs))
	for i, d := range dirs {
		res[i] = d.ID
	}
	return res
}
