export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-6">
        <p className="text-sm uppercase tracking-widest text-teal-600">Qesto</p>
        <h1 className="text-4xl md:text-6xl font-semibold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent">
          Feel the pulse of the room — AI amplifies it.
        </h1>
        <p className="text-lg text-pulse-600">
          Real-time interactive sessions on Cloudflare&rsquo;s edge. v1 vertical slice — Phase 0 scaffold.
        </p>
      </div>
    </main>
  )
}
