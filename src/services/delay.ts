import { getProxyDelay } from "./api";

const isDev = import.meta.env.DEV;

const DEFAULT_DELAY_URL = "https://cp.cloudflare.com/generate_204";
const STATUS_TESTING = -2;
const STATUS_MISS = -1;
const STATUS_ERROR = 1e6;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_LOADING_MS = 500;

const hashKey = (name: string, group: string) => `${group ?? ""}::${name}`;

class DelayManager {
  private cache = new Map<string, [number, number]>();
  private urlMap = new Map<string, string>();
  private abortMap = new Map<string, AbortController>();
  private requestIdMap = new Map<string, number>();
  private groupBatchId = new Map<string, number>();

  // 每个item的监听
  private listenerMap = new Map<string, (time: number) => void>();

  // 每个分组的监听
  private groupListenerMap = new Map<string, () => void>();

  setUrl(group: string, url: string) {
    if (isDev) {
      console.log(`[DelayManager] 设置测试URL，组: ${group}, URL: ${url}`);
    }
    this.urlMap.set(group, url);
  }

  getUrl(group: string) {
    const url = this.urlMap.get(group);
    if (isDev) {
      console.log(
        `[DelayManager] 获取测试URL，组: ${group}, URL: ${url || "未设置"}`,
      );
    }
    // 如果未设置URL，返回默认URL
    return url || DEFAULT_DELAY_URL;
  }

  setListener(name: string, group: string, listener: (time: number) => void) {
    const key = hashKey(name, group);
    this.listenerMap.set(key, listener);
  }

  removeListener(name: string, group: string) {
    const key = hashKey(name, group);
    this.listenerMap.delete(key);
  }

  setGroupListener(group: string, listener: () => void) {
    this.groupListenerMap.set(group, listener);
  }

  removeGroupListener(group: string) {
    this.groupListenerMap.delete(group);
  }

  private nextRequestId(key: string) {
    const nextId = (this.requestIdMap.get(key) || 0) + 1;
    this.requestIdMap.set(key, nextId);
    return nextId;
  }

  cancelGroup(group: string) {
    const nextBatchId = (this.groupBatchId.get(group) || 0) + 1;
    this.groupBatchId.set(group, nextBatchId);
    const prefix = `${group ?? ""}::`;
    for (const [key, controller] of this.abortMap) {
      if (key.startsWith(prefix)) {
        controller.abort();
        this.abortMap.delete(key);
      }
    }
    return nextBatchId;
  }

  cancelDelay(name: string, group: string) {
    const key = hashKey(name, group);
    this.nextRequestId(key);
    const controller = this.abortMap.get(key);
    if (controller) {
      controller.abort();
      this.abortMap.delete(key);
    }
  }

  setDelay(name: string, group: string, delay: number) {
    const key = hashKey(name, group);
    if (isDev) {
      console.log(
        `[DelayManager] 设置延迟，代理: ${name}, 组: ${group}, 延迟: ${delay}`,
      );
    }

    this.cache.set(key, [delay, Date.now()]);
    const listener = this.listenerMap.get(key);
    if (listener) listener(delay);
  }

  getDelay(name: string, group: string) {
    const key = hashKey(name, group);
    const val = this.cache.get(key);
    if (!val) return STATUS_MISS;

    // 缓存30分钟
    if (Date.now() - val[1] > CACHE_TTL_MS) {
      return STATUS_MISS;
    }
    return val[0];
  }

  /// 暂时修复provider的节点延迟排序的问题
  getDelayFix(proxy: IProxyItem, group: string) {
    if (!proxy.provider) {
      const delay = this.getDelay(proxy.name, group);
      if (delay >= 0 || delay === STATUS_TESTING) return delay;
    }

    if (proxy.history.length > 0) {
      // 0ms以error显示
      return proxy.history[proxy.history.length - 1].delay || STATUS_ERROR;
    }
    return STATUS_MISS;
  }

  async checkDelay(name: string, group: string, timeout: number) {
    if (isDev) {
      console.log(
        `[DelayManager] 开始测试延迟，代理: ${name}, 组: ${group}, 超时: ${timeout}ms`,
      );
    }

    const key = hashKey(name, group);
    const requestId = this.nextRequestId(key);
    const previousController = this.abortMap.get(key);
    if (previousController) {
      previousController.abort();
      this.abortMap.delete(key);
    }
    const controller = new AbortController();
    this.abortMap.set(key, controller);

    // 先将状态设置为测试中
    this.setDelay(name, group, STATUS_TESTING);

    let delay = STATUS_MISS;
    let timedOut = false;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = this.getUrl(group);
      if (isDev) {
        console.log(
          `[DelayManager] 调用API测试延迟，代理: ${name}, URL: ${url}`,
        );
      }

      // 记录开始时间，用于计算实际延迟
      const startTime = Date.now();

      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);

