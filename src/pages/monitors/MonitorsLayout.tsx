import { createProductLayout } from '@/components/layout/createProductLayout'
import MonitorsSideMenu from '@/pages/monitors/MonitorsSideMenu'

export default createProductLayout({
  SideMenu: MonitorsSideMenu,
  hideMenuOnDetail: /^\/monitors\/[^/]+$/,
})
