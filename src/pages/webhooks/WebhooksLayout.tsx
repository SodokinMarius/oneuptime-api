import { createProductLayout } from '@/components/layout/createProductLayout'
import WebhooksSideMenu from '@/pages/webhooks/WebhooksSideMenu'

export default createProductLayout({
  SideMenu: WebhooksSideMenu,
  hideMenuOnDetail: /^\/webhooks\/[^/]+$/,
})
