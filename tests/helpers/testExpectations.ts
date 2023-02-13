import { AxiosResponseHeaders } from "axios";
import { expect } from "chai";

export function assertExpectedHeadersWithContentLength(
  headers: AxiosResponseHeaders,
  contentLength: number
) {
  expect(headers.date).to.exist;
  expect(headers).to.deep.include(
    expectedHeadersWithContentLength(contentLength)
  );
}

const expectedHeadersWithContentLength = (contentLength: number) => {
  // Headers without `date` for deep equality check
  // `date` value is not consistently predictable
  return {
    "content-type": "text/plain; charset=utf-8",
    "content-length": `${contentLength}`,
    connection: "close",
  };
};
