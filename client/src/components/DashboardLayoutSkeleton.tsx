import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-[#FDF7EE]" dir="rtl">
      {/* Sidebar skeleton */}
      <div className="relative hidden w-[278px] border-l border-[rgba(15,118,110,0.14)] bg-[#FFFDF8] p-4 space-y-6 lg:block">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-2 pt-1">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Menu groups */}
        <div className="space-y-5 px-2 pt-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* User profile area at bottom */}
        <div className="absolute bottom-4 left-4 right-4 border-t border-[rgba(15,118,110,0.12)] pt-4">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-4 sm:p-6 lg:p-9 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-[20px]" />
          <Skeleton className="h-28 rounded-[20px]" />
          <Skeleton className="h-28 rounded-[20px]" />
          <Skeleton className="h-28 rounded-[20px]" />
        </div>
        <Skeleton className="h-72 rounded-[24px]" />
      </div>
    </div>
  );
}
