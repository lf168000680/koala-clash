import React, { useRef, useMemo, useState, useEffect } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProfiles } from "@/hooks/use-profiles";
import {
  ProfileViewer,
  ProfileViewerRef,
} from "@/components/profile/profile-viewer";
import { Button } from "@/components/ui/button";
import { ProxyBadge } from "@/components/home/proxy-badge";
import { PlusCircle, Wrench, ExternalLink } from "lucide-react";
import { useVerge } from "@/hooks/use-verge";
import { useSystemState } from "@/hooks/use-system-state";
import { useServiceInstaller } from "@/hooks/useServiceInstaller";

import { SidebarTrigger } from "@/components/ui/sidebar";

import { PowerButton } from "@/components/home/power-button";

import { cn } from "@root/lib/utils";
import map from "../assets/image/map.svg";
import { motion } from "framer-motion";

function useSmoothBoolean(
  source: boolean,
  delayOffMs: number = 600,
  delayOnMs: number = 0,
): boolean {
  const [value, setValue] = useState<boolean>(source);

  useEffect(() => {
    let timer: number | undefined;

    if (source) {
      if (delayOnMs > 0) {
        timer = window.setTimeout(() => setValue(true), delayOnMs);
      } else {
        setValue(true);
      }
    } else {
      timer = window.setTimeout(() => setValue(false), delayOffMs);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [source, delayOffMs, delayOnMs]);

  return value;
}

const MinimalHomePage: React.FC = () => {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);
  const { profiles, mutateProfiles } = useProfiles();
  const viewerRef = useRef<ProfileViewerRef>(null);

  const profileItems = useMemo(() => {
    const items =
      profiles && Array.isArray(profiles.items) ? profiles.items : [];
    const allowedTypes = ["local", "remote"];
    return items.filter((i: any) => i && allowedTypes.includes(i.type!));
  }, [profiles]);

  const currentProfile = useMemo(() => {
    return profileItems.find((p) => p.uid === profiles?.current);
  }, [profileItems, profiles?.current]);

  const { verge, patchVerge, mutateVerge } = useVerge();

  const { isAdminMode, isServiceMode } = useSystemState();
  const { installServiceAndRestartCore } = useServiceInstaller();
  const isTunAvailable = isServiceMode || isAdminMode;
  const isProxyEnabled =
    !!verge?.enable_system_proxy || !!verge?.enable_tun_mode;

  const uiProxyEnabled = useSmoothBoolean(isProxyEnabled, 600, 0);

  const needsProfile = profileItems.length === 0;
  const needsService =
    !needsProfile &&
    (verge?.primary_action ?? "tun-mode") === "tun-mode" &&
    !isTunAvailable;

  const handleToggleProxy = useLockFn(async () => {
    const turningOn = !isProxyEnabled;
    const primaryAction = verge?.primary_action || "tun-mode";
    setIsToggling(true);

    try {
      if (turningOn) {
        if (primaryAction === "tun-mode") {
          if (!isTunAvailable) {
            toast.error(t("TUN requires Service Mode or Admin Mode"));
            setIsToggling(false);
            return;
          }
          await patchVerge({
            enable_tun_mode: true,
            enable_system_proxy: false,
          });
        } else {
          await patchVerge({
            enable_system_proxy: true,
            enable_tun_mode: false,
          });
        }
        toast.success(t("Proxy enabled"));
      } else {
        await patchVerge({
          enable_tun_mode: false,
          enable_system_proxy: false,
        });
        toast.success(t("Proxy disabled"));
      }
      mutateVerge();
    } catch (error: any) {
      toast.error(t("Failed to toggle proxy"), { description: error.message });
    } finally {
      setIsToggling(false);
    }
  });

  const statusInfo = useMemo(() => {
    if (isToggling) {
      return {
        text: isProxyEnabled ? t("Disconnecting...") : t("Connecting..."),
        className: "text-muted-foreground",
        isAnimating: true,
      };
    }
    if (isProxyEnabled) {
      return {
        text: t("Connected"),
        className: "text-foreground",
        isAnimating: false,
      };
    }
    return {
      text: t("Disconnected"),
      className: "text-muted-foreground",
      isAnimating: false,
    };
  }, [isToggling, isProxyEnabled, t]);

  if (needsProfile) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none z-0 [transform:translateZ(0)]">
          <img
            src={map}
            alt="World map"
            className="w-full h-full object-cover"
          />
        </div>

        <header className="flex-shrink-0 p-4 z-10">
          <SidebarTrigger />
        </header>

        <main className="flex-1 overflow-hidden flex flex-col items-center justify-center z-10 px-4">
          <div
            className={cn(
              "p-8 rounded-2xl text-center max-w-sm",
              "backdrop-blur-sm bg-white/60 border border-gray-200/60",
              "dark:bg-white/5 dark:border-white/10",
            )}
          >
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-lime-500/10 flex items-center justify-center">
                <PlusCircle className="h-8 w-8 text-lime-500" />
              </div>
              <h1 className="text-2xl font-medium mb-2">{t("Get Started")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("Add a profile to start using the VPN")}
              </p>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => viewerRef.current?.create()}
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              {t("Add Profile")}
            </Button>
          </div>
        </main>

        <ProfileViewer ref={viewerRef} onChange={() => mutateProfiles()} />
      </div>
    );
  }

  if (needsService) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none z-0 [transform:translateZ(0)]">
          <img
            src={map}
            alt="World map"
            className="w-full h-full object-cover"
          />
        </div>

        <header className="flex-shrink-0 p-4 z-10">
          <SidebarTrigger />
        </header>

        <main className="flex-1 overflow-hidden flex flex-col items-center justify-center z-10 px-4">
          <div
            className={cn(
              "p-8 rounded-2xl text-center max-w-sm",
              "backdrop-blur-sm bg-white/60 border border-gray-200/60",
              "dark:bg-white/5 dark:border-white/10",
            )}
          >
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Wrench className="h-8 w-8 text-amber-500" />
              </div>
              <h1 className="text-2xl font-medium mb-2">
                {t("Install Service")}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("TUN mode requires the system service to be installed")}
              </p>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={installServiceAndRestartCore}
            >
              <Wrench className="mr-2 h-5 w-5" />
              {t("Install Service")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0 [transform:translateZ(0)]">
        <img src={map} alt="World map" className="w-full h-full object-cover" />
      </div>

      <header className="flex-shrink-0 p-4 z-10">
        <SidebarTrigger />
      </header>

      <main className="flex-1 relative z-10 px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <PowerButton
            loading={isToggling}
            checked={uiProxyEnabled}
            onClick={handleToggleProxy}
            disabled={isToggling}
            aria-label={t("Toggle Proxy")}
          />
        </div>

        <div
          className="absolute top-1/2 left-1/2 flex flex-col items-center"
          style={{ transform: "translate(-50%, calc(-50% + 135px))" }}
        >
          <ProxyBadge />
        </div>

        <div
          className="absolute left-1/2 flex flex-col items-center z-20"
          style={{ bottom: "calc(50% + 100px)", transform: "translateX(-50%)" }}
        >
          {currentProfile?.announce && (
            <div
              className={cn(
                "mb-4 px-2 py-3 rounded-lg text-center max-w-xs",
                "backdrop-blur-sm bg-white/50 border border-gray-200/50",
                "dark:bg-white/5 dark:border-white/10",
              )}
            >
              {currentProfile.announce_url ? (
                <a
                  href={currentProfile.announce_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline transition-all whitespace-pre-wrap"
                  title={currentProfile.announce_url.replace(/\\n/g, "\n")}
                >
                  <span>{currentProfile.announce.replace(/\\n/g, "\n")}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {currentProfile.announce.replace(/\\n/g, "\n")}
                </p>
              )}
            </div>
          )}

          <div className="text-center">
            <motion.h1
              className={cn(
                "text-3xl sm:text-4xl font-medium font-geist",
                statusInfo.className,
                statusInfo.isAnimating && "animate-pulse",
              )}
            >
              {statusInfo.text}
            </motion.h1>
          </div>
        </div>
      </main>

      <ProfileViewer ref={viewerRef} onChange={() => mutateProfiles()} />
    </div>
  );
};

export default MinimalHomePage;
