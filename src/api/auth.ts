import http from '@/utils/http'

const BASE_URL = '/auth'

/**
 * 登录
 * @param req 登录参数
 * @param tenantCode 租户编码
 * @returns 登录响应
 */
export function login(req: Api.LoginReq, tenantCode?: string): Promise<Api.LoginResp> {
  const headers: Record<string, string> = {}

  if (tenantCode) {
    headers['X-Tenant-Code'] = tenantCode
  }

  return http.post<Api.LoginResp>(`${BASE_URL}/login`, req, { headers })
}

/**
 * 账号登录
 * @param req 账号登录参数
 * @param tenantCode 租户编码
 * @returns 登录响应
 */
export function accountLogin(req: Api.AccountLoginReq, tenantCode?: string) {
  return login(req, tenantCode)
}

/**
 * 手机号登录
 * @param req 手机号登录参数
 * @param tenantCode 租户编码
 * @returns 登录响应
 */
export function phoneLogin(req: Api.PhoneLoginReq, tenantCode?: string) {
  return login(req, tenantCode)
}

/**
 * 邮箱登录
 * @param req 邮箱登录参数
 * @param tenantCode 租户编码
 * @returns 登录响应
 */
export function emailLogin(req: Api.EmailLoginReq, tenantCode?: string) {
  return login(req, tenantCode)
}

/**
 * 第三方登录
 * @param req 第三方登录参数
 * @returns 登录响应
 */
export function socialLogin(req: Api.SocialLoginReq) {
  return login(req)
}

/**
 * 第三方登录授权
 * @param source 第三方登录授权源
 * @returns 登录响应
 */
export function socialAuth(source: string) {
  return http.get<Api.SocialLoginResp>(`${BASE_URL}/${source}`)
}

/**
 * 退出登录
 */
export function logout() {
  return http.post(`${BASE_URL}/logout`)
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  return http.get<Api.UserInfo>(`${BASE_URL}/user/info`)
}

/**
 * 获取路由信息
 */
export function getUserRoute() {
  return http.get<any>(`${BASE_URL}/user/route`)
}
