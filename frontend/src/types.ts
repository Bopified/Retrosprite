export interface NitroFrame {
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
    pivot: { x: number; y: number };
}

export interface NitroSpriteSheet {
    frames: Record<string, NitroFrame>;
    meta: {
        image: string;
        format: string;
        size: { w: number; h: number };
        scale: number;
    };
}

export interface NitroAsset {
    x?: number;
    y?: number;
    source?: string;
    flipH?: boolean;
}

export interface NitroLogic {
    model: {
        dimensions: {
            x: number;
            y: number;
            z: number;
        };
        directions?: Record<string, any>;
    };
}

export interface NitroLayer {
    z?: number;
    ink?: string;
    ignoreMouse?: boolean;
    alpha?: number;
    tag?: string;
}

export interface NitroAnimationLayer {
    frameSequences: Record<string, {
        frames: Record<string, { id: number }>;
    }>;
    loopCount?: number;
    frameRepeat?: number;
}

export interface NitroAnimation {
    layers: Record<string, NitroAnimationLayer>;
}

export interface NitroColorLayer {
    color: number;
}

export interface NitroColor {
    layers: Record<string, NitroColorLayer>;
}

export interface NitroVisualization {
    angle: number;
    layerCount: number;
    size: number;
    layers?: Record<string, NitroLayer>;
    directions?: Record<string, any>;
    colors?: Record<string, NitroColor>;
    animations?: Record<string, NitroAnimation>;
}

export interface NitroJSON {
    name?: string;
    logicType?: string;
    visualizationType?: string;
    assets?: Record<string, NitroAsset>;
    logic?: NitroLogic;
    visualizations?: NitroVisualization[];
    spritesheet?: NitroSpriteSheet;
    animations?: Record<string, EffectAnimation>;
    [key: string]: any;
}

// --- Effect Animation Types ---

export interface EffectAnimationDirection {
    offset: number;
}

export interface EffectAnimationShadow {
    id: string;
}

export interface EffectAnimationAdd {
    id: string;
    align?: string;
    blend?: string;
    ink?: number;
    base?: string;
}

export interface EffectAnimationRemove {
    id: string;
}

export interface EffectAnimationSpriteDirection {
    id?: number;
    dx?: number;
    dy?: number;
    dz?: number;
}

export interface EffectAnimationSprite {
    id?: string;
    member?: string;
    directions?: number;
    ink?: number;
    staticY?: number;
    directionList?: EffectAnimationSpriteDirection[];
}

export interface EffectAnimationFramePartItem {
    id?: string;
    base?: string;
}

export interface EffectAnimationFramePart {
    id?: string;
    frame?: number;
    base?: string;
    action?: string;
    dx?: number;
    dy?: number;
    dz?: number;
    dd?: number;
    items?: EffectAnimationFramePartItem[];
}

export interface EffectAnimationFrame {
    repeats?: number;
    fxs?: EffectAnimationFramePart[];
    bodyparts?: EffectAnimationFramePart[];
}

export interface EffectAnimationAvatar {
    background?: string;
    foreground?: string;
    ink?: number;
}

export interface EffectAnimationOverride {
    name?: string;
    override?: string;
    frames?: EffectAnimationFrame[];
}

export interface EffectAnimation {
    name?: string;
    desc?: string;
    resetOnToggle?: boolean;
    directions?: EffectAnimationDirection[];
    shadows?: EffectAnimationShadow[];
    adds?: EffectAnimationAdd[];
    removes?: EffectAnimationRemove[];
    sprites?: EffectAnimationSprite[];
    frames?: EffectAnimationFrame[];
    avatars?: EffectAnimationAvatar[];
    overrides?: EffectAnimationOverride[];
}

// --- EffectMap Types ---

export interface EffectMapLibrary {
    id: string;
    lib: string;
    type: string;
    revision: number;
}

export interface EffectMapData {
    effects: EffectMapLibrary[];
}

export interface RsprProject {
    version: string;
    name: string;
    files: Record<string, string>;
    settings: {
        lastOpenedFile?: string;
    };
    path?: string;
}

export interface AvatarTestingState {
    enabled: boolean;
    tileRow: number;
    tileCol: number;
    subLayer: number;
    avatarImage: string | null;
    heightOffset: number; // Y offset for avatar height adjustment
    // Habbo imager parameters
    username: string;
    action: 'std' | 'wlk' | 'sit' | 'lay' | 'wav' | 'blow' | 'laugh' | 'respect';
    gesture: 'nrm';
    direction: number; // 0-7
    headDirection: number; // 0-7
    size: 's' | 'm' | 'l';
}