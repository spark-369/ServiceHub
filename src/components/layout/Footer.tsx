/** Slim site footer. Static and server-renderable. */
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} ServiceHub. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
