/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { RawAxiosResponseHeaders } from "axios";
import { expect } from "chai";

export function assertExpectedHeadersWithContentLength(
  headers: RawAxiosResponseHeaders,
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
