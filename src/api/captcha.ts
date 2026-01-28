import http from '@/utils/http'

const BASE_URL = '/captcha'

/**
 * 获取图片验证码
 */
export function getImageCaptcha() {
  return http.get<Api.Captcha.ImageCaptchaResp>(`${BASE_URL}/image`)
}
