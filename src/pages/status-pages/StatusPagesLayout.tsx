import { createProductLayout } from '@/components/layout/createProductLayout'
import StatusPagesSideMenu from '@/pages/status-pages/StatusPagesSideMenu'

export default createProductLayout({
  SideMenu: StatusPagesSideMenu,
  hideMenuOnDetail: /^\/status-pages\/[^/]+$/,
})
