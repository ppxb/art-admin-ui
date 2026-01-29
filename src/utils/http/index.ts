import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { $t } from '@/locales'
import { useUserStore } from '@/store/modules/user'
import { handleError, HttpError, showError, showSuccess } from './error'
import { ApiStatus } from './status'

/** 扩展的请求配置 */
export interface HttpConfig extends Omit<AxiosRequestConfig, 'url' | 'method' | 'data' | 'params'> {
  /** 是否显示错误消息 */
  showErrorMessage?: boolean
  /** 是否显示成功消息 */
  showSuccessMessage?: boolean
  /** 是否启用重试 */
  enableRetry?: boolean
  /** 自定义重试次数 */
  retryCount?: number
}

/** 下载配置 */
export interface DownloadConfig extends HttpConfig {
  /** 文件名（可选，不传则从响应头获取） */
  filename?: string
  /** 下载进度回调 */
  onProgress?: (progress: number) => void
}

/** 上传配置 */
export interface UploadConfig extends HttpConfig {
  /** 上传进度回调 */
  onProgress?: (progress: number) => void
  /** 额外的表单字段（占位） */
  fields?: Record<string, any>
}

const REQUEST_TIMEOUT = 15000
const UPLOAD_TIMEOUT = 60000
const LOGOUT_DELAY = 500
const MAX_RETRIES = 0
const RETRY_DELAY = 1000
const UNAUTHORIZED_DEBOUNCE_TIME = 3000

let isUnauthorizedErrorShown = false
let unauthorizedTimer: NodeJS.Timeout | null = null

/**
 * 延迟函数
 *
 * @param ms 延迟时间（毫秒）
 */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 统一创建 HttpError
 * @param message 错误消息
 * @param code 错误代码
 */
function createHttpError(message: string, code: number) {
  return new HttpError(message, code)
}

/**
 * 处理 401 错误
 * @param message 错误消息（可选）
 */
function handleUnauthorizedError(message?: string) {
  const error = createHttpError(message || $t('httpMsg.unauthorized'), ApiStatus.unauthorized)

  if (!isUnauthorizedErrorShown) {
    isUnauthorizedErrorShown = true
    setTimeout(() => {
      useUserStore().logOut()
    }, LOGOUT_DELAY)

    unauthorizedTimer = setTimeout(resetUnauthorizedError, UNAUTHORIZED_DEBOUNCE_TIME)

    showError(error, true)
    throw error
  }
  throw error
}

/** 重置 401 防抖状态 */
function resetUnauthorizedError() {
  isUnauthorizedErrorShown = false
  if (unauthorizedTimer) {
    clearTimeout(unauthorizedTimer)
    unauthorizedTimer = null
  }
}

/**
 * 判断是否应重试请求
 * @param statusCode Http 状态码
 */
function shouldRetry(statusCode: number): boolean {
  return [
    ApiStatus.requestTimeout,
    ApiStatus.internalServerError,
    ApiStatus.badGateway,
    ApiStatus.serviceUnavailable,
    ApiStatus.gatewayTimeout,
  ].includes(statusCode)
}

/** 从响应头获取文件名 */
function getFilenameFromResponse(response: AxiosResponse): string {
  const contentDisposition = response.headers['content-disposition']
  if (contentDisposition) {
    // 支持 filename 和 filename* 两种格式
    const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?;?/i)
    if (filenameMatch && filenameMatch[1]) {
      return decodeURIComponent(filenameMatch[1])
    }
  }
  return `download_${Date.now()}`
}

/** 触发浏览器下载 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // 延迟释放 URL，确保下载完成
  setTimeout(() => window.URL.revokeObjectURL(url), 100)
}

const { VITE_API_PREFIX, VITE_WITH_CREDENTIALS } = import.meta.env

const axiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  baseURL: VITE_API_PREFIX,
  withCredentials: VITE_WITH_CREDENTIALS === 'true',
  validateStatus: status => status >= 200 && status < 300,
  transformResponse: [
    (data, headers) => {
      const contentType = headers?.['content-type']
      if (contentType?.includes('application/json')) {
        try {
          return JSON.parse(data)
        }
        catch {
          return data
        }
      }
      return data
    },
  ],
})

/** 请求拦截器 */
axiosInstance.interceptors.request.use(
  (request: InternalAxiosRequestConfig) => {
    const { accessToken } = useUserStore()
    if (accessToken)
      request.headers.set('Authorization', accessToken)

    // 非 FormData 且未设置 Content-Type 时，自动设置为 JSON
    if (request.data && !(request.data instanceof FormData) && !request.headers['Content-Type']) {
      request.headers.set('Content-Type', 'application/json')
    }

    return request
  },
  (error) => {
    showError(createHttpError($t('httpMsg.requestConfigError'), ApiStatus.error))
    return Promise.reject(error)
  },
)

axiosInstance.interceptors.response.use(
  (response: AxiosResponse<Api.Resp>) => {
    // 处理 blob 类型响应（文件下载）
    if (response.config.responseType === 'blob') {
      return response
    }

    const { code, msg } = response.data
    if (code === '0')
      return response

    if (code === '401')
      handleUnauthorizedError(msg)

    throw createHttpError(msg || $t('httpMsg.requestFailed'), code.toString() as unknown as number)
  },
  (error) => {
    if (error.response?.status === ApiStatus.unauthorized)
      handleUnauthorizedError()
    return Promise.reject(handleError(error))
  },
)

