/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { IdGenerator } from '@opentelemetry/sdk-trace-base';

import {
  generateTraceId,
  generateSpanId,
  TRACE_ID_BYTES,
} from '../../internal/xray-id-generation';

/**
 * IdGenerator that generates trace IDs conforming to AWS X-Ray format.
 * https://docs.aws.amazon.com/xray/latest/devguide/xray-api-sendingdata.html#xray-api-traceids
 */
export class AWSXRayIdGenerator implements IdGenerator {
  /**
   * Returns a random 16-byte trace ID formatted/encoded as a 32 lowercase hex
   * characters corresponding to 128 bits. The first 4 bytes correspond to the current
   * time, in seconds, as per X-Ray trace ID format.
   */
  generateTraceId(): string {
    return generateTraceId(generateRandomBytes);
  }

  /**
   * Returns a random 8-byte span ID formatted/encoded as a 16 lowercase hex
   * characters corresponding to 64 bits.
   */
  generateSpanId(): string {
    return generateSpanId(generateRandomBytes);
  }
}

const SHARED_CHAR_CODES_ARRAY = Array(TRACE_ID_BYTES * 2);

function generateRandomBytes(bytes: number) {
  for (let i = 0; i < bytes * 2; i++) {
    SHARED_CHAR_CODES_ARRAY[i] = Math.floor(Math.random() * 16) + 48;
    // valid hex characters in the range 48-57 and 97-102
    if (SHARED_CHAR_CODES_ARRAY[i] >= 58) {
      SHARED_CHAR_CODES_ARRAY[i] += 39;
    }
  }

  return String.fromCharCode.apply(
    null,
    SHARED_CHAR_CODES_ARRAY.slice(0, bytes * 2)
  );
}