      const result = await getProxyDelay(name, url, timeout, controller.signal);
      clearTimeout(timeoutId);

      // 确保至少显示500ms的加载动画
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_LOADING_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_LOADING_MS - elapsedTime),
        );
      }

      // 检查延迟结果是否为undefined
      if (result && typeof result.delay === "number") {
        delay = result.delay;
        if (isDev) {
          console.log(
            `[DelayManager] 延迟测试完成，代理: ${name}, 结果: ${delay}ms`,
          );
        }
      } else {
        console.error(
          `[DelayManager] 延迟测试返回无效结果，代理: ${name}, 结果:`,
          result,
        );
        delay = STATUS_ERROR;
      }
    } catch (error) {
      const errorName =
        typeof error === "object" && error !== null && "name" in error
          ? String((error as { name?: string }).name)
          : "";
      const isAbort = errorName === "CanceledError" || errorName === "AbortError";
      await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS));

      console.error(`[DelayManager] 延迟测试出错，代理: ${name}`, error);
      if (timedOut && isDev) {
        console.log(`[DelayManager] 延迟测试超时，代理: ${name}`);
      }
      if (isAbort && !timedOut) {
        delay = STATUS_MISS;
      } else {
        delay = STATUS_ERROR;
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    const currentRequestId = this.requestIdMap.get(key);
    if (currentRequestId !== requestId) {
      const currentDelay = this.getDelay(name, group);
      if (this.abortMap.get(key) === controller) {
        this.abortMap.delete(key);
      }
      return currentDelay;
    }

    this.setDelay(name, group, delay);
    if (this.abortMap.get(key) === controller) {
      this.abortMap.delete(key);
    }
    return delay;
  }

  async checkListDelay(
    nameList: string[],
    group: string,
    timeout: number,
    concurrency = 36,
  ) {
    if (isDev) {
      console.log(
        `[DelayManager] 批量测试延迟开始，组: ${group}, 数量: ${nameList.length}, 并发数: ${concurrency}`,
      );
    }
    const batchId = this.cancelGroup(group);
    const names = nameList.filter(Boolean);
    // 设置正在延迟测试中
    names.forEach((name) => this.setDelay(name, group, STATUS_TESTING));

    let index = 0;
    const startTime = Date.now();
    const listener = this.groupListenerMap.get(group);

    const isCurrentBatch = () => this.groupBatchId.get(group) === batchId;
    const help = async (): Promise<void> => {
      if (!isCurrentBatch()) return;
      const currName = names[index++];
      if (!currName) return;

      try {
        // 确保API调用前状态为测试中
        this.setDelay(currName, group, STATUS_TESTING);

        // 添加一些随机延迟，避免所有请求同时发出和返回
        if (index > 1) {
          // 第一个不延迟，保持响应性
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 200),
          );
        }

        await this.checkDelay(currName, group, timeout);
        if (listener && isCurrentBatch()) listener();
      } catch (error) {
        console.error(
          `[DelayManager] 批量测试单个代理出错，代理: ${currName}`,
          error,
        );
        // 设置为错误状态
        if (isCurrentBatch()) {
          this.setDelay(currName, group, STATUS_ERROR);
        }
      }

      if (!isCurrentBatch()) return;
      return help();
    };

    // 限制并发数，避免发送太多请求
    const actualConcurrency = Math.min(concurrency, names.length, 10);
    if (isDev) {
      console.log(`[DelayManager] 实际并发数: ${actualConcurrency}`);
    }

    const promiseList: Promise<void>[] = [];
    for (let i = 0; i < actualConcurrency; i++) {
      promiseList.push(help());
    }

    await Promise.all(promiseList);
    const totalTime = Date.now() - startTime;
    if (isDev) {
      console.log(
        `[DelayManager] 批量测试延迟完成，组: ${group}, 总耗时: ${totalTime}ms`,
      );
    }
  }

  formatDelay(delay: number, timeout = 10000) {
    if (delay === -1) return "-";
    if (delay === -2) return "testing";
    if (delay >= timeout) return "timeout";
    return `${delay}`;
  }

  formatDelayColor(delay: number, timeout = 10000) {
    if (delay < 0) return "";
    if (delay >= timeout) return "error.main";
    if (delay >= 10000) return "error.main";
    if (delay >= 400) return "warning.main";
    if (delay >= 250) return "primary.main";
    return "success.main";
  }
}

export default new DelayManager();
