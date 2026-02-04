import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { closeAllConnections } from "@/services/api";
import { patchClashMode } from "@/services/cmds";
import { useVerge } from "@/hooks/use-verge";
import { Globe, Workflow, MoveUpRight } from "lucide-react";
import { useMemo } from "react";
import { useAppStatic } from "@/providers/app-data-provider";
import { cn } from "@root/lib/utils";
import { Button } from "@/components/ui/button";

export const ClashModeCard = () => {
  const { t } = useTranslation();
  const { verge } = useVerge();
  const { clashConfig, refreshClashConfig } = useAppStatic();

  // 支持的模式列表
  const modeList = useMemo(() => ["rule", "global", "direct"] as const, []);

  // 直接使用API返回的模式，不维护本地状态
  const currentMode = clashConfig?.mode?.toLowerCase();

  const modeDescription = useMemo(() => {
    if (typeof currentMode === "string" && currentMode.length > 0) {
      return t(
        `${currentMode[0].toLocaleUpperCase()}${currentMode.slice(1)} Mode Description`,
      );
    }
    return t("Mode Description Not Available");
  }, [currentMode, t]);

  // 模式图标映射
  const modeIcons = useMemo(
    () => ({
      rule: <Workflow size={18} />,
      global: <Globe size={18} />,
      direct: <MoveUpRight size={18} />,
    }),
    [],
  );

  // 切换模式的处理函数
  const onChangeMode = useLockFn(async (mode: string) => {
    if (mode === currentMode) return;
    if (verge?.auto_close_connection) {
      closeAllConnections();
    }

    try {
      await patchClashMode(mode);
      // 使用共享的刷新方法
      refreshClashConfig();
    } catch (error) {
      console.error("Failed to change mode:", error);
    }
  });

  return (
    <div className="flex flex-col w-full">
      {/* 模式选择按钮组 */}
      <div className="flex justify-center py-1 relative z-10 gap-2">
        {modeList.map((mode) => (
          <Button
            key={mode}
            variant={mode === currentMode ? "default" : "outline"}
            onClick={() => onChangeMode(mode)}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 capitalize transition-all",
              mode === currentMode &&
              "relative after:content-[''] after:absolute after:-bottom-4 after:left-1/2 after:w-0.5 after:h-4 after:bg-primary after:-translate-x-1/2",
            )}
          >
            {modeIcons[mode]}
            {t(mode)}
          </Button>
        ))}
      </div>

      {/* 说明文本区域 */}
      <div className="w-full my-2 relative flex justify-center overflow-visible">
        <div className="w-[95%] text-center text-muted-foreground p-2 rounded-md border border-primary bg-background break-words hyphens-auto text-xs">
          {modeDescription}
        </div>
      </div>
    </div>
  );
};
