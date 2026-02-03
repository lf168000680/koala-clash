import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { cn } from "@root/lib/utils";
import { ChevronRight, Globe, Zap } from "lucide-react";

import { useAppData } from "@/providers/app-data-provider";
import { ProxySelectorModal } from "./proxy-selector-modal";
import delayManager from "@/services/delay";

interface IProxyGroup {
  name: string;
  type: string;
  now: string;
  hidden: boolean;
  all: (string | { name: string })[];
  icon?: string;
}

function getDelayColor(delay: number): string {
  if (delay === -2) return "text-blue-500";
  if (delay < 0 || delay >= 10000) return "text-muted-foreground";
  if (delay < 150) return "text-green-500";
  if (delay < 300) return "text-yellow-500";
  return "text-red-500";
}

function getDelayDotColor(delay: number): string {
  if (delay === -2) return "bg-blue-500";
  if (delay < 0 || delay >= 10000) return "bg-muted-foreground";
  if (delay < 150) return "bg-green-500";
  if (delay < 300) return "bg-yellow-500";
  return "bg-red-500";
}

export const ProxyBadge: React.FC = () => {
  const { t } = useTranslation();
  const { proxies, clashConfig } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [currentDelay, setCurrentDelay] = useState(-1);

  const mode = clashConfig?.mode?.toLowerCase() || "rule";
  const isGlobalMode = mode === "global";
  const isDirectMode = mode === "direct";

  const primaryGroup = useMemo(() => {
    if (!proxies?.groups) return null;
    const allowedTypes = ["Selector", "URLTest", "Fallback"];
    return proxies.groups.find(
      (g: IProxyGroup) => allowedTypes.includes(g.type) && !g.hidden,
    );
  }, [proxies]);

  const currentProxyName = useMemo(() => {
    if (isDirectMode) return "DIRECT";
    if (isGlobalMode && proxies?.global) return proxies.global.now || "—";
    return primaryGroup?.now || "—";
  }, [isDirectMode, isGlobalMode, proxies, primaryGroup]);

  const groupName = useMemo(() => {
    if (isDirectMode) return "DIRECT";
    if (isGlobalMode) return "GLOBAL";
    return primaryGroup?.name || "";
  }, [isDirectMode, isGlobalMode, primaryGroup]);

  useEffect(() => {
    if (!currentProxyName || currentProxyName === "—" || !groupName) return;

    const updateDelay = () => {
      const delay = delayManager.getDelay(currentProxyName, groupName);
      setCurrentDelay(delay);
    };

    updateDelay();

    const listener = (newDelay: number) => {
      setCurrentDelay(newDelay);
    };

    delayManager.setListener(currentProxyName, groupName, listener);
    return () => {
      delayManager.removeListener(currentProxyName, groupName);
    };
  }, [currentProxyName, groupName, modalOpen]);

  const delayText = useMemo(() => {
    if (isDirectMode) return "";
    if (currentDelay === -2) return "...";
    if (currentDelay < 0) return "";
    if (currentDelay >= 10000) return "timeout";
    return `${currentDelay}ms`;
  }, [currentDelay, isDirectMode]);

  return (
    <>
      <motion.button
        onClick={() => setModalOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-80 py-3 pl-3 pr-2 rounded-xl transition-all",
          "backdrop-blur-md bg-white/60 border border-gray-200/60",
          "dark:bg-white/10 dark:border-white/20",
          "hover:bg-white/80 dark:hover:bg-white/15",
          "hover:shadow-lg hover:shadow-black/5",
          "active:shadow-md",
          "flex items-center gap-3 group cursor-pointer",
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            "bg-gradient-to-br from-primary/20 to-primary/10",
            "group-hover:from-primary/30 group-hover:to-primary/15 transition-colors",
          )}
        >
          {isDirectMode ? (
            <Globe className="w-5 h-5 text-primary" />
          ) : (
            <Zap className="w-5 h-5 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {currentProxyName}
            </span>
          </div>
          {!isDirectMode && currentDelay > 0 && currentDelay < 10000 && (
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  getDelayDotColor(currentDelay),
                )}
              />
              <span
                className={cn("text-xs font-mono", getDelayColor(currentDelay))}
              >
                {delayText}
              </span>
            </div>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      </motion.button>

      <ProxySelectorModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
};

export default ProxyBadge;
