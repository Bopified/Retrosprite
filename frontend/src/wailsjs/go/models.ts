export namespace main {
	
	export class BatchConversionFileResult {
	    path: string;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new BatchConversionFileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class BatchConversionResult {
	    success: boolean;
	    zipPath: string;
	    successCount: number;
	    errorCount: number;
	    files: BatchConversionFileResult[];
	
	    static createFrom(source: any = {}) {
	        return new BatchConversionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.zipPath = source["zipPath"];
	        this.successCount = source["successCount"];
	        this.errorCount = source["errorCount"];
	        this.files = this.convertValues(source["files"], BatchConversionFileResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppSettings {
	    defaultZ: number;

	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultZ = source["defaultZ"];
	    }
	}
	export class ExtractSpritesResult {
	    success: boolean;
	    extractedCount: number;
	    outputPath: string;
	    errors?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ExtractSpritesResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.extractedCount = source["extractedCount"];
	        this.outputPath = source["outputPath"];
	        this.errors = source["errors"];
	    }
	}
	export class FileWatcherStatus {
	    watching: boolean;
	    path: string;
	    fileCount: number;
	    spriteNames: string[];
	
	    static createFrom(source: any = {}) {
	        return new FileWatcherStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.watching = source["watching"];
	        this.path = source["path"];
	        this.fileCount = source["fileCount"];
	        this.spriteNames = source["spriteNames"];
	    }
	}
	export class NitroResponse {
	    path: string;
	    files: Record<string, Array<number>>;
	
	    static createFrom(source: any = {}) {
	        return new NitroResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.files = source["files"];
	    }
	}
	export class ProjectSettings {
	    lastOpenedFile?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lastOpenedFile = source["lastOpenedFile"];
	    }
	}
	export class RsprProject {
	    version: string;
	    name: string;
	    files: Record<string, string>;
	    settings: ProjectSettings;
	    path?: string;
	
	    static createFrom(source: any = {}) {
	        return new RsprProject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.name = source["name"];
	        this.files = source["files"];
	        this.settings = this.convertValues(source["settings"], ProjectSettings);
	        this.path = source["path"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SpriteInfo {
	    name: string;
	    x: number;
	    y: number;
	    w: number;
	    h: number;
	    thumbnail: string;
	
	    static createFrom(source: any = {}) {
	        return new SpriteInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.w = source["w"];
	        this.h = source["h"];
	        this.thumbnail = source["thumbnail"];
	    }
	}
	export class UpdateInfo {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    releaseName: string;
	    releaseNotes: string;
	    downloadUrl: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseName = source["releaseName"];
	        this.releaseNotes = source["releaseNotes"];
	        this.downloadUrl = source["downloadUrl"];
	        this.error = source["error"];
	    }
	}

}

