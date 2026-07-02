import { useLocation } from 'react-router-dom'
import { ResourceSideMenu } from '@/components/layout/DetailPageLayout'
import {
  findActiveProduct,
  getProductSideNav,
  isSideNavItemActive,
} from '@/components/layout/productMenu'
import { usePermissions } from '@/hooks/usePermissions'

export default function ProductSideMenu() {
  const location = useLocation()
  const { permissions } = usePermissions()
  const product = findActiveProduct(location.pathname, permissions)

  if (!product) return null

  const sections = getProductSideNav(product.pathPrefix, permissions)
  if (sections.length === 0) return null

  return (
    <ResourceSideMenu
      sections={sections.map(section => ({
        title: section.title,
        items: section.items.map(item => ({
          label: item.label,
          to: item.to,
          end: item.end,
          isActive: isSideNavItemActive(item, location),
        })),
      }))}
    />
  )
}
