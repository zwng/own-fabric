import { IAnimationOption, Offset, Transform } from './interface';

import { Point } from './Point';

const PiBy180 = Math.PI / 180; // 写在这里相当于缓存，因为会频繁调用

export class Util {
    /** 给元素设置样式 */
    static setStyle(element: HTMLElement, styles: any) {
        let elementStyle = element.style;

        if (typeof styles === "string") {
            element.style.cssText += ";" + styles;
            return styles.indexOf("opacity") > -1
                ? Util.setOpacity(element, styles.match(/opacity:\s*(\d?\.?\d*)/)![1])
                : element;
        }
        for (let property in styles) {
            if (property === "opacity") {
                Util.setOpacity(element, styles[property]);
            } else {
                elementStyle[property] = styles[property];
            }
        }
        return element;
    }
    /** 设置元素透明度 */
    static setOpacity(element: HTMLElement, value: string) {
        element.style.opacity = value;
        return element;
    }
    /**使元素不可选择 */
    static makeElementUnselectable(element: HTMLElement) {
        element.style.userSelect = "none";
        return element;
    }
    /**给元素添加类名 */
    static addClass(element: HTMLElement, className: string) {
        if ((" " + element.className + " ").indexOf(" " + className + " ") === -1) {
            element.className += (element.className ? " " : "") + className;
        }
    }
    /** 计算元素偏移值 */
    static getElementOffset(element): Offset {
        let valueT = 0,
            valueL = 0;
        do {
            valueT += element.offsetTop || 0;
            valueL += element.offsetLeft || 0;
            element = element.offsetParent;
        } while (element);
        return { left: valueL, top: valueT };
    }
    /** 包裹元素并替换 */
    static wrapElement(element: HTMLElement, wrapper: HTMLElement | string, attributes) {
        if (typeof wrapper === 'string') {
            wrapper = Util.makeElement(wrapper, attributes);
        }
        if (element.parentNode) {
            element.parentNode.replaceChild(wrapper, element);
        }
        wrapper.appendChild(element);
        return wrapper;
    }
    /** 新建元素并添加相应属性 */
    static makeElement(tagName: string, attributes) {
        let el = document.createElement(tagName);
        for (let prop in attributes) {
            if (prop === 'class') {
                el.className = attributes[prop];
            } else {
                el.setAttribute(prop, attributes[prop]);
            }
        }
        return el;
    }
    /** 单纯的创建一个新的 canvas 元素 */
    static createCanvasElement() {
        const canvas = document.createElement('canvas');
        return canvas;
    }
    /**添加事件监听 */
    static addListener(element, eventName, handler) {
        element.addEventListener(eventName, handler, false);
    }
    /**
     * 将 point 绕 origin 旋转 radians 弧度
     * @param {Point} point 要旋转的点
     * @param {Point} origin 旋转中心点
     * @param {number} radians 注意 canvas 中用的都是弧度
     * @returns
     */
    static rotatePoint(point: Point, origin: Point, radians: number): Point {
        const sin = Math.sin(radians),
            cos = Math.cos(radians);

        point.subtractEquals(origin);

        const rx = point.x * cos - point.y * sin;
        const ry = point.x * sin + point.y * cos;

        return new Point(rx, ry).addEquals(origin);
    }
    /** 角度转弧度，注意 canvas 中用的都是弧度，但是角度对我们来说比较直观 */
    static degreesToRadians(degrees: number): number {
        return degrees * PiBy180;
    }
    /** 获取鼠标的点击坐标，相对于页面左上角，注意不是画布的左上角，到时候会减掉 offset */
    static getPointer(event: Event, upperCanvasEl: HTMLCanvasElement) {
        event || (event = window.event as Event);

        let element: HTMLElement | Document = event.target as Document | HTMLElement,
            body = document.body || { scrollLeft: 0, scrollTop: 0 },
            docElement = document.documentElement,
            orgElement = element,
            scrollLeft = 0,
            scrollTop = 0,
            firstFixedAncestor;

        while (element && element.parentNode && !firstFixedAncestor) {
            element = element.parentNode as Document | HTMLElement;
            if (element !== document && Util.getElementPosition(element as HTMLElement) === 'fixed') firstFixedAncestor = element;

            if (element !== document && orgElement !== upperCanvasEl && Util.getElementPosition(element as HTMLElement) === 'absolute') {
                scrollLeft = 0;
                scrollTop = 0;
            } else if (element === document && orgElement !== upperCanvasEl) {
                scrollLeft = body.scrollLeft || docElement.scrollLeft || 0;
                scrollTop = body.scrollTop || docElement.scrollTop || 0;
            } else {
                scrollLeft += (element as HTMLElement).scrollLeft || 0;
                scrollTop += (element as HTMLElement).scrollTop || 0;
            }
        }

        return {
            x: Util.pointerX(event) + scrollLeft,
            y: Util.pointerY(event) + scrollTop,
        };
    }
    /** 获取元素位置 */
    static getElementPosition(element: HTMLElement) {
        return window.getComputedStyle(element, null).position;
    }
    static pointerX(event) {
        return event.clientX || 0;
    }
    static pointerY(event) {
        return event.clientY || 0;
    }
    static clone(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        let temp = new obj.constructor();
        for (let key in obj) {
            if (!obj[key] || typeof obj[key] !== 'object') {
                temp[key] = obj[key];
            } else {
                temp[key] = Util.clone(obj[key]);
            }
        }
        return temp;
    }
    static animate(options: IAnimationOption) {
        window.requestAnimationFrame((timestamp: number) => {
            let start = timestamp || +new Date(), // 开始时间
                duration = options.duration || 500, // 动画时间
                finish = start + duration, // 结束时间
                time, // 当前时间
                onChange = options.onChange || (() => { }),
                abort = options.abort || (() => false),
                easing = options.easing || ((t, b, c, d) => -c * Math.cos((t / d) * (Math.PI / 2)) + c + b),
                startValue = options.startValue || 0, // 初始值
                endValue = options.endValue || 100, // 结束值
                byValue = options.byValue || endValue - startValue; // 值的变化范围

            function tick(ticktime: number) {
                // tick 的主要任务就是根据时间更新值
                time = ticktime || +new Date();
                let currentTime = time > finish ? duration : time - start; // 当前已经执行了多久时间（介于0~duration）
                if (abort()) {
                    options.onComplete && options.onComplete();
                    return;
                }
                onChange(easing(currentTime, startValue, byValue, duration)); // 其实 animate 函数只是根据 easing 函数计算出了某个值，然后传给调用者而已
                if (time > finish) {
                    options.onComplete && options.onComplete();
                    return;
                }
                window.requestAnimationFrame(tick);
            }

            options.onStart && options.onStart(); // 动画开始前的回调
            tick(start);
        });
    }
    static transformPoint(p, t, ignoreOffset: boolean = false) {
        if (ignoreOffset) {
            return new Point(t[0] * p.x + t[2] * p.y, t[1] * p.x + t[3] * p.y);
        }
        return new Point(t[0] * p.x + t[2] * p.y + t[4], t[1] * p.x + t[3] * p.y + t[5]);
    }
    static makeBoundingBoxFromPoints(points) {
        let xPoints = [points[0].x, points[1].x, points[2].x, points[3].x],
            minX = Util.min(xPoints),
            maxX = Util.max(xPoints),
            width = Math.abs(minX - maxX),
            yPoints = [points[0].y, points[1].y, points[2].y, points[3].y],
            minY = Util.min(yPoints),
            maxY = Util.max(yPoints),
            height = Math.abs(minY - maxY);

        return {
            left: minX,
            top: minY,
            width: width,
            height: height,
        };
    }
    /**
     * 数组的最小值
     */
    static min(array: any[], byProperty = '') {
        if (!array || array.length === 0) return undefined;

        let i = array.length - 1,
            result = byProperty ? array[i][byProperty] : array[i];

        if (byProperty) {
            while (i--) {
                if (array[i][byProperty] < result) {
                    result = array[i][byProperty];
                }
            }
        } else {
            while (i--) {
                if (array[i] < result) {
                    result = array[i];
                }
            }
        }
        return result;
    }
    /**
     * 数组的最大值
     */
    static max(array: any[], byProperty = '') {
        if (!array || array.length === 0) return undefined;

        let i = array.length - 1,
            result = byProperty ? array[i][byProperty] : array[i];
        if (byProperty) {
            while (i--) {
                if (array[i][byProperty] >= result) {
                    result = array[i][byProperty];
                }
            }
        } else {
            while (i--) {
                if (array[i] >= result) {
                    result = array[i];
                }
            }
        }
        return result;
    }
    static multiplyTransformMatrices(a, b, is2x2 = false) {
        // Matrix multiply a * b
        return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], is2x2 ? 0 : a[0] * b[4] + a[2] * b[5] + a[4], is2x2 ? 0 : a[1] * b[4] + a[3] * b[5] + a[5]];
    }
    /** 和原生的 toFixed 一样，只不过返回的数字 */
    static toFixed(number: number | string, fractionDigits: number): number {
        return parseFloat(Number(number).toFixed(fractionDigits));
    }
    /**
     * 把源对象的某些属性赋值给目标对象
     * @param source 源对象
     * @param destination 目标对象
     * @param properties 需要赋值的属性
     */
    static populateWithProperties(source, destination, properties) {
        if (properties && Object.prototype.toString.call(properties) === '[object Array]') {
            for (var i = 0, len = properties.length; i < len; i++) {
                destination[properties[i]] = source[properties[i]];
            }
        }
    }
    static matrixToSVG(transform) {
        return (
            'matrix(' +
            transform
                .map((value) => {
                    return Util.toFixed(value, 2);
                })
                .join(' ') +
            ')'
        );
    }
    /** 从数组中溢出某个元素 */
    static removeFromArray(array: any[], value: any) {
        let idx = array.indexOf(value);
        if (idx !== -1) {
            array.splice(idx, 1);
        }
        return array;
    }
    static removeListener(element, eventName, handler) {
        element.removeEventListener(eventName, handler, false);
    }
    /** 弧度转角度，注意 canvas 中用的都是弧度，但是角度对我们来说比较直观 */
    static radiansToDegrees(radians: number): number {
        return radians / PiBy180;
    }
    static loadImage(url, options: any = {}) {
        return new Promise(function (resolve, reject) {
            let img = document.createElement('img');
            let done = () => {
                img.onload = img.onerror = null;
                resolve(img);
            };
            if (url) {
                img.onload = done;
                img.onerror = () => {
                    reject(new Error('Error loading ' + img.src));
                };
                options && options.crossOrigin && (img.crossOrigin = options.crossOrigin);
                img.src = url;
            } else {
                done();
            }
        });
    }

}
