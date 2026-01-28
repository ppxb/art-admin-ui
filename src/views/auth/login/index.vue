<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElNotification } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getImageCaptcha } from '@/api/captcha'
import { useUserStore } from '@/store/modules/user'
import { HttpError } from '@/utils/http/error'

defineOptions({ name: 'Login' })

const { t, locale } = useI18n()
const formKey = ref(0)

// 监听语言切换，重置表单
watch(locale, () => {
  formKey.value++
})

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const captchaImgBase64 = ref<string>()
const formRef = ref<FormInstance>()
const isCaptchaEnabled = ref<boolean>(true)

// 验证码过期定时器
let timer: ReturnType<typeof setTimeout> | null = null

const formData = reactive({
  tenantCode: '',
  username: 'admin',
  password: 'admin123',
  captcha: '',
  uuid: '',
  expired: false,
  rememberPassword: true,
})

const rules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }],
}))

const loading = ref(false)

async function getCaptcha() {
  const { uuid, img, expireTime, isEnabled } = await getImageCaptcha()
  isCaptchaEnabled.value = isEnabled
  captchaImgBase64.value = img
  formData.uuid = uuid
  formData.expired = false
  startTimer(expireTime, Date.now())
}

// 验证码过期定时器
function startTimer(expireTime: number, curTime: number = Date.now()) {
  if (timer) {
    clearTimeout(timer)
  }
  const remainingTime = expireTime - curTime

  // 已经过期
  if (remainingTime <= 0) {
    formData.expired = true
    return
  }

  // 设置过期定时器
  timer = setTimeout(() => {
    formData.expired = true
  }, remainingTime)
}

// 组件销毁时清理定时器
onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
  }
})

// 登录
async function handleSubmit() {
  if (!formRef.value)
    return

  try {
    // 表单验证
    const valid = await formRef.value.validate()
    if (!valid)
      return

    // 检查验证码是否过期
    if (isCaptchaEnabled.value && formData.expired) {
      ElNotification.error(t('login.error.captchaExpired'))
      // getCaptcha() // 刷新验证码
      return
    }

    loading.value = true

    // 登录请求
    const { username, password, captcha, uuid, tenantCode } = formData

    // 密码加密
    // const encryptedPassword = encryptByRsa(password)
    // if (!encryptedPassword) {
    //   ElNotification.error(`${t('login.error.passwordEncrypt')}`)
    //   return
    // }

    // 1. 登录获取 token
    await userStore.accountLogin(
      {
        username,
        password,
        captcha: isCaptchaEnabled.value ? captcha : undefined,
        uuid: isCaptchaEnabled.value ? uuid : undefined,
      },
      tenantCode,
    )

    // 登录成功处理
    showLoginSuccessNotice()

    // 获取 redirect 参数，如果存在则跳转到指定页面，否则跳转到首页
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  }
  catch (error) {
    // 处理 HttpError
    if (error instanceof HttpError) {
      // 验证码错误时刷新验证码
      if (isCaptchaEnabled.value) {
        // getCaptcha()
      }
    }
    else {
      console.error('[Login] Unexpected error:', error)
    }
  }
  finally {
    loading.value = false
  }
}

// 登录成功提示
function showLoginSuccessNotice() {
  setTimeout(() => {
    // 直接从 store 获取最新的用户信息（响应式）
    const userInfo = userStore.info
    ElNotification({
      title: t('login.success.title'),
      type: 'success',
      duration: 2500,
      zIndex: 10000,
      message: `${t('login.success.message')}, ${userInfo?.nickname}!`,
    })
  }, 1000)
}

onMounted(getCaptcha)
</script>

<template>
  <div class="flex w-full h-screen bg-[var(--art-color)]">
    <LoginLeftView />

    <div class="relative flex-1">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">
            {{ $t('login.title') }}
          </h3>
          <p class="sub-title">
            {{ $t('login.subTitle') }}
          </p>
          <ElForm
            ref="formRef"
            :key="formKey"
            :model="formData"
            :rules="rules"
            style="margin-top: 25px"
            @keyup.enter="handleSubmit"
          >
            <ElFormItem prop="tenantCode">
              <ElInput
                v-model.trim="formData.tenantCode"
                class="custom-height"
                :placeholder="$t('login.placeholder.tenantCode')"
              />
            </ElFormItem>
            <ElFormItem prop="username">
              <ElInput
                v-model.trim="formData.username"
                class="custom-height"
                :placeholder="$t('login.placeholder.username')"
              />
            </ElFormItem>
            <ElFormItem prop="password">
              <ElInput
                v-model.trim="formData.password"
                class="custom-height"
                :placeholder="$t('login.placeholder.password')"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <!-- 图片验证 -->
            <ElFormItem v-if="isCaptchaEnabled" prop="captcha">
              <ElInput
                v-model="formData.captcha"
                :placeholder="$t('login.placeholder.captcha')"
                :max-length="4"
                clearable
                class="custom-height"
                style="flex: 1 1"
              />
              <div class="captcha-container">
                <img :src="captchaImgBase64" :alt="$t('login.captcha')" class="captcha">
                <div v-if="formData.expired" class="overlay">
                  <p>{{ $t('login.expired') }}</p>
                </div>
              </div>
            </ElFormItem>

            <div class="flex-cb mt-2 text-sm">
              <ElCheckbox v-model="formData.rememberPassword">
                {{
                  $t('login.rememberPwd')
                }}
              </ElCheckbox>
              <RouterLink class="text-theme" :to="{ name: 'ForgetPassword' }">
                {{
                  $t('login.forgetPwd')
                }}
              </RouterLink>
            </div>

            <div style="margin-top: 30px">
              <ElButton
                v-ripple
                class="w-full custom-height"
                type="primary"
                :loading="loading"
                @click="handleSubmit"
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>

            <div class="mt-5 text-sm text-gray-600">
              <span>{{ $t('login.noAccount') }}</span>
              <RouterLink class="text-theme" :to="{ name: 'Register' }">
                {{
                  $t('login.register')
                }}
              </RouterLink>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  @import './style.css';
</style>

<style lang="scss" scoped>
  :deep(.el-select__wrapper) {
    height: 40px !important;
  }
</style>
