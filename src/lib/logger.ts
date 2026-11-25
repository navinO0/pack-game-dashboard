type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
const minPriority = LEVEL_PRIORITY[configuredLevel] ?? 20;

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < minPriority) return;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "pack-score-calc",
    message,
    ...(context ? { context } : {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

