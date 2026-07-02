interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

export type { IconProps }

const base = (size: number, className: string, children: React.ReactNode, strokeWidth = 1.75) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
)

export const IconLayoutDashboard = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </>, strokeWidth)

export const IconActivity = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
  </>, strokeWidth)

export const IconAlertTriangle = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>, strokeWidth)

export const IconWrench = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </>, strokeWidth)

export const IconGlobe = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </>, strokeWidth)

export const IconBell = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>, strokeWidth)

export const IconShieldCheck = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>, strokeWidth)

export const IconUsers = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>, strokeWidth)

export const IconSettings = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>, strokeWidth)

export const IconLogOut = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>, strokeWidth)

export const IconX = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>, strokeWidth)

export const IconMenu = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </>, strokeWidth)

export const IconChevronLeft = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <polyline points="15 18 9 12 15 6" />, strokeWidth)

export const IconChevronRight = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <polyline points="9 18 15 12 9 6" />, strokeWidth)

export const IconPlus = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>, strokeWidth)

export const IconSearch = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>, strokeWidth)

export const IconPlay = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <polygon points="6 3 20 12 6 21 6 3" />, strokeWidth)

export const IconPause = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect x="14" y="4" width="4" height="16" rx="1" />
    <rect x="6" y="4" width="4" height="16" rx="1" />
  </>, strokeWidth)

export const IconTrash2 = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </>, strokeWidth)

export const IconArrowRight = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>, strokeWidth)

export const IconMonitor = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
  </>, strokeWidth)

export const IconWifi = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" x2="12.01" y1="20" y2="20" />
  </>, strokeWidth)

export const IconServer = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="6" y2="6" />
    <line x1="6" x2="6.01" y1="18" y2="18" />
  </>, strokeWidth)

export const IconLink = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>, strokeWidth)

export const IconHeart = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </>, strokeWidth)

export const IconCheckCircle = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </>, strokeWidth)

export const IconAlertCircle = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </>, strokeWidth)

export const IconMail = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>, strokeWidth)

export const IconLock = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>, strokeWidth)

export const IconEye = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </>, strokeWidth)

export const IconEyeOff = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </>, strokeWidth)

export const IconBuilding = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </>, strokeWidth)

export const IconTrendingUp = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>, strokeWidth)

export const IconZap = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />, strokeWidth)

export const IconRefreshCw = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>, strokeWidth)

export const IconCalendar = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </>, strokeWidth)

export const IconFileText = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </>, strokeWidth)

export const IconUser = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>, strokeWidth)

export const IconClock = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>, strokeWidth)

export const IconFolder = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </>, strokeWidth)

export const IconChevronDown = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <path d="m6 9 6 6 6-6" />, strokeWidth)

export const IconHome = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>, strokeWidth)

export const IconGrid = ({ size = 18, className = '', strokeWidth }: IconProps) =>
  base(size, className, <>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </>, strokeWidth)
