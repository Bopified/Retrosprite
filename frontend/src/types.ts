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

export interface NitroVisualization {
    angle: number;
    layerCount: number;
    size: number;
    layers?: Record<string, NitroLayer>;
    directions?: Record<string, any>;
    colors?: Record<string, any>;
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
    [key: string]: any;
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