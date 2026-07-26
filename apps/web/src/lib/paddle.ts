"use client";

type PaddleEnvironment = "sandbox" | "production";

type PaddleEvent = {
  name?: string;
};

type PaddleSdk = {
  Environment: {
    set(environment: "sandbox"): void;
  };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: {
    open(options: {
      transactionId: string;
      customer?: { email: string };
      settings: {
        displayMode: "overlay";
        theme: "dark";
        locale: "en" | "ru";
        successUrl: string;
      };
    }): void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleSdk;
    __laminariaPaddleToken?: string;
  }
}

let sdkPromise: Promise<PaddleSdk> | null = null;
let checkoutSuccessUrl = "";

function loadPaddle(): Promise<PaddleSdk> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PaddleSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-laminaria-paddle="true"]',
    );
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.Paddle) resolve(window.Paddle);
      else reject(new Error("Paddle.js did not initialize"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load Paddle.js")), {
      once: true,
    });
    if (!existing) {
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.dataset.laminariaPaddle = "true";
      document.head.appendChild(script);
    }
  });
  return sdkPromise;
}

export async function openPaddleCheckout(input: {
  transactionId: string;
  clientToken: string;
  environment: PaddleEnvironment;
  customerEmail: string;
  locale: "en" | "ru";
  successUrl: string;
}): Promise<void> {
  const paddle = await loadPaddle();
  checkoutSuccessUrl = input.successUrl;
  if (!window.__laminariaPaddleToken) {
    if (input.environment === "sandbox") paddle.Environment.set("sandbox");
    paddle.Initialize({
      token: input.clientToken,
      eventCallback(event) {
        if (event.name === "checkout.completed" && checkoutSuccessUrl) {
          window.location.assign(checkoutSuccessUrl);
        }
      },
    });
    window.__laminariaPaddleToken = input.clientToken;
  } else if (window.__laminariaPaddleToken !== input.clientToken) {
    throw new Error("Paddle.js was initialized with another client token");
  }
  paddle.Checkout.open({
    transactionId: input.transactionId,
    customer: { email: input.customerEmail },
    settings: {
      displayMode: "overlay",
      theme: "dark",
      locale: input.locale,
      successUrl: input.successUrl,
    },
  });
}