/**
 * 基础请求函数
 * @param config 请求配置
 */
async function request<T = any>(config: AxiosRequestConfig & HttpConfig): Promise<T> {
  try {
    const res = await axiosInstance.request<Api.Resp<T>>(config)

    // 显示成功消息
    if (config.showSuccessMessage && res.data.msg) {
      showSuccess(res.data.msg)
    }

    return res.data.data as T
  }
  catch (error) {
    if (error instanceof HttpError && error.code !== ApiStatus.unauthorized) {
      const showMsg = config.showErrorMessage !== false
      showError(error, showMsg)
    }
    return Promise.reject(error)
  }
}

/**
 * 请求重试逻辑
 * @param config 请求配置
 * @param retries 重试次数
 */
async function retryRequest<T>(
  config: AxiosRequestConfig & HttpConfig,
  retries: number = config.retryCount ?? MAX_RETRIES,
): Promise<T> {
  const enableRetry = config.enableRetry !== false

  try {
    return await request<T>(config)
  }
  catch (error) {
    if (enableRetry && retries > 0 && error instanceof HttpError && shouldRetry(error.code)) {
      await delay(RETRY_DELAY)
      return retryRequest<T>(config, retries - 1)
    }
    throw error
  }
}

/**
 * 文件下载
 * @param url 下载地址
 * @param params 查询参数
 * @param config 下载配置
 */
async function download(
  url: string,
  params?: Record<string, any>,
  config?: DownloadConfig,
): Promise<void> {
  try {
    const { filename, onProgress, ...restConfig } = config || {}

    const response = await axiosInstance.request({
      url,
      method: 'GET',
      params,
      responseType: 'blob',
      ...restConfig,
      onDownloadProgress: onProgress
        ? (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0
            onProgress(progress)
          }
        : undefined,
    })

    // 检查是否是错误响应（返回的是 JSON）
    const blob = response.data as Blob
    if (blob.type === 'application/json') {
      const text = await blob.text()
      const error = JSON.parse(text)
      throw createHttpError(error.msg || $t('httpMsg.downloadFailed'), error.code || ApiStatus.error)
    }

    // 触发下载
    const downloadFilename = filename || getFilenameFromResponse(response)
    triggerDownload(blob, downloadFilename)
  }
  catch (error) {
    if (error instanceof HttpError) {
      showError(error)
    }
    throw error
  }
}

/**
 * 文件上传
 * @param url 上传地址
 * @param file 文件对象或文件列表
 * @param config 上传配置
 */
async function upload<T = any>(
  url: string,
  file: File | File[],
  config?: UploadConfig,
): Promise<T> {
  const { fields, onProgress, ...restConfig } = config || {}

  // 构建 FormData
  const formData = new FormData()

  // 添加文件
  if (Array.isArray(file)) {
    file.forEach((f, index) => {
      formData.append(`file${index}`, f)
    })
  }
  else {
    formData.append('file', file)
  }

  // 添加额外字段
  if (fields) {
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value)
    })
  }

  return retryRequest<T>({
    url,
    method: 'POST',
    data: formData,
    timeout: UPLOAD_TIMEOUT,
    ...restConfig,
    onUploadProgress: onProgress
      ? (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0
          onProgress(progress)
        }
      : undefined,
  })
}

/**
 * GET 请求
 * @param url 请求地址
 * @param params 查询参数
 * @param config 请求配置
 */
function get<T = any>(
  url: string,
  params?: Record<string, any>,
  config?: HttpConfig,
): Promise<T> {
  return retryRequest<T>({
    url,
    method: 'GET',
    params,
    ...config,
  })
}

/**
 * POST 请求
 * @param url 请求地址
 * @param data 请求体数据
 * @param config 请求配置
 */
function post<T = any>(
  url: string,
  data?: any,
  config?: HttpConfig,
): Promise<T> {
  return retryRequest<T>({
    url,
    method: 'POST',
    data,
    ...config,
  })
}

/**
 * PUT 请求
 * @param url 请求地址
 * @param data 请求体数据
 * @param config 请求配置
 */
function put<T = any>(
  url: string,
  data?: any,
  config?: HttpConfig,
): Promise<T> {
  return retryRequest<T>({
    url,
    method: 'PUT',
    data,
    ...config,
  })
}

/**
 * PATCH 请求
 * @param url 请求地址
 * @param data 请求体数据
 * @param config 请求配置
 */
function patch<T = any>(
  url: string,
  data?: any,
  config?: HttpConfig,
): Promise<T> {
  return retryRequest<T>({
    url,
    method: 'PATCH',
    data,
    ...config,
  })
}

/**
 * DELETE 请求
 * @param url 请求地址
 * @param params 查询参数
 * @param config 请求配置
 */
function del<T = any>(
  url: string,
  params?: Record<string, any>,
  config?: HttpConfig,
): Promise<T> {
  return retryRequest<T>({
    url,
    method: 'DELETE',
    params,
    ...config,
  })
}

const http = {
  get,
  post,
  put,
  patch,
  del,
  delete: del,
  download,
  upload,
  request: retryRequest,
}

export default http
