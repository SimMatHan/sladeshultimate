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
    <section className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-white">
      <div 
        className={`flex flex-1 flex-col overflow-x-hidden bg-white px-4 pt-3 ${allowScroll ? 'overflow-y-auto' : 'overflow-y-hidden'}`}
        style={allowScroll ? { scrollBehavior: 'smooth', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' } : undefined}
      >
        <div className={allowScroll ? '' : 'flex-1'}>{children}</div>
      </div>
    </section>
  );
}
