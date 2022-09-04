export class Util {
    /** 给元素设置样式 */
    static setStyle(element: HTMLElement, styles) {
        let elementStyle = element.style;

        if (typeof styles === 'string') {
            element.style.cssText += ';' + styles;
            return styles.indexOf('opacity') > -1 ? Util.setOpacity(element, styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
        }
        for (let property in styles) {
            if (property === 'opacity') {
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

}