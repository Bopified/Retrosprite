package main

import "encoding/xml"

// --- Assets XML ---

type AssetsXML struct {
	XMLName  xml.Name     `xml:"assets"`
	Assets   []AssetEntry `xml:"asset"`
	Palettes []PaletteXML `xml:"palette"`
}

type AssetEntry struct {
	Name        string `xml:"name,attr"`
	Source      string `xml:"source,attr"`
	X           int    `xml:"x,attr"`
	Y           int    `xml:"y,attr"`
	FlipH       bool   `xml:"flipH,attr"`
	FlipV       bool   `xml:"flipV,attr"`
	UsesPalette bool   `xml:"usesPalette,attr"`
}

type PaletteXML struct {
	ID       int    `xml:"id,attr"`
	Source   string `xml:"source,attr"`
	Master   bool   `xml:"master,attr"`
	Tags     string `xml:"tags,attr"`
	Breed    int    `xml:"breed,attr"`
	ColorTag int    `xml:"colorTag,attr"`
	Color1   string `xml:"color1,attr"`
	Color2   string `xml:"color2,attr"`
}

type VisualizationDataXML struct {
	XMLName        xml.Name           `xml:"visualizationData"`
	Type           string             `xml:"type,attr"`
	Visualizations []VisualizationXML `xml:"graphics>visualization"`
}

type VisualizationXML struct {
	Size           int                  `xml:"size,attr"`
	LayerCount     int                  `xml:"layerCount,attr"`
	Angle          int                  `xml:"angle,attr"`
	Layers         []LayerXML           `xml:"layers>layer"`
	Directions     []VisualDirectionXML `xml:"directions>direction"`
	Colors         []ColorXML           `xml:"colors>color"`
	Animations     []AnimationXML       `xml:"animations>animation"`
	Postures       *PosturesXML         `xml:"postures"`
	Gestures       []GestureXML         `xml:"gestures>gesture"`
	DefaultPosture string               `xml:"defaultPosture,attr"`
}

type LayerXML struct {
	ID          int    `xml:"id,attr"`
	X           int    `xml:"x,attr"`
	Y           int    `xml:"y,attr"`
	Z           int    `xml:"z,attr"`
	Alpha       int    `xml:"alpha,attr"`
	Ink         string `xml:"ink,attr"`
	Tag         string `xml:"tag,attr"`
	IgnoreMouse bool   `xml:"ignoreMouse,attr"`
}

type VisualDirectionXML struct {
	ID     int        `xml:"id,attr"`
	Layers []LayerXML `xml:"layer"`
}

type ColorXML struct {
	ID     int             `xml:"id,attr"`
	Layers []ColorLayerXML `xml:"colorLayer"`
}

type ColorLayerXML struct {
	ID    int    `xml:"id,attr"`
	Color string `xml:"color,attr"`
}

type AnimationXML struct {
	ID                  int                 `xml:"id,attr"`
	TransitionTo        int                 `xml:"transitionTo,attr"`
	TransitionFrom      int                 `xml:"transitionFrom,attr"`
	ImmediateChangeFrom bool                `xml:"immediateChangeFrom,attr"`
	RandomStart         bool                `xml:"randomStart,attr"`
	Layers              []AnimationLayerXML `xml:"animationLayer"`
}

type AnimationLayerXML struct {
	ID             int                `xml:"id,attr"`
	LoopCount      int                `xml:"loopCount,attr"`
	FrameRepeat    int                `xml:"frameRepeat,attr"`
	Random         int                `xml:"random,attr"`
	FrameSequences []FrameSequenceXML `xml:"frameSequence"`
}

type FrameSequenceXML struct {
	LoopCount int        `xml:"loopCount,attr"`
	Random    int        `xml:"random,attr"`
	Frames    []FrameXML `xml:"frame"`
}

type FrameXML struct {
	ID      string           `xml:"id,attr"`
	X       int              `xml:"x,attr"`
	Y       int              `xml:"y,attr"`
	RandomX int              `xml:"randomX,attr"`
	RandomY int              `xml:"randomY,attr"`
	Offsets []FrameOffsetXML `xml:"offsets>offset"`
}

type FrameOffsetXML struct {
	Direction int `xml:"direction,attr"`
	X         int `xml:"x,attr"`
	Y         int `xml:"y,attr"`
}

type PosturesXML struct {
	DefaultPosture string       `xml:"defaultPosture,attr"`
	Postures       []PostureXML `xml:"posture"`
}

type PostureXML struct {
	ID          string `xml:"id,attr"`
	AnimationID int    `xml:"animationId,attr"`
}

type GestureXML struct {
	ID          string `xml:"id,attr"`
	AnimationID int    `xml:"animationId,attr"`
}

type ManifestXML struct {
	XMLName xml.Name        `xml:"manifest"`
	Library ManifestLibrary `xml:"library"`
}

type ManifestLibrary struct {
	Name    string          `xml:"name,attr"`
	Version string          `xml:"version,attr"`
	Assets  []ManifestAsset `xml:"assets>asset"`
}

type ManifestAsset struct {
	Name     string `xml:"name,attr"`
	MimeType string `xml:"mimeType,attr"`
}

type IndexXML struct {
	XMLName           xml.Name `xml:"object"`
	Type              string   `xml:"type,attr"`
	VisualizationType string   `xml:"visualization,attr"`
	LogicType         string   `xml:"logic,attr"`
}

type LogicXML struct {
	XMLName xml.Name      `xml:"objectData"`
	Model   LogicModelXML `xml:"model"`
}

type LogicModelXML struct {
	Dimensions LogicDimensionsXML  `xml:"dimensions"`
	Directions []LogicDirectionXML `xml:"directions>direction"`
}

type LogicDimensionsXML struct {
	X int     `xml:"x,attr"`
	Y int     `xml:"y,attr"`
	Z float64 `xml:"z,attr"`
}

type LogicDirectionXML struct {
	ID int `xml:"id,attr"`
}
