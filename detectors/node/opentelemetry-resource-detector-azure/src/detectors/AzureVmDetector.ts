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

import * as http from 'http';

import { context, diag } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import {
  ResourceDetector,
  DetectedResource,
  DetectedResourceAttributes,
} from '@opentelemetry/resources';
import {
  CLOUDPLATFORMVALUES_AZURE_VM,
  CLOUDPROVIDERVALUES_AZURE,
  SEMRESATTRS_CLOUD_PLATFORM,
  SEMRESATTRS_CLOUD_PROVIDER,
  SEMRESATTRS_CLOUD_REGION,
  SEMRESATTRS_HOST_ID,
  SEMRESATTRS_HOST_NAME,
  SEMRESATTRS_HOST_TYPE,
  SEMRESATTRS_OS_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE,
  AZURE_VM_METADATA_HOST,
  AZURE_VM_METADATA_PATH,
  AZURE_VM_SCALE_SET_NAME_ATTRIBUTE,
  AZURE_VM_SKU_ATTRIBUTE,
  AzureVmMetadata,
} from '../types';

/**
 * The AzureVmDetector can be used to detect if a process is running in an Azure VM.
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
class AzureVmResourceDetector implements ResourceDetector {
  detect(): DetectedResource {
    const dataPromise = context.with(suppressTracing(context.active()), () =>
      this.getAzureVmMetadata()
    );

    const attrNames = [
      AZURE_VM_SCALE_SET_NAME_ATTRIBUTE,
      AZURE_VM_SKU_ATTRIBUTE,
      SEMRESATTRS_CLOUD_PLATFORM,
      SEMRESATTRS_CLOUD_PROVIDER,
      SEMRESATTRS_CLOUD_REGION,
      CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE,
      SEMRESATTRS_HOST_ID,
      SEMRESATTRS_HOST_NAME,
      SEMRESATTRS_HOST_TYPE,
      SEMRESATTRS_OS_VERSION,
    ];

    const attributes = {} as DetectedResourceAttributes;
    attrNames.forEach(name => {
      // Each resource attribute is determined asynchronously in _gatherData().
      attributes[name] = dataPromise.then(data => data[name]);
    });

    return { attributes };
  }

  async getAzureVmMetadata(): Promise<DetectedResourceAttributes> {
    try {
      const options = {
        host: AZURE_VM_METADATA_HOST,
        path: AZURE_VM_METADATA_PATH,
        method: 'GET',
        timeout: 5000,
        headers: {
          Metadata: 'True',
        },
      };
      const metadata: AzureVmMetadata = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          req.destroy();
          reject(new Error('Azure metadata service request timed out.'));
        }, 1000);

        const req = http.request(options, res => {
          clearTimeout(timeoutId);
          const { statusCode } = res;
          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', chunk => (rawData += chunk));
          res.on('end', () => {
            if (statusCode && statusCode >= 200 && statusCode < 300) {
              try {
                resolve(JSON.parse(rawData));
              } catch (error) {
                reject(error);
              }
            } else {
              reject(
                new Error('Failed to load page, status code: ' + statusCode)
              );
            }
          });
        });
        req.on('error', err => {
          clearTimeout(timeoutId);
          reject(err);
        });
        req.end();
      });

      const attributes = {
        [AZURE_VM_SCALE_SET_NAME_ATTRIBUTE]: metadata['vmScaleSetName'],
        [AZURE_VM_SKU_ATTRIBUTE]: metadata['sku'],
        [SEMRESATTRS_CLOUD_PLATFORM]: CLOUDPLATFORMVALUES_AZURE_VM,
        [SEMRESATTRS_CLOUD_PROVIDER]: CLOUDPROVIDERVALUES_AZURE,
        [SEMRESATTRS_CLOUD_REGION]: metadata['location'],
        [CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE]: metadata['resourceId'],
        [SEMRESATTRS_HOST_ID]: metadata['vmId'],
        [SEMRESATTRS_HOST_NAME]: metadata['name'],
        [SEMRESATTRS_HOST_TYPE]: metadata['vmSize'],
        [SEMRESATTRS_OS_VERSION]: metadata['version'],
      };
      return attributes;
    } catch (err: any) {
      diag.debug(
        'AzureVmResourceDetector: not running in an Azure VM:',
        err.message
      );
      return {};
    }
  }
}

export const azureVmDetector = new AzureVmResourceDetector();
