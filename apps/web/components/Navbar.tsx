// components/Navbar.tsx

"use client"

import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const Navbar = () => {
  const { user, logout } = useAuth()

  return (
    <header className="sticky flex border-b bg-background/70 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="top-0 z-50 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        {/* LEFT */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Streamly
          </Link>
        </div>

        {/* CENTER SEARCH */}
        <div className="hidden flex-1 justify-center px-6 md:flex">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="CTRL+K"
              className="border-none bg-muted/50 pl-10 focus-visible:ring-1"
            />
          </div>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm font-medium">{user.username}</span>
              <Button
                variant="ghost"
                size="lg"
                onClick={logout}
                className="cursor-pointer"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" passHref>
                <Button variant="ghost" size="lg" className="cursor-pointer">
                  Login
                </Button>
              </Link>
              <Link href="/signup" passHref>
                <Button size="lg" className="cursor-pointer">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
