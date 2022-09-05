import { Canvas } from './Canvas';
import { FabricImage } from './FabricImage';
import { FabricObject } from './FabricObject';
import { Group } from './Group';
import { Rect } from './Rect';
import { Util } from './Util';

// 最终导出的东西都挂载到 fabric 上面
export class fabric {
    static Canvas = Canvas;
    static FabricObject = FabricObject;
    static Rect = Rect;
    static Group = Group;
    static FabricImage = FabricImage;
    static Util = Util;
}