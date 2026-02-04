import { useTranslation } from "react-i18next";
import {
  Info,
  Settings,
  TriangleAlert,
  ShieldCheck,
  Server,
  Puzzle,
} from "lucide-react";
import { useVerge } from "@/hooks/use-verge";
import { EnhancedCard } from "./enhanced-card";
import useSWR from "swr";
import { getSystemInfo } from "@/services/cmds";
import { useNavigate } from "react-router-dom";
import { version as appVersion } from "@root/package.json";
import { useCallback, useEffect, useMemo, useState } from "react";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import { useLockFn } from "ahooks";
import { showNotice } from "@/services/noticeService";
import { useSystemState } from "@/hooks/use-system-state";
import { useServiceInstaller } from "@/hooks/useServiceInstaller";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const SystemInfoCard = () => {
  const { t } = useTranslation();
  const { verge, patchVerge } = useVerge();
  const navigate = useNavigate();
  const { isAdminMode, isSidecarMode, mutateRunningMode } = useSystemState();
  const { installServiceAndRestartCore } = useServiceInstaller();

  // 系统信息状态
  const [systemState, setSystemState] = useState({
    osInfo: "",
    lastCheckUpdate: "-",
  });

  // 初始化系统信息
  useEffect(() => {
    getSystemInfo()
      .then((info) => {
        const lines = info.split("\n");
        if (lines.length > 0) {
          const sysName = lines[0].split(": ")[1] || "";
          let sysVersion = lines[1].split(": ")[1] || "";

          if (
            sysName &&
            sysVersion.toLowerCase().startsWith(sysName.toLowerCase())
          ) {
            sysVersion = sysVersion.substring(sysName.length).trim();
          }

          setSystemState((prev) => ({
            ...prev,
            osInfo: `${sysName} ${sysVersion}`,
          }));
        }
      })
      .catch(console.error);

    // 获取最后检查更新时间
    const lastCheck = localStorage.getItem("last_check_update");
    if (lastCheck) {
      try {
        const timestamp = parseInt(lastCheck, 10);
        if (!isNaN(timestamp)) {
          setSystemState((prev) => ({
            ...prev,
            lastCheckUpdate: new Date(timestamp).toLocaleString(),
          }));
        }
      } catch (e) {
        console.error("Error parsing last check update time", e);
      }
    } else if (verge?.auto_check_update) {
      // 如果启用了自动检查更新但没有记录，设置当前时间并延迟检查
      const now = Date.now();
      localStorage.setItem("last_check_update", now.toString());
      setSystemState((prev) => ({
        ...prev,
        lastCheckUpdate: new Date(now).toLocaleString(),
      }));

      setTimeout(() => {
        if (verge?.auto_check_update) {
          checkUpdate().catch(console.error);
        }
      }, 5000);
    }
  }, [verge?.auto_check_update]);

  // 自动检查更新逻辑
  useSWR(
    verge?.auto_check_update ? "checkUpdate" : null,
    async () => {
      const now = Date.now();
      localStorage.setItem("last_check_update", now.toString());
      setSystemState((prev) => ({
        ...prev,
        lastCheckUpdate: new Date(now).toLocaleString(),
      }));
      return await checkUpdate();
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 24 * 60 * 60 * 1000, // 每天检查一次
      dedupingInterval: 60 * 60 * 1000, // 1小时内不重复检查
    },
  );

  // 导航到设置页面
  const goToSettings = useCallback(() => {
    navigate("/settings");
  }, [navigate]);

  // 切换自启动状态
  const toggleAutoLaunch = useCallback(async () => {
    if (!verge) return;
    try {
      await patchVerge({ enable_auto_launch: !verge.enable_auto_launch });
    } catch (err) {
      console.error("切换开机自启动状态失败:", err);
    }
  }, [verge, patchVerge]);

  // 点击运行模式处理,Sidecar或纯管理员模式允许安装服务
  const handleRunningModeClick = useCallback(() => {
    if (isSidecarMode || (isAdminMode && isSidecarMode)) {
      installServiceAndRestartCore();
    }
  }, [isSidecarMode, isAdminMode, installServiceAndRestartCore]);

  // 检查更新
  const onCheckUpdate = useLockFn(async () => {
    try {
      const info = await checkUpdate();
      if (!info?.available) {
        showNotice("success", t("Currently on the Latest Version"));
      } else {
        showNotice("info", t("Update Available"), 2000);
        goToSettings();
      }
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  // 是否启用自启动
  const autoLaunchEnabled = useMemo(
    () => verge?.enable_auto_launch || false,
    [verge],
  );

  // 获取模式图标和文本
  const getModeIcon = () => {
    if (isAdminMode) {
      // 判断是否为组合模式（管理员+服务）
      if (!isSidecarMode) {
        return (
          <div className="flex items-center">
            <ShieldCheck className="text-primary h-4 w-4" />
            <Server className="text-green-500 h-4 w-4 ml-0.5" />
          </div>
        );
      }
      return <ShieldCheck className="text-primary h-4 w-4" />;
    } else if (isSidecarMode) {
      return <Puzzle className="text-sky-500 h-4 w-4" />;
    } else {
      return <Server className="text-green-500 h-4 w-4" />;
    }
  };

  // 获取模式文本
  const getModeText = () => {
    if (isAdminMode) {
      // 判断是否同时处于服务模式
      if (!isSidecarMode) {
        return t("Administrator + Service Mode");
      }
      return t("Administrator Mode");
    } else if (isSidecarMode) {
      return t("Sidecar Mode");
    } else {
      return t("Service Mode");
    }
  };

  // 只有当verge存在时才渲染内容
  if (!verge) return null;

  return (
    <EnhancedCard
      title={t("System Info")}
      icon={<Info />}
      iconColor="error"
      action={
        <Button
          variant="ghost"
          size="icon"
          onClick={goToSettings}
          title={t("Settings")}
          className="h-8 w-8"
        >
          <Settings className="h-4 w-4" />
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">{t("OS Info")}</span>
          <span className="text-sm font-medium">{systemState.osInfo}</span>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {t("Auto Launch")}
          </span>
          <div className="flex items-center gap-2">
            {isAdminMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <TriangleAlert className="text-orange-500 h-5 w-5" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("Administrator mode may not support auto launch")}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Badge
              variant={autoLaunchEnabled ? "default" : "outline"}
              className={`cursor-pointer ${autoLaunchEnabled ? "bg-green-500 hover:bg-green-600" : ""}`}
              onClick={toggleAutoLaunch}
            >
              {autoLaunchEnabled ? t("Enabled") : t("Disabled")}
            </Badge>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {t("Running Mode")}
          </span>
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isSidecarMode || (isAdminMode && isSidecarMode)
                ? "cursor-pointer underline hover:opacity-70"
                : "cursor-default"
            }`}
            onClick={handleRunningModeClick}
          >
            {getModeIcon()}
            {getModeText()}
          </div>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">
            {t("Last Check Update")}
          </span>
          <span
            className="text-sm font-medium cursor-pointer underline hover:opacity-70"
            onClick={onCheckUpdate}
          >
            {systemState.lastCheckUpdate}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">
            {t("Verge Version")}
          </span>
          <span className="text-sm font-medium">v{appVersion}</span>
        </div>
      </div>
    </EnhancedCard>
  );
};
