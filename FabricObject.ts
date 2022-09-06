import { Coords, Corner, IAnimationOption, Offset } from './interface';

import { EventCenter } from './EventCenter';
import { Intersection } from './Intersection';
import { Point } from './Point';
import { Util } from './Util';

/** 物体基类，有一些共同属性和方法 */
export abstract class FabricObject extends EventCenter {
    /** 物体类型标识 */
    public type: string = 'object';
    /** 是否处于激活态，也就是是否被选中 */
    public active: boolean = false;
    /** 是否可见 */
    public visible: boolean = true;
    /** 默认水平变换中心 left | right | center */
    public originX: string = 'center';
    /** 默认垂直变换中心 top | bottom | center */
    public originY: string = 'center';
    /** 物体位置 top 值 */
    public top: number = 0;
    /** 物体位置 left 值 */
    public left: number = 0;
    /** 物体原始宽度 */
    public width: number = 0;
    /** 物体原始高度 */
    public height: number = 0;
    /** 物体当前的缩放倍数 x */
    public scaleX: number = 1;
    /** 物体当前的缩放倍数 y */
    public scaleY: number = 1;
    /** 物体当前的旋转角度 */
    public angle: number = 0;
    /** 左右镜像，比如反向拉伸控制点 */
    public flipX: boolean = false;
    /** 上下镜像，比如反向拉伸控制点 */
    public flipY: boolean = false;
    /** 选中态物体和边框之间的距离 */
    public padding: number = 0;
    /** 物体缩放后的宽度 */
    public currentWidth: number = 0;
    /** 物体缩放后的高度 */
    public currentHeight: number = 0;
    /** 激活态边框颜色 */
    public borderColor: string = 'red';
    /** 激活态控制点颜色 */
    public cornerColor: string = 'red';
    /** 物体默认填充颜色 */
    public fill: string = 'rgb(0,0,0)';
    /** 物体默认描边颜色，默认无 */
    public stroke: string;
    /** 物体默认描边宽度 */
    public strokeWidth: number = 1;
    /** 是否有控制点 */
    public hasControls: boolean = true;
    /** 是否有旋转控制点 */
    public hasRotatingPoint: boolean = true;
    /** 旋转控制点偏移量 */
    public rotatingPointOffset: number = 40;
    /** 移动的时候边框透明度 */
    public borderOpacityWhenMoving: number = 0.4;
    /** 物体是否在移动中 */
    public isMoving: boolean = false;
    /** 选中态的边框宽度 */
    public borderWidth: number = 1;
    /** 物体控制点用 stroke 还是 fill */
    public transparentCorners: boolean = false;
    /** 物体控制点大小，单位 px */
    public cornerSize: number = 12;
    /** 通过像素来检测物体而不是通过包围盒 */
    public perPixelTargetFind: boolean = false;
    /** 物体控制点位置，随时变化 */
    public oCoords: Coords;
    /** 物体所在的 canvas 画布 */
    public canvas;
    /** 物体执行变换之前的状态 */
    public originalState;
    /** 物体所属的组 */
    public group;
    /** 物体被拖蓝选区保存的时候需要临时保存下 hasControls 的值 */
    public orignHasControls: boolean = true;
    public stateProperties: string[] = ('top left width height scaleX scaleY ' + 'flipX flipY angle cornerSize fill originX originY ' + 'stroke strokeWidth ' + 'borderWidth transformMatrix visible').split(' ');

    private _cacheCanvas: HTMLCanvasElement;
    private _cacheContext: CanvasRenderingContext2D;
    public cacheWidth: number;
    public cacheHeight: number;
    public dirty: boolean;

    constructor(options) {
        super()
        this.initialize(options)
    }
    initialize(options) {
        options && this.setOptions(options);
    }
    setOptions(options) {
        for (let prop in options) {
            this[prop] = options[prop];
        }
    }
    /** 由子类实现，就是由具体物体类来实现 */
    abstract _render<T extends CanvasRenderingContext2D>(ctx: T, noTransform?: boolean): void;

