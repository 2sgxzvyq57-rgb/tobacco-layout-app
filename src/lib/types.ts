/** 门所在墙面 */
export type WallDirection = 'north' | 'south' | 'east' | 'west';

/** 物体类型 */
export type ObjectType = 'counter' | 'storage' | 'showcase' | 'fridge' | 'other';

/** 门信息 */
export interface DoorInfo {
  wall: WallDirection;
  position: number; // 0-1，门在墙面上的位置
  width: number;    // 门宽度（米）
}

/** 店内物体 */
export interface StoreObject {
  id: string;       // 唯一标识，用于选中操作
  name: string;
  type: ObjectType;
  x: number;        // 左下角X坐标（米）
  y: number;        // 左下角Y坐标（米）
  width: number;    // 宽度（米）
  length: number;   // 长度（米）
  rotation: number; // 旋转角度（0-360度），0度表示默认朝向
}

/** 店面布局数据 */
export interface StoreLayout {
  width: number;    // 店面宽度（米）
  length: number;   // 店面长度（米）
  door: DoorInfo;
  objects: StoreObject[];
}

/** API 请求 */
export interface ParseRequest {
  text: string;
}

/** API 响应 */
export interface ParseResponse {
  success: boolean;
  data?: StoreLayout;
  error?: string;
}
