import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  ArrowDown,
  Cpu,
  Link as LinkIcon,
  CloudUpload,
  CloudDownload,
} from "lucide-react";
import {
  EnhancedTrafficGraph,
  EnhancedTrafficGraphRef,
  ITrafficItem,
} from "./enhanced-traffic-graph";
import { useVisibility } from "@/hooks/use-visibility";
import { useClashInfo } from "@/hooks/use-clash";
import { useVerge } from "@/hooks/use-verge";
import { createSockette } from "@/utils/websocket";
import parseTraffic from "@/utils/parse-traffic";
import { isDebugEnabled, gc } from "@/services/api";
import { ReactNode } from "react";
import { useAppData, useAppRealtime } from "@/providers/app-data-provider";
import { cn } from "@root/lib/utils";

interface MemoryUsage {
  inuse: number;
  oslimit?: number;
}

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  unit: string;
  color: "primary" | "secondary" | "error" | "warning" | "info" | "success";
  onClick?: () => void;
}

// 全局变量类型定义
declare global {
  interface Window {
    animationFrameId?: number;
    lastTrafficData?: {
      up: number;
      down: number;
    };
  }
}

// 控制更新频率
const CONNECTIONS_UPDATE_INTERVAL = 5000; // 5秒更新一次连接数据
const THROTTLE_TRAFFIC_UPDATE = 500; // 500ms节流流量数据更新

