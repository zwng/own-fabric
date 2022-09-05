import { CurrentTransform, GroupSelector, Offset, Pos } from './interface';

import { EventCenter } from "./EventCenter";
import { FabricObject } from './FabricObject';
import { Group } from "./Group";
import { Util } from "./Util";

const STROKE_OFFSET = 0.5;
const cursorMap = {
    tr: "ne-resize",
    br: "se-resize",
    bl: "sw-resize",
    tl: "nw-resize",
    ml: "w-resize",
    mt: "n-resize",
    mr: "e-resize",
    mb: "s-resize",
};
export class Canvas extends EventCenter {
    /** 画布宽度 */
    public width: number;
    /** 画布高度 */
    public height: number;
    /** 画布背景颜色 */
    public backgroundColor: string;
    /** 包围 canvas 的外层 div 容器 */
    public warpperEl: HTMLElement;
    /** 容器classname */
    public containerClass: string = "canvas-container";

    /** 上层 canvas，主要用于监听鼠标事件、涂鸦模式、左键点击拖蓝框选区域 */
    public upperCanvasEl: HTMLCanvasElement;
    /** 上层画布环境 */
    public contextTop: CanvasRenderingContext2D;
    /** 下层 canvas 画布，主要用于绘制所有物体 */
    public lowerCanvasEl: HTMLCanvasElement;
    /** 下层画布环境 */
    public contextContainer: CanvasRenderingContext2D;
    /** 缓冲层画布环境，方便某些情况方便计算用的，比如检测物体是否透明 */
    public cacheCanvasEl: HTMLCanvasElement;
    /** 缓冲画布环境 */
    public contextCache: CanvasRenderingContext2D;

    /** 一些鼠标样式 */
    public defaultCursor: string = "default";
    public hoverCursor: string = "move";
    public moveCursor: string = "move";
    public rotationCursor: string = "crosshair";

    public viewportTransform: number[] = [1, 0, 0, 1, 0, 0];
    public vptCoords: {};

    // public relatedTarget;
    /** 选择区域框的背景颜色 */
    public selectionColor: string = 'rgba(100, 100, 255, 0.3)';
    /** 选择区域框的边框颜色 */
    public selectionBorderColor: string = 'red';
    /** 选择区域的边框大小，拖蓝的线宽 */
    public selectionLineWidth: number = 1;
    /** 左键拖拽的产生的选择区域，拖蓝区域 */
    private _groupSelector: GroupSelector | null;
    /** 当前选中的组 */
    public _activeGroup: Group;

    /** 画布中所有添加的物体 */
    private _objects: FabricObject[];
    /** 整个画布到上面和左边的偏移量 */
    private _offset: Offset;
    /** 当前物体的变换信息，src 目录下中有截图 */
    private _currentTransform: CurrentTransform | null;
    /** 当前激活物体 */
    private _activeObject;
    /** 变换之前的中心点方式 */
    // private _previousOriginX;
    private _previousPointer: Pos;

