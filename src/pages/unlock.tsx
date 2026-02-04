import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { BasePage, BaseEmpty } from "@/components/base";
import { useLockFn } from "ahooks";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
  RefreshCw,
  RefreshCcw,
} from "lucide-react";
import { showNotice } from "@/services/noticeService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@root/lib/utils";

// 定义流媒体检测项类型
interface UnlockItem {
  name: string;
  status: string;
  region?: string | null;
  check_time?: string | null;
}

// 用于存储测试结果的本地存储键名
const UNLOCK_RESULTS_STORAGE_KEY = "clash_verge_unlock_results";
const UNLOCK_RESULTS_TIME_KEY = "clash_verge_unlock_time";

const UnlockPage = () => {
  const { t } = useTranslation();

  // 保存所有流媒体检测项的状态
  const [unlockItems, setUnlockItems] = useState<UnlockItem[]>([]);
  // 是否正在执行全部检测
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  // 记录正在检测中的项目
  const [loadingItems, setLoadingItems] = useState<string[]>([]);
  // 最后检测时间
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  // 按首字母排序项目
  const sortItemsByName = (items: UnlockItem[]) => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  };

  // 保存测试结果到本地存储
  const saveResultsToStorage = (items: UnlockItem[], time: string | null) => {
    try {
      localStorage.setItem(UNLOCK_RESULTS_STORAGE_KEY, JSON.stringify(items));
      if (time) {
        localStorage.setItem(UNLOCK_RESULTS_TIME_KEY, time);
      }
    } catch (err) {
      console.error("Failed to save results to storage:", err);
    }
  };

  // 从本地存储加载测试结果
  const loadResultsFromStorage = (): {
    items: UnlockItem[] | null;
    time: string | null;
  } => {
    try {
      const itemsJson = localStorage.getItem(UNLOCK_RESULTS_STORAGE_KEY);
      const time = localStorage.getItem(UNLOCK_RESULTS_TIME_KEY);

      if (itemsJson) {
        return {
          items: JSON.parse(itemsJson) as UnlockItem[],
          time,
        };
      }
    } catch (err) {
      console.error("Failed to load results from storage:", err);
    }

    return { items: null, time: null };
  };

  // 页面加载时获取初始检测项列表
  useEffect(() => {
    // 尝试从本地存储加载上次测试结果
    const { items: storedItems, time } = loadResultsFromStorage();

    if (storedItems && storedItems.length > 0) {
      // 如果有存储的结果，优先使用
      setUnlockItems(storedItems);
      setLastCheckTime(time);

      // 后台同时获取最新的初始状态（但不更新UI）
      getUnlockItems(false);
    } else {
      // 没有存储的结果，获取初始状态
      getUnlockItems(true);
    }
  }, []);

  // 获取所有解锁检测项列表
  const getUnlockItems = async (updateUI: boolean = true) => {
    try {
      const items = await invoke<UnlockItem[]>("get_unlock_items");
      const sortedItems = sortItemsByName(items);

      if (updateUI) {
        setUnlockItems(sortedItems);
      }
    } catch (err: any) {
      console.error("Failed to get unlock items:", err);
    }
  };

  // invoke加超时，防止后端卡死
  const invokeWithTimeout = async <T,>(
    cmd: string,
    args?: any,
    timeout = 15000,
  ): Promise<T> => {
    return Promise.race([
      invoke<T>(cmd, args),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout),
      ),
    ]);
  };

  // 执行全部项目检测
  const checkAllMedia = useLockFn(async () => {
    try {
      setIsCheckingAll(true);
      const result =
        await invokeWithTimeout<UnlockItem[]>("check_media_unlock");
      const sortedItems = sortItemsByName(result);

      setUnlockItems(sortedItems);
      const currentTime = new Date().toLocaleString();
      setLastCheckTime(currentTime);

      saveResultsToStorage(sortedItems, currentTime);

      setIsCheckingAll(false);
    } catch (err: any) {
      setIsCheckingAll(false);
      showNotice("error", err?.message || err?.toString() || "检测超时或失败");
      // alert("检测超时或失败: " + (err?.message || err));
      console.error("Failed to check media unlock:", err);
    }
  });

  // 检测单个流媒体服务
  const checkSingleMedia = useLockFn(async (name: string) => {
    try {
      setLoadingItems((prev) => [...prev, name]);
      const result =
        await invokeWithTimeout<UnlockItem[]>("check_media_unlock");

      const targetItem = result.find((item: UnlockItem) => item.name === name);

      if (targetItem) {
        const updatedItems = sortItemsByName(
          unlockItems.map((item: UnlockItem) =>
            item.name === name ? targetItem : item,
          ),
        );

        setUnlockItems(updatedItems);
        const currentTime = new Date().toLocaleString();
        setLastCheckTime(currentTime);

        saveResultsToStorage(updatedItems, currentTime);
      }

      setLoadingItems((prev) => prev.filter((item) => item !== name));
    } catch (err: any) {
      setLoadingItems((prev) => prev.filter((item) => item !== name));
      showNotice("error", err?.message || err?.toString() || `检测${name}失败`);
      // alert("检测超时或失败: " + (err?.message || err));
      console.error(`Failed to check ${name}:`, err);
    }
  });

  // 获取状态对应的图标
  const getStatusIcon = (status: string) => {
    if (status === "Pending") return <RefreshCw className="h-3.5 w-3.5" />;
    if (status === "Yes") return <CheckCircle className="h-3.5 w-3.5" />;
    if (status === "No") return <XCircle className="h-3.5 w-3.5" />;
    if (status === "Soon") return <Clock className="h-3.5 w-3.5" />;
    return <HelpCircle className="h-3.5 w-3.5" />;
  };

  // 获取状态对应的样式
  const getStatusClass = (status: string) => {
    if (status === "Yes") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
    if (status === "No") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    if (status === "Soon") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    if (status === "Completed") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (status.includes("Failed")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    
    if (
      status === "Disallowed ISP" ||
      status === "Blocked" ||
      status === "Unsupported Country/Region"
    ) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    }
    
    return "bg-secondary text-secondary-foreground border-transparent";
  };

  // 获取边框颜色类
  const getBorderColorClass = (status: string) => {
    if (status === "Yes") return "border-l-green-500";
    if (status === "No") return "border-l-red-500";
    if (status === "Soon") return "border-l-yellow-500";
    if (status.includes("Failed")) return "border-l-red-500";
    if (status === "Completed") return "border-l-blue-500";
    return "border-l-border";
  };

  return (
    <BasePage
      title={t("Unlock Test")}
      header={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={isCheckingAll}
            onClick={checkAllMedia}
          >
            {isCheckingAll ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {isCheckingAll ? t("Testing...") : t("Test All")}
          </Button>
        </div>
      }
    >
      {unlockItems.length === 0 ? (
        <div className="flex h-1/2 justify-center items-center">
          <BaseEmpty text={t("No unlock test items")} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-1">
          {unlockItems.map((item) => (
            <Card
              key={item.name}
              className={cn(
                "overflow-hidden border-l-4 transition-colors hover:bg-muted/50",
                getBorderColorClass(item.status)
              )}
            >
              <CardContent className="p-3 flex flex-col h-full gap-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-base truncate pr-2">
                    {item.name}
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full shrink-0"
                          disabled={loadingItems.includes(item.name) || isCheckingAll}
                          onClick={() => checkSingleMedia(item.name)}
                        >
                          {loadingItems.includes(item.name) ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("Test")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn("gap-1 px-2 py-0.5", getStatusClass(item.status))}
                  >
                    {getStatusIcon(item.status)}
                    <span className={cn(
                      item.status === "Pending" ? "font-normal" : "font-bold"
                    )}>
                      {t(item.status)}
                    </span>
                  </Badge>

                  {item.region && (
                    <Badge variant="secondary" className="px-2 py-0.5">
                      {item.region}
                    </Badge>
                  )}
                </div>

                <Separator className="my-1 border-dashed" />

                <div className="text-right">
                  <span className="text-xs text-muted-foreground">
                    {item.check_time || "-- --"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </BasePage>
  );
};

export default UnlockPage;
