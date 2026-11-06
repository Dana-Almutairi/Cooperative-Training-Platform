
const LEVELS = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

function writeLog(level, message, details = {}) {
  const timestamp = new Date().toISOString();

  const safeDetails = {};

  // Only allow explicitly selected log fields
  const allowedFields = [
    "method",
    "path",
    "statusCode",
    "errorCode",
  ];

  for (const field of allowedFields) {
    const value = details[field];

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      safeDetails[field] = value;
    }
  }

  const logEntry = {
    timestamp,
    level: LEVELS[level],
    message,
    ...safeDetails,
  };

  if (level === "error") {
    console.error(JSON.stringify(logEntry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

const logger = {
  info: (message, details) =>
    writeLog("info", message, details),

  warn: (message, details) =>
    writeLog("warn", message, details),

  error: (message, details) =>
    writeLog("error", message, details),
};

module.exports = logger;
