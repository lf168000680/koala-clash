import { useTranslation } from "react-i18next";
import { useState, useMemo, memo, FC, useEffect } from "react";
import ProxyControlSwitches from "@/components/shared/ProxyControlSwitches";
import {
  Monitor,
  Activity,
  HelpCircle,
  LucideIcon,
} from "lucide-react";
import { useVerge } from "@/hooks/use-verge";
import { useSystemState } from "@/hooks/use-system-state";
import { useSystemProxyState } from "@/hooks/use-system-proxy-state";
import { showNotice } from "@/services/noticeService";
import { getRunningMode } from "@/services/cmds";
import { mutate } from "swr";
import { cn } from "@root/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LOCAL_STORAGE_TAB_KEY = "clash-verge-proxy-active-tab";

interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  hasIndicator?: boolean;
}

// Tab组件
const TabButton: FC<TabButtonProps> = memo(
  ({ isActive, onClick, icon: Icon, label, hasIndicator = false }) => (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer px-4 py-2 flex items-center justify-center gap-2 rounded-lg flex-1 max-w-[160px] transition-all duration-200 relative",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-background text-foreground hover:-translate-y-[1px] hover:shadow-sm",
        isActive && "after:content-[''] after:absolute after:-bottom-[9px] after:left-1/2 after:w-0.5 after:h-[9px] after:bg-primary after:-translate-x-1/2"
      )}
    >
      <Icon size={18} />
      <span className={cn("text-sm", isActive ? "font-semibold" : "font-normal")}>
        {label}
      </span>
      {hasIndicator && (
        <div
          className={cn(
            "w-2 h-2 rounded-full absolute top-2 right-2",
            isActive ? "bg-white" : "bg-green-500"
          )}
        />
      )}
    </div>
  ),
);

interface TabDescriptionProps {
  description: string;
  tooltipTitle: string;
}

// 描述文本组件
const TabDescription: FC<TabDescriptionProps> = memo(
  ({ description, tooltipTitle }) => (
    <div className="w-[95%] text-center text-muted-foreground p-2 rounded border border-primary bg-background flex items-center justify-center gap-1 break-words hyphens-auto text-xs animate-in fade-in duration-200">
      {description}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle
              className="w-3.5 h-3.5 opacity-70 flex-shrink-0 cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipTitle}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ),
);

export const ProxyTunCard: FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>(
    () => localStorage.getItem(LOCAL_STORAGE_TAB_KEY) || "system",
  );

  const [localServiceOk, setLocalServiceOk] = useState(false);

  const { verge } = useVerge();
  const { isAdminMode } = useSystemState();
  const { indicator: systemProxyIndicator } = useSystemProxyState();

  const { enable_tun_mode } = verge ?? {};

  const updateLocalStatus = async () => {
    try {
      const runningMode = await getRunningMode();
      const serviceStatus = runningMode === "Service";
      setLocalServiceOk(serviceStatus);
      mutate("isServiceAvailable", serviceStatus, false);
    } catch (error) {
      console.error("更新TUN状态失败:", error);
    }
  };

  useEffect(() => {
    updateLocalStatus();
  }, []);

  const isTunAvailable = localServiceOk || isAdminMode;

  const handleError = (err: Error) => {
    showNotice("error", err.message || err.toString());
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem(LOCAL_STORAGE_TAB_KEY, tab);
    if (tab === "tun") {
      updateLocalStatus();
    }
  };

  const tabDescription = useMemo(() => {
    if (activeTab === "system") {
      return {
        text: systemProxyIndicator
          ? t("System Proxy Enabled")
          : t("System Proxy Disabled"),
        tooltip: t("System Proxy Info"),
      };
    } else {
      return {
        text: !isTunAvailable
          ? t("TUN Mode Service Required")
          : enable_tun_mode
            ? t("TUN Mode Enabled")
            : t("TUN Mode Disabled"),
        tooltip: t("TUN Mode Intercept Info"),
      };
    }
  }, [activeTab, systemProxyIndicator, enable_tun_mode, isTunAvailable, t]);

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-row gap-2 justify-center relative z-20">
        <TabButton
          isActive={activeTab === "system"}
          onClick={() => handleTabChange("system")}
          icon={Monitor}
          label={t("System Proxy")}
          hasIndicator={systemProxyIndicator}
        />
        <TabButton
          isActive={activeTab === "tun"}
          onClick={() => handleTabChange("tun")}
          icon={Activity}
          label={t("Tun Mode")}
          hasIndicator={enable_tun_mode && isTunAvailable}
        />
      </div>

      <div className="w-full my-2 relative flex justify-center overflow-visible">
        <TabDescription
          description={tabDescription.text}
          tooltipTitle={tabDescription.tooltip}
        />
      </div>

      <div className="mt-0 p-2 bg-primary/5 rounded-lg">
        <ProxyControlSwitches
          onError={handleError}
          label={activeTab === "system" ? t("System Proxy") : t("Tun Mode")}
        />
      </div>
    </div>
  );
};
