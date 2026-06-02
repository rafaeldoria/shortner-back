import { env } from "../../config/env";
import { EmailJobModel } from "../email/email-job.model";
import { UrlModel } from "./url.model";

const ALERT_THRESHOLDS = [50, 100, 150] as const;
const ALERT_ACTIVE_STATUSES = ["pending", "processing", "sent"];
const TIME_ZONE = "America/Sao_Paulo";
const RUN_HOUR = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

function requiredEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getSaoPauloParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values: Record<string, number> = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const getValue = (key: string) => values[key] ?? 0;

  return {
    year: getValue("year"),
    month: getValue("month"),
    day: getValue("day"),
    hour: getValue("hour"),
    minute: getValue("minute"),
    second: getValue("second"),
  };
}

export function getNextUrlLimitMonitorDelay(now = new Date()) {
  const parts = getSaoPauloParts(now);
  const current = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let nextRun = Date.UTC(parts.year, parts.month - 1, parts.day, RUN_HOUR, 0, 0);

  if (nextRun <= current) {
    nextRun += DAY_MS;
  }

  return nextRun - current;
}

export async function checkUrlLimitAlerts() {
  const urlCount = await UrlModel.countDocuments({});

  if (urlCount < ALERT_THRESHOLDS[0]) {
    return [];
  }

  const to = requiredEnv(env.alertSendEmail, "ALERT_SEND_EMAIL");
  const createdJobs = [];

  for (const threshold of ALERT_THRESHOLDS) {
    if (urlCount < threshold) {
      continue;
    }

    const existingJob = await EmailJobModel.findOne({
      type: "url-limit-alert",
      alertThreshold: threshold,
      status: { $in: ALERT_ACTIVE_STATUSES },
    });

    if (existingJob) {
      continue;
    }

    const job = await EmailJobModel.create({
      type: "url-limit-alert",
      to,
      alertThreshold: threshold,
      urlCount,
    });
    createdJobs.push(job);
  }

  return createdJobs;
}

export function startUrlLimitMonitor() {
  function scheduleNextRun() {
    return setTimeout(() => {
      void checkUrlLimitAlerts()
        .catch((error) => {
          console.error("URL limit monitor failed", error);
        })
        .finally(scheduleNextRun);
    }, getNextUrlLimitMonitorDelay());
  }

  return scheduleNextRun();
}
