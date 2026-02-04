import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  SignalHigh,
  SignalMedium,
  SignalLow,
  Signal,
  WifiOff,
  ChevronRight,
  ArrowUpDown,
  Clock,
  ArrowDownAZ,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EnhancedCard } from "@/components/home/enhanced-card";
import { updateProxy, deleteConnection } from "@/services/api";
import delayManager from "@/services/delay";
import { useVerge } from "@/hooks/use-verge";
import { useAppStatic, useAppRealtime } from "@/providers/app-data-provider";
import { cn } from "@root/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 本地存储的键名
const STORAGE_KEY_GROUP = "clash-verge-selected-proxy-group";
const STORAGE_KEY_PROXY = "clash-verge-selected-proxy";
const STORAGE_KEY_SORT_TYPE = "clash-verge-proxy-sort-type";

// 代理节点信息接口
interface ProxyOption {
  name: string;
}

// 排序类型: 默认 | 按延迟 | 按字母
export type ProxySortType = 0 | 1 | 2;

function convertDelayColor(delayValue: number) {
  const colorStr = delayManager.formatDelayColor(delayValue);
  if (!colorStr) return "default";

  const mainColor = colorStr.split(".")[0];

  switch (mainColor) {
    case "success":
      return "bg-green-500";
    case "warning":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    case "primary":
      return "bg-primary";
    default:
      return "bg-gray-500";
  }
}

function getSignalIcon(delay: number) {
  if (delay < 0)
    return {
      icon: <Signal className="text-muted-foreground" size={16} />,
      text: "未测试",
      color: "text-muted-foreground",
    };
  if (delay >= 10000)
    return {
      icon: <WifiOff className="text-destructive" size={16} />,
      text: "超时",
      color: "text-destructive",
    };
  if (delay >= 500)
    return {
      icon: <SignalLow className="text-destructive" size={16} />,
      text: "延迟较高",
      color: "text-destructive",
    };
  if (delay >= 300)
    return {
      icon: <SignalMedium className="text-yellow-500" size={16} />,
      text: "延迟中等",
      color: "text-yellow-500",
    };
  if (delay >= 200)
    return {
      icon: <SignalHigh className="text-blue-500" size={16} />,
      text: "延迟良好",
      color: "text-blue-500",
    };
  return {
    icon: <SignalHigh className="text-green-500" size={16} />,
    text: "延迟极佳",
    color: "text-green-500",
  };
}

// 简单的防抖函数
function debounce(fn: Function, ms = 100) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

