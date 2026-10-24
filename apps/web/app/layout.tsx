"use client"

import { Geist, Geist_Mono, Inter } from "next/font/google"
import { usePathname } from "next/navigation"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider as ClientAuthProvider } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import Navbar from "@/components/Navbar"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const noNavbarPaths = ["/login", "/signup", "/forgot-password"]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const showNavbar = !noNavbarPaths.includes(pathname)

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>
          <ClientAuthProvider>
            {showNavbar && <Navbar />}
            <main className={cn(showNavbar && "pt-16")}>{children}</main>
          </ClientAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
