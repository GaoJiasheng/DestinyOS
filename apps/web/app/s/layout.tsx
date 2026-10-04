import '../globals.css';
import '../[locale]/fonts.css';
/** Public shares have their own root shell because their documented URL has no locale prefix. */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
