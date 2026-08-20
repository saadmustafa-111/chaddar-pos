'use client';

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Overview of your SteelCoil system
        </p>
      </div>

      <div className="grid gap-6">
        <div className="bg-[#0B0F14] border border-[#1C232C] rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">
            System Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Database</span>
              <span className="text-sm text-zinc-300">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Application</span>
              <span className="text-sm text-zinc-300">Ready</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0B0F14] border border-[#1C232C] rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">
            Getting Started
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Configure price categories from the Pricing section to set up your market rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
