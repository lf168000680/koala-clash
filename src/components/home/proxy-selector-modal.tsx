import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@root/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Zap,
  Check,
  Loader2,
  Timer,
  SortAsc,
  ListOrdered,
  X,
} from "lucide-react";

import { useVerge } from "@/hooks/use-verge";
import { useAppStatic } from "@/providers/app-data-provider";
import delayManager from "@/services/delay";
import { updateProxy, deleteConnection, getConnections } from "@/services/api";

const presetList = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"];

type ProxySortType = "default" | "delay" | "name";

interface IProxyGroup {
  name: string;
  type: string;
  now: string;
  hidden: boolean;
  all: (string | { name: string })[];
  icon?: string;
}

function getDelayColorClasses(delayValue: number): string {
  if (delayValue < 0) {
    return "text-muted-foreground border-border";
  }
  if (delayValue >= 150) {
    return "text-destructive border-destructive/40";
  }
  return "text-green-600 border-green-500/40 dark:text-green-400 dark:border-green-400/30";
}

const ProxyItem: React.FC<{
  proxyName: string;
  groupName: string;
  isSelected: boolean;
  onClick: () => void;
}> = ({ proxyName, groupName, isSelected, onClick }) => {
  const [delay, setDelay] = useState(() =>
    delayManager.getDelay(proxyName, groupName),
  );

  useEffect(() => {
    const listener = (newDelay: number) => {
      setDelay(newDelay);
    };

    delayManager.setListener(proxyName, groupName, listener);
    return () => {
      delayManager.removeListener(proxyName, groupName);
    };
  }, [proxyName, groupName]);

  const delayText = useMemo(() => {
    if (delay === -2) return "...";
    if (delay < 0) return "—";
    if (delay >= 10000) return "timeout";
    return `${delay}`;
  }, [delay]);

  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "circOut" }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-200 group",
        "border border-transparent",
        "hover:bg-accent/80 active:scale-[0.99]",
        isSelected ? "bg-primary/5 border-primary/20" : "bg-transparent",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
            isSelected
              ? "bg-primary text-primary-foreground shadow-sm scale-110"
              : "bg-muted text-muted-foreground/50 group-hover:bg-muted-foreground/20",
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </div>
        <span
          className={cn(
            "truncate text-sm transition-colors duration-200",
            isSelected ? "font-medium text-primary" : "text-foreground/80",
          )}
        >
          {proxyName}
        </span>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "shrink-0 px-1.5 h-5 min-w-[36px] justify-center text-xs font-mono transition-colors",
          getDelayColorClasses(delay),
          delay === -2 && "animate-pulse",
        )}
      >
        {delayText}
      </Badge>
    </motion.button>
  );
};