export const CurrentProxyCard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { verge } = useVerge();
  const { proxies, clashConfig, refreshProxy } = useAppStatic();
  const { connections } = useAppRealtime();

  // 判断模式
  const mode = clashConfig?.mode?.toLowerCase() || "rule";
  const isGlobalMode = mode === "global";
  const isDirectMode = mode === "direct";

  // 添加排序类型状态
  const [sortType, setSortType] = useState<ProxySortType>(() => {
    const savedSortType = localStorage.getItem(STORAGE_KEY_SORT_TYPE);
    return savedSortType ? (Number(savedSortType) as ProxySortType) : 0;
  });

  // 定义状态类型
  type ProxyState = {
    proxyData: {
      groups: { name: string; now: string; all: string[] }[];
      records: Record<string, any>;
      globalProxy: string;
      directProxy: any;
    };
    selection: {
      group: string;
      proxy: string;
    };
    displayProxy: any;
  };

  const [state, setState] = useState<ProxyState>({
    proxyData: {
      groups: [],
      records: {},
      globalProxy: "",
      directProxy: { name: "DIRECT" }, // 默认值避免 undefined
    },
    selection: {
      group: "",
      proxy: "",
    },
    displayProxy: null,
  });

  // 初始化选择的组
  useEffect(() => {
    if (!proxies) return;

    const getPrimaryGroupName = () => {
      if (!proxies?.groups?.length) return "";

      const primaryKeywords = [
        "auto",
        "select",
        "proxy",
        "节点选择",
        "自动选择",
      ];
      const primaryGroup =
        proxies.groups.find((group: { name: string }) =>
          primaryKeywords.some((keyword) =>
            group.name.toLowerCase().includes(keyword),
          ),
        ) ||
        proxies.groups.find((g: { name: string }) => g.name !== "GLOBAL");

      return primaryGroup?.name || "";
    };

    const primaryGroupName = getPrimaryGroupName();

    // 根据模式确定初始组
    if (isGlobalMode) {
      setState((prev) => ({
        ...prev,
        selection: {
          ...prev.selection,
          group: "GLOBAL",
        },
      }));
    } else if (isDirectMode) {
      setState((prev) => ({
        ...prev,
        selection: {
          ...prev.selection,
          group: "DIRECT",
        },
      }));
    } else {
      const savedGroup = localStorage.getItem(STORAGE_KEY_GROUP);
      setState((prev) => ({
        ...prev,
        selection: {
          ...prev.selection,
          group: savedGroup || primaryGroupName || "",
        },
      }));
    }
  }, [isGlobalMode, isDirectMode, proxies]);

  // 监听代理数据变化，更新状态
  useEffect(() => {
    if (!proxies) return;

    setState((prev) => {
      // 1. 更新 proxyData
      const newProxyData = {
        groups: proxies.groups || [],
        records: proxies.proxies || {},
        globalProxy: proxies.global || "",
        directProxy: { name: "DIRECT" },
      };

      // 2. 验证当前选择的组是否仍然存在
      let currentGroup = prev.selection.group;
      const groupExists = newProxyData.groups.some(
        (g: { name: string }) => g.name === currentGroup,
      );

      // 如果当前组不存在，或者是 GLOBAL/DIRECT 模式切换，需要重新确定组
      if (!groupExists && !isGlobalMode && !isDirectMode) {
        // 尝试恢复之前保存的组
        const savedGroup = localStorage.getItem(STORAGE_KEY_GROUP);
        if (
          savedGroup &&
          newProxyData.groups.some((g: { name: string }) => g.name === savedGroup)
        ) {
          currentGroup = savedGroup;
        } else {
          // 如果保存的组也不存在，使用默认策略
          const primaryKeywords = [
            "auto",
            "select",
            "proxy",
            "节点选择",
            "自动选择",
          ];
          const primaryGroup =
            newProxyData.groups.find((group: { name: string }) =>
              primaryKeywords.some((keyword) =>
                group.name.toLowerCase().includes(keyword.toLowerCase()),
              ),
            ) ||
            newProxyData.groups.find((g: { name: string }) => g.name !== "GLOBAL");
          currentGroup = primaryGroup?.name || "";
        }
      }

      // 3. 获取当前组的选定代理
      let currentProxyName = "";
      if (isGlobalMode) {
        currentGroup = "GLOBAL";
        currentProxyName = newProxyData.globalProxy;
      } else if (isDirectMode) {
        currentGroup = "DIRECT";
        currentProxyName = "DIRECT";
      } else {
        const groupData = newProxyData.groups.find(
          (g: { name: string }) => g.name === currentGroup,
        );
        currentProxyName = groupData?.now || "";
      }

      // 4. 获取显示用的代理对象
      let displayProxyObj = newProxyData.records[currentProxyName];

      // 特殊情况处理
      if (currentProxyName === "DIRECT") {
        displayProxyObj = { name: "DIRECT", type: "Direct" };
      } else if (currentProxyName === "REJECT") {
        displayProxyObj = { name: "REJECT", type: "Reject" };
      }

      // 如果是 GLOBAL 组，它本身也是一个 selector，但我们需要显示它选中的那个节点
      // 如果当前组是 selector 类型，now 指向的是选中的节点名
      // 我们需要显示的是那个被选中节点的详细信息
      // 上面的 logic 已经处理了大部分情况，但在 GLOBAL 模式下，globalProxy 是选中的节点名

      return {
        proxyData: newProxyData,
        selection: {
          group: currentGroup,
          proxy: currentProxyName,
        },
        displayProxy: displayProxyObj,
      };
    });
  }, [proxies, isGlobalMode, isDirectMode]);

  // 处理组切换
  const handleChangeGroup = (groupName: string) => {
    setState((prev) => ({
      ...prev,
      selection: {
        ...prev.selection,
        group: groupName,
      },
    }));
    localStorage.setItem(STORAGE_KEY_GROUP, groupName);
  };

  // 处理代理切换
  const handleChangeProxy = async (proxyName: string) => {
    const { group } = state.selection;
    if (!group) return;

    try {
      // 乐观更新 UI
      setState((prev) => {
        const newDisplayProxy = prev.proxyData.records[proxyName] || {
          name: proxyName,
        };
        return {
          ...prev,
          selection: { ...prev.selection, proxy: proxyName },
          displayProxy: newDisplayProxy,
        };
      });

      // 发送请求
      await updateProxy(group, proxyName);
      localStorage.setItem(STORAGE_KEY_PROXY, proxyName);

      // 如果开启了自动断开连接
      if (verge?.auto_close_connection) {
        // 使用防抖或延迟来避免频繁断开
        debounceCloseConnections();
      }

      // 刷新数据
      refreshProxy();
    } catch (err) {
      console.error("Failed to update proxy", err);
      // 发生错误时刷新数据以恢复正确状态
      refreshProxy();
    }
  };

  // 防抖断开连接
  const debounceCloseConnections = useCallback(
    debounce(() => {
      closeAllConnections();
    }, 500),
    [],
  );

  // 关闭所有连接
  const closeAllConnections = async () => {
    try {
      // 获取当前活跃连接
      // 注意：这里我们应该使用最新的连接数据，但 connections 可能是旧的
      // 最好是调用 API 获取最新连接，或者直接关闭所有
      // 这里的实现是遍历当前已知的连接并关闭
      if (connections && connections.data && connections.data.length > 0) {
        // 并行关闭所有连接
        await Promise.all(
          (connections.data as any[]).map((conn: any) => deleteConnection(conn.id)),
        );
      }
    } catch (err) {
      console.error("Failed to close connections", err);
    }
  };

  // 排序处理
  const toggleSortType = () => {
    setSortType((prev) => {
      const next = ((prev + 1) % 3) as ProxySortType;
      localStorage.setItem(STORAGE_KEY_SORT_TYPE, String(next));
      return next;
    });
  };

  // 获取排序后的代理列表
  const sortedProxies = useMemo(() => {
    const { group } = state.selection;
    if (!group) return [];

    const groupData = state.proxyData.groups.find((g) => g.name === group);
    if (!groupData || !groupData.all) return [];

    let list = groupData.all.map((name) => {
      const item = state.proxyData.records[name];
      // 确保有 delay 字段，如果没有则默认为 0 (或 -1 表示未测试)
      const history = item?.history || [];
      const delay =
        history.length > 0 ? history[history.length - 1].delay : -1;
      return {
        name,
        delay,
        type: item?.type || "Unknown",
      };
    });

    // 0: 默认 (配置文件顺序) - 不做额外排序，直接返回
    if (sortType === 0) return list;

    // 1: 按延迟
    if (sortType === 1) {
      return [...list].sort((a, b) => {
        // 未测试的排在后面
        if (a.delay <= 0) return 1;
        if (b.delay <= 0) return -1;
        return a.delay - b.delay;
      });
    }

    // 2: 按字母
    if (sortType === 2) {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [state.selection.group, state.proxyData, sortType]);

  // 准备显示数据
  const displayData = useMemo(() => {
    const { displayProxy } = state;

    if (!displayProxy)
      return {
        name: "Loading...",
        type: "Unknown",
        delay: -1,
        color: "bg-gray-500",
      };

    const history = displayProxy.history || [];
    const delay =
      history.length > 0 ? history[history.length - 1].delay : -1;
    const color = convertDelayColor(delay);

    return {
      name: displayProxy.name,
      type: displayProxy.type,
      delay,
      color,
    };
  }, [state.displayProxy]);

  const signalInfo = getSignalIcon(displayData.delay);

  return (
    <EnhancedCard
      icon={<SignalHigh className="w-5 h-5 text-primary" />}
      title={t("Current Proxy")}
      className="h-full"
    >
      <div className="flex flex-col gap-3">
        {/* 代理组选择 */}
        {!isGlobalMode && !isDirectMode && (
          <div className="flex items-center justify-between gap-2">
            <Select
              value={state.selection.group}
              onValueChange={handleChangeGroup}
              disabled={state.proxyData.groups.length === 0}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder={t("Select Group")} />
              </SelectTrigger>
              <SelectContent>
                {state.proxyData.groups.map((group) => (
                  <SelectItem key={group.name} value={group.name}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 代理节点选择 */}
        {!isGlobalMode && !isDirectMode && (
          <div className="flex items-center gap-2">
            <Select
              value={state.selection.proxy}
              onValueChange={handleChangeProxy}
              disabled={!state.selection.group}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder={t("Select Proxy")} />
              </SelectTrigger>
              <SelectContent>
                {sortedProxies.map((proxy) => {
                  const proxyDelay = proxy.delay;
                  let delayColorClass = "text-muted-foreground";
                  if (proxyDelay > 0) {
                    if (proxyDelay < 200) delayColorClass = "text-green-500";
                    else if (proxyDelay < 500)
                      delayColorClass = "text-yellow-500";
                    else delayColorClass = "text-red-500";
                  }

                  return (
                    <SelectItem key={proxy.name} value={proxy.name}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="truncate max-w-[120px]">
                          {proxy.name}
                        </span>
                        <span className={cn("text-xs", delayColorClass)}>
                          {proxyDelay > 0 ? `${proxyDelay}ms` : "-"}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={toggleSortType}
                  >
                    {sortType === 0 && <ArrowUpDown size={16} />}
                    {sortType === 1 && <Clock size={16} />}
                    {sortType === 2 && <ArrowDownAZ size={16} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {sortType === 0 && t("Default Sort")}
                    {sortType === 1 && t("Sort by Delay")}
                    {sortType === 2 && t("Sort by Name")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* 详细信息展示 */}
        <div className="flex items-center gap-3 p-3 mt-1 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {displayData.name}
              </span>
              <Badge variant="secondary" className="text-[10px] h-5 px-1">
                {displayData.type}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {signalInfo.icon}
              <span>
                {displayData.delay > 0 ? `${displayData.delay}ms` : "N/A"}
              </span>
              <span className="mx-1">•</span>
              <span>{signalInfo.text}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => navigate("/proxies")}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </EnhancedCard>
  );
};
