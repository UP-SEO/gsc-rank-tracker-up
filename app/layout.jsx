import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "GSC Tool",
  description: "Google Search Console Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
