export default function Page({
  title,
  subtitle,
  actions,
  notifications,
  messages,
  onProfileClick,
  children,
  allowScroll = false,
}) {
  return (
    <section 
      className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div 
        className={`flex flex-1 flex-col overflow-x-hidden px-4 pt-3 ${allowScroll ? 'overflow-y-auto' : 'overflow-y-hidden'}`}
        style={{
          backgroundColor: 'var(--bg)',
          ...(allowScroll ? { scrollBehavior: 'smooth', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' } : {})
        }}
      >
        <div className={allowScroll ? '' : 'flex-1'}>{children}</div>
      </div>
    </section>
  );
}
