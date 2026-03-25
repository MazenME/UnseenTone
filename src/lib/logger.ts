type LogMeta = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

let sentryClientPromise: Promise<typeof import("@sentry/nextjs") | null> | null = null;

function getDsn() {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
}

function safeStringify(meta: LogMeta) {
  try {
    return JSON.stringify(meta);
  } catch {
    return "[unserializable-meta]";
  }
}

async function getSentryClient() {
  const dsn = getDsn();

  if (!dsn) {
    return null;
  }

  if (!sentryClientPromise) {
    sentryClientPromise = import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.init({
          dsn,
          tracesSampleRate: Number(
            process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ||
              process.env.SENTRY_TRACES_SAMPLE_RATE ||
              "0",
          ),
        });

        return Sentry;
      })
      .catch(() => null);
  }

  return sentryClientPromise;
}

async function reportToSentry(level: LogLevel, message: string, meta?: LogMeta) {
  const Sentry = await getSentryClient();

  if (!Sentry) {
    return;
  }

  if (level === "error") {
    const error = new Error(message);
    Sentry.captureException(error, {
      extra: meta,
    });
    return;
  }

  const sentryLevel = level === "warn" ? "warning" : "info";

  Sentry.captureMessage(message, {
    level: sentryLevel,
    extra: meta,
  });
}

function print(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = meta ? `${message} ${safeStringify(meta)}` : message;

  if (level === "error") {
    console.error(payload);
    void reportToSentry(level, message, meta);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    void reportToSentry(level, message, meta);
    return;
  }
  console.log(payload);
  void reportToSentry(level, message, meta);
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    print("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    print("warn", message, meta);
  },
  error(message: string, meta?: LogMeta) {
    print("error", message, meta);
  },
};
