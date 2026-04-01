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
	imageSources map[string]string,
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
		mapAssets(assets, data, imageSources)
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

func mapAssets(xml *AssetsXML, data *AssetData, imageSources map[string]string) {
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

		// Resolve source references using IMAGE_SOURCES map
		// This matches nitro-converter logic in AssetMapper.ts lines 54-64
		if a.Source != "" {
			// If the source is in imageSources, resolve it
			if resolved, exists := imageSources[a.Source]; exists {
				a.Source = resolved
			}
		}

		// Check if the asset name itself is in imageSources
		// This creates the source reference for assets
		if resolved, exists := imageSources[asset.Name]; exists {
			a.Source = resolved
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
			layer := AssetVisualizationLayer{
				X:           l.X,
				Y:           l.Y,
				Z:           l.Z,
				Ink:         l.Ink,
				Tag:         l.Tag,
				IgnoreMouse: l.IgnoreMouse,
			}
			if l.Alpha != 0 {
				layer.Alpha = &l.Alpha
			}
			vis.Layers[strconv.Itoa(l.ID)] = layer
		}

		for _, d := range v.Directions {
			dir := AssetVisualizationDirection{
				Layers: make(map[string]AssetVisualizationLayer),
			}
			for _, l := range d.Layers {
				layer := AssetVisualizationLayer{
					X:           l.X,
					Y:           l.Y,
					Z:           l.Z,
					Ink:         l.Ink,
					Tag:         l.Tag,
					IgnoreMouse: l.IgnoreMouse,
				}
				if l.Alpha != 0 {
					layer.Alpha = &l.Alpha
				}
				dir.Layers[strconv.Itoa(l.ID)] = layer
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
				ImmediateChangeFrom: anim.ImmediateChangeFrom,
				RandomStart:         anim.RandomStart,
				Layers:              make(map[string]AssetVisualAnimationLayer),
			}
			if anim.TransitionTo != 0 || anim.ID >= 100 {
				a.TransitionTo = &anim.TransitionTo
			}
			if anim.TransitionFrom != 0 || anim.ID >= 100 {
				a.TransitionFrom = &anim.TransitionFrom
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

// MapXMLtoEffectAssetData maps XML data to AssetData, including effect animation data
func MapXMLtoEffectAssetData(
	assets *AssetsXML,
	vis *VisualizationDataXML,
	logic *LogicXML,
	index *IndexXML,
	manifest *ManifestXML,
	animXML *EffectAnimationXML,
	defaultZ float64,
	imageSources map[string]string,
) *AssetData {
	data := MapXMLtoAssetData(assets, vis, logic, index, manifest, defaultZ, imageSources)

	if animXML != nil {
		mapEffectAnimation(animXML, data)
	}

	return data
}

func mapEffectAnimation(xml *EffectAnimationXML, data *AssetData) {
	anim := AssetAnimation{
		Name:          xml.Name,
		Desc:          xml.Desc,
		ResetOnToggle: xml.ResetOnToggle,
	}

	for _, d := range xml.Directions {
		anim.Directions = append(anim.Directions, AssetAnimationDirection{Offset: d.Offset})
	}

	for _, s := range xml.Shadows {
		anim.Shadows = append(anim.Shadows, AssetAnimationShadow{ID: s.ID})
	}

	for _, a := range xml.Adds {
		anim.Adds = append(anim.Adds, AssetAnimationAdd{
			ID:    a.ID,
			Align: a.Align,
			Blend: a.Blend,
			Ink:   a.Ink,
			Base:  a.Base,
		})
	}

	for _, r := range xml.Removes {
		anim.Removes = append(anim.Removes, AssetAnimationRemove{ID: r.ID})
	}

	for _, s := range xml.Sprites {
		sprite := AssetAnimationSprite{
			ID:         s.ID,
			Member:     s.Member,
			Directions: s.Directions,
			Ink:        s.Ink,
			StaticY:    s.StaticY,
		}
		for _, d := range s.DirList {
			sprite.DirList = append(sprite.DirList, AssetAnimationSpriteDirection{
				ID: d.ID, DX: d.DX, DY: d.DY, DZ: d.DZ,
			})
		}
		anim.Sprites = append(anim.Sprites, sprite)
	}

	for _, f := range xml.Frames {
		anim.Frames = append(anim.Frames, mapEffectFrame(f))
	}

	for _, a := range xml.Avatars {
		anim.Avatars = append(anim.Avatars, AssetAnimationAvatar{
			Background: a.Background,
			Foreground: a.Foreground,
			Ink:        a.Ink,
		})
	}

	for _, o := range xml.Overrides {
		override := AssetAnimationOverride{
			Name:     o.Name,
			Override: o.Override,
		}
		for _, f := range o.Frames {
			override.Frames = append(override.Frames, mapEffectFrame(f))
		}
		anim.Overrides = append(anim.Overrides, override)
	}

	if data.Animations == nil {
		data.Animations = make(map[string]AssetAnimation)
	}
	key := anim.Name
	if key == "" {
		key = "default"
	}
	data.Animations[key] = anim
}

func mapEffectFrame(f EffectFrameXML2) AssetAnimationFrame {
	frame := AssetAnimationFrame{
		Repeats: f.Repeats,
	}
	for _, fx := range f.FXs {
		frame.FXs = append(frame.FXs, mapEffectFramePart(fx))
	}
	for _, bp := range f.BodyParts {
		frame.BodyParts = append(frame.BodyParts, mapEffectFramePart(bp))
	}
	return frame
}

func mapEffectFramePart(p EffectFramePartXML) AssetAnimationFramePart {
	part := AssetAnimationFramePart{
		ID:     p.ID,
		Frame:  p.Frame,
		Base:   p.Base,
		Action: p.Action,
		DX:     p.DX,
		DY:     p.DY,
		DZ:     p.DZ,
		DD:     p.DD,
	}
	for _, item := range p.Items {
		part.Items = append(part.Items, AssetAnimationFramePartItem{
			ID:   item.ID,
			Base: item.Base,
		})
	}
	return part
}
