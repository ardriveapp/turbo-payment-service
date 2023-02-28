import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";

interface AxiosClientParams {
  axiosInstance?: AxiosInstance;
  retries?: number;
  retryDelay?: (retryNumber: number) => number;
}
export class AxiosClient {
  private axiosInstance: AxiosInstance;

  constructor({
    axiosInstance = axios.create(),
    retries = 8,
    retryDelay = axiosRetry.exponentialDelay,
  }: AxiosClientParams) {
    this.axiosInstance = axiosInstance;

    if (retries > 0) {
      axiosRetry(this.axiosInstance, {
        retries,
        retryDelay,
      });
    }
  }

  public get(
    url: string,
    config?: AxiosRequestConfig<any> | undefined
  ): Promise<AxiosResponse<any, any>> {
    return this.axiosInstance.get(url, config);
  }
}