const GroupRow: React.FC<{
  group: IProxyGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onProxySelect: (proxyName: string) => void;
  sortType: ProxySortType;
  enableIcon?: boolean;
}> = ({ group, isExpanded, onToggle, onProxySelect, sortType, enableIcon }) => {
  const { t } = useTranslation();
  const headerRef = React.useRef<HTMLButtonElement>(null);

  const [localNow, setLocalNow] = useState(group.now);

  useEffect(() => {
    setLocalNow(group.now);
  }, [group.now]);

  const handleSelect = useCallback(
    (proxyName: string) => {
      if (proxyName === localNow) return;
      setLocalNow(proxyName);
      onProxySelect(proxyName);
    },
    [localNow, onProxySelect],
  );

  useEffect(() => {
    if (isExpanded && headerRef.current) {
      const scrollToHeader = () => {
        const scrollContainer = headerRef.current?.closest(
          ".overflow-y-auto",
        ) as HTMLElement | null;
        if (scrollContainer && headerRef.current) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const headerRect = headerRef.current.getBoundingClientRect();
          const scrollOffset =
            headerRect.top - containerRect.top + scrollContainer.scrollTop;
          scrollContainer.scrollTo({
            top: scrollOffset,
            behavior: "smooth",
          });
        }
      };

      const timer = setTimeout(scrollToHeader, 320);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const proxyList = useMemo(() => {
    const list = group.all
      .map((p) => (typeof p === "string" ? p : p.name))
      .filter(Boolean);

    if (sortType === "name") {
      return [...list].sort((a, b) => a.localeCompare(b));
    }
    if (sortType === "delay") {
      return [...list].sort((a, b) => {
        const delayA = delayManager.getDelay(a, group.name);
        const delayB = delayManager.getDelay(b, group.name);
        if (delayA < 0) return 1;
        if (delayB < 0) return -1;
        return delayA - delayB;
      });
    }
    return list;
  }, [group.all, group.name, sortType]);

  return (
    <div
      className={cn(
        "border-b border-border/40 last:border-b-0 transition-colors duration-300",
        isExpanded ? "bg-accent/5" : "bg-transparent",
      )}
    >
      <button
        ref={headerRef}
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200",
          "hover:bg-accent/40",
          isExpanded && "hover:bg-transparent",
        )}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="text-muted-foreground/70"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.div>

        {enableIcon && group.icon && (
          <div className="w-6 h-6 rounded overflow-hidden shrink-0 bg-muted/20">
            <img
              src={
                group.icon.startsWith("data")
                  ? group.icon
                  : group.icon.startsWith("<svg")
                    ? `data:image/svg+xml;base64,${btoa(group.icon)}`
                    : group.icon
              }
              className="w-full h-full object-cover"
              alt=""
            />
          </div>
        )}

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate text-foreground">
              {group.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground/80">
            <span className="truncate">{localNow || t("No selection")}</span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden bg-muted/30"
          >
            <div className="px-2 pb-2 pt-0 grid gap-1 border-t border-border/40 shadow-inner shadow-black/5">
              <div className="h-2" />
              <AnimatePresence mode="popLayout">
                {proxyList.map((proxyName) => (
                  <ProxyItem
                    key={proxyName}
                    proxyName={proxyName}
                    groupName={group.name}
                    isSelected={localNow === proxyName}
                    onClick={() => handleSelect(proxyName)}
                  />
                ))}
              </AnimatePresence>
              <div className="h-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ProxySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProxySelectorModal: React.FC<ProxySelectorModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const { verge } = useVerge();
  const { proxies, clashConfig, refreshProxy } = useAppStatic();

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [sortType, setSortType] = useState<ProxySortType>("default");
  const [isTestingAll, setIsTestingAll] = useState(false);

  const mode = clashConfig?.mode?.toLowerCase() || "rule";
  const isGlobalMode = mode === "global";
  const isDirectMode = mode === "direct";
  const enableGroupIcon = verge?.enable_group_icon ?? true;

  const lastExpandedRef = useRef<string | null>(null);

  const selectorGroups = useMemo(() => {
    if (!proxies?.groups) return [];
    const allowedTypes = ["Selector", "URLTest", "Fallback"];
    return proxies.groups.filter(
      (g: IProxyGroup) => allowedTypes.includes(g.type) && !g.hidden,
    );
  }, [proxies]);

  useEffect(() => {
    if (open && selectorGroups.length > 0 && !expandedGroup) {
      setExpandedGroup(selectorGroups[0].name);
    }
  }, [open, selectorGroups, expandedGroup]);

  useEffect(() => {
    if (!open) {
      selectorGroups.forEach((group: IProxyGroup) => {
        delayManager.cancelGroup(group.name);
      });
      lastExpandedRef.current = null;
      return;
    }

    if (isDirectMode || !expandedGroup) {
      return;
    }

    if (lastExpandedRef.current && lastExpandedRef.current !== expandedGroup) {
      delayManager.cancelGroup(lastExpandedRef.current);
    }

    lastExpandedRef.current = expandedGroup;
    const timeout = verge?.default_latency_timeout || 5000;
    const group = selectorGroups.find(
      (item: IProxyGroup) => item.name === expandedGroup,
    );
    if (group?.all) {
      const proxyNames = group.all
        .map((p: any) => (typeof p === "string" ? p : p.name))
        .filter((name: string) => name && !presetList.includes(name));
      delayManager.checkListDelay(proxyNames, group.name, timeout);
    }
  }, [open, isDirectMode, expandedGroup, selectorGroups, verge]);

  useEffect(() => {
    if (!open) {
      setExpandedGroup(null);
    }
  }, [open]);

  const handleGroupToggle = useCallback(
    (groupName: string) => {
      const newExpanded = expandedGroup === groupName ? null : groupName;
      setExpandedGroup(newExpanded);
    },
    [expandedGroup],
  );

  const handleProxySelect = useCallback(
    async (groupName: string, proxyName: string) => {
      const group = proxies?.groups?.find(
        (g: IProxyGroup) => g.name === groupName,
      );
      if (!group || group.now === proxyName) return;

      const previousProxy = group.now;

      try {
        await updateProxy(groupName, proxyName);

        if (verge?.auto_close_connection && previousProxy) {
          const connectionsData = await getConnections();
          connectionsData?.connections?.forEach((conn: any) => {
            if (conn.chains.includes(previousProxy)) {
              deleteConnection(conn.id);
            }
          });
        }

        setTimeout(() => refreshProxy(), 300);
      } catch (error) {
        console.error("Failed to update proxy", error);
      }
    },
    [proxies, verge, refreshProxy],
  );

  const handleTestAll = useCallback(async () => {
    if (isTestingAll || !expandedGroup) return;
    setIsTestingAll(true);

    try {
      const timeout = verge?.default_latency_timeout || 5000;
      const group = proxies?.groups?.find(
        (g: IProxyGroup) => g.name === expandedGroup,
      );

      if (group?.all) {
        const proxyNames = group.all
          .map((p: any) => (typeof p === "string" ? p : p.name))
          .filter((name: string) => name && !presetList.includes(name));
        await delayManager.checkListDelay(proxyNames, expandedGroup, timeout);
      }
    } finally {
      setIsTestingAll(false);
    }
  }, [isTestingAll, expandedGroup, verge, proxies]);

  const handleSortChange = useCallback(() => {
    const nextSort: Record<ProxySortType, ProxySortType> = {
      default: "delay",
      delay: "name",
      name: "default",
    };
    setSortType(nextSort[sortType]);
  }, [sortType]);

  const getSortIcon = () => {
    switch (sortType) {
      case "delay":
        return <Timer className="h-3.5 w-3.5" />;
      case "name":
        return <SortAsc className="h-3.5 w-3.5" />;
      default:
        return <ListOrdered className="h-3.5 w-3.5" />;
    }
  };

  const getSortLabel = () => {
    switch (sortType) {
      case "delay":
        return t("By Delay");
      case "name":
        return t("By Name");
      default:
        return t("Default");
    }
  };

  if (isDirectMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Proxy Selection")}</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            <p>{t("Direct mode is active")}</p>
            <p className="text-sm mt-1">{t("All traffic bypasses proxy")}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden outline-none">
        <DialogHeader className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium">
              {t("Proxy Selection")}
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSortChange}
                className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {getSortIcon()}
                <span>{getSortLabel()}</span>
              </Button>
              {expandedGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTestAll}
                  disabled={isTestingAll}
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  {isTestingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  <span>{t("Latency")}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto custom-scrollbar">
          {selectorGroups.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>{t("No proxy groups available")}</p>
            </div>
          ) : (
            <div className="pb-4">
              {selectorGroups.map((group: IProxyGroup) => (
                <GroupRow
                  key={group.name}
                  group={group}
                  isExpanded={expandedGroup === group.name}
                  onToggle={() => handleGroupToggle(group.name)}
                  onProxySelect={(proxyName) =>
                    handleProxySelect(group.name, proxyName)
                  }
                  sortType={sortType}
                  enableIcon={enableGroupIcon}
                />
              ))}
            </div>
          )}
        </div>

        {isGlobalMode && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20">
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-medium">
              {t("Global Mode Active")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProxySelectorModal;
