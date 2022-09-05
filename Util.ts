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

}