    constructor(el: HTMLCanvasElement, options) {
        super();
        // 初始化下层画布 lower-canvas
        this._initStatic(el, options);
        // 初始化上层画布 upper-canvas
        this._initInteractive();
        // 初始化缓冲层画布
        this._createCacheCanvas()
    }
    _createCacheCanvas() {
        this.cacheCanvasEl = Util.createCanvasElement()
        this.contextCache = this.cacheCanvasEl.getContext('2d') as CanvasRenderingContext2D;
        this.cacheCanvasEl.width = this.width
        this.cacheCanvasEl.height = this.height
    }
    /** 初始化 _objects、lower-canvas 宽高、options 赋值 */
    _initStatic(el: HTMLCanvasElement, options) {
        this._objects = [];
        this._createLowerCanvas(el);
        this._initOptions(options);
        this.calcOffset();
    }
    /** 初始化交互层，也就是 upper-canvas */
    _initInteractive() {
        this._currentTransform = null;
        this._groupSelector = null;
        this._initWrapperElement()
        this._createUpperCanvas()
        this._initEvents()
        this.calcOffset()
    }
    /** 给上层画布增加鼠标事件 */
    _initEvents() {

    }
    /** 因为我们用了两个 canvas，所以在 canvas 的外面再多包一个 div 容器 */
    _initWrapperElement() {
        this.warpperEl = Util.wrapElement(this.lowerCanvasEl, 'div' , {
            class: this.containerClass
        })
        Util.setStyle(this.warpperEl, {
            position: "relative",
            width: this.width + "px",
            height: this.height + "px",
        });
        Util.makeElementUnselectable(this.warpperEl);
    }
    /** 创建上层画布，主要用于鼠标交互和涂鸦模式 */
    _createUpperCanvas() {
        this.upperCanvasEl = Util.createCanvasElement()
        this.contextTop = this.upperCanvasEl.getContext('2d') as CanvasRenderingContext2D;
        Util.addClass(this.upperCanvasEl, "upper-canvas");
        this._applyCanvasStyle(this.upperCanvasEl);
        this.warpperEl.appendChild(this.upperCanvasEl);
    }
    /**初始化配置项 */
    _initOptions(options) {
        for (let prop in options) {
            this[prop] = options[prop];
        }

        this.width = +this.lowerCanvasEl.width || 0;
        this.height = +this.lowerCanvasEl.height || 0;

        this.lowerCanvasEl.style.width = this.width + "px";
        this.lowerCanvasEl.style.height = this.height + "px";
    }
    /**创建底层画布 */
    _createLowerCanvas(el: HTMLCanvasElement) {
        this.lowerCanvasEl = el;
        this.contextContainer = this.lowerCanvasEl.getContext(
            "2d"
        ) as CanvasRenderingContext2D;
        Util.addClass(el, "lower-canvas");
        this._applyCanvasStyle(this.lowerCanvasEl);
    }
    /**添加样式 */
    _applyCanvasStyle(el: HTMLCanvasElement) {
        let width = this.width || el.width;
        let height = this.height || el.height;
        Util.setStyle(el, {
            position: "absolute",
            width: width + "px",
            height: height + "px",
            left: 0,
            top: 0,
        });
        el.width = width;
        el.height = height;
        Util.makeElementUnselectable(el);
    }
    /**获取画布的偏移量，到时计算鼠标点击位置需要用到 */
    calcOffset(): Canvas { 
        this._offset = Util.getElementOffset(this.lowerCanvasEl)
        return this;
    }
    /** 添加元素
     * 目前的模式是调用 add 添加物体的时候就立马渲染，
     * 如果一次性加入大量元素，就会做很多无用功，
     * 所以可以加一个属性来先批量添加元素，最后再一次渲染（手动调用 renderAll 函数即可）
     */
     add(...args): Canvas {
        console.log('args', args)
        this._objects.push.apply(this._objects, args);
        for (let i = args.length; i--; ) {
            this._initObject(args[i]);
        }
        this.renderAll();
        return this;
    }
    _initObject(obj: FabricObject) {
        obj.setupState();
        // obj.setCoords();
        obj.canvas = this;
        this.emit('object:added', { target: obj });
        obj.emit('added');
    }
    clearContext(ctx: CanvasRenderingContext2D): Canvas {
        ctx && ctx.clearRect(0, 0, this.width, this.height);
        return this;
    }

    /** 大部分是在 lower-canvas 上先画未激活物体，再画激活物体 */
    renderAll(allOnTop: boolean = false): Canvas {
        let canvasToDrawOn = this[allOnTop ? 'contextTop' : 'contextContainer'];

        if (this.contextTop) {
            this.clearContext(this.contextTop);
        }

        if (!allOnTop) {
            this.clearContext(canvasToDrawOn);
        }

        this.emit('before:render');

        if (this.backgroundColor) {
            canvasToDrawOn.fillStyle = this.backgroundColor;
            canvasToDrawOn.fillRect(0, 0, this.width, this.height);
        }

        // 先绘制未激活物体，再绘制激活物体
        const sortedObjects = this._objects;
        for (let i = 0, len = sortedObjects.length; i < len; ++i) {
            this._draw(canvasToDrawOn, sortedObjects[i]);
        }

        this.emit('after:render');

        return this;
    }
    getActiveObject() {
        return this._activeObject;
    }
    getActiveGroup(): Group {
        return this._activeGroup;
    }
    _draw(ctx: CanvasRenderingContext2D, object: FabricObject) {
        if (!object) return;
        object.render(ctx);
    }

}
