import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useClash } from "@/hooks/use-clash";
import { EnhancedCard } from "./enhanced-card";
import { useMemo } from "react";
import { useAppStatic, useAppRealtime } from "@/providers/app-data-provider";

// 将毫秒转换为时:分:秒格式的函数
const formatUptime = (uptimeMs: number) => {
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  const seconds = Math.floor((uptimeMs % 60000) / 1000);
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const ClashInfoCard = () => {
  const { t } = useTranslation();
  const { version: clashVersion } = useClash();
  const { clashConfig, rules, systemProxyAddress } = useAppStatic();
  const { uptime } = useAppRealtime();

  // 使用useMemo缓存格式化后的uptime，避免频繁计算
  const formattedUptime = useMemo(() => formatUptime(uptime), [uptime]);

  // 使用备忘录组件内容，减少重新渲染
  const cardContent = useMemo(() => {
    if (!clashConfig) return null;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t("Core Version")}
          </span>
          <span className="text-sm font-medium">{clashVersion || "-"}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t("System Proxy Address")}
          </span>
          <span className="text-sm font-medium">{systemProxyAddress}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t("Mixed Port")}
          </span>
          <span className="text-sm font-medium">
            {clashConfig["mixed-port"] || "-"}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("Uptime")}</span>
          <span className="text-sm font-medium">{formattedUptime}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t("Rules Count")}
          </span>
          <span className="text-sm font-medium">{rules.length}</span>
        </div>
      </div>
    );
  }, [
    clashConfig,
    clashVersion,
    t,
    formattedUptime,
    rules.length,
    systemProxyAddress,
  ]);

  return (
    <EnhancedCard
      title={t("Clash Info")}
      icon={<Cpu className="w-5 h-5" />}
      iconColor="warning"
      action={null}
    >
      {cardContent}
    </EnhancedCard>
  );
};
