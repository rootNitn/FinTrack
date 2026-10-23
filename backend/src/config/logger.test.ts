import pino from "pino";
import { Writable } from "node:stream";
import { loggerRedaction } from "./logger";

describe("logger sensitive-header redaction", () => {
  test("removes credentials and signatures from serialized request headers", () => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const testLogger = pino({ redact: loggerRedaction }, sink);
    testLogger.info({ req: { headers: {
      authorization: "Bearer access-secret",
      cookie: "session=secret-cookie",
      "x-api-key": "api-secret",
      "x-razorpay-signature": "signature-secret",
      "user-agent": "LifeTrack test",
    } } });

    const output = chunks.join("");
    expect(output).not.toContain("access-secret");
    expect(output).not.toContain("secret-cookie");
    expect(output).not.toContain("api-secret");
    expect(output).not.toContain("signature-secret");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("LifeTrack test");
  });
});