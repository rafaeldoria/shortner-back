/// <reference types="jest" />

const mockSendUrlLimitAlertEmail = jest.fn();
const mockSendVerificationEmail = jest.fn();

jest.mock("../email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendVerificationEmail: mockSendVerificationEmail,
    sendUrlLimitAlertEmail: mockSendUrlLimitAlertEmail,
  })),
}));

jest.mock("../email-job.model", () => ({
  EmailJobModel: {
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../auth/auth.model", () => ({
  UserModel: {
    findById: jest.fn(),
  },
}));

import { EmailJobModel } from "../email-job.model";
import { processJob } from "../email.worker";

const mockedEmailJobModel = jest.mocked(EmailJobModel);

describe("email.worker", () => {
  it("processes a URL limit alert job and marks it as sent", async () => {
    mockedEmailJobModel.findOneAndUpdate.mockResolvedValue({
      _id: "job-1",
      type: "url-limit-alert",
      to: "alerts@example.com",
      alertThreshold: 150,
      urlCount: 160,
      attempts: 0,
      maxAttempts: 3,
    } as never);
    mockSendUrlLimitAlertEmail.mockResolvedValue("provider-1");

    await expect(processJob()).resolves.toBe(true);

    expect(mockSendUrlLimitAlertEmail).toHaveBeenCalledWith({
      to: "alerts@example.com",
      threshold: 150,
      urlCount: 160,
      jobId: "job-1",
    });
    expect(mockedEmailJobModel.findByIdAndUpdate).toHaveBeenCalledWith("job-1", {
      $set: {
        status: "sent",
        providerMessageId: "provider-1",
      },
      $unset: {
        lockedAt: "",
        lastError: "",
      },
    });
  });

  it("marks a URL limit alert job as pending when email sending fails and attempts remain", async () => {
    mockedEmailJobModel.findOneAndUpdate.mockResolvedValue({
      _id: "job-1",
      type: "url-limit-alert",
      to: "alerts@example.com",
      alertThreshold: 100,
      urlCount: 101,
      attempts: 0,
      maxAttempts: 3,
    } as never);
    mockSendUrlLimitAlertEmail.mockRejectedValue(new Error("provider unavailable"));

    await expect(processJob()).resolves.toBe(true);

    expect(mockedEmailJobModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        $set: expect.objectContaining({
          attempts: 1,
          status: "pending",
          lastError: "provider unavailable",
          nextRunAt: expect.any(Date),
        }),
        $unset: {
          lockedAt: "",
        },
      }),
    );
  });
});
