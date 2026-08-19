import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import NavBar from "@/components/NavBar";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Search Copilot",
  description: "Busca, puntúa y postula a empleos alineados con tu perfil.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <NavBar />
          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
