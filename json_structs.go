package main

type AssetData struct {
	Type           string                   `json:"-"`
	Name           string                   `json:"name,omitempty"`
	Visualization  string                   `json:"visualizationType,omitempty"`
	Logic          string                   `json:"logicType,omitempty"`
	Spritesheet    *SpritesheetData         `json:"spritesheet,omitempty"`
	Assets         map[string]Asset         `json:"assets,omitempty"`
	Palettes       map[string]AssetPalette  `json:"palettes,omitempty"`
	Visualizations []AssetVisualizationData `json:"visualizations,omitempty"`
	Index          *AssetIndex              `json:"index,omitempty"`
	LogicData      *AssetLogic              `json:"logic,omitempty"`
}

type SpritesheetData struct {
	Meta   SpritesheetMeta             `json:"meta"`
	Frames map[string]SpritesheetFrame `json:"frames"`
}

type SpritesheetMeta struct {
	App     string  `json:"app,omitempty"`
	Version string  `json:"version,omitempty"`
	Image   string  `json:"image"`
	Format  string  `json:"format"`
	Size    Size    `json:"size"`
	Scale   float64 `json:"scale"`
}

type Size struct {
	W int `json:"w"`
	H int `json:"h"`
}

type SpritesheetFrame struct {
	Frame            Rect  `json:"frame"`
	Rotated          bool  `json:"rotated"`
	Trimmed          bool  `json:"trimmed"`
	SpriteSourceSize Rect  `json:"spriteSourceSize"`
	SourceSize       Size  `json:"sourceSize"`
	Pivot            Point `json:"pivot"`
}

type Rect struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Asset struct {
	Source      string `json:"source,omitempty"`
	X           int    `json:"x,omitempty"`
	Y           int    `json:"y,omitempty"`
	FlipH       bool   `json:"flipH,omitempty"`
	FlipV       bool   `json:"flipV,omitempty"`
	UsesPalette bool   `json:"usesPalette,omitempty"`
}

type AssetPalette struct {
	ID       int      `json:"id,omitempty"`
	Source   string   `json:"source,omitempty"`
	Master   bool     `json:"master,omitempty"`
	Tags     []string `json:"tags,omitempty"`
	Breed    int      `json:"breed,omitempty"`
	ColorTag int      `json:"colorTag,omitempty"`
	Color1   string   `json:"color1,omitempty"`
	Color2   string   `json:"color2,omitempty"`
	RGB      [][]int  `json:"rgb,omitempty"`
}

type AssetVisualizationData struct {
	LayerCount int                                    `json:"layerCount,omitempty"`
	Angle      int                                    `json:"angle,omitempty"`
	Size       int                                    `json:"size,omitempty"`
	Layers     map[string]AssetVisualizationLayer     `json:"layers,omitempty"`
	Directions map[string]AssetVisualizationDirection `json:"directions,omitempty"`
	Colors     map[string]AssetColor                  `json:"colors,omitempty"`
	Animations map[string]AssetVisualAnimation        `json:"animations,omitempty"`
	Postures   *AssetPostures                         `json:"postures,omitempty"`
	Gestures   []AssetGesture                         `json:"gestures,omitempty"`
}

type AssetVisualizationLayer struct {
	X           int    `json:"x,omitempty"`
	Y           int    `json:"y,omitempty"`
	Z           int    `json:"z,omitempty"`
	Alpha       int    `json:"alpha,omitempty"`
	Ink         string `json:"ink,omitempty"`
	Tag         string `json:"tag,omitempty"`
	IgnoreMouse bool   `json:"ignoreMouse,omitempty"`
}

type AssetVisualizationDirection struct {
	Layers map[string]AssetVisualizationLayer `json:"layers,omitempty"`
}

type AssetColor struct {
	Layers map[string]AssetColorLayer `json:"layers,omitempty"`
}

type AssetColorLayer struct {
	Color int `json:"color,omitempty"`
}

type AssetVisualAnimation struct {
	TransitionTo        int                                  `json:"transitionTo,omitempty"`
	TransitionFrom      int                                  `json:"transitionFrom,omitempty"`
	ImmediateChangeFrom bool                                 `json:"immediateChangeFrom,omitempty"`
	RandomStart         bool                                 `json:"randomStart,omitempty"`
	Layers              map[string]AssetVisualAnimationLayer `json:"layers,omitempty"`
}

type AssetVisualAnimationLayer struct {
	LoopCount      int                                     `json:"loopCount"`
	FrameRepeat    int                                     `json:"frameRepeat,omitempty"`
	Random         int                                     `json:"random,omitempty"`
	FrameSequences map[string]AssetVisualAnimationSequence `json:"frameSequences,omitempty"`
}

type AssetVisualAnimationSequence struct {
	LoopCount int                                          `json:"loopCount,omitempty"`
	Random    int                                          `json:"random,omitempty"`
	Frames    map[string]AssetVisualAnimationSequenceFrame `json:"frames,omitempty"`
}

type AssetVisualAnimationSequenceFrame struct {
	ID      int                                                `json:"id"`
	X       int                                                `json:"x,omitempty"`
	Y       int                                                `json:"y,omitempty"`
	RandomX int                                                `json:"randomX,omitempty"`
	RandomY int                                                `json:"randomY,omitempty"`
	Offsets map[string]AssetVisualAnimationSequenceFrameOffset `json:"offsets,omitempty"`
}

type AssetVisualAnimationSequenceFrameOffset struct {
	Direction int `json:"direction,omitempty"`
	X         int `json:"x,omitempty"`
	Y         int `json:"y,omitempty"`
}

type AssetPostures struct {
	DefaultPosture string         `json:"defaultPosture,omitempty"`
	Postures       []AssetPosture `json:"postures,omitempty"`
}

type AssetPosture struct {
	ID          string `json:"id"`
	AnimationID int    `json:"animationId"`
}

type AssetGesture struct {
	ID          string `json:"id"`
	AnimationID int    `json:"animationId"`
}

type AssetIndex struct {
	Name string `json:"name,omitempty"`
}

type AssetLogic struct {
	Model     AssetLogicModel `json:"model,omitempty"`
	Mask      AssetLogicMask  `json:"mask,omitempty"`
	Particles []interface{}   `json:"particles,omitempty"`
}

type AssetLogicModel struct {
	Dimensions Dimensions3D `json:"dimensions,omitempty"`
	Directions []int        `json:"directions,omitempty"`
}

type Dimensions3D struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type AssetLogicMask struct {
}

// SpriteInfo represents metadata about a single sprite with a thumbnail
type SpriteInfo struct {
	Name      string `json:"name"`
	X         int    `json:"x"`
	Y         int    `json:"y"`
	W         int    `json:"w"`
	H         int    `json:"h"`
	Thumbnail string `json:"thumbnail"` // base64-encoded 64x64 PNG
}

// ExtractSpritesResult returns extraction results
type ExtractSpritesResult struct {
	Success        bool     `json:"success"`
	ExtractedCount int      `json:"extractedCount"`
	OutputPath     string   `json:"outputPath"`
	Errors         []string `json:"errors,omitempty"`
}

// FileWatcherStatus represents file watching state
type FileWatcherStatus struct {
	Watching    bool     `json:"watching"`
	Path        string   `json:"path"`
	FileCount   int      `json:"fileCount"`
	SpriteNames []string `json:"spriteNames"`
}
