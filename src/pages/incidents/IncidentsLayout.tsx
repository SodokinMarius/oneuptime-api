import { createProductLayout } from '@/components/layout/createProductLayout'
import IncidentsSideMenu from '@/pages/incidents/IncidentsSideMenu'

export default createProductLayout({
  SideMenu: IncidentsSideMenu,
  hideMenuOnDetail: /^\/incidents\/[^/]+$/,
})
