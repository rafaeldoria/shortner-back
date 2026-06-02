/// <reference types="jest" />

import { env } from "../../../config/env";
import { EmailJobModel } from "../../email/email-job.model";
import { UrlModel } from "../url.model";
import { checkUrlLimitAlerts, getNextUrlLimitMonitorDelay } from "../url-monitor.worker";

jest.mock("../url.model", () => ({
  UrlModel: {
    countDocuments: jest.fn(),
  },
}));

jest.mock("../../email/email-job.model", () => ({
  EmailJobModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const mockedUrlModel = jest.mocked(UrlModel);
const mockedEmailJobModel = jest.mocked(EmailJobModel);

describe("url-monitor.worker", () => {
  beforeEach(() => {
    env.alertSendEmail = "alerts@example.com";
  });

  it("does not create alert jobs below the first threshold", async () => {
    mockedUrlModel.countDocuments.mockResolvedValue(49);

    await expect(checkUrlLimitAlerts()).resolves.toEqual([]);

    expect(mockedEmailJobModel.findOne).not.toHaveBeenCalled();
    expect(mockedEmailJobModel.create).not.toHaveBeenCalled();
  });

  it("creates a 50 URL alert job when the first threshold is reached", async () => {
    const job = { _id: "job-50" };
    mockedUrlModel.countDocuments.mockResolvedValue(50);
    mockedEmailJobModel.findOne.mockResolvedValue(null);
    mockedEmailJobModel.create.mockResolvedValue(job as never);

    await expect(checkUrlLimitAlerts()).resolves.toEqual([job]);

    expect(mockedEmailJobModel.create).toHaveBeenCalledWith({
      type: "url-limit-alert",
      to: "alerts@example.com",
      alertThreshold: 50,
      urlCount: 50,
    });
  });

  it("creates all pending threshold alert jobs when URL count is above 150", async () => {
    mockedUrlModel.countDocuments.mockResolvedValue(160);
    mockedEmailJobModel.findOne.mockResolvedValue(null);
    mockedEmailJobModel.create
      .mockResolvedValueOnce({ _id: "job-50" } as never)
      .mockResolvedValueOnce({ _id: "job-100" } as never)
      .mockResolvedValueOnce({ _id: "job-150" } as never);

    await checkUrlLimitAlerts();

    expect(mockedEmailJobModel.create).toHaveBeenCalledTimes(3);
    expect(mockedEmailJobModel.create).toHaveBeenNthCalledWith(1, {
      type: "url-limit-alert",
      to: "alerts@example.com",
      alertThreshold: 50,
      urlCount: 160,
    });
    expect(mockedEmailJobModel.create).toHaveBeenNthCalledWith(2, {
      type: "url-limit-alert",
      to: "alerts@example.com",
      alertThreshold: 100,
      urlCount: 160,
    });
    expect(mockedEmailJobModel.create).toHaveBeenNthCalledWith(3, {
      type: "url-limit-alert",
      to: "alerts@example.com",
      alertThreshold: 150,
      urlCount: 160,
    });
  });

  it("does not create duplicate alert jobs for active statuses", async () => {
    mockedUrlModel.countDocuments.mockResolvedValue(50);
    mockedEmailJobModel.findOne.mockResolvedValue({ _id: "existing-job" } as never);

    await expect(checkUrlLimitAlerts()).resolves.toEqual([]);

    expect(mockedEmailJobModel.findOne).toHaveBeenCalledWith({
      type: "url-limit-alert",
      alertThreshold: 50,
      status: { $in: ["pending", "processing", "sent"] },
    });
    expect(mockedEmailJobModel.create).not.toHaveBeenCalled();
  });

  it("allows a new alert job when previous jobs are failed", async () => {
    mockedUrlModel.countDocuments.mockResolvedValue(50);
    mockedEmailJobModel.findOne.mockResolvedValue(null);
    mockedEmailJobModel.create.mockResolvedValue({ _id: "retry-job" } as never);

    await checkUrlLimitAlerts();

    expect(mockedEmailJobModel.create).toHaveBeenCalledTimes(1);
  });

  it("calculates the next run delay for 18:00 in America/Sao_Paulo", () => {
    const now = new Date("2026-06-02T20:00:00.000Z");

    expect(getNextUrlLimitMonitorDelay(now)).toBe(60 * 60 * 1000);
  });
});
