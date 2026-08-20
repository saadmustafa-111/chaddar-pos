import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SteelCoil POS",
  description: "Steel Coil Inventory & Sales Management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full bg-[#080B10] antialiased">
        {children}
      </body>
    </html>
  );
}
