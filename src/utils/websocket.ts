import Sockette, { type SocketteOptions } from "sockette";

/**
 * A wrapper of Sockette that will automatically reconnect up to `maxError` before emitting an error event.
 */
export const createSockette = (
  url: string,
  opt: SocketteOptions,
  maxError = 10,
) => {
  let remainRetryCount = maxError;
  let hasMaxed = false;
  let hasClosedNotified = false;

  return new Sockette(url, {
    ...opt,
    // Sockette has a built-in reconnect when ECONNREFUSED feature
    // Use maxError if opt.maxAttempts is not specified
    maxAttempts: opt.maxAttempts ?? maxError,
    onopen(this: Sockette, ev) {
      hasMaxed = false;
      hasClosedNotified = false;
      opt.onopen?.call(this, ev);
    },
    onmessage(this: Sockette, ev) {
      remainRetryCount = maxError; // reset counter
      opt.onmessage?.call(this, ev);
    },
    onerror(this: Sockette, ev) {
      remainRetryCount -= 1;

      if (remainRetryCount >= 0) {
        if (this instanceof Sockette) {
          this.close();
          this.reconnect();
        }
      } else {
        opt.onerror?.call(this, ev);
      }
    },
    onmaximum(this: Sockette, ev) {
      hasMaxed = true;
      opt.onmaximum?.call(this, ev);
      // onmaximum will be fired when Sockette reaches built-in reconnect limit,
      // We will also set remainRetryCount to 0 to prevent further reconnect.
      remainRetryCount = 0;
      if (!hasClosedNotified && opt.onclose) {
        hasClosedNotified = true;
        opt.onclose.call(this, ev as any);
      }
    },
    onclose(this: Sockette, ev) {
      const isNormal = ev.code === 1000 || ev.code === 1001;
      if (!isNormal && !hasMaxed) {
        return;
      }
      if (hasClosedNotified) {
        return;
      }
      hasClosedNotified = true;
      opt.onclose?.call(this, ev);
    },
  });
};

/**
 * 创建一个支持认证的WebSocket连接
 * 使用标准的URL参数方式添加token
 *
 * 注意：mihomo服务器对WebSocket的认证支持不佳，使用URL参数方式传递token
 */
export const createAuthSockette = (
  baseUrl: string,
  secret: string,
  opt: SocketteOptions,
  maxError = 10,
) => {
  let url = baseUrl;
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    url = `ws://${url}`;
  }

  let hasMaxed = false;
  let hasClosedNotified = false;

  try {
    const urlObj = new URL(url);
    if (secret) {
      urlObj.searchParams.delete("token");
      urlObj.searchParams.append("token", secret);
    }

    url = urlObj.toString();
    console.log(`[WebSocket] 创建连接: ${url.replace(secret || "", "***")}`);
  } catch (e) {
    console.error(`[WebSocket] URL格式错误: ${url}`, e);
    if (opt.onerror) {
      const anyOpt = opt as any;
      anyOpt.onerror(
        new ErrorEvent("error", { message: `URL格式错误: ${e}` } as any),
      );
    }
    return createDummySocket();
  }

  const wrappedOptions: SocketteOptions = {
    ...opt,
    onopen(this: Sockette, ev) {
      hasMaxed = false;
      hasClosedNotified = false;
      opt.onopen?.call(this, ev);
    },
    onclose(this: Sockette, ev) {
      const isNormal = ev.code === 1000 || ev.code === 1001;
      if (!isNormal && !hasMaxed) {
        return;
      }
      if (hasClosedNotified) {
        return;
      }
      hasClosedNotified = true;
      opt.onclose?.call(this, ev);
    },
    onmaximum(this: Sockette, ev) {
      hasMaxed = true;
      opt.onmaximum?.call(this, ev);
      if (!hasClosedNotified && opt.onclose) {
        hasClosedNotified = true;
        opt.onclose.call(this, ev as any);
      }
    },
  };

  return createSockette(url, wrappedOptions, maxError);
};

// 创建一个空的WebSocket对象
function createDummySocket() {
  return {
    close: () => { },
    reconnect: () => { },
    json: () => { },
    send: () => { },
    open: () => { },
  };
}
