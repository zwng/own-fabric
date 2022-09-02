/**
 * 发布订阅，事件中心
 * 应用场景：可以在渲染前后、初始化物体前后、物体状态改变时触发一系列事件
 */

export class EventCenter {
    // 私有属性  事件监听对象
    private __eventListeners;

    on(type, handler) {
        if (!this.__eventListeners) {
            this.__eventListeners = {}
        }
        if (!this.__eventListeners[type]) {
            this.__eventListeners[type] = []
        }
        this.__eventListeners[type].push(handler)
    }
    off(type, handler) {
        if (!this.__eventListeners) {
            return this
        }
        if (arguments.length == 0) {
            for (const name in this.__eventListeners) {
                this.removeEventListener.call(this, name)
            }
        } else {
            this.removeEventListener.call(this, type, handler)
        }
    }
    emit(type, options = {}) {
        
    }
    removeEventListener(type, handler) {
        if (!this.__eventListeners[type]) {
            return
        }

        let eList = this.__eventListeners[type]
        if (handler) {
            eList[eList.indexOf(handler)] = false
        } else {
            eList.fill(false)
        }
        
    }

}