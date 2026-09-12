import type { ReactNode } from "react";

/**
 * IdentityShell — wraps standalone (non-DashboardLayout) staff pages with the
 * dashboard identity: brand tokens + Cairo + the ambient cream gradient and
 * aurora orbs, plus the same hover-zoom scope.
 *
 * Used for routes rendered outside DashboardLayout (e.g. call-center agent /
 * ForShip client account) so the visual identity is consistent everywhere.
 * Storefront routes must NOT use this (isolation).
 */
export function IdentityShell({ children }: { children: ReactNode }) {
  return (
    <div className="dash-identity relative min-h-screen" dir="rtl">
      <div className="dash-aurora" aria-hidden="true">
        <span className="home-orb home-orb-1" />
        <span className="home-orb home-orb-2" />
        <span className="home-orb home-orb-3" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
