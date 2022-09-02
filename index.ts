import { Canvas } from './Canvas';

// 最终导出的东西都挂载到 fabric 上面
export default class fabric {
    static Canvas = Canvas;
    static FabricObject = null;
    static Rect = null;
    static Group = null;
    static FabricImage = null;
    static Util = null;
}