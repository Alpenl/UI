import 'i18next'
import type { locales } from './index'
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'app'
    resources: (typeof locales)['zh-CN']['resources']
    strictKeyChecks: true
  }
}