    /** 渲染物体，默认用 fill 填充 */
    render(ctx: CanvasRenderingContext2D, noTransform: boolean = false) {
        if (this.width === 0 || this.height === 0 || !this.visible) return

        ctx.save()
        if (!noTransform) {
            this.transform(ctx)
        }

        if (this.stroke) {
            ctx.lineWidth = this.strokeWidth;
            ctx.strokeStyle = this.stroke;
        }

        if (this.fill) {
            ctx.fillStyle = this.fill
        }

        // 绘制物体
        this._render<CanvasRenderingContext2D>(ctx)
        if (this.active && !noTransform) {
            // 绘制激活物体边框
            this.drawBorders(ctx)
            // 绘制激活物体四周的控制点
            this.drawControls(ctx)
        }
        // 绘制坐标系
        this.drawAxis(ctx)
        ctx.restore()
    }
    drawAxis(ctx: CanvasRenderingContext2D) {
        ctx.save();
        const lengthRatio = 1.5;
        const w = this.getWidth();
        const h = this.getHeight();
        ctx.lineWidth = this.borderWidth;
        ctx.setLineDash([4 * lengthRatio, 3 * lengthRatio]);
        /** 画坐标轴的时候需要把 transform 变换中的 scale 效果抵消，这样才能画出原始大小的线条 */
        ctx.scale(1 / this.scaleX, 1 / this.scaleY);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo((w / 2) * lengthRatio, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, (h / 2) * lengthRatio);
        ctx.stroke();
        ctx.restore();
    }
    /** 绘制激活物体边框 */
    drawBorders(ctx: CanvasRenderingContext2D) {
        let padding = this.padding,
            padding2 = padding * 2,
            strokeWidth = this.borderWidth;

        ctx.save();

        ctx.globalAlpha = this.isMoving ? this.borderOpacityWhenMoving : 1;
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = strokeWidth;

        /** 画边框的时候需要把 transform 变换中的 scale 效果抵消，这样才能画出原始大小的线条 */
        ctx.scale(1 / this.scaleX, 1 / this.scaleY);

        let w = this.getWidth(),
            h = this.getHeight();
        // 画物体激活时候的边框，也就是包围盒，~~就是取整的意思
        ctx.strokeRect(-(w / 2) - padding - strokeWidth / 2, -(h / 2) - padding - strokeWidth / 2, w + padding2 + strokeWidth, h + padding2 + strokeWidth);

        // 画旋转控制点的那条线
        if (this.hasRotatingPoint && this.hasControls) {
            let rotateHeight = (-h - strokeWidth - padding * 2) / 2;

            ctx.beginPath();
            ctx.moveTo(0, rotateHeight);
            ctx.lineTo(0, rotateHeight - this.rotatingPointOffset);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
        return this;

    }
    /** 绘制包围盒模型的控制点 */
    drawControls(ctx: CanvasRenderingContext2D) {
        if (!this.hasControls) return;
        // 因为画布已经经过变换，所以大部分数值需要除以 scale 来抵消变换
        let size = this.cornerSize,
            size2 = size / 2,
            strokeWidth2 = this.strokeWidth / 2,
            // top 和 left 值为物体左上角的点
            left = -(this.width / 2),
            top = -(this.height / 2),
            _left,
            _top,
            sizeX = size / this.scaleX,
            sizeY = size / this.scaleY,
            paddingX = this.padding / this.scaleX,
            paddingY = this.padding / this.scaleY,
            scaleOffsetY = size2 / this.scaleY,
            scaleOffsetX = size2 / this.scaleX,
            scaleOffsetSizeX = (size2 - size) / this.scaleX,
            scaleOffsetSizeY = (size2 - size) / this.scaleY,
            height = this.height,
            width = this.width,
            // 控制点是实心还是空心
            methodName = this.transparentCorners ? 'strokeRect' : 'fillRect';

        ctx.save();

        ctx.lineWidth = this.borderWidth / Math.max(this.scaleX, this.scaleY);

        ctx.globalAlpha = this.isMoving ? this.borderOpacityWhenMoving : 1;
        ctx.strokeStyle = ctx.fillStyle = this.cornerColor;

        // top-left
        _left = left - scaleOffsetX - strokeWidth2 - paddingX;
        _top = top - scaleOffsetY - strokeWidth2 - paddingY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // top-right
        _left = left + width - scaleOffsetX + strokeWidth2 + paddingX;
        _top = top - scaleOffsetY - strokeWidth2 - paddingY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // bottom-left
        _left = left - scaleOffsetX - strokeWidth2 - paddingX;
        _top = top + height + scaleOffsetSizeY + strokeWidth2 + paddingY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // bottom-right
        _left = left + width + scaleOffsetSizeX + strokeWidth2 + paddingX;
        _top = top + height + scaleOffsetSizeY + strokeWidth2 + paddingY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // middle-top
        _left = left + width / 2 - scaleOffsetX;
        _top = top - scaleOffsetY - strokeWidth2 - paddingY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // middle-bottom
        _left = left + width / 2 - scaleOffsetX;
        _top = top + height + scaleOffsetSizeY + strokeWidth2 + paddingY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // middle-right
        _left = left + width + scaleOffsetSizeX + strokeWidth2 + paddingX;
        _top = top + height / 2 - scaleOffsetY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // middle-left
        _left = left - scaleOffsetX - strokeWidth2 - paddingX;
        _top = top + height / 2 - scaleOffsetY;
        ctx.clearRect(_left, _top, sizeX, sizeY);
        ctx[methodName](_left, _top, sizeX, sizeY);

        // 绘制旋转控制点
        if (this.hasRotatingPoint) {
            _left = left + width / 2 - scaleOffsetX;
            _top = top - this.rotatingPointOffset / this.scaleY - sizeY / 2 - strokeWidth2 - paddingY;

            ctx.clearRect(_left, _top, sizeX, sizeY);
            ctx[methodName](_left, _top, sizeX, sizeY);
        }

        ctx.restore();

        return this;
    }

    /** 绘制前需要进行各种变换（包括平移、旋转、缩放）
     * 注意变换顺序很重要，顺序不一样会导致不一样的结果，所以一个框架一旦定下来了，后面大概率是不能更改的
     * 我们采用的顺序是：平移 -> 旋转 -> 缩放，这样可以减少些计算量，如果我们先旋转，点的坐标值一般就不是整数，那么后面的变换基于非整数来计算
     */
    transform(ctx: CanvasRenderingContext2D) {
        let center = this.getCenterPoint()
        ctx.translate(center.x, center.y);
        ctx.rotate(Util.degreesToRadians(this.angle))
        ctx.scale(this.scaleX * (this.flipX ? -1 : 1), this.scaleY * (this.flipY ? -1 : 1));

    }
    /** 获取物体中心点 */
    getCenterPoint() {
        return this.translateToCenterPoint(new Point(this.left, this.top), this.originX, this.originY)
    }
    /** 将中心点移到变换基点 */
    translateToCenterPoint(point: Point, originX: string, originY: string) {
        let cx = point.x,
            cy = point.y;

        if (originX === 'left') {
            cx = point.x + this.getWidth() / 2;
        } else if (originX === 'right') {
            cx = point.x - this.getWidth() / 2;
        }

        if (originY === 'top') {
            cy = point.y + this.getHeight() / 2;
        } else if (originY === 'bottom') {
            cy = point.y - this.getHeight() / 2;
        }
        const p = new Point(cx, cy);
        if (this.angle) {
            return Util.rotatePoint(p, point, Util.degreesToRadians(this.angle));
        } else {
            return p;
        }


    }
    /** 获取当前大小，包含缩放效果 */
    getWidth(): number {
        return this.width * this.scaleX;
    }
    /** 获取当前大小，包含缩放效果 */
    getHeight(): number {
        return this.height * this.scaleY;
    }
    getAngle(): number {
        return this.angle;
    }
    setAngle(angle: number) {
        this.angle = angle;
    }
    setupState() {
        this.originalState = {};
        this.saveState();
    }
    /** 保存物体当前的状态到 originalState 中 */
    saveState(): FabricObject {
        this.stateProperties.forEach((prop) => {
            this.originalState[prop] = this[prop];
        });
        return this;
    }
    /** 重新设置物体包围盒的边框和各个控制点，包括位置和大小 */
    setCoords(): FabricObject {
        let strokeWidth = this.strokeWidth > 1 ? this.strokeWidth : 0,
            padding = this.padding,
            radian = Util.degreesToRadians(this.angle);

        this.currentWidth = (this.width + strokeWidth) * this.scaleX + padding * 2;
        this.currentHeight = (this.height + strokeWidth) * this.scaleY + padding * 2;

        // 物体中心点到顶点的斜边长度
        let _hypotenuse = Math.sqrt(Math.pow(this.currentWidth / 2, 2) + Math.pow(this.currentHeight / 2, 2));
        let _angle = Math.atan(this.currentHeight / this.currentWidth);
        // let _angle = Math.atan2(this.currentHeight, this.currentWidth);

        // offset added for rotate and scale actions
        let offsetX = Math.cos(_angle + radian) * _hypotenuse,
            offsetY = Math.sin(_angle + radian) * _hypotenuse,
            sinTh = Math.sin(radian),
            cosTh = Math.cos(radian);

        let coords = this.getCenterPoint();
        let tl = {
            x: coords.x - offsetX,
            y: coords.y - offsetY,
        };
        let tr = {
            x: tl.x + this.currentWidth * cosTh,
            y: tl.y + this.currentWidth * sinTh,
        };
        let br = {
            x: tr.x - this.currentHeight * sinTh,
            y: tr.y + this.currentHeight * cosTh,
        };
        let bl = {
            x: tl.x - this.currentHeight * sinTh,
            y: tl.y + this.currentHeight * cosTh,
        };
        let ml = {
            x: tl.x - (this.currentHeight / 2) * sinTh,
            y: tl.y + (this.currentHeight / 2) * cosTh,
        };
        let mt = {
            x: tl.x + (this.currentWidth / 2) * cosTh,
            y: tl.y + (this.currentWidth / 2) * sinTh,
        };
        let mr = {
            x: tr.x - (this.currentHeight / 2) * sinTh,
            y: tr.y + (this.currentHeight / 2) * cosTh,
        };
        let mb = {
            x: bl.x + (this.currentWidth / 2) * cosTh,
            y: bl.y + (this.currentWidth / 2) * sinTh,
        };
        let mtr = {
            x: tl.x + (this.currentWidth / 2) * cosTh,
            y: tl.y + (this.currentWidth / 2) * sinTh,
        };

        // clockwise
        this.oCoords = { tl, tr, br, bl, ml, mt, mr, mb, mtr };

        // set coordinates of the draggable boxes in the corners used to scale/rotate the image
        this._setCornerCoords();

        return this;
    }
    /** 重新设置物体的每个控制点，包括位置和大小 */
    _setCornerCoords() {
        let coords = this.oCoords,
            radian = Util.degreesToRadians(this.angle),
            newTheta = Util.degreesToRadians(45 - this.angle),
            cornerHypotenuse = Math.sqrt(2 * Math.pow(this.cornerSize, 2)) / 2,
            cosHalfOffset = cornerHypotenuse * Math.cos(newTheta),
            sinHalfOffset = cornerHypotenuse * Math.sin(newTheta),
            sinTh = Math.sin(radian),
            cosTh = Math.cos(radian);

        coords.tl.corner = {
            tl: {
                x: coords.tl.x - sinHalfOffset,
                y: coords.tl.y - cosHalfOffset,
            },
            tr: {
                x: coords.tl.x + cosHalfOffset,
                y: coords.tl.y - sinHalfOffset,
            },
            bl: {
                x: coords.tl.x - cosHalfOffset,
                y: coords.tl.y + sinHalfOffset,
            },
            br: {
                x: coords.tl.x + sinHalfOffset,
                y: coords.tl.y + cosHalfOffset,
            },
        };

        coords.tr.corner = {
            tl: {
                x: coords.tr.x - sinHalfOffset,
                y: coords.tr.y - cosHalfOffset,
            },
            tr: {
                x: coords.tr.x + cosHalfOffset,
                y: coords.tr.y - sinHalfOffset,
            },
            br: {
                x: coords.tr.x + sinHalfOffset,
                y: coords.tr.y + cosHalfOffset,
            },
            bl: {
                x: coords.tr.x - cosHalfOffset,
                y: coords.tr.y + sinHalfOffset,
            },
        };

        coords.bl.corner = {
            tl: {
                x: coords.bl.x - sinHalfOffset,
                y: coords.bl.y - cosHalfOffset,
            },
            bl: {
                x: coords.bl.x - cosHalfOffset,
                y: coords.bl.y + sinHalfOffset,
            },
            br: {
                x: coords.bl.x + sinHalfOffset,
                y: coords.bl.y + cosHalfOffset,
            },
            tr: {
                x: coords.bl.x + cosHalfOffset,
                y: coords.bl.y - sinHalfOffset,
            },
        };

        coords.br.corner = {
            tr: {
                x: coords.br.x + cosHalfOffset,
                y: coords.br.y - sinHalfOffset,
            },
            bl: {
                x: coords.br.x - cosHalfOffset,
                y: coords.br.y + sinHalfOffset,
            },
            br: {
                x: coords.br.x + sinHalfOffset,
                y: coords.br.y + cosHalfOffset,
            },
            tl: {
                x: coords.br.x - sinHalfOffset,
                y: coords.br.y - cosHalfOffset,
            },
        };

        coords.ml.corner = {
            tl: {
                x: coords.ml.x - sinHalfOffset,
                y: coords.ml.y - cosHalfOffset,
            },
            tr: {
                x: coords.ml.x + cosHalfOffset,
                y: coords.ml.y - sinHalfOffset,
            },
            bl: {
                x: coords.ml.x - cosHalfOffset,
                y: coords.ml.y + sinHalfOffset,
            },
            br: {
                x: coords.ml.x + sinHalfOffset,
                y: coords.ml.y + cosHalfOffset,
            },
        };

        coords.mt.corner = {
            tl: {
                x: coords.mt.x - sinHalfOffset,
                y: coords.mt.y - cosHalfOffset,
            },
            tr: {
                x: coords.mt.x + cosHalfOffset,
                y: coords.mt.y - sinHalfOffset,
            },
            bl: {
                x: coords.mt.x - cosHalfOffset,
                y: coords.mt.y + sinHalfOffset,
            },
            br: {
                x: coords.mt.x + sinHalfOffset,
                y: coords.mt.y + cosHalfOffset,
            },
        };

        coords.mr.corner = {
            tl: {
                x: coords.mr.x - sinHalfOffset,
                y: coords.mr.y - cosHalfOffset,
            },
            tr: {
                x: coords.mr.x + cosHalfOffset,
                y: coords.mr.y - sinHalfOffset,
            },
            bl: {
                x: coords.mr.x - cosHalfOffset,
                y: coords.mr.y + sinHalfOffset,
            },
            br: {
                x: coords.mr.x + sinHalfOffset,
                y: coords.mr.y + cosHalfOffset,
            },
        };

        coords.mb.corner = {
            tl: {
                x: coords.mb.x - sinHalfOffset,
                y: coords.mb.y - cosHalfOffset,
            },
            tr: {
                x: coords.mb.x + cosHalfOffset,
                y: coords.mb.y - sinHalfOffset,
            },
            bl: {
                x: coords.mb.x - cosHalfOffset,
                y: coords.mb.y + sinHalfOffset,
            },
            br: {
                x: coords.mb.x + sinHalfOffset,
                y: coords.mb.y + cosHalfOffset,
            },
        };

        coords.mtr.corner = {
            tl: {
                x: coords.mtr.x - sinHalfOffset + sinTh * this.rotatingPointOffset,
                y: coords.mtr.y - cosHalfOffset - cosTh * this.rotatingPointOffset,
            },
            tr: {
                x: coords.mtr.x + cosHalfOffset + sinTh * this.rotatingPointOffset,
                y: coords.mtr.y - sinHalfOffset - cosTh * this.rotatingPointOffset,
            },
            bl: {
                x: coords.mtr.x - cosHalfOffset + sinTh * this.rotatingPointOffset,
                y: coords.mtr.y + sinHalfOffset - cosTh * this.rotatingPointOffset,
            },
            br: {
                x: coords.mtr.x + sinHalfOffset + sinTh * this.rotatingPointOffset,
                y: coords.mtr.y + cosHalfOffset - cosTh * this.rotatingPointOffset,
            },
        };
    }

}