"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RedirectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inhabitants")
      .then((res) => res.json())
      .then((data) => {
        router.replace(`/memory/${data.default}`);
      })
      .catch((err) => {
        setError("Failed to load inhabitants");
        console.error(err);
      });
  }, [router]);

  if (error) return <div className="flex h-screen items-center justify-center"><p>{error}</p></div>;
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
    </div>
  );
}
