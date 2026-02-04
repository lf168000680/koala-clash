import useSWR, { mutate } from "swr";
import { useLockFn } from "ahooks";
import { getAxios, getVersion } from "@/services/api";
import {
  getClashInfo,
  patchClashConfig,
  getRuntimeConfig,
} from "@/services/cmds";

export const useClash = () => {
  const { data: clash, mutate: mutateClash } = useSWR(
    "getRuntimeConfig",
    getRuntimeConfig,
  );

  const { data: versionData, mutate: mutateVersion } = useSWR(
    "getVersion",
    getVersion,
  );

  const patchClash = useLockFn(async (patch: Partial<IConfigData>) => {
    await patchClashConfig(patch);
    mutateClash();
  });

  const version = versionData?.premium
    ? `${versionData.version} Premium`
    : versionData?.meta
      ? `${versionData.version} Mihomo`
      : versionData?.version || "-";

  return {
    clash,
    version,
    mutateClash,
    mutateVersion,
    patchClash,
  };
};

export const useClashInfo = () => {
  const { data: clashInfo, mutate: mutateInfo } = useSWR(
    "getClashInfo",
    getClashInfo,
  );

  const patchInfo = async (
    patch: Partial<
      Pick<
        IConfigData,
        | "port"
        | "socks-port"
        | "mixed-port"
        | "redir-port"
        | "tproxy-port"
        | "external-controller"
        | "secret"
      >
    >,
  ) => {
    const hasInfo =
      patch["redir-port"] != null ||
      patch["tproxy-port"] != null ||
      patch["mixed-port"] != null ||
      patch["socks-port"] != null ||
      patch["port"] != null ||
      patch["external-controller"] != null ||
      patch.secret != null;

    if (!hasInfo) return;

    // Validate ports
    const portFields = [
      "redir-port",
      "tproxy-port",
      "mixed-port",
      "socks-port",
      "port",
    ] as const;

    portFields.forEach((field) => {
      const value = patch[field];
      if (typeof value === "number") {
        if (value < 1111) throw new Error("The port should not < 1111");
        if (value > 65535) throw new Error("The port should not > 65535");
      }
    });

    await patchClashConfig(patch);
    mutateInfo();
    mutate("getClashConfig");
    // 刷新接口
    getAxios(true);
  };

  return {
    clashInfo,
    mutateInfo,
    patchInfo,
  };
};
