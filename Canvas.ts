import { CurrentTransform, GroupSelector, Offset, Pos } from './interface';

import { EventCenter } from "./EventCenter";
import { FabricObject } from './FabricObject';
import { Group } from "./Group";
import { Point } from './Point';
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
    private _groupSelector: GroupSelector;
    /** 当前选中的组 */
    public _activeGroup: Group;

    /** 画布中所有添加的物体 */
    private _objects: FabricObject[];
    /** 整个画布到上面和左边的偏移量 */
    private _offset: Offset;
    /** 当前物体的变换信息，src 目录下中有截图 */
    private _currentTransform: CurrentTransform;
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
        // 处理模糊问题
        this._initRetinaScaling();

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
        // this._currentTransform = null;
        // this._groupSelector = undefined;
        this._initWrapperElement()
        this._createUpperCanvas()
        this._initEvents()
        this.calcOffset()
    }
    /** 因为我们用了两个 canvas，所以在 canvas 的外面再多包一个 div 容器 */
    _initWrapperElement() {
        this.warpperEl = Util.wrapElement(this.lowerCanvasEl, 'div', {
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
        for (let i = args.length; i--;) {
            this._initObject(args[i]);
        }
        this.renderAll();
        return this;
    }
    _initObject(obj: FabricObject) {
        obj.setupState();
        obj.setCoords();
        obj.canvas = this;
        this.emit('object:added', { target: obj });
        obj.emit('added');
    }
    clearContext(ctx: CanvasRenderingContext2D): Canvas {
        ctx && ctx.clearRect(0, 0, this.width, this.height);
        return this;
    }
    /** 将所有物体分成两个组，一组是未激活态，一组是激活态，然后将激活组放在最后，这样就能够绘制到最上层 */
    _chooseObjectsToRender() {
        // 当前有没有激活的物体
        let activeObject = this.getActiveObject();
        // 当前有没有激活的组（也就是多个物体）
        let activeGroup = this.getActiveGroup();
        // 最终要渲染的物体顺序，也就是把激活的物体放在后面绘制
        let objsToRender: FabricObject[] = [];

        if (activeGroup) {
            // 如果选中多个物体
            const activeGroupObjects: FabricObject[] = [];
            for (let i = 0, length = this._objects.length; i < length; i++) {
                let object = this._objects[i];
                if (activeGroup.contains(object)) {
                    activeGroupObjects.push(object);
                } else {
                    objsToRender.push(object);
                }
            }
            // activeGroup._set('objects', activeGroupObjects);
            objsToRender.push(activeGroup);
        } else if (activeObject) {
            // 如果只选中一个物体
            let index = this._objects.indexOf(activeObject);
            objsToRender = this._objects.slice();
            if (index > -1) {
                objsToRender.splice(index, 1);
                objsToRender.push(activeObject);
            }
        } else {
            // 所有物体都没被选中
            objsToRender = this._objects;
        }

        return objsToRender;
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
        const sortedObjects = this._chooseObjectsToRender();
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
    _initRetinaScaling() {
        const dpr = window.devicePixelRatio;
        this.__initRetinaScaling(this.lowerCanvasEl, this.contextContainer, dpr);
        this.__initRetinaScaling(this.upperCanvasEl, this.contextTop, dpr);
        this.__initRetinaScaling(this.cacheCanvasEl, this.contextCache, dpr);
    }
    __initRetinaScaling(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number) {
        const { width, height } = this;
        // 重新设置 canvas 自身宽高大小和 css 大小。放大 canvas；css 保持不变，因为我们需要那么多的点
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        // 直接用 scale 放大整个坐标系，相对来说就是放大了每个绘制操作
        ctx.scale(dpr, dpr);
    }
    /** 给上层画布增加鼠标事件 */
    _initEvents() {
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onResize = this._onResize.bind(this);

        Util.addListener(window, 'resize', this._onResize);
        Util.addListener(this.upperCanvasEl, 'mousedown', this._onMouseDown);
        Util.addListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
    }
    _onMouseDown(e: MouseEvent) {
        this.__onMouseDown(e);
        Util.addListener(document, 'mouseup', this._onMouseUp);
        Util.addListener(document, 'mousemove', this._onMouseMove);
        Util.removeListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
    }
    _onMouseMove(e: MouseEvent) {
        e.preventDefault();
        this.__onMouseMove(e);
    }
    _onMouseUp(e: MouseEvent) {
        this.__onMouseUp(e);
        Util.removeListener(document, 'mouseup', this._onMouseUp);
        Util.removeListener(document, 'mousemove', this._onMouseMove);
        Util.addListener(this.upperCanvasEl, 'mousemove', this._onMouseMove);
    }
    _onResize() {
        this.calcOffset();
    }
    __onMouseDown(e: MouseEvent) {
        // 只处理左键点击，要么是拖蓝事件、要么是点选事件
        let isLeftClick = 'which' in e ? e.which === 1 : e.button === 1;
        if (!isLeftClick) return;

        // 这个我猜是为了保险起见，ignore if some object is being transformed at this moment
        if (this._currentTransform) return;

        let target = this.findTarget(e);
        let pointer = this.getPointer(e);
        let corner;
        this._previousPointer = pointer;

        if (this._shouldClearSelection(e)) {
            // 如果是拖蓝选区事件
            this._groupSelector = {
                // 重置选区状态
                ex: pointer.x,
                ey: pointer.y,
                top: 0,
                left: 0,
            };
            // 让所有元素失去激活状态
            this.deactivateAllWithDispatch();
            // this.renderAll();
        } else {
            // 如果是点选操作，接下来就要为各种变换做准备
            target.saveState();

            // 判断点击的是不是控制点
            corner = target._findTargetCorner(e, this._offset);
            if (this._shouldHandleGroupLogic(e, target)) {
                // 如果是选中组
                this._handleGroupLogic(e, target);
                target = this.getActiveGroup();
            } else {
                // 如果是选中单个物体
                if (target !== this.getActiveGroup()) {
                    this.deactivateAll();
                }
                this.setActiveObject(target, e);
            }
            this._setupCurrentTransform(e, target);

            // if (target) this.renderAll();
        }
        // 不论是拖蓝选区事件还是点选事件，都需要重新绘制
        // 拖蓝选区：需要把之前激活的物体取消选中态
        // 点选事件：需要把当前激活的物体置顶
        this.renderAll();

        this.emit('mouse:down', { target, e });
        target && target.emit('mousedown', { e });
        // if (corner === 'mtr') {
        //     // 如果点击的是上方的控制点，也就是旋转操作，我们需要临时改一下变换中心，因为我们一直就是以 center 为中心，所以可以先不管
        //     this._previousOriginX = this._currentTransform.target.originX;
        //     this._currentTransform.target.adjustPosition('center');
        //     this._currentTransform.left = this._currentTransform.target.left;
        //     this._currentTransform.top = this._currentTransform.target.top;
        // }
    }
    /** 处理鼠标 hover 事件和物体变换时的拖拽事件
     * 如果是涂鸦模式，只绘制 upper-canvas
     * 如果是图片变换，只绘制 upper-canvas */
     __onMouseMove(e: MouseEvent) {
        let target, pointer;

        let groupSelector = this._groupSelector;

        if (groupSelector) {
            // 如果有拖蓝框选区域
            pointer = Util.getPointer(e, this.upperCanvasEl);

            groupSelector.left = pointer.x - this._offset.left - groupSelector.ex;
            groupSelector.top = pointer.y - this._offset.top - groupSelector.ey;
            this.renderTop();
        } else if (!this._currentTransform) {
            // 如果是 hover 事件，这里我们只需要改变鼠标样式，并不会重新渲染
            let style = this.upperCanvasEl.style;
            target = this.findTarget(e);

            if (target) {
                this._setCursorFromEvent(e, target);
            } else {
                // image/text was hovered-out from, we remove its borders
                // for (let i = this._objects.length; i--; ) {
                //     if (this._objects[i] && !this._objects[i].active) {
                //         this._objects[i].setActive(false);
                //     }
                // }
                style.cursor = this.defaultCursor;
            }
        } else {
            // 如果是旋转、缩放、平移等操作
            pointer = Util.getPointer(e, this.upperCanvasEl);

            let x = pointer.x,
                y = pointer.y;

            this._currentTransform.target.isMoving = true;

            let t = this._currentTransform,
                reset = false;
            // if (
            //     (t.action === 'scale' || t.action === 'scaleX' || t.action === 'scaleY') &&
            //     // Switch from a normal resize to center-based
            //     ((e.altKey && (t.originX !== 'center' || t.originY !== 'center')) ||
            //         // Switch from center-based resize to normal one
            //         (!e.altKey && t.originX === 'center' && t.originY === 'center'))
            // ) {
            //     this._resetCurrentTransform(e);
            //     reset = true;
            // }

            if (this._currentTransform.action === 'rotate') {
                // 如果是旋转操作
                this._rotateObject(x, y);

                this.emit('object:rotating', {
                    target: this._currentTransform.target,
                    e,
                });
                this._currentTransform.target.emit('rotating');
            } else if (this._currentTransform.action === 'scale') {
                // 如果是整体缩放操作
                if (e.shiftKey) {
                    this._currentTransform.currentAction = 'scale';
                    this._scaleObject(x, y);
                } else {
                    if (!reset && t.currentAction === 'scale') {
                        // Switch from a normal resize to proportional
                        this._resetCurrentTransform(e);
                    }

                    this._currentTransform.currentAction = 'scaleEqually';
                    this._scaleObject(x, y, 'equally');
                }

                this.emit('object:scaling', {
                    target: this._currentTransform.target,
                    e,
                });
                this._currentTransform.target.emit('scaling', { e });
            } else if (this._currentTransform.action === 'scaleX') {
                // 如果只是缩放 x
                this._scaleObject(x, y, 'x');

                this.emit('object:scaling', {
                    target: this._currentTransform.target,
                    e,
                });
                this._currentTransform.target.emit('scaling', { e });
            } else if (this._currentTransform.action === 'scaleY') {
                // 如果只是缩放 y
                this._scaleObject(x, y, 'y');

                this.emit('object:scaling', {
                    target: this._currentTransform.target,
                    e,
                });
                this._currentTransform.target.emit('scaling', { e });
            } else {
                // 如果是拖拽物体
                this._translateObject(x, y);

                this.emit('object:moving', {
                    target: this._currentTransform.target,
                    e,
                });

                this._setCursor(this.moveCursor);
                this._currentTransform.target.emit('moving', { e });
            }

            this.renderAll();
        }

        this.emit('mouse:move', { target, e });
        target && target.emit('mousemove', { e });
    }
    /** 主要就是清空拖蓝选区，设置物体激活状态，重新渲染画布 */
    __onMouseUp(e: MouseEvent) {
        let target;
        if (this._currentTransform) {
            let transform = this._currentTransform;

            target = transform.target;
            if (target._scaling) {
                target._scaling = false;
            }

            // 每次物体更改都要重新计算新的控制点
            let i = this._objects.length;
            while (i--) {
                this._objects[i].setCoords();
            }

            target.isMoving = false;

            // 在点击之间如果物体状态改变了才派发事件
            if (target.hasStateChanged()) {
                this.emit('object:modified', { target });
                target.emit('modified');
            }
        }

        this._currentTransform = null;

        if (this._groupSelector) {
            // 如果有拖蓝框选区域
            this._findSelectedObjects(e);
        }
        let activeGroup = this.getActiveGroup();
        if (activeGroup) {
            //重新设置 激活组 中的物体
            activeGroup.setObjectsCoords();
            activeGroup.set('isMoving', false);
            this._setCursor(this.defaultCursor);
        }

        // clear selection
        this._groupSelector = null;
        this.renderAll();

        this._setCursorFromEvent(e, target);

        this.emit('mouse:up', { target, e });
        target && target.emit('mouseup', { e });
    }
    _shouldRender(target: FabricObject, pointer: Pos) {
        const activeObject = this.getActiveGroup() || this.getActiveObject();
        // return !!activeObject;
        return !!((target && (target.isMoving || target !== activeObject)) || (!target && !!activeObject) || (!target && !activeObject && !this._groupSelector) || (pointer && this._previousPointer && (pointer.x !== this._previousPointer.x || pointer.y !== this._previousPointer.y)));
    }
    /** 设置鼠标样式 */
    _setCursor(value: string) {
        this.upperCanvasEl.style.cursor = value;
    }
    /** 根据鼠标位置来设置相应的鼠标样式 */
    _setCursorFromEvent(e: MouseEvent, target: FabricObject): boolean {
        let s = this.upperCanvasEl.style;
        if (target) {
            let activeGroup = this.getActiveGroup();
            let corner = (!activeGroup || !activeGroup.contains(target)) && target._findTargetCorner(e, this._offset);

            if (corner) {
                corner = corner as string;
                if (corner in cursorMap) {
                    s.cursor = cursorMap[corner];
                } else if (corner === 'mtr' && target.hasRotatingPoint) {
                    s.cursor = this.rotationCursor;
                } else {
                    s.cursor = this.defaultCursor;
                    return false;
                }
            } else {
                s.cursor = this.hoverCursor;
            }
            return true;
        } else {
            s.cursor = this.defaultCursor;
            return false;
        }
    }
    /**
     * 获取拖蓝选区包围的元素
     * 可能只有一个物体，那就是普通的点选
     * 如果有多个物体，那就生成一个组
     */
     _findSelectedObjects(e: MouseEvent) {
        let objects: FabricObject[] = [], // 存储最终框选的元素
            x1 = this._groupSelector.ex,
            y1 = this._groupSelector.ey,
            x2 = x1 + this._groupSelector.left,
            y2 = y1 + this._groupSelector.top,
            selectionX1Y1 = new Point(Math.min(x1, x2), Math.min(y1, y2)),
            selectionX2Y2 = new Point(Math.max(x1, x2), Math.max(y1, y2));

        for (let i = 0, len = this._objects.length; i < len; ++i) {
            let currentObject = this._objects[i];

            if (!currentObject) continue;

            // 物体是否与拖蓝选区相交或者被选区包含
            if (currentObject.intersectsWithRect(selectionX1Y1, selectionX2Y2) || currentObject.isContainedWithinRect(selectionX1Y1, selectionX2Y2)) {
                currentObject.setActive(true);
                objects.push(currentObject);
            }
        }

        if (objects.length === 1) {
            this.setActiveObject(objects[0], e);
        } else if (objects.length > 1) {
            const newGroup = new Group(objects);
            this.setActiveGroup(newGroup);
        }

        this.renderAll();
    }
    setActiveGroup(group: Group): Canvas {
        this._activeGroup = group;
        if (group) {
            group.canvas = this;
            group.setActive(true);
        }
        return this;
    }
    setActiveObject(object: FabricObject, e: MouseEvent): Canvas {
        if (this._activeObject) {
            // 如果当前有激活物体
            this._activeObject.setActive(false);
        }
        this._activeObject = object;
        object.setActive(true);

        this.renderAll();

        return this;
    }
    /** 检测是否有物体在鼠标位置 */
    findTarget(e: MouseEvent, skipGroup: boolean = false): FabricObject {
        let target;

        // 优先考虑当前组中的物体，因为激活的物体被选中的概率大
        let activeGroup = this.getActiveGroup();
        if (activeGroup && !skipGroup && this.containsPoint(e, activeGroup)) {
            target = activeGroup;
            return target;
        }

        // 遍历所有物体，判断鼠标点是否在物体包围盒内
        for (let i = this._objects.length; i--; ) {
            if (this._objects[i] && this.containsPoint(e, this._objects[i])) {
                target = this._objects[i];
                break;
            }
        }

        if (target) return target;
        return target
    }
    containsPoint(e: MouseEvent, target: FabricObject): boolean {
        let pointer = this.getPointer(e),
            xy = this._normalizePointer(target, pointer),
            x = xy.x,
            y = xy.y;

        // 下面这是参考文献，不过好像打不开
        // http://www.geog.ubc.ca/courses/klink/gis.notes/ncgia/u32.html
        // http://idav.ucdavis.edu/~okreylos/TAship/Spring2000/PointInPolygon.html

        // we iterate through each object. If target found, return it.
        let iLines = target._getImageLines(target.oCoords),
            xpoints = target._findCrossPoints(x, y, iLines);

        // if xcount is odd then we clicked inside the object
        // For the specific case of square images xcount === 1 in all true cases
        if ((xpoints && xpoints % 2 === 1) || target._findTargetCorner(e, this._offset)) {
            return true;
        }
        return false;
    }
    getPointer(e: MouseEvent): Pos {
        let pointer = Util.getPointer(e, this.upperCanvasEl);
        return {
            x: pointer.x - this._offset.left,
            y: pointer.y - this._offset.top,
        };
    }
    /** 如果当前的物体在当前的组内，则要考虑扣去组的 top、left 值 */
    _normalizePointer(object: FabricObject, pointer: Pos) {
        let activeGroup = this.getActiveGroup(),
            x = pointer.x,
            y = pointer.y;

        let isObjectInGroup = activeGroup && object.type !== 'group' && activeGroup.contains(object);

        if (isObjectInGroup) {
            x -= activeGroup.left;
            y -= activeGroup.top;
        }
        return { x, y };
    }
    /** 是否是拖蓝事件，也就是没有点选到物体 */
    _shouldClearSelection(e: MouseEvent) {
        let target = this.findTarget(e),
            activeGroup = this.getActiveGroup();
        return !target || (target && activeGroup && !activeGroup.contains(target) && activeGroup !== target && !e.shiftKey);
    }
    /** 旋转当前选中物体，这里用的是 += */
    _rotateObject(x: number, y: number) {
        const t = this._currentTransform;
        const o = this._offset;
        // 鼠标按下的点与物体中心点连线和 x 轴正方向形成的弧度
        const lastAngle = Math.atan2(t.ey - o.top - t.top, t.ex - o.left - t.left);
        // 鼠标拖拽的终点与物体中心点连线和 x 轴正方向形成的弧度
        const curAngle = Math.atan2(y - o.top - t.top, x - o.left - t.left);
        let angle = Util.radiansToDegrees(curAngle - lastAngle + t.theta); // 新的角度 = 变换的角度 + 原来的角度
        if (angle < 0) {
            angle = 360 + angle;
        }
        angle = angle % 360;
        t.target.angle = angle;
    }
    /**
     * 缩放当前选中物体
     * @param x 鼠标点 x
     * @param y 鼠标点 y
     * @param by 是否等比缩放，x | y | equally
     */
     _scaleObject(x: number, y: number, by = 'equally') {
        let t = this._currentTransform,
            offset = this._offset,
            target: FabricObject = t.target;

        // 缩放基点：比如拖拽右边中间的控制点，其实我们参考的变换基点是左边中间的控制点
        let constraintPosition = target.translateToOriginPoint(target.getCenterPoint(), t.originX, t.originY);
        // 以物体变换中心为原点的鼠标点坐标值
        let localMouse = target.toLocalPoint(new Point(x - offset.left, y - offset.top), t.originX, t.originY);

        if (t.originX === 'right') {
            localMouse.x *= -1;
        } else if (t.originX === 'center') {
            localMouse.x *= t.mouseXSign * 2;

            if (localMouse.x < 0) {
                t.mouseXSign = -t.mouseXSign;
            }
        }

        if (t.originY === 'bottom') {
            localMouse.y *= -1;
        } else if (t.originY === 'center') {
            localMouse.y *= t.mouseYSign * 2;

            if (localMouse.y < 0) {
                t.mouseYSign = -t.mouseYSign;
            }
        }

        // 计算新的缩放值，以变换中心为原点，根据本地鼠标坐标点/原始宽度进行计算，重新设定物体缩放值
        let newScaleX = target.scaleX,
            newScaleY = target.scaleY;
        if (by === 'equally') {
            let dist = localMouse.y + localMouse.x;
            let lastDist = target.height * t.original.scaleY + target.width * t.original.scaleX + target.padding * 2 - target.strokeWidth * 2 + 1; /* additional offset needed probably due to subpixel rendering, and avoids jerk when scaling an object */

            // We use t.scaleX/Y instead of target.scaleX/Y because the object may have a min scale and we'll loose the proportions
            newScaleX = (t.original.scaleX * dist) / lastDist;
            newScaleY = (t.original.scaleY * dist) / lastDist;

            target.set('scaleX', newScaleX);
            target.set('scaleY', newScaleY);
        } else if (!by) {
            newScaleX = localMouse.x / (target.width + target.padding);
            newScaleY = localMouse.y / (target.height + target.padding);

            target.set('scaleX', newScaleX);
            target.set('scaleY', newScaleY);
        } else if (by === 'x') {
            newScaleX = localMouse.x / (target.width + target.padding);
            target.set('scaleX', newScaleX);
        } else if (by === 'y') {
            newScaleY = localMouse.y / (target.height + target.padding);
            target.set('scaleY', newScaleY);
        }
        // 如果是反向拉伸 x
        if (newScaleX < 0) {
            if (t.originX === 'left') t.originX = 'right';
            else if (t.originX === 'right') t.originX = 'left';
        }
        // 如果是反向拉伸 y
        if (newScaleY < 0) {
            if (t.originY === 'top') t.originY = 'bottom';
            else if (t.originY === 'bottom') t.originY = 'top';
        }

        // console.log(constraintPosition, localMouse, t.originX, t.originY);

        // 缩放会改变物体位置，所以要重新设置
        target.setPositionByOrigin(constraintPosition, t.originX, t.originY);
    }
    /** 平移当前选中物体，注意这里我们没有用 += */
    _translateObject(x: number, y: number) {
        // console.log(this._currentTransform.offsetX, this._currentTransform.offsetY, this._offset.top, this._offset.left);
        let target = this._currentTransform.target;
        target.set('left', x - this._currentTransform.offsetX);
        target.set('top', y - this._currentTransform.offsetY);
    }
    /** 使所有元素失活，并触发相应事件 */
    deactivateAllWithDispatch(): Canvas {
        this.deactivateAll();
        return this;
    }
    /** 将所有物体设置成未激活态 */
    deactivateAll() {
        let allObjects = this._objects,
            i = 0,
            len = allObjects.length;
        for (; i < len; i++) {
            allObjects[i].setActive(false);
        }
        this.discardActiveGroup();
        this.discardActiveObject();
        return this;
    }
    /** 将当前选中组失活 */
    discardActiveGroup(): Canvas {
        let g = this.getActiveGroup();
        if (g) g.destroy();
        return this.setActiveGroup(null);
    }
    /** 清空所有激活物体 */
    discardActiveObject() {
        if (this._activeObject) {
            this._activeObject.setActive(false);
        }
        this._activeObject = null;
        return this;
    }
    /** 是否要处理组的逻辑 */
    _shouldHandleGroupLogic(e: MouseEvent, target: FabricObject) {
        let activeObject = this._activeObject;
        return e.shiftKey && (this.getActiveGroup() || (activeObject && activeObject !== target));
    }
    _handleGroupLogic(e, target) {
        if (target === this.getActiveGroup()) {
            // if it's a group, find target again, this time skipping group
            target = this.findTarget(e, true);
            // if even object is not found, bail out
            if (!target || target.isType('group')) {
                return;
            }
        }
        let activeGroup = this.getActiveGroup();
        if (activeGroup) {
            if (activeGroup.contains(target)) {
                activeGroup.removeWithUpdate(target);
                this._resetObjectTransform(activeGroup);
                target.setActive(false);
                if (activeGroup.size() === 1) {
                    // remove group alltogether if after removal it only contains 1 object
                    this.discardActiveGroup();
                }
            } else {
                activeGroup.addWithUpdate(target);
                this._resetObjectTransform(activeGroup);
            }
            activeGroup.setActive(true);
        } else {
            if (this._activeObject) {
                if (target !== this._activeObject) {
                    let group = new Group([this._activeObject, target]);
                    this.setActiveGroup(group);
                    activeGroup = this.getActiveGroup();
                }
            }
            target.setActive(true);
        }
    }
    _resetObjectTransform(target) {
        target.scaleX = 1;
        target.scaleY = 1;
        target.setAngle(0);
    }
    /** 记录当前物体的变换状态 */
    _setupCurrentTransform(e: MouseEvent, target: FabricObject) {
        let action = 'drag',
            corner,
            pointer = Util.getPointer(e, target.canvas.upperCanvasEl);

        corner = target._findTargetCorner(e, this._offset);
        if (corner) {
            // 根据点击的控制点判断此次操作是什么
            action = corner === 'ml' || corner === 'mr' ? 'scaleX' : corner === 'mt' || corner === 'mb' ? 'scaleY' : corner === 'mtr' ? 'rotate' : 'scale';
        }

        let originX = 'center',
            originY = 'center';

        if (corner === 'ml' || corner === 'tl' || corner === 'bl') {
            // 如果点击的是左边的控制点，则变换基点就是右边，以右边为基准向左变换
            originX = 'right';
        } else if (corner === 'mr' || corner === 'tr' || corner === 'br') {
            originX = 'left';
        }

        if (corner === 'tl' || corner === 'mt' || corner === 'tr') {
            // 如果点击的是上方的控制点，则变换基点就是底部，以底边为基准向上变换
            originY = 'bottom';
        } else if (corner === 'bl' || corner === 'mb' || corner === 'br') {
            originY = 'top';
        }

        if (corner === 'mtr') {
            // 如果是旋转操作，则基点就是中心点
            originX = 'center';
            originY = 'center';
        }

        // let center = target.getCenterPoint();
        this._currentTransform = {
            target,
            action,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            offsetX: pointer.x - target.left,
            offsetY: pointer.y - target.top,
            originX,
            originY,
            ex: pointer.x,
            ey: pointer.y,
            left: target.left,
            top: target.top,
            theta: Util.degreesToRadians(target.angle),
            width: target.width * target.scaleX,
            mouseXSign: 1,
            mouseYSign: 1,
        };
        // 记录物体原始的 original 变换参数
        this._currentTransform.original = {
            left: target.left,
            top: target.top,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            originX,
            originY,
        };
        let { target: target2, ...other } = this._currentTransform;
        // console.log(JSON.stringify(other, null, 4));

    }
    /** 重置当前 transform 状态为 original，并设置 resizing 的基点 */
    _resetCurrentTransform(e: MouseEvent) {
        let t = this._currentTransform;

        t.target.set('scaleX', t.original.scaleX);
        t.target.set('scaleY', t.original.scaleY);
        t.target.set('left', t.original.left);
        t.target.set('top', t.original.top);

        if (e.altKey) {
            if (t.originX !== 'center') {
                if (t.originX === 'right') {
                    t.mouseXSign = -1;
                } else {
                    t.mouseXSign = 1;
                }
            }
            if (t.originY !== 'center') {
                if (t.originY === 'bottom') {
                    t.mouseYSign = -1;
                } else {
                    t.mouseYSign = 1;
                }
            }

            t.originX = 'center';
            t.originY = 'center';
        } else {
            t.originX = t.original.originX;
            t.originY = t.original.originY;
        }
    }
    /** 渲染 upper-canvas，一般用于渲染拖蓝多选区域和涂鸦 */
    renderTop(): Canvas {
        let ctx = this.contextTop;
        this.clearContext(ctx);

        // 绘制拖蓝选区
        if (this._groupSelector) this._drawSelection();

        this.emit('after:render');
        return this;
    }
    /** 绘制框选区域 */
    _drawSelection() {
        let ctx = this.contextTop,
            groupSelector = this._groupSelector,
            left = groupSelector.left,
            top = groupSelector.top,
            aleft = Math.abs(left),
            atop = Math.abs(top);

        ctx.fillStyle = this.selectionColor;

        ctx.fillRect(groupSelector.ex - (left > 0 ? 0 : -left), groupSelector.ey - (top > 0 ? 0 : -top), aleft, atop);

        ctx.lineWidth = this.selectionLineWidth;
        ctx.strokeStyle = this.selectionBorderColor;

        ctx.strokeRect(groupSelector.ex + STROKE_OFFSET - (left > 0 ? 0 : aleft), groupSelector.ey + STROKE_OFFSET - (top > 0 ? 0 : atop), aleft, atop);
    }

}
