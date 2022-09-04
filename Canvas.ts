import { EventCenter } from "./EventCenter";

const STROKE_OFFSET = 0.5;
const cursorMap = {
    tr: 'ne-resize',
    br: 'se-resize',
    bl: 'sw-resize',
    tl: 'nw-resize',
    ml: 'w-resize',
    mt: 'n-resize',
    mr: 'e-resize',
    mb: 's-resize',
};
export class Canvas extends EventCenter {
    public width:number;
    public height:number;
    public backgroundColor:string;
    public warpperEl:HTMLElement;
    public upperCanvasEl: HTMLCanvasElement;
    public contextTop: CanvasRenderingContext2D;
    public lowerCanvasEl: HTMLCanvasElement;
    public contextContainer: CanvasRenderingContext2D;
    public cacheCanvasEl: HTMLCanvasElement;
    public contextCache: CanvasRenderingContext2D;
    public containerClass:string;

    public defaultCursor:string =  'default';
    public hoverCursor:string =  'move';
    public moveCursor:string =  'move';
    public rotationCursor:string =  'crosshair';


    constructor(el: HTMLCanvasElement, options) {
        super()
        // 初始化下层画布 lower-canvas
        this._initStatic(el, options)
    }

    _initStatic(el: HTMLCanvasElement, options) {
        this._createLowerCanvas(el);

    }
    _createLowerCanvas(el: HTMLCanvasElement) {
        this.lowerCanvasEl = el;
        this.contextContainer = this.lowerCanvasEl.getContext('2d');

    }
    _applyCanvasStyle(el: HTMLCanvasElement) {
        let width = this.width || el.width;
        let height = this.height || el.height;
    }
}