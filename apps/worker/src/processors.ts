import type { Job } from "bullmq";
import { aiJob, emailJob, storageJob } from "./jobs.js";
import type { AiProvider } from "./providers/ai.js";
import type { EmailProvider } from "./providers/email.js";
import type { StorageProvider } from "./providers/storage.js";

export interface Providers {
  ai: AiProvider;
  email: EmailProvider;
  storage: StorageProvider;
}

export function createProcessor(providers: Providers) {
  return async (job: Job) => {
    if (job.name === "email") {
      const input = emailJob.parse(job.data);
      return providers.email.send({
        to: input.recipient,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      });
    }

    if (job.name === "ai") {
      const input = aiJob.parse(job.data);
      const instructions = {
        moderate:
          "Classify the supplied webinar message. Return concise JSON only. Never infer protected traits.",
        answer:
          "Answer as the clearly labeled Laminaria AI assistant using only the supplied webinar context. Say when evidence is insufficient.",
        summarize:
          "Create a factual webinar summary from the supplied material. Separate decisions, questions, and follow-up actions.",
      } as const;
      return providers.ai.complete({
        system: instructions[input.kind],
        prompt: input.context
          ? `Context:\n${input.context}\n\nInput:\n${input.input}`
          : input.input,
        maxOutputTokens: input.kind === "summarize" ? 1800 : 700,
      });
    }

    if (job.name === "storage") {
      const input = storageJob.parse(job.data);
      return providers.storage.put({
        key: input.objectKey,
        body: Buffer.from(input.payloadBase64, "base64"),
        contentType: input.contentType,
      });
    }

    throw new Error(`Unknown worker job: ${job.name}`);
  };
}