// 统计卡片组件 - 使用memo优化
const CompactStatCard = memo(
  ({ icon, title, value, unit, color, onClick }: StatCardProps) => {
    // 颜色映射
    const colorClasses = useMemo(() => {
      const colors = {
        primary: "text-green-600 bg-green-500/10 border-green-500/20 hover:bg-green-500/20 hover:border-green-500/40",
        secondary: "text-violet-600 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/40",
        error: "text-red-600 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40",
        warning: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20 hover:border-yellow-500/40",
        info: "text-blue-600 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40",
        success: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40",
      };

      // 暗黑模式下的颜色调整
      const darkColors = {
        primary: "dark:text-green-400 dark:bg-green-500/20 dark:border-green-500/30 dark:hover:bg-green-500/30",
        secondary: "dark:text-violet-400 dark:bg-violet-500/20 dark:border-violet-500/30 dark:hover:bg-violet-500/30",
        error: "dark:text-red-400 dark:bg-red-500/20 dark:border-red-500/30 dark:hover:bg-red-500/30",
        warning: "dark:text-yellow-400 dark:bg-yellow-500/20 dark:border-yellow-500/30 dark:hover:bg-yellow-500/30",
        info: "dark:text-blue-400 dark:bg-blue-500/20 dark:border-blue-500/30 dark:hover:bg-blue-500/30",
        success: "dark:text-emerald-400 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:hover:bg-emerald-500/30",
      };

      return `${colors[color] || colors.primary} ${darkColors[color] || darkColors.primary}`;
    }, [color]);

    const iconBgClasses = useMemo(() => {
      const colors = {
        primary: "bg-green-500/20 text-green-600",
        secondary: "bg-violet-500/20 text-violet-600",
        error: "bg-red-500/20 text-red-600",
        warning: "bg-yellow-500/20 text-yellow-600",
        info: "bg-blue-500/20 text-blue-600",
        success: "bg-emerald-500/20 text-emerald-600",
      };

      const darkColors = {
        primary: "dark:bg-green-500/30 dark:text-green-400",
        secondary: "dark:bg-violet-500/30 dark:text-violet-400",
        error: "dark:bg-red-500/30 dark:text-red-400",
        warning: "dark:bg-yellow-500/30 dark:text-yellow-400",
        info: "dark:bg-blue-500/30 dark:text-blue-400",
        success: "dark:bg-emerald-500/30 dark:text-emerald-400",
      };

      return `${colors[color] || colors.primary} ${darkColors[color] || darkColors.primary}`;
    }, [color]);

    return (
      <div
        className={cn(
          "flex items-center rounded-lg border p-2 transition-all duration-200",
          colorClasses,
          onClick ? "cursor-pointer hover:shadow-sm" : "cursor-default"
        )}
        onClick={onClick}
      >
        {/* 图标容器 */}
        <div
          className={cn(
            "mr-2 ml-[2px] flex h-8 w-8 items-center justify-center rounded-full",
            iconBgClasses
          )}
        >
          {icon}
        </div>

        {/* 文本内容 */}
        <div className="flex min-w-0 flex-grow flex-col">
          <span className="truncate text-xs text-muted-foreground">
            {title}
          </span>
          <div className="flex items-baseline">
            <span className="mr-0.5 truncate text-base font-bold text-foreground">
              {value}
            </span>
            <span className="text-xs text-muted-foreground">
              {unit}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

// 添加显示名称
CompactStatCard.displayName = "CompactStatCard";

export const EnhancedTrafficStats = () => {
  const { t } = useTranslation();
  const { clashInfo } = useClashInfo();
  const { verge } = useVerge();
  const trafficRef = useRef<EnhancedTrafficGraphRef>(null);
  const pageVisible = useVisibility();
  const [isDebug, setIsDebug] = useState(false);

  // 使用AppDataProvider
  const { connections, uptime } = useAppRealtime();

  // 使用单一状态对象减少状态更新次数
  const [stats, setStats] = useState({
    traffic: { up: 0, down: 0 },
    memory: { inuse: 0, oslimit: undefined as number | undefined },
  });

  // 创建一个标记来追踪最后更新时间，用于节流
  const lastUpdateRef = useRef({ traffic: 0 });

  // 是否显示流量图表
  const trafficGraph = verge?.traffic_graph ?? true;

  // WebSocket引用
  const socketRefs = useRef<{
    traffic: ReturnType<typeof createSockette> | null;
    memory: ReturnType<typeof createSockette> | null;
  }>({
    traffic: null,
    memory: null,
  });

  // 检查是否支持调试
  useEffect(() => {
    isDebugEnabled().then((flag) => setIsDebug(flag));
  }, []);

  // 处理流量数据更新 - 使用节流控制更新频率
  const handleTrafficUpdate = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as ITrafficItem;
      if (
        data &&
        typeof data.up === "number" &&
        typeof data.down === "number"
      ) {
        // 使用节流控制更新频率
        const now = Date.now();
        if (now - lastUpdateRef.current.traffic < THROTTLE_TRAFFIC_UPDATE) {
          try {
            trafficRef.current?.appendData({
              up: data.up,
              down: data.down,
              timestamp: now,
            });
          } catch { }
          return;
        }
        lastUpdateRef.current.traffic = now;
        const safeUp = isNaN(data.up) ? 0 : data.up;
        const safeDown = isNaN(data.down) ? 0 : data.down;
        try {
          setStats((prev) => ({
            ...prev,
            traffic: { up: safeUp, down: safeDown },
          }));
        } catch { }
        try {
          trafficRef.current?.appendData({
            up: safeUp,
            down: safeDown,
            timestamp: now,
          });
        } catch { }
      }
    } catch (err) {
      console.error("[Traffic] 解析数据错误:", err, event.data);
    }
  }, []);

  // 处理内存数据更新
  const handleMemoryUpdate = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as MemoryUsage;
      if (data && typeof data.inuse === "number") {
        setStats((prev) => ({
          ...prev,
          memory: {
            inuse: isNaN(data.inuse) ? 0 : data.inuse,
            oslimit: data.oslimit,
          },
        }));
      }
    } catch (err) {
      console.error("[Memory] 解析数据错误:", err, event.data);
    }
  }, []);

  // 使用 WebSocket 连接获取数据 - 合并流量和内存连接逻辑
  useEffect(() => {
    if (!clashInfo || !pageVisible) return;

    const { server, secret = "" } = clashInfo;
    if (!server) return;

    // 清理现有连接的函数
    const cleanupSockets = () => {
      Object.values(socketRefs.current).forEach((socket) => {
        if (socket) {
          socket.close();
        }
      });
      socketRefs.current = { traffic: null, memory: null };
    };

    // 关闭现有连接
    cleanupSockets();

    // 创建新连接
    console.log(
      `[Traffic][${EnhancedTrafficStats.name}] 正在连接: ${server}/traffic`,
    );
    socketRefs.current.traffic = createSockette(
      `${server}/traffic`,
      {
        onmessage: handleTrafficUpdate,
        onopen: (event) => {
          console.log(
            `[Traffic][${EnhancedTrafficStats.name}] WebSocket 连接已建立`,
            event,
          );
        },
        onerror: (event) => {
          console.error(
            `[Traffic][${EnhancedTrafficStats.name}] WebSocket 连接错误或达到最大重试次数`,
            event,
          );
          setStats((prev) => ({ ...prev, traffic: { up: 0, down: 0 } }));
        },
        onclose: (event) => {
          console.log(
            `[Traffic][${EnhancedTrafficStats.name}] WebSocket 连接关闭`,
            event.code,
            event.reason,
          );
          if (event.code !== 1000 && event.code !== 1001) {
            console.warn(
              `[Traffic][${EnhancedTrafficStats.name}] 连接非正常关闭，重置状态`,
            );
            setStats((prev) => ({ ...prev, traffic: { up: 0, down: 0 } }));
          }
        },
      },
      10,
      secret,
    );

    console.log(
      `[Memory][${EnhancedTrafficStats.name}] 正在连接: ${server}/memory`,
    );
    socketRefs.current.memory = createSockette(
      `${server}/memory`,
      {
        onmessage: handleMemoryUpdate,
        onopen: (event) => {
          console.log(
            `[Memory][${EnhancedTrafficStats.name}] WebSocket 连接已建立`,
            event,
          );
        },
        onerror: (event) => {
          console.error(
            `[Memory][${EnhancedTrafficStats.name}] WebSocket 连接错误或达到最大重试次数`,
            event,
          );
          setStats((prev) => ({
            ...prev,
            memory: { inuse: 0, oslimit: undefined },
          }));
        },
        onclose: (event) => {
          console.log(
            `[Memory][${EnhancedTrafficStats.name}] WebSocket 连接关闭`,
            event.code,
            event.reason,
          );
          if (event.code !== 1000 && event.code !== 1001) {
            console.warn(
              `[Memory][${EnhancedTrafficStats.name}] 连接非正常关闭，重置状态`,
            );
            setStats((prev) => ({
              ...prev,
              memory: { inuse: 0, oslimit: undefined },
            }));
          }
        },
      },
      10,
      secret,
    );

    return cleanupSockets;
  }, [clashInfo, pageVisible, handleTrafficUpdate, handleMemoryUpdate]);

  // 组件卸载时清理所有定时器/引用
  useEffect(() => {
    return () => {
      try {
        Object.values(socketRefs.current).forEach((socket) => {
          if (socket) socket.close();
        });
        socketRefs.current = { traffic: null, memory: null };
      } catch { }
    };
  }, []);

  // 执行垃圾回收
  const handleGarbageCollection = useCallback(async () => {
    if (isDebug) {
      try {
        await gc();
        console.log("[Debug] 垃圾回收已执行");
      } catch (err) {
        console.error("[Debug] 垃圾回收失败:", err);
      }
    }
  }, [isDebug]);

  // 使用useMemo计算解析后的流量数据
  const parsedData = useMemo(() => {
    const [up, upUnit] = parseTraffic(stats.traffic.up);
    const [down, downUnit] = parseTraffic(stats.traffic.down);
    const [inuse, inuseUnit] = parseTraffic(stats.memory.inuse);
    const [uploadTotal, uploadTotalUnit] = parseTraffic(
      connections.uploadTotal,
    );
    const [downloadTotal, downloadTotalUnit] = parseTraffic(
      connections.downloadTotal,
    );

    return {
      up,
      upUnit,
      down,
      downUnit,
      inuse,
      inuseUnit,
      uploadTotal,
      uploadTotalUnit,
      downloadTotal,
      downloadTotalUnit,
      connectionsCount: connections.count,
    };
  }, [stats, connections]);

  // 渲染流量图表 - 使用useMemo缓存渲染结果
  const trafficGraphComponent = useMemo(() => {
    if (!trafficGraph || !pageVisible) return null;

    return (
      <div
        className="h-[130px] cursor-pointer rounded-lg border border-border/20 overflow-hidden bg-background"
        onClick={() => trafficRef.current?.toggleStyle()}
      >
        <div style={{ height: "100%", position: "relative" }}>
          <EnhancedTrafficGraph ref={trafficRef} />
          {isDebug && (
            <div
              style={{
                position: "absolute",
                top: "2px",
                left: "2px",
                zIndex: 10,
                backgroundColor: "rgba(0,0,0,0.5)",
                color: "white",
                fontSize: "8px",
                padding: "2px 4px",
                borderRadius: "4px",
              }}
            >
              DEBUG: {!!trafficRef.current ? "图表已初始化" : "图表未初始化"}
              <br />
              {new Date().toISOString().slice(11, 19)}
            </div>
          )}
        </div>
      </div>
    );
  }, [trafficGraph, pageVisible, isDebug]);

  // 使用useMemo计算统计卡片配置
  const statCards = useMemo(
    () => [
      {
        icon: <ArrowUp size={16} />,
        title: t("Upload Speed"),
        value: parsedData.up,
        unit: `${parsedData.upUnit}/s`,
        color: "secondary" as const,
      },
      {
        icon: <ArrowDown size={16} />,
        title: t("Download Speed"),
        value: parsedData.down,
        unit: `${parsedData.downUnit}/s`,
        color: "primary" as const,
      },
      {
        icon: <LinkIcon size={16} />,
        title: t("Active Connections"),
        value: parsedData.connectionsCount,
        unit: "",
        color: "success" as const,
      },
      {
        icon: <CloudUpload size={16} />,
        title: t("Uploaded"),
        value: parsedData.uploadTotal,
        unit: parsedData.uploadTotalUnit,
        color: "secondary" as const,
      },
      {
        icon: <CloudDownload size={16} />,
        title: t("Downloaded"),
        value: parsedData.downloadTotal,
        unit: parsedData.downloadTotalUnit,
        color: "primary" as const,
      },
      {
        icon: <Cpu size={16} />,
        title: t("Memory Usage"),
        value: parsedData.inuse,
        unit: parsedData.inuseUnit,
        color: "error" as const,
        onClick: isDebug ? handleGarbageCollection : undefined,
      },
    ],
    [t, parsedData, isDebug, handleGarbageCollection],
  );

  return (
    <div className="grid grid-cols-3 gap-2 w-full">
      {trafficGraph && (
        <div className="col-span-3">
          {/* 流量图表区域 */}
          {trafficGraphComponent}
        </div>
      )}
      {/* 统计卡片区域 */}
      {statCards.map((card, index) => (
        <div key={index} className="col-span-1">
          <CompactStatCard {...card} />
        </div>
      ))}
    </div>
  );
};
