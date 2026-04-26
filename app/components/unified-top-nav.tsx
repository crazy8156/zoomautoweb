import Link from 'next/link';

type NavScope = 'public' | 'student' | 'admin';

type UnifiedTopNavProps = {
  scope: NavScope;
  currentPath: string;
  showLogout?: boolean;
};

type NavItem = {
  label: string;
  href: string;
};

const scopeConfig: Record<
  NavScope,
  {
    brand: string;
    items: NavItem[];
    secondary: NavItem[];
  }
> = {
  public: {
    brand: 'Zoom eLearning',
    items: [
      { label: '首頁', href: '/' },
      { label: '學生中心', href: '/student' },
      { label: '課程中心', href: '/student/course-center' },
      { label: '自學中心', href: '/jaeasy' },
    ],
    secondary: [
      { label: '學生登入', href: '/jaeasy/login?next=/student' },
      { label: '教師登入', href: '/admin/login' },
    ],
  },
  student: {
    brand: '學生中心',
    items: [
      { label: '學生首頁', href: '/student' },
      { label: '課程中心', href: '/student/course-center' },
      { label: '自學中心', href: '/jaeasy' },
      { label: '會員方案', href: '/student/membership' },
    ],
    secondary: [
      { label: '回前台首頁', href: '/' },
      { label: '教師後台', href: '/admin/login' },
    ],
  },
  admin: {
    brand: '老師後台',
    items: [
      { label: '老師後台管理', href: '/admin' },
      { label: '課程中心', href: '/admin/course-center' },
      { label: '自學中心', href: '/admin/jaeasy' },
      { label: '自學會員', href: '/admin/jaeasy/members' },
    ],
    secondary: [
      { label: '回前台首頁', href: '/' },
      { label: '學生中心', href: '/student' },
    ],
  },
};

function isCurrentPath(currentPath: string, href: string) {
  if (href === '/') {
    return currentPath === '/';
  }

  return currentPath === href || currentPath.startsWith(`${href}/`) || currentPath.startsWith(`${href}?`);
}

export function UnifiedTopNav({ scope, currentPath, showLogout = false }: UnifiedTopNavProps) {
  const config = scopeConfig[scope];

  return (
    <nav className='sticky top-0 z-50 border-b border-sky-100/80 bg-white/88 backdrop-blur'>
      <div className='mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8'>
        <div className='flex flex-wrap items-center gap-6'>
          <Link href='/' className='text-lg font-black tracking-tight text-slate-950 md:text-xl'>
            {config.brand}
          </Link>
          <div className='hidden flex-wrap items-center gap-3 md:flex'>
            {config.items.map((item) => {
              const active = isCurrentPath(currentPath, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          {config.secondary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className='rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
            >
              {item.label}
            </Link>
          ))}
          {showLogout ? (
            <a
              href='/admin/logout'
              className='rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'
            >
              登出
            </a>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
