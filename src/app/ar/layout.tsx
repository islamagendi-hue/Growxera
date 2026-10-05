/** Arabic section of the site: right-to-left. Dubai Font (the site font) covers Arabic. */
export default function ArabicLayout({ children }: LayoutProps<"/ar">) {
  return (
    <div lang="ar" dir="rtl" className="lang-ar">
      {children}
    </div>
  );
}
